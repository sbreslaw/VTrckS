sap.ui.define([
  "sap/base/Log"
], function (Log) {
  "use strict";

  // Carries an order CATEGORY (CR-1014-001 §0); legacy FLP mappings may still pass an order type.
  var STARTUP_PARAMETER = "providerOrderType";
  var DEFAULT_CATEGORY = "_ORD";
  var ZREP_STATUS_OPTIONS = [
    { key: "2A", i18nKey: "enumStatus2A" },
    { key: "2B", i18nKey: "enumStatus2B" },
    { key: "2C", i18nKey: "enumStatus2C" }
  ];

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
  // visible for _RET order types only (ZISL/ZCFR/ZWST/ZKR, the default -
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
      poReference: { visible: false }
    },
    sections: {
      inventory: { visible: false },
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
    // Returns (_RET): UI differences TBD by functional, add here.
    ZISL: {
      orderType: "ZISL",
      titleKey: "orderTypeZisl",
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
          detailsNoOfBoxes: { visible: false },
          detailsShippingCondition: { visible: false },
          detailsLabelAddress: { visible: false }
        }, PROVIDER_ORDER_UI_HIDDEN.fields),
        fieldGroups: {
          detailsValue: { visible: false }
        },
        columns: Object.assign({}, PROVIDER_ORDER_UI_HIDDEN.columns),
        sections: Object.assign({}, PROVIDER_ORDER_UI_HIDDEN.sections)
      }
    },
    ZCFR: {
      orderType: "ZCFR",
      titleKey: "orderTypeZcfr",
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
          detailsNoOfBoxes: { visible: false },
          detailsShippingCondition: { visible: false },
          detailsLabelAddress: { visible: false },
          detailsExisDate: { visible: false },
          detailsReturnType: { visible: false }
        }, PROVIDER_ORDER_UI_HIDDEN.fields),
        fieldGroups: {
          detailsValue: { visible: false }
        },
        columns: Object.assign({}, PROVIDER_ORDER_UI_HIDDEN.columns),
        sections: Object.assign({}, PROVIDER_ORDER_UI_HIDDEN.sections)
      }
    },
    ZWST: {
      orderType: "ZWST",
      titleKey: "orderTypeZwst",
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
          detailsNoOfBoxes: { visible: false },
          detailsShippingCondition: { visible: false },
          detailsLabelAddress: { visible: false },
          detailsReturnType: { visible: false }
        }, PROVIDER_ORDER_UI_HIDDEN.fields),
        fieldGroups: {
          detailsValue: { visible: false }
        },
        columns: Object.assign({}, PROVIDER_ORDER_UI_HIDDEN.columns),
        sections: Object.assign({}, PROVIDER_ORDER_UI_HIDDEN.sections)
      }
    },
    ZKR: {
      orderType: "ZKR",
      titleKey: "orderTypeZkr",
      defaults: {},
      createStatusDefault: "2A",
      // createStatusOptions: ZREP_STATUS_OPTIONS,
      // editStatusOptions: ZREP_STATUS_OPTIONS,
      createStatusOptions: [],
      editStatusOptions: [],
      categoryOptions: [],
      createCategoryDefaultKey: "",
      ui: {
        fields: Object.assign({}, PROVIDER_ORDER_UI_HIDDEN.fields),
        fieldGroups: {
          detailsValue: { visible: false }
        },
        columns: Object.assign({}, PROVIDER_ORDER_UI_HIDDEN.columns),
        sections: Object.assign({}, PROVIDER_ORDER_UI_HIDDEN.sections)
      }
    }
  };

  // Category scopes Master search and Create; an order still displays per its own type.
  var ORDER_CATEGORIES = {
    _ORD: { titleKey: "orderCategoryOrd", orderTypes: ["ZKB", "ZREP"] },
    _RET: { titleKey: "orderCategoryRet", orderTypes: ["ZISL", "ZCFR", "ZWST", "ZKR"] }
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