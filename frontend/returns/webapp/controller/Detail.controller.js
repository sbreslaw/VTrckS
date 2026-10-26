// Architecture adapted from frontend/cockpit/webapp/controller/Detail.controller.js
// @ VTrckS — same FCL mid-column DynamicPage + anchor-bar + SectionFactory
// panel-stack pattern, trimmed to this app's read-only MVP-1 scope (prompt §1):
//  - no create/edit route, no EditRequestService/CreateOrderService, no
//    per-section edit sessions (SectionConfig.js: every section editable:false)
//  - no Items paste/ancillary/fund-split/value-help-table-fitter machinery
//  - bindElement has NO $$updateGroupId (no PATCH ever issued from this view)
//  - _applyReturnUi (this app's equivalent of the cockpit's _applyOrderUi)
//    only toggles section visibility via ReturnTypeConfig.resolveType(); all
//    four return types currently share one empty `ui` baseline (no observed
//    per-type differences yet - see ReturnTypeConfig.js)
sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/Messaging",
  "sap/ui/core/Fragment",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessagePopover",
  "sap/m/MessageItem",
  "sap/m/ColumnListItem",
  "sap/m/Text",
  "sap/m/CheckBox",
  "cdc/vaccret/sections/SectionFactory",
  "cdc/vaccret/sections/SectionConfig",
  "cdc/vaccret/model/formatter",
  "cdc/vaccret/model/ServiceSchema",
  "cdc/vaccret/model/ReturnTypeConfig",
  "cdc/vaccret/util/MessageExtractor"
], function (
  Controller, Messaging, Fragment, JSONModel, MessagePopover, MessageItem, ColumnListItem, Text, CheckBox,
  SectionFactory, SectionConfig, formatter, ServiceSchema, ReturnTypeConfig, MessageExtractor
) {
  "use strict";

  return Controller.extend("cdc.vaccret.controller.Detail", {
    formatter: formatter,

    onInit: function () {
      this._oRouter = this.getOwnerComponent().getRouter();
      this._oRouter.getRoute("detail").attachPatternMatched(this._onObjectMatched, this);
      this._aSectionMeta = SectionConfig;
      // 4th/5th args left at their defaults ("sectionFlags"/"sectionsContainer")
      // — no SectionConfig.js entry here is editable, so sectionFlags is never
      // actually bound to by SectionFactory, but the ctor still expects the
      // positional slot. 6th arg "returnUi" drives each panel's visibility
      // (ReturnTypeConfig.js's `ui.sections.<id>.visible`).
      this._oSectionFactory = new SectionFactory(this.getView(), this._aSectionMeta, this._onSectionContentLoaded.bind(this), undefined, undefined, "returnUi");
      this.getView().setModel(this._createSectionsNavModel(), "sectionsNav");
      this.getView().setModel(new JSONModel({}), "returnUi");
      this.getView().setModel(Messaging.getMessageModel(), "message");
    },

    onAfterRendering: function () {
      this._oSectionFactory.ensurePanels();
      var oAnchorBar = this.byId("detailAnchorBar");
      var aAnchors = oAnchorBar ? oAnchorBar.getItems() : [];
      if (!aAnchors.some(function (oAnchor) { return oAnchor.hasStyleClass("detailAnchorLinkActive"); })) {
        var oFirstVisibleAnchor = aAnchors.filter(function (oAnchor) { return oAnchor.getVisible(); })[0];
        if (oFirstVisibleAnchor) {
          oFirstVisibleAnchor.addStyleClass("detailAnchorLinkActive");
        }
      }
    },

    _createSectionsNavModel: function () {
      var oBundle = this.getResourceBundle();
      var aList = this._aSectionMeta.map(function (oMeta) {
        return { id: oMeta.id, title: oBundle.getText(oMeta.titleKey), visible: true };
      });
      return new JSONModel({ list: aList });
    },

    _onObjectMatched: function (oEvent) {
      var oArgs = oEvent.getParameter("arguments") || {};
      var sReturnId = decodeURIComponent(oArgs.returnId || "");
      if (!sReturnId) {
        return;
      }
      Messaging.removeAllMessages();
      this.getView().unbindElement();
      this.getView().bindElement({
        path: ServiceSchema.buildHeaderPath(sReturnId),
        events: {
          dataReceived: this._onHeaderDataReceived.bind(this)
        }
      });
      this._bindDetailHeader();
      this._oSectionFactory.rebind();
    },

    _onHeaderDataReceived: function (oEvent) {
      var oError = oEvent.getParameter("error");
      var oContext = this.getView().getBindingContext();
      if (oError) {
        MessageExtractor.extract(oError, oContext && oContext.getPath(), this.getResourceBundle());
        this._applyReturnUi(undefined);
        return;
      }
      this._applyReturnUi(oContext && oContext.getProperty(ServiceSchema.headerProperties.returnType));
    },

    // This app's equivalent of the cockpit's _applyOrderUi: only toggles
    // section visibility today (ReturnTypeConfig.js: every type's `ui` is
    // still an empty baseline — add per-type differences there as they are
    // confirmed by functional, not here).
    _applyReturnUi: function (sReturnType) {
      var oMode = ReturnTypeConfig.resolveType(sReturnType);
      var oView = this.getView();
      var oNav = oView.getModel("sectionsNav");
      oView.getModel("returnUi").setData(Object.assign({ title: this.getResourceBundle().getText(oMode.titleKey) }, oMode.ui));
      this._aSectionMeta.forEach(function (oMeta, iIndex) {
        var vVisible = oMode.ui.sections && oMode.ui.sections[oMeta.id] && oMode.ui.sections[oMeta.id].visible;
        oNav.setProperty("/list/" + iIndex + "/visible", vVisible !== false);
      });
      this._oSectionFactory.rebind();
    },

    _bindDetailHeader: function () {
      var oView = this.getView();

      oView.byId("detailTitle").bindProperty("text", {
        parts: [
          { path: ServiceSchema.headerProperties.returnId },
          { path: ServiceSchema.navs.headerToReturnType + "/" + ServiceSchema.returnTypeProperties.text },
          { path: "i18n>appTitle" }
        ],
        formatter: formatter.detailTitle
      });

      oView.byId("detailStatus")
        .bindProperty("text", { path: ServiceSchema.navs.headerToStatus + "/" + ServiceSchema.overallSDProcessStatusProperties.text })
        .bindProperty("status", { path: ServiceSchema.headerProperties.statusCriticality, formatter: formatter.statusState });

      oView.byId("detailCreatedOnBy").bindProperty("text", {
        parts: [
          { path: ServiceSchema.headerProperties.creationDate },
          { path: ServiceSchema.headerProperties.createdByUser },
          { path: "i18n>fieldCreatedOn" }
        ],
        formatter: formatter.detailCreatedOnBy
      });

      oView.byId("detailNetValue")
        .bindProperty("number", { path: ServiceSchema.headerProperties.netAmount })
        .bindProperty("unit", { path: ServiceSchema.headerProperties.currency });
    },

    onExpandPanel: function (oEvent) {
      this._oSectionFactory.ensurePanelContent(oEvent.getSource());
    },

    onAnchorPress: function (oEvent) {
      var oAnchor = oEvent.getSource();
      var oAnchorBar = oAnchor.getParent();
      if (oAnchorBar && oAnchorBar.getItems) {
        oAnchorBar.getItems().forEach(function (oLink) {
          oLink.removeStyleClass("detailAnchorLinkActive");
        });
      }
      oAnchor.addStyleClass("detailAnchorLinkActive");
      var sPanelId = oAnchor.data("panelId");
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

    toggleFullScreen: function () {
      var oModel = this.getOwnerComponent().getModel("appView") || this.getView().getModel("appView");
      var bFullScreen = oModel.getProperty("/actionButtonsInfo/midColumn/fullScreen");
      oModel.setProperty("/actionButtonsInfo/midColumn/fullScreen", !bFullScreen);
      if (!bFullScreen) {
        oModel.setProperty("/previousLayout", oModel.getProperty("/layout"));
        oModel.setProperty("/layout", "MidColumnFullScreen");
      } else {
        oModel.setProperty("/layout", oModel.getProperty("/previousLayout"));
      }
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
              description: "{message>description}"
            })
          }
        });
        this.getView().addDependent(this._oMessagePopover);
      }
      this._oMessagePopover.toggle(oEvent.getSource());
    },

    // Prices section (Prices.fragment.xml `pricesItemSelect` Select + unbound
    // `itemPricesTable`): the one dynamic binding in this app's Detail
    // controller — the item condition table binds to the chosen item's own
    // `_ItemPricingElement` nav only once an item is picked (prompt §4.3.5).
    onPricesItemSelect: function (oEvent) {
      var oTable = this._byIdInSection("prices", "itemPricesTable");
      if (!oTable) {
        return;
      }
      var sItemId = oEvent.getParameter("selectedItem") && oEvent.getParameter("selectedItem").getKey();
      if (!sItemId) {
        oTable.unbindItems();
        return;
      }
      var oHeaderContext = this.getView().getBindingContext();
      var sReturnId = oHeaderContext && oHeaderContext.getProperty(ServiceSchema.headerProperties.returnId);
      oTable.bindItems({
        path: ServiceSchema.buildItemPath(sReturnId, sItemId) + "/" + ServiceSchema.navs.itemToItemPricingElement,
        templateShareable: false,
        template: new ColumnListItem({
          cells: [
            new Text({
              text: {
                parts: [{ path: ServiceSchema.pricingElementProperties.conditionType }, { path: ServiceSchema.pricingElementProperties.conditionTypeName }],
                formatter: formatter.codeText
              }
            }),
            new Text({
              text: {
                parts: [
                  { path: ServiceSchema.pricingElementProperties.conditionRateValueIsAmount },
                  { path: ServiceSchema.pricingElementProperties.conditionRateValueIsRatio },
                  { path: ServiceSchema.pricingElementProperties.conditionRateAmount },
                  { path: ServiceSchema.pricingElementProperties.conditionRateRatio }
                ],
                formatter: formatter.conditionRate
              }
            }),
            new Text({ text: { path: ServiceSchema.pricingElementProperties.conditionAmount, formatter: formatter.orDash } }),
            new Text({ text: "{" + ServiceSchema.pricingElementProperties.conditionCurrency + "}" }),
            new CheckBox({ selected: "{" + ServiceSchema.pricingElementProperties.conditionIsForStatistics + "}", editable: false })
          ]
        })
      });
    },

    _byIdInSection: function (sSectionId, sControlId) {
      var oPanel = this.byId(sSectionId);
      // SectionFactory.js loads each section's Fragment with id=oPanel.getId()
      // (the full prefixed id) — Fragment.byId must use that same id, not the
      // local section id.
      return oPanel ? Fragment.byId(oPanel.getId(), sControlId) : undefined;
    },

    getResourceBundle: function () {
      return this.getOwnerComponent().getModel("i18n").getResourceBundle();
    }
  });
});
