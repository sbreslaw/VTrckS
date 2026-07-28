sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter",
  "cdc/vaccreq/model/formatter"
], function (Controller, Filter, FilterOperator, Sorter, formatter) {
  "use strict";

  return Controller.extend("cdc.vaccreq.controller.Master", {
    formatter: formatter,

    onInit: function () {
      this._oRouter = this.getOwnerComponent().getRouter();
      this._oViewModel = this.getView().getModel("view");
      this._oRouter.getRoute("master").attachPatternMatched(this._onRouteMatched, this);
    },

    onBeforeTableBind: function (oEvent) {
      var oBinding = oEvent.getSource().getBinding("items");
      if (oBinding) {
        oBinding.sort(new Sorter("CreatedOn", true));
      }
    },

    onSearch: function () {
      var aFilters = [];
      var oView = this.getView();

      this._pushIfValue(aFilters, "VaccineRequestID", oView.byId("filterRequestId").getValue(), FilterOperator.Contains);
      this._pushIfValue(aFilters, "ProviderID", oView.byId("filterProviderId").getValue(), FilterOperator.Contains);
      this._pushIfValue(aFilters, "ProviderName", oView.byId("filterProviderName").getValue(), FilterOperator.Contains);
      this._pushIfValue(aFilters, "NDC", oView.byId("filterNdc").getValue(), FilterOperator.Contains);
      this._pushIfValue(aFilters, "CreatedBy", oView.byId("filterCreatedBy").getValue(), FilterOperator.Contains);
      this._pushIfValue(aFilters, "Jurisdiction", oView.byId("filterJurisdiction").getValue(), FilterOperator.Contains);

      var aStatusKeys = oView.byId("filterStatus").getSelectedKeys();
      if (aStatusKeys.length) {
        var aStatusFilters = aStatusKeys.map(function (sKey) {
          return new Filter("UserStatus", FilterOperator.EQ, sKey);
        });
        aFilters.push(new Filter({
          filters: aStatusFilters,
          and: false
        }));
      }

      var oDateRange = oView.byId("filterCreatedOn");
      var oDateFrom = oDateRange.getDateValue();
      var oDateTo = oDateRange.getSecondDateValue();
      if (oDateFrom && oDateTo) {
        aFilters.push(new Filter("CreatedOn", FilterOperator.BT, oDateFrom, oDateTo));
      }

      var oTable = this.byId("requestsTable");
      var oBinding = oTable.getBinding("items");
      if (oBinding) {
        oBinding.filter(aFilters);
      }

      this._oViewModel.setProperty("/masterHasSearch", aFilters.length > 0);
    },

    onRowPress: function (oEvent) {
      var oCtx = oEvent.getSource().getBindingContext();
      if (!oCtx) {
        return;
      }
      var sId = oCtx.getProperty("VaccineRequestID");
      this._oRouter.navTo("detail", {
        vaccineRequestId: encodeURIComponent(sId)
      });
    },

    onUpdateFinished: function (oEvent) {
      this._oViewModel.setProperty("/masterCount", oEvent.getParameter("total"));
    },

    _onRouteMatched: function () {
      this._oViewModel.setProperty("/masterBusy", false);
    },

    _pushIfValue: function (aFilters, sPath, sValue, sOperator) {
      if (sValue) {
        aFilters.push(new Filter(sPath, sOperator, sValue));
      }
    }
  });
});
