sap.ui.define([
  "sap/base/Log",
  "cdc/vaccreq/sections/SectionCatalog"
], function (Log, SectionCatalog) {
  "use strict";

  // Carries an order CATEGORY (CR-1014-001 §0); legacy FLP mappings may still pass an order type.
  var STARTUP_PARAMETER = "providerOrderType";
  var DEFAULT_CATEGORY = "_ORD";

  // The existing views are the shared baseline; add only confirmed per-type
  // differences here. `ui` is the single UI-config source, exposed to the
  // Detail view as the `orderUi` model (Detail.controller.js#_applyOrderUi):
  //   kinds  - fields, fieldGroups (Details.fragment.xml), columns (Items
  //            table, ITEMS_COLUMN_KEYS), sections (SectionCatalog.js ids,
  //            resolved through resolveSections() below — NOT read via uiFlag)
  //   flags  - visible, editable; both default to true when absent
  //   XML    - visible="{= ${orderUi>/<kind>/<id>/visible} !== false }"
  //            (editable: append "&& ${orderUi>/<kind>/<id>/editable} !== false")
  //   JS     - uiFlag(oUi, kind, id, flag)
  // Ids currently configured: fields detailsExisId, detailsCreatedAt,
  // detailsReturnType, detailsExisDate, detailsNoOfBoxes,
  // detailsShippingCondition, detailsLabelAddress, grossValue, taxAmount,
  // netValue, priority, notes; fieldGroups detailsValue; columns lotNumber,
  // expirationDate, brand, orderIntention, fundType, poReference; sections
  // inventory, shippingTransactions,
  // transactionHistory, orgData, priceTotals, paymentMethod,
  // scheduledActions, status, dates, partiesInvolved, attachments. Sections
  // and columns are wired generically for every id; for fields/fieldGroups
  // add the XML binding when you add the config entry.
  //
  // Return Orders session prompt (prompts/E008_ReturnOrders_Fields_Session_
  // Prompt.md): the 5 new/moved header fields and 2 new item columns are
  // visible for _RET order types only (ZISL/ZXFR/ZWST/ZKR, the default -
  // uiFlag()'s bDefault !== false) and explicitly hidden on ZKB/ZREP below.
  var RETURN_ORDER_UI_HIDDEN = {
    fields: {
      detailsReturnType: { visible: false },
      detailsExisDate: { visible: false },
      detailsNoOfBoxes: { visible: false },
      detailsShippingCondition: { visible: false },
      detailsLabelAddress: { visible: false },
      grossValue: { visible: false },
      taxAmount: { visible: false },
      netValue: { visible: false },
      priority: { visible: false },
      notes: { visible: false }
    },
    columns: {
      lotNumber: { visible: false },
      expirationDate: { visible: false }
    },
    sections: {
    }

  };

  // Sections Catalog PR1: sections hidden here are also `locked` — not
  // offerable in the (PR2) personalization dialog either, since the hide
  // reflects "this concept does not exist for this category", not a mere
  // display preference.
  function lockedHidden(aIds) {
    var oOut = {};
    aIds.forEach(function (sId) { oOut[sId] = { visible: false, locked: true }; });
    return oOut;
  }

  var PROVIDER_ORDER_UI_HIDDEN = {
    fields: {
      grossValue: { visible: false },
      taxAmount: { visible: false },
      netValue: { visible: false },
      priority: { visible: false },
      notes: { visible: false }
    },
    columns: {
      brand: { visible: false },
      orderIntention: { visible: false },
      fundType: { visible: false },
      poReference: { visible: false },
      // ADR-002 Step-0 shared-binding audit: ZZ1_SKIPADDANC_SDI (optOut) and
      // the _DeliveryStatus nav (deliveryStatus) are both absent on
      // CustomerReturnItemManageType - hiding the Column itself (not just the
      // cell) excludes the bound property from autoExpandSelect's $select for
      // sap.m.Table (documented UI5 behavior), same mechanism as brand/
      // orderIntention/fundType/poReference above.
      optOut: { visible: false },
      deliveryStatus: { visible: false },
      // 2026-11-06: ExpirationDate confirmed GONE from the live $metadata
      // (present in so_C_SALESORDERMANAGE_2026-10-23.xml, absent in the
      // 2026-11-06 re-fetch - backend regression, not a rename) - was
      // visible for the _RET-category order types here (ZISL/ZXFR/ZWST/ZKR,
      // via RETURNS_UI_HIDDEN below, which is seeded from this same object)
      // and threw a 404/auto-$expand error storm on every item add/edit.
      // Hidden universally until the backend restores it; see
      // OrdersSchema.js#itemProperties.expirationDate (left null).
      expirationDate: { visible: false }
      // exisId column UN-HIDDEN (2026-10-27 metadata re-audit): ExisItemNumber
      // IS real on CustomerReturnItemManageType - the prior "5th literal-binding
      // hazard" hide was based on the OLDER 2026-10-26 metadata, which omitted
      // it. Items.fragment.xml's exisId Input is bound to it directly again.
    },
    sections: lockedHidden([
      "inventory", "shipping", "shippingTransactions", "transactionHistory",
      "orgData", "priceTotals", "paymentMethod", "scheduledActions",
      "status", "dates", "partiesInvolved", "attachments"
    ])
  };

  // ADR-002 (Returns_Single_App_Service_Profile) PR1: ONE consistent hide set
  // shared by every _RET order type (ZISL/ZXFR/ZWST/ZKR) - replaces the
  // previous per-type ad-hoc duplication (which had drifted inconsistent:
  // detailsShippingCondition was wrongly hidden on 3 of 4 types despite being
  // a real, PATCHable CustomerReturnManage property; detailsReturnType/
  // detailsExisDate/detailsNoOfBoxes were inconsistently hidden across types
  // despite ALL being absent on this service for every _RET type alike).
  var RETURNS_UI_HIDDEN = {
    fields: Object.assign({}, PROVIDER_ORDER_UI_HIDDEN.fields, {
      // Already a non-functional BLOCKED-BY-SERVICE disabled placeholder in
      // every mode (no backend field/VH for ANY order type) - hidden for
      // consistency rather than showing a dead placeholder.
      // detailsLabelAddress: { visible: false },
      // Live-test (exceptions.txt 2026-10-27): _SoldToPartyContactInfo/
      // ResponsibleEmployee confirmed absent (ReturnsSchema.js navigation.
      // headerToContactInfo: null) - no Employee Responsible display value
      // exists for Returns at all.
      // employeeResponsible: { visible: false }
      // detailsShippingCondition intentionally NOT in this hide list -
      // ShippingCondition IS a real, PATCHable CustomerReturnManage property
      // (NOTES.md "Returns MVP-2 Step-0") and Details.fragment.xml's own
      // comment says this field is "Shown here for _RET order types only".
      //
      // detailsReturnType/detailsExisDate/detailsNoOfBoxes UN-HIDDEN (2026-10-27
      // metadata re-audit): SpecialProcessingCode/CustomerPurchaseOrderDate/
      // CustomerPurchaseOrderSuplmnt are ALL confirmed real on
      // CustomerReturnManageType - the prior hide ("absent on this service")
      // was based on the OLDER 2026-10-26 metadata, which omitted them.
    }),
    columns: Object.assign({}, PROVIDER_ORDER_UI_HIDDEN.columns),
    // ret-10-28 #1: shipping UN-HIDDEN for _RET - DeliveryBlockReason is a
    // real, raw-code-only property on CustomerReturnManageType (confirmed
    // live, 2026-10-28 metadata); sections/returns/Shipping.fragment.xml maps
    // it instead of orders' _OverallDeliveryBlockStatus text lookup (which
    // does not exist on this service). Every other PROVIDER_ORDER_UI_HIDDEN
    // section stays hidden for _RET.
    sections: Object.assign({}, PROVIDER_ORDER_UI_HIDDEN.sections, {
      shipping: { visible: true, locked: false }
    })
  };

  function baselineType(sOrderType, sTitleKey) {
    return {
      orderType: sOrderType,
      titleKey: sTitleKey,
      defaults: {},
      createStatusDefault: "",
      createStatusOptions: [],
      editStatusOptions: [],
      categoryOptions: [],
      createCategoryDefaultKey: "",
      ui: { fields: {}, fieldGroups: {}, columns: {}, sections: {} }
    };
  }

  var ORDER_TYPES = {
    ZKB: {
      orderType: "ZKB",
      titleKey: "orderTypeZkb",
      defaults: {},
      createStatusDefault: "",
      createStatusOptions: [],
      editStatusOptions: [],
      categoryOptions: [],
      createCategoryDefaultKey: "",
      ui: {
        fields: Object.assign({}, RETURN_ORDER_UI_HIDDEN.fields),
        fieldGroups: {},
        columns: Object.assign({}, RETURN_ORDER_UI_HIDDEN.columns),
        sections: {}
      }
    },
    ZREP: {
      orderType: "ZREP",
      titleKey: "orderTypeZrep",
      defaults: {},
      createStatusDefault: "2A",
      // createStatusOptions: ZREP_STATUS_OPTIONS,
      // editStatusOptions: ZREP_STATUS_OPTIONS,
      createStatusOptions: [],
      editStatusOptions: [],
      categoryOptions: [],
      createCategoryDefaultKey: "",
      ui: {
        fields: Object.assign({
          detailsExisId: { visible: false },
          detailsCreatedAt: { visible: false }
        }, RETURN_ORDER_UI_HIDDEN.fields),
        fieldGroups: {
          detailsValue: { visible: false }
        },
        columns: Object.assign({}, RETURN_ORDER_UI_HIDDEN.columns),
        sections: Object.assign({}, RETURN_ORDER_UI_HIDDEN.sections)
      }
    },
    // Returns (_RET): ADR-002 (Returns_Single_App_Service_Profile) PR1 - all
    // 4 types share ONE consistent RETURNS_UI_HIDDEN hide set (see above).
    ZISL: {
      orderType: "ZISL",
      titleKey: "orderTypeZisl",
      defaults: {},
      createStatusDefault: "2A",
      createStatusOptions: [],
      editStatusOptions: [],
      categoryOptions: [],
      createCategoryDefaultKey: "",
      ui: {
        fields: Object.assign({
          detailsNoOfBoxes: { visible: false },
          detailsShippingCondition: { visible: false },
          detailsLabelAddress: { visible: false }
        }, RETURNS_UI_HIDDEN.fields),
        fieldGroups: {
          detailsValue: { visible: false }
        },
        columns: Object.assign({}, RETURNS_UI_HIDDEN.columns),
        sections: Object.assign({}, RETURNS_UI_HIDDEN.sections)
      }
    },
    // Renamed from ZCFR (CONFIRMED BUG fixed this session): ORDER_CATEGORIES.
    // _RET.orderTypes below references "ZXFR" (matches i18n.properties'
    // orderTypeZxfr=Transfer); the stale "ZCFR" key here had no i18n entry at
    // all and made the module-load-time validation loop throw on EVERY app
    // launch (both _ORD and _RET) - see NOTES.md.
    ZXFR: {
      orderType: "ZXFR",
      titleKey: "orderTypeZxfr",
      defaults: {},
      createStatusDefault: "2A",
      createStatusOptions: [],
      editStatusOptions: [],
      categoryOptions: [],
      createCategoryDefaultKey: "",
      ui: {
        fields: Object.assign({
          detailsNoOfBoxes: { visible: false },
          detailsShippingCondition: { visible: false },
          detailsLabelAddress: { visible: false },
          detailsReturnType: { visible: false },
          detailsExisDate: { visible: false }
        }, RETURNS_UI_HIDDEN.fields),
        fieldGroups: {
          detailsValue: { visible: false }
        },
        columns: Object.assign({}, RETURNS_UI_HIDDEN.columns),
        sections: Object.assign({}, RETURNS_UI_HIDDEN.sections)
      }
    },
    ZWST: {
      orderType: "ZWST",
      titleKey: "orderTypeZwst",
      defaults: {},
      createStatusDefault: "2A",
      createStatusOptions: [],
      editStatusOptions: [],
      categoryOptions: [],
      createCategoryDefaultKey: "",
      ui: {
        fields: Object.assign({
          detailsNoOfBoxes: { visible: false },
          detailsShippingCondition: { visible: false },
          detailsLabelAddress: { visible: false },
          detailsReturnType: { visible: false }
        }, RETURNS_UI_HIDDEN.fields),
        fieldGroups: {
          detailsValue: { visible: false }
        },
        columns: Object.assign({}, RETURNS_UI_HIDDEN.columns),
        sections: Object.assign({}, RETURNS_UI_HIDDEN.sections)
      }
    },
    ZKR: {
      orderType: "ZKR",
      titleKey: "orderTypeZkr",
      defaults: {},
      createStatusDefault: "2A",
      createStatusOptions: [],
      editStatusOptions: [],
      categoryOptions: [],
      createCategoryDefaultKey: "",
      ui: {
        fields: Object.assign({}, RETURNS_UI_HIDDEN.fields),
        fieldGroups: {
          detailsValue: { visible: false }
        },
        columns: Object.assign({}, RETURNS_UI_HIDDEN.columns),
        sections: Object.assign({}, RETURNS_UI_HIDDEN.sections)
      }
    }
  };

  // Category scopes Master search and Create; an order still displays per its own type.
  var ORDER_CATEGORIES = {
    _ORD: { titleKey: "orderCategoryOrd", orderTypes: ["ZKB", "ZREP"] },
    _RET: { titleKey: "orderCategoryRet", orderTypes: ["ZISL", "ZXFR", "ZWST", "ZKR"] }
  };

  function has(oMap, sKey) {
    return Object.prototype.hasOwnProperty.call(oMap, sKey);
  }

  Object.keys(ORDER_CATEGORIES).forEach(function (sCategory) {
    ORDER_CATEGORIES[sCategory].orderTypes.forEach(function (sOrderType) {
      if (!has(ORDER_TYPES, sOrderType)) {
        throw new Error("OrderModeConfig: category " + sCategory + " references unconfigured order type " + sOrderType);
      }
    });
  });

  // Sections Catalog PR1 load-time assertion: every section id this module
  // references must exist in SectionCatalog.js — catches a typo/rename the
  // instant the app boots instead of a silently-ignored (never resolved) id.
  Object.keys(ORDER_TYPES).forEach(function (sOrderType) {
    Object.keys(ORDER_TYPES[sOrderType].ui.sections || {}).forEach(function (sSectionId) {
      if (!SectionCatalog.get(sSectionId)) {
        throw new Error("OrderModeConfig: order type " + sOrderType + " references unknown section id " + sSectionId);
      }
    });
  });

  var DEFAULT_ORDER_TYPE = ORDER_CATEGORIES[DEFAULT_CATEGORY].orderTypes[0];

  function normalizeValue(vValue) {
    var sValue = Array.isArray(vValue) ? vValue[0] : vValue;
    return typeof sValue === "string" ? sValue.trim().toUpperCase() : "";
  }

  function normalizeOrderType(vOrderType) {
    var sOrderType = normalizeValue(vOrderType);
    return has(ORDER_TYPES, sOrderType) ? sOrderType : DEFAULT_ORDER_TYPE;
  }

  function resolveCategory(vValue) {
    var sValue = normalizeValue(vValue);
    if (has(ORDER_CATEGORIES, sValue)) {
      return sValue;
    }
    var sCategory = Object.keys(ORDER_CATEGORIES).filter(function (sKey) {
      return ORDER_CATEGORIES[sKey].orderTypes.indexOf(sValue) !== -1;
    })[0];
    if (sCategory) {
      Log.warning("OrderModeConfig: legacy order-type startup parameter '" + sValue + "' mapped to category " + sCategory);
      return sCategory;
    }
    return DEFAULT_CATEGORY;
  }

  function getCategoryOrderTypes(sCategory) {
    return (ORDER_CATEGORIES[sCategory] || ORDER_CATEGORIES[DEFAULT_CATEGORY]).orderTypes.slice();
  }

  function resolveOrderType(vOrderType) {
    var sOrderType = normalizeOrderType(vOrderType);
    var oConfig = ORDER_TYPES[sOrderType];
    return {
      orderType: sOrderType,
      titleKey: oConfig.titleKey,
      defaults: Object.assign({}, oConfig.defaults),
      createStatusDefault: oConfig.createStatusDefault,
      createStatusOptions: JSON.parse(JSON.stringify(oConfig.createStatusOptions)),
      editStatusOptions: JSON.parse(JSON.stringify(oConfig.editStatusOptions)),
      categoryOptions: JSON.parse(JSON.stringify(oConfig.categoryOptions)),
      createCategoryDefaultKey: oConfig.createCategoryDefaultKey,
      ui: JSON.parse(JSON.stringify(oConfig.ui))
    };
  }

  function resolve(oStartupParameters) {
    var sCategory = resolveCategory(oStartupParameters && oStartupParameters[STARTUP_PARAMETER]);
    return {
      category: sCategory,
      titleKey: ORDER_CATEGORIES[sCategory].titleKey,
      orderTypes: getCategoryOrderTypes(sCategory).map(resolveOrderType)
    };
  }

  function uiFlag(oUi, sKind, sId, sFlag, bDefault) {
    var oEntry = oUi && oUi[sKind] && oUi[sKind][sId];
    var vValue = oEntry && oEntry[sFlag];
    if (typeof vValue === "boolean") {
      return vValue;
    }
    return bDefault !== false;
  }

  // Sections Catalog PR1 — the two facts that used to live as flat booleans
  // on each SectionConfig.js entry (`expanded`, `createVisible`) are GLOBAL
  // (same for every order type), so they live here once rather than being
  // repeated inside every ORDER_TYPES entry's `ui.sections`. Per-type/per-
  // section differences (visible/locked/editable) still come from each
  // type's own `ui.sections` map above.
  var SECTION_BASELINE_EXPANDED = { details: true, items: true };
  // Migrated from SectionConfig.js `createVisible` (the sections that used to
  // auto-expand+load eagerly on createMode entry); unlike the old mechanism,
  // a section's create-mode visibility is still governed solely by its
  // per-type `visible`/`locked` state — this list only controls whether an
  // ALREADY-visible section starts expanded. `partiesInvolved` is deliberately
  // absent (CreatePartner needs a persisted context, see SectionCatalog.js
  // `createCapable`).
  var SECTION_CREATE_EXPANDED = { inventory: true, shipping: true, orgData: true, priceTotals: true, attachments: true };

  // Single resolver for the Detail panel stack (Sections Catalog PR1):
  // merges SectionCatalog.all() (structure) with the order type's `ui.sections`
  // (per-type visible/locked/editable) and the mode-global expand state above.
  // Returns an ordered array (catalog order; PR1 introduces no reordering)
  // of `{ id, visible, editable, expanded, locked }`. `sMode` is
  // "create"|"edit"|"display" (Detail.controller.js#_currentSectionMode) —
  // "edit" and "display" resolve identically UNLESS a section's per-type
  // entry declares a `byMode` override (escape hatch for a mode-only
  // difference, e.g. `{ byMode: { edit: { editable: false } } }` to hide a
  // section's Edit button only while another section has an active edit
  // session — on top of, not instead of, the existing per-button
  // `editEnabled` serialization in onSectionEditPress/_endEditSession).
  function resolveSections(vOrderType, sMode) {
    var oConfig = ORDER_TYPES[normalizeOrderType(vOrderType)];
    var oPerType = (oConfig.ui && oConfig.ui.sections) || {};
    return SectionCatalog.all().map(function (oCatalogEntry) {
      var oOverride = oPerType[oCatalogEntry.id] || {};
      var oModeOverride = (oOverride.byMode && oOverride.byMode[sMode]) || {};
      var bExpanded = !!SECTION_BASELINE_EXPANDED[oCatalogEntry.id];
      if (sMode === "create" && SECTION_CREATE_EXPANDED[oCatalogEntry.id]) {
        bExpanded = true;
      }
      return {
        id: oCatalogEntry.id,
        visible: (oModeOverride.visible !== undefined ? oModeOverride.visible : oOverride.visible) !== false,
        editable: (oModeOverride.editable !== undefined ? oModeOverride.editable : oOverride.editable) !== false,
        locked: !!oOverride.locked,
        expanded: bExpanded
      };
    });
  }

  // Item Details view (ItemDetail route) sections have no per-order-type config
  // like the header `ui.sections` above - ADR-002's service profile
  // (ServiceSchema.profileId: "orders"/"returns") is 1:1 with order category
  // for the whole running app instance, so this is keyed by profileId instead
  // of duplicating per order type. ret-10-28 follow-up: only itemDetails is
  // visible for the returns profile for now (ItemSectionConfig.js ids) - the
  // other 4 item sections render fine but have no returns-specific backing
  // data/design yet.
  var ITEM_UI_HIDDEN_BY_PROFILE = {
    returns: {
      sections: {
        itemShipping: { visible: false },
        itemShippingTransactions: { visible: false },
        itemPrices: { visible: false },
        itemTransactionHistory: { visible: false }
      }
    }
  };

  function getItemUi(sProfileId) {
    return JSON.parse(JSON.stringify(ITEM_UI_HIDDEN_BY_PROFILE[sProfileId] || { sections: {} }));
  }

  return {
    startupParameter: STARTUP_PARAMETER,
    defaultCategory: DEFAULT_CATEGORY,
    defaultOrderType: DEFAULT_ORDER_TYPE,
    supportedOrderTypes: Object.keys(ORDER_TYPES),
    normalizeOrderType: normalizeOrderType,
    resolveCategory: resolveCategory,
    getCategoryOrderTypes: getCategoryOrderTypes,
    resolveOrderType: resolveOrderType,
    resolve: resolve,
    uiFlag: uiFlag,
    resolveSections: resolveSections,
    getItemUi: getItemUi
  };
});