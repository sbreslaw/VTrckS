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
  var ZREP_CATEGORY_OPTIONS = [
    { key: "06", text: "E-Mail" },
    { key: "03", text: "Fax" },
    { key: "05", text: "Internet Service" },
    { key: "01", text: "Telephone call" }
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
  // Ids currently configured: fields detailsExisId, detailsCreatedAt;
  // fieldGroups detailsValue; sections inventory. Sections and columns are
  // wired generically for every id; for fields/fieldGroups add the XML binding
  // when you add the config entry.
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
    ZKB: baselineType("ZKB", "orderTypeZkb"),
    ZREP: {
      orderType: "ZREP",
      titleKey: "orderTypeZrep",
      defaults: {},
      createStatusDefault: "2A",
      createStatusOptions: ZREP_STATUS_OPTIONS,
      editStatusOptions: ZREP_STATUS_OPTIONS,
      categoryOptions: ZREP_CATEGORY_OPTIONS,
      createCategoryDefaultKey: "05",
      ui: {
        fields: {
          detailsExisId: { visible: false },
          detailsCreatedAt: { visible: false }
        },
        fieldGroups: {
          detailsValue: { visible: false }
        },
        columns: {},
        sections: {
          inventory: { visible: false }
        }
      }
    },
    // Returns (_RET): UI differences TBD by functional, add here.
    ZISL: baselineType("ZISL", "orderTypeZisl"),
    ZCFR: baselineType("ZCFR", "orderTypeZcfr"),
    ZWST: baselineType("ZWST", "orderTypeZwst"),
    ZKR: baselineType("ZKR", "orderTypeZkr")
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