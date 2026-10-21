sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/m/MessagePopover",
  "sap/m/MessageItem",
  "sap/m/Dialog",
  "sap/m/Button",
  "sap/m/BusyIndicator",
  "sap/m/Text",
  "sap/m/List",
  "sap/m/CustomListItem",
  "sap/m/CheckBox",
  "sap/m/HBox",
  "sap/m/VBox",
  "sap/m/Select",
  "sap/m/Input",
  "sap/m/Label",
  "sap/m/SelectDialog",
  "sap/m/StandardListItem",
  "sap/m/SearchField",
  "sap/m/RadioButton",
  "sap/m/Token",
  "sap/ui/table/Table",
  "sap/ui/table/Column",
  "sap/ui/table/rowmodes/Auto",
  "sap/ui/comp/valuehelpdialog/ValueHelpDialog",
  "sap/ui/comp/filterbar/FilterBar",
  "sap/ui/comp/filterbar/FilterGroupItem",
  "sap/ui/core/Item",
  "sap/ui/core/ListItem",
  "sap/ui/core/Fragment",
  "sap/ui/core/Messaging",
  "sap/ui/core/EventBus",
  "sap/ui/core/Element",
  "sap/ui/core/ResizeHandler",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter",
  "sap/ui/export/Spreadsheet",
  "cdc/vaccreq/sections/SectionFactory",
  "cdc/vaccreq/sections/SectionConfig",
  "cdc/vaccreq/model/formatter",
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/OrderModeConfig",
  "cdc/vaccreq/model/VariantStore",
  "cdc/vaccreq/model/Enums",
  "cdc/vaccreq/model/MessageExtractor",
  "cdc/vaccreq/model/PricingColumns",
  "cdc/vaccreq/service/EditRequestService",
  "cdc/vaccreq/service/CreateOrderService",
  "cdc/vaccreq/service/ProviderInventoryService",
  "cdc/vaccreq/service/ProviderSearchService",
  "cdc/vaccreq/service/FundLogicService",
  "cdc/vaccreq/controller/FundSplitDialog",
  "cdc/vaccreq/util/ValueHelpTableFitter"
], function (
  Controller, MessageToast, MessageBox, MessagePopover, MessageItem, Dialog, Button, BusyIndicator, Text,
  List, CustomListItem, CheckBox, HBox, VBox, Select, Input, Label, SelectDialog, StandardListItem, SearchField,
  RadioButton, Token, GridTable, GridColumn, AutoRowMode, ValueHelpDialog, FilterBar, FilterGroupItem, CoreItem, CoreListItem, Fragment,
  Messaging, EventBus, Element, ResizeHandler, JSONModel, Filter, FilterOperator, Sorter, Spreadsheet, SectionFactory, SectionConfig, formatter, ServiceSchema, OrderModeConfig, VariantStore, Enums, MessageExtractor, PricingColumns,
  EditRequestService, CreateOrderService, ProviderInventoryService, ProviderSearchService, FundLogicService, FundSplitDialog,
  ValueHelpTableFitter
) {
  "use strict";

  // CRUD Task 1 v4 (Create Order field adjustments): hardcoded sample data for
  // the Employee Responsible Value Help stub picker - no real F4 service is
  // wired yet (VH EntitySet TBD), see NOTES.md/OPEN_QUESTIONS.md.
  // Provider/Ship-To VH is live (HeaderShipToParty, see
  // _openShipToPartyValueHelpDialog) and Contact VH is live
  // (StandardPartnerContactInfo, see _openContactValueHelpDialog).
  // "based on SAP User name (USR02)" - hardcoded sample user master rows.
  var EMPLOYEE_PICKER_ITEMS = [
    { id: "JDOE", name: "John Doe (placeholder)" },
    { id: "ASMITH", name: "Alice Smith (placeholder)" },
    { id: "BJONES", name: "Bob Jones (placeholder)" }
  ];

  // MaterialGroup2-to-quantity-mirror mapping used by onFundTypeChange and
  // onProdQtyChange. Dropdown values come from po>/FundTypeVH per item row.
  // ARR and N/A share the single "leftover" ZZRESQTY mirror (no stated
  // per-code split from the client). SPL has no quantity mirror of its own -
  // selecting it opens the Fund Split dialog (FundSplitDialog.js) instead,
  // which allocates across the OTHER eligible funds' own mirrors.
  var FUND_TYPES = [
    { key: "VFC", i18nKey: "enumFundTypeVfc", targetFieldKey: "vfcQty", pediatricOnly: true },
    { key: "317", i18nKey: "enumFundType317", targetFieldKey: "qty317" },
    { key: "S/L", i18nKey: "enumFundTypeState", targetFieldKey: "stateQty" },
    { key: "CHP", i18nKey: "enumFundTypeChip", targetFieldKey: "chipQty", pediatricOnly: true },
    // Fund Split dialog session prompt: SPL is now selectable (Trigger 1) -
    // it has no own quantity mirror, the individual funds it splits across do.
    { key: "SPL", i18nKey: "enumFundTypeSplit", targetFieldKey: "" },
    { key: "PAN", i18nKey: "enumFundTypePan", targetFieldKey: "panQty" },
    { key: "ARR", i18nKey: "enumFundTypeArr", targetFieldKey: "resQty" },
    { key: "N/A", i18nKey: "enumFundTypeNa", targetFieldKey: "resQty" }
  ];

  var ITEMS_COLUMNS_KEY = "itemsColumns";
  var ITEMS_COLUMN_KEYS = [
    "rowAction", "optOut", "itemNumber", "exisId", "brand", "ndcCode", "ndcDescription",
    "qty", "uom", "orderIntention", "fundType", "poReference", "deliveryStatus", "netValue", "rejectionReason"
  ];
  var ITEMS_COLUMN_I18N = {
    rowAction: "colRowAction", optOut: "colOptOutAncillary", itemNumber: "colItemNumber",
    exisId: "colExisId", brand: "colBrand", ndcCode: "colNdcCode", ndcDescription: "colNdcDescription",
    qty: "itemQty", uom: "itemUom", orderIntention: "colOrderIntention", fundType: "colFundType",
    poReference: "colPoReference", deliveryStatus: "colDeliveryStatus", netValue: "itemNetAmount",
    rejectionReason: "colRejectionReason"
  };
  // Paste-eligible Items columns: column key -> ServiceSchema.itemProperties key of the cell's value binding.
  var PASTE_COLUMNS = { exisId: "exisId", ndcCode: "material", qty: "quantity" };

  return Controller.extend("cdc.vaccreq.controller.Detail", {
    formatter: formatter,

    onInit: function () {
      this._oRouter = this.getOwnerComponent().getRouter();
      this._oRouter.getRoute("detail").attachPatternMatched(this._onObjectMatched, this);
      // CRUD Task 1 v3 (In-Place Create): the "create" route reuses this same
      // Detail view/controller instance — a transient context stands in for the
      // bindElement path the "detail" route uses (design/prompts/CRUD Task 1
      // Prompt v3.md).
      this._oRouter.getRoute("create").attachPatternMatched(this._onCreateMatched, this);
      this._oRouter.getRoute("master").attachPatternMatched(this._onMasterMatched, this);
      // Single source of truth for the panel stack: SectionConfig.js. The anchor
      // strip (sectionsNav model, below) and the sectionFlags model are both
      // derived from this same array, so a new section added there appears in
      // both automatically (Phase 2 Prompt v2, P1 item 2).
      this._aSectionMeta = SectionConfig;
      this._oSectionFactory = new SectionFactory(this.getView(), this._aSectionMeta, this._onSectionContentLoaded.bind(this));
      this.getView().setModel(this._createSectionFlagsModel(), "sectionFlags");
      this.getView().setModel(this._createSectionsNavModel(), "sectionsNav");
      this.getView().setModel(new JSONModel({}), "orderUi");
      this.getView().setModel(Messaging.getMessageModel(), "message");
      this.getView().setModel(new JSONModel(this._getItemsColumnVisibility()), "itemsColumns");
      this.getView().setModel(new JSONModel({ rows: [], busy: false, error: false, editable: false, loaded: false }), "ioh");
      this.getView().setModel(new JSONModel({ salesOrder: "", rows: [], busy: false, error: false, loaded: false }), "transactionHistory");
      this.getView().setModel(new JSONModel({ name: "", tooltip: "" }), "detailContact");
      // CRUD Task 1 v4: Contact/Employee Responsible/Priority/Category/Status/
      // Shipping-Provider have no real writable field yet (all part of the
      // still-unbuilt enrichment action, ADDENDUM-001) - local-only model, reset
      // each time createMode is entered (_setCreateMode), sent as the enrichment
      // payload at Save (still a no-op today, see CreateOrderService.js#enrich).
      this.getView().setModel(new JSONModel(this._createEnrichDefaults()), "createEnrich");
      this.getView().setModel(new JSONModel({ providerName: "", addresses: [], createAddressKey: "", busy: false }), "shippingEdit");
      this.getView().setModel(this._createEnumsModel(), "enums");
      this.getView().setModel(this._createFundTypesModel(), "fundTypes");
      // v5 ("UX phasing + triad sourcing"): createMode opens with only the
      // Provider field enabled; every other createMode field/Add-row button
      // binds `enabled` off this flag and unlocks once a Provider is picked
      // (onProviderValueHelpRequest below) - reset each time createMode is
      // (re-)entered, see _setCreateMode.
      // deliveryStatusText/deliveryBlockStatusText: the Delivery Status/
      // Delivery Block Status fields have no edit control (display-only,
      // not in updatableHeaderProperties) - populated by _setCreateMode via
      // a direct codelist lookup (see below) once the defaults are seeded,
      // since the header's own _OverallDeliveryStatus/
      // _OverallDeliveryBlockStatus navigation cannot resolve against the
      // transient createMode scratch context (client requirement 2026-10-01).
      this.getView().setModel(new JSONModel({ providerChosen: false, deliveryStatusText: "", deliveryBlockStatusText: "" }), "createState");
      this._sItemsUpdateGroup = ServiceSchema.editUpdateGroup;
      // 3.3: client-side-only SUM of item TaxAmount - never a real header
      // property, see _computeHeaderTaxAmount.
      this.getView().setModel(new JSONModel({ taxAmount: 0 }), "headerCalc");
      // Ancillary Items & Opt-Out session prompt: /childParents is a
      // {"<parentItemNumber>": true} map recomputed off the Items table's
      // OWN current contexts (HigherLevelItem) after every real-list
      // load/refresh - drives the opt-out checkbox's enabled state and the
      // child-row read-only/indent treatment (Items.fragment.xml). Empty
      // until the sticky session opens (createMode) or an existing order's
      // items load (change mode) - see _computeAncillaryParents.
      this.getView().setModel(new JSONModel({ childParents: {} }), "itemsMeta");
      this._loadRejectionReasonVH();
      this._applyOrderUi(this.getOwnerComponent().getModel("orderContext").getProperty("/orderTypes/0/orderType"));

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
      // First-ever render can race _onObjectMatched/_onCreateMatched (the
      // "details-title" control doesn't exist until ensurePanels() runs) -
      // (re)apply the binding here too, it's idempotent.
      this._bindDetailsSectionTitle();
    },

    onExpandPanel: function (oEvent) {
      var oPanel = oEvent.getSource();
      this._oSectionFactory.ensurePanelContent(oPanel);
      this._refreshTransactionHistory();
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
        this._refreshTransactionHistory();
        oPanel.getDomRef().scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },

    onCloseColumn: function () {
      this._oRouter.navTo("master", {}, true);
    },

    onRefresh: function () {
      var oContext = this.getView().getBindingContext();
      if (oContext) {
        oContext.refresh();
      }
    },

    onNewPress: function () {
      var oBundle = this.getResourceBundle();
      if (this._bStartNewAfterSave) {
        return;
      }
      if (!this._hasUnsavedOrderChanges()) {
        this._discardCurrentOrderAndStartNew();
        return;
      }

      var sSave = oBundle.getText("newOrderSave");
      var sDiscard = oBundle.getText("newOrderDiscard");
      var sCancel = oBundle.getText("newOrderCancel");
      var sDialogId = this.getView().createId("newOrderUnsavedDialog");
      MessageBox.warning(oBundle.getText("newOrderUnsavedMessage"), {
        id: sDialogId,
        title: oBundle.getText("newOrderUnsavedTitle"),
        contentWidth: "32rem",
        styleClass: "newOrderUnsavedDialog",
        actions: [sSave, sDiscard, sCancel],
        emphasizedAction: sSave,
        initialFocus: sCancel,
        onClose: function (sAction) {
          if (sAction === sSave) {
            this._saveCurrentOrderAndStartNew();
          } else if (sAction === sDiscard) {
            this._discardCurrentOrderAndStartNew();
          }
        }.bind(this)
      });
      var oDialog = Element.getElementById(sDialogId);
      var oCancelButton = oDialog && oDialog.getButtons().find(function (oButton) {
        return oButton.getText() === sCancel;
      });
      if (oCancelButton) {
        oCancelButton.setType("Transparent").addStyleClass("newOrderCancelButton");
      }
    },

    _hasUnsavedOrderChanges: function () {
      var oContext = this.getView().getBindingContext();
      var bCreateMode = this.getView().getModel("sectionFlags").getProperty("/createMode");
      if (bCreateMode) {
        return !!(this.getView().getModel("createState").getProperty("/providerChosen") ||
          (this._oCreateSession && this._oCreateSession.opened));
      }
      if (!oContext) {
        return false;
      }
      var oEnrichModel = this.getView().getModel("createEnrich");
      return oContext.getModel().hasPendingChanges(ServiceSchema.editUpdateGroup) ||
        oEnrichModel.getProperty("/notes") !== oEnrichModel.getProperty("/notesOriginal");
    },

    _getEditingSectionId: function () {
      var oFlags = this.getView().getModel("sectionFlags");
      var oEditingSection = this._aSectionMeta.find(function (oMeta) {
        return oMeta.editLive && oFlags.getProperty("/" + oMeta.id + "/editing");
      });
      return oEditingSection ? oEditingSection.id : "details";
    },

    _saveCurrentOrderAndStartNew: function () {
      this._bStartNewAfterSave = true;
      this.byId("newOrderBtn").setEnabled(false);
      if (this.getView().getModel("sectionFlags").getProperty("/createMode")) {
        this.onCreateSavePress();
      } else {
        this.onSectionSavePress(this._getEditingSectionId());
      }
    },

    _discardCurrentOrderAndStartNew: function () {
      var oContext = this.getView().getBindingContext();
      var bCreateMode = this.getView().getModel("sectionFlags").getProperty("/createMode");
      this._bStartNewAfterSave = false;
      if (!bCreateMode) {
        Promise.resolve(oContext && EditRequestService.cancel(oContext)).then(function () {
          this._destroyNotesWriteBinding();
          Messaging.removeAllMessages();
          this._oRouter.navTo("create", { orderType: this._getNewOrderType() }, false);
        }.bind(this));
        return;
      }

      this.getView().setBusy(true);
      CreateOrderService.cancel(oContext, this._oCreateSession).then(function () {
        this._oCreateListBinding = null;
        this._oCreateSession = null;
        this._bItemsSessionBound = false;
        FundLogicService.clearAllocationCache();
        this.getView().setBusy(false);
        this._enterCreateMode(this._sCreateOrderType);
      }.bind(this), function (oError) {
        this.getView().setBusy(false);
        MessageExtractor.extract(oError, oContext && oContext.getPath(), this.getResourceBundle());
        this._openMessagePopover();
      }.bind(this));
    },

    onPreviewOutput: function () {
      if (!this._oPreviewDialog) {
        var oBundle = this.getResourceBundle();
        this._oPreviewDialog = new Dialog({
          title: oBundle.getText("previewDialogTitle"),
          content: new Text({ text: oBundle.getText("previewDialogText") }).addStyleClass("sapUiMediumMargin"),
          endButton: new Button({
            text: oBundle.getText("close"),
            press: function () {
              this._oPreviewDialog.close();
            }.bind(this)
          })
        });
        this.getView().addDependent(this._oPreviewDialog);
      }
      this._oPreviewDialog.open();
    },

    onValidate: function () {
      MessageToast.show(this.getResourceBundle().getText("validateToast"));
    },

    // --- Items section: Export to Excel + a lightweight visibility-only
    // Personalize dialog (Phase 2 Prompt v2, item F). Column order stays fixed
    // in Items.fragment.xml; only show/hide is persisted, via VariantStore.js,
    // deliberately simpler than the Master table's reorder-capable dialog. ---

    _getItemsColumnVisibility: function () {
      var oData = VariantStore.load(ITEMS_COLUMNS_KEY);
      var oSaved = oData.variants && oData.variants.layout;
      var oOrderUi = this.getView().getModel("orderUi").getData();
      var oVisibility = {};
      ITEMS_COLUMN_KEYS.forEach(function (sKey) {
        // An order-type-hidden column wins over the user's saved layout.
        oVisibility[sKey] = OrderModeConfig.uiFlag(oOrderUi, "columns", sKey, "visible") &&
          (sKey === "rejectionReason" || !(oSaved && oSaved[sKey] === false));
      });
      return oVisibility;
    },

    onItemsExport: function (oEvent) {
      var oTable = this._byIdInSection("items", "itemsTable");
      var oBinding = oTable.getBinding("items");
      var aContexts = oBinding ? oBinding.getContexts(0, oBinding.getLength()) : [];
      var oBundle = this.getResourceBundle();
      var oVisibility = this.getView().getModel("itemsColumns").getData();
      // DF-1025: the nav text is no longer bound (not in $select) - resolve the code via the VH list.
      var mRejectionText = {};
      this.getView().getModel("rejectionReasons").getProperty("/list").forEach(function (oEntry) {
        if (oEntry.key) {
          mRejectionText[oEntry.key] = oEntry.text;
        }
      });
      var aCols = ITEMS_COLUMN_KEYS
        .filter(function (sKey) { return sKey !== "rowAction" && oVisibility[sKey] !== false; })
        .map(function (sKey) {
          return {
            label: oBundle.getText(ITEMS_COLUMN_I18N[sKey]),
            property: sKey,
            type: "String"
          };
        });
      var aRows = aContexts.map(function (oCtx) {
        return {
          optOut: oCtx.getProperty(ServiceSchema.itemProperties.optOutAncillary),
          itemNumber: oCtx.getProperty(ServiceSchema.itemProperties.itemNumber),
          exisId: oCtx.getProperty(ServiceSchema.itemProperties.exisId),
          brand: oCtx.getProperty(ServiceSchema.itemProperties.brand),
          ndcCode: oCtx.getProperty(ServiceSchema.itemProperties.material),
          ndcDescription: oCtx.getProperty(ServiceSchema.itemProperties.itemText),
          qty: oCtx.getProperty(ServiceSchema.itemProperties.quantity),
          uom: oCtx.getProperty(ServiceSchema.itemProperties.unit),
          orderIntention: "\u2014",
          fundType: oCtx.getProperty(ServiceSchema.itemProperties.fundType),
          poReference: "\u2014",
          deliveryStatus: oCtx.getProperty(ServiceSchema.navigation.itemToDeliveryStatus + "/" + ServiceSchema.itemProperties.deliveryStatusText),
          netValue: oCtx.getProperty(ServiceSchema.itemProperties.netAmount),
          rejectionReason: mRejectionText[oCtx.getProperty(ServiceSchema.itemProperties.rejectionReason)] || ""
        };
      });

      new Spreadsheet({
        workbook: { columns: aCols },
        dataSource: aRows,
        fileName: oBundle.getText("sectionItems") + ".xlsx"
      }).build().catch(function (oError) {
        MessageToast.show(oError && oError.message ? oError.message : "Export failed");
      });
    },

    onItemsPersonalize: function (oEvent) {
      var that = this;
      var oBundle = this.getResourceBundle();
      var oOrderUi = this.getView().getModel("orderUi").getData();
      var oWorkingModel = new JSONModel({
        rows: ITEMS_COLUMN_KEYS.filter(function (sKey) {
          return sKey !== "rowAction" && sKey !== "rejectionReason" &&
            OrderModeConfig.uiFlag(oOrderUi, "columns", sKey, "visible");
        }).map(function (sKey) {
          return {
            key: sKey,
            label: oBundle.getText(ITEMS_COLUMN_I18N[sKey]),
            visible: that.getView().getModel("itemsColumns").getProperty("/" + sKey) !== false
          };
        })
      });

      var oList = new List({
        mode: "None",
        items: {
          path: "cols>/rows",
          template: new CustomListItem({
            content: [
              new HBox({
                alignItems: "Center",
                items: [
                  new CheckBox({ selected: "{cols>visible}" }),
                  new Text({ text: "{cols>label}" }).addStyleClass("sapUiTinyMarginBegin")
                ]
              }).addStyleClass("sapUiTinyMargin")
            ]
          })
        }
      });
      oList.setModel(oWorkingModel, "cols");

      var oDialog = new Dialog({
        title: oBundle.getText("columnDialogTitle"),
        contentWidth: "24rem",
        content: [oList],
        beginButton: new Button({
          text: oBundle.getText("ok"),
          press: function () {
            var aRows = oWorkingModel.getProperty("/rows");
            var oVisibility = aRows.reduce(function (oAcc, oRow) {
              oAcc[oRow.key] = oRow.visible;
              return oAcc;
            }, {});
            VariantStore.saveVariant(ITEMS_COLUMNS_KEY, "layout", oVisibility);
            var oModel = that.getView().getModel("itemsColumns");
            Object.keys(oVisibility).forEach(function (sKey) {
              oModel.setProperty("/" + sKey, oVisibility[sKey]);
            });
            oDialog.close();
          }
        }),
        endButton: new Button({
          text: oBundle.getText("cancel"),
          press: function () { oDialog.close(); }
        }),
        afterClose: function () { oDialog.destroy(); }
      });
      this.getView().addDependent(oDialog);
      oDialog.open();
    },

    onMessagePopoverPress: function (oEvent) {
      this._openMessagePopover(oEvent.getSource());
    },

    // Fix 4 (Corrective Work Order): shared so create-flow failures
    // (MessageExtractor.extract) can pop the SAME popover open programmatically
    // instead of a MessageToast — oControl defaults to the header message
    // button so it always has somewhere to anchor to.
    _openMessagePopover: function (oControl) {
      if (!this._oMessagePopover) {
        this._oMessagePopover = new MessagePopover({
          // Gap 4 (Message Accuracy & Hygiene task) - group by severity,
          // errors first, warnings collapsible: sap.m.MessagePopover's own
          // groupItems feature does exactly this, no custom grouping code
          // needed.
          groupItems: true,
          items: {
            path: "message>/",
            template: new MessageItem({
              type: "{message>type}",
              title: "{message>message}",
              subtitle: {
                parts: ["message>code", "message>additionalText", "message>technicalDetails"],
                formatter: formatter.messageSubtitle
              },
              description: "{message>description}"
            })
          }
        });
        this.getView().addDependent(this._oMessagePopover);
      }
      this._oMessagePopover.toggle(oControl || this.byId("messagePopoverBtn"));
    },

    // --- CRUD Task 2 (Change Mode): per-section edit sessions (Details/Items
    // only \u2014 SectionConfig.js `editLive`). One section in edit at a time;
    // Edit/Save/Cancel buttons live in that section's headerToolbar
    // (SectionFactory.js). No draft: Save = submitBatch("vrEdit"), Cancel =
    // resetChanges("vrEdit") \u2014 see EditRequestService.js. ---

    onSectionEditPress: function (sSectionId) {
      var oContext = this.getView().getBindingContext();
      var oFlags = this.getView().getModel("sectionFlags");
      if (!oContext || oFlags.getProperty("/" + sSectionId + "/editing")) {
        return;
      }
      // Serialize: disable every other live section's Edit while this one is open.
      this._aSectionMeta.forEach(function (oMeta) {
        if (oMeta.editLive && oMeta.id !== sSectionId) {
          oFlags.setProperty("/" + oMeta.id + "/editEnabled", false);
        }
      });
      EditRequestService.beginEdit(oContext, sSectionId);
      oFlags.setProperty("/" + sSectionId + "/editing", true);
      if (sSectionId === "items") {
        var oItemsTable = this._byIdInSection("items", "itemsTable");
        var oAddMoreButton = this._byIdInSection("items", "itemsAddMoreButton");
        if (oAddMoreButton && oAddMoreButton.getEnabled()) {
          this._addItemsToMinimum(oItemsTable && oItemsTable.getBinding("items"));
        }
      }
      if (sSectionId === "shipping") {
        this._prepareShippingEdit(oContext);
      }
    },

    _prepareShippingEdit: function (oContext) {
      var oShipTo = ServiceSchema.shipToPartyProperties;
      var oEditModel = this.getView().getModel("shippingEdit");
      Promise.all([
        oContext.requestProperty(ServiceSchema.navigation.headerToShipToParty + "/" + oShipTo.id),
        oContext.requestProperty(ServiceSchema.navigation.headerToShipToParty + "/" + oShipTo.fullName),
        oContext.requestProperty(ServiceSchema.navigation.headerToShipToParty + "/" + oShipTo.addressId),
        oContext.requestProperty(ServiceSchema.navigation.headerToShipToParty + "/" + oShipTo.address),
        oContext.requestProperty("PartnerDeterminationProcedure")
      ]).then(function (aValues) {
        oEditModel.setProperty("/providerName", aValues[1]);
        return this._loadShippingAddresses(aValues[0], aValues[4], {
          id: aValues[2],
          address: aValues[3]
        });
      }.bind(this));
    },

    _loadShippingAddresses: function (sProviderId, sProcedure, oCurrentAddress) {
      var oSchema = ServiceSchema.shippingAddressValueHelp;
      var oProps = oSchema.properties;
      var oEditModel = this.getView().getModel("shippingEdit");
      var iRequest = (this._iShippingAddressRequest || 0) + 1;
      this._iShippingAddressRequest = iRequest;
      var oBinding = this.getView().getModel("shippingAddressVH").bindList(
        "/" + oSchema.entitySet,
        undefined,
        undefined,
        [
          new Filter(oProps.customer, FilterOperator.EQ, sProviderId),
          new Filter(oProps.partnerFunction, FilterOperator.EQ, oSchema.shipToPartnerFunction),
          new Filter(oProps.partnerDeterminationProcedure, FilterOperator.EQ, sProcedure)
        ],
        { $select: [oProps.addressId, oProps.address].join(",") }
      );
      oEditModel.setProperty("/busy", true);
      return oBinding.requestContexts(0, 100).then(function (aContexts) {
        if (this._iShippingAddressRequest !== iRequest) {
          return null;
        }
        var aAddresses = aContexts.map(function (oAddressContext) {
          return {
            id: oAddressContext.getProperty(oProps.addressId),
            address: oAddressContext.getProperty(oProps.address)
          };
        }).filter(function (oAddress) {
          return !!oAddress.id && !!oAddress.address;
        });
        if (oCurrentAddress && oCurrentAddress.id && !aAddresses.some(function (oAddress) {
          return oAddress.id === oCurrentAddress.id;
        })) {
          aAddresses.unshift(oCurrentAddress);
        }
        oEditModel.setProperty("/addresses", aAddresses);
        return aAddresses;
      }.bind(this)).finally(function () {
        if (this._iShippingAddressRequest === iRequest) {
          oEditModel.setProperty("/busy", false);
        }
        oBinding.destroy();
      }.bind(this));
    },

    onShippingProviderValueHelpRequest: function () {
      var that = this;
      var oContext = this.getView().getBindingContext();
      this._openShipToPartyValueHelpDialog(this.getResourceBundle().getText("providerPickerTitle"), function (oItem) {
        oContext.setProperty(ServiceSchema.navigation.headerToShipToParty + "/" + ServiceSchema.shipToPartyProperties.id, oItem.id);
        that.getView().getModel("shippingEdit").setProperty("/providerName", oItem.fullName);
        oContext.requestProperty("PartnerDeterminationProcedure").then(function (sProcedure) {
          return that._loadShippingAddresses(oItem.id, sProcedure);
        }).then(function (aAddresses) {
          if (aAddresses && aAddresses.length) {
            oContext.setProperty(ServiceSchema.navigation.headerToShipToParty + "/" + ServiceSchema.shipToPartyProperties.addressId, aAddresses[0].id);
          }
        });
      });
    },

    onSectionCancelPress: async function (sSectionId) {
      var oContext = this.getView().getBindingContext();
      if (oContext) {
        await EditRequestService.cancel(oContext);
      }
      if (sSectionId === "items") {
        var oTable = this._byIdInSection("items", "itemsTable");
        await this._deleteEmptyItemRows(oTable && oTable.getBinding("items"));
      }
      if (sSectionId === "details") {
        var oEnrichModel = this.getView().getModel("createEnrich");
        oEnrichModel.setProperty("/notes", oEnrichModel.getProperty("/notesOriginal") || "");
        this._bNotesNeedsCreate = false;
        this._destroyNotesWriteBinding();
      }
      Messaging.removeAllMessages();
      this._endEditSession(sSectionId);
    },

    onDetailStatusChange: function (oEvent) {
      var oSelect = oEvent.getSource();
      var oSelectedItem = oSelect.getSelectedItem();
      var oContext = oSelect.getBindingContext();
      if (!oContext || !oSelectedItem) {
        return;
      }
      var oStatusContext = oSelectedItem.getBindingContext("enums");
      var sStatus = oStatusContext && oStatusContext.getProperty("text");
      if (!sStatus) {
        return;
      }
      var pUpdate = oContext.setProperty(ServiceSchema.headerProperties.userStatus, sStatus);
      if (pUpdate && pUpdate.catch) {
        pUpdate.catch(function () {});
      }
    },

    // Sections whose display Text reads a code's expanded to-one nav-property
    // text (e.g. Order Reason code -> _SDDocumentReason/SDDocumentReason_Text):
    // changing the code points that nav at a *different* entity, and
    // requestSideEffects errors on that ("Key predicate ... changed") since it
    // expects a nav's target identity to stay stable. A full context reload
    // (same as reopening the order) sidesteps that merge check entirely.
    _aSectionsNeedingFullReload: ["details", "shipping", "orgData"],

    onSectionSavePress: function (sSectionId) {
      var that = this;
      var oContext = this.getView().getBindingContext();
      var oBundle = this.getResourceBundle();
      if (!oContext) {
        return;
      }
      var oItemsTable = sSectionId === "items" && this._byIdInSection("items", "itemsTable");
      var oItemsBinding = oItemsTable && oItemsTable.getBinding("items");
      if (sSectionId === "items" && CreateOrderService.hasIncompleteItems(oItemsBinding)) {
        MessageToast.show(oBundle.getText("itemsIncompleteItemsError"));
        return;
      }
      var pRemoveEmptyItems = sSectionId === "items"
        ? this._deleteEmptyItemRows(oItemsBinding)
        : Promise.resolve();
      var oStagePromise = sSectionId === "details"
        ? this._stageHeaderNotes(oContext)
        : Promise.resolve();
      pRemoveEmptyItems.then(function () { return oStagePromise; }).then(function () {
        return EditRequestService.save(oContext);
      }).then(function () {
        if (sSectionId === "details" && that._bNotesNeedsCreate) {
          return CreateOrderService.saveNotes(oContext, that.getView().getModel("createEnrich").getProperty("/notes"));
        }
      }).then(function () {
        if (sSectionId === "details") {
          var oEnrichModel = that.getView().getModel("createEnrich");
          oEnrichModel.setProperty("/notesOriginal", oEnrichModel.getProperty("/notes") || "");
          that._bNotesNeedsCreate = false;
          that._destroyNotesWriteBinding();
        }
        MessageToast.show(oBundle.getText("editSaveSuccess"));
        if (that._aSectionsNeedingFullReload.indexOf(sSectionId) !== -1) {
          that._reloadHeaderContext(oContext.getPath());
        }
        // No explicit master-row refresh call: the Master list binds the same
        // OData V4 model/entity instance, whose cache the PATCH response
        // already updated \u2014 any bound row for this order reflects it automatically.
        that._endEditSession(sSectionId);
        if (sSectionId === "items") {
          that._computeHeaderTaxAmount();
        }
        if (that._bStartNewAfterSave) {
          that._bStartNewAfterSave = false;
          that.byId("newOrderBtn").setEnabled(true);
          that._oRouter.navTo("create", { orderType: that._getNewOrderType() }, false);
        }
      }, function (oError) {
        that._bStartNewAfterSave = false;
        that.byId("newOrderBtn").setEnabled(true);
        if (oError.isConflict) {
          that._showConflictDialog(oContext, sSectionId);
        } else {
          // Message Accuracy & Hygiene task: same MessageExtractor-driven
          // popover the create flow uses, replacing the generic toast this
          // used to show for every change-mode save failure alike.
          var aSectionIds = MessageExtractor.extract(oError, oContext.getPath(), oBundle);
          (aSectionIds.length ? aSectionIds : [sSectionId]).forEach(function (sId) {
            that._oSectionFactory.expandSection(sId);
          });
          that._openMessagePopover();
        }
      });
    },

    // Full re-GET of the header (mirrors reopening the order) - used instead
    // of requestSideEffects when a saved section can change a to-one nav's
    // target identity (see _aSectionsNeedingFullReload above).
    _reloadHeaderContext: function (sPath) {
      var oOldContext = this.getView().getBindingContext();
      var sOrderId = oOldContext && oOldContext.getProperty(ServiceSchema.keys.orderId);
      this.getView().unbindElement();
      this.getView().bindElement({
        path: sPath,
        parameters: {
          $$updateGroupId: ServiceSchema.editUpdateGroup,
          $select: ServiceSchema.headerProperties.salesOrderType
        },
        events: {
          dataReceived: this._syncOrderUiFromContext.bind(this)
        }
      });
      this._loadDetailContact(sOrderId);
    },

    // Same source as the Master Contact column: the order's AP HeaderPartner, via a
    // filtered collection query (a key read 404s when the order has no AP partner).
    _loadDetailContact: function (sOrderId) {
      var oContactModel = this.getView().getModel("detailContact");
      var oProps = ServiceSchema.headerPartnerProperties;
      var iRequest = (this._iContactRequest || 0) + 1;
      this._iContactRequest = iRequest;
      oContactModel.setData({ name: "", tooltip: "" });
      if (!sOrderId) {
        return;
      }
      var oBinding = this.getOwnerComponent().getModel().bindList("/" + ServiceSchema.entitySets.headerPartner, undefined, undefined, [
        new Filter(oProps.salesOrder, FilterOperator.EQ, sOrderId),
        new Filter(oProps.partnerFunction, FilterOperator.EQ, ServiceSchema.contactPartnerFunction)
      ], { $select: [oProps.salesOrder, oProps.partnerFunction, oProps.fullName, oProps.contactPerson, oProps.phone, oProps.email].join(",") });
      oBinding.requestContexts(0, 1).then(function (aContexts) {
        var oContact = aContexts.length ? aContexts[0].getObject() : null;
        if (iRequest !== this._iContactRequest || !oContact) {
          return;
        }
        var sContactPerson = oContact[oProps.contactPerson];
        var sName = oContact[oProps.fullName] || (sContactPerson && sContactPerson !== "0" ? sContactPerson : "");
        oContactModel.setData({
          name: sName,
          tooltip: [sName, oContact[oProps.email], oContact[oProps.phone]].filter(Boolean).join(" \u00b7 ")
        });
      }.bind(this)).catch(function () {
        // Non-fatal: the field stays empty; the read failure is in the message model.
      }).finally(function () {
        oBinding.destroy();
      });
    },

    // Controls loaded via a section's Fragment.load carry the panel's ID as an
    // extra ID-preservation prefix (SectionFactory.js ensurePanelContent) - a
    // plain this.byId() only strips the view's own prefix, so it can never find
    // them; must go through Fragment.byId(panelId, ...) instead.
    _byIdInSection: function (sSectionId, sControlId) {
      var oPanel = this.byId(sSectionId);
      return oPanel && Fragment.byId(oPanel.getId(), sControlId);
    },

    onItemsAddMore: function () {
      var oTable = this._byIdInSection("items", "itemsTable");
      var oBinding = oTable && oTable.getBinding("items");
      if (!oBinding) {
        return;
      }
      this._addItemRows(oBinding, 10);
    },

    _addInitialCreateItemRows: function () {
      if (!this._bInitialCreateItemRowsPending) {
        return;
      }
      var oTable = this._byIdInSection("items", "itemsTable");
      var oBinding = oTable && oTable.getBinding("items");
      if (oBinding) {
        this._bInitialCreateItemRowsPending = false;
        this._addItemRows(oBinding, 10, false);
      }
    },

    _addItemsToMinimum: function (oBinding) {
      if (!oBinding || !oBinding.requestContexts) {
        return;
      }
      oBinding.requestContexts(0, 10).then(function (aContexts) {
        var oFlags = this.getView().getModel("sectionFlags");
        var oTable = this._byIdInSection("items", "itemsTable");
        var oAddMoreButton = this._byIdInSection("items", "itemsAddMoreButton");
        if (!oTable || oTable.getBinding("items") !== oBinding || !oFlags.getProperty("/items/editing") || !oAddMoreButton || !oAddMoreButton.getEnabled()) {
          return;
        }
        var iRowsToAdd = Math.max(0, 10 - aContexts.length);
        if (iRowsToAdd) {
          this._addItemRows(oBinding, iRowsToAdd);
        }
      }.bind(this)).catch(function () {});
    },

    onItemsTableUpdateFinished: function (oEvent) {
      var oTable = oEvent.getSource();
      var oViewport = this._byIdInSection("items", "itemsViewport");
      var oTableDom = oTable.getDomRef();
      if (!oViewport || !oTableDom) {
        return;
      }
      var oHeader = oTableDom.querySelector(".sapMListTblHeader");
      var iHeight = oHeader ? oHeader.getBoundingClientRect().height : 0;
      var aItems = oTable.getItems();
      aItems.slice(0, 10).forEach(function (oItem) {
        var oItemDom = oItem.getDomRef();
        if (oItemDom) {
          iHeight += oItemDom.getBoundingClientRect().height;
          var oPopinRow = oItemDom.nextElementSibling;
          if (oPopinRow && oPopinRow.classList.contains("sapMListTblSubRow")) {
            iHeight += oPopinRow.getBoundingClientRect().height;
          }
        }
      });
      var oViewportDom = oViewport.getDomRef();
      var iScrollbarHeight = oViewportDom && oViewportDom.scrollWidth > oViewportDom.clientWidth ? 16 : 0;
      if (aItems.length <= 10) {
        iHeight = oTableDom.getBoundingClientRect().height;
      }
      oViewport.setHeight(Math.ceil(iHeight + iScrollbarHeight + 8) + "px");
    },

    _addItemRows: function (oBinding, iCount, bAtEnd) {
      if (!oBinding) {
        return;
      }
      var aRows = [];
      var oProps = ServiceSchema.itemProperties;
      var bCreateMode = this.getView().getModel("sectionFlags").getProperty("/createMode");
      var bInactive = this._bItemsSessionBound || !bCreateMode;
      var iNextItemNumber = parseInt(this._computeNextItemNumber(oBinding), 10);
      for (var iIndex = 0; iIndex < iCount; iIndex += 1) {
        var oNewRowData = {};
        oNewRowData[oProps.material] = "";
        oNewRowData[oProps.quantity] = "0";
        oNewRowData[oProps.unit] = ServiceSchema.createPayloadUom;
        oNewRowData[oProps.vfcQty] = 0;
        oNewRowData[oProps.qty317] = 0;
        oNewRowData[oProps.stateQty] = 0;
        oNewRowData[oProps.chipQty] = 0;
        oNewRowData[oProps.panQty] = 0;
        oNewRowData[oProps.resQty] = 0;
        if (!this._bItemsSessionBound && bCreateMode) {
          oNewRowData[oProps.itemNumber] = ("000000" + iNextItemNumber).slice(-6);
          iNextItemNumber += 10;
        }
        aRows.push(oNewRowData);
      }
      if (bAtEnd === false && !this._bItemsSessionBound) {
        this._appendScratchRows(oBinding, aRows);
        return;
      }
      aRows.forEach(function (oRowData) {
        this._handleItemCreatePromise(oBinding.create(oRowData, false, true, bInactive));
      }, this);
    },

    // For a freshly bound list whose length isn't known yet. Rows inserted at the front of the
    // nested transient _Item list cross-wire their cells' property bindings (UI5 1.136: editing
    // one row shows its values in the other front-inserted rows), so resolve the length and append.
    _appendScratchRows: function (oBinding, aRows) {
      oBinding.requestContexts(0, 1).then(function () {
        var oTable = this._byIdInSection("items", "itemsTable");
        if (!oTable || oTable.getBinding("items") !== oBinding) {
          return;
        }
        aRows.forEach(function (oRowData) {
          this._handleItemCreatePromise(oBinding.create(oRowData, false, true));
        }, this);
      }.bind(this)).catch(function () {});
    },

    _handleItemCreatePromise: function (oContext) {
      oContext.created().catch(function (oError) {
        if (oError.canceled) {
          return;
        }
        var aSectionIds = MessageExtractor.extract(oError, oContext.getPath(), this.getResourceBundle());
        aSectionIds.forEach(function (sId) {
          this._oSectionFactory.expandSection(sId);
        }, this);
        this._openMessagePopover();
      }.bind(this));
    },

    _deleteEmptyItemRows: function (oBinding) {
      var oProps = ServiceSchema.itemProperties;
      var aContexts = oBinding && oBinding.getCurrentContexts ? oBinding.getCurrentContexts() : [];
      var aDeletes = aContexts.filter(function (oContext) {
        return oContext.isTransient && oContext.isTransient()
          && !oContext.getProperty(oProps.material)
          && !oContext.getProperty(oProps.higherLevelItem);
      }).map(function (oContext) {
        return oContext.delete();
      });
      return Promise.all(aDeletes);
    },

    // Client-side-only SD-style numbering (10, 20, 30...) for a newly-added
    // row's display - one past the highest SalesOrderItem number currently in
    // the table, defaulting to "000010" for the first item.
    _computeNextItemNumber: function (oItemsBinding) {
      var iMax = 0;
      if (oItemsBinding && oItemsBinding.getCurrentContexts) {
        oItemsBinding.getCurrentContexts().forEach(function (oCtx) {
          var iNum = parseInt(oCtx.getProperty(ServiceSchema.itemProperties.itemNumber), 10);
          if (!isNaN(iNum) && iNum > iMax) {
            iMax = iNum;
          }
        });
      }
      return ("000000" + (iMax + 10)).slice(-6);
    },

    // NDC Code VH-only Input (Items.fragment.xml, valueHelpOnly="true") - the
    // row's own context (not the header) receives the selected Product; also
    // mirrors the material description into SalesOrderItemText (ARKTX) right
    // away for immediate feedback, ahead of the batch save that would
    // otherwise be the only place the backend defaults it from the material.
    onItemNdcValueHelpRequest: function (oEvent) {
      var oInput = oEvent.getSource();
      var oBundle = this.getResourceBundle();
      var oRowContext = oInput.getBindingContext();
      this._openProductValueHelpDialog(oBundle.getText("filterNdc"), function (oItem) {
        this._applyNdcPick(oRowContext, oItem);
        this._setNdcValueState(oInput, true);
      }.bind(this));
    },

    // Shared by the Value Help dialog's confirm callback above AND the new
    // typeahead suggestionItemSelected handler below (Issue Batch 9-30-001
    // §3.4) - same raw Product row object either way.
    _applyNdcPick: function (oRowContext, oItem) {
      var oProps = ServiceSchema.productProperties;
      var sPreviousNdc = oRowContext.getProperty(ServiceSchema.itemProperties.material);
      if (sPreviousNdc && sPreviousNdc !== oItem[oProps.id]) {
        this._clearFundTypeSelection(oRowContext);
      }
      oRowContext.setProperty(ServiceSchema.itemProperties.material, oItem[oProps.id]);
      oRowContext.setProperty(ServiceSchema.itemProperties.itemText, oItem[oProps.text]);
      // Client requirement (2026-09-01): ZI_PRODUCTSTDVH_EXT - carry the NDC's
      // IndustryStandardName over to the item's own brand field.
      oRowContext.setProperty(ServiceSchema.itemProperties.brand, oItem[oProps.industryStandardName]);
      // Session Prompt (Detail View Adjustments) 3.7: carry the NDC's own
      // BaseUnit over to the item's RequestedQuantityUnit - UOM is read-only
      // again (Items.fragment.xml), always sourced from the selected
      // Product, never typed in directly.
      if (oItem[oProps.baseUnit]) {
        oRowContext.setProperty(ServiceSchema.itemProperties.unit, oItem[oProps.baseUnit]);
      }
      this._refreshFundTypeValueHelp(oRowContext);
      this._bindOrderIntentionValueHelp(this._getRowSelect(this._getRowForContext(oRowContext), ServiceSchema.itemProperties.orderIntention));
      this._checkItemRowComplete(oRowContext);
    },

    // Issue Batch 9-30-001 §3.4: NDC typeahead - filters the row's own
    // templated Input's "suggestionItems" aggregation binding (bound against
    // /Product, Items.fragment.xml), Contains on id/text, debounced per-row
    // (keyed by the row context's own path so two different rows' timers
    // never clobber each other).
    onItemNdcSuggest: function (oEvent) {
      var sValue = oEvent.getParameter("suggestValue");
      var oInput = oEvent.getSource();
      var oRowContext = oInput.getBindingContext();
      var sKey = "ndc:" + (oRowContext ? oRowContext.getPath() : "");
      this._debounce(sKey, function () {
        var oProps = ServiceSchema.productProperties;
        var oBinding = oInput.getBinding("suggestionItems");
        if (!oBinding) {
          // Live-test (9-30-001 follow-up): a declarative suggestionItems
          // aggregation nested in this row template polluted the outer
          // _Item list's own autoExpandSelect $select with "Product_Text"
          // (not a real _Item property - confirmed live 404) - bound
          // lazily here instead, well after the table's own binding is
          // already resolved, so autoExpandSelect never sees it.
          // Live-test follow-up: $select must carry the same fields
          // _applyNdcPick reads (brand/UOM), or the suggestion path silently
          // defaults Product/Product_Text only and leaves Brand/UOM unset.
          oInput.bindAggregation("suggestionItems", {
            path: "/" + ServiceSchema.entitySets.product,
            parameters: { $select: [oProps.id, oProps.text, oProps.industryStandardName, oProps.baseUnit].join(",") },
            template: new CoreListItem({ text: "{" + oProps.text + "}", additionalText: "{" + oProps.id + "}" })
          });
          oBinding = oInput.getBinding("suggestionItems");
        }
        var aFilters = [];
        if (sValue) {
          aFilters.push(new Filter({
            filters: [
              new Filter(oProps.text, FilterOperator.Contains, sValue),
              new Filter(oProps.id, FilterOperator.Contains, sValue)
            ],
            and: false
          }));
        }
        oBinding.filter(aFilters);
      });
    },

    onItemNdcSuggestionSelected: function (oEvent) {
      var oInput = oEvent.getSource();
      var oRowContext = oInput.getBindingContext();
      var oSelectedRow = oEvent.getParameter("selectedRow") || oEvent.getParameter("selectedItem");
      var oProductContext = oSelectedRow && oSelectedRow.getBindingContext();
      if (!oRowContext || !oProductContext) {
        return;
      }
      this._applyNdcPick(oRowContext, oProductContext.getObject());
      this._setNdcValueState(oInput, true);
    },

    onItemNdcChange: function (oEvent) {
      var oInput = oEvent.getSource();
      this._applyNdcValue(oInput.getBindingContext(), oInput, oEvent.getParameter("value"));
    },

    // Shared by typing (onItemNdcChange) and paste. Resolves the typed Product
    // ID before writing it; an empty value must not clear an already-selected
    // item. Resolves true only when the NDC was found and applied.
    _applyNdcValue: function (oRowContext, oInput, sRawValue) {
      var that = this;
      // Safe normalization only: trim, collapse whitespace, uppercase - the /Product lookup is the validator.
      var sValue = String(sRawValue || "").trim().replace(/\s+/g, " ").toUpperCase();
      if (!oRowContext) {
        return Promise.resolve(false);
      }
      var oProps = ServiceSchema.productProperties;
      var sPreviousNdc = oRowContext.getProperty(ServiceSchema.itemProperties.material) || "";
      if (!sValue) {
        oInput.setValue(sPreviousNdc);
        if (sPreviousNdc) {
          oInput.setValueState("Error");
          oInput.setValueStateText(this.getResourceBundle().getText("ndcCannotClear"));
        } else {
          this._setNdcValueState(oInput, true);
        }
        return Promise.resolve(false);
      }
      oInput.setValue(sValue);
      var oLookupBinding = oRowContext.getModel().bindList(
        "/" + ServiceSchema.entitySets.product, undefined, undefined,
        [new Filter(oProps.id, FilterOperator.EQ, sValue)],
        { $select: [oProps.id, oProps.text, oProps.industryStandardName, oProps.baseUnit].join(",") }
      );
      return oLookupBinding.requestContexts(0, 1).then(function (aContexts) {
        if (oInput.getValue().trim() !== sValue) {
          return false;
        }
        if (aContexts.length) {
          that._applyNdcPick(oRowContext, aContexts[0].getObject());
          oInput.setValue(aContexts[0].getProperty(oProps.id));
          that._setNdcValueState(oInput, true);
          return true;
        }
        oInput.setValue(sPreviousNdc);
        that._setNdcValueState(oInput, false);
        return false;
      }).catch(function () {
        oInput.setValue(sPreviousNdc);
        that._setNdcValueState(oInput, false);
        return false;
      });
    },

    _setNdcValueState: function (oInput, bValid) {
      oInput.setValueState(bValid ? "None" : "Error");
      oInput.setValueStateText(bValid ? "" : this.getResourceBundle().getText("ndcInvalidSelection"));
    },


    // Looks up the fund type entry (FUND_TYPES/"fundTypes" model) matching
    // the row's current MaterialGroup2 selection.
    _getFundTypeEntry: function (sFundTypeKey) {
      var aList = this.getView().getModel("fundTypes").getProperty("/list");
      return aList.filter(function (oEntry) { return oEntry.key === sFundTypeKey; })[0];
    },

    _getRowFundTypeSelect: function (oRow) {
      return this._getRowSelect(oRow, ServiceSchema.itemProperties.fundType);
    },

    // The row's Select whose selectedKey is bound to sPropertyPath.
    _getRowSelect: function (oRow, sPropertyPath) {
      return oRow && oRow.getCells().filter(function (oCell) {
        var oBinding = oCell.getBinding && oCell.getBinding("selectedKey");
        return oBinding && oBinding.getPath() === sPropertyPath;
      })[0];
    },

    _getRowForContext: function (oRowContext) {
      var oTable = this._byIdInSection("items", "itemsTable");
      var sPath = oRowContext && oRowContext.getPath();
      return oTable && oTable.getItems().filter(function (oItem) {
        var oContext = oItem.getBindingContext();
        return oContext && oContext.getPath() === sPath;
      })[0];
    },

    _getFundTypeSelectForContext: function (oRowContext) {
      return this._getRowFundTypeSelect(this._getRowForContext(oRowContext));
    },

    // Order Intention options are product-specific: bound per row to po>/OrderIntention filtered by the row's NDC.
    _bindOrderIntentionValueHelp: function (oSelect) {
      var oRowContext = oSelect && oSelect.getBindingContext();
      var oSchema = ServiceSchema.providerOrderService;
      var oProps = oSchema.orderIntentionProperties;
      if (!oRowContext) {
        return;
      }
      var sNdc = oRowContext.getProperty(ServiceSchema.itemProperties.material);
      var sFilterKey = [oRowContext.getPath(), sNdc || ""].join("|");
      if (oSelect.data("orderIntentionFilterKey") === sFilterKey) {
        return;
      }
      oSelect.data("orderIntentionFilterKey", sFilterKey);
      oSelect.unbindAggregation("items");
      if (!sNdc) {
        return;
      }
      oSelect.bindAggregation("items", {
        path: "po>/" + oSchema.entitySets.orderIntention,
        parameters: { $select: [oProps.code, oProps.text].join(",") },
        sorter: new Sorter(oProps.sortOrder),
        filters: [new Filter(oProps.ndc, FilterOperator.EQ, sNdc)],
        template: new CoreItem({
          key: "{po>" + oProps.code + "}",
          text: "{po>" + oProps.text + "}"
        })
      });
    },

    onOrderIntentionModelContextChange: function (oEvent) {
      this._bindOrderIntentionValueHelp(oEvent.getSource());
    },

    _bindFundTypeValueHelp: function (oSelect, sNdc, sOrderIntention) {
      var oRowContext = oSelect && oSelect.getBindingContext();
      var oSchema = ServiceSchema.providerOrderService;
      var oProps = oSchema.fundTypeValueHelpProperties;
      if (!oRowContext) {
        return null;
      }
      sNdc = sNdc === undefined
        ? oRowContext.getProperty(ServiceSchema.itemProperties.material)
        : sNdc;
      sOrderIntention = sOrderIntention === undefined
        ? oRowContext.getProperty(ServiceSchema.itemProperties.orderIntention)
        : sOrderIntention;
      var sFilterKey = [oRowContext.getPath(), sNdc || "", sOrderIntention || ""].join("|");
      if (oSelect.data("fundTypeFilterKey") === sFilterKey) {
        return oSelect.getBinding("items");
      }
      oSelect.data("fundTypeFilterKey", sFilterKey);
      oSelect.unbindAggregation("items");
      if (!sNdc || !sOrderIntention) {
        return null;
      }
      oSelect.bindAggregation("items", {
        path: "po>/" + oSchema.entitySets.fundTypeValueHelp,
        parameters: {
          $select: [oProps.fundType, oProps.fundTypeText].join(",")
        },
        filters: [
          new Filter(oProps.ndc, FilterOperator.EQ, sNdc),
          new Filter(oProps.orderIntention, FilterOperator.EQ, sOrderIntention)
        ],
        template: new CoreItem({
          key: "{po>" + oProps.fundType + "}",
          text: "{po>" + oProps.fundTypeText + "}"
        })
      });
      return oSelect.getBinding("items");
    },

    onFundTypeModelContextChange: function (oEvent) {
      this._bindFundTypeValueHelp(oEvent.getSource());
    },

    _refreshFundTypeValueHelp: function (oRowContext, sNdc, sOrderIntention) {
      return this._bindFundTypeValueHelp(
        this._getFundTypeSelectForContext(oRowContext),
        sNdc,
        sOrderIntention
      );
    },

    _clearFundTypeSelection: function (oRowContext) {
      if (!oRowContext || !oRowContext.getProperty(ServiceSchema.itemProperties.fundType)) {
        return [];
      }
      var aPending = [oRowContext.setProperty(ServiceSchema.itemProperties.fundType, "")];
      this.getView().getModel("fundTypes").getProperty("/list").forEach(function (oEntry) {
        if (oEntry.targetField) {
          aPending.push(oRowContext.setProperty(oEntry.targetField, 0));
        }
      });
      FundLogicService.cacheAllocation(oRowContext);
      return aPending;
    },

    onProdQtyChange: function (oEvent) {
      var oInput = oEvent.getSource();
      this._applyQtyValue(oInput.getBindingContext(), oInput, oEvent.getParameter("value"));
    },

    // Whole-number quantity > 0 as a plain integer string, or null if invalid.
    // Strips spaces and thousands separators; "100.000" is accepted as 100.
    _parseQtyValue: function (sRawValue) {
      var aMatch = /^(\d+)(?:\.0*)?$/.exec(String(sRawValue || "").replace(/[\s,]/g, ""));
      var iQty = aMatch ? parseInt(aMatch[1], 10) : NaN;
      if (!(iQty > 0) || iQty > ServiceSchema.itemFieldLimits.qtyMax) {
        return null;
      }
      return String(iQty);
    },

    // Shared by typing (onProdQtyChange) and paste. An invalid value leaves
    // the cell unchanged with a Warning and returns null; otherwise returns the
    // write promise. bDeferRefresh lets a multi-row paste refresh once at the end.
    _applyQtyValue: function (oRowContext, oInput, sRawValue, bDeferRefresh) {
      var that = this;
      var sQty = this._parseQtyValue(sRawValue);
      if (sQty === null) {
        var oValueBinding = oInput.getBinding("value");
        oInput.setValue(oValueBinding.getType().formatValue(oValueBinding.getValue(), "string"));
        this._setCellSkippedState(oInput, "pasteSkippedInvalid");
        return null;
      }
      oInput.setValueState("None");
      var bPersisted = !!(oRowContext.isTransient && !oRowContext.isTransient());
      // ZZVFCQTY/ZZ317QTY/etc. are Edm.Int32 (design/so.xml) - RequestedQuantity
      // is Edm.Decimal; sending a decimal string for an Int32 property fails
      // with "invalid value", and the Gateway's OWN error response for that
      // failure comes back malformed enough that the client can't even parse
      // it ("Error while parsing an XML stream") - always send a real integer.
      var iValue = parseInt(sQty, 10);
      // value is OneWay (Items.fragment.xml) - this is the only PATCH for
      // RequestedQuantity itself, so its promise is always the one to await.
      // RequestedQuantity is Edm.Decimal (unlike the Int32 mirrors below) -
      // must be sent as a STRING (sQty), never the iValue number, or the
      // deep-create POST fails the same malformed-XML way.
      var aPending = [];
      // A2/A4: which quantity mirror gets the value now follows the row's own
      // fundType selection (see onFundTypeChange) instead of always ZZSTATEQTY.
      var oFundType = this._getFundTypeEntry(oRowContext.getProperty(ServiceSchema.itemProperties.fundType));
      if (oFundType && oFundType.targetField) {
        aPending.push(oRowContext.setProperty(oFundType.targetField, iValue));
      }
      // Quantity is the field that can complete and activate an inactive row,
      // so write it only after its allocation mirror is already staged.
      aPending.push(oRowContext.setProperty(ServiceSchema.itemProperties.quantity, sQty));
      // Issue Batch 9-30-001 §2: snapshot the six ZZ*QTY fields right after
      // writing one of them - see FundLogicService.js's own cache comment.
      FundLogicService.cacheAllocation(oRowContext);

      this._checkItemRowComplete(oRowContext);
      // Backend recalculates BOTH this row's own quantity (e.g. 100 -> 140)
      // and any already-inserted ancillary child rows' quantities as a side
      // effect of this PATCH - only a real, already-posted row (not still a
      // local scratch row) can have such children yet.
      return Promise.all(aPending).then(function () {
        return bPersisted && !bDeferRefresh ? that._refreshItemsBinding() : undefined;
      }).catch(function (oError) {
        that._handleItemFieldUpdateError(oError, oRowContext, bPersisted);
      });
    },

    // Paste-only (ExIS typing goes through the two-way binding and its metadata type).
    // An ID cannot be shortened, so an over-long value is skipped, never truncated.
    _applyExisValue: function (oRowContext, oInput, sRawValue) {
      var iMaxLength = ServiceSchema.itemFieldLimits.exisIdMaxLength;
      var sValue = String(sRawValue || "").trim().replace(/\s+/g, " ");
      if (sValue.length > iMaxLength) {
        this._setCellSkippedState(oInput, "pasteSkippedTooLong", [iMaxLength]);
        return false;
      }
      oInput.setValueState("None");
      var bPersisted = !!(oRowContext.isTransient && !oRowContext.isTransient());
      oRowContext.setProperty(ServiceSchema.itemProperties.exisId, sValue).catch(function (oError) {
        this._handleItemFieldUpdateError(oError, oRowContext, bPersisted);
      }.bind(this));
      return true;
    },

    // Clears a paste-skip Warning once the user edits the ExIS cell (type errors use Error, not Warning).
    onItemExisChange: function (oEvent) {
      var oInput = oEvent.getSource();
      if (oInput.getValueState() === "Warning") {
        oInput.setValueState("None");
      }
    },

    _setCellSkippedState: function (oInput, sTextKey, aArgs) {
      oInput.setValueState("Warning");
      oInput.setValueStateText(this.getResourceBundle().getText(sTextKey, aArgs));
    },

    // Maps a row's paste-eligible Inputs by column key: { exisId: {input, index}, ... }.
    _getItemsPasteCells: function (oRow) {
      var mCells = {};
      oRow.getCells().forEach(function (oCell, iIndex) {
        var oBinding = oCell.isA("sap.m.Input") && oCell.getBinding("value");
        var sPath = oBinding && oBinding.getPath();
        Object.keys(PASTE_COLUMNS).forEach(function (sKey) {
          if (sPath && sPath === ServiceSchema.itemProperties[PASTE_COLUMNS[sKey]]) {
            mCells[sKey] = { input: oCell, index: iIndex };
          }
        });
      });
      return mCells;
    },

    _isPasteCellOpen: function (oInput) {
      return !!oInput && oInput.getVisible() && oInput.getEnabled() && oInput.getEditable();
    },

    // Multi-cell paste into the Items table (ExIS / NDC / Qty). Rows go down,
    // columns go right; existing open rows only, never new ones. A single value
    // is left to the browser and the cell's own change handler.
    onItemsCellPaste: function (oEvent) {
      var that = this;
      var oTable = this._byIdInSection("items", "itemsTable");
      var oInput = Element.closestTo(oEvent.target);
      var oRow = oInput && oInput.getParent();
      if (!oTable || !oRow || oRow.getParent() !== oTable) {
        return;
      }
      var mCursorCells = this._getItemsPasteCells(oRow);
      var sStartKey = Object.keys(mCursorCells).filter(function (sKey) {
        return mCursorCells[sKey].input === oInput;
      })[0];
      var oClipboard = oEvent.originalEvent && oEvent.originalEvent.clipboardData;
      if (!sStartKey || !oClipboard || !this._isPasteCellOpen(oInput)) {
        return;
      }
      var aClipRows = oClipboard.getData("text/plain").replace(/(\r\n|\r|\n)$/, "")
        .split(/\r\n|\r|\n/).map(function (sLine) { return sLine.split("\t"); });
      if (aClipRows.length === 1 && aClipRows[0].length === 1) {
        return;
      }
      oEvent.preventDefault();
      var oBundle = this.getResourceBundle();
      var aColumns = oTable.getColumns();
      var iStartIndex = mCursorCells[sStartKey].index;
      var aPlan = Object.keys(mCursorCells).filter(function (sKey) {
        var iIndex = mCursorCells[sKey].index;
        return iIndex >= iStartIndex && aColumns[iIndex] && aColumns[iIndex].getVisible();
      }).sort(function (sA, sB) {
        return mCursorCells[sA].index - mCursorCells[sB].index;
      });
      var bPlanHasNdc = aPlan.indexOf("ndcCode") !== -1;
      var aItems = oTable.getItems();
      var aTargets = [];
      for (var i = aItems.indexOf(oRow); i < aItems.length && aTargets.length < aClipRows.length; i += 1) {
        var oContext = aItems[i].getBindingContext();
        var mCells = this._getItemsPasteCells(aItems[i]);
        // Ancillary child rows and rows whose NDC is fixed are not open rows - skipped without consuming a clipboard row.
        if (!oContext || oContext.getProperty(ServiceSchema.itemProperties.higherLevelItem)
            || (bPlanHasNdc && !this._isPasteCellOpen(mCells.ndcCode && mCells.ndcCode.input))
            || !aPlan.some(function (sKey) { return mCells[sKey] && that._isPasteCellOpen(mCells[sKey].input); })) {
          continue;
        }
        aTargets.push({ item: aItems[i], context: oContext, cells: mCells });
      }
      if (!aTargets.length) {
        MessageToast.show(oBundle.getText("pasteNothing", [oBundle.getText("pasteReasonNoRows")]));
        return;
      }
      var oStartBinding = oTable.getBinding("items");
      var oStats = { rows: 0, skipped: 0, refreshes: [] };
      oTable.setBusy(true);
      aTargets.reduce(function (pChain, oTarget, iRow) {
        return pChain.then(function () {
          // A row completing mid-paste can rebind the table to the create session; stop rather than write to stale rows.
          if (oTable.getBinding("items") !== oStartBinding || oTarget.item.bIsDestroyed
              || oTarget.item.getBindingContext() !== oTarget.context) {
            return;
          }
          return that._pasteItemsRow(oTarget, aPlan, aClipRows[iRow], oStats);
        });
      }, Promise.resolve()).then(function () {
        oTable.setBusy(false);
        if (oStats.refreshes.length) {
          Promise.all(oStats.refreshes).then(function () {
            return that._refreshItemsBinding();
          });
        }
        MessageToast.show(oStats.rows
          ? oBundle.getText("pasteSummary", [oStats.rows, aClipRows.length, oStats.skipped])
          : oBundle.getText("pasteNothing", [oBundle.getText("pasteReasonInvalid")]));
      });
    },

    // Applies one clipboard row; NDC first, since a failed NDC lookup skips the row's other cells.
    _pasteItemsRow: function (oTarget, aPlan, aClipCells, oStats) {
      var that = this;
      var oContext = oTarget.context;
      var mValues = {};
      aPlan.forEach(function (sKey, iIndex) {
        mValues[sKey] = String(aClipCells[iIndex] || "").trim();
      });
      var oNdcInput = oTarget.cells.ndcCode && oTarget.cells.ndcCode.input;
      var pNdc = Promise.resolve(true);
      if (mValues.ndcCode) {
        var sNdc = mValues.ndcCode.replace(/\s+/g, " ");
        var iNdcMaxLength = ServiceSchema.itemFieldLimits.ndcMaxLength;
        if (sNdc.length > iNdcMaxLength) {
          this._setCellSkippedState(oNdcInput, "pasteSkippedTooLong", [iNdcMaxLength]);
          pNdc = Promise.resolve(false);
        } else {
          pNdc = this._applyNdcValue(oContext, oNdcInput, sNdc).then(function (bFound) {
            if (!bFound) {
              that._setCellSkippedState(oNdcInput, "pasteSkippedNdcNotFound");
            }
            return bFound;
          });
        }
      }
      return pNdc.then(function (bNdcOk) {
        var bTouched = !!mValues.ndcCode && bNdcOk;
        if (mValues.ndcCode && !bNdcOk) {
          oStats.skipped += 1;
        }
        aPlan.forEach(function (sKey) {
          var oCell = oTarget.cells[sKey];
          if (sKey === "ndcCode" || !mValues[sKey]) {
            return;
          }
          if (!bNdcOk || !oCell || !that._isPasteCellOpen(oCell.input)) {
            oStats.skipped += 1;
            return;
          }
          var bApplied;
          if (sKey === "exisId") {
            bApplied = that._applyExisValue(oContext, oCell.input, mValues[sKey]);
          } else {
            var bPersisted = !!(oContext.isTransient && !oContext.isTransient());
            var pWrite = that._applyQtyValue(oContext, oCell.input, mValues[sKey], true);
            bApplied = !!pWrite;
            if (pWrite && bPersisted) {
              oStats.refreshes.push(pWrite);
            }
          }
          oStats.skipped += bApplied ? 0 : 1;
          bTouched = bTouched || bApplied;
        });
        oStats.rows += bTouched ? 1 : 0;
      });
    },

    // Items fundType (MaterialGroup2) change - mirrors the row's current
    // RequestedQuantity onto the newly-selected fund type's own targetField
    // and clears every other fund type's targetField (only one is ever
    // active per item).
    onFundTypeChange: function (oEvent) {
      var oSelectedItem = oEvent.getParameter("selectedItem");
      var sKey = oSelectedItem ? oSelectedItem.getKey() : oEvent.getSource().getSelectedKey();
      var oRowContext = oEvent.getSource().getBindingContext();
      var bPersisted = !!(oRowContext.isTransient && !oRowContext.isTransient());
      var iQty = Math.round(parseFloat(oRowContext.getProperty(ServiceSchema.itemProperties.quantity)));
      var iValue = isNaN(iQty) ? 0 : iQty;
      var aPending = [];
      this.getView().getModel("fundTypes").getProperty("/list").forEach(function (oEntry) {
        if (oEntry.targetField) {
          aPending.push(oRowContext.setProperty(oEntry.targetField, oEntry.key === sKey ? iValue : 0));
        }
      });
      // Fund type can complete and activate an inactive row. Its mirror fields
      // must be staged before this final business-property write.
      aPending.push(oRowContext.setProperty(ServiceSchema.itemProperties.fundType, sKey));
      // Issue Batch 9-30-001 §2: same snapshot as onProdQtyChange above.
      FundLogicService.cacheAllocation(oRowContext);
      // Fund Split dialog session prompt, Trigger 1: selecting SPLIT opens the
      // allocation dialog in edit mode immediately - no
      // FundLogicService.applyFundSelection hook exists yet, wired directly here.
      // Defensive guard (Display/Edit Consistency session prompt 4.2): the Select
      // itself is only editable when /items/editing is true, so this change
      // event shouldn't be reachable otherwise - guarded anyway so the dialog
      // can never auto-open from a display-mode row.
      if (FundLogicService.isSplitFund(sKey) && this.getView().getModel("sectionFlags").getProperty("/items/editing")) {
        this._getFundSplitDialog().open(oRowContext, "edit").then(function () {
          this._checkItemRowComplete(oRowContext);
        }.bind(this));
      } else {
        this._checkItemRowComplete(oRowContext);
      }
      Promise.all(aPending).catch(function (oError) {
        this._handleItemFieldUpdateError(oError, oRowContext, bPersisted);
      }.bind(this));
    },

    _handleItemFieldUpdateError: function (oError, oRowContext, bPersisted) {
      // A transient row's created() rejection is already surfaced by
      // _onItemCreateActivate. Only independently PATCHed persisted rows need
      // extraction here; both paths still consume the property promises.
      if (!bPersisted) {
        return;
      }
      var aSectionIds = MessageExtractor.extract(oError, oRowContext.getPath(), this.getResourceBundle());
      if (this.getView().getModel("sectionFlags").getProperty("/createMode")
          && this._bItemsSessionBound && this._hasHttpStatus(oError, 404)) {
        this._revertItemsToScratch();
        if (this._oCreateSession) {
          this._oCreateSession.opened = false;
          this._oCreateSession.plainContext = null;
          this._oCreateSession.pending = null;
        }
      }
      aSectionIds.forEach(function (sId) {
        this._oSectionFactory.expandSection(sId);
      }, this);
      this._openMessagePopover();
    },

    _hasHttpStatus: function (oError, iStatus) {
      var oCurrent = oError;
      while (oCurrent) {
        if (Number(oCurrent.status || oCurrent.statusCode || oCurrent.httpStatus) === iStatus
            || String(oCurrent.message || "").indexOf(String(iStatus)) !== -1) {
          return true;
        }
        oCurrent = oCurrent.cause;
      }
      return false;
    },

    // Fund Split dialog session prompt, Trigger 2 (item Action menu): mode is
    // decided by the invoking row's current fund via FundLogicService.isSplitFund
    // - no fund literal here. The MenuItem is disabled (Items.fragment.xml) when
    // no fund is selected yet, so oRowContext always has a real fund by the time
    // this fires.
    onItemsFundSplitPress: function (oEvent) {
      var oRowContext = oEvent.getSource().getBindingContext();
      if (!oRowContext) {
        return;
      }
      var sMode = FundLogicService.isSplitFund(oRowContext) ? "edit" : "view";
      this._getFundSplitDialog().open(oRowContext, sMode);
    },

    // Single lazy-loaded FundSplitDialog instance, reused across rows/opens.
    _getFundSplitDialog: function () {
      if (!this._oFundSplitDialog) {
        this._oFundSplitDialog = new FundSplitDialog(this.getView());
      }
      return this._oFundSplitDialog;
    },

    // Order Intention (MaterialGroup1) change - disabling a now-invalid
    // core:Item in the fundType Select (formatter.fundTypeItemEnabled) never
    // by itself clears an already-selected key, so the row is left showing a
    // fund type the new Intention no longer allows; reset it here instead.
    onOrderIntentionChange: function (oEvent) {
      var sIntention = oEvent.getParameter("selectedItem").getKey();
      var oRowContext = oEvent.getSource().getBindingContext();
      var bPersisted = !!(oRowContext.isTransient && !oRowContext.isTransient());
      var sFundType = oRowContext.getProperty(ServiceSchema.itemProperties.fundType);
      var oBinding = this._refreshFundTypeValueHelp(oRowContext, undefined, sIntention);
      var pAllowed = sFundType && oBinding
        ? oBinding.requestContexts(0, 100).then(function (aContexts) {
          return aContexts.some(function (oContext) {
            return oContext.getProperty(ServiceSchema.providerOrderService.fundTypeValueHelpProperties.fundType) === sFundType;
          });
        }).catch(function () { return true; })
        : Promise.resolve(!sFundType);
      pAllowed.then(function (bAllowed) {
        var aPending = bAllowed ? [] : this._clearFundTypeSelection(oRowContext);
        // Intention can complete and activate an inactive row, so dependent
        // fund cleanup must be staged before this final write.
        aPending.push(oRowContext.setProperty(ServiceSchema.itemProperties.orderIntention, sIntention));
        this._checkItemRowComplete(oRowContext);
        return Promise.all(aPending);
      }.bind(this)).catch(function (oError) {
        this._handleItemFieldUpdateError(oError, oRowContext, bPersisted);
      }.bind(this));
    },

    // A row only "completes" (and gets posted for real) once NDC + quantity +
    // fund type + order intention are ALL set - reverted back to this after
    // live-testing an NDC-only rule raced the row's own follow-up field
    // edits against the backend (repo memory, round 23 live-test rounds
    // 2/3). Incomplete rows remain inactive because the backend accepts a
    // zero-quantity create without durably persisting it, causing later 404s.
    _isScratchRowComplete: function (oRowContext) {
      var oProps = ServiceSchema.itemProperties;
      var fQty = parseFloat(oRowContext.getProperty(oProps.quantity));
      return !!oRowContext.getProperty(oProps.material)
        && !isNaN(fQty) && fQty > 0
        && !!oRowContext.getProperty(oProps.fundType)
        && !!oRowContext.getProperty(oProps.orderIntention);
    },

    // bInactive create() (_addItemRows, post-session-bound branch) only
    // defers the row's FIRST edit - without this handler it would activate
    // (and auto-POST via $auto) after just one field, still missing the
    // other 3 mandatory ones. Keep re-deferring (preventDefault) on every
    // edit until the row is genuinely complete, then let it through so it
    // activates and submits itself normally.
    _onItemCreateActivate: function (oEvent) {
      var oRowContext = oEvent.getParameter("context");
      if (!this._isScratchRowComplete(oRowContext)) {
        oEvent.preventDefault();
        return;
      }
      // Row 1 gets a free full-list refresh from _bindItemsTableToSession's
      // rebindItems() (which is how it happens to pick up any ancillary
      // child row the backend injects alongside it) - row 2+ never rebinds,
      // so the model's own automatic post-create GET only ever re-fetches
      // THIS row; without an explicit refresh here, a same-POST ancillary
      // child added by the server stays invisible until some unrelated
      // refresh (e.g. the opt-out toggle) happens to occur.
      //
      // Live-test round 19/19b-e: tried an explicit bound UpdatePrices call
      // (both item- and header-bound overloads, so.xml ~2178/~2257) to fix
      // NetAmount staying "0.00" for item 2+. Item-bound: executes (204) but
      // never reprices. Header-bound: needed an ETag prefetch to get past a
      // 428, but once it actually ran it was confirmed (round 20) to reprice
      // the WHOLE document server-side - which re-runs ancillary
      // determination for EVERY item, silently reinstating/reclassifying a
      // mandatory ancillary on items that had already been successfully
      // opted-out, breaking the round-13 delete flow for unrelated items.
      // Reverted to the safe round-17 baseline (refresh only, no pricing
      // action) - NetAmount=0 for item 2+ is BLOCKED-BY-BACKEND again (see
      // round 19c conclusion) and must not be "fixed" with a document-level
      // repricing call again without also re-verifying every other item's
      // ancillary/opt-out state afterward.
      var that = this;
      var oBundle = this.getResourceBundle();
      oRowContext.created()
        .then(function () {
          // Issue Batch 9-30-001 \u00a72: the create response itself always
          // reads the six ZZ*QTY fields back as 0 (backend read-path defect,
          // see FundLogicService.js) - restore this row's own last-written
          // values before the refresh below re-renders it.
          return FundLogicService.reapplyAllocation(oRowContext);
        })
        .then(function () { return that._refreshItemsBinding(); })
        .catch(function (oError) {
          // Surface the real backend message (SAP__Messages) the same way
          // every other item failure does, instead of only console-logging -
          // "Operation is not enabled"-class errors need their full message
          // text/target to diagnose, not just this generic wrapper.
          var aSectionIds = MessageExtractor.extract(oError, oRowContext.getPath(), oBundle);
          aSectionIds.forEach(function (sId) {
            that._oSectionFactory.expandSection(sId);
          });
          that._openMessagePopover();
        });
    },

    // Entry point called from every field-change handler above. Only ever
    // acts on a still-transient (local scratch, never-submitted "vrCreate")
    // row - a real row (already posted, isTransient() false) is already live
    // against the backend, so an ordinary setProperty() above already PATCHed
    // it under the session's own $auto group; nothing extra to do here.
    _checkItemRowComplete: function (oRowContext) {
      if (!this.getView().getModel("sectionFlags").getProperty("/createMode")) {
        return;
      }
      if (!oRowContext || !oRowContext.isTransient || !oRowContext.isTransient()) {
        return;
      }
      if (!this._isScratchRowComplete(oRowContext)) {
        return;
      }
      this._postFirstItemRow(oRowContext);
    },

    // Opens the sticky session (if not already open) and posts this ONE
    // completed scratch row straight into it (CreateOrderService.postItem),
    // then performs the one-time switch of the Items table's own binding
    // source from the local scratch list to the real session's `_Item` list
    // (_bindItemsTableToSession) - re-entrant-safe via _bPostingFirstItem
    // (a second row completing while the first is still in flight waits;
    // _bItemsSessionBound already true short-circuits entirely).
    _postFirstItemRow: function (oRowContext) {
      if (this._bItemsSessionBound || this._bPostingFirstItem) {
        return;
      }
      this._bPostingFirstItem = true;
      this._aPendingIncompleteRows = this._aPendingIncompleteRows || [];
      var that = this;
      var oBundle = this.getResourceBundle();
      var oTable = this._byIdInSection("items", "itemsTable");
      var oOldItemsBinding = oTable && oTable.getBinding("items");
      var oHeaderContext = this.getView().getBindingContext();
      if (oTable) {
        oTable.setBusy(true);
      }
      // Issue Batch 9-30-001 \u00a72: this row's own path is about to change
      // (scratch context -> the real posted item's own context) - snapshot
      // its six ZZ*QTY fields under the OLD path now, so they can be
      // transferred onto the NEW context below (the create response itself
      // always reads them back as 0 - see FundLogicService.js).
      var oAllocationSnapshot = FundLogicService.getSnapshot(oRowContext);
      CreateOrderService.postItem(this._oCreateSession, oHeaderContext, oRowContext.getObject())
        .then(function (oNewItemContext) {
          oRowContext.delete().catch(function () {});
          if (oAllocationSnapshot) {
            FundLogicService.transferSnapshot(oNewItemContext, oAllocationSnapshot);
          }
          return that._migrateRemainingScratchRows(oOldItemsBinding, oRowContext);
        })
        .then(function () {
          // Live-test bug: setBusy(false) below used to fire the instant this
          // resolved, re-enabling the row's Qty/Fund/Intention inputs before
          // the real list's own confirming GET (dataReceived) had actually
          // completed - a fast edit right after NDC-pick could PATCH a
          // SalesOrderItem key the backend hadn't fully settled yet (404).
          // Must await that same GET, not just the table rebind call itself.
          return that._bindItemsTableToSession();
        }, function (oError) {
          var aSectionIds = MessageExtractor.extract(oError, oHeaderContext.getPath(), oBundle);
          aSectionIds.forEach(function (sId) {
            that._oSectionFactory.expandSection(sId);
          });
          that._openMessagePopover();
        })
        .then(function () {
          that._bPostingFirstItem = false;
          if (oTable) {
            oTable.setBusy(false);
          }
        });
    },

    // Any OTHER scratch rows that were also already complete at the moment
    // the first one posted get posted too (sequentially, so _ensureSession's
    // own re-entrancy guard never races); any that were still incomplete
    // have no valid server-postable data yet, but must NOT be silently lost
    // (live-tested bug: a partially-filled row disappeared the moment ANY
    // other row completed and triggered this migrate cycle) - their current
    // field values are stashed on this._aPendingIncompleteRows and recreated
    // as new inactive rows on the real session list once
    // _bindItemsTableToSession switches the table over (see
    // _recreatePendingIncompleteRows), so the user can keep completing them.
    _migrateRemainingScratchRows: function (oOldItemsBinding, oAlreadyPostedContext) {
      var that = this;
      var oHeaderContext = this.getView().getBindingContext();
      var aContexts = (oOldItemsBinding && oOldItemsBinding.getCurrentContexts) ? oOldItemsBinding.getCurrentContexts() : [];
      var aOthers = aContexts.filter(function (oCtx) {
        return oCtx !== oAlreadyPostedContext && oCtx.isTransient && oCtx.isTransient();
      });
      return aOthers.reduce(function (pChain, oCtx) {
        return pChain.then(function () {
          if (that._isScratchRowComplete(oCtx)) {
            return CreateOrderService.postItem(that._oCreateSession, oHeaderContext, oCtx.getObject()).then(function () {
              oCtx.delete().catch(function () {});
            });
          }
          var oPendingData = Object.assign({}, oCtx.getObject());
          // Client-only scratch numbering (_computeNextItemNumber) - the real
          // session list assigns its own key, never reuse this placeholder.
          delete oPendingData.SalesOrderItem;
          that._aPendingIncompleteRows.push(oPendingData);
          return oCtx.delete().catch(function () {});
        });
      }, Promise.resolve());
    },

    // The one-time switch (§3.1): the Items table's own `items="{_Item}"`
    // aggregation now resolves against the real sticky session's plain
    // context instead of the local scratch header context, under the
    // session's own interactive group (ServiceSchema.itemInteractiveGroup) -
    // every already-posted row, any server-auto-inserted ancillary children
    // (HigherLevelItem), and any further edit all now show/PATCH as real,
    // immediate server truth (matches the observed opt-out traces).
    _bindItemsTableToSession: function () {
      var oTable = this._byIdInSection("items", "itemsTable");
      if (!oTable || !this._oCreateSession || !this._oCreateSession.plainContext) {
        return Promise.resolve();
      }
      oTable.setBindingContext(this._oCreateSession.plainContext);
      this._sItemsUpdateGroup = ServiceSchema.itemInteractiveGroup;
      this._rebindItemsGroup(this._sItemsUpdateGroup);
      this._bItemsSessionBound = true;
      // The rebind's own GET is still async here - computing childParents
      // synchronously would run off the OLD (scratch/empty) contexts and
      // never get another chance to recompute; wait for the real fetch.
      // Recreating pending rows (bAtEnd:true) also needs to wait for this
      // same GET - creating at the end throws "Must know the final length"
      // until the binding's real length is known (confirmed live). Callers
      // (_postFirstItemRow) also rely on the returned promise to know the
      // newly-posted row's own key is now backend-confirmed before letting
      // the user edit it further (live-tested 404 race).
      var oBinding = oTable.getBinding("items");
      if (!oBinding) {
        this._recreatePendingIncompleteRows(oBinding);
        return Promise.resolve();
      }
      var that = this;
      return new Promise(function (resolve) {
        oBinding.attachEventOnce("dataReceived", function () {
          that._computeAncillaryParents();
          that._reapplyFundAllocations(oBinding);
          that._recreatePendingIncompleteRows(oBinding);
          resolve();
        });
      });
    },

    // Re-creates any scratch rows stashed by _migrateRemainingScratchRows
    // (still incomplete when another row's completion triggered the switch
    // to the real session list) as new inactive rows on that same list -
    // same bInactive create() _addItemRows uses for later rows, so the
    // user's partial entry (NDC/quantity/etc.) survives and can still be
    // completed normally.
    _recreatePendingIncompleteRows: function (oBinding) {
      var aPending = this._aPendingIncompleteRows;
      this._aPendingIncompleteRows = [];
      if (!oBinding || !aPending.length) {
        return;
      }
      aPending.forEach(function (oRowData) {
        // Edm.Decimal values must remain strings.
        oRowData.RequestedQuantity = oRowData.RequestedQuantity || "0";
        this._handleItemCreatePromise(oBinding.create(oRowData, false, true, true));
      }, this);
    },

    // Issue Batch 9-30-001 §5 follow-up (live evidence, 2026-09-30): once
    // CreateOrderService.js always DiscardChanges'es a failed SaveChanges's
    // session, the Items table is still bound to that now-dead session's
    // context (_bindItemsTableToSession switched it there earlier) - any
    // further inline edit (the user correcting their mistake) live-PATCHes
    // a session that no longer exists server-side (404). Unwinds the table
    // back to fresh LOCAL scratch rows (the same deferred, never-submitted
    // group the pre-session table used) seeded with each row's current
    // data, so editing continues safely until the next Save opens a
    // brand-new session and replays them. No-op if items were never
    // actually switched to a session in the first place.
    _revertItemsToScratch: function () {
      if (!this._bItemsSessionBound) {
        return;
      }
      var oTable = this._byIdInSection("items", "itemsTable");
      var oOldBinding = oTable && oTable.getBinding("items");
      var aRowData = (oOldBinding && oOldBinding.getCurrentContexts ? oOldBinding.getCurrentContexts() : [])
        .map(function (oCtx) { return CreateOrderService.cleanItemPayload(oCtx.getObject() || {}); })
        .concat(this._aPendingIncompleteRows || []);
      this._aPendingIncompleteRows = [];
      this._bItemsSessionBound = false;
      this._bPostingFirstItem = false;
      if (!oTable) {
        return;
      }
      oTable.setBindingContext(this.getView().getBindingContext());
      this._sItemsUpdateGroup = ServiceSchema.createUpdateGroup;
      this._rebindItemsGroup(this._sItemsUpdateGroup);
      var oNewBinding = oTable.getBinding("items");
      if (oNewBinding) {
        aRowData.forEach(function (oRowData, iIndex) {
          oRowData.RequestedQuantity = oRowData.RequestedQuantity || "0";
          oRowData.SalesOrderItem = ("000000" + ((iIndex + 1) * 10)).slice(-6);
        });
        this._appendScratchRows(oNewBinding, aRowData);
      }
      FundLogicService.clearAllocationCache();
    },

    _resetItemsTableForCreate: function () {
      var oItemsMeta = this.getView().getModel("itemsMeta");
      oItemsMeta.setProperty("/childParents", {});

      var oTable = this._byIdInSection("items", "itemsTable");
      if (!oTable) {
        return;
      }
      oTable.setBindingContext(this.getView().getBindingContext());
      this._sItemsUpdateGroup = ServiceSchema.createUpdateGroup;
      this._rebindItemsGroup(this._sItemsUpdateGroup);
    },

    // Re-derives the {"<parentItemNumber>": true} childParents map (itemsMeta
    // model) off the Items table's CURRENT contexts - called after every real-
    // list (re)bind/refresh, never cached/guessed from the SKIPANC marker (see
    // ServiceSchema.js#skipAncMarker doc comment on why that field is unsafe
    // to use for this).
    _computeAncillaryParents: function () {
      var oTable = this._byIdInSection("items", "itemsTable");
      var oBinding = oTable && oTable.getBinding("items");
      var aContexts = (oBinding && oBinding.getCurrentContexts) ? oBinding.getCurrentContexts() : [];
      var oParents = {};
      aContexts.forEach(function (oCtx) {
        var sParent = oCtx.getProperty(ServiceSchema.itemProperties.higherLevelItem);
        if (sParent) {
          oParents[sParent] = true;
        }
      });
      this.getView().getModel("itemsMeta").setProperty("/childParents", oParents);
    },

    // A full items-list refresh (server-truth only, NEVER optimistic) after
    // an opt-out toggle - re-derives childParents once the refresh settles,
    // since check/uncheck is exactly what adds/removes ancillary child rows.
    _refreshItemsBinding: function () {
      var oTable = this._byIdInSection("items", "itemsTable");
      var oBinding = oTable && oTable.getBinding("items");
      if (!oBinding) {
        return Promise.resolve();
      }
      var that = this;
      return new Promise(function (resolve) {
        oBinding.attachEventOnce("dataReceived", function () {
          that._computeAncillaryParents();
          that._reapplyFundAllocations(oBinding);
          resolve();
        });
        oBinding.refresh();
      });
    },

    // Issue Batch 9-30-001 §2: re-applies every current row's own cached
    // ZZ*QTY snapshot (no-op for rows nothing was ever cached for) - called
    // after every full items-list (re)fetch, since any such GET response
    // always reads these six fields back as 0 (see FundLogicService.js).
    _reapplyFundAllocations: function (oBinding) {
      var aContexts = (oBinding && oBinding.getCurrentContexts) ? oBinding.getCurrentContexts() : [];
      aContexts.forEach(function (oCtx) {
        FundLogicService.reapplyAllocation(oCtx);
      });
    },

    // §3.3: the Opt-Out checkbox (Items.fragment.xml) - PATCHes the REAL flag
    // (ZZ1_SKIPADDANC_SDI, NOT the unused ZZ1_OptOutAncillary_SDI, see
    // ServiceSchema.js) on the parent row, then triggers ONE full items-list
    // refresh to pick up whatever the server-side ancillary determination
    // actually did (add/remove a child row with a brand-new item number) -
    // never optimistic, the checkbox itself always reflects post-refresh
    // server state.
    onItemOptOutChange: function (oEvent) {
      var that = this;
      var oBundle = this.getResourceBundle();
      var bChecked = oEvent.getParameter("selected");
      var oRowContext = oEvent.getSource().getBindingContext();
      if (!oRowContext) {
        return;
      }
      var oTable = this._byIdInSection("items", "itemsTable");
      if (oTable) {
        oTable.setBusy(true);
      }
      // setProperty() on the "$auto" itemInteractiveGroup fires its PATCH
      // asynchronously - must await ITS OWN promise (resolves once the PATCH
      // round-trips) before refreshing, or the refresh races the still-
      // in-flight PATCH and the model rejects with "Cannot refresh due to
      // pending change".
      oRowContext.setProperty(ServiceSchema.itemProperties.skipAddAncillary, bChecked)
        .then(function () {
          return that._refreshItemsBinding();
        })
        .catch(function (oError) {
          var aSectionIds = MessageExtractor.extract(oError, oRowContext.getPath(), oBundle);
          aSectionIds.forEach(function (sId) {
            that._oSectionFactory.expandSection(sId);
          });
          that._openMessagePopover();
        })
        .then(function () {
          if (oTable) {
            oTable.setBusy(false);
          }
        });
    },

    // DF-1025: SalesDocumentRjcnReason is Core.Computed, so the Select's OneWay binding
    // never writes - a pick invokes SetRejectionReason, clearing invokes
    // RemoveRejectionReason (bound item actions, no return context), then a full
    // items refresh so the row shows server state only. On failure the Select reverts.
    onItemRejectionReasonChange: function (oEvent) {
      var that = this;
      var oBundle = this.getResourceBundle();
      var oSelect = oEvent.getSource();
      var oRowContext = oSelect.getBindingContext();
      if (!oRowContext) {
        return;
      }
      var oSelectedItem = oEvent.getParameter("selectedItem");
      var sKey = oSelectedItem ? oSelectedItem.getKey() : "";
      var oActions = ServiceSchema.itemActions;
      var oAction = oRowContext.getModel().bindContext(
        (sKey ? oActions.setRejectionReason : oActions.removeRejectionReason) + "(...)", oRowContext);
      if (sKey) {
        oAction.setParameter(oActions.setRejectionReasonParameter, sKey);
      }
      var oRow = oSelect.getParent();
      oRow.setBusy(true);
      function syncFromServer() {
        var oCtx = oSelect.getBindingContext();
        oSelect.setSelectedKey((oCtx && oCtx.getProperty(ServiceSchema.itemProperties.rejectionReason)) || "");
      }
      oAction.invoke(ServiceSchema.itemInteractiveGroup)
        .then(function () {
          return that._refreshItemsBinding();
        })
        .catch(function (oError) {
          var aSectionIds = MessageExtractor.extract(oError, oRowContext.getPath(), oBundle);
          aSectionIds.forEach(function (sId) {
            that._oSectionFactory.expandSection(sId);
          });
          that._openMessagePopover();
        })
        .then(function () {
          if (oSelect.isDestroyed()) {
            return;
          }
          syncFromServer();
          oRow.setBusy(false);
        });
    },

    // Item Details view session prompt, 3.4: Items row Action menu "Edit" ->
    // FCL end column, always full screen (session prompt 3.1). Row context
    // supplies the SalesOrder/SalesOrderItem keys for the new route.
    // Display/Edit Consistency session prompt 4.3: mode=edit is mode
    // plumbing only - ItemDetail's own editable fields are a later task.
    onItemsEditPress: function (oEvent) {
      var oRowContext = oEvent.getSource().getBindingContext();
      if (!oRowContext) {
        return;
      }
      var sOrderId = oRowContext.getProperty(ServiceSchema.keys.orderId);
      var sItemNumber = oRowContext.getProperty(ServiceSchema.itemProperties.itemNumber);
      if (!sOrderId || !sItemNumber) {
        return;
      }
      this._oRouter.navTo("itemDetail", {
        orderId: encodeURIComponent(sOrderId),
        itemPath: encodeURIComponent(sItemNumber),
        "?query": { mode: "edit" }
      });
    },

    // Display/Edit Consistency session prompt 4.4: Item Number Link, navigates
    // independently of /items/editing (works from both display and edit) -
    // always mode=display, ItemDetail's natural built (read-only) state. A
    // child (ancillary) row's link still navigates to its own read-only detail.
    onItemNumberPress: function (oEvent) {
      var oRowContext = oEvent.getSource().getBindingContext();
      if (!oRowContext) {
        return;
      }
      var sOrderId = oRowContext.getProperty(ServiceSchema.keys.orderId);
      var sItemNumber = oRowContext.getProperty(ServiceSchema.itemProperties.itemNumber);
      if (!sOrderId || !sItemNumber) {
        return;
      }
      this._oRouter.navTo("itemDetail", {
        orderId: encodeURIComponent(sOrderId),
        itemPath: encodeURIComponent(sItemNumber),
        "?query": { mode: "display" }
      });
    },

    // Real, batched DELETE on the row's own bound-entity context - rides the
    // same update group as the rest of the Items section's edit session
    // (change-mode "vrEdit" or createMode "vrCreate", see _rebindItemsGroup),
    // so it is only sent when that section's Save actually runs.
    onItemsDeleteRow: function (oEvent) {
      var that = this;
      var oBundle = this.getResourceBundle();
      var oRowContext = oEvent.getSource().getBindingContext();
      if (!oRowContext) {
        return;
      }
      MessageBox.confirm(oBundle.getText("itemsDeleteConfirm"), {
        onClose: function (sAction) {
          if (sAction !== MessageBox.Action.OK) {
            return;
          }
          var oTable = that._byIdInSection("items", "itemsTable");
          if (oTable) {
            oTable.setBusy(true);
          }
          // A direct DELETE on an ancillary child's own row is rejected by
          // the backend (confirmed live, both mandatory AND optional - see
          // design/prompts/E008_Ancillary_Session_Prompt.md §3.4). The only
          // server-sanctioned way to shed a parent's OPTIONAL children is the
          // opt-out PATCH (§3.3); do that first (when this row has children),
          // refresh, then delete the row itself - whatever ancillary rows
          // still remain are the backend's own to reconcile when the parent
          // line goes, not ours to delete client-side.
          var bReleasesNdcAddGate = that._ownsNdcAddGate(oRowContext);
          var sItemNumber = oRowContext.getProperty(ServiceSchema.itemProperties.itemNumber);
          var bHasChildren = that._getAncillaryChildContexts(sItemNumber).length > 0;
          var pChain = bHasChildren
            ? oRowContext.setProperty(ServiceSchema.itemProperties.skipAddAncillary, true)
              .then(function () {
                return that._refreshItemsBinding();
              })
              .then(function () {
                // Confirmed live (batch trace): the backend unconditionally
                // 400s deleting a parent that still has a MANDATORY
                // ancillary child attached - opt-out only sheds the
                // optional one(s). Don't even attempt that doomed DELETE;
                // it always comes back as an opaque "Unspecified provider
                // error" with no usable detail - tell the user why instead.
                if (that._getAncillaryChildContexts(sItemNumber).length > 0) {
                  return Promise.reject({ mandatoryAncillaryBlock: true });
                }
                return oRowContext.delete();
              })
            : oRowContext.delete();
          pChain
            .then(function () {
              if (bReleasesNdcAddGate) {
                that._releaseNdcAddGate();
              }
              MessageToast.show(oBundle.getText("itemsDeleteSuccess"));
            })
            .catch(function (oError) {
              if (oError && oError.mandatoryAncillaryBlock) {
                MessageToast.show(oBundle.getText("itemsDeleteBlockedByMandatoryAncillary"));
                return;
              }
              var aSectionIds = MessageExtractor.extract(oError, oRowContext.getPath(), oBundle);
              aSectionIds.forEach(function (sId) {
                that._oSectionFactory.expandSection(sId);
              });
              that._openMessagePopover();
            })
            .then(function () {
              if (oTable) {
                oTable.setBusy(false);
              }
            });
        }
      });
    },

    // Ancillary child rows (HigherLevelItem === the parent's own item number)
    // that must be deleted alongside a primary item being deleted.
    _getAncillaryChildContexts: function (sParentItemNumber) {
      var oTable = this._byIdInSection("items", "itemsTable");
      var oBinding = oTable && oTable.getBinding("items");
      var aContexts = (oBinding && oBinding.getCurrentContexts) ? oBinding.getCurrentContexts() : [];
      return aContexts.filter(function (oCtx) {
        return sParentItemNumber && oCtx.getProperty(ServiceSchema.itemProperties.higherLevelItem) === sParentItemNumber;
      });
    },


    _endEditSession: function (sSectionId) {
      var oFlags = this.getView().getModel("sectionFlags");
      oFlags.setProperty("/" + sSectionId + "/editing", false);
      this._aSectionMeta.forEach(function (oMeta) {
        if (oMeta.editLive) {
          oFlags.setProperty("/" + oMeta.id + "/editEnabled", true);
        }
      });
    },

    _showConflictDialog: function (oContext, sSectionId) {
      var that = this;
      var oBundle = this.getResourceBundle();
      MessageBox.warning(oBundle.getText("editConflictReload"), {
        actions: [MessageBox.Action.OK],
        onClose: function () {
          oContext.refresh();
          that._endEditSession(sSectionId);
        }
      });
    },

    // --- CRUD Task 1 v3 (In-Place Create, design/prompts/CRUD Task 1 Prompt
    // v3.md, ADDENDUM-001): the Create dialog is removed \u2014 creation happens
    // in-place on the "create" route (_onCreateMatched above). Global Save/
    // Cancel live on the DynamicPage title (Detail.view.xml); no per-section
    // Save/Cancel while createMode is on (SectionFactory.js). ---

    // Sections that force their `editing` flag on for the duration of
    // createMode (so their existing editing-toggled Inputs/ComboBoxes show
    // with zero fragment changes) \u2014 the same four sections already wired
    // `editLive` for CRUD Task 2. IoH/Parties Involved/Attachments read
    // `sectionFlags>/createMode` directly instead (no per-section edit session).
    _aCreateModeEditingSections: ["details", "items", "shipping", "orgData"],

    _setCreateMode: function (bOn) {
      var oFlags = this.getView().getModel("sectionFlags");
      oFlags.setProperty("/createMode", bOn);
      this._resetProviderInventoryState();
      // v5 (design/E008_CRUD1_v5_Sticky_Amendment.md): all createMode
      // sections are editable immediately — there is no separate
      // "bootstrapped" state anymore (the scratch context from _onCreateMatched
      // is already a real, if transient, binding target for every fragment).
      this._aCreateModeEditingSections.forEach(function (sId) {
        oFlags.setProperty("/" + sId + "/editing", bOn);
      });
      if (bOn) {
        var aCreateStatusOptions = OrderModeConfig.resolveOrderType(this._sCreateOrderType).createStatusOptions;
        this.getView().getModel("enums").setProperty("/STATUS",
          this._resolveEnumOptions(aCreateStatusOptions.length ? aCreateStatusOptions : Enums.STATUS));
        this.getView().getModel("createEnrich").setData(this._createEnrichDefaults());
        this.getView().getModel("shippingEdit").setData({ providerName: "", addresses: [], createAddressKey: "", busy: false });
        this.getView().getModel("createState").setProperty("/providerChosen", false);
        this.getView().getModel("createState").setProperty("/deliveryStatusText", "");
        this.getView().getModel("createState").setProperty("/deliveryBlockStatusText", "");
        this._lookupCreateModeStatusTexts();
        this.getView().getModel("headerCalc").setProperty("/taxAmount", 0);
      }
    },

    // Delivery Status/Delivery Block Status createMode defaults (client
    // requirement 2026-10-01): looks each default code up directly against
    // its own top-level codelist entity set (ServiceSchema.entitySets.
    // deliveryStatus/deliveryBlockStatus) - NOT via the header's own
    // _OverallDeliveryStatus/_OverallDeliveryBlockStatus navigation, which
    // cannot resolve against the transient createMode scratch context (no
    // backend contact happens for it until Save, see CreateOrderService.js#
    // enter) - same exact-match lookup shape as onItemNdcChange/
    // onProviderChange above.
    _lookupCreateModeStatusTexts: function () {
      var that = this;
      var oModel = this.getView().getModel();
      function lookup(sEntitySet, sKeyProperty, sKeyValue) {
        var oBinding = oModel.bindList(
          "/" + sEntitySet, undefined, undefined,
          [new Filter(sKeyProperty, FilterOperator.EQ, sKeyValue)],
          { $select: [sKeyProperty, sKeyProperty + "_Text"].join(",") }
        );
        return oBinding.requestContexts(0, 1).then(function (aContexts) {
          return aContexts.length ? aContexts[0].getObject()[sKeyProperty + "_Text"] : "";
        });
      }
      lookup(ServiceSchema.entitySets.deliveryStatus, ServiceSchema.headerProperties.deliveryStatus, ServiceSchema.defaultDeliveryStatus)
        .then(function (sText) {
          that.getView().getModel("createState").setProperty("/deliveryStatusText", sText);
        }).catch(function () {});
      lookup(ServiceSchema.entitySets.deliveryBlockStatus, ServiceSchema.headerProperties.deliveryBlockStatus, ServiceSchema.defaultDeliveryBlockStatus)
        .then(function (sText) {
          that.getView().getModel("createState").setProperty("/deliveryBlockStatusText", sText);
        }).catch(function () {});
    },

    // Resolves Enums.js's {key, i18nKey} lists into {key, text} once, so the
    // createMode Selects (Status only - Priority/Category are now backed by
    // real service value helps, see Details.fragment.xml) can bind items/text
    // directly without a runtime i18n lookup in the XML.
    _createEnumsModel: function () {
      return new JSONModel({
        STATUS: this._resolveEnumOptions(Enums.STATUS),
        EDIT_STATUS: this._resolveEnumOptions(Enums.EDIT_STATUS)
      });
    },

    _resolveEnumOptions: function (aOptions) {
      var oBundle = this.getResourceBundle();
      return aOptions.map(function (oEntry) {
        return { key: oEntry.key, text: oBundle.getText(oEntry.i18nKey) };
      });
    },

    // Resolves FUND_TYPES (module constant above) into the "fundTypes" model
    // Items.fragment.xml's MaterialGroup2 Select binds items/change against -
    // targetFieldKey is resolved here to the real property name
    // (ServiceSchema.itemProperties) so onFundTypeChange/onProdQtyChange/
    // _addItemRows never hand-maintain a second copy of that mapping.
    _createFundTypesModel: function () {
      var oBundle = this.getResourceBundle();
      return new JSONModel({
        list: FUND_TYPES.map(function (oEntry) {
          return {
            key: oEntry.key,
            text: oBundle.getText(oEntry.i18nKey),
            targetField: oEntry.targetFieldKey ? ServiceSchema.itemProperties[oEntry.targetFieldKey] : "",
            pediatricOnly: !!oEntry.pediatricOnly,
            disabled: !!oEntry.disabled
          };
        })
      });
    },

    // Defaults for the "createEnrich" local-only model - Employee Responsible
    // defaults to the current logged-in user (sap.ushell.Container UserInfo
    // service); the display value is the full name (falls back to the user ID
    // if the ushell doesn't expose one, e.g. standalone/mock server runs).
    _createEnrichDefaults: function () {
      return {
        providerName: "",
        providerAddress: "",
        providerAddressId: "",
        contactId: "",
        contactName: "",
        employeeResponsibleId: this._getCurrentUserId(),
        employeeResponsibleName: this._getCurrentUserFullName(),
        status: OrderModeConfig.resolveOrderType(this._sCreateOrderType).createStatusDefault,
        shipToPartyId: "",
        shipToPartyName: "",
        notes: "",
        notesOriginal: ""
      };
    },

    _getCurrentUserId: function () {
      try {
        if (sap.ushell && sap.ushell.Container) {
          return sap.ushell.Container.getService("UserInfo").getId() || "";
        }
      } catch (oError) {
        // ushell not available (standalone/mock server run) - leave blank.
      }
      return "";
    },

    _getCurrentUserFullName: function () {
      try {
        if (sap.ushell && sap.ushell.Container) {
          var oUserInfo = sap.ushell.Container.getService("UserInfo");
          return oUserInfo.getFullName() || oUserInfo.getId() || "";
        }
      } catch (oError) {
        // ushell not available (standalone/mock server run) - leave blank.
      }
      return "";
    },

    // Generic hardcoded-data picker (Contact/Employee Responsible only) - no
    // real F4 service is wired for either yet.
    _openPickerDialog: function (sTitle, aItems, fnApply) {
      var oDialog = new SelectDialog({
        title: sTitle,
        items: {
          path: "/items",
          template: new StandardListItem({ title: "{name}", description: "{id}" })
        },
        confirm: function (oEvent) {
          var oSelectedItem = oEvent.getParameter("selectedItem");
          if (oSelectedItem) {
            fnApply(oSelectedItem.getBindingContext().getObject());
          }
          oDialog.destroy();
        },
        cancel: function () {
          oDialog.destroy();
        }
      });
      oDialog.setModel(new JSONModel({ items: aItems }));
      this.getView().addDependent(oDialog);
      oDialog.open();
    },

    // v5 ("UX phasing + triad sourcing"): Provider VH backed by the real,
    // top-level `/CustomerSalesArea` entity set - keyed by Customer +
    // SalesOrganization + DistributionChannel + Division (design/so.xml
    // ~line 1131), the same KNVV-shaped row this service's own SoldToParty
    // ValueListReferences point at. No longer filtered down to the fixed
    // salesArea triplet - only soft pre-filtered by SalesOrganization, so a
    // customer extended to multiple distribution channels/divisions within
    // that sales org surfaces as multiple, disambiguated rows (area triad
    // shown as the list item's `info`); the picked row's own triad becomes
    // the real CreateWithSalesOrderType params (see
    // Detail.controller.js#onProviderValueHelpRequest / CreateOrderService.js#save).
    _openShipToPartyValueHelpDialog: function (sTitle, fnApply) {
      var oProps = ServiceSchema.customerSalesAreaProperties;
      var oArea = ServiceSchema.salesArea;
      var aAreaFilters = [
        new Filter(oProps.salesOrganization, FilterOperator.EQ, oArea.salesOrganization)
      ];
      var oDialog = new SelectDialog({
        title: sTitle,
        growing: true,
        items: {
          path: "/" + ServiceSchema.entitySets.customerSalesArea,
          parameters: {
            $select: [oProps.customer, oProps.customerName, oProps.cityName, oProps.postalCode, oProps.countryText,
              oProps.salesOrganization, oProps.distributionChannel, oProps.division].join(",")
          },
          filters: aAreaFilters,
          template: new StandardListItem({
            title: "{" + oProps.customerName + "}",
            description: "{" + oProps.customer + "}",
            info: {
              parts: [oProps.salesOrganization, oProps.distributionChannel, oProps.division],
              formatter: function (sOrg, sChannel, sDivision) {
                return sOrg + " / " + sChannel + " / " + sDivision;
              }
            }
          })
        },
        search: function (oEvent) {
          var sValue = oEvent.getParameter("value");
          var oBinding = oEvent.getSource().getBinding("items");
          var aFilters = aAreaFilters.slice();
          if (sValue) {
            aFilters.push(new Filter({
              filters: [
                new Filter(oProps.customerName, FilterOperator.Contains, sValue),
                new Filter(oProps.customer, FilterOperator.Contains, sValue)
              ],
              and: false
            }));
          }
          oBinding.filter(aFilters);
        },
        confirm: function (oEvent) {
          var oSelectedItem = oEvent.getParameter("selectedItem");
          if (oSelectedItem) {
            var oRow = oSelectedItem.getBindingContext().getObject();
            fnApply({
              id: oRow[oProps.customer],
              fullName: oRow[oProps.customerName],
              address: [oRow[oProps.cityName], oRow[oProps.postalCode], oRow[oProps.countryText]]
                .filter(function (sPart) { return !!sPart; })
                .join(", "),
              salesOrganization: oRow[oProps.salesOrganization],
              distributionChannel: oRow[oProps.distributionChannel],
              division: oRow[oProps.division]
            });
          }
          oDialog.destroy();
        },
        cancel: function () {
          oDialog.destroy();
        }
      });
      this.getView().addDependent(oDialog);
      oDialog.open();
    },

    _openProviderValueHelpDialog: function (fnApply) {
      var oBundle = this.getResourceBundle();
      var oProps = ServiceSchema.customerSalesAreaProperties;
      var oArea = ServiceSchema.salesArea;
      var sSearchMode = ProviderSearchService.defaultMode;
      var iRowPageSize = 50;
      var iRowLimit = iRowPageSize;
      var iLoadRequest = 0;
      var bHasMoreRows = true;
      var bRowsLoading = false;
      var aFields = ProviderSearchService.modes[0].fields;
      var oBasicSearch = new SearchField({
        width: "100%",
        placeholder: oBundle.getText("valueHelpSearchPlaceholder")
      });
      var aFieldControls = aFields.map(function (oField) {
        return { definition: oField, control: new Input() };
      });
      var oValueHelpModel = new JSONModel({ rows: [] });
      var fnGetFieldValues = function () {
        var mFieldValues = {};
        aFieldControls.forEach(function (oFieldControl) {
          mFieldValues[oFieldControl.definition.path] = oFieldControl.control.getValue();
        });
        return mFieldValues;
      };
      var oTable = new GridTable({
        selectionMode: "Single",
        selectionBehavior: "RowOnly",
        rowMode: new AutoRowMode({ minRowCount: 7, maxRowCount: 7 }),
        threshold: 100,
        enableColumnReordering: false,
        rowSelectionChange: function (oEvent) {
          var oContext = oEvent.getParameter("rowContext");
          if (oContext) {
            var oRow = oContext.getObject();
            fnApply({
              id: oRow[oProps.customer],
              fullName: oRow[oProps.customerName],
              address: [oRow[oProps.cityName], oRow[oProps.postalCode], oRow[oProps.countryText]]
                .filter(function (sPart) { return !!sPart; })
                .join(", "),
              salesOrganization: oRow[oProps.salesOrganization],
              distributionChannel: oRow[oProps.distributionChannel],
              division: oRow[oProps.division]
            });
            oDialog.close();
          }
        }
      }).addStyleClass("detailSingleSelectValueHelpTable");
      oTable.setBusyIndicatorDelay(0);
      oTable.setModel(oValueHelpModel);
      var fnSetResultColumns = function (aColumns) {
        oTable.getColumns().forEach(function (oColumn) {
          oTable.removeColumn(oColumn);
          oColumn.destroy();
        });
        aColumns.forEach(function (oColumn) {
          oTable.addColumn(new GridColumn({
            label: new Text({ text: oBundle.getText(oColumn.labelKey) }),
            template: new Text({ text: "{" + oColumn.path + "}" }),
            width: oColumn.width
          }));
        });
      };
      fnSetResultColumns(ProviderSearchService.modes[0].columns);
      var oDialog = new ValueHelpDialog({
        title: oBundle.getText("providerId"),
        key: oProps.customer,
        descriptionKey: oProps.customerName,
        contentWidth: "78rem",
        contentHeight: "47rem",
        draggable: true,
        resizable: true,
        supportMultiselect: false,
        supportRanges: false,
        supportRangesOnly: false,
        cancel: function () {
          oDialog.close();
        },
        afterClose: function () {
          oDialog.destroy();
        }
      }).addStyleClass("providerValueHelpDialog");
      var fnBindRows = function (bPreserveSelection) {
        if (!bPreserveSelection) {
          oTable.clearSelection();
        }
        var iCurrentRequest = ++iLoadRequest;
        bRowsLoading = true;
        oTable.setNoData(new BusyIndicator({ size: "1.5rem" }).addStyleClass("providerTableLoadingIndicator"));
        oTable.setBusy(true);
        ProviderSearchService.loadRows(
          this.getView().getModel(),
          this.getOwnerComponent().getModel("po"),
          sSearchMode,
          fnGetFieldValues(),
          oBasicSearch.getValue(),
          [new Filter(oProps.salesOrganization, FilterOperator.EQ, oArea.salesOrganization)],
          iRowLimit
        ).then(function (aRows) {
          if (iCurrentRequest !== iLoadRequest) {
            return;
          }
          bHasMoreRows = typeof aRows.hasMore === "boolean" ? aRows.hasMore : aRows.length >= iRowLimit;
          oValueHelpModel.setProperty("/rows", aRows);
          if (!oTable.getBinding("rows")) {
            oTable.bindRows("/rows");
          }
          oDialog.update();
        }).catch(function () {
          if (iCurrentRequest !== iLoadRequest) {
            return;
          }
          bHasMoreRows = false;
          oValueHelpModel.setProperty("/rows", []);
          MessageToast.show(oBundle.getText("providerSearchLoadError"));
        }).finally(function () {
          if (iCurrentRequest === iLoadRequest) {
            bRowsLoading = false;
            oTable.setBusy(false);
            oTable.setNoData(null);
          }
        });
      }.bind(this);
      var fnResetAndBindRows = function () {
        iRowLimit = iRowPageSize;
        bHasMoreRows = true;
        fnBindRows(false);
      };
      var oFilterBar = new FilterBar({
        advancedMode: true,
        filterBarExpanded: true,
        showGoOnFB: true,
        search: fnResetAndBindRows
      }).addStyleClass("providerSearchValueHelpFilterBar");
      oFilterBar.setBasicSearch(oBasicSearch);
      oBasicSearch.attachSearch(fnResetAndBindRows);
      var fnAddFieldControls = function () {
        aFieldControls.forEach(function (oFieldControl, iIndex) {
          if (iIndex === 2) {
            oFilterBar.addFilterGroupItem(new FilterGroupItem({
              groupName: "providerValueHelp",
              name: "searchModeSpacer",
              label: "",
              visibleInFilterBar: true,
              control: new Input().addStyleClass("providerSearchModeSpacer")
            }));
          }
          oFilterBar.addFilterGroupItem(new FilterGroupItem({
            groupName: "providerValueHelp",
            name: oFieldControl.definition.path,
            label: oBundle.getText(oFieldControl.definition.labelKey),
            visibleInFilterBar: true,
            control: oFieldControl.control
          }));
        });
      };
      var oSearchModeSelect = new Select({
        selectedKey: sSearchMode,
        items: ProviderSearchService.modes.map(function (oMode) {
          return new CoreItem({ key: oMode.key, text: oBundle.getText(oMode.labelKey) });
        }),
        change: function (oEvent) {
          sSearchMode = oEvent.getParameter("selectedItem").getKey();
          var oMode = ProviderSearchService.modes.find(function (oSearchMode) {
            return oSearchMode.key === sSearchMode;
          });
          oFilterBar.getFilterGroupItems().slice(1).forEach(function (oItem) {
            oFilterBar.removeFilterGroupItem(oItem);
            oItem.destroy();
          });
          fnSetResultColumns(oMode.columns);
          aFields = oMode.fields;
          aFieldControls = aFields.map(function (oField) {
            return { definition: oField, control: new Input() };
          });
          fnAddFieldControls();
          fnResetAndBindRows();
        }
      }).addStyleClass("providerSearchModeSelect");
      oFilterBar.addFilterGroupItem(new FilterGroupItem({
        groupName: "providerValueHelp",
        name: "searchMode",
        label: oBundle.getText("providerSearchFor"),
        visibleInFilterBar: true,
        control: oSearchModeSelect
      }));
      fnAddFieldControls();
      oDialog.setFilterBar(oFilterBar);
      oDialog.setTable(oTable);
      oTable.setSelectionMode("Single");
      oTable.setSelectionBehavior("RowOnly");
      oTable.attachFirstVisibleRowChanged(function (oEvent) {
        var iLoadedRows = oValueHelpModel.getProperty("/rows").length;
        var iVisibleRows = oTable.getVisibleRowCount() || 8;
        if (!bRowsLoading && bHasMoreRows && iLoadedRows &&
            oEvent.getParameter("firstVisibleRow") + iVisibleRows >= iLoadedRows - 5) {
          iRowLimit += iRowPageSize;
          fnBindRows(true);
        }
      });
      ValueHelpTableFitter.attach(oDialog, oTable, ResizeHandler);
      this.getView().addDependent(oDialog);
      oDialog.open();
      ValueHelpTableFitter.fit(oDialog, oTable);
      fnResetAndBindRows();
    },

    // Session Prompt (Detail View Adjustments) 3.5: Contact VH REWIRED off the
    // old `/StandardPartnerContactInfo` source (superseded - it 501'd on any
    // standalone query anyway) onto the new custom service's
    // `po>/ProviderContact` entity set (ServiceSchema.providerOrderService),
    // filtered SERVER-SIDE to the currently-selected Provider's
    // BusinessPartnerCompany (TODO-VERIFY: assumed to correlate 1:1 with
    // SoldToParty - both are Business Partner customer numbers - never
    // independently confirmed live, no backend access this session) and
    // CLIENT-SIDE to rows currently within their ValidityStartDate/EndDate
    // window (a missing/null end date is treated as "does not expire" -
    // filtering that server-side as a plain "ge today" comparison would
    // wrongly exclude those rows, so this is done locally instead, matching
    // the Step-0 spec's own instruction to client-filter validity). Holds key
    // BusinessPartnerPerson, displays BusinessPartnerPerson_Text.
    _openProviderContactValueHelpDialog: function (sTitle, sProviderId, fnApply) {
      var that = this;
      var oBundle = this.getResourceBundle();
      var oProps = ServiceSchema.providerOrderService.providerContactProperties;
      var oModel = this.getView().getModel("po");
      var oToday = new Date();
      var oListBinding = oModel.bindList("/" + ServiceSchema.providerOrderService.entitySets.providerContact, undefined, undefined,
        new Filter(oProps.businessPartnerCompany, FilterOperator.EQ, sProviderId), {
          $select: [oProps.businessPartnerPerson, oProps.businessPartnerPersonText,
            oProps.relationshipCategory, oProps.validityStartDate, oProps.validityEndDate].join(",")
        });

      oListBinding.requestContexts(0, 500).then(function (aContexts) {
        var aValidRows = aContexts.map(function (oCtx) { return oCtx.getObject(); }).filter(function (oRow) {
          var oStart = oRow[oProps.validityStartDate] ? new Date(oRow[oProps.validityStartDate]) : null;
          var oEnd = oRow[oProps.validityEndDate] ? new Date(oRow[oProps.validityEndDate]) : null;
          return (!oStart || oStart <= oToday) && (!oEnd || oEnd >= oToday);
        });
        var oPickerModel = new JSONModel({ rows: aValidRows });
        var aFields = [
          { path: oProps.businessPartnerPerson, labelKey: "contactHelpId" },
          { path: oProps.businessPartnerPersonText, labelKey: "contactHelpName" },
          { path: oProps.relationshipCategory, labelKey: "contactHelpRelationshipCategory" }
        ];
        var oBasicSearch = new SearchField({
          width: "100%",
          placeholder: oBundle.getText("valueHelpSearchPlaceholder")
        });
        var aFieldControls = aFields.map(function (oField) {
          return { definition: oField, control: new Input() };
        });
        var oSelectionModel = new JSONModel({ key: "" });
        var oSelectedContact = null;
        var fnSelectContact = function (oContact) {
          oSelectedContact = oContact;
          oSelectionModel.setProperty("/key", oSelectedContact[oProps.businessPartnerPerson]);
          oDialog.setTokens([]);
          oDialog.setTokens([new Token({
            key: oSelectedContact[oProps.businessPartnerPerson],
            text: oSelectedContact[oProps.businessPartnerPersonText] +
              " (" + oSelectedContact[oProps.businessPartnerPerson] + ")"
          })]);
        };
        var fnGetFilters = function () {
          var aFilters = [];
          var sSearchValue = oBasicSearch.getValue();
          if (sSearchValue) {
            aFilters.push(new Filter({
              filters: aFields.map(function (oField) {
                return new Filter(oField.path, FilterOperator.Contains, sSearchValue);
              }),
              and: false
            }));
          }
          aFieldControls.forEach(function (oFieldControl) {
            var sValue = oFieldControl.control.getValue();
            if (sValue) {
              aFilters.push(new Filter(oFieldControl.definition.path, FilterOperator.Contains, sValue));
            }
          });
          return aFilters;
        };
        var oTable = new GridTable({
          selectionMode: "Single",
          selectionBehavior: "RowOnly",
          rowMode: new AutoRowMode({ minRowCount: 8 }),
          enableColumnReordering: false,
          rowSelectionChange: function (oEvent) {
            var oContext = oEvent.getParameter("rowContext");
            if (oContext) {
              fnSelectContact(oContext.getObject());
            }
          }
        }).addStyleClass("detailSingleSelectValueHelpTable");
        oTable.setModel(oPickerModel, "picker");
        oTable.setModel(oSelectionModel, "contactSelection");
        oTable.addColumn(new GridColumn({
          label: new Text(),
          width: "3rem",
          hAlign: "Center",
          template: new RadioButton({
            groupName: "contactSelection",
            selected: {
              parts: [
                { path: "contactSelection>/key", targetType: "any" },
                { path: "picker>" + oProps.businessPartnerPerson, targetType: "any" }
              ],
              formatter: function (sSelectedKey, sContactId) {
                return sSelectedKey === sContactId;
              }
            },
            select: function (oEvent) {
              if (!oEvent.getParameter("selected")) {
                return;
              }
              var oContext = oEvent.getSource().getBindingContext("picker");
              if (oContext) {
                fnSelectContact(oContext.getObject());
                oTable.setSelectedIndex(oContext.getIndex());
              }
            }
          })
        }));
        [
          { path: oProps.businessPartnerPerson, labelKey: "contactHelpId", width: "11rem" },
          { path: oProps.businessPartnerPersonText, labelKey: "contactHelpName", width: "22rem" },
          { path: oProps.relationshipCategory, labelKey: "contactHelpRelationshipCategory", width: "12rem" },
          { path: oProps.validityStartDate, labelKey: "contactHelpValidFrom", width: "10rem" },
          { path: oProps.validityEndDate, labelKey: "contactHelpValidTo", width: "10rem" }
        ].forEach(function (oColumn) {
          oTable.addColumn(new GridColumn({
            label: new Text({ text: oBundle.getText(oColumn.labelKey) }),
            template: new Text({ text: "{picker>" + oColumn.path + "}" }),
            width: oColumn.width
          }));
        });
        var oDialog = new ValueHelpDialog({
          title: sTitle,
          key: oProps.businessPartnerPerson,
          descriptionKey: oProps.businessPartnerPersonText,
          contentWidth: "66rem",
          contentHeight: "47rem",
          draggable: true,
          resizable: true,
          supportMultiselect: true,
          supportRanges: false,
          supportRangesOnly: false,
          ok: function () {
            if (!oSelectedContact) {
              return;
            }
            fnApply(oSelectedContact);
            oDialog.close();
          },
          cancel: function () {
            oDialog.close();
          },
          tokenRemove: function () {
            oSelectedContact = null;
            oSelectionModel.setProperty("/key", "");
            oTable.clearSelection();
            oDialog.setTokens([]);
          },
          afterClose: function () {
            oDialog.destroy();
          }
        });
        var fnBindRows = function () {
          oSelectedContact = null;
          oSelectionModel.setProperty("/key", "");
          oTable.clearSelection();
          oDialog.setTokens([]);
          oTable.bindRows({ path: "picker>/rows", filters: fnGetFilters() });
        };
        var oFilterBar = new FilterBar({
          advancedMode: true,
          filterBarExpanded: true,
          showGoOnFB: true,
          search: fnBindRows
        });
        oFilterBar.setBasicSearch(oBasicSearch);
        oBasicSearch.attachSearch(fnBindRows);
        aFieldControls.forEach(function (oFieldControl) {
          oFilterBar.addFilterGroupItem(new FilterGroupItem({
            groupName: "contactValueHelp",
            name: oFieldControl.definition.path,
            label: oBundle.getText(oFieldControl.definition.labelKey),
            visibleInFilterBar: true,
            control: oFieldControl.control
          }));
        });
        oDialog.setFilterBar(oFilterBar);
        oDialog.setTable(oTable);
        oTable.setSelectionMode("Single");
        oTable.setSelectionBehavior("RowOnly");
        that.getView().addDependent(oDialog);
        oDialog.open();
        fnBindRows();
      }).finally(function () {
        oListBinding.destroy();
      });
    },

    // NDC Code VH backed by this same service's own top-level `/Product`
    // EntitySet (ProductType) - search by material description or code.
    // Session Prompt (Detail View Adjustments) 3.7: $select now also includes
    // BaseUnit (ServiceSchema.productProperties.baseUnit), carried over to the
    // picked row's RequestedQuantityUnit (onItemNdcValueHelpRequest) so Items
    // UOM can go back to being read-only.
    _openProductValueHelpDialog: function (sTitle, fnApply) {
      var oBundle = this.getResourceBundle();
      var oProps = ServiceSchema.productProperties;
      var aFields = [
        { path: oProps.id, labelKey: "productHelpProductId" },
        { path: oProps.text, labelKey: "productHelpProduct" },
        { path: oProps.industryStandardName, labelKey: "productHelpBrand" }
      ];
      var oBasicSearch = new SearchField({
        width: "100%",
        placeholder: oBundle.getText("valueHelpSearchPlaceholder")
      });
      var aFieldControls = aFields.map(function (oField) {
        return { definition: oField, control: new Input() };
      });
      var fnGetFilters = function () {
        var aFilters = [];
        var sSearchValue = oBasicSearch.getValue();
        if (sSearchValue) {
          aFilters.push(new Filter({
            filters: aFields.map(function (oField) {
              return new Filter(oField.path, FilterOperator.Contains, sSearchValue);
            }),
            and: false
          }));
        }
        aFieldControls.forEach(function (oFieldControl) {
          var sValue = oFieldControl.control.getValue();
          if (sValue) {
            aFilters.push(new Filter(oFieldControl.definition.path, FilterOperator.Contains, sValue));
          }
        });
        return aFilters;
      };
      var oTable = new GridTable({
        selectionMode: "Single",
        selectionBehavior: "RowOnly",
        rowMode: new AutoRowMode({ minRowCount: 8 }),
        threshold: 100,
        enableColumnReordering: false,
        rowSelectionChange: function (oEvent) {
          var oContext = oEvent.getParameter("rowContext");
          if (oContext) {
            fnApply(oContext.getObject());
            oDialog.close();
          }
        }
      }).addStyleClass("detailSingleSelectValueHelpTable");
      [
        { path: oProps.id, labelKey: "productHelpProductId", width: "11rem" },
        { path: oProps.text, labelKey: "productHelpProduct", width: "22rem" },
        { path: oProps.group, labelKey: "productHelpBaseCategory", width: "10rem" },
        { path: oProps.industryStandardName, labelKey: "productHelpBrand", width: "10rem" }
      ].forEach(function (oColumn) {
        oTable.addColumn(new GridColumn({
          label: new Text({ text: oBundle.getText(oColumn.labelKey) }),
          template: oColumn.path ? new Text({ text: "{" + oColumn.path + "}" }) : new Text(),
          width: oColumn.width
        }));
      });
      var oDialog = new ValueHelpDialog({
        title: sTitle,
        key: oProps.id,
        descriptionKey: oProps.text,
        contentWidth: "66rem",
        contentHeight: "47rem",
        draggable: true,
        resizable: true,
        supportMultiselect: false,
        supportRanges: false,
        supportRangesOnly: false,
        cancel: function () {
          oDialog.close();
        },
        afterClose: function () {
          oDialog.destroy();
        }
      });
      var fnBindRows = function () {
        oTable.clearSelection();
        oTable.bindRows({
          path: "/" + ServiceSchema.entitySets.product,
          parameters: {
            $select: [oProps.id, oProps.text, oProps.industryStandardName, oProps.baseUnit].join(",")
          },
          filters: fnGetFilters(),
          events: {
            dataRequested: function () { oDialog.setBusy(true); },
            dataReceived: function () {
              oDialog.setBusy(false);
              oDialog.update();
            }
          }
        });
      };
      var oFilterBar = new FilterBar({
        advancedMode: true,
        filterBarExpanded: true,
        showGoOnFB: true,
        search: fnBindRows
      });
      oFilterBar.setBasicSearch(oBasicSearch);
      oBasicSearch.attachSearch(fnBindRows);
      aFieldControls.forEach(function (oFieldControl) {
        oFilterBar.addFilterGroupItem(new FilterGroupItem({
          groupName: "productValueHelp",
          name: oFieldControl.definition.path,
          label: oBundle.getText(oFieldControl.definition.labelKey),
          visibleInFilterBar: true,
          control: oFieldControl.control
        }));
      });
      oDialog.setFilterBar(oFilterBar);
      oDialog.setTable(oTable);
      oTable.setSelectionMode("Single");
      oTable.setSelectionBehavior("RowOnly");
      this.getView().addDependent(oDialog);
      oDialog.open();
      fnBindRows();
    },

    // Prefill the selected Provider's current default contact. The backend's
    // ABAP "X" flag is exposed by OData as an Edm.Boolean, so the service filter
    // must compare IsStandardRelationship with true.
    _prefillMainContact: function (sProviderId) {
      var oEnrichModel = this.getView().getModel("createEnrich");
      var oProps = ServiceSchema.providerOrderService.providerContactProperties;
      var iRequest = (this._iContactPrefillRequest || 0) + 1;
      var oToday = new Date();
      this._iContactPrefillRequest = iRequest;
      oEnrichModel.setProperty("/contactName", "");
      oEnrichModel.setProperty("/contactId", "");

      var oListBinding = this.getView().getModel("po").bindList(
        "/" + ServiceSchema.providerOrderService.entitySets.providerContact,
        undefined,
        undefined,
        [
          new Filter(oProps.businessPartnerCompany, FilterOperator.EQ, sProviderId),
          new Filter(oProps.isStandardRelationship, FilterOperator.EQ, true)
        ],
        {
          $select: [oProps.businessPartnerCompany, oProps.businessPartnerPerson,
            oProps.businessPartnerPersonText, oProps.validityStartDate,
            oProps.validityEndDate].join(",")
        }
      );

      oListBinding.requestContexts(0, 100).then(function (aContexts) {
        if (this._iContactPrefillRequest !== iRequest) {
          return;
        }
        var oContact = aContexts.map(function (oContext) {
          return oContext.getObject();
        }).find(function (oRow) {
          var oStart = oRow[oProps.validityStartDate] ? new Date(oRow[oProps.validityStartDate]) : null;
          var oEnd = oRow[oProps.validityEndDate] ? new Date(oRow[oProps.validityEndDate]) : null;
          return (!oStart || oStart <= oToday) && (!oEnd || oEnd >= oToday);
        });
        if (oContact) {
          oEnrichModel.setProperty("/contactId", oContact[oProps.businessPartnerPerson]);
          oEnrichModel.setProperty("/contactName", oContact[oProps.businessPartnerPersonText]);
        }
      }.bind(this)).catch(function () {
        // Keep Contact blank when no default can be loaded; manual value help remains available.
      }).finally(function () {
        oListBinding.destroy();
      });
    },

    // v5 (design/E008_CRUD1_v5_Sticky_Amendment.md): the Provider-first
    // bootstrap mandate is void — there is no backend call here at all.
    // Provider selection sets the scratch context's SoldToParty property
    // AND ("UX phasing + triad sourcing") the real SalesOrganization/
    // DistributionChannel/Division harvested off the picked VH row - these
    // overwrite the display-only constants CreateOrderService.js#enter
    // seeded, and are what save() actually sends to CreateWithSalesOrderType.
    // Also flips createState>/providerChosen, unlocking every other
    // createMode field/row-action per the phased-entry UX.
    onProviderValueHelpRequest: function () {
      var that = this;
      // _openProviderValueHelpDialog's fnApply gets a normalized
      // {id, fullName, address, salesOrganization, distributionChannel,
      // division} shape (composed from CustomerSalesArea's fields), not a raw
      // ServiceSchema property-name lookup.
      this._openProviderValueHelpDialog(function (oItem) {
        that._applyProviderPick(oItem);
      });
    },

    // Shared by the Value Help dialog's confirm callback above AND the new
    // typeahead suggestionItemSelected handler below (Issue Batch 9-30-001
    // §3.3) - same normalized {id, fullName, address, salesOrganization,
    // distributionChannel, division} shape either way.
    _applyProviderPick: function (oItem) {
      var oContext = this.getView().getBindingContext();
      oContext.setProperty(ServiceSchema.headerProperties.providerId, oItem.id);
      oContext.setProperty(ServiceSchema.headerProperties.salesOrganization, oItem.salesOrganization);
      oContext.setProperty(ServiceSchema.headerProperties.distributionChannel, oItem.distributionChannel);
      oContext.setProperty(ServiceSchema.headerProperties.division, oItem.division);
      this._defaultProviderSalesOffice(oContext, oItem);
      var oEnrichModel = this.getView().getModel("createEnrich");
      oEnrichModel.setProperty("/providerName", oItem.fullName);
      oEnrichModel.setProperty("/providerAddress", oItem.address);
      oEnrichModel.setProperty("/providerAddressId", "");
      var oShippingEditModel = this.getView().getModel("shippingEdit");
      var sDefaultAddressKey = "__providerDefault:" + oItem.id;
      oShippingEditModel.setProperty("/createAddressKey", "");
      this._loadShippingAddresses(
        oItem.id,
        ServiceSchema.shippingAddressValueHelp.createPartnerDeterminationProcedure,
        { id: sDefaultAddressKey, address: oItem.address }
      ).then(function (aAddresses) {
        if (aAddresses) {
          oShippingEditModel.setProperty("/createAddressKey", sDefaultAddressKey);
        }
      });
      this.getView().getModel("createState").setProperty("/providerChosen", true);
      this._prefillMainContact(oItem.id);
      this._resetProviderInventoryState();
      this._setProviderValueState(true);
    },

    _defaultProviderSalesOffice: function (oContext, oProvider) {
      var oSchema = ServiceSchema.providerOrderService;
      var oProps = oSchema.customerSalesAreaProperties;
      var iRequest = (this._iSalesOfficeDefaultRequest || 0) + 1;
      this._iSalesOfficeDefaultRequest = iRequest;
      oContext.setProperty(ServiceSchema.headerProperties.salesOffice, "");
      var oProviderModel = this.getView().getModel("po");
      if (!oProviderModel) {
        return;
      }
      oProviderModel.getMetaModel().requestObject(
        "/" + oSchema.entitySets.customerSalesArea + "/" + oProps.salesOffice
      ).then(function (oSalesOfficeProperty) {
        if (!oSalesOfficeProperty || this._iSalesOfficeDefaultRequest !== iRequest) {
          return;
        }
        var oBinding = oProviderModel.bindList(
          "/" + oSchema.entitySets.customerSalesArea,
          undefined,
          undefined,
          [
            new Filter(oProps.customer, FilterOperator.EQ, oProvider.id),
            new Filter(oProps.salesOrganization, FilterOperator.EQ, oProvider.salesOrganization),
            new Filter(oProps.distributionChannel, FilterOperator.EQ, oProvider.distributionChannel),
            new Filter(oProps.division, FilterOperator.EQ, oProvider.division),
            new Filter(oProps.isActiveEntity, FilterOperator.EQ, true)
          ],
          {
            $select: oProps.salesOffice,
            $$groupId: "$direct"
          }
        );
        oBinding.requestContexts(0, 1).then(function (aContexts) {
          if (this._iSalesOfficeDefaultRequest === iRequest) {
            oContext.setProperty(
              ServiceSchema.headerProperties.salesOffice,
              aContexts.length ? aContexts[0].getProperty(oProps.salesOffice) : ""
            );
          }
        }.bind(this)).catch(function () {
          // A missing provider sales-area default leaves Sales Office blank and selectable.
        }).finally(function () {
          oBinding.destroy();
        });
      }.bind(this)).catch(function () {
        // A stale or misconfigured provider-order model must not query the main service schema.
      });
    },

    onCreateShippingAddressChange: function (oEvent) {
      var oSelectedItem = oEvent.getParameter("selectedItem");
      var oAddressContext = oSelectedItem && oSelectedItem.getBindingContext("shippingEdit");
      if (!oAddressContext) {
        return;
      }
      var sAddressId = oAddressContext.getProperty("id");
      var oEnrichModel = this.getView().getModel("createEnrich");
      oEnrichModel.setProperty("/providerAddress", oAddressContext.getProperty("address"));
      oEnrichModel.setProperty("/providerAddressId", sAddressId.indexOf("__providerDefault:") === 0 ? "" : sAddressId);
    },

    onInventoryEditListPress: function () {
      var oContext = this.getView().getBindingContext();
      var sProviderId = oContext && oContext.getProperty(ServiceSchema.headerProperties.providerId);
      if (!sProviderId) {
        MessageToast.show(this.getResourceBundle().getText("inventoryProviderRequired"));
        return;
      }
      this._oSectionFactory.expandSection("inventory");
      this._loadProviderInventory(sProviderId);
    },

    _resetProviderInventoryState: function () {
      this._iProviderIohRequest = (this._iProviderIohRequest || 0) + 1;
      if (this._oProviderIohListBinding) {
        this._oProviderIohListBinding.destroy();
        this._oProviderIohListBinding = null;
      }
      this.getView().getModel("ioh").setData({
        rows: [], busy: false, error: false, editable: false, loaded: false
      });
    },

    onTransactionHistorySearch: function (oEvent) {
      var oTable = this._byIdInSection("transactionHistory", "transactionHistoryTable");
      var oBinding = oTable && oTable.getBinding("items");
      if (!oBinding) {
        return;
      }
      var sQuery = oEvent.getSource().getValue();
      var aFilters = sQuery ? [new Filter({
        filters: [
          new Filter({ path: "delivery", operator: FilterOperator.Contains, value1: sQuery, caseSensitive: false }),
          new Filter({ path: "transactionType", operator: FilterOperator.Contains, value1: sQuery, caseSensitive: false })
        ],
        and: false
      })] : [];
      oBinding.filter(aFilters, "Application");
    },

    // Transaction History (Detail page): deliveries (ProvOrdDelvs) for the saved
    // sales order. Loads only once the section is expanded; a new order resets it.
    _refreshTransactionHistory: function () {
      var oHistoryModel = this.getView().getModel("transactionHistory");
      var oPanel = this.byId("transactionHistory");
      var sSalesOrder = oHistoryModel.getProperty("/salesOrder");
      if (!sSalesOrder || !oPanel || !oPanel.getExpanded()) {
        return;
      }
      if (oHistoryModel.getProperty("/loaded") || oHistoryModel.getProperty("/busy")) {
        return;
      }
      this._loadTransactionHistory(sSalesOrder);
    },

    _resetTransactionHistoryState: function (sSalesOrder) {
      this._iTransactionHistoryRequest = (this._iTransactionHistoryRequest || 0) + 1;
      if (this._oTransactionHistoryListBinding) {
        this._oTransactionHistoryListBinding.destroy();
        this._oTransactionHistoryListBinding = null;
      }
      this.getView().getModel("transactionHistory").setData({
        salesOrder: sSalesOrder || "", rows: [], busy: false, error: false, loaded: false
      });
    },

    _loadTransactionHistory: function (sSalesOrder) {
      var oHistoryModel = this.getView().getModel("transactionHistory");
      var oProps = ServiceSchema.providerOrderService.providerDeliveryProperties;
      var iRequest = (this._iTransactionHistoryRequest || 0) + 1;
      this._iTransactionHistoryRequest = iRequest;
      if (this._oTransactionHistoryListBinding) {
        this._oTransactionHistoryListBinding.destroy();
        this._oTransactionHistoryListBinding = null;
      }
      oHistoryModel.setData({ salesOrder: sSalesOrder, rows: [], busy: true, error: false, loaded: false });

      var oListBinding = this.getView().getModel("po").bindList(
        "/" + ServiceSchema.providerOrderService.entitySets.providerDeliveries,
        undefined,
        undefined,
        [new Filter(oProps.salesOrder, FilterOperator.EQ, sSalesOrder)],
        {
          $select: [oProps.delivery, oProps.subsequentDocumentCategoryText, oProps.deliveryCreationDate].join(",")
        }
      );
      this._oTransactionHistoryListBinding = oListBinding;

      oListBinding.requestContexts(0, 500).then(function (aContexts) {
        if (this._iTransactionHistoryRequest !== iRequest) {
          return;
        }
        var aRows = aContexts.map(function (oContext) {
          var oRow = oContext.getObject();
          return {
            delivery: oRow[oProps.delivery],
            transactionType: oRow[oProps.subsequentDocumentCategoryText],
            createdOn: oRow[oProps.deliveryCreationDate]
          };
        });
        oHistoryModel.setData({ salesOrder: sSalesOrder, rows: aRows, busy: false, error: false, loaded: true });
      }.bind(this)).catch(function () {
        if (this._iTransactionHistoryRequest !== iRequest) {
          return;
        }
        oListBinding.destroy();
        this._oTransactionHistoryListBinding = null;
        oHistoryModel.setData({ salesOrder: sSalesOrder, rows: [], busy: false, error: true, loaded: false });
      }.bind(this));
    },

    _loadProviderInventory: function (sProviderId) {
      var oIohModel = this.getView().getModel("ioh");
      var oProps = ServiceSchema.providerOrderService.providerIohProperties;
      var iRequest = (this._iProviderIohRequest || 0) + 1;
      this._iProviderIohRequest = iRequest;
      if (this._oProviderIohListBinding) {
        this._oProviderIohListBinding.destroy();
      }
      oIohModel.setData({ rows: [], busy: true, error: false, editable: false, loaded: false });

      var oListBinding = this.getView().getModel("po").bindList(
        "/" + ServiceSchema.providerOrderService.entitySets.providerIoh,
        undefined,
        undefined,
        [new Filter(oProps.soldToParty, FilterOperator.EQ, sProviderId)],
        {
          $select: [oProps.soldToParty, oProps.material, oProps.batch,
            oProps.quantity, oProps.unit, oProps.expirationDate, oProps.brand].join(",")
        }
      );
      this._oProviderIohListBinding = oListBinding;

      oListBinding.requestContexts(0, 500).then(function (aContexts) {
        if (this._iProviderIohRequest !== iRequest) {
          return;
        }
        var aRows = aContexts.map(function (oContext) {
            var oRow = oContext.getObject();
            return {
              brand: oRow[oProps.brand],
              ndc: oRow[oProps.material],
              lot: oRow[oProps.batch],
              quantity: oRow[oProps.quantity],
              unit: oRow[oProps.unit],
              expirationDate: oRow[oProps.expirationDate],
              isNew: false
            };
          });
        oIohModel.setData({
          rows: aRows,
          busy: false,
          error: false,
          editable: !!this.getView().getModel("sectionFlags").getProperty("/createMode"),
          loaded: true
        });
      }.bind(this)).catch(function () {
        if (this._iProviderIohRequest === iRequest) {
          oListBinding.destroy();
          this._oProviderIohListBinding = null;
          oIohModel.setData({ rows: [], busy: false, error: true, editable: false, loaded: false });
        }
      }.bind(this));
    },

    onInventoryInsertRow: function () {
      if (!this.getView().getModel("sectionFlags").getProperty("/createMode")) {
        return;
      }
      var oIohModel = this.getView().getModel("ioh");
      var aRows = oIohModel.getProperty("/rows").slice();
      var oFilter = this._byIdInSection("inventory", "iohFilter");
      if (oFilter) {
        oFilter.setValue("");
      }
      var oTable = this._byIdInSection("inventory", "iohTable");
      var oBinding = oTable && oTable.getBinding("items");
      if (oBinding) {
        oBinding.filter([]);
      }
      aRows.push({ brand: "", ndc: "", lot: "", quantity: 0, unit: "", expirationDate: "", isNew: true });
      oIohModel.setProperty("/rows", aRows);
    },

    onInventoryDeleteRow: function (oEvent) {
      if (!this.getView().getModel("sectionFlags").getProperty("/createMode")) {
        return;
      }
      var oRowContext = oEvent.getSource().getBindingContext("ioh");
      if (!oRowContext) {
        return;
      }
      var oIohModel = this.getView().getModel("ioh");
      var iIndex = Number(oRowContext.getPath().split("/").pop());
      var aRows = oIohModel.getProperty("/rows").slice();
      aRows.splice(iIndex, 1);
      oIohModel.setProperty("/rows", aRows);
    },

    onInventoryNdcValueHelpRequest: function (oEvent) {
      if (!this.getView().getModel("sectionFlags").getProperty("/createMode")) {
        return;
      }
      var oRowContext = oEvent.getSource().getBindingContext("ioh");
      var oProps = ServiceSchema.productProperties;
      if (!oRowContext) {
        return;
      }
      var iCurrentIndex = Number(oRowContext.getPath().split("/").pop());
      var aExistingNdcs = this.getView().getModel("ioh").getProperty("/rows").filter(function (oRow, iIndex) {
        return iIndex !== iCurrentIndex && !!oRow.ndc;
      }).map(function (oRow) {
        return oRow.ndc;
      }).filter(function (sNdc, iIndex, aNdcs) {
        return aNdcs.indexOf(sNdc) === iIndex;
      });
      var aExclusionFilters = aExistingNdcs.map(function (sNdc) {
        return new Filter(oProps.id, FilterOperator.NE, sNdc);
      });
      var oDialog = new SelectDialog({
        title: this.getResourceBundle().getText("inventoryNdcPickerTitle"),
        growing: true,
        items: {
          path: "/" + ServiceSchema.entitySets.product,
          parameters: {
            $select: [oProps.id, oProps.text, oProps.industryStandardName, oProps.baseUnit].join(",")
          },
          filters: aExclusionFilters,
          template: new StandardListItem({
            title: "{" + oProps.id + "}",
            description: "{" + oProps.text + "}"
          }),
          templateShareable: false
        },
        search: function (oSearchEvent) {
          var sValue = oSearchEvent.getParameter("value");
          var aFilters = aExclusionFilters.slice();
          if (sValue) {
            aFilters.push(new Filter({
              filters: [
                new Filter(oProps.id, FilterOperator.Contains, sValue),
                new Filter(oProps.text, FilterOperator.Contains, sValue)
              ],
              and: false
            }));
          }
          oSearchEvent.getSource().getBinding("items").filter(aFilters);
        },
        confirm: function (oConfirmEvent) {
          var oSelectedItem = oConfirmEvent.getParameter("selectedItem");
          if (oSelectedItem) {
            var oProduct = oSelectedItem.getBindingContext().getObject();
            oRowContext.setProperty("ndc", oProduct[oProps.id]);
            oRowContext.setProperty("brand", oProduct[oProps.industryStandardName] || "");
            oRowContext.setProperty("unit", oProduct[oProps.baseUnit] || "");
          }
          oDialog.destroy();
        },
        cancel: function () {
          oDialog.destroy();
        }
      });
      this.getView().addDependent(oDialog);
      oDialog.open();
    },

    onInventoryFilter: function (oEvent) {
      var sValue = oEvent.getParameter("newValue");
      var oTable = this._byIdInSection("inventory", "iohTable");
      var oBinding = oTable && oTable.getBinding("items");
      if (!oBinding) {
        return;
      }
      oBinding.filter(sValue ? new Filter({
        filters: ["brand", "ndc", "lot", "quantity", "expirationDate"].map(function (sPath) {
          return new Filter(sPath, FilterOperator.Contains, sValue);
        }),
        and: false
      }) : []);
    },

    // Issue Batch 9-30-001 §3.3: Provider typeahead - filters the Input's own
    // "suggestionItems" aggregation binding (Details.fragment.xml) the same
    // way _openShipToPartyValueHelpDialog's own search handler does (soft
    // pre-filter on SalesOrganization + Contains on name/code), debounced so
    // every keystroke doesn't fire its own $filter request.
    onProviderSuggest: function (oEvent) {
      var sValue = oEvent.getParameter("suggestValue");
      var oInput = oEvent.getSource();
      this._debounce("provider", function () {
        var oProps = ServiceSchema.customerSalesAreaProperties;
        var oArea = ServiceSchema.salesArea;
        var oBinding = oInput.getBinding("suggestionItems");
        if (!oBinding) {
          // Live-test follow-up: a declarative suggestionItems aggregation
          // nested in this header-bound Form polluted the header context's
          // own autoExpandSelect with a bogus "Customer" property (confirmed
          // live) - bound lazily here instead, well after the header's own
          // binding is already resolved, so autoExpandSelect never sees it.
          oInput.bindAggregation("suggestionItems", {
            path: "/" + ServiceSchema.entitySets.customerSalesArea,
            parameters: {
              $select: [oProps.customer, oProps.customerName, oProps.cityName, oProps.postalCode, oProps.countryText,
                oProps.salesOrganization, oProps.distributionChannel, oProps.division].join(",")
            },
            template: new CoreListItem({ text: "{" + oProps.customerName + "}", additionalText: "{" + oProps.customer + "}" })
          });
          oBinding = oInput.getBinding("suggestionItems");
        }
        var aFilters = [new Filter(oProps.salesOrganization, FilterOperator.EQ, oArea.salesOrganization)];
        if (sValue) {
          aFilters.push(new Filter({
            filters: [
              new Filter(oProps.customerName, FilterOperator.Contains, sValue),
              new Filter(oProps.customer, FilterOperator.Contains, sValue)
            ],
            and: false
          }));
        }
        oBinding.filter(aFilters);
      });
    },

    onProviderSuggestionSelected: function (oEvent) {
      var oSelectedRow = oEvent.getParameter("selectedRow") || oEvent.getParameter("selectedItem");
      var oRowContext = oSelectedRow && oSelectedRow.getBindingContext();
      if (!oRowContext) {
        return;
      }
      var oProps = ServiceSchema.customerSalesAreaProperties;
      var oRow = oRowContext.getObject();
      this._applyProviderPick({
        id: oRow[oProps.customer],
        fullName: oRow[oProps.customerName],
        address: [oRow[oProps.cityName], oRow[oProps.postalCode], oRow[oProps.countryText]]
          .filter(function (sPart) { return !!sPart; })
          .join(", "),
        salesOrganization: oRow[oProps.salesOrganization],
        distributionChannel: oRow[oProps.distributionChannel],
        division: oRow[oProps.division]
      });
    },

    // Issue Batch 9-30-001 §3.3: free typing no longer auto-confirms a
    // Provider (unlike the old valueHelpOnly Input) - a typed value that
    // doesn't match the last confirmed pick is flagged Error until a real
    // suggestion/VH row is chosen; SoldToParty/sales-area properties on the
    // context are only ever set by _applyProviderPick above, never by typing.
    // Live-test (2026-10-01): typing/pasting an exact provider code or name
    // and tabbing out (no suggestion/VH pick) just sat in Error state with
    // nothing loaded - same underlying gap as the NDC Input (onItemNdcChange)
    // but here there was no lookup attempt at all. Now looks the typed value
    // up the same way the typeahead's own filter does (customer code OR
    // name, within the fixed sales area) and, on an exact single match,
    // applies it via _applyProviderPick like a suggestion/VH pick would.
    onProviderChange: function (oEvent) {
      var that = this;
      var oInput = oEvent.getSource();
      var sValue = oEvent.getParameter("value");
      var sConfirmed = this.getView().getModel("createEnrich").getProperty("/providerName");
      if (!sValue || sValue === sConfirmed) {
        this._setProviderValueState(true);
        return;
      }
      var oProps = ServiceSchema.customerSalesAreaProperties;
      var oArea = ServiceSchema.salesArea;
      var oLookupBinding = this.getView().getModel().bindList(
        "/" + ServiceSchema.entitySets.customerSalesArea, undefined, undefined,
        [
          new Filter(oProps.salesOrganization, FilterOperator.EQ, oArea.salesOrganization),
          new Filter({
            filters: [
              new Filter(oProps.customerName, FilterOperator.EQ, sValue),
              new Filter(oProps.customer, FilterOperator.EQ, sValue)
            ],
            and: false
          })
        ],
        {
          $select: [oProps.customer, oProps.customerName, oProps.cityName, oProps.postalCode, oProps.countryText,
            oProps.salesOrganization, oProps.distributionChannel, oProps.division].join(",")
        }
      );
      oLookupBinding.requestContexts(0, 2).then(function (aContexts) {
        if (aContexts.length === 1) {
          var oRow = aContexts[0].getObject();
          that._applyProviderPick({
            id: oRow[oProps.customer],
            fullName: oRow[oProps.customerName],
            address: [oRow[oProps.cityName], oRow[oProps.postalCode], oRow[oProps.countryText]]
              .filter(function (sPart) { return !!sPart; })
              .join(", "),
            salesOrganization: oRow[oProps.salesOrganization],
            distributionChannel: oRow[oProps.distributionChannel],
            division: oRow[oProps.division]
          });
        } else {
          that._setProviderValueState(false);
        }
      }).catch(function () {
        that._setProviderValueState(false);
      });
    },

    _setProviderValueState: function (bValid) {
      var oInput = this._byIdInSection("details", "providerInput");
      if (!oInput) {
        return;
      }
      oInput.setValueState(bValid ? "None" : "Error");
      oInput.setValueStateText(bValid ? "" : this.getResourceBundle().getText("providerInvalidSelection"));
    },

    // Generic per-control-instance debounce (Issue Batch 9-30-001 §3.3/§3.4) -
    // sKey distinguishes independent debounce timers (Provider vs. a given
    // NDC row's own Input all share timers by their own row path, see
    // onItemNdcSuggest below).
    _debounce: function (sKey, fnCallback) {
      this._mDebounceTimers = this._mDebounceTimers || {};
      clearTimeout(this._mDebounceTimers[sKey]);
      this._mDebounceTimers[sKey] = setTimeout(fnCallback, 300);
    },


    // Session Prompt (Detail View Adjustments) 3.5: rewired off
    // `/StandardPartnerContactInfo` onto `po>/ProviderContact`, filtered to
    // the currently-selected Provider (SoldToParty on this context). Requires
    // a Provider to already be picked (the field is locked until
    // createState>/providerChosen anyway - Details.fragment.xml).
    onContactValueHelpRequest: function () {
      var oProps = ServiceSchema.providerOrderService.providerContactProperties;
      var oBundle = this.getResourceBundle();
      var oContext = this.getView().getBindingContext();
      var sProviderId = oContext && oContext.getProperty(ServiceSchema.headerProperties.providerId);
      if (!sProviderId) {
        return;
      }
      this._openProviderContactValueHelpDialog(oBundle.getText("filterContact"), sProviderId, function (oItem) {
        this._iContactPrefillRequest = (this._iContactPrefillRequest || 0) + 1;
        var oModel = this.getView().getModel("createEnrich");
        oModel.setProperty("/contactId", oItem[oProps.businessPartnerPerson]);
        oModel.setProperty("/contactName", oItem[oProps.businessPartnerPersonText]);
      }.bind(this));
    },

    // Local-only (see createEnrich>/employeeResponsibleName) - "based on SAP
    // User name (USR02)", hardcoded sample rows for now.
    onEmployeeResponsibleValueHelpRequest: function () {
      var oBundle = this.getResourceBundle();
      this._openPickerDialog(oBundle.getText("employeeResponsiblePickerTitle"), EMPLOYEE_PICKER_ITEMS, function (oItem) {
        var oModel = this.getView().getModel("createEnrich");
        oModel.setProperty("/employeeResponsibleId", oItem.id);
        oModel.setProperty("/employeeResponsibleName", oItem.name);
      }.bind(this));
    },

    // Rebinds the Items table's `_Item` navigation to the given deferred
    // update group ("vrEdit" for an existing order, ServiceSchema.createUpdateGroup
    // for a transient one) \u2014 a nested list binding's $$updateGroupId can only be
    // set at bind time, and (unlike header property bindings) is not inherited
    // automatically unless the parent context is itself transient in that same
    // group, so the Items table's static XML binding carries no group of its
    // own (Items.fragment.xml) and this is the only place "vrCreate" is used
    // outside CreateOrderService.js/ServiceSchema.js.
    _rebindItemsGroup: function (sGroupId) {
      var oTable = this._byIdInSection("items", "itemsTable");
      if (!oTable) {
        return;
      }
      var oBindingInfo = oTable.getBindingInfo("items");
      if (!oBindingInfo) {
        return;
      }
      // Gap 0 correction: same item-level SAP__Messages opt-in as the create
      // replay's deep-create binding (CreateOrderService.js), for change-mode
      // item edits/adds through this same _Item navigation.
      // $$ownRequest: true - a relative list binding shares its parent's
      // cache by default and refuses direct refresh() ("Refresh on this
      // binding is not supported!"); this gives it its own request/cache so
      // _refreshItemsBinding (opt-out toggle) can refresh it directly.
      // Issue Batch 9-30-001 \u00a72: $$patchWithoutSideEffects forces
      // "Prefer: return=minimal" on every PATCH through this binding, so the
      // server stops echoing the full entity (and its always-zeroed ZZ*QTY
      // read) back into the row on every field edit - reduces how often the
      // allocation-cache reapply above is even needed, doesn't replace it
      // (the create POST itself still unavoidably returns a representation).
      oBindingInfo.parameters = Object.assign({}, oBindingInfo.parameters, { $$updateGroupId: sGroupId, $$ownRequest: true, $$patchWithoutSideEffects: true, $select: ["SAP__Messages"].concat(FundLogicService.ZZ_FIELDS).join(",") });
      oTable.bindItems(oBindingInfo);
      // bindItems() always creates a fresh binding instance - re-attach here
      // (see _onItemCreateActivate) rather than relying on one set up once.
      var oNewBinding = oTable.getBinding("items");
      if (oNewBinding) {
        oNewBinding.attachCreateActivate(this._onItemCreateActivate, this);
      }
    },

    // SectionFactory.js content-loaded hook \u2014 fires once per section the
    // first time its fragment content loads (user expand or a forced createMode
    // expand). "items" reaction is pre-existing; "priceTotals" is new (Prices
    // Tables session prompt) - build/bind the shared 7-column pricing table
    // (model/PricingColumns.js) against this header context's own
    // `_PricingElement` navigation. createMode has no header context yet
    // (transient, pre-save) - PricingColumns.bindTable still runs so the
    // columns exist, but the relative `items` binding simply yields zero rows
    // until a real context exists, giving the designed empty state for free.
    _onSectionContentLoaded: function (sSectionId) {
      if (sSectionId === "details") {
        this._attachContactValueHelpActivation();
        if (!this.getView().getModel("sectionFlags").getProperty("/createMode")) {
          this._loadHeaderNotes(this.getView().getBindingContext());
        }
      } else if (sSectionId === "items") {
        this._rebindItemsGroup(this._sItemsUpdateGroup);
        // sap.m.Table#paste ignores pastes into an <input>, so cell pastes are caught by a delegate instead.
        var oItemsTable = this._byIdInSection("items", "itemsTable");
        if (oItemsTable) {
          oItemsTable.addEventDelegate({ onpaste: this.onItemsCellPaste }, this);
        }
        this._addInitialCreateItemRows();
        // 3.3: the Items panel's own contexts are the most convenient point
        // to (re)confirm the header Tax Amount sum once real item data is
        // actually loaded (change mode - createMode items have no server-
        // computed TaxAmount yet, see _computeHeaderTaxAmount doc comment).
        this._computeHeaderTaxAmount();
      } else if (sSectionId === "transactionHistory") {
        this._refreshTransactionHistory();
      } else if (sSectionId === "priceTotals") {
        var oTable = this._byIdInSection("priceTotals", "priceTotalsTable");
        PricingColumns.bindTable(oTable, this.getResourceBundle(), ServiceSchema.pricingElements.headerNavigation);
      }
    },

    _attachContactValueHelpActivation: function () {
      var oContactInput = this._byIdInSection("details", "contactInput");
      if (!oContactInput) {
        return;
      }
      var fnSetNativeReadOnly = function () {
        var oInputDomRef = oContactInput.getFocusDomRef();
        if (oInputDomRef) {
          oInputDomRef.readOnly = true;
          oInputDomRef.setAttribute("aria-readonly", "true");
        }
      };
      var fnOpenValueHelp = function (oEvent) {
        if (!this.getView().getModel("createState").getProperty("/providerChosen")) {
          return;
        }
        if (oEvent.target.closest(".sapMInputBaseIconContainer")) {
          return;
        }
        oEvent.preventDefault();
        this.onContactValueHelpRequest();
      }.bind(this);
      oContactInput.addEventDelegate({
        onAfterRendering: fnSetNativeReadOnly,
        onclick: fnOpenValueHelp
      });
      fnSetNativeReadOnly();
    },

    _loadHeaderNotes: function (oHeaderContext) {
      var oEnrichModel = this.getView().getModel("createEnrich");
      var oText = ServiceSchema.textEntity;
      var oProps = oText.properties;
      var iRequest = (this._iNotesRequest || 0) + 1;
      this._iNotesRequest = iRequest;
      this._bNotesNeedsCreate = false;
      oEnrichModel.setProperty("/notes", "");
      oEnrichModel.setProperty("/notesOriginal", "");
      if (!oHeaderContext || oHeaderContext.isTransient && oHeaderContext.isTransient()) {
        return Promise.resolve();
      }
      var oBinding = oHeaderContext.getModel().bindList(
        oText.navigation,
        oHeaderContext,
        undefined,
        [new Filter(oProps.longTextId, FilterOperator.EQ, oText.notesLongTextId)],
        { $select: [oProps.language, oProps.longTextId, oProps.longText].join(",") }
      );
      return oBinding.requestContexts(0, 20).then(function (aContexts) {
        if (this._iNotesRequest !== iRequest) {
          return;
        }
        var oNotesContext = aContexts.filter(function (oContext) {
          var sLanguage = oContext.getProperty(oProps.language);
          return sLanguage === oText.defaultLanguage || sLanguage === "EN";
        })[0] || aContexts[0];
        var sNotes = oNotesContext ? oNotesContext.getProperty(oProps.longText) : "";
        oEnrichModel.setProperty("/notes", sNotes || "");
        oEnrichModel.setProperty("/notesOriginal", sNotes || "");
      }.bind(this)).finally(function () {
        oBinding.destroy();
      });
    },

    _stageHeaderNotes: function (oHeaderContext) {
      var oEnrichModel = this.getView().getModel("createEnrich");
      var sNotes = oEnrichModel.getProperty("/notes") || "";
      var sOriginal = oEnrichModel.getProperty("/notesOriginal") || "";
      if (sNotes === sOriginal) {
        return Promise.resolve();
      }
      this._destroyNotesWriteBinding();
      var oText = ServiceSchema.textEntity;
      var oProps = oText.properties;
      var oBinding = oHeaderContext.getModel().bindList(
        oText.navigation,
        oHeaderContext,
        undefined,
        [new Filter(oProps.longTextId, FilterOperator.EQ, oText.notesLongTextId)],
        {
          $$updateGroupId: ServiceSchema.editUpdateGroup,
          $select: [oProps.language, oProps.longTextId, oProps.longText].join(",")
        }
      );
      this._oNotesWriteBinding = oBinding;
      return oBinding.requestContexts(0, 20).then(function (aContexts) {
        var oNotesContext = aContexts.filter(function (oContext) {
          var sLanguage = oContext.getProperty(oProps.language);
          return sLanguage === oText.defaultLanguage || sLanguage === "EN";
        })[0] || aContexts[0];
        if (oNotesContext) {
          this._bNotesNeedsCreate = false;
          oNotesContext.setProperty(oProps.longText, sNotes);
        } else if (sNotes) {
          this._bNotesNeedsCreate = true;
        }
      }.bind(this));
    },

    _destroyNotesWriteBinding: function () {
      if (this._oNotesWriteBinding) {
        this._oNotesWriteBinding.destroy();
        this._oNotesWriteBinding = null;
      }
    },

    // DF-1025: one-time load of the rejection-reason code list into a JSON model
    // (Items.fragment.xml Select items) - leading "" entry = no reason.
    _loadRejectionReasonVH: function () {
      var oProps = ServiceSchema.valueHelpProperties;
      var oVHModel = new JSONModel({ list: [{ key: "", text: this.getResourceBundle().getText("rejectionReasonNone") }] });
      this.getView().setModel(oVHModel, "rejectionReasons");
      var oListBinding = this.getOwnerComponent().getModel().bindList(
        "/" + ServiceSchema.entitySets.rejectionReason, undefined, undefined, undefined,
        { $select: [oProps.rejectionReasonCode, oProps.rejectionReasonText].join(",") }
      );
      oListBinding.requestContexts(0, 200).then(function (aContexts) {
        var aList = oVHModel.getProperty("/list").concat(aContexts.map(function (oCtx) {
          return { key: oCtx.getProperty(oProps.rejectionReasonCode), text: oCtx.getProperty(oProps.rejectionReasonText) };
        }));
        oVHModel.setProperty("/list", aList);
      }, function () {
        // Non-fatal: the Select then only offers "none"; the read failure is in the message model.
      });
    },

    // --- Session Prompt (Detail View Adjustments) 3.3: virtual header Tax
    // Amount - TaxAmount only exists on SalesOrderItemType (so.xml); this is
    // a plain client-side SUM, read-only, NEVER part of any create/edit
    // payload (headerProperties.taxAmount stays null). CreateMode items have
    // no server-computed TaxAmount before Save (pricing runs server-side at
    // SaveChanges), so this intentionally only recomputes for an existing
    // (already-saved) order - see _onObjectMatched/_onSectionContentLoaded. ---
    _computeHeaderTaxAmount: function () {
      var oContext = this.getView().getBindingContext();
      var oCalcModel = this.getView().getModel("headerCalc");
      if (!oContext || (oContext.isTransient && oContext.isTransient())) {
        oCalcModel.setProperty("/taxAmount", 0);
        return;
      }
      var oModel = oContext.getModel();
      var oItemsBinding = oModel.bindList(ServiceSchema.navigation.headerToItems, oContext, undefined, undefined, {
        $select: ServiceSchema.itemProperties.taxAmount
      });
      oItemsBinding.requestContexts(0, 9999).then(function (aContexts) {
        var fSum = aContexts.reduce(function (fTotal, oCtx) {
          var fValue = parseFloat(oCtx.getProperty(ServiceSchema.itemProperties.taxAmount));
          return fTotal + (isNaN(fValue) ? 0 : fValue);
        }, 0);
        oCalcModel.setProperty("/taxAmount", fSum);
      });
    },

    // --- Session Prompt (Detail View Adjustments) 3.9: Parties Involved.
    // Add is the only creation path (bound action CreatePartner,
    // ServiceSchema.createPartnerAction) - a plain oListBinding.create()
    // against `_Partner` always 405s (InsertRestrictions.Insertable=false,
    // so.xml ~15249). Edit/Delete/Name-change are all per-row, immediate
    // ($auto group) actions - see PartiesInvolved.fragment.xml. ---

    // Opens a small programmatic Dialog (no separate fragment file, mirrors
    // the pattern already used by _openPickerDialog elsewhere in this
    // controller) with a Partner Function Select (real /PartnerFunction VH)
    // and a Customer Input backed by the same CustomerSalesArea VH the
    // Provider field itself uses.
    onPartiesAddRow: function () {
      var that = this;
      var oBundle = this.getResourceBundle();
      var oHeaderContext = this.getView().getBindingContext();
      if (!oHeaderContext) {
        return;
      }
      var oAddModel = new JSONModel({ partnerFunction: "", customerId: "", customerName: "" });
      var oFunctionSelect = new Select({
        selectedKey: "{addParty>/partnerFunction}",
        items: {
          path: "/" + ServiceSchema.entitySets.partnerFunction,
          parameters: {
            $select: [ServiceSchema.valueHelpProperties.partnerFunctionCode, ServiceSchema.valueHelpProperties.partnerFunctionText].join(",")
          },
          template: new CoreItem({
            key: "{" + ServiceSchema.valueHelpProperties.partnerFunctionCode + "}",
            text: "{" + ServiceSchema.valueHelpProperties.partnerFunctionText + "}"
          }),
          // A fresh template is created every onPartiesAddRow call and never
          // reused across Select instances - false so its own destroy()
          // happens with this Select, not leaked (UI5 "FUTURE FATAL" warning).
          templateShareable: false
        }
      });
      var oCustomerInput = new Input({
        value: "{addParty>/customerName}",
        editable: false,
        showValueHelp: true,
        valueHelpRequest: function () {
          that._openShipToPartyValueHelpDialog(oBundle.getText("partiesInvolvedChoosePartner"), function (oItem) {
            oAddModel.setProperty("/customerId", oItem.id);
            oAddModel.setProperty("/customerName", oItem.fullName + " (" + oItem.id + ")");
          });
        }
      });
      var oDialog = new Dialog({
        title: oBundle.getText("partiesInvolvedAddTitle"),
        content: [
          new VBox({
            class: "sapUiSmallMargin",
            items: [
              new Label({ text: oBundle.getText("partiesInvolvedAddFunction"), labelFor: oFunctionSelect }),
              oFunctionSelect,
              new Label({ text: oBundle.getText("colPartnerName"), labelFor: oCustomerInput, class: "sapUiSmallMarginTop" }),
              oCustomerInput
            ]
          })
        ],
        beginButton: new Button({
          text: oBundle.getText("partiesInvolvedAdd"),
          type: "Emphasized",
          press: function () {
            var oData = oAddModel.getData();
            if (!oData.partnerFunction) {
              MessageToast.show(oBundle.getText("partiesInvolvedAddFunctionRequired"));
              return;
            }
            if (!oData.customerId) {
              MessageToast.show(oBundle.getText("partiesInvolvedAddPartnerRequired"));
              return;
            }
            that._onPartiesAddConfirm(oHeaderContext, oData.partnerFunction, oData.customerId).then(function () {
              oDialog.close();
            });
          }
        }),
        endButton: new Button({
          text: oBundle.getText("cancel"),
          press: function () {
            oDialog.close();
          }
        }),
        afterClose: function () {
          oDialog.destroy();
        }
      });
      oDialog.setModel(oAddModel, "addParty");
      this.getView().addDependent(oDialog);
      oDialog.open();
    },

    // Invokes the bound CreatePartner action on the header context (the only
    // sanctioned way to add a HeaderPartner row), then PATCHes the new row's
    // Customer property (CreatePartner only takes PartnerFunction as a
    // parameter - Customer is set via a follow-up PATCH, per
    // UpdateRestrictions.NonUpdatableProperties only listing PartnerFunction,
    // not Customer - so.xml ~2346), then refreshes the table's own items
    // binding so the new row appears.
    _onPartiesAddConfirm: function (oHeaderContext, sPartnerFunction, sCustomerId) {
      var that = this;
      var oBundle = this.getResourceBundle();
      var oModel = oHeaderContext.getModel();
      var oActionBinding = oModel.bindContext(ServiceSchema.createPartnerAction + "(...)", oHeaderContext);
      oActionBinding.setParameter("PartnerFunction", sPartnerFunction);
      return oActionBinding.execute().then(function () {
        var oNewPartnerContext = oActionBinding.getBoundContext();
        return oNewPartnerContext.setProperty(ServiceSchema.headerPartnerProperties.customer, sCustomerId);
      }).then(function () {
        var oTable = that._byIdInSection("partiesInvolved", "partiesTable");
        var oItemsBinding = oTable && oTable.getBinding("items");
        if (oItemsBinding) {
          oItemsBinding.refresh();
        }
        MessageToast.show(oBundle.getText("partiesInvolvedAddSuccess"));
      }).catch(function (oError) {
        MessageToast.show(oBundle.getText("partiesInvolvedAddError"));
        throw oError;
      });
    },

    // Deferred to a later phase (see i18n key text + OPEN_QUESTIONS.md) - no
    // dedicated partner-edit dialog exists yet for the other row fields
    // (only Name/Customer is wired, via onPartiesChangeName below).
    onPartiesEditRow: function () {
      MessageToast.show(this.getResourceBundle().getText("partiesInvolvedEditPlaceholder"));
    },

    // Real, immediate DELETE on the row's own bound-entity context ($auto
    // group - not staged for any section Save button), gated in the fragment
    // by the row's own dynamic __EntityControl/Deletable.
    onPartiesDeleteRow: function (oEvent) {
      var oBundle = this.getResourceBundle();
      var oRowContext = oEvent.getSource().getBindingContext();
      if (!oRowContext) {
        return;
      }
      MessageBox.confirm(oBundle.getText("partiesInvolvedDeleteConfirm"), {
        onClose: function (sAction) {
          if (sAction !== MessageBox.Action.OK) {
            return;
          }
          oRowContext.delete().then(function () {
            MessageToast.show(oBundle.getText("partiesInvolvedDeleteSuccess"));
          }, function () {
            MessageToast.show(oBundle.getText("partiesInvolvedDeleteError"));
          });
        }
      });
    },

    // Row-level Name/Customer change VH - reuses the same
    // _openShipToPartyValueHelpDialog picker the Provider field itself uses,
    // PATCHing this row's own Customer property directly (real, independently
    // updatable field - see headerPartnerProperties.customer doc comment).
    onPartiesChangeName: function (oEvent) {
      var oBundle = this.getResourceBundle();
      var oRowContext = oEvent.getSource().getBindingContext();
      if (!oRowContext) {
        return;
      }
      this._openShipToPartyValueHelpDialog(oBundle.getText("partiesInvolvedChoosePartner"), function (oItem) {
        oRowContext.setProperty(ServiceSchema.headerPartnerProperties.customer, oItem.id);
      });
    },

    // v5: Cancel is always the scratch-context case — nothing was ever sent
    // to the backend (its group is never submitted), so this is a plain local
    // delete + navigate-back (CreateOrderService.cancel/_destroyCreateContext).
    onCreateCancelPress: function () {
      var that = this;
      var oBundle = this.getResourceBundle();
      var oContext = this.getView().getBindingContext();

      function doCancel() {
        that._destroyCreateContext();
        that._setCreateMode(false);
        that._oRouter.navTo("master", {}, true);
      }

      if ((oContext && CreateOrderService.isDirty(oContext)) || (this._oCreateSession && this._oCreateSession.opened)) {
        MessageBox.confirm(oBundle.getText("createCancelConfirm"), {
          onClose: function (sAction) {
            if (sAction === MessageBox.Action.OK) {
              doCancel();
            }
          }
        });
      } else {
        doCancel();
      }
    },

    // v5: Save replays the scratch context for real (CreateOrderService.js#save,
    // steps ①-④) — the order does not exist until that resolves, so any
    // rejection from it means nothing was created; stay in createMode to
    // retry. Enrichment failing AFTER that (the order already exists) is the
    // actual partial-failure case: exit createMode into the saved order for
    // completion via Change Mode.
    onCreateSavePress: function () {
      var that = this;
      var oBundle = this.getResourceBundle();
      var oContext = this.getView().getBindingContext();
      if (!oContext) {
        this._bStartNewAfterSave = false;
        this.byId("newOrderBtn").setEnabled(true);
        return;
      }
      var sProviderId = oContext.getProperty(ServiceSchema.headerProperties.providerId);

      // Guard against a double-click firing the ①-④ replay (and its backend
      // SaveChanges commit) twice before setBusy(true)'s overlay blocks input.
      var oSaveBtn = this.getView().byId("createSaveBtn");
      if (oSaveBtn && !oSaveBtn.getEnabled()) {
        this._bStartNewAfterSave = false;
        this.byId("newOrderBtn").setEnabled(true);
        return;
      }

      if (!sProviderId) {
        this._bStartNewAfterSave = false;
        this.byId("newOrderBtn").setEnabled(true);
        MessageToast.show(oBundle.getText("createRequestFieldRequired"));
        this._oSectionFactory.expandSection("details");
        return;
      }

      var oItemsTable = this._byIdInSection("items", "itemsTable");
      var oItemsBinding = oItemsTable && oItemsTable.getBinding("items");
      if (!CreateOrderService.hasMinItems(oItemsBinding)) {
        this._bStartNewAfterSave = false;
        this.byId("newOrderBtn").setEnabled(true);
        MessageToast.show(oBundle.getText("createRequestMinItemsError"));
        this._oSectionFactory.expandSection("items");
        return;
      }
      if (CreateOrderService.hasIncompleteItems(oItemsBinding)) {
        this._bStartNewAfterSave = false;
        this.byId("newOrderBtn").setEnabled(true);
        MessageToast.show(oBundle.getText("createRequestIncompleteItemsError"));
        this._oSectionFactory.expandSection("items");
        return;
      }

      var oIohModel = this.getView().getModel("ioh");
      var oIohData = oIohModel.getData();
      if (oIohData.busy || oIohData.error) {
        this._bStartNewAfterSave = false;
        this.byId("newOrderBtn").setEnabled(true);
        MessageToast.show(oBundle.getText(oIohData.error ? "inventoryLoadError" : "inventoryLoading"));
        this._oSectionFactory.expandSection("inventory");
        return;
      }
      if (oIohData.loaded && ProviderInventoryService.hasInvalidRows(oIohData.rows)) {
        this._bStartNewAfterSave = false;
        this.byId("newOrderBtn").setEnabled(true);
        MessageToast.show(oBundle.getText("inventoryRequiredFields"));
        this._oSectionFactory.expandSection("inventory");
        return;
      }

      if (oSaveBtn) {
        oSaveBtn.setEnabled(false);
      }
      this.getView().setBusy(true);
      var sNewId;

      Promise.resolve().then(function () {
        return that._deleteEmptyItemRows(oItemsBinding).then(function () {
          // This promise boundary also routes synchronous setup failures through the cleanup path.
          return CreateOrderService.save(oContext, oItemsBinding, that._oCreateSession, {
            shipToAddressId: that.getView().getModel("createEnrich").getProperty("/providerAddressId")
          });
        });
      })
        // Step ① succeeded — the order now exists (oNewContext is the real,
        // persisted context; the scratch context is already discarded by
        // CreateOrderService.save()). Enrichment failing from here on is a
        // partial-failure: the order stays created.
        .then(function (oResult) {
          var oNewContext = oResult.context;
          sNewId = oResult.orderId;
          var oEnrich = that.getView().getModel("createEnrich").getData();
          return CreateOrderService.saveNotes(oNewContext, oEnrich.notes).then(function () {
            return CreateOrderService.enrich(oNewContext, {
              contactId: oEnrich.contactId,
              employeeResponsibleId: oEnrich.employeeResponsibleId,
              status: oEnrich.status,
              shipToPartyId: oEnrich.shipToPartyId
            });
          }).then(function () {
            if (!oIohData.loaded) {
              return { skipped: true };
            }
            return ProviderInventoryService.save(
              sProviderId,
              oIohData.rows
            ).then(function (oInventoryResult) {
              if (oInventoryResult && oInventoryResult.Message) {
                MessageExtractor.addNote(oInventoryResult.Message, "Success");
              }
              return oInventoryResult;
            });
          }).catch(function (oError) {
            oError.orderCreatedId = sNewId;
            throw oError;
          });
        })
        .then(function () {
          that.getView().setBusy(false);
          MessageToast.show(oBundle.getText("createRequestSuccessToast",
            [that.getView().getModel("orderUi").getProperty("/title"), sNewId]));
          var bStartNew = !!that._bStartNewAfterSave;
          that._bStartNewAfterSave = false;
          that.byId("newOrderBtn").setEnabled(true);
          that._completeCreate(sNewId, bStartNew);
        }, function (oError) {
          that.getView().setBusy(false);
          that._bStartNewAfterSave = false;
          that.byId("newOrderBtn").setEnabled(true);
          if (oSaveBtn) {
            oSaveBtn.setEnabled(true);
          }
          // Fix 4 (MessageExtractor.js): targeted messages in the popover,
          // never a generic toast, kept from the Corrective Work Order.
          var aSectionIds = MessageExtractor.extract(oError, oContext.getPath(), oBundle);
          aSectionIds.forEach(function (sId) {
            that._oSectionFactory.expandSection(sId);
          });
          if (oError && oError.orderCreatedId) {
            // Enrichment failed but the order + its edits ARE committed —
            // exit createMode into the saved order; user completes the rest
            // via Change Mode (no compensating deletes). Message Accuracy &
            // Hygiene task: a tracked Messaging note, not a MessageToast, so
            // it shows in the same popover alongside the real backend
            // messages instead of a separate, easy-to-miss channel.
            MessageExtractor.addNote(oBundle.getText("createPartialFailure", [oError.orderCreatedId]), "Information");
            that._openMessagePopover();
            that._completeCreate(oError.orderCreatedId);
          } else {
            // step ① (CreateOrderService.save) itself failed — nothing was
            // created, stay in createMode to retry; messages already shown above.
            that._revertItemsToScratch();
            that._openMessagePopover();
          }
        });
    },

    // Rebind to the new order's real key, exit createMode, refresh the master
    // list (EventBus, channel "app" — Master.controller.js owns its own
    // table; deliberately distinct from the "vrCreate" update-group literal,
    // see CreateOrderService.js/ServiceSchema.js).
    _completeCreate: function (sNewId, bStartNew) {
      this._oCreateListBinding = null;
      this._oCreateSession = null;
      this._bItemsSessionBound = false;
      // Issue Batch 9-30-001 \u00a72: the new order's own post-save load is now
      // the authoritative server truth - any stale cached allocation from
      // this create session must not bleed into a later, unrelated create.
      FundLogicService.clearAllocationCache();
      this._setCreateMode(false);
      EventBus.getInstance().publish("app", "orderCreated", { orderId: sNewId });
      if (bStartNew) {
        this._enterCreateMode(this._sCreateOrderType);
      } else {
        this._oRouter.navTo("detail", { orderId: encodeURIComponent(sNewId) }, true);
      }
    },

    _createSectionFlagsModel: function () {
      // Shape mirrors the future resolver feed (status/orderType/user-driven).
      // `editLive` sections (Details, Items \u2014 CRUD Task 2) start enabled,
      // permissive-stub style (`// TODO: resolver feed`); every other editable
      // section stays visible-but-disabled ("later phase" placeholder).
      // CRUD Task 1 v3: `/createMode` is the one extra top-level dimension \u2014
      // true only for the lifetime of the "create" route; SectionFactory.js and
      // the fragments both read it directly (design/prompts/CRUD Task 1 Prompt v3.md
      // "sectionFlags gains a createMode dimension").
      var oData = { createMode: false };
      this._aSectionMeta.forEach(function (oMeta) {
        if (oMeta.editable) {
          oData[oMeta.id] = { editVisible: true, editEnabled: !!oMeta.editLive };
          if (oMeta.editLive) {
            oData[oMeta.id].editing = false;
          }
        }
      });
      return new JSONModel(oData);
    },

    _createSectionsNavModel: function () {
      var oBundle = this.getResourceBundle();
      var aList = this._aSectionMeta.map(function (oMeta) {
        return { id: oMeta.id, title: oBundle.getText(oMeta.titleKey), createVisible: !!oMeta.createVisible, visible: true };
      });
      return new JSONModel({ list: aList });
    },

    _onObjectMatched: function (oEvent) {
      var oArgs = oEvent.getParameter("arguments") || {};
      var sId = decodeURIComponent(oArgs.orderId || "");
      if (!sId) {
        return;
      }
      this._destroyCreateContext();
      this._resetCreateSaveState();
      this._setCreateMode(false);
      var sHeaderSelect = ["SAP__Messages", ServiceSchema.headerProperties.salesOrderType].concat(Object.keys(ServiceSchema.updatableHeaderProperties).map(function (sKey) {
        return ServiceSchema.updatableHeaderProperties[sKey];
      })).join(",");
      this.getView().bindElement({
        path: ServiceSchema.buildHeaderPath(sId),
        // Header property bindings (Order Reason/ExIS ID Input & ComboBox) have
        // no $$updateGroupId of their own (unsupported on ODataPropertyBinding) -
        // they inherit this context binding's update group instead.
        // Message Accuracy & Hygiene task, Gap 0: SAP__Messages (Common.v1.Messages,
        // RAP's bound-message channel) is opt-in via $select, not returned by
        // default - explicit $select here (not $$inheritExpandSelect, per the
        // workaround bindings already in play on this view) so a change-mode
        // PATCH failure can surface the same detailed backend messages F3893
        // receives automatically. Editable fields stay in the parent entity cache.
        parameters: { $$updateGroupId: ServiceSchema.editUpdateGroup, $select: sHeaderSelect },
        events: {
          dataReceived: this._syncOrderUiFromContext.bind(this)
        }
      });
      this._loadHeaderNotes(this.getView().getBindingContext());
      this._loadDetailContact(sId);
      this._sItemsUpdateGroup = ServiceSchema.editUpdateGroup;
      this._bindDetailHeader();
      this._computeHeaderTaxAmount();
      this._oSectionFactory.rebind();
      this._resetTransactionHistoryState(sId);
      this._refreshTransactionHistory();
    },

    // v5 (design/E008_CRUD1_v5_Sticky_Amendment.md): the "create" route
    // stands up a transient list-binding context (CreateOrderService.js#enter)
    // as a pure local scratchpad — a stand-in for the bindElement path the
    // "detail" route uses. No backend contact happens until Save.
    // The category scopes Create; deep links to a type outside it (or without CREATE) are refused.
    // Cross-app navigation passes the provider as an optional route query,
    // e.g. #<SemanticObject>-<action>&/create/ZKB?providerId=1000123.
    _onCreateMatched: function (oEvent) {
      var oArgs = oEvent.getParameter("arguments");
      var sOrderType = String(oArgs.orderType || "").toUpperCase();
      var sProviderId = String((oArgs["?query"] || {}).providerId || "").trim();
      if (this._getCreatableOrderTypes().indexOf(sOrderType) === -1) {
        MessageToast.show(this.getResourceBundle().getText("createOrderTypeNotAllowed", [sOrderType]));
        this._oRouter.navTo("master", {}, true);
        return;
      }
      this._enterCreateMode(sOrderType);
      if (sProviderId) {
        this._preselectProvider(sProviderId);
      }
    },

    // Resolve the route's provider before using the normal selection flow.
    // Prefer the configured sales area (distribution channel + division); if the
    // provider has no row for that exact sales area, fall back to its first row
    // (a provider may legitimately exist under a different sales area).
    _preselectProvider: async function (sProviderId) {
      const oView = this.getView();
      const oContext = oView.getBindingContext();
      const oBundle = this.getResourceBundle();

      const oLookupBinding = this._createProviderLookupBinding(sProviderId);

      oView.setBusy(true);
      try {
        const aContexts = await oLookupBinding.requestContexts(0, this.MAX_PROVIDER_ROWS);

        if (!this._isProviderPreselectionCurrent(oContext)) {
          return;
        }

        const aRows = aContexts.map(oRowContext => oRowContext.getObject());
        const oRow = this._selectBestProviderRow(aRows, ServiceSchema.salesArea);

        if (!oRow) {
          MessageBox.information(oBundle.getText("startupProviderNotFound", [sProviderId]), {
            title: oBundle.getText("startupProviderNotFoundTitle")
          });
          return;
        }

        this._applyProviderPick(this._mapRowToProviderPick(oRow));
      } catch (oError) {
        if (!this._isProviderPreselectionCurrent(oContext)) {
          return;
        }
        MessageExtractor.addNote(oBundle.getText("startupProviderLookupFailed", [sProviderId]), "Warning");
        MessageExtractor.extract(oError, oContext && oContext.getPath(), oBundle);
        this._openMessagePopover();
      } finally {
        if (oView.getBindingContext() === oContext) {
          oView.setBusy(false);
        }
        oLookupBinding.destroy();
      }
    },

    // --- Helpers : Begin : Provider Preselection ----------------------------------

    // Max provider rows to fetch for sales-area resolution.
    MAX_PROVIDER_ROWS: 20,

    // Builds the list binding that fetches a provider's sales-area rows.
    _createProviderLookupBinding: function (sProviderId) {
      const oProps = ServiceSchema.customerSalesAreaProperties;
      const oArea = ServiceSchema.salesArea;

      return this.getView().getModel().bindList(
        "/" + ServiceSchema.entitySets.customerSalesArea, undefined, undefined,
        [
          new Filter(oProps.salesOrganization, FilterOperator.EQ, oArea.salesOrganization),
          new Filter(oProps.customer, FilterOperator.EQ, sProviderId)
        ],
        {
          $select: [
            oProps.customer, oProps.customerName, oProps.cityName, oProps.postalCode,
            oProps.countryText, oProps.salesOrganization, oProps.distributionChannel,
            oProps.division
          ].join(",")
        }
      );
    },

    // Pure selection rule: prefer the exact sales-area match, else first row.
    // Kept dependency-free so it can be unit-tested without OData/UI mocks.
    _selectBestProviderRow: function (aRows, oArea) {
      const oProps = ServiceSchema.customerSalesAreaProperties;
      return aRows.find(oCandidate =>
        oCandidate[oProps.distributionChannel] === oArea.distributionChannel &&
        oCandidate[oProps.division] === oArea.organizationDivision
      ) || aRows[0];
    },

    // Maps a sales-area row to the provider-pick shape consumed by the UI.
    _mapRowToProviderPick: function (oRow) {
      const oProps = ServiceSchema.customerSalesAreaProperties;
      return {
        id: oRow[oProps.customer],
        fullName: oRow[oProps.customerName],
        address: this._formatProviderAddress(oRow),
        salesOrganization: oRow[oProps.salesOrganization],
        distributionChannel: oRow[oProps.distributionChannel],
        division: oRow[oProps.division]
      };
    },

    // Single source of truth for provider address formatting.
    _formatProviderAddress: function (oRow) {
      const oProps = ServiceSchema.customerSalesAreaProperties;
      return [oRow[oProps.cityName], oRow[oProps.postalCode], oRow[oProps.countryText]]
        .filter(Boolean)
        .join(", ");
    },

    _isProviderPreselectionCurrent: function (oContext) {
      const oView = this.getView();
      return oView.getBindingContext() === oContext &&
        oView.getModel("sectionFlags").getProperty("/createMode") &&
        !oView.getModel("createState").getProperty("/providerChosen");
    },

    // --- Helpers : End : Provider Preselection ----------------------------------

    _enterCreateMode: function (sOrderType) {
      this._destroyCreateContext();
      this._resetCreateSaveState();
      // A prior "detail" route visit leaves an active bindElement() on the
      // view - an element binding always wins over the plain
      // setBindingContext() below (UI5 propagation rules), so without this
      // every relative field/list would keep showing the last-viewed order.
      this.getView().unbindElement();
      this._sCreateOrderType = sOrderType;
      var oResult = CreateOrderService.enter(
        this.getView().getModel(),
        sOrderType,
        OrderModeConfig.resolveOrderType(sOrderType).defaults
      );
      this._oCreateListBinding = oResult.listBinding;
      this._oCreateSession = oResult.session;
      this._bItemsSessionBound = false;
      this._bPostingFirstItem = false;
      this._aPendingIncompleteRows = [];
      this._bInitialCreateItemRowsPending = true;
      this.getView().setBindingContext(oResult.context);
      this._sItemsUpdateGroup = ServiceSchema.createUpdateGroup;
      this._setCreateMode(true);
      this._applyOrderUi(sOrderType);
      this._resetTransactionHistoryState("");
      this._resetItemsTableForCreate();
      this._addInitialCreateItemRows();
      this._bindDetailHeader();
      // All createMode-visible sections are expanded/loaded simultaneously —
      // no per-section Edit buttons in createMode (design/prompts/CRUD Task 1
      // Prompt v3.md "Sections in edit simultaneously"). Order-type-hidden
      // sections are skipped.
      var oOrderUi = this.getView().getModel("orderUi").getData();
      this._aSectionMeta.forEach(function (oMeta) {
        if (oMeta.createVisible && OrderModeConfig.uiFlag(oOrderUi, "sections", oMeta.id, "visible")) {
          this._oSectionFactory.expandSection(oMeta.id);
        }
      }, this);
    },

    // The only place `orderUi` is set. Create mode applies the route's type,
    // onInit the category's first type; an existing order re-applies from its OWN SalesOrderType
    // (_syncOrderUiFromContext) - deliberate, an order displays per its type.
    _applyOrderUi: function (sOrderType) {
      var oMode = OrderModeConfig.resolveOrderType(sOrderType);
      var oView = this.getView();
      this._sOrderType = oMode.orderType;
      var aEditStatusOptions = oMode.editStatusOptions.length ? oMode.editStatusOptions : Enums.EDIT_STATUS;
      var oFlags = oView.getModel("sectionFlags");
      var oNav = oView.getModel("sectionsNav");
      oView.getModel("orderUi").setData(Object.assign({ title: this.getResourceBundle().getText(oMode.titleKey) }, oMode.ui));
      this._aSectionMeta.forEach(function (oMeta, iIndex) {
        oNav.setProperty("/list/" + iIndex + "/visible", OrderModeConfig.uiFlag(oMode.ui, "sections", oMeta.id, "visible"));
        if (oMeta.editable) {
          oFlags.setProperty("/" + oMeta.id + "/editVisible", OrderModeConfig.uiFlag(oMode.ui, "sections", oMeta.id, "editable"));
        }
      });
      oView.getModel("itemsColumns").setData(this._getItemsColumnVisibility());
      oView.getModel("enums").setProperty("/EDIT_STATUS", this._resolveEnumOptions(aEditStatusOptions));
      this._loadCategoryOptions(oMode);
      // A section un-hidden by this order type may already be expanded.
      this._oSectionFactory.rebind();
    },

    _loadCategoryOptions: function (oMode) {
      var oOrderUiModel = this.getView().getModel("orderUi");
      var iRequestToken = (this._iCategoryRequestToken || 0) + 1;

      this._iCategoryRequestToken = iRequestToken;
      if (oMode.categoryOptions.length) {
        oOrderUiModel.setProperty("/category", {
          limited: true,
          options: oMode.categoryOptions
        });
        if (oMode.createCategoryDefaultKey && this.getView().getModel("sectionFlags").getProperty("/createMode")) {
          var oCreateContext = this.getView().getBindingContext();
          if (oCreateContext) {
            oCreateContext.setProperty(ServiceSchema.headerProperties.category, oMode.createCategoryDefaultKey);
          }
        }
        return;
      }

      // Component model: _applyOrderUi also runs from onInit, before view model propagation.
      var oListBinding = this.getOwnerComponent().getModel().bindList(
        "/" + ServiceSchema.entitySets.customerPurchaseOrderType,
        undefined,
        undefined,
        undefined,
        { $select: ServiceSchema.valueHelpProperties.customerPurchaseOrderTypeCode + "," + ServiceSchema.valueHelpProperties.customerPurchaseOrderTypeText }
      );

      oOrderUiModel.setProperty("/category", {
        limited: false,
        options: []
      });

      oListBinding.requestContexts(0, 100).then(function (aContexts) {
        var aServiceOptions = aContexts.map(function (oContext) {
          return {
            key: oContext.getProperty(ServiceSchema.valueHelpProperties.customerPurchaseOrderTypeCode),
            text: oContext.getProperty(ServiceSchema.valueHelpProperties.customerPurchaseOrderTypeText)
          };
        });

        oListBinding.destroy();
        if (this._iCategoryRequestToken !== iRequestToken) {
          return;
        }

        oOrderUiModel.setProperty("/category/options", aServiceOptions);
      }.bind(this), function () {
        oListBinding.destroy();
      });
    },

    _syncOrderUiFromContext: function () {
      var oContext = this.getView().getBindingContext();
      this._applyOrderUi(oContext && oContext.getProperty(ServiceSchema.headerProperties.salesOrderType));
    },

    _getCreatableOrderTypes: function () {
      var oComponent = this.getOwnerComponent();
      var oAuth = oComponent.getModel("orderAuth");
      return (oComponent.getModel("orderContext").getProperty("/orderTypes") || []).map(function (oType) {
        return oType.orderType;
      }).filter(function (sOrderType) {
        return oAuth.getProperty("/types/" + sOrderType + "/CREATE") === true;
      });
    },

    // "New" keeps the current order's type when the launch category may create it.
    _getNewOrderType: function () {
      var aTypes = this._getCreatableOrderTypes();
      return aTypes.indexOf(this._sOrderType) !== -1 ? this._sOrderType : (aTypes[0] || this._sOrderType);
    },

    _onMasterMatched: function () {
      this._destroyCreateContext();
      this._resetCreateSaveState();
      this._setCreateMode(false);
      Messaging.removeAllMessages();
    },

    _resetCreateSaveState: function () {
      this.getView().setBusy(false);
      var oSaveButton = this.byId("createSaveBtn");
      if (oSaveButton) {
        oSaveButton.setEnabled(true);
      }
      var oNewButton = this.byId("newOrderBtn");
      if (oNewButton) {
        oNewButton.setEnabled(true);
      }
      this._bStartNewAfterSave = false;
    },

    // Cleans up a previous transient create context (e.g. the user leaves the
    // create route via the Close button/browser back instead of Save/Cancel) -
    // nothing was ever sent to the backend (its group is never submitted), so
    // a local delete is enough (CreateOrderService.cancel).
    _destroyCreateContext: function () {
      if (this._oCreateListBinding) {
        var oContext = this.getView().getBindingContext();
        if (oContext && oContext.isTransient && oContext.isTransient()) {
          CreateOrderService.cancel(oContext, this._oCreateSession);
        }
        MessageExtractor.clearStaleMessages();
        this._oCreateListBinding = null;
        this._oCreateSession = null;
        this._bItemsSessionBound = false;
        // Issue Batch 9-30-001 \u00a72: this create attempt is fully abandoned -
        // drop any allocation snapshots cached for it.
        FundLogicService.clearAllocationCache();
      }
    },

		toggleFullScreen: function (oEvent) {
      let _mdl = this.getOwnerComponent().getModel('appView'),
          bFullScreen = _mdl.getProperty("/actionButtonsInfo/midColumn/fullScreen");
			
      _mdl.setProperty("/actionButtonsInfo/midColumn/fullScreen", !bFullScreen);
			if (bFullScreen) {
				// store current layout and go full screen
				_mdl.setProperty("/previousLayout", _mdl.getProperty("/layout"));
				_mdl.setProperty("/layout", "TwoColumnsMidExpanded");
			} else {
				// reset to previous layout
				_mdl.setProperty("/layout",  _mdl.getProperty("/previousLayout"));
			}

		},

    _bindDetailHeader: function () {
      var oView = this.getView();

      oView.byId("detailTitle").bindProperty("text", {
        parts: [
          { path: ServiceSchema.keys.orderId },
          { path: ServiceSchema.navigation.headerToContactInfo + "/" + ServiceSchema.contactProperties.fullName },
          { path: "orderUi>/title" },
          { path: "orderUi>/title" }
        ],
        formatter: formatter.detailTitle.bind(formatter)
      });

      oView.byId("detailStatus")
        .bindProperty("text", {
          path: ServiceSchema.headerProperties.userStatus,
          formatter: formatter.detailStatusText.bind(formatter)
        })
        .bindProperty("status", {
          path: ServiceSchema.headerProperties.userStatus,
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

      this._bindDetailsSectionTitle();
    },

    // Details/Items section Panel titles = "<order type title> Details"/"...
    // Items" (formatter.orderTypeSectionTitle) - a separate method (not folded
    // into _bindDetailHeader) because the Panels/Titles are created lazily by
    // SectionFactory.ensurePanels() and may not exist yet the first time
    // _bindDetailHeader runs (see onAfterRendering).
    _bindDetailsSectionTitle: function () {
      [
        { id: "details-title", textKey: "sectionDetails" },
        { id: "items-title", textKey: "sectionItems" }
      ].forEach(function (oTitleMeta) {
        var oTitle = this.byId(oTitleMeta.id);
        if (!oTitle) {
          return;
        }
        oTitle.bindProperty("text", {
          parts: [
            { path: "orderUi>/title" },
            { path: "i18n>" + oTitleMeta.textKey }
          ],
          formatter: formatter.orderTypeSectionTitle
        });
      }, this);
    },

    getResourceBundle: function () {
      return this.getOwnerComponent().getModel("i18n").getResourceBundle();
    }
  });
});
