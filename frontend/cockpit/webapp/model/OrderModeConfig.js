sap.ui.define([
  "sap/base/Log"
], function (Log) {
  "use strict";

  // Carries an order CATEGORY (CR-1014-001 §0); legacy FLP mappings may still pass an order type.
  var STARTUP_PARAMETER = "providerOrderType";
  var DEFAULT_CATEGORY = "_ORD";

  // The existing views are the shared baseline; add only confirmed per-type
  // differences here. `ui` is the single UI-config source, exposed to the
  // Detail view as the `orderUi` model (Detail.controller.js#_applyOrderUi):
  //   kinds  - fields, fieldGroups (Details.fragment.xml), columns (Items
  //            table, ITEMS_COLUMN_KEYS), sections (SectionConfig.js ids)
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
      deliveryStatus: { visible: false }
      // exisId column UN-HIDDEN (2026-10-27 metadata re-audit): ExisItemNumber
      // IS real on CustomerReturnItemManageType - the prior "5th literal-binding
      // hazard" hide was based on the OLDER 2026-10-26 metadata, which omitted
      // it. Items.fragment.xml's exisId Input is bound to it directly again.
    },
    sections: {
      inventory: { visible: false },
      shipping: { visible: false },
      shippingTransactions: { visible: false },
      transactionHistory: { visible: false },
      orgData: { visible: false },
      priceTotals: { visible: false },
      paymentMethod: { visible: false },
      scheduledActions: { visible: false },
      status: { visible: false },
      dates: { visible: false },
      partiesInvolved: { visible: false },
      attachments: { visible: false }
    }
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
      detailsLabelAddress: { visible: false },
      // Live-test (exceptions.txt 2026-10-27): _SoldToPartyContactInfo/
      // ResponsibleEmployee confirmed absent (ReturnsSchema.js navigation.
      // headerToContactInfo: null) - no Employee Responsible display value
      // exists for Returns at all.
      employeeResponsible: { visible: false }
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
    sections: Object.assign({}, PROVIDER_ORDER_UI_HIDDEN.sections)
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
        fields: Object.assign({}, RETURNS_UI_HIDDEN.fields),
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
        fields: Object.assign({}, RETURNS_UI_HIDDEN.fields),
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
        fields: Object.assign({}, RETURNS_UI_HIDDEN.fields),
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
    uiFlag: uiFlag
  };
});