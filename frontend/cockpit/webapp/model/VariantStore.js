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
    }
  };

  return VariantStore;
});
