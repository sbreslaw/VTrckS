sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter",
  "sap/ui/core/Item",
  "sap/m/ColumnListItem",
  "sap/m/Text",
  "sap/m/ObjectStatus",
  "sap/m/ObjectNumber",
  "cdc/vaccreq/model/formatter",
  "cdc/vaccreq/model/ServiceSchema"
], function (Controller, Filter, FilterOperator, Sorter, Item, ColumnListItem, Text, ObjectStatus, ObjectNumber, formatter, ServiceSchema) {
  "use strict";

  return Controller.extend("cdc.vaccreq.controller.Master", {
    formatter: formatter,

    onInit: function () {
      this._oRouter = this.getOwnerComponent().getRouter();
      this._oViewModel = this.getView().getModel("view");
      this._applyFilterAvailability();
      this._populateStatusCodes();
      this._bindMasterItems();
      this._oRouter.getRoute("master").attachPatternMatched(this._onRouteMatched, this);
    },

    onSearch: function () {
      var aFilters = [];
      var oView = this.getView();

      this._pushIfValue(aFilters, ServiceSchema.keys.orderId, oView.byId("filterRequestId").getValue(), FilterOperator.Contains);
      this._pushIfValue(aFilters, ServiceSchema.headerProperties.providerId, oView.byId("filterProviderId").getValue(), FilterOperator.Contains);
      this._pushIfValue(aFilters, ServiceSchema.headerProperties.providerName, oView.byId("filterProviderName").getValue(), FilterOperator.Contains);
      this._pushIfValue(aFilters, ServiceSchema.headerProperties.createdBy, oView.byId("filterCreatedBy").getValue(), FilterOperator.Contains);

      if (ServiceSchema.showJurisdictionFilter) {
        this._pushIfValue(aFilters, ServiceSchema.headerProperties.salesOffice, oView.byId("filterJurisdiction").getValue(), FilterOperator.Contains);
      }

      var aStatusKeys = oView.byId("filterStatus").getSelectedKeys();
      if (aStatusKeys.length) {
        var aStatusFilters = aStatusKeys.map(function (sKey) {
          return new Filter(ServiceSchema.headerProperties.status, FilterOperator.EQ, sKey);
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
        aFilters.push(new Filter(ServiceSchema.headerProperties.createdOn, FilterOperator.BT, oDateFrom, oDateTo));
      }

      aFilters = this._getFixedFilters().concat(aFilters);

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
      var sId = oCtx.getProperty(ServiceSchema.keys.orderId);
      var bIsActive = oCtx.getProperty(ServiceSchema.keys.isActive);
      this._oRouter.navTo("detail", {
        orderId: encodeURIComponent(sId),
        isActiveEntity: bIsActive !== false ? "true" : "false"
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
    },

    _applyFilterAvailability: function () {
      this.byId("filterNdc").setEnabled(false);
      this.byId("filterNdc").setTooltip(this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("availableWithE008Service"));

      if (!ServiceSchema.showJurisdictionFilter) {
        this.byId("filterJurisdiction").setEnabled(false);
        this.byId("filterJurisdiction").setTooltip(this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("availableWithE008Service"));
      }
    },

    _populateStatusCodes: function () {
      var oStatus = this.byId("filterStatus");
      oStatus.removeAllItems();
      ServiceSchema.masterStatusCodes.forEach(function (sCode) {
        oStatus.addItem(new Item({ key: sCode, text: sCode }));
      });
    },

    _getFixedFilters: function () {
      var aTypeFilters = ServiceSchema.fixedOrderTypes.map(function (sType) {
        return new Filter(ServiceSchema.headerProperties.salesOrderType, FilterOperator.EQ, sType);
      });

      var aFixed = [
        new Filter(ServiceSchema.keys.isActive, FilterOperator.EQ, true)
      ];

      if (aTypeFilters.length) {
        aFixed.push(new Filter({ filters: aTypeFilters, and: false }));
      }

      return aFixed;
    },

    _bindMasterItems: function () {
      var oTable = this.byId("requestsTable");
      var oTemplate = new ColumnListItem({
        type: "Navigation",
        press: this.onRowPress.bind(this),
        cells: [
          new Text({ text: { path: ".", formatter: formatter.masterRequestId } }),
          new Text({ text: { path: ".", formatter: formatter.masterProvider } }),
          new ObjectStatus({
            text: { path: ".", formatter: formatter.masterStatusText.bind(formatter) },
            state: { path: ".", formatter: formatter.masterStatusState.bind(formatter) }
          }),
          new Text({ text: { path: ".", formatter: formatter.masterCreatedOn } }),
          new Text({ text: { path: ".", formatter: formatter.masterCreatedBy } }),
          new ObjectNumber({
            number: { path: ".", formatter: formatter.masterNetValue },
            unit: { path: ".", formatter: formatter.masterCurrency }
          })
        ]
      });

      oTable.bindItems({
        path: "/" + ServiceSchema.entitySets.header,
        template: oTemplate,
        sorter: [new Sorter(ServiceSchema.headerProperties.createdOn, true)]
      });
    }
  });
});
