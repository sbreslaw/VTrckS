sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "cdc/vaccreq/sections/SectionFactory",
  "cdc/vaccreq/model/formatter",
  "cdc/vaccreq/model/ServiceSchema"
], function (Controller, MessageToast, SectionFactory, formatter, ServiceSchema) {
  "use strict";

  return Controller.extend("cdc.vaccreq.controller.Detail", {
    formatter: formatter,

    onInit: function () {
      this._oRouter = this.getOwnerComponent().getRouter();
      this._oRouter.getRoute("detail").attachPatternMatched(this._onObjectMatched, this);
      this._aSectionMeta = [
        { id: "details", titleKey: "sectionDetails", fragment: "cdc.vaccreq.sections.Details", expanded: true },
        { id: "items", titleKey: "sectionItems", fragment: "cdc.vaccreq.sections.Items", expanded: false },
        { id: "inventory", titleKey: "sectionInventory", fragment: "cdc.vaccreq.sections.Inventory", expanded: false },
        { id: "shipping", titleKey: "sectionShipping", fragment: "cdc.vaccreq.sections.Shipping", expanded: false },
        { id: "shippingTransactions", titleKey: "sectionShippingTransactions", fragment: "cdc.vaccreq.sections.ShippingTransactions", expanded: false },
        { id: "transactionHistory", titleKey: "sectionTransactionHistory", fragment: "cdc.vaccreq.sections.TransactionHistory", expanded: false },
        { id: "orgData", titleKey: "sectionOrgData", fragment: "cdc.vaccreq.sections.OrgData", expanded: false }
      ];
      this._oSectionFactory = new SectionFactory(this.getView(), this._aSectionMeta);
    },

    onAfterRendering: function () {
      this._oSectionFactory.ensurePanels();
    },

    onExpandPanel: function (oEvent) {
      var oPanel = oEvent.getSource();
      this._oSectionFactory.ensurePanelContent(oPanel);
    },

    onAnchorPress: function (oEvent) {
      var sPanelId = oEvent.getSource().data("panelId");
      var oPanel = this.byId(sPanelId);
      if (oPanel) {
        oPanel.setExpanded(true);
        this._oSectionFactory.ensurePanelContent(oPanel);
        oPanel.getDomRef().scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },

    onCloseColumn: function () {
      this._oRouter.navTo("master", {}, true);
    },

    _onObjectMatched: function (oEvent) {
      var oArgs = oEvent.getParameter("arguments") || {};
      var sId = decodeURIComponent(oArgs.orderId || "");
      if (!sId) {
        return;
      }
      this.getView().bindElement({
        path: ServiceSchema.buildHeaderPath(sId)
      });
      this._bindDetailHeader();
      this._oSectionFactory.rebind();
    },

    _bindDetailHeader: function () {
      var oView = this.getView();

      oView.byId("detailTitle").bindProperty("text", {
        parts: [
          { path: ServiceSchema.keys.orderId },
          { path: "i18n>detailTitlePrefix" },
          { path: "i18n>detailTitle" }
        ],
        formatter: formatter.detailTitle
      });

      oView.byId("detailStatus")
        .bindProperty("text", {
          path: ServiceSchema.headerProperties.status,
          formatter: formatter.detailStatusText.bind(formatter)
        })
        .bindProperty("state", {
          path: ServiceSchema.headerProperties.status,
          formatter: formatter.detailStatusState.bind(formatter)
        });

      oView.byId("detailCreatedOnBy").bindProperty("text", {
        parts: [
          { path: ServiceSchema.headerProperties.createdOn },
          { path: ServiceSchema.headerProperties.createdBy },
          { path: "i18n>createdOnBy" }
        ],
        formatter: formatter.detailCreatedOnBy
      });

      oView.byId("detailNetValue")
        .bindProperty("number", {
          path: ServiceSchema.headerProperties.netValue,
          formatter: formatter.detailNetValue
        })
        .bindProperty("unit", {
          path: ServiceSchema.headerProperties.currency,
          formatter: formatter.detailCurrency
        });
    },

    onMvp2Action: function () {
      MessageToast.show(this.getResourceBundle().getText("mvp2Only"));
    },

    getResourceBundle: function () {
      return this.getOwnerComponent().getModel("i18n").getResourceBundle();
    }
  });
});
