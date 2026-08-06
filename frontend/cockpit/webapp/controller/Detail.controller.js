sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/m/MessagePopover",
  "sap/m/MessageItem",
  "sap/m/Dialog",
  "sap/m/Button",
  "sap/m/Text",
  "sap/m/List",
  "sap/m/CustomListItem",
  "sap/m/CheckBox",
  "sap/m/HBox",
  "sap/ui/core/Messaging",
  "sap/ui/model/json/JSONModel",
  "sap/ui/export/Spreadsheet",
  "cdc/vaccreq/sections/SectionFactory",
  "cdc/vaccreq/sections/SectionConfig",
  "cdc/vaccreq/model/formatter",
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/VariantStore"
], function (
  Controller, MessageToast, MessagePopover, MessageItem, Dialog, Button, Text,
  List, CustomListItem, CheckBox, HBox,
  Messaging, JSONModel, Spreadsheet, SectionFactory, SectionConfig, formatter, ServiceSchema, VariantStore
) {
  "use strict";

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
      // Single source of truth for the panel stack: SectionConfig.js. The anchor
      // strip (sectionsNav model, below) and the sectionFlags model are both
      // derived from this same array, so a new section added there appears in
      // both automatically (Phase 2 Prompt v2, P1 item 2).
      this._aSectionMeta = SectionConfig;
      this._oSectionFactory = new SectionFactory(this.getView(), this._aSectionMeta);
      this.getView().setModel(this._createSectionFlagsModel(), "sectionFlags");
      this.getView().setModel(this._createSectionsNavModel(), "sectionsNav");
      this.getView().setModel(Messaging.getMessageModel(), "message");
      this.getView().setModel(new JSONModel(this._getItemsColumnVisibility()), "itemsColumns");
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
          brand: "\u2014",
          ndcCode: oCtx.getProperty(ServiceSchema.itemProperties.material),
          ndcDescription: oCtx.getProperty(ServiceSchema.itemProperties.itemText),
          qty: oCtx.getProperty(ServiceSchema.itemProperties.quantity),
          uom: oCtx.getProperty(ServiceSchema.itemProperties.unit),
          orderIntention: "\u2014",
          fundType: "\u2014",
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
      if (!this._oMessagePopover) {
        this._oMessagePopover = new MessagePopover({
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
      // Shape mirrors the future resolver feed (status/orderType/user-driven);
      // for Phase 2 every editable section is visible but disabled (placeholder
      // Edit button — no transactional behavior yet).
      var oData = {};
      this._aSectionMeta.forEach(function (oMeta) {
        if (oMeta.editable) {
          oData[oMeta.id] = { editVisible: true, editEnabled: false };
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
          { path: ServiceSchema.navigation.headerToContactInfo + "/" + ServiceSchema.contactProperties.fullName },
          { path: "i18n>detailTitlePrefix" },
          { path: "i18n>detailTitle" }
        ],
        formatter: formatter.detailTitle.bind(formatter)
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

    getResourceBundle: function () {
      return this.getOwnerComponent().getModel("i18n").getResourceBundle();
    }
  });
});
