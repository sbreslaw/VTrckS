sap.ui.define([], function () {
  "use strict";

  var STARTUP_PARAMETER = "providerOrderType";
  var DEFAULT_ORDER_TYPE = "ZKB";
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
  var ORDER_TYPES = {
    ZKB: {
      orderType: "ZKB",
      defaults: {},
      createStatusDefault: "",
      createStatusOptions: [],
      editStatusOptions: [],
      categoryOptions: [],
      createCategoryDefaultKey: "",
      ui: { fields: {}, fieldGroups: {}, columns: {}, sections: {} }
    },
    ZREP: {
      orderType: "ZREP",
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
    }
  };

  function normalizeOrderType(vOrderType) {
    var sOrderType = Array.isArray(vOrderType) ? vOrderType[0] : vOrderType;
    sOrderType = typeof sOrderType === "string" ? sOrderType.trim().toUpperCase() : "";
    return Object.prototype.hasOwnProperty.call(ORDER_TYPES, sOrderType) ? sOrderType : DEFAULT_ORDER_TYPE;
  }

  function resolveOrderType(vOrderType) {
    var sOrderType = normalizeOrderType(vOrderType);
    var oConfig = ORDER_TYPES[sOrderType];
    return {
      providerOrderType: sOrderType,
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
    return resolveOrderType(oStartupParameters && oStartupParameters[STARTUP_PARAMETER]);
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
    defaultOrderType: DEFAULT_ORDER_TYPE,
    supportedOrderTypes: Object.keys(ORDER_TYPES),
    normalizeOrderType: normalizeOrderType,
    resolveOrderType: resolveOrderType,
    resolve: resolve,
    uiFlag: uiFlag
  };
});