// Architecture adapted from frontend/cockpit/webapp/controller/Master.controller.js
// @ VTrckS — same column-definitions-driven grid table + p13n Popup
// (SelectionPanel/SortPanel/GroupPanel) + VariantStore-backed layout/variant
// persistence pattern, deliberately simplified for this read-only, single-
// category app (see NOTES.md "cockpit/returns divergence points"):
//  - no authorization layer (_getAuthorizedOrderTypes) — the four return
//    types are a fixed, always-visible scope (ReturnTypeConfig.js)
//  - no EventBus create-flow hook (no create route in this app)
//  - no complex Created-By F4 metadata-driven value list — Created By shows
//    the raw CreatedByUser id (prompt §4.2 OPEN_QUESTIONS: name resolution deferred)
//  - no column-level $filter menu (filterProperty) — the FilterBar covers it
//  - no named column-layout variants (Save As/Manage) — only the single
//    "current" layout is persisted (still enough for "variants save/restore"
//    DoD, which targets the FilterBar's search variants)
//  - no table-fit-to-viewport ResizeHandler — a fixed rowCount is enough for MVP-1
//  - the provider/PIN picker is a plain confirm-dialog SelectDialog bound
//    directly to the already-configured "po" OData V4 model (no manual
//    fetch()/CORS/sap-client handling needed, unlike the cockpit's
//    ProviderSearchService.js) — same SoldToDetails entity set/properties
sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/Item",
  "sap/ui/table/Column",
  "sap/m/Text",
  "sap/m/ObjectStatus",
  "sap/m/Link",
  "sap/m/SelectDialog",
  "sap/m/StandardListItem",
  "sap/m/Token",
  "sap/m/p13n/Popup",
  "sap/m/p13n/SelectionPanel",
  "sap/m/p13n/SortPanel",
  "sap/m/p13n/GroupPanel",
  "sap/ui/core/library",
  "cdc/vaccret/model/formatter",
  "cdc/vaccret/model/ServiceSchema",
  "cdc/vaccret/model/ReturnTypeConfig",
  "cdc/vaccret/util/VariantStore",
  "cdc/vaccret/util/FilterValue"
], function (
  Controller, Filter, FilterOperator, Sorter, JSONModel, Item, Column, Text, ObjectStatus, Link,
  SelectDialog, StandardListItem, Token,
  P13nPopup, SelectionPanel, SortPanel, GroupPanel, coreLibrary,
  formatter, ServiceSchema, ReturnTypeConfig, VariantStore, FilterValue
) {
  "use strict";

  var FILTER_VARIANT_KEY = "returnsMasterFilterVariants";
  var STANDARD_VARIANT_KEY = "*standard*";
  var TABLE_LAYOUT_KEY = "returnsMasterTableLayout";
  // Return No. is the frozen, always-first anchor column (matches the
  // cockpit's FIXED_COLUMN_KEYS convention — note the cockpit itself never
  // actually calls setFixedColumnCount either, see Master.controller.js
  // onColumnMove's comment; this only affects _getOrderedDefs ordering).
  var FIXED_COLUMN_KEYS = ["returnId"];
  var SortOrder = coreLibrary.SortOrder;

  return Controller.extend("cdc.vaccret.controller.Master", {
    formatter: formatter,

    onInit: function () {
      this._oRouter = this.getOwnerComponent().getRouter();
      this._oViewModel = this.getOwnerComponent().getModel("view");
      this._aColumnDefs = this._getColumnDefs();
      this._populateReturnTypeItems();
      this._populateValueHelp("filterReturnsOrderReason", ServiceSchema.sets.returnsOrderReason,
        ServiceSchema.returnsOrderReasonProperties.code, ServiceSchema.returnsOrderReasonProperties.text);
      this._populateValueHelp("filterStatus", ServiceSchema.sets.overallSDProcessStatus,
        ServiceSchema.overallSDProcessStatusProperties.code, ServiceSchema.overallSDProcessStatusProperties.text);
      // Don't show any rows until the user clicks Go — start with a filter
      // guaranteed to match nothing (CustomerReturn is a non-nullable key,
      // never an empty string).
      this._aCurrentFilters = this._getNoResultsFilter();
      this._bindMasterRows();
      this._refreshVariantsModel();
      this._oRouter.getRoute("master").attachPatternMatched(this._onRouteMatched, this);
    },

    onExit: function () {
      clearTimeout(this._iResizeDebounce);
    },

    _onRouteMatched: function () {
      this._oViewModel.setProperty("/masterBusy", false);
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

    _populateReturnTypeItems: function () {
      var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
      var oControl = this.byId("filterReturnType");
      oControl.removeAllItems();
      ReturnTypeConfig.getScopeReturnTypes().forEach(function (sType) {
        var oType = ReturnTypeConfig.resolveType(sType);
        oControl.addItem(new Item({ key: sType, text: oBundle.getText(oType.titleKey) }));
      });
    },

    // --- Master table columns: layout (order/visibility/sort/group) driven by
    // VariantStore so personalization and the base column set share one
    // source of truth (prompt §4.2 exact column list). ---

    _getColumnDefs: function () {
      var that = this;
      return [
        {
          key: "returnId", i18nKey: "colReturnNo", hAlign: "Begin", width: "10rem",
          sortPath: ServiceSchema.headerProperties.returnId,
          createCell: function () {
            return new Link({
              text: "{" + ServiceSchema.headerProperties.returnId + "}",
              press: function (oEvent) {
                var oCtx = oEvent.getSource().getBindingContext();
                if (oCtx) {
                  that._navigateToReturn(oCtx.getProperty(ServiceSchema.headerProperties.returnId));
                }
              }
            });
          }
        },
        {
          key: "returnType", i18nKey: "colReturnType", hAlign: "Begin", width: "8rem",
          sortPath: ServiceSchema.headerProperties.returnType,
          createCell: function () {
            return new Text({
              wrapping: false,
              text: "{" + ServiceSchema.navs.headerToReturnType + "/" + ServiceSchema.returnTypeProperties.text + "}"
            });
          }
        },
        {
          key: "provider", i18nKey: "colProvider", hAlign: "Begin", width: "16rem",
          sortPath: ServiceSchema.headerProperties.soldToParty,
          createCell: function () {
            return new Text({
              wrapping: false,
              text: {
                parts: [
                  { path: ServiceSchema.headerProperties.soldToParty },
                  { path: ServiceSchema.headerProperties.soldToPartyName }
                ],
                formatter: formatter.soldToPartyText
              }
            });
          }
        },
        {
          key: "exisId", i18nKey: "colExisId", hAlign: "Begin", width: "10rem",
          sortPath: ServiceSchema.headerProperties.exisId,
          createCell: function () {
            return new Text({
              wrapping: false,
              text: { path: ServiceSchema.headerProperties.exisId, formatter: formatter.orDash }
            });
          }
        },
        {
          key: "reason", i18nKey: "colReason", hAlign: "Begin", width: "12rem",
          sortPath: ServiceSchema.headerProperties.returnsOrderReason,
          createCell: function () {
            return new Text({
              wrapping: false,
              text: { path: ServiceSchema.navs.headerToReturnsOrderReason + "/" + ServiceSchema.returnsOrderReasonProperties.text, formatter: formatter.orDash }
            });
          }
        },
        {
          key: "returnDate", i18nKey: "colReturnDate", hAlign: "Begin", width: "9rem",
          sortPath: ServiceSchema.headerProperties.returnDate,
          createCell: function () {
            return new Text({
              wrapping: false,
              text: { path: ServiceSchema.headerProperties.returnDate, formatter: formatter.returnDate }
            });
          }
        },
        {
          key: "status", i18nKey: "colStatus", hAlign: "Begin", width: "10rem",
          sortPath: ServiceSchema.headerProperties.status,
          createCell: function () {
            return new ObjectStatus({
              text: "{" + ServiceSchema.navs.headerToStatus + "/" + ServiceSchema.overallSDProcessStatusProperties.text + "}",
              state: { path: ServiceSchema.headerProperties.statusCriticality, formatter: formatter.statusState }
            });
          }
        },
        {
          key: "createdOn", i18nKey: "colCreatedOn", hAlign: "Begin", width: "9rem",
          sortPath: ServiceSchema.headerProperties.creationDate,
          createCell: function () {
            return new Text({
              wrapping: false,
              text: { path: ServiceSchema.headerProperties.creationDate, formatter: formatter.creationDate }
            });
          }
        },
        {
          key: "createdBy", i18nKey: "colCreatedBy", hAlign: "Begin", width: "9rem",
          sortPath: ServiceSchema.headerProperties.createdByUser,
          createCell: function () {
            // Raw id only — OPEN_QUESTIONS.md: whether Created By should
            // resolve to a name is deferred past MVP-1.
            return new Text({
              wrapping: false,
              text: { path: ServiceSchema.headerProperties.createdByUser, formatter: formatter.orDash }
            });
          }
        },
        {
          key: "netAmount", i18nKey: "colNetAmount", hAlign: "End", width: "10rem",
          sortPath: ServiceSchema.headerProperties.netAmount,
          createCell: function () {
            return new Text({
              wrapping: false,
              text: {
                parts: [
                  { path: ServiceSchema.headerProperties.netAmount },
                  { path: ServiceSchema.headerProperties.currency }
                ],
                formatter: formatter.netAmountText
              }
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
        rowCount: 10
      };
    },

    _saveColumnLayout: function (oLayout) {
      VariantStore.saveVariant(TABLE_LAYOUT_KEY, "layout", oLayout);
    },

    // The frozen Return No. column always sorts first, regardless of any
    // stored/dragged order.
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

    // NOTE (same documented limitation as the cockpit's Master.controller.js):
    // sap.ui.table.Table's native grouping is client-model-only and does NOT
    // work with OData models. "Group by" is implemented here as a primary
    // sort key — rows sharing the grouped value become contiguous, without a
    // visual group-header divider row.
    _buildSorters: function (oLayout) {
      var mDefsByKey = {};
      this._aColumnDefs.forEach(function (oDef) { mDefsByKey[oDef.key] = oDef; });
      var aSorters = [];
      var oGroup = oLayout.group;
      var oSort = oLayout.sort;

      if (oGroup && mDefsByKey[oGroup.key] && mDefsByKey[oGroup.key].sortPath) {
        aSorters.push(new Sorter(mDefsByKey[oGroup.key].sortPath, !!(oSort && oSort.key === oGroup.key && oSort.descending)));
      }
      if (oSort && mDefsByKey[oSort.key] && mDefsByKey[oSort.key].sortPath && (!oGroup || oGroup.key !== oSort.key)) {
        aSorters.push(new Sorter(mDefsByKey[oSort.key].sortPath, !!oSort.descending));
      }
      if (!aSorters.length) {
        aSorters.push(new Sorter(ServiceSchema.headerProperties.creationDate, true));
      }
      return aSorters;
    },

    _bindMasterRows: function () {
      var oTable = this.byId("returnsTable");
      var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
      var oLayout = this._getColumnLayout();
      var aOrderedDefs = this._getOrderedDefs(oLayout);
      var aVisibleDefs = aOrderedDefs.filter(function (oDef) {
        return FIXED_COLUMN_KEYS.indexOf(oDef.key) !== -1 || oLayout.visibility[oDef.key] !== false;
      });

      oTable.removeAllColumns();
      aVisibleDefs.forEach(function (oDef) {
        var sWidth = (oLayout.widths && oLayout.widths[oDef.key]) || oDef.width || "10rem";
        var sSortOrder = this._getColumnSortOrder(oLayout, oDef.key);
        var oColumn = new Column({
          label: new Text({ text: oBundle.getText(oDef.i18nKey) }),
          template: oDef.createCell(),
          hAlign: oDef.hAlign || "Begin",
          width: sWidth,
          resizable: true,
          autoResizable: true,
          sortProperty: oDef.sortPath || "",
          showSortMenuEntry: !!oDef.sortPath,
          sortOrder: sSortOrder,
          sorted: sSortOrder !== SortOrder.None
        });
        oColumn.data("colKey", oDef.key);
        oTable.addColumn(oColumn);
      }, this);

      this.byId("returnsRowMode").setRowCount(oLayout.rowCount || 10);

      oTable.bindRows({
        path: "/" + ServiceSchema.sets.header,
        filters: this._aCurrentFilters || this._getNoResultsFilter(),
        sorter: this._buildSorters(oLayout),
        parameters: { $count: true }
      });

      var oRowsBinding = oTable.getBinding("rows");
      if (oRowsBinding) {
        oRowsBinding.attachDataRequested(function () { oTable.setBusy(true); this._oViewModel.setProperty("/masterBusy", true); }.bind(this));
        oRowsBinding.attachDataReceived(function () {
          oTable.setBusy(false);
          this._oViewModel.setProperty("/masterBusy", false);
          this._oViewModel.setProperty("/masterCount", oRowsBinding.getCount() || 0);
        }.bind(this));
      }
    },

    onRowsUpdated: function () {
      var oBinding = this.byId("returnsTable").getBinding("rows");
      if (oBinding) {
        this._oViewModel.setProperty("/masterCount", oBinding.getCount() || 0);
      }
    },

    _navigateToReturn: function (sReturnId) {
      this._oRouter.navTo("detail", { returnId: encodeURIComponent(sReturnId) });
    },

    _getColumnSortOrder: function (oLayout, sKey) {
      if (!oLayout.sort || oLayout.sort.key !== sKey) {
        return SortOrder.None;
      }
      return oLayout.sort.descending ? SortOrder.Descending : SortOrder.Ascending;
    },

    onMasterTableSort: function (oEvent) {
      oEvent.preventDefault();
      var oColumn = oEvent.getParameter("column");
      var sSortOrder = oEvent.getParameter("sortOrder");
      var oLayout = this._getColumnLayout();
      oLayout.sort = sSortOrder === SortOrder.None ? null
        : { key: oColumn.data("colKey"), descending: sSortOrder === SortOrder.Descending };
      this._saveColumnLayout(oLayout);
      var oTable = this.byId("returnsTable");
      oTable.getColumns().forEach(function (oTableColumn) {
        var sColumnSortOrder = this._getColumnSortOrder(oLayout, oTableColumn.data("colKey"));
        oTableColumn.setSortOrder(sColumnSortOrder);
        oTableColumn.setSorted(sColumnSortOrder !== SortOrder.None);
      }, this);
      var oBinding = oTable.getBinding("rows");
      if (oBinding) {
        oBinding.sort(this._buildSorters(oLayout));
      }
    },

    onColumnMove: function (oEvent) {
      oEvent.preventDefault();
      var oTable = this.byId("returnsTable");
      var oColumn = oEvent.getParameter("column");
      var iNewIndex = oEvent.getParameter("newPos");
      var aColumns = oTable.getColumns().slice();
      aColumns.splice(aColumns.indexOf(oColumn), 1);
      aColumns.splice(iNewIndex, 0, oColumn);
      oTable.removeAllColumns();
      aColumns.forEach(function (oCol) { oTable.addColumn(oCol); });
      var oLayout = this._getColumnLayout();
      oLayout.order = aColumns.map(function (oCol) { return oCol.data("colKey"); });
      this._saveColumnLayout(oLayout);
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
      }.bind(this), 400);
    },

    // --- Master table personalization popup: modern, non-deprecated
    // sap.m.p13n.Popup + SelectionPanel/SortPanel/GroupPanel control family
    // (same as the cockpit's Master.controller.js — NOT sap.m.p13n.Engine
    // and NOT the deprecated sap.m.P13nDialog). ---

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

      var aSelectableDefs = aOrderedDefs.filter(function (oDef) {
        return FIXED_COLUMN_KEYS.indexOf(oDef.key) === -1;
      });
      var aSortableDefs = aOrderedDefs.filter(function (oDef) { return !!oDef.sortPath; });

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

    // --- Filter bar: always-applied four-type scope + the Go-triggered search. ---

    // Always the fixed four-type scope (ReturnTypeConfig), optionally
    // narrowed by the Return Type MultiComboBox — never absent, so the list
    // is never unscoped (prompt §4.2 "type scope always applied").
    _getReturnTypeFilter: function () {
      var sPath = ServiceSchema.headerProperties.returnType;
      var aScopeTypes = ReturnTypeConfig.getScopeReturnTypes();
      var aSelected = this.byId("filterReturnType").getSelectedKeys();
      var aTypes = aSelected.length ? aScopeTypes.filter(function (s) { return aSelected.indexOf(s) !== -1; }) : aScopeTypes;
      if (!aTypes.length) {
        return new Filter(ServiceSchema.headerProperties.returnId, FilterOperator.EQ, "");
      }
      return new Filter({
        filters: aTypes.map(function (sType) { return new Filter(sPath, FilterOperator.EQ, sType); }),
        and: false
      });
    },

    _getNoResultsFilter: function () {
      return [new Filter(ServiceSchema.headerProperties.returnId, FilterOperator.EQ, ""), this._getReturnTypeFilter()];
    },

    _pushTokenFilter: function (aFilters, sControlId, sPath) {
      var aTokens = this.byId(sControlId).getTokens();
      if (!aTokens.length) {
        return;
      }
      aFilters.push(new Filter({
        filters: aTokens.map(function (oToken) { return new Filter(sPath, FilterOperator.EQ, oToken.getText()); }),
        and: false
      }));
    },

    _getCreatedOnFilter: function () {
      var oControl = this.byId("filterCreatedOn");
      var oFrom = oControl.getDateValue();
      var oTo = oControl.getSecondDateValue();
      if (!oFrom) {
        return null;
      }
      var sPath = ServiceSchema.headerProperties.creationDate;
      return new Filter(sPath, oTo ? FilterOperator.BT : FilterOperator.EQ, oFrom, oTo || undefined);
    },

    onSearch: function () {
      var iSearchRequest = (this._iSearchRequest || 0) + 1;
      this._iSearchRequest = iSearchRequest;
      this._oViewModel.setProperty("/masterBusy", true);
      this._resolveProviderPinFilters().then(function (aProviderFilters) {
        if (this._iSearchRequest !== iSearchRequest) {
          return;
        }
        var aFilters = aProviderFilters.slice();
        this._pushTokenFilter(aFilters, "filterReturnId", ServiceSchema.headerProperties.returnId);
        this._pushTokenFilter(aFilters, "filterExisId", ServiceSchema.headerProperties.exisId);

        var sReason = this.byId("filterReturnsOrderReason").getSelectedKey();
        if (sReason) {
          aFilters.push(new Filter(ServiceSchema.headerProperties.returnsOrderReason, FilterOperator.EQ, sReason));
        }

        var aStatusKeys = this.byId("filterStatus").getSelectedKeys();
        if (aStatusKeys.length) {
          aFilters.push(new Filter({
            filters: aStatusKeys.map(function (sKey) { return new Filter(ServiceSchema.headerProperties.status, FilterOperator.EQ, sKey); }),
            and: false
          }));
        }

        var oCreatedOnFilter = this._getCreatedOnFilter();
        if (oCreatedOnFilter) {
          aFilters.push(oCreatedOnFilter);
        }

        // Return Type narrows WITHIN the always-applied four-type scope, it
        // never replaces it (prompt §4.2/§5 DoD).
        aFilters.push(this._getReturnTypeFilter());

        this._aCurrentFilters = aFilters;
        this._oViewModel.setProperty("/masterHasSearch", true);
        var oBinding = this.byId("returnsTable").getBinding("rows");
        if (oBinding) {
          oBinding.filter(aFilters);
        }
        this._oViewModel.setProperty("/masterBusy", false);
      }.bind(this));
    },

    // --- Provider/PIN picker: the ONE value-help dialog in this app (prompt
    // §1 scope guard), copied from the cockpit conceptually (same
    // zui_providerorder_srv SoldToDetails entity set/properties) but
    // implemented directly against the already-configured "po" V4 OData
    // model instead of a manual fetch() helper. ---

    _loadProviderPinRows: function (sSearch) {
      var oProps = ServiceSchema.po.soldToDetailsProperties;
      var oModel = this.getView().getModel("po");
      var sSafeSearch = FilterValue.forFunction(sSearch || "");
      var oFilter = sSafeSearch ? new Filter({
        filters: [
          new Filter(oProps.identificationNumber, FilterOperator.Contains, sSafeSearch),
          new Filter(oProps.soldToParty, FilterOperator.Contains, sSafeSearch)
        ],
        and: false
      }) : undefined;
      var oBinding = oModel.bindList("/" + ServiceSchema.po.entitySets.soldToDetails, undefined, undefined, oFilter);
      return oBinding.requestContexts(0, 50).then(function (aContexts) {
        return aContexts.map(function (oContext) { return oContext.getObject(); });
      });
    },

    _resolveProviderPinFilters: function () {
      var oProps = ServiceSchema.po.soldToDetailsProperties;
      var sPath = ServiceSchema.headerProperties.soldToParty;
      var aTokens = this.byId("filterProviderPin").getTokens();
      if (!aTokens.length) {
        return Promise.resolve([]);
      }
      var aPending = aTokens.map(function (oToken) {
        var sSoldToParty = oToken.data("soldToParty");
        if (sSoldToParty) {
          return Promise.resolve([sSoldToParty]);
        }
        // Free-typed text (no picker selection): resolve it the same way the
        // cockpit does — as an IdentificationNumber/SoldToParty contains-match.
        return this._loadProviderPinRows(oToken.getText()).then(function (aRows) {
          return aRows.map(function (oRow) { return oRow[oProps.soldToParty]; });
        });
      }, this);
      return Promise.all(aPending).then(function (aGroups) {
        var aIds = [];
        aGroups.forEach(function (aGroup) {
          aGroup.forEach(function (sId) {
            if (sId && aIds.indexOf(sId) === -1) {
              aIds.push(sId);
            }
          });
        });
        if (!aIds.length) {
          return [new Filter(sPath, FilterOperator.EQ, "")];
        }
        return [new Filter({
          filters: aIds.map(function (sId) { return new Filter(sPath, FilterOperator.EQ, sId); }),
          and: false
        })];
      });
    },

    onProviderPinValueHelpRequest: function () {
      if (!this._oProviderPinDialog) {
        var oProps = ServiceSchema.po.soldToDetailsProperties;
        var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
        this._oProviderPinDialog = new SelectDialog({
          title: oBundle.getText("filterProviderPin"),
          multiSelect: true,
          items: {
            path: "po>/" + ServiceSchema.po.entitySets.soldToDetails,
            template: new StandardListItem({
              title: "{po>" + oProps.identificationNumber + "}",
              description: "{po>" + oProps.soldToParty + "}"
            })
          },
          search: this._onProviderPinDialogSearch.bind(this),
          confirm: this._onProviderPinDialogConfirm.bind(this)
        });
        this.getView().addDependent(this._oProviderPinDialog);
      }
      this._oProviderPinDialog.open();
    },

    _onProviderPinDialogSearch: function (oEvent) {
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

    _onProviderPinDialogConfirm: function (oEvent) {
      var oProps = ServiceSchema.po.soldToDetailsProperties;
      var oInput = this.byId("filterProviderPin");
      (oEvent.getParameter("selectedItems") || []).forEach(function (oItem) {
        var oContext = oItem.getBindingContext("po");
        var sIdentificationNumber = oContext.getProperty(oProps.identificationNumber);
        var sSoldToParty = oContext.getProperty(oProps.soldToParty);
        var oToken = new Token({
          key: "providerPin-" + sSoldToParty,
          text: sIdentificationNumber + " - " + sSoldToParty
        });
        oToken.data("soldToParty", sSoldToParty);
        oInput.addToken(oToken);
      });
    },

    // --- FilterBar search variants (VariantStore-backed, same convention as
    // the cockpit's Master.controller.js). ---

    _getVariantControlDefs: function () {
      return [
        { id: "filterProviderPin", type: "tokens" },
        { id: "filterReturnId", type: "tokens" },
        { id: "filterExisId", type: "tokens" },
        { id: "filterReturnType", type: "keys" },
        { id: "filterReturnsOrderReason", type: "key" },
        { id: "filterCreatedOn", type: "dateRange" },
        { id: "filterStatus", type: "keys" }
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
          case "tokens":
            oValues[oDef.id] = oControl.getTokens().map(function (oToken) {
              return { text: oToken.getText(), soldToParty: oToken.data("soldToParty") };
            });
            break;
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
          case "tokens":
            oControl.removeAllTokens();
            (vValue || []).forEach(function (oTokenValue) {
              var oToken = new Token({ text: oTokenValue.text });
              if (oTokenValue.soldToParty) {
                oToken.data("soldToParty", oTokenValue.soldToParty);
              }
              oControl.addToken(oToken);
            });
            break;
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
      var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
      var aItems = [{
        key: STANDARD_VARIANT_KEY,
        title: oBundle.getText("standardVariant"),
        changeable: false,
        remove: false,
        rename: false
      }].concat(Object.keys(oData.variants || {}).map(function (sName) {
        return { key: sName, title: sName, changeable: true, remove: true, rename: true };
      }));
      var oModel = this.getView().getModel("variants");
      if (oModel) {
        oModel.setData({ items: aItems });
      } else {
        this.getView().setModel(new JSONModel({ items: aItems }), "variants");
      }
      this.byId("filterVariantManagement").setSelectedKey(oData.lastSelectedKey || STANDARD_VARIANT_KEY);
    },

    onVariantSelect: function (oEvent) {
      var sKey = oEvent.getParameter("key");
      if (!sKey) {
        return;
      }
      if (sKey === STANDARD_VARIANT_KEY) {
        this._applyVariantValues({});
        VariantStore.setLastSelectedKey(FILTER_VARIANT_KEY, null);
        this.onSearch();
        return;
      }
      var oData = VariantStore.load(FILTER_VARIANT_KEY);
      this._applyVariantValues(oData.variants[sKey]);
      VariantStore.setLastSelectedKey(FILTER_VARIANT_KEY, sKey);
      this.onSearch();
    },

    onVariantSave: function (oEvent) {
      var sName = (oEvent.getParameter("name") || "").trim();
      if (!sName) {
        return;
      }
      VariantStore.saveVariant(FILTER_VARIANT_KEY, sName, this._captureVariantValues());
      this._refreshVariantsModel();
      this.byId("filterVariantManagement").setSelectedKey(sName);
    },

    onVariantManage: function (oEvent) {
      var oData = VariantStore.load(FILTER_VARIANT_KEY);
      (oEvent.getParameter("renamed") || []).forEach(function (oRename) {
        if (oData.variants[oRename.key] && oRename.name) {
          oData.variants[oRename.name] = oData.variants[oRename.key];
          delete oData.variants[oRename.key];
          if (oData.lastSelectedKey === oRename.key) {
            oData.lastSelectedKey = oRename.name;
          }
        }
      });
      (oEvent.getParameter("deleted") || []).forEach(function (sKey) {
        delete oData.variants[sKey];
        if (oData.lastSelectedKey === sKey) {
          oData.lastSelectedKey = null;
        }
      });
      VariantStore.save(FILTER_VARIANT_KEY, oData);
      this._refreshVariantsModel();
    },

    // --- Create entry points (prompt §4A.1) — one button per
    // ReturnTypeConfig type; the MenuButton's own default action press is
    // the split-button's first/most-recent type (ZISL, matching
    // ReturnTypeConfig.getScopeReturnTypes()'s own first entry). ---

    onCreatePress: function () {
      this._navToCreate(ReturnTypeConfig.getScopeReturnTypes()[0]);
    },

    onCreateMenuItemSelected: function (oEvent) {
      var oItem = oEvent.getParameter("item");
      this._navToCreate(oItem && oItem.getKey());
    },

    _navToCreate: function (sReturnType) {
      if (!sReturnType) {
        return;
      }
      this._oRouter.navTo("create", { returnType: sReturnType });
    }
  });
});
