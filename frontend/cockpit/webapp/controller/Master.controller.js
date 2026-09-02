sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/Item",
  "sap/ui/table/Column",
  "sap/m/Text",
  "sap/m/Link",
  "sap/m/ObjectIdentifier",
  "sap/m/Dialog",
  "sap/m/Button",
  "sap/m/Input",
  "sap/m/List",
  "sap/m/CustomListItem",
  "sap/m/HBox",
  "sap/m/MessageToast",
  "sap/m/p13n/Popup",
  "sap/m/p13n/SelectionPanel",
  "sap/m/p13n/SortPanel",
  "sap/m/p13n/GroupPanel",
  "sap/ui/core/EventBus",
  "cdc/vaccreq/model/formatter",
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/VariantStore"
], function (
  Controller, Filter, FilterOperator, Sorter, JSONModel, Item, Column, Text, Link,
  ObjectIdentifier, Dialog, Button, Input, List, CustomListItem, HBox, MessageToast,
  P13nPopup, SelectionPanel, SortPanel, GroupPanel, EventBus,
  formatter, ServiceSchema, VariantStore
) {
  "use strict";

  var FILTER_VARIANT_KEY = "masterFilterVariants";
  var TABLE_LAYOUT_KEY = "masterTableLayout";
  var COLUMN_VARIANT_KEY = "masterColumnVariants";
  // Vaccine Request (requestId) + Description are the frozen, non-hideable,
  // non-movable pair (fixedColumnCount=2) — always first, always visible.
  var FIXED_COLUMN_KEYS = ["requestId", "description"];
  var ROW_COUNT_DEBOUNCE_MS = 400;
  var RESIZE_DEBOUNCE_MS = 400;

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
      this._iMaxHits = 50;
      this._bindMasterRows();
      this._refreshVariantsModel();
      this._refreshColumnVariantsModel();
      this._oRouter.getRoute("master").attachPatternMatched(this._onRouteMatched, this);
      // CRUD Task 1 v3 (In-Place Create): Detail.controller.js publishes this
      // once a new order is created in-place (step ④) - Master owns the shared
      // list refresh, same responsibility split as the old dialog's success
      // callback (see the deleted _onCreateRequestSuccess). Channel is "app",
      // deliberately distinct from the "vrCreate" update-group literal (grep
      // isolation - see CreateOrderService.js/ServiceSchema.js).
      EventBus.getInstance().subscribe("app", "orderCreated", this._onOrderCreated, this);
    },

    onExit: function () {
      EventBus.getInstance().unsubscribe("app", "orderCreated", this._onOrderCreated, this);
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
      // NOTE: $top/$skip cannot be set as OData V4 list-binding parameters
      // ("System query option $top is not supported" — confirmed at runtime,
      // see NOTES.md); V4 paging is fully automatic for sap.ui.table.Table's
      // virtual scrolling. iMaxHits is captured for the variant state and any
      // future $apply(top(...))-based cap, but is not enforced as a hard
      // fetch limit here.
      this._iMaxHits = iMaxHits;

      this._aCurrentFilters = aFilters;
      var oBinding = oTable.getBinding("rows");
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

    _navigateToOrder: function (sId) {
      this._oRouter.navTo("detail", {
        orderId: encodeURIComponent(sId)
      });
    },

    // updateFinished doesn't exist on sap.ui.table.Table; rowsUpdated fires
    // after the row set is (re)rendered, including after the interactive
    // row-count drag handle changes visibleRowCount.
    onRowsUpdated: function () {
      var oTable = this.byId("requestsTable");
      var oBinding = oTable.getBinding("rows");
      if (oBinding) {
        this._oViewModel.setProperty("/masterCount", oBinding.getCount());
      }
      this._persistVisibleRowCount();
    },

    // CRUD Task 1 v3 (In-Place Create): the Create dialog is removed — creation
    // now happens in the Detail view itself (route "create"), which owns the
    // whole transient-context/save/cancel flow (Detail.controller.js).
    onCreateRequest: function () {
      this._oRouter.navTo("create", {}, false);
    },

    // Detail.controller.js publishes {orderId} on the "app"/"orderCreated"
    // channel after a successful in-place create (step ④); it already navigates
    // to the new order itself, so Master's only remaining job is the list refresh.
    _onOrderCreated: function () {
      var oBinding = this.byId("requestsTable").getBinding("rows");
      if (oBinding) {
        oBinding.refresh();
      }
    },

    onMasterRefresh: function () {
      var oBinding = this.byId("requestsTable").getBinding("rows");
      if (oBinding) {
        oBinding.refresh();
      }
    },

    // TODO-VERIFY at runtime: columnMove event parameter names ("column"/"newPos")
    // against the live sap.ui.table.Table API on this landscape's UI5 version.
    onColumnMove: function (oEvent) {
      var oTable = this.byId("requestsTable");
      var oColumn = oEvent.getParameter("column");
      var iNewIndex = oEvent.getParameter("newPos");
      var iFixedCount = oTable.getFixedColumnCount();
      var iOldIndex = oTable.indexOfColumn(oColumn);

      // Guard the fixed zone: never allow drag to move a fixed column, or move
      // any column into the frozen Vaccine Request/Description slots.
      if (iOldIndex < iFixedCount || iNewIndex < iFixedCount) {
        oEvent.preventDefault();
        return;
      }

      setTimeout(this._persistColumnOrder.bind(this), 0);
    },

    onColumnResize: function (oEvent) {
      var oColumn = oEvent.getParameter("column");
      var sWidth = oEvent.getParameter("width");
      var sKey = oColumn && oColumn.data("colKey");
      if (!sKey) {
        return;
      }
      clearTimeout(this._iResizeDebounce);
      this._iResizeDebounce = setTimeout(function () {
        var oLayout = this._getColumnLayout();
        oLayout.widths = oLayout.widths || {};
        oLayout.widths[sKey] = sWidth;
        this._saveColumnLayout(oLayout);
      }.bind(this), RESIZE_DEBOUNCE_MS);
    },

    _persistColumnOrder: function () {
      var oTable = this.byId("requestsTable");
      var oLayout = this._getColumnLayout();
      oLayout.order = oTable.getColumns().map(function (oColumn) {
        return oColumn.data("colKey");
      });
      this._saveColumnLayout(oLayout);
    },

    _persistVisibleRowCount: function () {
      var oTable = this.byId("requestsTable");
      var iCount = oTable.getVisibleRowCount();
      if (iCount === this._iLastPersistedRowCount) {
        return;
      }
      clearTimeout(this._iRowCountDebounce);
      this._iRowCountDebounce = setTimeout(function () {
        this._iLastPersistedRowCount = iCount;
        var oLayout = this._getColumnLayout();
        oLayout.rowCount = iCount;
        this._saveColumnLayout(oLayout);
      }.bind(this), ROW_COUNT_DEBOUNCE_MS);
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
      var that = this;
      return [
        {
          key: "requestId", i18nKey: "colRequestId", hAlign: "Begin", width: "10rem",
          sortPath: ServiceSchema.keys.orderId,
          createCell: function () {
            // Provider Order column is the sole navigation trigger (item 3):
            // a plain Link with a click/press handler, replacing the former
            // row-action chevron (rowActionTemplate/RowActionItem, removed).
            return new Link({
              text: { path: ServiceSchema.keys.orderId, formatter: formatter.masterRequestId },
              press: function (oEvent) {
                var oCtx = oEvent.getSource().getBindingContext();
                if (oCtx) {
                  that._navigateToOrder(oCtx.getProperty(ServiceSchema.keys.orderId));
                }
              }
            });
          }
        },
        {
          key: "description", i18nKey: "colDescription", hAlign: "Begin", width: "50rem",
          createCell: function () {
            return new Text({ text: { path: ServiceSchema.headerProperties.description, formatter: formatter.masterDescription.bind(formatter) } });
            // return new Text({ text: formatter.masterDescription() });
          }
        },
        {
          key: "provider", i18nKey: "colProvider", hAlign: "Begin", width: "14rem",
          sortPath: ServiceSchema.headerProperties.providerId,
          createCell: function () {
            return new ObjectIdentifier({
              title: { path: ServiceSchema.headerProperties.providerName },
              text: { path: ServiceSchema.headerProperties.providerId }
            });
          }
        },
        {
          key: "status", i18nKey: "colStatus", hAlign: "Begin", width: "10rem",
          sortPath: ServiceSchema.headerProperties.userStatus,
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
          key: "contact", i18nKey: "colContact", hAlign: "Begin", width: "12rem",
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
          key: "createdAt", i18nKey: "colCreatedAt", hAlign: "Begin", width: "9rem",
          sortPath: ServiceSchema.headerProperties.createdOn,
          createCell: function () {
            return new Text({ text: { path: ServiceSchema.headerProperties.createdOn, formatter: formatter.masterCreatedAt } });
          }
        },
        {
          key: "employeeResponsible", i18nKey: "colEmployeeResponsible", hAlign: "Begin", width: "12rem",
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
          key: "createdBy", i18nKey: "colCreatedBy", hAlign: "Begin", width: "12rem",
          sortPath: ServiceSchema.headerProperties.createdBy,
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
        visibility: {},
        widths: this._aColumnDefs.reduce(function (oAcc, oDef) {
          oAcc[oDef.key] = oDef.width;
          return oAcc;
        }, {}),
        rowCount: 12
      };
    },

    _saveColumnLayout: function (oLayout) {
      VariantStore.saveVariant(TABLE_LAYOUT_KEY, "layout", oLayout);
    },

    // Fixed pair (requestId, description) always sort first, regardless of any
    // stored/dragged order — enforces the frozen fixedColumnCount=2 zone.
    _getOrderedDefs: function (oLayout) {
      var mDefsByKey = {};
      this._aColumnDefs.forEach(function (oDef) { mDefsByKey[oDef.key] = oDef; });

      var aFixedKeys = FIXED_COLUMN_KEYS.filter(function (sKey) { return mDefsByKey[sKey]; });
      var aRestKeys = (oLayout.order || []).filter(function (sKey) {
        return mDefsByKey[sKey] && aFixedKeys.indexOf(sKey) === -1;
      });
      this._aColumnDefs.forEach(function (oDef) {
        if (aFixedKeys.indexOf(oDef.key) === -1 && aRestKeys.indexOf(oDef.key) === -1) {
          aRestKeys.push(oDef.key);
        }
      });

      return aFixedKeys.concat(aRestKeys).map(function (sKey) { return mDefsByKey[sKey]; });
    },

    // Builds the sorter array from the personalized sort/group state (item 1).
    //
    // NOTE (TODO-VERIFY confirmed via sap.ui.table.Table API docs, 1.151):
    // the table's native enableGrouping/groupBy visualization ("group header"
    // rows) is documented as client-model-only — "Grouping does not work with
    // OData models." True OData V4 group-header rendering would require
    // sap.ui.table.TreeTable + ODataListBinding#setAggregation (data
    // aggregation/groupLevels), a materially different control/architecture —
    // out of scope for this pass. "Group by" is therefore implemented here as
    // a primary sort key: rows sharing the grouped value become contiguous,
    // without a visual group-header divider row. This is a documented
    // limitation, not a guess — see NOTES.md.
    //
    // Only columns with a real, single bindable server property (sortPath) are
    // offered as sort/group candidates (see _getColumnDefs); columns without
    // one (description, contact, employeeResponsible) are excluded.
    _buildSorters: function (oLayout) {
      var mDefsByKey = {};
      this._aColumnDefs.forEach(function (oDef) { mDefsByKey[oDef.key] = oDef; });
      var aSorters = [];
      var oGroup = oLayout.group;
      var oSort = oLayout.sort;

      if (oGroup && mDefsByKey[oGroup.key] && mDefsByKey[oGroup.key].sortPath) {
        aSorters.push(new Sorter(mDefsByKey[oGroup.key].sortPath, false));
      }
      if (oSort && mDefsByKey[oSort.key] && mDefsByKey[oSort.key].sortPath && (!oGroup || oGroup.key !== oSort.key)) {
        aSorters.push(new Sorter(mDefsByKey[oSort.key].sortPath, !!oSort.descending));
      }
      if (!aSorters.length) {
        aSorters.push(new Sorter(ServiceSchema.headerProperties.createdOn, true));
      }
      return aSorters;
    },

    _bindMasterRows: function () {
      var oTable = this.byId("requestsTable");
      var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
      var oLayout = this._getColumnLayout();
      var aOrderedDefs = this._getOrderedDefs(oLayout);
      var aVisibleDefs = aOrderedDefs.filter(function (oDef) {
        return FIXED_COLUMN_KEYS.indexOf(oDef.key) !== -1 || oLayout.visibility[oDef.key] !== false;
      });

      oTable.removeAllColumns();
      aVisibleDefs.forEach(function (oDef) {
        var oColumn = new Column({
          label: new Text({ text: oBundle.getText(oDef.i18nKey) }),
          template: oDef.createCell(),
          hAlign: oDef.hAlign || "Begin",
          width: (oLayout.widths && oLayout.widths[oDef.key]) || oDef.width || "10rem",
          resizable: true,
          autoResizable: true
        });
        oColumn.data("colKey", oDef.key);
        oTable.addColumn(oColumn);
      });

      // oTable.setFixedColumnCount(Math.min(FIXED_COLUMN_KEYS.length, aVisibleDefs.length));
      oTable.setVisibleRowCount(oLayout.rowCount || 12);
      this._iLastPersistedRowCount = oLayout.rowCount || 12;

      oTable.bindRows({
        path: "/" + ServiceSchema.entitySets.header,
        filters: this._aCurrentFilters || this._getNoResultsFilter(),
        sorter: this._buildSorters(oLayout),
        parameters: { $count: true }
      });

      var oRowsBinding = oTable.getBinding("rows");
      if (oRowsBinding) {
        oRowsBinding.attachDataRequested(function () { oTable.setBusy(true); });
        oRowsBinding.attachDataReceived(function () { oTable.setBusy(false); });
      }
    },

    // --- Master table personalization dialog (item 1). Uses the modern,
    // non-deprecated sap.m.p13n.Popup + SelectionPanel/SortPanel/GroupPanel
    // control family (available since 1.96/1.97, still current in 1.151) —
    // NOT sap.m.p13n.Engine/*Controller (that stack is for sap.ui.fl-backed,
    // multi-control state persistence, which this app doesn't use) and NOT
    // the deprecated sap.m.P13nDialog pattern (confirmed dead/commented-out
    // code in the unrelated lp2preq reference app — see NOTES.md). State is
    // read/written directly against the same VariantStore-backed layout
    // object used elsewhere (_getColumnLayout/_saveColumnLayout), just with
    // two added optional fields: layout.sort ({key, descending}) and
    // layout.group ({key}) — see _buildSorters for how these are applied.
    //
    // TODO-VERIFY: the exact property names expected by
    // SelectionPanel/SortPanel/GroupPanel#setP13nData/getP13nData items
    // (key/label/visible/position/sorted/descending/grouped) were not
    // published in the fetched API reference (only that the methods exist);
    // implemented per the standard mdc p13n item shape used across SAP
    // samples. Verify against the running app and adjust field names here if
    // the panels don't render/apply state as expected.

    onMasterTablePersonalize: function () {
      if (!this._oP13nPopup) {
        this._createP13nPopup();
      }
      this._setP13nPopupData();
      this._oP13nPopup.open();
    },

    _createP13nPopup: function () {
      var that = this;
      var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();

      this._oSelectionPanel = new SelectionPanel({
        title: oBundle.getText("p13nSelectionPanelTitle"),
        enableCount: true
      });
      this._oSortPanel = new SortPanel({
        title: oBundle.getText("p13nSortPanelTitle")
      });
      this._oGroupPanel = new GroupPanel({
        title: oBundle.getText("p13nGroupPanelTitle")
      });

      this._oP13nPopup = new P13nPopup({
        title: oBundle.getText("p13nDialogTitle"),
        panels: [this._oSelectionPanel, this._oSortPanel, this._oGroupPanel],
        close: function (oEvent) {
          if (oEvent.getParameter("reason") === "Ok") {
            that._applyP13nPopup();
          }
        }
      });
      this.getView().addDependent(this._oP13nPopup);
    },

    _setP13nPopupData: function () {
      var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
      var oLayout = this._getColumnLayout();
      var aOrderedDefs = this._getOrderedDefs(oLayout);

      // Fixed pair (requestId, description) is not offered here: non-hideable,
      // non-movable — same rule the previous dialog enforced.
      var aSelectableDefs = aOrderedDefs.filter(function (oDef) {
        return FIXED_COLUMN_KEYS.indexOf(oDef.key) === -1;
      });
      // Only columns with a real, single bindable server property can be
      // sorted/grouped (see _getColumnDefs' sortPath / _buildSorters note).
      var aSortableDefs = aSelectableDefs.filter(function (oDef) { return !!oDef.sortPath; });

      var aSelectionItems = aSelectableDefs.map(function (oDef, iIndex) {
        return {
          key: oDef.key,
          label: oBundle.getText(oDef.i18nKey),
          visible: oLayout.visibility[oDef.key] !== false,
          position: iIndex
        };
      });
      this._oSelectionPanel.setP13nData(aSelectionItems);

      var oSortState = oLayout.sort || {};
      var aSortItems = aSortableDefs.map(function (oDef) {
        return {
          key: oDef.key,
          label: oBundle.getText(oDef.i18nKey),
          sorted: oSortState.key === oDef.key,
          descending: oSortState.key === oDef.key ? !!oSortState.descending : false
        };
      });
      this._oSortPanel.setP13nData(aSortItems);

      var oGroupState = oLayout.group || {};
      var aGroupItems = aSortableDefs.map(function (oDef) {
        return {
          key: oDef.key,
          label: oBundle.getText(oDef.i18nKey),
          grouped: oGroupState.key === oDef.key
        };
      });
      this._oGroupPanel.setP13nData(aGroupItems);
    },

    _applyP13nPopup: function () {
      var oLayout = this._getColumnLayout();

      var aSelectionData = this._oSelectionPanel.getP13nData();
      oLayout.order = FIXED_COLUMN_KEYS.concat(aSelectionData.map(function (oItem) { return oItem.key; }));
      oLayout.visibility = aSelectionData.reduce(function (oAcc, oItem) {
        oAcc[oItem.key] = oItem.visible;
        return oAcc;
      }, {});
      FIXED_COLUMN_KEYS.forEach(function (sKey) { oLayout.visibility[sKey] = true; });

      var aSortData = this._oSortPanel.getP13nData();
      var oSortedItem = aSortData.filter(function (oItem) { return oItem.sorted; })[0];
      oLayout.sort = oSortedItem ? { key: oSortedItem.key, descending: !!oSortedItem.descending } : null;

      var aGroupData = this._oGroupPanel.getP13nData();
      var oGroupedItem = aGroupData.filter(function (oItem) { return oItem.grouped; })[0];
      oLayout.group = oGroupedItem ? { key: oGroupedItem.key } : null;

      this._saveColumnLayout(oLayout);
      this._bindMasterRows();
    },

    // --- Column layout variants (item 2): Save As/Manage for named table
    // layouts (order/visibility/widths/rowCount/sort/group), analogous to the
    // existing FilterBar search-variant pattern below, backed by a separate
    // VariantStore key so the "current"/active layout (masterTableLayout)
    // stays independent from the list of named, save-able layouts. ---

    _refreshColumnVariantsModel: function () {
      var oData = VariantStore.load(COLUMN_VARIANT_KEY);
      var aItems = Object.keys(oData.variants || {}).map(function (sName) {
        return { key: sName, text: sName };
      });
      var oModel = this.getView().getModel("columnVariants");
      if (oModel) {
        oModel.setData({ items: aItems });
      } else {
        this.getView().setModel(new JSONModel({ items: aItems }), "columnVariants");
      }
      if (oData.lastSelectedKey) {
        this.byId("columnVariantSelect").setSelectedKey(oData.lastSelectedKey);
      }
    },

    onColumnVariantSelect: function (oEvent) {
      var sKey = oEvent.getParameter("selectedItem") && oEvent.getParameter("selectedItem").getKey();
      if (!sKey) {
        return;
      }
      var oData = VariantStore.load(COLUMN_VARIANT_KEY);
      var oLayout = oData.variants[sKey];
      if (!oLayout) {
        return;
      }
      this._saveColumnLayout(oLayout);
      VariantStore.setLastSelectedKey(COLUMN_VARIANT_KEY, sKey);
      this._bindMasterRows();
    },

    onColumnVariantSaveAs: function () {
      var that = this;
      var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
      var oInput = new Input({ placeholder: oBundle.getText("variantNameLabel") });
      var oDialog = new Dialog({
        title: oBundle.getText("columnVariantSaveDialogTitle"),
        content: [oInput],
        beginButton: new Button({
          text: oBundle.getText("ok"),
          press: function () {
            var sName = oInput.getValue().trim();
            if (!sName) {
              return;
            }
            VariantStore.saveVariant(COLUMN_VARIANT_KEY, sName, that._getColumnLayout());
            that._refreshColumnVariantsModel();
            that.byId("columnVariantSelect").setSelectedKey(sName);
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

    onColumnVariantManage: function () {
      var that = this;
      var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
      var oData = VariantStore.load(COLUMN_VARIANT_KEY);
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
                      VariantStore.deleteVariant(COLUMN_VARIANT_KEY, sName);
                      that._refreshColumnVariantsModel();
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
        title: oBundle.getText("columnVariantManageDialogTitle"),
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
