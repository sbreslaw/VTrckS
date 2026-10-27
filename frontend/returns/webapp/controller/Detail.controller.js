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
  "sap/ui/core/Item",
  "sap/ui/core/ListItem",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessagePopover",
  "sap/m/MessageItem",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/m/ColumnListItem",
  "sap/m/Text",
  "sap/m/CheckBox",
  "sap/m/SelectDialog",
  "sap/m/StandardListItem",
  "cdc/vaccret/sections/SectionFactory",
  "cdc/vaccret/sections/SectionConfig",
  "cdc/vaccret/model/formatter",
  "cdc/vaccret/model/ServiceSchema",
  "cdc/vaccret/model/ReturnTypeConfig",
  "cdc/vaccret/service/CreateReturnService",
  "cdc/vaccret/util/MessageExtractor",
  "cdc/vaccret/util/FilterValue"
], function (
  Controller, Messaging, Fragment, Item, ListItem, JSONModel, Filter, FilterOperator,
  MessagePopover, MessageItem, MessageToast, MessageBox, ColumnListItem, Text, CheckBox, SelectDialog, StandardListItem,
  SectionFactory, SectionConfig, formatter, ServiceSchema, ReturnTypeConfig, CreateReturnService, MessageExtractor, FilterValue
) {
  "use strict";

  return Controller.extend("cdc.vaccret.controller.Detail", {
    formatter: formatter,

    onInit: function () {
      this._oRouter = this.getOwnerComponent().getRouter();
      this._oRouter.getRoute("detail").attachPatternMatched(this._onObjectMatched, this);
      this._oRouter.getRoute("create").attachPatternMatched(this._onCreateMatched, this);
      this._aSectionMeta = SectionConfig;
      // 4th/5th args left at their defaults ("sectionFlags"/"sectionsContainer")
      // — no SectionConfig.js entry here is editable, so sectionFlags is never
      // actually bound to by SectionFactory, but the ctor still expects the
      // positional slot. 6th arg "returnUi" drives each panel's visibility
      // (ReturnTypeConfig.js's `ui.sections.<id>.visible`).
      this._oSectionFactory = new SectionFactory(this.getView(), this._aSectionMeta, this._onSectionContentLoaded.bind(this), undefined, undefined, "returnUi");
      this.getView().setModel(this._createSectionsNavModel(), "sectionsNav");
      this.getView().setModel(new JSONModel({}), "returnUi");
      this.getView().setModel(new JSONModel({ active: false }), "createState");
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

    // SectionFactory.js content-loaded hook — required by its ctor signature.
    // No section here needs a load-time reaction yet (MVP-1: every section's
    // table binds declaratively in its own fragment's XML, see e.g.
    // Items.fragment.xml's `items="{_Item}"`); kept as an explicit no-op
    // rather than omitted, so a future section hook has an obvious home.
    _onSectionContentLoaded: function (sSectionId) {},

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

    // ---------------------------------------------------------------------
    // MVP-2 Create (prompt §4A). "createState" (JSONModel) drives the
    // provider-first phasing; "createItems" (JSONModel) is the scratch-row
    // buffer described in CreateReturnService.js's doc comment. The view's
    // own binding context becomes the session's transient header context
    // once Sold-To is picked (_onCreateSoldToConfirmed) — per the
    // bindElement-vs-setBindingContext precedence gotcha, unbindElement()
    // is always called first so the display route's stale element binding
    // can never win on a reused view instance.
    // ---------------------------------------------------------------------

    _onCreateMatched: function (oEvent) {
      var oArgs = oEvent.getParameter("arguments") || {};
      var sReturnType = decodeURIComponent(oArgs.returnType || "").toUpperCase();
      if (ReturnTypeConfig.getScopeReturnTypes().indexOf(sReturnType) === -1) {
        MessageToast.show(this.getResourceBundle().getText("createUnknownReturnType"));
        this._oRouter.navTo("master", {}, true);
        return;
      }
      this._enterCreateMode(sReturnType);
    },

    _enterCreateMode: function (sReturnType) {
      Messaging.removeAllMessages();
      this.getView().unbindElement();
      this.getView().setBindingContext(null);
      this._oCreateService = new CreateReturnService(this.getView().getModel());
      this._oItemsBinding = null;
      var oBundle = this.getResourceBundle();
      var oMode = ReturnTypeConfig.resolveType(sReturnType);
      this.getView().setModel(new JSONModel({
        active: true,
        returnType: sReturnType,
        returnTypeText: oBundle.getText(oMode.titleKey),
        soldToChosen: false,
        soldToDisplay: "",
        soldToParty: "",
        salesOrganization: "",
        distributionChannel: "",
        busy: false
      }), "createState");
      this.getView().setModel(new JSONModel({ rows: [], refundTypeItems: [] }), "createItems");
      this._populateCreateValueHelp("createReasonSelect", ServiceSchema.sets.returnsOrderReason,
        ServiceSchema.returnsOrderReasonProperties.code, ServiceSchema.returnsOrderReasonProperties.text);
      this._populateCreateValueHelp("createShippingConditionSelect", ServiceSchema.sets.shippingCondition,
        ServiceSchema.shippingConditionProperties.code, ServiceSchema.shippingConditionProperties.text);
      this._populateCreateRefundTypeItems();
    },

    // Same convention as Master.controller.js#_populateValueHelp (filter
    // Selects) — a JS-driven aggregation binding on the control itself,
    // not inline XML, so it stays consistent across both controllers.
    _populateCreateValueHelp: function (sControlId, sEntitySet, sKeyProperty, sTextProperty) {
      var oControl = this.byId(sControlId);
      if (!oControl) {
        return;
      }
      oControl.removeAllItems();
      oControl.addItem(new Item({ key: "", text: "" }));
      oControl.bindItems({
        path: "/" + sEntitySet,
        template: new Item({ key: "{" + sKeyProperty + "}", text: "{" + sTextProperty + "}" })
      });
    },

    // ReturnsRefundType feeds a per-row Select templated off the
    // "createItems" JSON model (ItemsCreate.fragment.xml), so it is read
    // once into that model's own array rather than bound live to OData.
    _populateCreateRefundTypeItems: function () {
      var oProps = ServiceSchema.returnsRefundTypeProperties;
      var oItemsModel = this.getView().getModel("createItems");
      this.getView().getModel().bindList("/" + ServiceSchema.sets.returnsRefundType).requestContexts(0, 20)
        .then(function (aContexts) {
          var aItems = [{ key: "", text: "" }].concat(aContexts.map(function (oContext) {
            return { key: oContext.getProperty(oProps.code), text: oContext.getProperty(oProps.text) };
          }));
          oItemsModel.setProperty("/refundTypeItems", aItems);
        });
    },

    onCreateSoldToValueHelpRequest: function () {
      if (!this._oCreateSoldToDialog) {
        var oProps = ServiceSchema.po.soldToDetailsProperties;
        this._oCreateSoldToDialog = new SelectDialog({
          title: this.getResourceBundle().getText("filterProviderPin"),
          items: {
            path: "po>/" + ServiceSchema.po.entitySets.soldToDetails,
            template: new StandardListItem({
              title: "{po>" + oProps.identificationNumber + "}",
              description: "{po>" + oProps.soldToParty + "}"
            })
          },
          search: this._onCreateSoldToDialogSearch.bind(this),
          confirm: this._onCreateSoldToDialogConfirm.bind(this)
        });
        this.getView().addDependent(this._oCreateSoldToDialog);
      }
      this._oCreateSoldToDialog.open();
    },

    _onCreateSoldToDialogSearch: function (oEvent) {
      var oProps = ServiceSchema.po.soldToDetailsProperties;
      var sValue = FilterValue.forFunction(oEvent.getParameter("value") || "");
      var oBinding = oEvent.getSource().getBinding("items");
      oBinding.filter(sValue ? new Filter({
        filters: [
          new Filter(oProps.identificationNumber, FilterOperator.Contains, sValue),
          new Filter(oProps.soldToParty, FilterOperator.Contains, sValue)
        ],
        and: false
      }) : []);
    },

    _onCreateSoldToDialogConfirm: function (oEvent) {
      var oProps = ServiceSchema.po.soldToDetailsProperties;
      var oItem = oEvent.getParameter("selectedItem");
      if (!oItem) {
        return;
      }
      var oContext = oItem.getBindingContext("po");
      this._onCreateSoldToConfirmed(oContext.getProperty(oProps.soldToParty), oContext.getProperty(oProps.identificationNumber));
    },

    _onCreateSoldToConfirmed: function (sSoldToParty, sIdentification) {
      var that = this;
      var oCreateState = this.getView().getModel("createState");
      var oBundle = this.getResourceBundle();
      oCreateState.setProperty("/busy", true);
      this._readCustomerSalesArea(sSoldToParty).then(function (mTriad) {
        if (!mTriad) {
          oCreateState.setProperty("/busy", false);
          MessageToast.show(oBundle.getText("createSoldToRequired"));
          return;
        }
        return that._oCreateService.enter(oCreateState.getProperty("/returnType"), mTriad).then(function (oHeaderContext) {
          that.getView().setBindingContext(oHeaderContext);
          return oHeaderContext.setProperty(ServiceSchema.headerProperties.soldToParty, sSoldToParty);
        }).then(function () {
          oCreateState.setProperty("/soldToChosen", true);
          oCreateState.setProperty("/soldToDisplay", sIdentification + " (" + sSoldToParty + ")");
          oCreateState.setProperty("/soldToParty", sSoldToParty);
          oCreateState.setProperty("/salesOrganization", mTriad.salesOrganization);
          oCreateState.setProperty("/distributionChannel", mTriad.distributionChannel);
          oCreateState.setProperty("/busy", false);
          that._addCreateItemScratchRows(5);
        });
      }).catch(function (oError) {
        oCreateState.setProperty("/busy", false);
        MessageExtractor.extract(oError, undefined, oBundle);
      });
    },

    // po>/CustomerSalesArea — Step-0 §6: the sales-area triad
    // CreateWithCustomerReturnType needs, NOT carried by the
    // c_soldtosalesareavh F4 service.
    _readCustomerSalesArea: function (sSoldToParty) {
      var oProps = ServiceSchema.po.customerSalesAreaProperties;
      var oBinding = this.getView().getModel("po").bindList("/" + ServiceSchema.po.entitySets.customerSalesArea,
        undefined, undefined, new Filter(oProps.customer, FilterOperator.EQ, sSoldToParty));
      return oBinding.requestContexts(0, 1).then(function (aContexts) {
        if (!aContexts.length) {
          return null;
        }
        var oContext = aContexts[0];
        return {
          salesOrganization: oContext.getProperty(oProps.salesOrganization),
          distributionChannel: oContext.getProperty(oProps.distributionChannel),
          organizationDivision: oContext.getProperty(oProps.division)
        };
      });
    },

    _addCreateItemScratchRows: function (iCount) {
      var oModel = this.getView().getModel("createItems");
      var aRows = oModel.getProperty("/rows") || [];
      for (var i = 0; i < iCount; i++) {
        aRows.push(this._newCreateItemRow());
      }
      oModel.setProperty("/rows", aRows);
    },

    _newCreateItemRow: function () {
      return {
        itemId: "",
        product: "",
        productName: "",
        batch: "",
        quantity: "",
        quantityUnit: "",
        exisId: "",
        refundType: "",
        posted: false
      };
    },

    onCreateItemAddRow: function () {
      this._addCreateItemScratchRows(1);
    },

    onCreateItemRemoveRow: function (oEvent) {
      var oRowContext = oEvent.getSource().getBindingContext("createItems");
      if (!oRowContext) {
        return;
      }
      var oModel = this.getView().getModel("createItems");
      var aRows = oModel.getProperty("/rows");
      var iIndex = aRows.indexOf(oRowContext.getObject());
      if (iIndex !== -1) {
        aRows.splice(iIndex, 1);
        oModel.setProperty("/rows", aRows);
      }
    },

    // Lazily-bound suggestionItems (never static XML) — the nested-template
    // autoExpandSelect gotcha (persistent memory: ui5-expression-bindings.md)
    // is about OData absolute-path aggregations nested inside another bound
    // template; this Input sits inside the createItems-bound row template,
    // so the same fix applies even though the outer model here is a plain
    // JSONModel, not OData.
    onCreateItemProductSuggest: function (oEvent) {
      var oInput = oEvent.getSource();
      var sValue = FilterValue.forFunction(oEvent.getParameter("suggestValue") || "");
      if (!sValue) {
        return;
      }
      var oProps = ServiceSchema.f4Product.properties;
      var oCreateState = this.getView().getModel("createState");
      if (!oInput.getBinding("suggestionItems")) {
        oInput.bindAggregation("suggestionItems", {
          path: "f4Product>/" + ServiceSchema.f4Product.entitySet,
          template: new ListItem({
            text: "{f4Product>" + oProps.product + "}",
            additionalText: "{f4Product>" + oProps.productName + "}"
          })
        });
      }
      oInput.getBinding("suggestionItems").filter(new Filter({
        filters: [
          new Filter(oProps.salesOrganization, FilterOperator.EQ, oCreateState.getProperty("/salesOrganization")),
          new Filter(oProps.distributionChannel, FilterOperator.EQ, oCreateState.getProperty("/distributionChannel")),
          new Filter(oProps.product, FilterOperator.Contains, sValue)
        ],
        and: true
      }));
    },

    onCreateItemProductSuggestionSelected: function (oEvent) {
      var oInput = oEvent.getSource();
      var oItem = oEvent.getParameter("selectedItem");
      var oRowContext = oInput.getBindingContext("createItems");
      if (!oItem || !oRowContext) {
        return;
      }
      var oProductContext = oItem.getBindingContext("f4Product");
      var oProps = ServiceSchema.f4Product.properties;
      var oModel = this.getView().getModel("createItems");
      var sPath = oRowContext.getPath();
      oModel.setProperty(sPath + "/product", oProductContext.getProperty(oProps.product));
      oModel.setProperty(sPath + "/productName", oProductContext.getProperty(oProps.productName));
      var sUnit = oProductContext.getProperty(oProps.requestedQuantityUnit);
      if (sUnit) {
        oModel.setProperty(sPath + "/quantityUnit", sUnit);
      }
      this._checkCreateItemRowComplete(oRowContext);
    },

    onCreateItemProductChange: function (oEvent) {
      this._checkCreateItemRowComplete(oEvent.getSource().getBindingContext("createItems"));
    },

    onCreateItemQuantityChange: function (oEvent) {
      this._checkCreateItemRowComplete(oEvent.getSource().getBindingContext("createItems"));
    },

    // A row posts itself the moment Product + Quantity are both filled
    // (Step-0: no post-POST PATCH is possible, so there is no "edit it
    // later" option — every other field on the row should be filled in
    // BEFORE Product/Quantity to be captured, same tradeoff the prompt's
    // scope-reality note accepted for 4A's core mechanics).
    _checkCreateItemRowComplete: function (oRowContext) {
      if (!oRowContext) {
        return;
      }
      var oRow = oRowContext.getObject();
      if (oRow.posted || !oRow.product || !oRow.quantity) {
        return;
      }
      this._postCreateItemRow(oRowContext);
    },

    _postCreateItemRow: function (oRowContext) {
      var oRow = oRowContext.getObject();
      var oItemProps = ServiceSchema.itemProperties;
      var oPayload = {};
      oPayload[oItemProps.product] = oRow.product;
      // Step-0 §1: RequestedQuantity MUST be a raw number, never a string.
      oPayload[oItemProps.quantity] = Number(oRow.quantity);
      oPayload[oItemProps.quantityUnit] = oRow.quantityUnit || "";
      if (oRow.batch) {
        oPayload[oItemProps.batch] = oRow.batch;
      }
      if (oRow.exisId) {
        oPayload[oItemProps.exisId] = oRow.exisId;
      }
      if (oRow.refundType) {
        oPayload[oItemProps.refundType] = oRow.refundType;
      }
      if (!this._oItemsBinding) {
        this._oItemsBinding = this._oCreateService.bindItems();
      }
      var oModel = this.getView().getModel("createItems");
      var sPath = oRowContext.getPath();
      var oBundle = this.getResourceBundle();
      return this._oCreateService.postItem(this._oItemsBinding, oPayload).then(function (oContext) {
        oModel.setProperty(sPath + "/posted", true);
        oModel.setProperty(sPath + "/itemId", oContext.getProperty(oItemProps.itemId));
      }).catch(function (oError) {
        MessageExtractor.extract(oError, undefined, oBundle);
      });
    },

    onCreateSavePress: function () {
      var that = this;
      var oCreateState = this.getView().getModel("createState");
      var oBundle = this.getResourceBundle();
      if (!oCreateState.getProperty("/soldToChosen")) {
        MessageToast.show(oBundle.getText("createSoldToRequired"));
        return;
      }
      oCreateState.setProperty("/busy", true);
      this._oCreateService.save().then(function (sReturnId) {
        oCreateState.setProperty("/busy", false);
        MessageToast.show(oBundle.getText("createToastCreated", [oCreateState.getProperty("/returnTypeText"), sReturnId]));
        that._exitCreateMode();
        that._oRouter.navTo("detail", { returnId: sReturnId }, true);
      }).catch(function (oError) {
        oCreateState.setProperty("/busy", false);
        MessageExtractor.extract(oError, undefined, oBundle);
      });
    },

    onCreateCancelPress: function () {
      var that = this;
      var oCreateState = this.getView().getModel("createState");
      if (!oCreateState.getProperty("/soldToChosen")) {
        this._discardCreateAndLeave();
        return;
      }
      var oBundle = this.getResourceBundle();
      var sConfirm = oBundle.getText("createConfirmDiscardConfirm");
      MessageBox.confirm(oBundle.getText("createConfirmDiscardText"), {
        title: oBundle.getText("createConfirmDiscardTitle"),
        actions: [sConfirm, oBundle.getText("createConfirmDiscardCancel")],
        emphasizedAction: sConfirm,
        onClose: function (sAction) {
          if (sAction === sConfirm) {
            that._discardCreateAndLeave();
          }
        }
      });
    },

    _discardCreateAndLeave: function () {
      var that = this;
      var oBundle = this.getResourceBundle();
      var oService = this._oCreateService;
      var pDiscard = oService ? oService.discard() : Promise.resolve();
      pDiscard.then(function () {
        MessageToast.show(oBundle.getText("createToastDiscarded"));
        that._exitCreateMode();
        that._oRouter.navTo("master", {}, true);
      });
    },

    _exitCreateMode: function () {
      this.getView().setModel(new JSONModel({ active: false }), "createState");
      this.getView().setModel(new JSONModel({ rows: [], refundTypeItems: [] }), "createItems");
      this._oItemsBinding = null;
      this._oCreateService = null;
    },

    getResourceBundle: function () {
      return this.getOwnerComponent().getModel("i18n").getResourceBundle();
    }
  });
});
