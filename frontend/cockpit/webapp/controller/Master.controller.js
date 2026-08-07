sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/Item",
  "sap/m/ColumnListItem",
  "sap/m/Column",
  "sap/m/Text",
  "sap/m/ObjectIdentifier",
  "sap/m/Dialog",
  "sap/m/Button",
  "sap/m/Input",
  "sap/m/List",
  "sap/m/CustomListItem",
  "sap/m/CheckBox",
  "sap/m/HBox",
  "cdc/vaccreq/model/formatter",
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/VariantStore"
], function (
  Controller, Filter, FilterOperator, Sorter, JSONModel, Item, ColumnListItem, Column, Text,
  ObjectIdentifier, Dialog, Button, Input, List, CustomListItem, CheckBox, HBox,
  formatter, ServiceSchema, VariantStore
) {
  "use strict";

  var FILTER_VARIANT_KEY = "masterFilterVariants";
  var TABLE_LAYOUT_KEY = "masterTableLayout";

  return Controller.extend("cdc.vaccreq.controller.Master", {
    formatter: formatter,

    onInit: function () {
      this._oRouter = this.getOwnerComponent().getRouter();
      // Use the owner component to fetch the "view" model: at this point in the
      // lifecycle the Master view (a routing target) has not yet been inserted
      // into the FlexibleColumnLayout's aggregation, so model propagation via
      // this.getView().getModel("view") has not happened yet and returns undefined.
      this._oViewModel = this.getOwnerComponent().getModel("view");
      this._aColumnDefs = this._getColumnDefs();
      this._applyFilterAvailability();
      this._populateStatusCodes();
      this._populateSalesOrderTypeItems();
      this._populateValueHelp("filterDeliveryBlockReason", ServiceSchema.entitySets.deliveryBlockReason,
        ServiceSchema.valueHelpProperties.deliveryBlockReasonCode, ServiceSchema.valueHelpProperties.deliveryBlockReasonText);
      // Don't show any rows until the user clicks Go — start with a filter that
      // is guaranteed to match nothing (SalesOrder is a non-nullable key field,
      // never an empty string).
      this._aCurrentFilters = this._getNoResultsFilter();
      this._bindMasterItems();
      this._refreshVariantsModel();
      this._oRouter.getRoute("master").attachPatternMatched(this._onRouteMatched, this);
    },

    onSearch: function () {
      var aFilters = [];
      var oView = this.getView();

      this._pushIfValue(aFilters, ServiceSchema.keys.orderId, oView.byId("filterRequestId").getValue(), FilterOperator.Contains);
      this._pushIfValue(aFilters, ServiceSchema.headerProperties.exisId, oView.byId("filterExisId").getValue(), FilterOperator.Contains);
      this._pushOrFilter(aFilters, [ServiceSchema.headerProperties.providerId, ServiceSchema.headerProperties.providerName],
        oView.byId("filterProvider").getValue());
      this._pushIfValue(aFilters, ServiceSchema.headerProperties.createdBy, oView.byId("filterCreatedBy").getValue(), FilterOperator.Contains);

      // Contact: RUNTIME-BLOCKED-BY-SERVICE — do not filter or expand
      // _SoldToPartyContactInfo on the master LIST. The custom backend provider
      // (CL_SD_S4H_STD_PARTNER_CONTACT=CM002) throws ASSERTION_FAILED whenever
      // this navigation is filtered/expanded across multiple header rows
      // (confirmed via ST22 short dump 2026-08-03 — see NOTES.md). This is
      // independent of which fields are selected.

      // TODO-VERIFY at runtime: filtering on a nested to-one navigation path
      // (_ShipToParty/Partner, _ShipToParty/FullName) depends on backend $filter
      // support for associations; structurally present in $metadata (see
      // PHASE2_AUDIT.md), not yet exercised against the live service in this pass.
      var sShipToId = ServiceSchema.navigation.headerToShipToParty + "/" + ServiceSchema.shipToPartyProperties.id;
      var sShipToName = ServiceSchema.navigation.headerToShipToParty + "/" + ServiceSchema.shipToPartyProperties.fullName;
      this._pushOrFilter(aFilters, [sShipToId, sShipToName], oView.byId("filterShipToParty").getValue());

      // Priority: BLOCKED-BY-SERVICE as a master-list filter — DeliveryPriority
      // exists only on SalesOrderItemType, not on the header entity (see
      // ServiceSchema.js navigation comment / PHASE2_AUDIT.md); the control stays
      // disabled (see _applyFilterAvailability), so nothing is pushed here.
      this._pushIfValue(aFilters, ServiceSchema.headerProperties.deliveryBlockReason, oView.byId("filterDeliveryBlockReason").getSelectedKey(), FilterOperator.EQ);
      this._pushIfValue(aFilters, ServiceSchema.headerProperties.salesOrderType, oView.byId("filterSalesOrderType").getSelectedKey(), FilterOperator.EQ);

      if (ServiceSchema.showJurisdictionFilter) {
        this._pushIfValue(aFilters, ServiceSchema.headerProperties.salesOffice, oView.byId("filterJurisdiction").getValue(), FilterOperator.Contains);
      }

      var aStatusKeys = oView.byId("filterStatus").getSelectedKeys();
      if (aStatusKeys.length) {
        var aStatusFilters = aStatusKeys.map(function (sKey) {
          return new Filter(ServiceSchema.statusProperties.code, FilterOperator.EQ, sKey);
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

      var oTable = this.byId("requestsTable");
      var iMaxHits = oView.byId("filterMaxHits").getValue();
      oTable.setGrowingThreshold(iMaxHits);

      this._aCurrentFilters = aFilters;
      var oBinding = oTable.getBinding("items");
      if (oBinding) {
        oBinding.filter(aFilters);
      }

      this._oViewModel.setProperty("/masterHasSearch", true);
    },

    onFilterBarClear: function () {
      this._applyVariantValues({});
      this.byId("filterMaxHits").setValue(50);
      this.onSearch();
    },

    onRowPress: function (oEvent) {
      var oCtx = oEvent.getSource().getBindingContext();
      if (!oCtx) {
        return;
      }
      var sId = oCtx.getProperty(ServiceSchema.keys.orderId);
      this._oRouter.navTo("detail", {
        orderId: encodeURIComponent(sId)
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

    // Guaranteed-empty filter used to keep the master list unpopulated until the
    // user explicitly searches (presses Go) — per requirement, the list should
    // not show all results on initial load.
    _getNoResultsFilter: function () {
      return [new Filter(ServiceSchema.keys.orderId, FilterOperator.EQ, "")];
    },

    _pushOrFilter: function (aFilters, aPaths, sValue) {
      if (!sValue) {
        return;
      }
      var aOrFilters = aPaths.map(function (sPath) {
        return new Filter(sPath, FilterOperator.Contains, sValue);
      });
      aFilters.push(new Filter({ filters: aOrFilters, and: false }));
    },

    _applyFilterAvailability: function () {
      var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
      var sTooltip = oBundle.getText("availableWithE008Service");

      // NDC Code: item-level material, not filterable on the master list via
      // this service (same limitation as the repoint prompt's original NDC note).
      this.byId("filterNdc").setEnabled(false);
      this.byId("filterNdc").setTooltip(sTooltip);

      // Provider PIN: provider-master field, pending the custom E008 service.
      this.byId("filterProviderPin").setEnabled(false);
      this.byId("filterProviderPin").setTooltip(sTooltip);

      // Employee Responsible: RUNTIME-BLOCKED-BY-SERVICE, same root cause as
      // Contact below — see NOTES.md.
      this.byId("filterEmployeeResponsible").setEnabled(false);
      this.byId("filterEmployeeResponsible").setTooltip(sTooltip);

      // Contact: RUNTIME-BLOCKED-BY-SERVICE — filtering/expanding
      // _SoldToPartyContactInfo on the master LIST crashes the backend
      // (ASSERTION_FAILED in CL_SD_S4H_STD_PARTNER_CONTACT=CM002, confirmed via
      // ST22 short dump 2026-08-03, see NOTES.md).
      this.byId("filterContact").setEnabled(false);
      this.byId("filterContact").setTooltip(sTooltip);

      // Rejection Reason: no header-level reason-code field exists on this
      // service (only an item-level SalesDocumentRjcnReason) — filtering the
      // master list by it is not supported without an item-level query, same
      // class of limitation as NDC.
      this.byId("filterRejectionReason").setEnabled(false);
      this.byId("filterRejectionReason").setTooltip(sTooltip);

      // Priority: DeliveryPriority exists only on SalesOrderItemType in this
      // service (design/so.xml) — there is no header-level Priority field to
      // filter the master list by, so this control is disabled rather than
      // wired to a nonexistent header property. BLOCKED-BY-SERVICE.
      this.byId("filterPriority").setEnabled(false);
      this.byId("filterPriority").setTooltip(sTooltip);

      if (!ServiceSchema.showJurisdictionFilter) {
        this.byId("filterJurisdiction").setEnabled(false);
        this.byId("filterJurisdiction").setTooltip(sTooltip);
      }
    },

    _populateStatusCodes: function () {
      var oStatus = this.byId("filterStatus");
      oStatus.removeAllItems();
      oStatus.bindItems({
        path: "/" + ServiceSchema.entitySets.status,
        template: new Item({
          key: "{" + ServiceSchema.statusProperties.code + "}",
          text: "{" + ServiceSchema.statusProperties.text + "}"
        })
      });
    },

    _populateValueHelp: function (sControlId, sEntitySet, sKeyProperty, sTextProperty) {
      var oControl = this.byId(sControlId);
      oControl.removeAllItems();
      oControl.bindItems({
        path: "/" + sEntitySet,
        template: new Item({
          key: "{" + sKeyProperty + "}",
          text: "{" + sTextProperty + "}"
        })
      });
    },

    _populateSalesOrderTypeItems: function () {
      // Optional Order Type filter choices, restricted to the E008 allow-list
      // (ServiceSchema.fixedOrderTypes). NOTE: this is opt-in only — search no
      // longer forces this restriction on every query (removed 2026-08-03: it
      // was an unconfirmed placeholder that silently excluded real orders whose
      // SalesOrderType wasn't in this list from ID/other searches, even though
      // they appear on the unfiltered initial master-list load — see NOTES.md).
      var oControl = this.byId("filterSalesOrderType");
      oControl.removeAllItems();
      ServiceSchema.fixedOrderTypes.forEach(function (sType) {
        oControl.addItem(new Item({ key: sType, text: sType }));
      });
    },

    // --- Master table columns: layout (order/visibility) driven by VariantStore
    // so personalization (item B) and the base column set (item A) share one
    // source of truth. ---

    _getColumnDefs: function () {
      return [
        {
          key: "requestId", i18nKey: "colRequestId", hAlign: "Begin",
          createCell: function () {
            return new Text({ text: { path: ServiceSchema.keys.orderId, formatter: formatter.masterRequestId } });
          }
        },
        {
          key: "description", i18nKey: "colDescription", hAlign: "Begin", demandPopin: true, minScreenWidth: "Tablet",
          createCell: function () {
            return new Text({ text: formatter.masterDescription() });
          }
        },
        {
          key: "provider", i18nKey: "colProvider", hAlign: "Begin",
          createCell: function () {
            return new ObjectIdentifier({
              title: { path: ServiceSchema.headerProperties.providerName },
              text: { path: ServiceSchema.headerProperties.providerId }
            });
          }
        },
        {
          key: "status", i18nKey: "colStatus", hAlign: "Begin",
          createCell: function () {
            // return new Text({ text: { path: ServiceSchema.headerProperties.userStatus }});
            return new ObjectIdentifier({
              title: { path: ServiceSchema.headerProperties.userStatus, formatter: formatter.masterStatusText.bind(formatter) },
              // text: { path: ServiceSchema.headerProperties.userStatus }
              text: { path: ServiceSchema.headerProperties.userStatus, formatter: formatter.masterStatusCode.bind(formatter) }
            });
          }
        },
        {
          key: "contact", i18nKey: "colContact", hAlign: "Begin", demandPopin: true, minScreenWidth: "Tablet",
          createCell: function () {
            // RUNTIME-BLOCKED-BY-SERVICE: expanding _SoldToPartyContactInfo on
            // the master LIST (multiple header rows at once) causes a backend
            // 500 ASSERTION_FAILED dump in the custom provider
            // CL_SD_S4H_STD_PARTNER_CONTACT=CM002 (confirmed live 2026-08-03 via
            // ST22 short dump, see NOTES.md) — independent of which fields are
            // selected. Do not rebind without re-verifying against the live
            // backend first.
            // return new ObjectIdentifier({
            //   title: {
            //     path: ServiceSchema.navigation.headerToContactInfo + "/" + ServiceSchema.contactProperties.fullName,
            //     formatter: formatter.masterContact
            //   },
            //   text: { path: ServiceSchema.navigation.headerToContactInfo + "/" + ServiceSchema.contactProperties.phone }
            // });

            // return new Text({ text: { 
            //   path: ServiceSchema.navigation.headerToContactInfo + "/" + ServiceSchema.contactProperties.fullName,
            //   formatter: formatter.masterContact
            // } });
            return new Text({ text: formatter.masterContact() });
          }
        },
        {
          key: "createdAt", i18nKey: "colCreatedAt", hAlign: "Begin", demandPopin: true, minScreenWidth: "Desktop",
          createCell: function () {
            return new Text({ text: { path: ServiceSchema.headerProperties.createdOn, formatter: formatter.masterCreatedAt } });
          }
        },
        {
          key: "employeeResponsible", i18nKey: "colEmployeeResponsible", hAlign: "Begin", demandPopin: true, minScreenWidth: "Desktop",
          createCell: function () {
            // RUNTIME-BLOCKED-BY-SERVICE: selecting ResponsibleEmployee via the
            // _SoldToPartyContactInfo navigation causes a backend 500
            // ASSERTION_FAILED dump on this service (confirmed live 2026-08-03,
            // see NOTES.md) — do not add this property back to any $expand
            // without re-verifying against the live backend first.
            return new ObjectIdentifier({
              title: formatter.masterEmployeeResponsibleTitle(),
              text: formatter.masterEmployeeResponsibleTitle()
            });
          }
        },
        {
          key: "createdBy", i18nKey: "colCreatedBy", hAlign: "Begin", demandPopin: true, minScreenWidth: "Tablet",
          createCell: function () {
            return new ObjectIdentifier({
              title: {
                path: ServiceSchema.navigation.headerToCreatedByUser + "/" + ServiceSchema.createdByUserProperties.name,
                formatter: formatter.masterCreatedByTitle
              },
              text: { path: ServiceSchema.headerProperties.createdBy }
            });
          }
        }
      ];
    },

    _getColumnLayout: function () {
      var oData = VariantStore.load(TABLE_LAYOUT_KEY);
      var oSaved = oData.variants && oData.variants.layout;
      if (oSaved && oSaved.order && oSaved.order.length) {
        return oSaved;
      }
      return {
        order: this._aColumnDefs.map(function (oDef) { return oDef.key; }),
        visibility: {}
      };
    },

    _saveColumnLayout: function (oLayout) {
      VariantStore.saveVariant(TABLE_LAYOUT_KEY, "layout", oLayout);
    },

    _getOrderedDefs: function (oLayout) {
      var mDefsByKey = {};
      this._aColumnDefs.forEach(function (oDef) { mDefsByKey[oDef.key] = oDef; });

      var aOrderKeys = oLayout.order.filter(function (sKey) { return mDefsByKey[sKey]; });
      this._aColumnDefs.forEach(function (oDef) {
        if (aOrderKeys.indexOf(oDef.key) === -1) {
          aOrderKeys.push(oDef.key);
        }
      });

      return aOrderKeys.map(function (sKey) { return mDefsByKey[sKey]; });
    },

    _bindMasterItems: function () {
      var oTable = this.byId("requestsTable");
      var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
      var oLayout = this._getColumnLayout();
      var aOrderedDefs = this._getOrderedDefs(oLayout);
      var aVisibleDefs = aOrderedDefs.filter(function (oDef) {
        return oLayout.visibility[oDef.key] !== false;
      });

      oTable.removeAllColumns();
      aVisibleDefs.forEach(function (oDef) {
        oTable.addColumn(new Column({
          hAlign: oDef.hAlign || "Begin",
          demandPopin: !!oDef.demandPopin,
          minScreenWidth: oDef.minScreenWidth || "",
          header: new Text({ text: oBundle.getText(oDef.i18nKey) })
        }));
      });

      var oTemplate = new ColumnListItem({
        type: "Navigation",
        press: this.onRowPress.bind(this),
        cells: aVisibleDefs.map(function (oDef) { return oDef.createCell(); })
      });

      oTable.bindItems({
        path: "/" + ServiceSchema.entitySets.header,
        template: oTemplate,
        filters: this._aCurrentFilters || this._getNoResultsFilter(),
        sorter: [new Sorter(ServiceSchema.headerProperties.createdOn, true)]
      });
    },

    onMasterTablePersonalize: function () {
      if (!this._oColumnDialog) {
        this._oColumnDialog = this._createColumnDialog();
        this.getView().addDependent(this._oColumnDialog);
      }
      var oLayout = this._getColumnLayout();
      var aOrderedDefs = this._getOrderedDefs(oLayout);
      var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
      var aRows = aOrderedDefs.map(function (oDef) {
        return {
          key: oDef.key,
          label: oBundle.getText(oDef.i18nKey),
          visible: oLayout.visibility[oDef.key] !== false
        };
      });
      this._oColumnDialog.setModel(new JSONModel({ rows: aRows }), "columns");
      this._oColumnDialog.open();
    },

    _createColumnDialog: function () {
      var that = this;
      var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();

      var oList = new List({
        mode: "None",
        items: {
          path: "columns>/rows",
          template: new CustomListItem({
            content: [
              new HBox({
                alignItems: "Center",
                items: [
                  new CheckBox({ selected: "{columns>visible}" }),
                  new Text({ text: "{columns>label}" }).addStyleClass("sapUiTinyMarginBegin sapUiTinyMarginEnd sapUiFlexGrow1"),
                  new Button({ icon: "sap-icon://slim-arrow-up", type: "Transparent", tooltip: oBundle.getText("moveUp"), press: that._onMoveColumn.bind(that, -1) }),
                  new Button({ icon: "sap-icon://slim-arrow-down", type: "Transparent", tooltip: oBundle.getText("moveDown"), press: that._onMoveColumn.bind(that, 1) })
                ]
              }).addStyleClass("sapUiTinyMargin")
            ]
          })
        }
      });

      return new Dialog({
        title: oBundle.getText("columnDialogTitle"),
        contentWidth: "28rem",
        content: [oList],
        beginButton: new Button({
          text: oBundle.getText("ok"),
          press: function () {
            that._applyColumnDialog();
            that._oColumnDialog.close();
          }
        }),
        endButton: new Button({
          text: oBundle.getText("cancel"),
          press: function () { that._oColumnDialog.close(); }
        })
      });
    },

    _onMoveColumn: function (iDirection, oEvent) {
      var oListItem = oEvent.getSource().getParent().getParent();
      var oModel = this._oColumnDialog.getModel("columns");
      var aRows = oModel.getProperty("/rows");
      var iIndex = oListItem.getBindingContext("columns").getPath().split("/").pop() * 1;
      var iTarget = iIndex + iDirection;
      if (iTarget < 0 || iTarget >= aRows.length) {
        return;
      }
      var oTmp = aRows[iIndex];
      aRows[iIndex] = aRows[iTarget];
      aRows[iTarget] = oTmp;
      oModel.setProperty("/rows", aRows);
    },

    _applyColumnDialog: function () {
      var aRows = this._oColumnDialog.getModel("columns").getProperty("/rows");
      var oLayout = {
        order: aRows.map(function (oRow) { return oRow.key; }),
        visibility: aRows.reduce(function (oAcc, oRow) {
          oAcc[oRow.key] = oRow.visible;
          return oAcc;
        }, {})
      };
      this._saveColumnLayout(oLayout);
      this._bindMasterItems();
    },

    // --- FilterBar search variants (Phase 2 Prompt v2, item B). Deliberately a
    // small custom Select + Save/Manage pattern rather than sap.m.VariantManagement
    // or sap.ui.fl: this app is not running behind a live FLP flex-persistence
    // backend yet, and this keeps persistence swappable via VariantStore.js. ---

    _getVariantControlDefs: function () {
      return [
        { id: "filterRequestId", type: "value" },
        { id: "filterExisId", type: "value" },
        { id: "filterProvider", type: "value" },
        { id: "filterShipToParty", type: "value" },
        { id: "filterCreatedBy", type: "value" },
        { id: "filterJurisdiction", type: "value" },
        { id: "filterDeliveryBlockReason", type: "key" },
        { id: "filterSalesOrderType", type: "key" },
        { id: "filterStatus", type: "keys" },
        { id: "filterCreatedOn", type: "dateRange" }
      ];
    },

    _captureVariantValues: function () {
      var oView = this.getView();
      var oValues = {};
      this._getVariantControlDefs().forEach(function (oDef) {
        var oControl = oView.byId(oDef.id);
        if (!oControl) {
          return;
        }
        switch (oDef.type) {
          case "value": oValues[oDef.id] = oControl.getValue(); break;
          case "key": oValues[oDef.id] = oControl.getSelectedKey(); break;
          case "keys": oValues[oDef.id] = oControl.getSelectedKeys(); break;
          case "dateRange":
            oValues[oDef.id] = {
              from: oControl.getDateValue() ? oControl.getDateValue().toISOString() : null,
              to: oControl.getSecondDateValue() ? oControl.getSecondDateValue().toISOString() : null
            };
            break;
          default: break;
        }
      });
      return oValues;
    },

    _applyVariantValues: function (oValues) {
      oValues = oValues || {};
      var oView = this.getView();
      this._getVariantControlDefs().forEach(function (oDef) {
        var oControl = oView.byId(oDef.id);
        if (!oControl) {
          return;
        }
        var vValue = oValues[oDef.id];
        switch (oDef.type) {
          case "value": oControl.setValue(vValue || ""); break;
          case "key": oControl.setSelectedKey(vValue || ""); break;
          case "keys": oControl.setSelectedKeys(vValue || []); break;
          case "dateRange":
            oControl.setDateValue(vValue && vValue.from ? new Date(vValue.from) : null);
            oControl.setSecondDateValue(vValue && vValue.to ? new Date(vValue.to) : null);
            break;
          default: break;
        }
      });
    },

    _refreshVariantsModel: function () {
      var oData = VariantStore.load(FILTER_VARIANT_KEY);
      var aItems = Object.keys(oData.variants || {}).map(function (sName) {
        return { key: sName, text: sName };
      });
      var oModel = this.getView().getModel("variants");
      if (oModel) {
        oModel.setData({ items: aItems });
      } else {
        this.getView().setModel(new JSONModel({ items: aItems }), "variants");
      }
      if (oData.lastSelectedKey) {
        this.byId("filterVariantSelect").setSelectedKey(oData.lastSelectedKey);
      }
    },

    onVariantSelect: function (oEvent) {
      var sKey = oEvent.getParameter("selectedItem") && oEvent.getParameter("selectedItem").getKey();
      if (!sKey) {
        return;
      }
      var oData = VariantStore.load(FILTER_VARIANT_KEY);
      this._applyVariantValues(oData.variants[sKey]);
      VariantStore.setLastSelectedKey(FILTER_VARIANT_KEY, sKey);
      this.onSearch();
    },

    onVariantSaveAs: function () {
      var that = this;
      var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
      var oInput = new Input({ placeholder: oBundle.getText("variantNameLabel") });
      var oDialog = new Dialog({
        title: oBundle.getText("variantSaveDialogTitle"),
        content: [oInput],
        beginButton: new Button({
          text: oBundle.getText("ok"),
          press: function () {
            var sName = oInput.getValue().trim();
            if (!sName) {
              return;
            }
            VariantStore.saveVariant(FILTER_VARIANT_KEY, sName, that._captureVariantValues());
            that._refreshVariantsModel();
            that.byId("filterVariantSelect").setSelectedKey(sName);
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

    onVariantManage: function () {
      var that = this;
      var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
      var oData = VariantStore.load(FILTER_VARIANT_KEY);
      var aNames = Object.keys(oData.variants || {});

      var oList = new List({
        items: aNames.map(function (sName) {
          return new CustomListItem({
            content: [
              new HBox({
                alignItems: "Center",
                justifyContent: "SpaceBetween",
                width: "100%",
                items: [
                  new Text({ text: sName }),
                  new Button({
                    icon: "sap-icon://delete",
                    type: "Transparent",
                    tooltip: oBundle.getText("variantDelete"),
                    press: function () {
                      VariantStore.deleteVariant(FILTER_VARIANT_KEY, sName);
                      that._refreshVariantsModel();
                      oDialog.close();
                    }
                  })
                ]
              }).addStyleClass("sapUiTinyMargin")
            ]
          });
        })
      });

      var oDialog = new Dialog({
        title: oBundle.getText("variantManageDialogTitle"),
        contentWidth: "24rem",
        content: [oList],
        endButton: new Button({
          text: oBundle.getText("close"),
          press: function () { oDialog.close(); }
        }),
        afterClose: function () { oDialog.destroy(); }
      });
      this.getView().addDependent(oDialog);
      oDialog.open();
    }
  });
});
