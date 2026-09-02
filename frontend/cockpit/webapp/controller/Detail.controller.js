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
  "sap/m/SelectDialog",
  "sap/m/StandardListItem",
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
  "cdc/vaccreq/service/CreateOrderService"
], function (
  Controller, MessageToast, MessageBox, MessagePopover, MessageItem, Dialog, Button, Text,
  List, CustomListItem, CheckBox, HBox, SelectDialog, StandardListItem, Fragment,
  Messaging, EventBus, JSONModel, Filter, FilterOperator, Spreadsheet, SectionFactory, SectionConfig, formatter, ServiceSchema, VariantStore, Enums, MessageExtractor,
  EditRequestService, CreateOrderService
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
      // v5 ("UX phasing + triad sourcing"): createMode opens with only the
      // Provider field enabled; every other createMode field/Add-row button
      // binds `enabled` off this flag and unlocks once a Provider is picked
      // (onProviderValueHelpRequest below) - reset each time createMode is
      // (re-)entered, see _setCreateMode.
      this.getView().setModel(new JSONModel({ providerChosen: false }), "createState");
      this._sItemsUpdateGroup = ServiceSchema.editUpdateGroup;

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
      EditRequestService.save(oContext).then(function () {
        MessageToast.show(oBundle.getText("editSaveSuccess"));
        if (that._aSectionsNeedingFullReload.indexOf(sSectionId) !== -1) {
          that._reloadHeaderContext(oContext.getPath());
        }
        // No explicit master-row refresh call: the Master list binds the same
        // OData V4 model/entity instance, whose cache the PATCH response
        // already updated \u2014 any bound row for this order reflects it automatically.
        that._endEditSession(sSectionId);
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
        RequestedQuantityUnit: ServiceSchema.createPayloadUom
      });
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
      }
    },

    // Resolves Enums.js's {key, i18nKey} lists into {key, text} once, so the
    // createMode Selects (Priority/Category/Status) can bind items/text
    // directly without a runtime i18n lookup in the XML.
    _createEnumsModel: function () {
      var oBundle = this.getResourceBundle();
      function resolve(aList) {
        return aList.map(function (oEntry) {
          return { key: oEntry.key, text: oBundle.getText(oEntry.i18nKey) };
        });
      }
      return new JSONModel({
        PRIORITY: resolve(Enums.PRIORITY),
        CATEGORY: resolve(Enums.CATEGORY),
        STATUS: resolve(Enums.STATUS)
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
        priority: "",
        category: "",
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

    // CRUD Task 1 v4: Contact VH backed by the real, top-level
    // `/StandardPartnerContactInfo` (C_SlsDocStdPartnerContactInfo) entity set -
    // one row per sales document's standard-contact snapshot, searchable by name.
    _openContactValueHelpDialog: function (sTitle, fnApply) {
      var oProps = ServiceSchema.contactProperties;
      var oDialog = new SelectDialog({
        title: sTitle,
        growing: true,
        items: {
          path: "/" + ServiceSchema.entitySets.contactInfo,
          parameters: {
            $select: [oProps.fullName, oProps.email, oProps.phone].join(",")
          },
          template: new StandardListItem({
            title: "{" + oProps.fullName + "}",
            description: "{" + oProps.email + "}"
          })
        },
        search: function (oEvent) {
          var sValue = oEvent.getParameter("value");
          var oBinding = oEvent.getSource().getBinding("items");
          oBinding.filter(sValue ? new Filter(oProps.fullName, FilterOperator.Contains, sValue) : []);
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

    // NDC Code VH backed by this same service's own top-level `/Product`
    // EntitySet (ProductType) - search by material description or code.
    _openProductValueHelpDialog: function (sTitle, fnApply) {
      var oProps = ServiceSchema.productProperties;
      var oDialog = new SelectDialog({
        title: sTitle,
        growing: true,
        items: {
          path: "/" + ServiceSchema.entitySets.product,
          parameters: {
            $select: [oProps.id, oProps.text, oProps.industryStandardName].join(",")
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
    // so prefill is not possible; always leave blank for manual selection.
    _prefillMainContact: function (sProviderId) {
      this.getView().getModel("createEnrich").setProperty("/contactName", "");
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

    // CRUD Task 1 v4: Contact VH backed by the real, top-level
    // `/StandardPartnerContactInfo` (C_SlsDocStdPartnerContactInfo) entity set -
    // no dedicated contact-person ID is exposed by this service (only
    // name/phone/email), so createEnrich>/contactId is left unset here.
    onContactValueHelpRequest: function () {
      var oProps = ServiceSchema.contactProperties;
      var oBundle = this.getResourceBundle();
      this._openContactValueHelpDialog(oBundle.getText("contactPickerTitle"), function (oItem) {
        var oModel = this.getView().getModel("createEnrich");
        oModel.setProperty("/contactName", oItem[oProps.fullName]);
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
      }
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
            priority: oEnrich.priority,
            category: oEnrich.category,
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
