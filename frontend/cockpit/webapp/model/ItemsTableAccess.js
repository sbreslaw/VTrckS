// Items table access for both table types (VTrckS#69): Provider Orders keeps an
// sap.m.Table (aggregation "items"), Customer Returns uses an sap.ui.table.Table
// (aggregation "rows", virtual rows). Decided by control type, never by profile
// (ADR-002 decision 3). No OData names here: SORT_PROPERTY_KEYS maps Items layout
// column keys (OrderModeConfig.getItemsColumnLayout) to ServiceSchema.itemProperties keys.
sap.ui.define([], function () {
  "use strict";

  function isGrid(oTable) {
    return !!oTable && oTable.isA("sap.ui.table.Table");
  }

  function aggregation(oTable) {
    return isGrid(oTable) ? "rows" : "items";
  }

  return {
    SORT_PROPERTY_KEYS: {
      itemNumber: "itemNumber",
      ndcCode: "material",
      lotNumber: "batch",
      expirationDate: "expirationDate",
      qty: "quantity",
      uom: "unit",
      ndcDescription: "itemText",
      itemStatus: "itemStatus",
      rejectionReason: "rejectionReason",
      returnReason: "returnReason",
      itemCategory: "itemCategory",
      exisId: "exisId"
    },

    isGrid: isGrid,

    getBinding: function (oTable) {
      return oTable ? oTable.getBinding(aggregation(oTable)) : undefined;
    },

    getBindingInfo: function (oTable) {
      return oTable ? oTable.getBindingInfo(aggregation(oTable)) : undefined;
    },

    bind: function (oTable, oBindingInfo) {
      return isGrid(oTable) ? oTable.bindRows(oBindingInfo) : oTable.bindItems(oBindingInfo);
    },

    // Rendered row controls only (a grid renders just its visible rows).
    getRowControls: function (oTable) {
      if (!oTable) {
        return [];
      }
      return isGrid(oTable) ? oTable.getRows() : oTable.getItems();
    },

    // Every loaded context in view order - not just the window a control last
    // requested (getCurrentContexts), which on a grid is the visible rows only.
    getContexts: function (oBinding) {
      if (!oBinding || !oBinding.getAllCurrentContexts) {
        return [];
      }
      return oBinding.getAllCurrentContexts()
        .filter(function (oContext) { return oContext.getIndex() !== undefined; })
        .sort(function (oA, oB) { return oA.getIndex() - oB.getIndex(); });
    }
  };
});
