sap.ui.define([
  "sap/ui/model/json/JSONModel"
], function (JSONModel) {
  "use strict";

  // Thin, swappable persistence wrapper for Phase 2 personalization features
  // (FilterBar search variants, master table column layout, Items p13n).
  //
  // Phase 2 Prompt v2 (item B) asks for "one model/VariantStore.js wrapper (FLP
  // personalization service when available, localStorage fallback), so persistence
  // is swappable." This deliberately does NOT use sap.ui.fl / sap.m.VariantManagement's
  // built-in flex-persistence flow: that requires a live FLP personalization backend
  // to verify against, which is out of scope for this UI-only pass (TODO-VERIFY when
  // the app is running in the real FLP — swap the localStorage branch below for the
  // ushell personalization service without changing any caller).
  //
  // Storage shape per key: { variants: { <name>: <json-serializable value> }, lastSelectedKey: <name>|null }

  function getUshellPersonalizationContainer() {
    try {
      var oContainerFactory = sap.ui.require("sap/ushell/Container");
      return oContainerFactory && oContainerFactory.getService ? oContainerFactory : null;
    } catch (e) {
      return null;
    }
  }

  function storageKey(sKey) {
    return "cdc.vaccreq.variant." + sKey;
  }

  function readLocal(sKey) {
    try {
      var sRaw = window.localStorage.getItem(storageKey(sKey));
      return sRaw ? JSON.parse(sRaw) : { variants: {}, lastSelectedKey: null };
    } catch (e) {
      return { variants: {}, lastSelectedKey: null };
    }
  }

  function writeLocal(sKey, oData) {
    try {
      window.localStorage.setItem(storageKey(sKey), JSON.stringify(oData));
    } catch (e) {
      // localStorage unavailable/full — personalization is best-effort, never fatal.
    }
  }

  // Sections Catalog & Personalization PR2 — the FLP Personalization service
  // (sap.ushell.Container's "Personalization" service) is CONFIRMED live and
  // working (manual test, Nov 2026: write via setPersData, full page reload,
  // fresh getPersonalizer().getPersData() read back the identical value —
  // real server-side per-user persistence, not just in-memory caching).
  // This is an ADDITIVE async API, NOT a replacement of load/save above: the
  // existing sync localStorage-only API has callers (Master.controller.js
  // column layout/sort/group, Detail.controller.js Items column visibility)
  // that read/write synchronously and would all need reworking to tolerate a
  // Promise if the FLP branch were spliced into `load`/`save` themselves —
  // out of scope and unnecessary risk for this PR. New callers that can
  // tolerate an async round trip (e.g. a p13n dialog's open/Save, already
  // async user-gesture boundaries) should use loadAsync/saveAsync/deleteAsync
  // instead; a future task could migrate the old API once every caller is
  // audited for async-safety.
  var CONTAINER_ID = "cdc.vaccreq";
  var oPersonalizerCache = {};
  var oContainerPromise = null;
  var sBackend = null; // "flp" | "localStorage" | null (not yet determined)

  function getPersonalizationService() {
    if (!oContainerPromise) {
      oContainerPromise = new Promise(function (resolve) {
        try {
          var oUshellContainer = sap.ui.require("sap/ushell/Container");
          if (!oUshellContainer || !oUshellContainer.getServiceAsync) {
            resolve(null);
            return;
          }
          oUshellContainer.getServiceAsync("Personalization").then(resolve, function () {
            resolve(null);
          });
        } catch (e) {
          resolve(null);
        }
      });
    }
    return oContainerPromise;
  }

  function getPersonalizer(sKey, oPersService) {
    if (oPersonalizerCache[sKey]) {
      return oPersonalizerCache[sKey];
    }
    var oPersonalizer = oPersService.getPersonalizer(
      { container: CONTAINER_ID, item: sKey },
      {
        keyCategory: oPersService.constants.keyCategory.FIXED_KEY,
        writeFrequency: oPersService.constants.writeFrequency.LOW,
        clientStorageAllowed: true
      }
    );
    oPersonalizerCache[sKey] = oPersonalizer;
    return oPersonalizer;
  }

  var VariantStore = {
    /**
     * @param {string} sKey stable id for the personalization scope, e.g. "masterFilterBar".
     * @returns {{variants: object, lastSelectedKey: (string|null)}}
     */
    load: function (sKey) {
      // TODO-VERIFY: FLP personalization service branch (sap.ushell.Container's
      // "Personalization" service) once this app runs behind a real FLP; the
      // localStorage fallback below is the only path exercised so far.
      var oUshell = getUshellPersonalizationContainer();
      if (oUshell) {
        // Not implemented yet — fall through to localStorage until verified live.
      }
      return readLocal(sKey);
    },

    save: function (sKey, oData) {
      writeLocal(sKey, oData);
    },

    saveVariant: function (sKey, sName, vValue) {
      var oData = this.load(sKey);
      oData.variants[sName] = vValue;
      oData.lastSelectedKey = sName;
      this.save(sKey, oData);
      return oData;
    },

    deleteVariant: function (sKey, sName) {
      var oData = this.load(sKey);
      delete oData.variants[sName];
      if (oData.lastSelectedKey === sName) {
        oData.lastSelectedKey = null;
      }
      this.save(sKey, oData);
      return oData;
    },

    setLastSelectedKey: function (sKey, sName) {
      var oData = this.load(sKey);
      oData.lastSelectedKey = sName || null;
      this.save(sKey, oData);
      return oData;
    },

    createModel: function (sKey) {
      return new JSONModel(this.load(sKey));
    },

    // --- Async, FLP-Personalization-backed API (Sections Catalog &
    // Personalization PR2) — see the block comment above. Storage shape is
    // the raw value itself (no variants-map wrapper — each key holds exactly
    // one current value, unlike the named Save-As variants the sync API
    // supports). `loadAsync` resolves `null` when nothing is stored yet. ---

    loadAsync: function (sKey) {
      return getPersonalizationService().then(function (oPersService) {
        if (!oPersService) {
          sBackend = sBackend || "localStorage";
          try {
            var sRaw = window.localStorage.getItem("cdc.vaccreq.pers." + sKey);
            return sRaw ? JSON.parse(sRaw) : null;
          } catch (e) {
            return null;
          }
        }
        sBackend = "flp";
        return getPersonalizer(sKey, oPersService).getPersData().then(function (vValue) {
          return vValue === undefined ? null : vValue;
        });
      });
    },

    saveAsync: function (sKey, vValue) {
      return getPersonalizationService().then(function (oPersService) {
        if (!oPersService) {
          sBackend = sBackend || "localStorage";
          try {
            window.localStorage.setItem("cdc.vaccreq.pers." + sKey, JSON.stringify(vValue));
          } catch (e) {
            // best-effort, never fatal.
          }
          return undefined;
        }
        sBackend = "flp";
        var oPersonalizer = getPersonalizer(sKey, oPersService);
        return oPersonalizer.setPersData(vValue);
      });
    },

    deleteAsync: function (sKey) {
      return getPersonalizationService().then(function (oPersService) {
        if (!oPersService) {
          sBackend = sBackend || "localStorage";
          try {
            window.localStorage.removeItem("cdc.vaccreq.pers." + sKey);
          } catch (e) {
            // best-effort, never fatal.
          }
          return undefined;
        }
        sBackend = "flp";
        return getPersonalizer(sKey, oPersService).delPersData();
      });
    },

    // Diagnostics only (e.g. manual live-verification, support questions) —
    // null until the first loadAsync/saveAsync/deleteAsync call resolves.
    getPersonalizationBackend: function () {
      return sBackend;
    }
  };

  return VariantStore;
});
