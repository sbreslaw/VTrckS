sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessagePopover",
  "sap/m/MessageItem",
  "sap/ui/core/Messaging",
  "sap/ui/model/json/JSONModel",
  "cdc/vaccreq/sections/SectionFactory",
  "cdc/vaccreq/sections/ItemSectionConfig",
  "cdc/vaccreq/model/formatter",
  "cdc/vaccreq/model/ServiceSchema"
], function (Controller, MessagePopover, MessageItem, Messaging, JSONModel, SectionFactory, ItemSectionConfig, formatter, ServiceSchema) {
  "use strict";

  // Item Details view (FCL end column) - Session Prompt "Item Details View".
  // Same panel-stack idiom as Detail.controller.js/SectionFactory.js, driven
  // by its own ItemSectionConfig.js + "itemSectionFlags" model (the factory
  // was parameterized, not mirrored, per that session prompt's Step-0
  // instruction - see SectionFactory.js).
  return Controller.extend("cdc.vaccreq.controller.ItemDetail", {
    formatter: formatter,

    onInit: function () {
      this._oRouter = this.getOwnerComponent().getRouter();
      this._oRouter.getRoute("itemDetail").attachPatternMatched(this._onObjectMatched, this);
      this._aSectionMeta = ItemSectionConfig;
      this._oSectionFactory = new SectionFactory(this.getView(), this._aSectionMeta, null, "itemSectionFlags");
      this.getView().setModel(this._createSectionFlagsModel(), "itemSectionFlags");
      this.getView().setModel(this._createSectionsNavModel(), "itemSectionsNav");
      this.getView().setModel(Messaging.getMessageModel(), "message");
    },

    onAfterRendering: function () {
      this._oSectionFactory.ensurePanels();
    },

    onExpandPanel: function (oEvent) {
      this._oSectionFactory.ensurePanelContent(oEvent.getSource());
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

    onBackPress: function () {
      // Always full screen regardless of what it was before the drill-down
      // (session prompt 3.1) - the "detail" route already always applies
      // layout MidColumnFullScreen on match (manifest.json), so a plain
      // re-navTo is sufficient; no "previous layout" to restore/store here.
      this._oRouter.navTo("detail", { orderId: encodeURIComponent(this._sOrderId || "") });
    },

    onMessagePopoverPress: function (oEvent) {
      if (!this._oMessagePopover) {
        this._oMessagePopover = new MessagePopover({
          groupItems: true,
          items: {
            path: "message>/",
            template: new MessageItem({
              type: "{message>type}",
              title: "{message>message}",
              subtitle: "{message>additionalText}",
              description: "{message>description}"
            })
          }
        });
        this.getView().addDependent(this._oMessagePopover);
      }
      this._oMessagePopover.toggle(oEvent.getSource());
    },

    _createSectionFlagsModel: function () {
      var oData = {};
      this._aSectionMeta.forEach(function (oMeta) {
        if (oMeta.editable) {
          oData[oMeta.id] = { editVisible: true, editEnabled: !!oMeta.editLive };
        }
      });
      return new JSONModel(oData);
    },

    _createSectionsNavModel: function () {
      var oBundle = this.getResourceBundle();
      var aList = this._aSectionMeta.map(function (oMeta) {
        return { id: oMeta.id, title: oBundle.getText(oMeta.titleKey) };
      });
      return new JSONModel({ list: aList });
    },

    // View models aren't propagated yet when a lazily-instantiated FCL target
    // view's onInit fires - go straight to the owner component's model
    // (same fix already established in Detail.controller.js).
    getResourceBundle: function () {
      return this.getOwnerComponent().getModel("i18n").getResourceBundle();
    },

    _onObjectMatched: function (oEvent) {
      var oArgs = oEvent.getParameter("arguments") || {};
      var sOrderId = decodeURIComponent(oArgs.orderId || "");
      var sItemNumber = decodeURIComponent(oArgs.itemPath || "");
      if (!sOrderId || !sItemNumber) {
        return;
      }
      this._sOrderId = sOrderId;
      this._sItemNumber = sItemNumber;

      var oView = this.getView();
      oView.setBusy(true);
      oView.unbindElement();
      oView.bindElement({
        path: ServiceSchema.buildItemPath(sOrderId, sItemNumber),
        // $select including SAP__Messages (session prompt 3.1) - same
        // explicit-not-inherited pattern already used for the header/items
        // bindings (Detail.controller.js), confirmed present on
        // SalesOrderItemType too (so.xml Step-0).
        parameters: { $select: "SAP__Messages" },
        events: {
          dataReceived: this._onDataReceived.bind(this)
        }
      });
      this._bindItemHeader();
      this._oSectionFactory.rebind();
    },

    _onDataReceived: function (oEvent) {
      this.getView().setBusy(false);
      var oError = oEvent.getParameter("error");
      if (oError) {
        // Not-found target for stale/direct links (session prompt 3.1).
        this._oRouter.getTargets().display("itemNotFound");
      }
    },

    _bindItemHeader: function () {
      var oView = this.getView();

      oView.byId("itemDetailTitle").bindProperty("text", {
        parts: [
          { path: "Product" },
          { path: "_Product/Product_Text" }
        ],
        formatter: formatter.itemDetailTitle.bind(formatter)
      });

      [oView.byId("itemDetailSubtitle"), oView.byId("itemDetailSubtitleExpanded")].forEach(function (oControl) {
        oControl.bindProperty("text", {
          parts: [
            { path: "SalesOrder" },
            { path: "SalesOrderItem" },
            { path: "i18n>detailTitlePrefix" },
            { path: "i18n>itemDetailItemPrefix" }
          ],
          formatter: formatter.itemDetailSubtitle.bind(formatter)
        });
      });

      oView.byId("itemDetailStatus").bindProperty("text", {
        path: "_SDProcessStatus/SDProcessStatus_Text",
        formatter: formatter.orDash
      });
    }
  });
});
