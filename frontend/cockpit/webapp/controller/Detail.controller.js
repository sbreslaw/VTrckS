sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/m/MessagePopover",
  "sap/m/MessageItem",
  "sap/m/Dialog",
  "sap/m/Button",
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
  "sap/ui/core/Item",
  "sap/ui/core/Fragment",
  "sap/ui/core/Messaging",
  "sap/ui/core/EventBus",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/export/Spreadsheet",
  "cdc/vaccreq/sections/SectionFactory",
  "cdc/vaccreq/sections/SectionConfig",
  "cdc/vaccreq/model/formatter",
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/VariantStore",
  "cdc/vaccreq/model/Enums",
  "cdc/vaccreq/model/MessageExtractor",
  "cdc/vaccreq/service/EditRequestService",
  "cdc/vaccreq/service/CreateOrderService",
  "cdc/vaccreq/service/FundLogicService",
  "cdc/vaccreq/controller/FundSplitDialog"
], function (
  Controller, MessageToast, MessageBox, MessagePopover, MessageItem, Dialog, Button, Text,
  List, CustomListItem, CheckBox, HBox, VBox, Select, Input, Label, SelectDialog, StandardListItem, CoreItem, Fragment,
  Messaging, EventBus, JSONModel, Filter, FilterOperator, Spreadsheet, SectionFactory, SectionConfig, formatter, ServiceSchema, VariantStore, Enums, MessageExtractor,
  EditRequestService, CreateOrderService, FundLogicService, FundSplitDialog
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
    { id: "JDOE", name: "John Doe" },
    { id: "ASMITH", name: "Alice Smith" },
    { id: "BJONES", name: "Bob Jones" }
  ];

  // Items fundType (MaterialGroup2) Select source - was a hardcoded core:Item
  // list in Items.fragment.xml, now a data-driven "fundTypes" model
  // (_createFundTypesModel) so targetField (this fund type's own quantity
  // mirror property) travels with each entry for onFundTypeChange/
  // onProdQtyChange to look up, instead of a second hand-maintained map.
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
      // Single source of truth for the panel stack: SectionConfig.js. The anchor
      // strip (sectionsNav model, below) and the sectionFlags model are both
      // derived from this same array, so a new section added there appears in
      // both automatically (Phase 2 Prompt v2, P1 item 2).
      this._aSectionMeta = SectionConfig;
      this._oSectionFactory = new SectionFactory(this.getView(), this._aSectionMeta, this._onSectionContentLoaded.bind(this));
      this.getView().setModel(this._createSectionFlagsModel(), "sectionFlags");
      this.getView().setModel(this._createSectionsNavModel(), "sectionsNav");
      this.getView().setModel(Messaging.getMessageModel(), "message");
      this.getView().setModel(new JSONModel(this._getItemsColumnVisibility()), "itemsColumns");
      // CRUD Task 1 v3: IoH has no backend context pre-save (CR-002, local rows
      // only until step ③) — a plain local JSON model, reset each time createMode
      // is entered (_setCreateMode).
      this.getView().setModel(new JSONModel({ rows: [] }), "ioh");
      // CRUD Task 1 v4: Contact/Employee Responsible/Priority/Category/Status/
      // Shipping-Provider have no real writable field yet (all part of the
      // still-unbuilt enrichment action, ADDENDUM-001) - local-only model, reset
      // each time createMode is entered (_setCreateMode), sent as the enrichment
      // payload at Save (still a no-op today, see CreateOrderService.js#enrich).
      this.getView().setModel(new JSONModel(this._createEnrichDefaults()), "createEnrich");
      this.getView().setModel(this._createEnumsModel(), "enums");
      this.getView().setModel(this._createFundTypesModel(), "fundTypes");
      // v5 ("UX phasing + triad sourcing"): createMode opens with only the
      // Provider field enabled; every other createMode field/Add-row button
      // binds `enabled` off this flag and unlocks once a Provider is picked
      // (onProviderValueHelpRequest below) - reset each time createMode is
      // (re-)entered, see _setCreateMode.
      this.getView().setModel(new JSONModel({ providerChosen: false }), "createState");
      this._sItemsUpdateGroup = ServiceSchema.editUpdateGroup;
      // Session Prompt (Detail View Adjustments) 3.1: virtual header Priority -
      // {value, valueText, mixed, dirty} computed from/propagated to item
      // DeliveryPriority (see _computeHeaderPriority/_propagatePriorityToItems),
      // reset on entering createMode (_setCreateMode).
      this.getView().setModel(new JSONModel({ value: "", valueText: "", mixed: false, dirty: false }), "priorityState");
      // 3.3: client-side-only SUM of item TaxAmount - never a real header
      // property, see _computeHeaderTaxAmount.
      this.getView().setModel(new JSONModel({ taxAmount: 0 }), "headerCalc");
      this._loadDeliveryPriorityVH();

    },

    onAfterRendering: function () {
      this._oSectionFactory.ensurePanels();
      // First-ever render can race _onObjectMatched/_onCreateMatched (the
      // "details-title" control doesn't exist until ensurePanels() runs) -
      // (re)apply the binding here too, it's idempotent.
      this._bindDetailsSectionTitle();
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

    onRefresh: function () {
      var oContext = this.getView().getBindingContext();
      if (oContext) {
        oContext.refresh();
      }
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
      var oVisibility = {};
      ITEMS_COLUMN_KEYS.forEach(function (sKey) {
        oVisibility[sKey] = oSaved && oSaved[sKey] === false ? false : true;
      });
      return oVisibility;
    },

    onItemsExport: function (oEvent) {
      var oTable = oEvent.getSource().getParent().getParent();
      var oBinding = oTable.getBinding("items");
      var aContexts = oBinding ? oBinding.getContexts(0, oBinding.getLength()) : [];
      var oBundle = this.getResourceBundle();
      var oVisibility = this.getView().getModel("itemsColumns").getData();

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
          rejectionReason: oCtx.getProperty(ServiceSchema.navigation.itemToRejectionReason + "/" + ServiceSchema.itemProperties.rejectionReasonText)
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
      var oWorkingModel = new JSONModel({
        rows: ITEMS_COLUMN_KEYS.filter(function (sKey) { return sKey !== "rowAction"; }).map(function (sKey) {
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
              subtitle: "{message>additionalText}",
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
    },

    onSectionCancelPress: function (sSectionId) {
      var oContext = this.getView().getBindingContext();
      if (oContext) {
        EditRequestService.cancel(oContext);
      }
      this._endEditSession(sSectionId);
    },

    // Sections whose display Text reads a code's expanded to-one nav-property
    // text (e.g. Order Reason code -> _SDDocumentReason/SDDocumentReason_Text):
    // changing the code points that nav at a *different* entity, and
    // requestSideEffects errors on that ("Key predicate ... changed") since it
    // expects a nav's target identity to stay stable. A full context reload
    // (same as reopening the order) sidesteps that merge check entirely.
    _aSectionsNeedingFullReload: ["details", "shipping", "orgData", "billing"],

    onSectionSavePress: function (sSectionId) {
      var that = this;
      var oContext = this.getView().getBindingContext();
      var oBundle = this.getResourceBundle();
      if (!oContext) {
        return;
      }
      // Session Prompt (Detail View Adjustments) 3.1: the "details" section's
      // own Save is also the only trigger for propagating a changed/mixed
      // header Priority selection down onto every item - staged into the same
      // "vrEdit" group EditRequestService.save is about to submitBatch, so it
      // rides along in the very same request as the header PATCH below.
      var oPriorityModel = this.getView().getModel("priorityState");
      var oPropagatePromise = Promise.resolve();
      if (sSectionId === "details" && (oPriorityModel.getProperty("/dirty") || oPriorityModel.getProperty("/mixed")) && oPriorityModel.getProperty("/value")) {
        oPropagatePromise = this._propagatePriorityToItems(oContext, oPriorityModel.getProperty("/value"));
      }
      oPropagatePromise.then(function () {
        return EditRequestService.save(oContext);
      }).then(function () {
        MessageToast.show(oBundle.getText("editSaveSuccess"));
        if (that._aSectionsNeedingFullReload.indexOf(sSectionId) !== -1) {
          that._reloadHeaderContext(oContext.getPath());
        }
        // No explicit master-row refresh call: the Master list binds the same
        // OData V4 model/entity instance, whose cache the PATCH response
        // already updated \u2014 any bound row for this order reflects it automatically.
        that._endEditSession(sSectionId);
        if (sSectionId === "details") {
          that._computeHeaderPriority();
        }
        if (sSectionId === "items") {
          that._computeHeaderTaxAmount();
        }
      }, function (oError) {
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
      this.getView().unbindElement();
      this.getView().bindElement({
        path: sPath,
        parameters: { $$updateGroupId: ServiceSchema.editUpdateGroup }
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

    onItemsAddRow: function () {
      var oTable = this._byIdInSection("items", "itemsTable");
      var oBinding = oTable && oTable.getBinding("items");
      if (!oBinding) {
        return;
      }
      oBinding.create({
        Product: "",
        RequestedQuantity: null,
        RequestedQuantityUnit: ServiceSchema.createPayloadUom,
        // SalesOrderItem is @Core.Computed (design/so.xml) - the real number
        // is always assigned server-side at Save; this is only a client-side
        // placeholder (SD +10 numbering convention) so a newly-added row
        // doesn't display blank until then.
        SalesOrderItem: this._computeNextItemNumber(oBinding),
        // Nullable="false" (design/so.xml) - seeded here too, not just on
        // change (onProdQtyChange/onFundTypeChange), so a row never carries
        // an unset Int32.
        ZZVFCQTY: 0,
        ZZ317QTY: 0,
        ZZSTATEQTY: 0,
        ZZCHIPQTY: 0,
        ZZPANQTY: 0,
        ZZRESQTY: 0
      });
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
      var oProps = ServiceSchema.productProperties;
      var oBundle = this.getResourceBundle();
      var oRowContext = oEvent.getSource().getBindingContext();
      this._openProductValueHelpDialog(oBundle.getText("ndcCodePickerTitle"), function (oItem) {
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
      });
    },

    // Looks up the fund type entry (FUND_TYPES/"fundTypes" model) matching
    // the row's current MaterialGroup2 selection.
    _getFundTypeEntry: function (sFundTypeKey) {
      var aList = this.getView().getModel("fundTypes").getProperty("/list");
      return aList.filter(function (oEntry) { return oEntry.key === sFundTypeKey; })[0];
    },

    onProdQtyChange: function( oEvent) {
      var oRowContext = oEvent.getSource().getBindingContext();
      var sQty = oEvent.getParameter('value');
      // ZZVFCQTY/ZZ317QTY/etc. are Edm.Int32 (design/so.xml) - RequestedQuantity
      // is Edm.Decimal, so this Input's own "value" here is that type's
      // formatted decimal string (e.g. "67.000"); sending that verbatim
      // for an Int32 property fails with "invalid value", and the Gateway's
      // OWN error response for that failure comes back malformed enough
      // that the client can't even parse it ("Error while parsing an XML
      // stream") - always send a real, rounded integer instead.
      var iQty = Math.round(parseFloat(sQty));
      // A2/A4: which quantity mirror gets the value now follows the row's own
      // fundType selection (see onFundTypeChange) instead of always ZZSTATEQTY.
      var oFundType = this._getFundTypeEntry(oRowContext.getProperty(ServiceSchema.itemProperties.fundType));
      if (oFundType && oFundType.targetField) {
        oRowContext.setProperty(oFundType.targetField, isNaN(iQty) ? 0 : iQty);
      }

      oRowContext.setProperty('ZZ1_SKIPADDANC_SDI', true);
    },

    // Items fundType (MaterialGroup2) change - mirrors the row's current
    // RequestedQuantity onto the newly-selected fund type's own targetField
    // and clears every other fund type's targetField (only one is ever
    // active per item).
    onFundTypeChange: function (oEvent) {
      var oSelectedItem = oEvent.getParameter("selectedItem");
      var sKey = oSelectedItem ? oSelectedItem.getKey() : oEvent.getSource().getSelectedKey();
      var oRowContext = oEvent.getSource().getBindingContext();
      var iQty = Math.round(parseFloat(oRowContext.getProperty(ServiceSchema.itemProperties.quantity)));
      var iValue = isNaN(iQty) ? 0 : iQty;
      this.getView().getModel("fundTypes").getProperty("/list").forEach(function (oEntry) {
        if (oEntry.targetField) {
          oRowContext.setProperty(oEntry.targetField, oEntry.key === sKey ? iValue : 0);
        }
      });
      // Fund Split dialog session prompt, Trigger 1: selecting SPLIT opens the
      // allocation dialog in edit mode immediately - no
      // FundLogicService.applyFundSelection hook exists yet, wired directly here.
      if (FundLogicService.isSplitFund(sKey)) {
        this._getFundSplitDialog().open(oRowContext, "edit");
      }
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
      var oFundType = this._getFundTypeEntry(oRowContext.getProperty(ServiceSchema.itemProperties.fundType));
      if (oFundType && !formatter.fundTypeItemEnabled(sIntention, oFundType.pediatricOnly, oFundType.disabled)) {
        oRowContext.setProperty(ServiceSchema.itemProperties.fundType, "");
        this.getView().getModel("fundTypes").getProperty("/list").forEach(function (oEntry) {
          if (oEntry.targetField) {
            oRowContext.setProperty(oEntry.targetField, 0);
          }
        });
      }
    },

    // Item Details view session prompt, 3.4: Items row Action menu "Edit" ->
    // FCL end column, always full screen (session prompt 3.1). Row context
    // supplies the SalesOrder/SalesOrderItem keys for the new route.
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
        itemPath: encodeURIComponent(sItemNumber)
      });
    },

    // Real, batched DELETE on the row's own bound-entity context - rides the
    // same update group as the rest of the Items section's edit session
    // (change-mode "vrEdit" or createMode "vrCreate", see _rebindItemsGroup),
    // so it is only sent when that section's Save actually runs.
    onItemsDeleteRow: function (oEvent) {
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
          oRowContext.delete().then(function () {
            MessageToast.show(oBundle.getText("itemsDeleteSuccess"));
          }, function () {
            MessageToast.show(oBundle.getText("itemsDeleteError"));
          });
        }
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
      // v5 (design/E008_CRUD1_v5_Sticky_Amendment.md): all createMode
      // sections are editable immediately — there is no separate
      // "bootstrapped" state anymore (the scratch context from _onCreateMatched
      // is already a real, if transient, binding target for every fragment).
      this._aCreateModeEditingSections.forEach(function (sId) {
        oFlags.setProperty("/" + sId + "/editing", bOn);
      });
      if (bOn) {
        this.getView().getModel("ioh").setProperty("/rows", []);
        this.getView().getModel("createEnrich").setData(this._createEnrichDefaults());
        this.getView().getModel("createState").setProperty("/providerChosen", false);
        this.getView().getModel("priorityState").setData({ value: "", valueText: "", mixed: false, dirty: false });
        this.getView().getModel("headerCalc").setProperty("/taxAmount", 0);
      }
    },

    // Resolves Enums.js's {key, i18nKey} lists into {key, text} once, so the
    // createMode Selects (Status only - Priority/Category are now backed by
    // real service value helps, see Details.fragment.xml) can bind items/text
    // directly without a runtime i18n lookup in the XML.
    _createEnumsModel: function () {
      var oBundle = this.getResourceBundle();
      function resolve(aList) {
        return aList.map(function (oEntry) {
          return { key: oEntry.key, text: oBundle.getText(oEntry.i18nKey) };
        });
      }
      return new JSONModel({
        STATUS: resolve(Enums.STATUS)
      });
    },

    // Resolves FUND_TYPES (module constant above) into the "fundTypes" model
    // Items.fragment.xml's MaterialGroup2 Select binds items/change against -
    // targetFieldKey is resolved here to the real property name
    // (ServiceSchema.itemProperties) so onFundTypeChange/onProdQtyChange/
    // onItemsAddRow never hand-maintain a second copy of that mapping.
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
        contactId: "",
        contactName: "",
        employeeResponsibleId: this._getCurrentUserId(),
        employeeResponsibleName: this._getCurrentUserFullName(),
        status: "",
        shipToPartyId: "",
        shipToPartyName: ""
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
      var oProps = ServiceSchema.providerOrderService.providerContactProperties;
      var oModel = this.getView().getModel("po");
      var oToday = new Date();
      var oListBinding = oModel.bindList("/" + ServiceSchema.providerOrderService.entitySets.providerContact, undefined, undefined,
        new Filter(oProps.businessPartnerCompany, FilterOperator.EQ, sProviderId), {
          $select: [oProps.businessPartnerPerson, oProps.businessPartnerPersonText,
            oProps.validityStartDate, oProps.validityEndDate].join(",")
        });

      oListBinding.requestContexts(0, 500).then(function (aContexts) {
        var aValidRows = aContexts.map(function (oCtx) { return oCtx.getObject(); }).filter(function (oRow) {
          var oStart = oRow[oProps.validityStartDate] ? new Date(oRow[oProps.validityStartDate]) : null;
          var oEnd = oRow[oProps.validityEndDate] ? new Date(oRow[oProps.validityEndDate]) : null;
          return (!oStart || oStart <= oToday) && (!oEnd || oEnd >= oToday);
        });
        var oPickerModel = new JSONModel({ rows: aValidRows });
        var oDialog = new SelectDialog({
          title: sTitle,
          growing: true,
          items: {
            path: "picker>/rows",
            template: new StandardListItem({
              title: "{picker>" + oProps.businessPartnerPersonText + "}",
              description: "{picker>" + oProps.businessPartnerPerson + "}"
            })
          },
          search: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var oBinding = oEvent.getSource().getBinding("items");
            oBinding.filter(sValue ? new Filter(oProps.businessPartnerPersonText, FilterOperator.Contains, sValue) : []);
          },
          confirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
              fnApply(oSelectedItem.getBindingContext("picker").getObject());
            }
            oDialog.destroy();
          },
          cancel: function () {
            oDialog.destroy();
          }
        });
        oDialog.setModel(oPickerModel, "picker");
        that.getView().addDependent(oDialog);
        oDialog.open();
      });
    },

    // NDC Code VH backed by this same service's own top-level `/Product`
    // EntitySet (ProductType) - search by material description or code.
    // Session Prompt (Detail View Adjustments) 3.7: $select now also includes
    // BaseUnit (ServiceSchema.productProperties.baseUnit), carried over to the
    // picked row's RequestedQuantityUnit (onItemNdcValueHelpRequest) so Items
    // UOM can go back to being read-only.
    _openProductValueHelpDialog: function (sTitle, fnApply) {
      var oProps = ServiceSchema.productProperties;
      var oDialog = new SelectDialog({
        title: sTitle,
        growing: true,
        items: {
          path: "/" + ServiceSchema.entitySets.product,
          parameters: {
            $select: [oProps.id, oProps.text, oProps.industryStandardName, oProps.baseUnit].join(",")
          },
          template: new StandardListItem({
            title: "{" + oProps.id + "}",
            description: "{" + oProps.text + "}"
          })
        },
        search: function (oEvent) {
          var sValue = oEvent.getParameter("value");
          var oBinding = oEvent.getSource().getBinding("items");
          oBinding.filter(sValue ? new Filter({
            filters: [
              new Filter(oProps.id, FilterOperator.Contains, sValue),
              new Filter(oProps.text, FilterOperator.Contains, sValue)
            ],
            and: false
          }) : []);
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
      this.getView().addDependent(oDialog);
      oDialog.open();
    },

    // Best-effort Contact prefill after a Provider is picked: was meant to take
    // the most recent `/StandardPartnerContactInfo` row for that SoldToParty as
    // a stand-in "main contact", but the backend query provider
    // (CL_SD_S4H_STD_PARTNER_CONTACT) rejects ANY standalone query on this
    // entity set with 501 Not Implemented (confirmed live, filtered or not) -
    // Session Prompt (Detail View Adjustments) 3.5: Contact is now backed by a
    // DIFFERENT, real, filterable entity set (po>/ProviderContact) - but no
    // auto-prefill rule was specified (only "clear on provider change"), and a
    // best-effort auto-pick here would be guessing at ranking criteria never
    // given - still always left blank for manual selection via the new VH
    // (onContactValueHelpRequest below).
    _prefillMainContact: function (sProviderId) {
      this.getView().getModel("createEnrich").setProperty("/contactName", "");
      this.getView().getModel("createEnrich").setProperty("/contactId", "");
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
      var oBundle = this.getResourceBundle();
      var oContext = this.getView().getBindingContext();
      // _openShipToPartyValueHelpDialog's fnApply gets a normalized
      // {id, fullName, address, salesOrganization, distributionChannel,
      // division} shape (composed from CustomerSalesArea's fields), not a raw
      // ServiceSchema property-name lookup.
      this._openShipToPartyValueHelpDialog(oBundle.getText("providerPickerTitle"), function (oItem) {
        oContext.setProperty(ServiceSchema.headerProperties.providerId, oItem.id);
        oContext.setProperty(ServiceSchema.headerProperties.salesOrganization, oItem.salesOrganization);
        oContext.setProperty(ServiceSchema.headerProperties.distributionChannel, oItem.distributionChannel);
        oContext.setProperty(ServiceSchema.headerProperties.division, oItem.division);
        var oEnrichModel = that.getView().getModel("createEnrich");
        oEnrichModel.setProperty("/providerName", oItem.fullName);
        oEnrichModel.setProperty("/providerAddress", oItem.address);
        that.getView().getModel("createState").setProperty("/providerChosen", true);
        that._prefillMainContact(oItem.id);
      });
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
      this._openProviderContactValueHelpDialog(oBundle.getText("contactPickerTitle"), sProviderId, function (oItem) {
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
      oBindingInfo.parameters = Object.assign({}, oBindingInfo.parameters, { $$updateGroupId: sGroupId, $select: "SAP__Messages" });
      oTable.bindItems(oBindingInfo);
    },

    // SectionFactory.js content-loaded hook \u2014 fires once per section the
    // first time its fragment content loads (user expand or a forced createMode
    // expand). Only "items" needs a reaction (see _rebindItemsGroup above).
    _onSectionContentLoaded: function (sSectionId) {
      if (sSectionId === "items") {
        this._rebindItemsGroup(this._sItemsUpdateGroup);
        // 3.3: the Items panel's own contexts are the most convenient point
        // to (re)confirm the header Tax Amount sum once real item data is
        // actually loaded (change mode - createMode items have no server-
        // computed TaxAmount yet, see _computeHeaderTaxAmount doc comment).
        this._computeHeaderTaxAmount();
      }
    },

    // --- Session Prompt (Detail View Adjustments) 3.1: virtual header
    // Priority. DeliveryPriority only exists on SalesOrderItemType (so.xml) -
    // there is still no header-level property/nav to bind. The header
    // "Priority" Select (Details.fragment.xml) is backed by the local
    // "priorityState" model instead: on load, computed from every item's
    // DeliveryPriority (uniform -> that value, mixed -> the highest-priority
    // value found + a "mixed" hint); user changes are only PROPAGATED to
    // every item at Save (never live) - see _propagatePriorityToItems below,
    // called from onCreateSavePress (createMode) / onSectionSavePress
    // (change mode, "details" section only). ---

    // One-time load of the real /DeliveryPriority VH entity set (small fixed
    // list) - used both as the Select's own items source (Details.fragment.xml
    // binds directly to "/DeliveryPriority") and as a text lookup cache so the
    // read-only Text display (priorityState>/valueText) doesn't need its own
    // per-row nav-property read.
    _loadDeliveryPriorityVH: function () {
      var that = this;
      var oProps = ServiceSchema.valueHelpProperties;
      this._mPriorityText = {};
      // getView().getModel() can still be undefined this early (onInit runs
      // before the view's own model propagation from the owner component
      // completes) - the component's model is already guaranteed to exist.
      var oModel = this.getOwnerComponent().getModel();
      var oListBinding = oModel.bindList("/" + ServiceSchema.entitySets.deliveryPriority);
      oListBinding.requestContexts(0, 100).then(function (aContexts) {
        aContexts.forEach(function (oCtx) {
          that._mPriorityText[oCtx.getProperty(oProps.deliveryPriorityCode)] = oCtx.getProperty(oProps.deliveryPriorityText);
        });
      }, function () {
        // Non-fatal - the Select control resolves its own display text from
        // its bound items regardless; this cache only backs the read-only
        // Text control's display.
      });
    },

    // Reads every item's DeliveryPriority for the current (existing) order and
    // derives the header's display value: no items/none set -> blank; one
    // distinct value -> that value; more than one distinct value -> "mixed",
    // displaying the highest-priority value found.
    // TODO-VERIFY(priority-ordering): this assumes the standard SD convention
    // that a LOWER DeliveryPriority code is MORE urgent (e.g. "01" = highest
    // priority) - so "highest priority" = the lowest code, ascending sort,
    // first element. Never independently confirmed against live VH data this
    // session (no backend access) - re-verify against the real /DeliveryPriority
    // list (and its sort order/any ranking annotation) before relying on this
    // in production.
    _computeHeaderPriority: function () {
      var that = this;
      var oContext = this.getView().getBindingContext();
      var oPriorityModel = this.getView().getModel("priorityState");
      if (!oContext || (oContext.isTransient && oContext.isTransient())) {
        return;
      }
      var oModel = oContext.getModel();
      var oItemsBinding = oModel.bindList(ServiceSchema.navigation.headerToItems, oContext, undefined, undefined, {
        $select: ServiceSchema.itemProperties.deliveryPriority
      });
      oItemsBinding.requestContexts(0, 9999).then(function (aContexts) {
        var aCodes = aContexts
          .map(function (oCtx) { return oCtx.getProperty(ServiceSchema.itemProperties.deliveryPriority); })
          .filter(function (sCode) { return !!sCode; });
        if (!aCodes.length) {
          oPriorityModel.setData({ value: "", valueText: "", mixed: false, dirty: false });
          return;
        }
        var aUnique = aCodes.filter(function (sCode, iIndex, aAll) { return aAll.indexOf(sCode) === iIndex; });
        aUnique.sort();
        var sValue = aUnique[0];
        oPriorityModel.setData({
          value: sValue,
          valueText: that._mPriorityText[sValue] || sValue,
          mixed: aUnique.length > 1,
          dirty: false
        });
      });
    },

    // Change handler for the header Priority Select (Details.fragment.xml) -
    // only updates local state; the actual per-item propagation happens at
    // Save (onCreateSavePress/onSectionSavePress), never here.
    onPriorityChange: function (oEvent) {
      var oSelectedItem = oEvent.getParameter("selectedItem");
      var sKey = oSelectedItem ? oSelectedItem.getKey() : oEvent.getSource().getSelectedKey();
      var oPriorityModel = this.getView().getModel("priorityState");
      oPriorityModel.setProperty("/value", sKey);
      oPriorityModel.setProperty("/valueText", this._mPriorityText[sKey] || sKey);
      if (!this.getView().getModel("sectionFlags").getProperty("/createMode")) {
        oPriorityModel.setProperty("/dirty", true);
      }
    },

    // Change-mode propagation: PATCHes DeliveryPriority onto every item of
    // the current (existing) order, in the same "vrEdit" group as the
    // Details section's own header PATCH - both ride the same submitBatch
    // call in onSectionSavePress, so nothing is sent until the user actually
    // presses Save on that section. Returns a promise (resolves once the
    // item contexts are fetched and their property changes are staged -
    // NOT once they're sent; sending happens via EditRequestService.save's
    // own submitBatch).
    _propagatePriorityToItems: function (oContext, sPriorityValue) {
      var oModel = oContext.getModel();
      var oItemsBinding = oModel.bindList(ServiceSchema.navigation.headerToItems, oContext, undefined, undefined, {
        $$updateGroupId: ServiceSchema.editUpdateGroup,
        $select: ServiceSchema.itemProperties.deliveryPriority
      });
      return oItemsBinding.requestContexts(0, 9999).then(function (aContexts) {
        aContexts.forEach(function (oItemContext) {
          oItemContext.setProperty(ServiceSchema.itemProperties.deliveryPriority, sPriorityValue);
        });
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
          })
        }
      });
      var oCustomerInput = new Input({
        value: "{addParty>/customerName}",
        editable: false,
        showValueHelp: true,
        valueHelpOnly: true,
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

    onIohAddRow: function () {
      var oModel = this.getView().getModel("ioh");
      var aRows = oModel.getProperty("/rows");
      aRows.push({ ndc: "", lot: "", quantity: null, expirationDate: null });
      oModel.setProperty("/rows", aRows);
    },

    onIohDeleteRow: function (oEvent) {
      var oModel = this.getView().getModel("ioh");
      var oRowContext = oEvent.getSource().getBindingContext("ioh");
      var iIndex = Number(oRowContext.getPath().split("/").pop());
      var aRows = oModel.getProperty("/rows");
      aRows.splice(iIndex, 1);
      oModel.setProperty("/rows", aRows);
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

      if (oContext && CreateOrderService.isDirty(oContext)) {
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
    // retry. Enrichment/IoH failing AFTER that (the order already exists) is
    // the actual partial-failure case: exit createMode into the saved order
    // for completion via Change Mode.
    onCreateSavePress: function () {
      var that = this;
      var oBundle = this.getResourceBundle();
      var oContext = this.getView().getBindingContext();
      if (!oContext) {
        return;
      }

      // Guard against a double-click firing the ①-④ replay (and its backend
      // SaveChanges commit) twice before setBusy(true)'s overlay blocks input.
      var oSaveBtn = this.getView().byId("createSaveBtn");
      if (oSaveBtn && !oSaveBtn.getEnabled()) {
        return;
      }

      if (!oContext.getProperty(ServiceSchema.headerProperties.providerId)) {
        MessageToast.show(oBundle.getText("createRequestFieldRequired"));
        this._oSectionFactory.expandSection("details");
        return;
      }

      var oItemsTable = this._byIdInSection("items", "itemsTable");
      var oItemsBinding = oItemsTable && oItemsTable.getBinding("items");
      if (!CreateOrderService.hasMinItems(oItemsBinding)) {
        MessageToast.show(oBundle.getText("createRequestMinItemsError"));
        this._oSectionFactory.expandSection("items");
        return;
      }

      if (oSaveBtn) {
        oSaveBtn.setEnabled(false);
      }
      this.getView().setBusy(true);
      var sNewId;

      // Session Prompt (Detail View Adjustments) 3.1: harvest the createMode
      // Priority Select's value onto every scratch item context BEFORE the
      // replay - CreateOrderService.js's item deep-create step copies ALL own
      // properties of each scratch context (not a fixed whitelist), so this
      // needs no other change there to actually replay.
      var sCreatePriority = this.getView().getModel("priorityState").getProperty("/value");
      if (sCreatePriority && oItemsBinding) {
        oItemsBinding.getCurrentContexts().forEach(function (oItemContext) {
          oItemContext.setProperty(ServiceSchema.itemProperties.deliveryPriority, sCreatePriority);
        });
      }

      CreateOrderService.save(oContext, oItemsBinding)
        // Step ① succeeded — the order now exists (oNewContext is the real,
        // persisted context; the scratch context is already discarded by
        // CreateOrderService.save()). Enrichment/IoH failing from here on is a
        // partial-failure: the order stays created.
        .then(function (oResult) {
          var oNewContext = oResult.context;
          sNewId = oResult.orderId;
          var oEnrich = that.getView().getModel("createEnrich").getData();
          return CreateOrderService.enrich(oNewContext, {
            contactId: oEnrich.contactId,
            employeeResponsibleId: oEnrich.employeeResponsibleId,
            status: oEnrich.status,
            shipToPartyId: oEnrich.shipToPartyId
          }).catch(function (oError) {
            oError.orderCreatedId = sNewId;
            throw oError;
          });
        })
        .then(function () {
          return CreateOrderService.submitIoH(sNewId, that.getView().getModel("ioh").getProperty("/rows")).catch(function (oError) {
            oError.orderCreatedId = sNewId;
            throw oError;
          });
        })
        .then(function () {
          that.getView().setBusy(false);
          MessageToast.show(oBundle.getText("createRequestSuccessToast", [sNewId]));
          that._completeCreate(sNewId);
        }, function (oError) {
          that.getView().setBusy(false);
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
            // Enrichment/IoH failed but the order + its edits ARE committed —
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
            that._openMessagePopover();
          }
        });
    },

    // Rebind to the new order's real key, exit createMode, refresh the master
    // list (EventBus, channel "app" — Master.controller.js owns its own
    // table; deliberately distinct from the "vrCreate" update-group literal,
    // see CreateOrderService.js/ServiceSchema.js).
    _completeCreate: function (sNewId) {
      this._oCreateListBinding = null;
      this._setCreateMode(false);
      EventBus.getInstance().publish("app", "orderCreated", { orderId: sNewId });
      this._oRouter.navTo("detail", { orderId: encodeURIComponent(sNewId) }, true);
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
        return { id: oMeta.id, title: oBundle.getText(oMeta.titleKey), createVisible: !!oMeta.createVisible };
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
      this._setCreateMode(false);
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
        // receives automatically.
        parameters: { $$updateGroupId: ServiceSchema.editUpdateGroup, $select: "SAP__Messages" }
      });
      this._sItemsUpdateGroup = ServiceSchema.editUpdateGroup;
      this._bindDetailHeader();
      this._computeHeaderPriority();
      this._computeHeaderTaxAmount();
      this._oSectionFactory.rebind();
    },

    // v5 (design/E008_CRUD1_v5_Sticky_Amendment.md): the "create" route
    // stands up a transient list-binding context (CreateOrderService.js#enter)
    // as a pure local scratchpad — a stand-in for the bindElement path the
    // "detail" route uses. No backend contact happens until Save.
    _onCreateMatched: function () {
      this._destroyCreateContext();
      var oResult = CreateOrderService.enter(this.getView().getModel());
      this._oCreateListBinding = oResult.listBinding;
      this.getView().setBindingContext(oResult.context);
      this._sItemsUpdateGroup = ServiceSchema.createUpdateGroup;
      this._setCreateMode(true);
      this._bindDetailHeader();
      // All createMode-visible sections are expanded/loaded simultaneously —
      // no per-section Edit buttons in createMode (design/prompts/CRUD Task 1
      // Prompt v3.md "Sections in edit simultaneously").
      this._aSectionMeta.forEach(function (oMeta) {
        if (oMeta.createVisible) {
          this._oSectionFactory.expandSection(oMeta.id);
        }
      }, this);
    },

    // Cleans up a previous transient create context (e.g. the user leaves the
    // create route via the Close button/browser back instead of Save/Cancel) -
    // nothing was ever sent to the backend (its group is never submitted), so
    // a local delete is enough (CreateOrderService.cancel).
    _destroyCreateContext: function () {
      if (this._oCreateListBinding) {
        var oContext = this.getView().getBindingContext();
        if (oContext && oContext.isTransient && oContext.isTransient()) {
          CreateOrderService.cancel(oContext);
        }
        this._oCreateListBinding = null;
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
          { path: "i18n>detailTitlePrefix" },
          { path: "i18n>detailTitle" }
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

    // Details/Items section Panel titles = "<order type label> Details"/"...
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
            { path: ServiceSchema.headerProperties.salesOrderType },
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
