sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/Element",
  "sap/ui/core/Item",
  "sap/ui/core/ResizeHandler",
  "sap/ui/table/Table",
  "sap/ui/table/Column",
  "sap/ui/table/rowmodes/Auto",
  "sap/m/Text",
  "sap/m/Link",
  "sap/m/Dialog",
  "sap/m/Button",
  "sap/m/BusyIndicator",
  "sap/m/Input",
  "sap/m/Select",
  "sap/m/List",
  "sap/m/Column",
  "sap/m/ColumnListItem",
  "sap/m/CustomListItem",
  "sap/m/HBox",
  "sap/m/MessageToast",
  "sap/m/MenuItem",
  "sap/m/SearchField",
  "sap/m/Token",
  "sap/m/p13n/Popup",
  "sap/m/p13n/SelectionPanel",
  "sap/m/p13n/SortPanel",
  "sap/m/p13n/GroupPanel",
  "sap/ui/core/EventBus",
  "sap/ui/comp/valuehelpdialog/ValueHelpDialog",
  "sap/ui/comp/filterbar/FilterBar",
  "sap/ui/comp/filterbar/FilterGroupItem",
  "sap/ui/comp/library",
  "sap/ui/export/Spreadsheet",
  "cdc/vaccreq/model/formatter",
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/VariantStore",
  "cdc/vaccreq/service/ProviderSearchService",
  "cdc/vaccreq/util/ValueHelpTableFitter"
], function (
  Controller, Filter, FilterOperator, Sorter, JSONModel, Element, Item, ResizeHandler, GridTable, Column, AutoRowMode, Text, Link,
  Dialog, Button, BusyIndicator, Input, Select, List, MColumn, ColumnListItem, CustomListItem, HBox, MessageToast, MenuItem, SearchField, Token,
  P13nPopup, SelectionPanel, SortPanel, GroupPanel, EventBus,
  ValueHelpDialog, FilterBar, FilterGroupItem, compLibrary, Spreadsheet,
  formatter, ServiceSchema, VariantStore, ProviderSearchService, ValueHelpTableFitter
) {
  "use strict";

  var FILTER_VARIANT_KEY = "masterFilterVariants";
  var STANDARD_VARIANT_KEY = "*standard*";
  var TABLE_LAYOUT_KEY = "masterTableLayout";
  var COLUMN_VARIANT_KEY = "masterColumnVariants";
  var FLEX_COLUMN_WEIGHTS = { description: 0.45, provider: 0.45, createdBy: 0.1 };
  // Vaccine Request (requestId) + Description are the frozen, non-hideable,
  // non-movable pair (fixedColumnCount=2) — always first, always visible.
  var FIXED_COLUMN_KEYS = ["requestId", "description"];
  var ROW_COUNT_DEBOUNCE_MS = 400;
  var RESIZE_DEBOUNCE_MS = 400;
  var RangeOperation = compLibrary.valuehelpdialog.ValueHelpRangeOperation;
  var CONDITION_OPERATIONS = [RangeOperation.EQ, RangeOperation.Contains, RangeOperation.BT,
    RangeOperation.StartsWith, RangeOperation.EndsWith, RangeOperation.LT, RangeOperation.LE,
    RangeOperation.GT, RangeOperation.GE, "Empty"];
  return Controller.extend("cdc.vaccreq.controller.Master", {
    formatter: formatter,

    onInit: function () {
      this._oRouter = this.getOwnerComponent().getRouter();
      // Use the owner component to fetch the "view" model: at this point in the
      // lifecycle the Master view (a routing target) has not yet been inserted
      // into the FlexibleColumnLayout's aggregation, so model propagation via
      // this.getView().getModel("view") has not happened yet and returns undefined.
      this._oViewModel = this.getOwnerComponent().getModel("view");
      this.getView().setModel(new JSONModel({ byOrder: {} }), "masterContacts");
      this._mMasterContactRequests = {};
      this._aColumnDefs = this._getColumnDefs();
      this._applyFilterAvailability();
      this._populateStatusCodes();
      this._populateSalesOrderTypeItems();
      this._populateValueHelp("filterDeliveryBlockReason", ServiceSchema.entitySets.deliveryBlockReason,
        ServiceSchema.valueHelpProperties.deliveryBlockReasonCode, ServiceSchema.valueHelpProperties.deliveryBlockReasonText);
      this._configureFilterSuggestions();
      this._oFilterBarRenderDelegate = {
        onAfterRendering: function () {
          clearTimeout(this._iFilterBarActionTimer);
          this._iFilterBarActionTimer = setTimeout(this._syncFilterBarActions.bind(this), 0);
        }.bind(this)
      };
      this.byId("filterBar").addEventDelegate(this._oFilterBarRenderDelegate);
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
      if (this._sMasterResizeHandlerId) {
        ResizeHandler.deregister(this._sMasterResizeHandlerId);
        this._sMasterResizeHandlerId = null;
      }
      if (this._oFilterBarRenderDelegate) {
        this.byId("filterBar").removeEventDelegate(this._oFilterBarRenderDelegate);
        this._oFilterBarRenderDelegate = null;
      }
      clearTimeout(this._iMasterTableFitTimer);
      clearTimeout(this._iFilterBarActionTimer);
    },

    onAfterRendering: function () {
      if (!this._sMasterResizeHandlerId) {
        this._sMasterResizeHandlerId = ResizeHandler.register(
          this.byId("masterPage"),
          this._scheduleMasterTableFit.bind(this)
        );
      }
      this._scheduleMasterTableFit();
    },

    _syncFilterBarActions: function () {
      var sFilterBarId = this.byId("filterBar").getId();
      var oAdaptFiltersButton = Element.getElementById(sFilterBarId + "-btnFilters");
      if (oAdaptFiltersButton) {
        oAdaptFiltersButton.setText(
          this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("adaptFilters")
        );
      }
    },

    _configureFilterSuggestions: function () {
      var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
      var aConfigs = [
        {
          controlId: "filterProviderPin",
          modelName: "po",
          entitySet: ServiceSchema.providerOrderService.entitySets.soldToDetails,
          key: ServiceSchema.providerOrderService.soldToDetailsProperties.identificationNumber,
          description: ServiceSchema.providerOrderService.soldToDetailsProperties.soldToParty,
          filterValueKey: ServiceSchema.providerOrderService.soldToDetailsProperties.soldToParty,
          keyLabel: "providerPinHelpIdentificationNumber",
          descriptionLabel: "providerPinHelpSoldToParty",
          showDescriptionInToken: false,
          suggestionModelName: "providerPinSuggestions",
          loadSuggestions: this._loadProviderPinRows.bind(this)
        },
        {
          controlId: "filterRequestId",
          entitySet: ServiceSchema.entitySets.header,
          key: ServiceSchema.keys.orderId,
          description: ServiceSchema.headerProperties.providerName,
          keyLabel: "colRequestId",
          descriptionLabel: "colProvider"
        },
        {
          controlId: "filterProvider",
          entitySet: ServiceSchema.entitySets.customerSalesArea,
          key: ServiceSchema.customerSalesAreaProperties.customer,
          description: ServiceSchema.customerSalesAreaProperties.customerName,
          keyLabel: "providerHelpId",
          descriptionLabel: "providerHelpName"
        },
        {
          controlId: "filterNdc",
          entitySet: ServiceSchema.entitySets.product,
          key: ServiceSchema.productProperties.id,
          description: ServiceSchema.productProperties.text,
          keyLabel: "productHelpProductId",
          descriptionLabel: "productHelpProduct"
        }
      ];

      aConfigs.forEach(function (oConfig) {
        var oInput = this.byId(oConfig.controlId);
        oInput.data("suggestionConfig", oConfig);
        if (oConfig.loadSuggestions) {
          oInput.setModel(new JSONModel({ rows: [] }), oConfig.suggestionModelName);
        }
        oInput.setShowSuggestion(true);
        oInput.setFilterSuggests(false);
        oInput.setStartSuggestion(1);
        oInput.addSuggestionColumn(new MColumn({
          header: new Text({ text: oBundle.getText(oConfig.keyLabel) })
        }));
        oInput.addSuggestionColumn(new MColumn({
          header: new Text({ text: oBundle.getText(oConfig.descriptionLabel) })
        }));
        oInput.attachSuggest(this.onFilterSuggest, this);
        oInput.attachSuggestionItemSelected(this.onFilterSuggestionSelected, this);
      }, this);
    },

    onFilterSuggest: function (oEvent) {
      var oInput = oEvent.getSource();
      var oConfig = oInput.data("suggestionConfig");
      var oBinding = oInput.getBinding("suggestionRows");
      if (!oBinding) {
        var sSuggestionModelName = oConfig.suggestionModelName || oConfig.modelName;
        var sModelPrefix = sSuggestionModelName ? sSuggestionModelName + ">" : "";
        var aSelect = [oConfig.key, oConfig.description, oConfig.filterValueKey].filter(function (sPath, iIndex, aPaths) {
          return sPath && aPaths.indexOf(sPath) === iIndex;
        });
        oInput.bindAggregation("suggestionRows", {
          path: sModelPrefix + "/" + (oConfig.loadSuggestions ? "rows" : oConfig.entitySet),
          parameters: oConfig.loadSuggestions ? undefined : { $select: aSelect.join(",") },
          templateShareable: false,
          template: new ColumnListItem({
            cells: [
              new Text({ text: "{" + sModelPrefix + oConfig.key + "}" }),
              new Text({ text: "{" + sModelPrefix + oConfig.description + "}" })
            ]
          })
        });
        oBinding = oInput.getBinding("suggestionRows");
      }

      var sValue = (oEvent.getParameter("suggestValue") || "").trim();
      if (oConfig.loadSuggestions) {
        var iRequest = (oInput.data("suggestionRequest") || 0) + 1;
        oInput.data("suggestionRequest", iRequest);
        oConfig.loadSuggestions(sValue, {}).then(function (aRows) {
          if (oInput.data("suggestionRequest") === iRequest) {
            oInput.getModel(oConfig.suggestionModelName).setProperty("/rows", aRows);
          }
        }).catch(function () {
          if (oInput.data("suggestionRequest") === iRequest) {
            oInput.getModel(oConfig.suggestionModelName).setProperty("/rows", []);
          }
        });
        return;
      }
      oBinding.filter(sValue ? new Filter({
        filters: [
          new Filter(oConfig.key, FilterOperator.Contains, sValue),
          new Filter(oConfig.description, FilterOperator.Contains, sValue)
        ],
        and: false
      }) : []);
    },

    onFilterSuggestionSelected: function (oEvent) {
      var oInput = oEvent.getSource();
      var oConfig = oInput.data("suggestionConfig");
      var oRow = oEvent.getParameter("selectedRow");
      var oContext = oRow && oRow.getBindingContext(oConfig.suggestionModelName || oConfig.modelName);
      var sKey = oContext && oContext.getProperty(oConfig.key);
      if (!sKey) {
        return;
      }
      var sDescription = oContext.getProperty(oConfig.description);
      var sFilterValue = oConfig.filterValueKey ? oContext.getProperty(oConfig.filterValueKey) : sKey;
      var oRange = {
        exclude: false,
        operation: RangeOperation.EQ,
        value1: sFilterValue,
        displayValue: sKey
      };
      var bAlreadySelected = oInput.getTokens().some(function (oToken) {
        var oTokenRange = oToken.data("range");
        return oTokenRange && oTokenRange.value1 === sFilterValue;
      });
      if (!bAlreadySelected) {
        oInput.addToken(new Token({
          key: sKey,
          text: oConfig.showDescriptionInToken !== false && sDescription ? sKey + " (" + sDescription + ")" : sKey
        }).data("range", oRange));
      }
      oInput.setValue("");
    },

    _scheduleMasterTableFit: function () {
      clearTimeout(this._iMasterTableFitTimer);
      clearTimeout(this._iFilterBarActionTimer);
      this._iMasterTableFitTimer = setTimeout(function () {
        if (!this._isMasterPageVisible()) {
          return;
        }
        this._syncFilterBarActions();
        this._fitMasterTableToViewport();
      }.bind(this), 0);
      this._iFilterBarActionTimer = setTimeout(function () {
        if (this._isMasterPageVisible()) {
          this._syncFilterBarActions();
        }
      }.bind(this), 100);
    },

    _isMasterPageVisible: function () {
      var oPageDomRef = this.byId("masterPage").getDomRef();
      var oPageRect = oPageDomRef && oPageDomRef.getBoundingClientRect();
      return !!oPageRect && !!oPageRect.width && !!oPageRect.height
        && oPageRect.right > 0 && oPageRect.left < window.innerWidth;
    },

    _fitMasterTableToViewport: function () {
      var oTable = this.byId("requestsTable");
      var oRowMode = this.byId("requestsRowMode");
      var oTableDomRef = oTable && oTable.getDomRef();
      if (!oTableDomRef || !oRowMode) {
        return;
      }
      var oTableRect = oTableDomRef.getBoundingClientRect();
      var oRenderedRow = oTableDomRef.querySelector(".sapUiTableTr");
      var iRowHeight = oRenderedRow ? oRenderedRow.getBoundingClientRect().height : (oRowMode.getRowContentHeight() || 32);
      var iRenderedRowsHeight = oRowMode.getRowCount() * iRowHeight;
      var iTableChromeHeight = Math.max(0, oTableRect.height - iRenderedRowsHeight);
      var iAvailableHeight = window.innerHeight - oTableRect.top - 16;
      var iVisibleRows = Math.max(4, Math.floor((iAvailableHeight - iTableChromeHeight) / iRowHeight));
      if (oRowMode.getRowCount() !== iVisibleRows) {
        oRowMode.setRowCount(iVisibleRows);
      }

      var oColumnViewport = oTableDomRef.querySelector(".sapUiTableCtrlScr");
      if (oColumnViewport) {
        var fRootFontSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize);
        var fnToPixels = function (sWidth) {
          var fWidth = parseFloat(sWidth) || 0;
          return /rem$/.test(sWidth) ? fWidth * fRootFontSize : fWidth;
        };
        var aRenderedColumns = oTable.getColumns().filter(function (oColumn) {
          return !!oColumn.getDomRef();
        });
        var iBaselineWidth = aRenderedColumns.reduce(function (iWidth, oColumn) {
          return iWidth + fnToPixels(oColumn.data("baselineWidth"));
        }, 0);
        var iAvailableWidth = Math.floor(oColumnViewport.getBoundingClientRect().width) - 2;
        var iSpareWidth = Math.max(0, iAvailableWidth - iBaselineWidth);
        var fVisibleWeight = aRenderedColumns.reduce(function (fWeight, oColumn) {
          return fWeight + (FLEX_COLUMN_WEIGHTS[oColumn.data("colKey")] || 0);
        }, 0);

        aRenderedColumns.forEach(function (oColumn) {
          var sKey = oColumn.data("colKey");
          var fWeight = FLEX_COLUMN_WEIGHTS[sKey] || 0;
          if (!fWeight) {
            return;
          }
          var iTargetWidth = Math.floor(fnToPixels(oColumn.data("baselineWidth")) +
            (fVisibleWeight ? iSpareWidth * fWeight / fVisibleWeight : 0));
          if (Math.abs(oColumn.getDomRef().getBoundingClientRect().width - iTargetWidth) > 1) {
            oColumn.setWidth(iTargetWidth + "px");
          }
        });
        oTable.toggleStyleClass("masterResultsTableNoHorizontalScroll", iBaselineWidth <= iAvailableWidth);
      }
    },

    onNdcFilterValueHelpRequest: function () {
      var oProps = ServiceSchema.productProperties;
      this._openStandardEntityValueHelp(this.byId("filterNdc"), {
        title: this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("filterNdc"),
        entitySet: ServiceSchema.entitySets.product,
        key: oProps.id,
        descriptionKey: oProps.text,
        select: [oProps.id, oProps.text, oProps.industryStandardName],
        searchPaths: [oProps.id, oProps.text, oProps.industryStandardName],
        fields: [
          { path: oProps.id, labelKey: "productHelpProductId" },
          { path: oProps.text, labelKey: "productHelpProduct" },
          { path: oProps.industryStandardName, labelKey: "productHelpBrand" }
        ],
        columns: [
          { path: oProps.id, labelKey: "productHelpProductId", width: "11rem" },
          { path: oProps.text, labelKey: "productHelpProduct", width: "22rem" },
          { path: null, labelKey: "productHelpBaseCategory", width: "10rem" },
          { path: oProps.industryStandardName, labelKey: "productHelpBrand", width: "10rem" }
        ]
      });
    },

    _openStandardEntityValueHelp: function (oInput, oConfig) {
      var that = this;
      var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
      var oValueHelpModel = oConfig.loadRows ? new JSONModel({ rows: [] }) : null;
      var sSearchMode = oConfig.defaultSearchMode;
      var iRowPageSize = oConfig.rowPageSize || 50;
      var iRowLimit = iRowPageSize;
      var iLoadRequest = 0;
      var bHasMoreRows = true;
      var bRowsLoading = false;
      var oBasicSearch = new SearchField({
        width: "100%",
        placeholder: oBundle.getText("valueHelpSearchPlaceholder")
      });
      var aFieldControls = [];
      var fnCreateFieldControls = function (aFields) {
        aFieldControls = aFields.map(function (oField) {
          return { definition: oField, control: new Input() };
        });
      };
      var oInitialSearchMode = (oConfig.searchModes || []).find(function (oMode) {
        return oMode.key === sSearchMode;
      });
      fnCreateFieldControls(oInitialSearchMode ? oInitialSearchMode.fields : oConfig.fields);
      var fnGetFilters = function () {
        var aFilters = [];
        var sSearchValue = oBasicSearch.getValue();
        if (sSearchValue) {
          aFilters.push(new Filter({
            filters: oConfig.searchPaths.map(function (sPath) {
              return new Filter(sPath, FilterOperator.Contains, sSearchValue);
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
        selectionMode: "MultiToggle",
        rowMode: new AutoRowMode({
          minRowCount: oConfig.maxVisibleRows || 8,
          maxRowCount: oConfig.maxVisibleRows
        }),
        threshold: 100,
        enableColumnReordering: false
      });
      oTable.setBusyIndicatorDelay(0);
      if (oValueHelpModel) {
        oTable.setModel(oValueHelpModel);
      } else if (oConfig.modelName) {
        oTable.setModel(this.getOwnerComponent().getModel(oConfig.modelName));
      }
      var fnSetColumns = function (aColumns) {
        oTable.removeAllColumns().forEach(function (oColumn) { oColumn.destroy(); });
        aColumns.forEach(function (oColumn) {
          oTable.addColumn(new Column({
            label: new Text({ text: oBundle.getText(oColumn.labelKey) }),
            template: oColumn.path ? new Text({ text: "{" + oColumn.path + "}" }) : new Text(),
            width: oColumn.width
          }));
        });
      };
      fnSetColumns(oInitialSearchMode ? oInitialSearchMode.columns : oConfig.columns);
      var oDialog = new ValueHelpDialog({
        title: oConfig.title,
        contentWidth: oConfig.contentWidth || "66rem",
        contentHeight: "47rem",
        draggable: true,
        resizable: true,
        key: oConfig.key,
        descriptionKey: oConfig.descriptionKey,
        supportMultiselect: true,
        supportRanges: oConfig.supportRanges !== false,
        supportRangesOnly: false,
        ok: function (oOkEvent) {
          var mFilterValues = {};
          oTable.getSelectedIndices().forEach(function (iIndex) {
            var oContext = oTable.getContextByIndex(iIndex);
            if (oContext && oConfig.filterValueKey) {
              mFilterValues[oContext.getProperty(oConfig.key)] = oContext.getProperty(oConfig.filterValueKey);
            }
          });
          oInput.removeAllTokens();
          oOkEvent.getParameter("tokens").forEach(function (oToken, iIndex) {
            var oExistingRange = oToken.data("range");
            if (oExistingRange) {
              oInput.addToken(that._createConditionToken(oExistingRange, iIndex));
              return;
            }
            var sDisplayValue = oToken.getKey() || oToken.data("longKey");
            var oRange = {
              exclude: false,
              operation: RangeOperation.EQ,
              value1: mFilterValues[sDisplayValue] || sDisplayValue,
              displayValue: sDisplayValue
            };
            oInput.addToken(that._createConditionToken(oRange, iIndex));
          });
          oInput.setValue("");
          oDialog.close();
        },
        cancel: function () {
          oDialog.close();
        },
        afterClose: function () {
          oDialog.destroy();
        }
      });
      if (oConfig.styleClass) {
        oDialog.addStyleClass(oConfig.styleClass);
      }
      var fnBindRows = function (bIncremental) {
        if (oConfig.loadRows) {
          var mFieldValues = {};
          aFieldControls.forEach(function (oFieldControl) {
            mFieldValues[oFieldControl.definition.path] = oFieldControl.control.getValue();
          });
          var iCurrentRequest = ++iLoadRequest;
          bRowsLoading = true;
          oTable.setNoData(new BusyIndicator({ size: "1.5rem" }).addStyleClass("providerTableLoadingIndicator"));
          oTable.setBusy(true);
          oConfig.loadRows(oBasicSearch.getValue(), mFieldValues, sSearchMode, iRowLimit)
            .then(function (aRows) {
              if (iCurrentRequest !== iLoadRequest) {
                return;
              }
              bHasMoreRows = !oConfig.progressiveRows ||
                (typeof aRows.hasMore === "boolean" ? aRows.hasMore : aRows.length >= iRowLimit);
              oValueHelpModel.setProperty("/rows", aRows);
              if (!oTable.getBinding("rows")) {
                oTable.bindRows("/rows");
              }
              oDialog.update();
            })
            .catch(function () {
              if (iCurrentRequest !== iLoadRequest) {
                return;
              }
              bHasMoreRows = false;
              oValueHelpModel.setProperty("/rows", []);
              MessageToast.show(oBundle.getText(oConfig.loadErrorKey || "providerPinHelpLoadError"));
            })
            .finally(function () {
              if (iCurrentRequest === iLoadRequest) {
                bRowsLoading = false;
                oTable.setBusy(false);
                oTable.setNoData(null);
              }
            });
          return;
        }
        oTable.bindRows({
          path: "/" + oConfig.entitySet,
          parameters: { $select: oConfig.select.join(",") },
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
      var fnResetAndBindRows = function () {
        iRowLimit = iRowPageSize;
        bHasMoreRows = true;
        fnBindRows();
      };
      var oFilterBar = new FilterBar({
        advancedMode: true,
        filterBarExpanded: true,
        showGoOnFB: true,
        search: fnResetAndBindRows
      }).addStyleClass(oConfig.searchModes ? "providerSearchValueHelpFilterBar" : "");
      oFilterBar.setBasicSearch(oBasicSearch);
      oBasicSearch.attachSearch(fnResetAndBindRows);
      var fnAddFieldControls = function () {
        aFieldControls.forEach(function (oFieldControl, iIndex) {
          if (oConfig.searchModes && iIndex === 2) {
            oFilterBar.addFilterGroupItem(new FilterGroupItem({
              groupName: "valueHelp",
              name: "searchModeSpacer",
              label: "",
              visibleInFilterBar: true,
              control: new Input().addStyleClass("providerSearchModeSpacer")
            }));
          }
          oFilterBar.addFilterGroupItem(new FilterGroupItem({
            groupName: "valueHelp",
            name: oFieldControl.definition.path,
            label: oBundle.getText(oFieldControl.definition.labelKey),
            visibleInFilterBar: true,
            control: oFieldControl.control
          }));
        });
      };
      if (oConfig.searchModes) {
        var oSearchModeSelect = new Select({
          selectedKey: sSearchMode,
          items: oConfig.searchModes.map(function (oMode) {
            return new Item({ key: oMode.key, text: oBundle.getText(oMode.labelKey) });
          }),
          change: function (oEvent) {
            sSearchMode = oEvent.getParameter("selectedItem").getKey();
            var oMode = oConfig.searchModes.find(function (oSearchMode) {
              return oSearchMode.key === sSearchMode;
            });
            oFilterBar.getFilterGroupItems().slice(1).forEach(function (oItem) {
              oFilterBar.removeFilterGroupItem(oItem);
              oItem.destroy();
            });
            fnSetColumns(oMode.columns);
            fnCreateFieldControls(oMode.fields);
            fnAddFieldControls();
            fnResetAndBindRows();
          }
        }).addStyleClass("providerSearchModeSelect");
        oFilterBar.addFilterGroupItem(new FilterGroupItem({
          groupName: "valueHelp",
          name: "searchMode",
          label: oBundle.getText("providerSearchFor"),
          visibleInFilterBar: true,
          control: oSearchModeSelect
        }));
      }
      fnAddFieldControls();
      oDialog.setFilterBar(oFilterBar);
      oDialog.setTable(oTable);
      oDialog.setRangeKeyFields([{ label: oConfig.title, key: oConfig.key, type: "string" }]);
      oDialog.setIncludeRangeOperations(CONDITION_OPERATIONS);
      oDialog.setExcludeRangeOperations(CONDITION_OPERATIONS);
      oDialog.setTokens(oInput.getTokens().map(function (oToken) { return oToken.clone(); }));
      if (oConfig.progressiveRows) {
        oTable.attachFirstVisibleRowChanged(function (oEvent) {
          var iLoadedRows = oValueHelpModel.getProperty("/rows").length;
          var iVisibleRows = oTable.getVisibleRowCount() || 8;
          if (!bRowsLoading && bHasMoreRows && iLoadedRows &&
              oEvent.getParameter("firstVisibleRow") + iVisibleRows >= iLoadedRows - 5) {
            iRowLimit += iRowPageSize;
            fnBindRows(true);
          }
        });
      }
      if (oConfig.fitTableRows) {
        ValueHelpTableFitter.attach(oDialog, oTable, ResizeHandler);
      }
      this.getView().addDependent(oDialog);
      oDialog.open();
      if (oConfig.fitTableRows) {
        ValueHelpTableFitter.fit(oDialog, oTable);
      }
      fnResetAndBindRows();
    },

    _loadProviderPinRows: function (sBasicSearch, mFieldValues, sAdditionalFilter) {
      var oProps = ServiceSchema.providerOrderService.soldToDetailsProperties;
      var sSoldToParty = oProps.soldToParty;
      var sIdentificationNumber = oProps.identificationNumber;
      var aFilters = [];
      var fnQuote = function (sValue) {
        return "'" + String(sValue).replace(/'/g, "''") + "'";
      };
      var fnContains = function (sProperty, sValue) {
        return "contains(" + sProperty + "," + fnQuote(sValue) + ")";
      };
      if (sBasicSearch) {
        aFilters.push("(" + fnContains(sIdentificationNumber, sBasicSearch) + " or " +
          fnContains(sSoldToParty, sBasicSearch) + ")");
      }
      if (sAdditionalFilter) {
        aFilters.push("(" + sAdditionalFilter + ")");
      }
      [sIdentificationNumber, sSoldToParty].forEach(function (sProperty) {
        if (mFieldValues[sProperty]) {
          aFilters.push(fnContains(sProperty, mFieldValues[sProperty]));
        }
      });
      var sApply = (aFilters.length ? "filter(" + aFilters.join(" and ") + ")/" : "") +
        "groupby((" + sSoldToParty + "," + sIdentificationNumber + "))";
      var oDataSource = this.getOwnerComponent().getManifestObject()
        .getEntry("/sap.app/dataSources/providerOrderService");
      var oQuery = new URLSearchParams();
      oQuery.set("$apply", sApply);
      oQuery.set("$orderby", sIdentificationNumber);
      oQuery.set("$top", "200");
      var sClient = new URLSearchParams(window.location.search).get("sap-client");
      if (sClient) {
        oQuery.set("sap-client", sClient);
      }
      return fetch(oDataSource.uri + ServiceSchema.providerOrderService.entitySets.soldToDetails + "?" + oQuery.toString(), {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      }).then(function (oResponse) {
        if (!oResponse.ok) {
          throw new Error("Provider PIN request failed with HTTP " + oResponse.status);
        }
        return oResponse.json();
      }).then(function (oData) {
        return oData.value || [];
      });
    },

    _providerPinConditionExpression: function (oCondition) {
      var sProperty = ServiceSchema.providerOrderService.soldToDetailsProperties.identificationNumber;
      var fnQuote = function (sValue) {
        return "'" + String(sValue == null ? "" : sValue).replace(/'/g, "''") + "'";
      };
      var sValue1 = fnQuote(oCondition.value1);
      var sValue2 = fnQuote(oCondition.value2);
      return {
        EQ: sProperty + " eq " + sValue1,
        Empty: sProperty + " eq ''",
        Contains: "contains(" + sProperty + "," + sValue1 + ")",
        BT: "(" + sProperty + " ge " + sValue1 + " and " + sProperty + " le " + sValue2 + ")",
        StartsWith: "startswith(" + sProperty + "," + sValue1 + ")",
        EndsWith: "endswith(" + sProperty + "," + sValue1 + ")",
        LT: sProperty + " lt " + sValue1,
        LE: sProperty + " le " + sValue1,
        GT: sProperty + " gt " + sValue1,
        GE: sProperty + " ge " + sValue1
      }[oCondition.operation] || sProperty + " eq " + sValue1;
    },

    _resolveProviderPinFilters: function () {
      var aConditions = this._getInputConditions("filterProviderPin");
      var sProviderIdPath = ServiceSchema.headerProperties.providerId;
      var oProps = ServiceSchema.providerOrderService.soldToDetailsProperties;
      var aIncludeFilters = [];
      var aExcludeFilters = [];
      var aPending = aConditions.map(function (oCondition) {
        if (oCondition.displayValue) {
          var oResolvedFilter = new Filter(sProviderIdPath,
            oCondition.exclude ? FilterOperator.NE : FilterOperator.EQ, oCondition.value1);
          (oCondition.exclude ? aExcludeFilters : aIncludeFilters).push(oResolvedFilter);
          return Promise.resolve();
        }
        return this._loadProviderPinRows("", {}, this._providerPinConditionExpression(oCondition)).then(function (aRows) {
          var aProviderIds = aRows.map(function (oRow) {
            return oRow[oProps.soldToParty];
          }).filter(function (sProviderId, iIndex, aIds) {
            return sProviderId && aIds.indexOf(sProviderId) === iIndex;
          });
          if (!aProviderIds.length && !oCondition.exclude) {
            aIncludeFilters.push(new Filter(sProviderIdPath, FilterOperator.EQ, ""));
            return;
          }
          aProviderIds.forEach(function (sProviderId) {
            var oFilter = new Filter(sProviderIdPath,
              oCondition.exclude ? FilterOperator.NE : FilterOperator.EQ, sProviderId);
            (oCondition.exclude ? aExcludeFilters : aIncludeFilters).push(oFilter);
          });
        });
      }, this);
      return Promise.all(aPending).then(function () {
        var aFilters = [];
        if (aIncludeFilters.length) {
          aFilters.push(new Filter({ filters: aIncludeFilters, and: false }));
        }
        if (aExcludeFilters.length) {
          aFilters.push(new Filter({ filters: aExcludeFilters, and: true }));
        }
        return aFilters;
      });
    },

    onProviderPinValueHelpRequest: function () {
      var oProps = ServiceSchema.providerOrderService.soldToDetailsProperties;
      this._openStandardEntityValueHelp(this.byId("filterProviderPin"), {
        title: this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("filterProviderPin"),
        modelName: "po",
        entitySet: ServiceSchema.providerOrderService.entitySets.soldToDetails,
        loadRows: this._loadProviderPinRows.bind(this),
        key: oProps.identificationNumber,
        descriptionKey: oProps.soldToParty,
        filterValueKey: oProps.soldToParty,
        showDescriptionInToken: false,
        select: [oProps.identificationNumber, oProps.soldToParty],
        searchPaths: [oProps.identificationNumber, oProps.soldToParty],
        fields: [
          { path: oProps.identificationNumber, labelKey: "providerPinHelpIdentificationNumber" },
          { path: oProps.soldToParty, labelKey: "providerPinHelpSoldToParty" }
        ],
        columns: [
          { path: oProps.identificationNumber, labelKey: "providerPinHelpIdentificationNumber", width: "18rem" },
          { path: oProps.soldToParty, labelKey: "providerPinHelpSoldToParty", width: "12rem" }
        ]
      });
    },

    onConditionValueHelpRequest: function (oEvent) {
      var oInput = oEvent.getSource();
      var sControlId = oInput.getId().split("--").pop();
      var oConfig = this._getConditionFieldConfig(sControlId);
      var oDialog = new ValueHelpDialog({
        title: oConfig.label,
        key: "value",
        supportMultiselect: true,
        supportRanges: true,
        supportRangesOnly: true,
        afterOpen: function () {
          setTimeout(function () {
            // ValueHelpDialog 1.136 has no public default-operation API and
            // otherwise commits Contains even when the ComboBox displays EQ.
            var aStringOperations = oDialog._oFilterPanel && oDialog._oFilterPanel._oConditionPanel &&
              oDialog._oFilterPanel._oConditionPanel._oTypeOperations.string.Include;
            if (aStringOperations && aStringOperations.indexOf(RangeOperation.EQ) > 0) {
              aStringOperations.splice(aStringOperations.indexOf(RangeOperation.EQ), 1);
              aStringOperations.unshift(RangeOperation.EQ);
            }
            var oOperatorComboBox = oDialog.findAggregatedObjects(true, function (oControl) {
              return oControl.isA("sap.m.ComboBox") && oControl.getItemByKey(RangeOperation.EQ) &&
                oControl.getItemByKey(RangeOperation.Contains);
            })[0];
            if (oOperatorComboBox && !oOperatorComboBox.getItemByKey("Empty")) {
              var aOperatorItems = oOperatorComboBox.getItems();
              var iExcludeIndex = aOperatorItems.findIndex(function (oOperatorItem, iIndex) {
                return iIndex > 0 && !oOperatorItem.getKey();
              });
              oOperatorComboBox.insertItem(new Item({
                key: "Empty",
                text: this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("conditionOperatorEmpty")
              }), iExcludeIndex);
            }
            if (oOperatorComboBox && !oInput.getTokens().length) {
              var oEqualItem = oOperatorComboBox.getItemByKey(RangeOperation.EQ);
              oOperatorComboBox.setSelectedItem(oEqualItem);
              oOperatorComboBox.fireSelectionChange({ selectedItem: oEqualItem });
              oOperatorComboBox.fireChange({ selectedItem: oEqualItem });
            }
          }.bind(this), 100);
        }.bind(this),
        ok: function (oOkEvent) {
          oInput.removeAllTokens();
          oOkEvent.getParameter("tokens").forEach(function (oToken) {
            oInput.addToken(oToken.clone());
          });
          oInput.setValue("");
          oDialog.close();
        },
        cancel: function () {
          oDialog.close();
        },
        afterClose: function () {
          oDialog.destroy();
        }
      });
      oDialog.setRangeKeyFields([{ label: oConfig.label, key: "value", type: "string" }]);
      oDialog.setIncludeRangeOperations(CONDITION_OPERATIONS);
      oDialog.setExcludeRangeOperations(CONDITION_OPERATIONS);
      oDialog.setTokens(oInput.getTokens().map(function (oToken) {
        return oToken.clone();
      }));
      this.getView().addDependent(oDialog);
      oDialog.open();
    },

    _getConditionFieldConfig: function (sControlId) {
      var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
      return {
        filterProviderPin: {
          label: oBundle.getText("filterProviderPin"),
          path: ServiceSchema.headerProperties.providerId,
          selectionOnly: true
        },
        filterRequestId: { label: oBundle.getText("filterRequestId"), path: ServiceSchema.keys.orderId },
        filterExisId: { label: oBundle.getText("filterExisId"), path: ServiceSchema.headerProperties.exisId },
        filterProvider: { label: oBundle.getText("filterProvider"), path: ServiceSchema.headerProperties.providerId }
      }[sControlId];
    },

    _pushConditionFilters: function (aFilters, sControlId) {
      var oInput = this.byId(sControlId);
      var oConfig = this._getConditionFieldConfig(sControlId);
      if (!oConfig.path) {
        return;
      }
      var aConditions = oInput.getTokens().map(function (oToken) {
        return oToken.data("range");
      }).filter(Boolean);
      if (!aConditions.length && oInput.getValue() && !oConfig.selectionOnly) {
        aConditions.push({ exclude: false, operation: RangeOperation.EQ, value1: oInput.getValue() });
      }
      var aIncludeFilters = [];
      var aExcludeFilters = [];
      aConditions.forEach(function (oCondition) {
        var oFilter = this._createConditionFilter(oConfig.path, oCondition);
        if (oFilter) {
          (oCondition.exclude ? aExcludeFilters : aIncludeFilters).push(oFilter);
        }
      }, this);
      if (aIncludeFilters.length) {
        aFilters.push(new Filter({ filters: aIncludeFilters, and: false }));
      }
      if (aExcludeFilters.length) {
        aFilters.push(new Filter({ filters: aExcludeFilters, and: true }));
      }
    },

    _createConditionFilter: function (sPath, oCondition) {
      var sOperator = oCondition.operation;
      if (sOperator === "Empty") {
        return new Filter(sPath, oCondition.exclude ? FilterOperator.NE : FilterOperator.EQ, "");
      }
      if (oCondition.exclude) {
        sOperator = {
          EQ: FilterOperator.NE,
          Contains: FilterOperator.NotContains,
          BT: FilterOperator.NB,
          StartsWith: FilterOperator.NotStartsWith,
          EndsWith: FilterOperator.NotEndsWith,
          LT: FilterOperator.GE,
          LE: FilterOperator.GT,
          GT: FilterOperator.LE,
          GE: FilterOperator.LT
        }[sOperator];
      }
      return sOperator ? new Filter(sPath, sOperator, oCondition.value1, oCondition.value2) : null;
    },

    _getInputConditions: function (sControlId) {
      var oInput = this.byId(sControlId);
      var aConditions = oInput.getTokens().map(function (oToken) {
        return oToken.data("range") || {
          exclude: false,
          operation: RangeOperation.EQ,
          value1: oToken.getKey()
        };
      });
      if (!aConditions.length && oInput.getValue()) {
        aConditions.push({ exclude: false, operation: RangeOperation.EQ, value1: oInput.getValue() });
      }
      return aConditions;
    },

    _pushNdcConditionFilters: function (aFilters) {
      var aIncludeFilters = [];
      var aExcludeFilters = [];
      var sVariable = "item";
      var sPath = sVariable + "/" + ServiceSchema.itemProperties.material;
      this._getInputConditions("filterNdc").forEach(function (oCondition) {
        var oFilter = this._createConditionFilter(sPath, oCondition);
        if (oFilter) {
          (oCondition.exclude ? aExcludeFilters : aIncludeFilters).push(oFilter);
        }
      }, this);
      if (aIncludeFilters.length) {
        aFilters.push(new Filter({
          path: ServiceSchema.navigation.headerToItems,
          operator: FilterOperator.Any,
          variable: sVariable,
          condition: new Filter({ filters: aIncludeFilters, and: false })
        }));
      }
      if (aExcludeFilters.length) {
        aFilters.push(new Filter({
          path: ServiceSchema.navigation.headerToItems,
          operator: FilterOperator.All,
          variable: sVariable,
          condition: new Filter({ filters: aExcludeFilters, and: true })
        }));
      }
    },

    onProviderFilterValueHelpRequest: function () {
      var oProps = ServiceSchema.customerSalesAreaProperties;
      this._openStandardEntityValueHelp(this.byId("filterProvider"), {
        title: this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("providerHelpId"),
        contentWidth: "78rem",
        entitySet: ServiceSchema.entitySets.customerSalesArea,
        loadRows: function (sBasicSearch, mFieldValues, sSearchMode, iRowLimit) {
          return ProviderSearchService.loadRows(
            this.getOwnerComponent().getModel(),
            this.getOwnerComponent().getModel("po"),
            sSearchMode,
            mFieldValues,
            sBasicSearch,
            [],
            iRowLimit
          );
        }.bind(this),
        searchModes: ProviderSearchService.modes,
        defaultSearchMode: ProviderSearchService.defaultMode,
        progressiveRows: true,
        rowPageSize: 50,
        maxVisibleRows: 7,
        fitTableRows: true,
        styleClass: "providerValueHelpDialog",
        loadErrorKey: "providerSearchLoadError",
        key: oProps.customer,
        descriptionKey: oProps.customerName,
        select: [oProps.customer, oProps.customerName, oProps.postalCode, oProps.cityName, oProps.countryText],
        searchPaths: [oProps.customer, oProps.customerName, oProps.postalCode, oProps.cityName, oProps.countryText],
        fields: [
          { path: oProps.customer, labelKey: "providerHelpId" },
          { path: oProps.customerName, labelKey: "providerHelpName" },
          { path: oProps.postalCode, labelKey: "providerHelpPostalCode" },
          { path: oProps.cityName, labelKey: "providerHelpCity" },
          { path: oProps.countryText, labelKey: "providerHelpCountry" }
        ],
        columns: [
          { path: oProps.customer, labelKey: "providerHelpId", width: "9rem" },
          { path: oProps.customerName, labelKey: "providerHelpName", width: "22rem" },
          { path: oProps.postalCode, labelKey: "providerHelpPostalCode", width: "10rem" },
          { path: oProps.cityName, labelKey: "providerHelpCity", width: "12rem" },
          { path: oProps.countryText, labelKey: "providerHelpCountry", width: "12rem" }
        ]
      });
    },

    onSearch: function () {
      var iSearchRequest = (this._iSearchRequest || 0) + 1;
      this._iSearchRequest = iSearchRequest;
      this._oViewModel.setProperty("/masterBusy", true);
      this._resolveProviderPinFilters().then(function (aFilters) {
        if (this._iSearchRequest !== iSearchRequest) {
          return;
        }
        var oView = this.getView();

      this._pushConditionFilters(aFilters, "filterRequestId");
      this._pushConditionFilters(aFilters, "filterExisId");
      this._pushConditionFilters(aFilters, "filterProvider");
      this._pushIfValue(aFilters,
        ServiceSchema.navigation.headerToContactInfo + "/" + ServiceSchema.contactProperties.responsibleEmployee,
        oView.byId("filterEmployeeResponsible").getValue(), FilterOperator.EQ);
      this._pushNdcConditionFilters(aFilters);
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
      aFilters.push(this._getOrderTypeFilter());

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
      }.bind(this)).catch(function () {
        if (this._iSearchRequest === iSearchRequest) {
          MessageToast.show(this.getOwnerComponent().getModel("i18n").getResourceBundle()
            .getText("providerPinHelpLoadError"));
        }
      }.bind(this)).finally(function () {
        if (this._iSearchRequest === iSearchRequest) {
          this._oViewModel.setProperty("/masterBusy", false);
        }
      }.bind(this));
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

    onMasterRowActionPress: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext();
      if (oContext) {
        this._navigateToOrder(oContext.getProperty(ServiceSchema.keys.orderId));
      }
    },

    // updateFinished doesn't exist on sap.ui.table.Table; rowsUpdated fires
    // after the row set is (re)rendered, including after viewport fitting
    // changes the fixed row mode's row count.
    onRowsUpdated: function () {
      var oTable = this.byId("requestsTable");
      var oBinding = oTable.getBinding("rows");
      if (oBinding) {
        this._oViewModel.setProperty("/masterCount", oBinding.getCount());
      }
      this._loadVisibleMasterContacts();
      this._persistVisibleRowCount();
    },

    _loadVisibleMasterContacts: function () {
      if (!this._oViewModel.getProperty("/masterHasSearch")) {
        return;
      }
      var oTable = this.byId("requestsTable");
      var oContactModel = this.getView().getModel("masterContacts");
      var oODataModel = this.getView().getModel();
      var oProps = ServiceSchema.headerPartnerProperties;
      var aSelect = [ServiceSchema.keys.orderId, oProps.partnerFunction, oProps.fullName,
        oProps.contactPerson, oProps.phone, oProps.email].join(",");
      var aOrderIds = [];
      oTable.getRows().forEach(function (oRow) {
        var oContext = oRow.getBindingContext();
        var sOrderId = oContext && oContext.getProperty(ServiceSchema.keys.orderId);
        if (sOrderId && !this._mMasterContactRequests[sOrderId]) {
          this._mMasterContactRequests[sOrderId] = true;
          aOrderIds.push(sOrderId);
        }
      }, this);
      if (!aOrderIds.length) {
        return;
      }
      // Collection query, not key reads: an order without an AP partner 404s on a
      // key read and the backend then aborts every other read in the same $batch.
      var oContactBinding = oODataModel.bindList("/" + ServiceSchema.entitySets.headerPartner, undefined, undefined, [
        new Filter({
          filters: aOrderIds.map(function (sOrderId) {
            return new Filter(oProps.salesOrder, FilterOperator.EQ, sOrderId);
          }),
          and: false
        }),
        new Filter(oProps.partnerFunction, FilterOperator.EQ, ServiceSchema.contactPartnerFunction)
      ], { $select: aSelect });
      var fnSetContacts = function (mFound) {
        var mContacts = Object.assign({}, oContactModel.getProperty("/byOrder"));
        aOrderIds.forEach(function (sOrderId) {
          mContacts[sOrderId] = mFound[sOrderId] || { display: "", tooltip: "" };
        });
        oContactModel.setProperty("/byOrder", mContacts);
      };
      oContactBinding.requestContexts(0, aOrderIds.length).then(function (aContexts) {
        var mFound = {};
        aContexts.forEach(function (oCtx) {
          var oContact = oCtx.getObject();
          var sContactPerson = oContact[oProps.contactPerson];
          var sName = oContact[oProps.fullName] || (sContactPerson && sContactPerson !== "0" ? sContactPerson : "");
          var aDetails = [oContact[oProps.email], oContact[oProps.phone]].filter(Boolean);
          mFound[oContact[oProps.salesOrder]] = {
            display: sName || "",
            tooltip: aDetails.length ? [sName].concat(aDetails).filter(Boolean).join(" · ") : (sName || "")
          };
        });
        fnSetContacts(mFound);
      }).catch(function () {
        fnSetContacts({});
      }).finally(function () {
        oContactBinding.destroy();
      });
    },

    // CRUD Task 1 v3 (In-Place Create): the Create dialog is removed — creation
    // now happens in the Detail view itself (route "create"), which owns the
    // whole transient-context/save/cancel flow (Detail.controller.js).
    onCreateRequest: function (oEvent) {
      this._oRouter.navTo("create", {
        orderType: oEvent.getParameter("item").getBindingContext("orderContext").getProperty("orderType")
      }, false);
    },

    // Factory, not a template: `visible` must bind the leaf flag path so a runtime flag flip re-renders.
    createOrderTypeMenuItem: function (sId, oContext) {
      return new MenuItem(sId, {
        text: "{orderContext>title}",
        visible: "{orderAuth>/types/" + oContext.getProperty("orderType") + "/CREATE}"
      });
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

    onCopySelectedOrder: function () {
      var oTable = this.byId("requestsTable");
      var aSelectedIndices = oTable.getSelectedIndices();
      var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
      if (aSelectedIndices.length !== 1) {
        MessageToast.show(oBundle.getText("masterCopySelectOne"));
        return;
      }
      var oContext = oTable.getContextByIndex(aSelectedIndices[0]);
      var sOrderId = oContext && oContext.getProperty(ServiceSchema.keys.orderId);
      if (!sOrderId) {
        return;
      }
      navigator.clipboard.writeText(sOrderId).then(function () {
        MessageToast.show(oBundle.getText("masterCopySuccess", [sOrderId]));
      });
    },

    onMasterTableDensityChange: function (oEvent) {
      var oItem = oEvent.getParameter("item");
      this.byId("requestsRowMode").setRowContentHeight(oItem && oItem.getKey() === "cozy" ? 48 : 32);
      this._scheduleMasterTableFit();
    },

    onMasterExport: function () {
      this._exportMasterRows("ProviderOrders.xlsx");
    },

    onMasterExportAs: function () {
      var that = this;
      var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
      var sDefaultName = "ProviderOrders_" + new Date().toISOString().slice(0, 10) + ".xlsx";
      var oDialog;
      var oInput = new Input({
        value: sDefaultName,
        placeholder: oBundle.getText("masterExportFileName"),
        liveChange: function () {
          oInput.setValueState("None");
        },
        submit: function () {
          exportWithName();
        }
      });
      function exportWithName() {
        var sFileName = oInput.getValue().trim();
        if (!sFileName) {
          oInput.setValueState("Error");
          oInput.setValueStateText(oBundle.getText("masterExportFileNameRequired"));
          return;
        }
        if (!/\.xlsx$/i.test(sFileName)) {
          sFileName += ".xlsx";
        }
        oDialog.close();
        that._exportMasterRows(sFileName);
      }
      oDialog = new Dialog({
        title: oBundle.getText("masterExportAsTitle"),
        contentWidth: "24rem",
        content: [oInput],
        beginButton: new Button({
          text: oBundle.getText("masterExport"),
          press: exportWithName
        }),
        endButton: new Button({
          text: oBundle.getText("cancel"),
          press: function () { oDialog.close(); }
        }),
        afterOpen: function () {
          oInput.focus();
          oInput.selectText(0, sDefaultName.length - ".xlsx".length);
        },
        afterClose: function () { oDialog.destroy(); }
      }).addStyleClass("sapUiContentPadding");
      this.getView().addDependent(oDialog);
      oDialog.open();
    },

    _exportMasterRows: function (sFileName) {
      var oTable = this.byId("requestsTable");
      var oBinding = oTable.getBinding("rows");
      var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
      var aRows = oBinding && oBinding.getAllCurrentContexts
        ? oBinding.getAllCurrentContexts().map(function (oContext) { return oContext.getObject(); })
        : oTable.getRows().map(function (oRow) {
          return oRow.getBindingContext() && oRow.getBindingContext().getObject();
        }).filter(Boolean);
      if (!aRows.length) {
        MessageToast.show(oBundle.getText("masterExportNoData"));
        return;
      }
      var oSpreadsheet = new Spreadsheet({
        workbook: {
          columns: [
            { label: oBundle.getText("colRequestId"), property: ServiceSchema.keys.orderId },
            { label: oBundle.getText("colDescription"), property: ServiceSchema.headerProperties.description },
            { label: oBundle.getText("colSalesOrderType"), property: ServiceSchema.headerProperties.salesOrderType },
            { label: oBundle.getText("colProvider"), property: ServiceSchema.headerProperties.providerName },
            { label: oBundle.getText("colStatus"), property: ServiceSchema.headerProperties.userStatus },
            { label: oBundle.getText("colCreatedAt"), property: ServiceSchema.headerProperties.createdOn },
            { label: oBundle.getText("colCreatedBy"), property: ServiceSchema.headerProperties.createdBy }
          ]
        },
        dataSource: aRows,
        fileName: sFileName
      });
      oSpreadsheet.build().finally(function () { oSpreadsheet.destroy(); });
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
      var iCount = this.byId("requestsRowMode").getRowCount();
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
      this._scheduleMasterTableFit();
    },

    _pushIfValue: function (aFilters, sPath, sValue, sOperator, sValueTo) {
      if (sValue && (sOperator !== FilterOperator.BT || sValueTo)) {
        aFilters.push(new Filter(sPath, sOperator, sValue, sValueTo));
      }
    },

    _pushAnyFilter: function (aFilters, sNavigationPath, sProperty, sValue, sOperator) {
      if (!sValue) {
        return;
      }
      var sVariable = "item";
      aFilters.push(new Filter({
        path: sNavigationPath,
        operator: FilterOperator.Any,
        variable: sVariable,
        condition: new Filter(sVariable + "/" + sProperty, sOperator, sValue)
      }));
    },

    // Guaranteed-empty filter used to keep the master list unpopulated until the
    // user explicitly searches (presses Go) — per requirement, the list should
    // not show all results on initial load.
    _getNoResultsFilter: function () {
      return [new Filter(ServiceSchema.keys.orderId, FilterOperator.EQ, ""), this._getOrderTypeFilter()];
    },

    // Always the category's READ-enabled types (OR), optionally narrowed to the
    // Adapt-Filters selection; never absent, so the list is never unscoped.
    _getOrderTypeFilter: function () {
      var sPath = ServiceSchema.headerProperties.salesOrderType;
      var aTypes = this._getAuthorizedOrderTypes("READ").map(function (oType) {
        return oType.orderType;
      });
      var sSelected = this.byId("filterSalesOrderType").getSelectedKey();
      if (sSelected) {
        aTypes = aTypes.indexOf(sSelected) !== -1 ? [sSelected] : [];
      }
      if (!aTypes.length) {
        return new Filter(ServiceSchema.keys.orderId, FilterOperator.EQ, "");
      }
      return new Filter({
        filters: aTypes.map(function (sType) {
          return new Filter(sPath, FilterOperator.EQ, sType);
        }),
        and: false
      });
    },

    _getAuthorizedOrderTypes: function (sAction) {
      var oComponent = this.getOwnerComponent();
      var oAuth = oComponent.getModel("orderAuth");
      return (oComponent.getModel("orderContext").getProperty("/orderTypes") || []).filter(function (oType) {
        return oAuth.getProperty("/types/" + oType.orderType + "/" + sAction) === true;
      });
    },

    _pushOrFilter: function (aFilters, aPaths, sValue, sOperator) {
      if (!sValue) {
        return;
      }
      var aOrFilters = aPaths.map(function (sPath) {
        return new Filter(sPath, sOperator, sValue);
      });
      aFilters.push(new Filter({ filters: aOrFilters, and: false }));
    },

    _applyFilterAvailability: function () {
      var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
      var sTooltip = oBundle.getText("availableWithE008Service");

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
      var oControl = this.byId("filterSalesOrderType");
      oControl.removeAllItems();
      this._getAuthorizedOrderTypes("READ").forEach(function (oType) {
        oControl.addItem(new Item({ key: oType.orderType, text: oType.title }));
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
          key: "description", i18nKey: "colDescription", hAlign: "Begin", width: "14rem",
          sortPath: ServiceSchema.headerProperties.description,
          createCell: function () {
            return new Text({
              wrapping: false,
              text: { path: ServiceSchema.headerProperties.description, formatter: formatter.masterDescription.bind(formatter) }
            });
          }
        },
        {
          key: "salesOrderType", i18nKey: "colSalesOrderType", hAlign: "Begin", width: "10rem",
          sortPath: ServiceSchema.headerProperties.salesOrderType,
          createCell: function () {
            return new Text({
              wrapping: false,
              text: {
                parts: [
                  { path: ServiceSchema.headerProperties.salesOrderType },
                  { path: "orderContext>/orderTypes" }
                ],
                formatter: function (sType, aTypes) {
                  var oType = (aTypes || []).filter(function (oEntry) { return oEntry.orderType === sType; })[0];
                  return oType ? oType.title : (sType || "");
                }
              }
            });
          }
        },
        {
          key: "provider", i18nKey: "colProvider", hAlign: "Begin", width: "18rem",
          sortPath: ServiceSchema.headerProperties.providerId,
          createCell: function () {
            return new Text({
              wrapping: false,
              text: {
                parts: [
                  { path: ServiceSchema.headerProperties.providerName },
                  { path: ServiceSchema.headerProperties.providerId }
                ],
                formatter: function (sName, sId) {
                  return sName ? sName + (sId ? " (" + sId + ")" : "") : (sId || "—");
                }
              }
            });
          }
        },
        {
          key: "status", i18nKey: "colStatus", hAlign: "Begin", width: "10rem",
          sortPath: ServiceSchema.headerProperties.userStatus,
          createCell: function () {
            return new Text({
              wrapping: false,
              text: { path: ServiceSchema.headerProperties.userStatus, formatter: formatter.masterStatusText.bind(formatter) }
            });
          }
        },
        {
          key: "contact", i18nKey: "colContact", hAlign: "Begin", width: "10rem",
          sortPath: ServiceSchema.keys.orderId,
          createCell: function () {
            return new Text({
              wrapping: false,
              text: {
                parts: [
                  { path: ServiceSchema.keys.orderId },
                  { path: "masterContacts>/byOrder" }
                ],
                formatter: function (sOrderId, mContacts) {
                  return (mContacts && mContacts[sOrderId] && mContacts[sOrderId].display) || "";
                }
              },
              tooltip: {
                parts: [
                  { path: ServiceSchema.keys.orderId },
                  { path: "masterContacts>/byOrder" }
                ],
                formatter: function (sOrderId, mContacts) {
                  return (mContacts && mContacts[sOrderId] && mContacts[sOrderId].tooltip) || "";
                }
              }
            });
          }
        },
        {
          key: "createdAt", i18nKey: "colCreatedAt", hAlign: "Begin", width: "9rem",
          sortPath: ServiceSchema.headerProperties.createdOn,
          createCell: function () {
            return new Text({
              wrapping: false,
              text: { path: ServiceSchema.headerProperties.createdOn, formatter: formatter.masterCreatedAt }
            });
          }
        },
        {
          key: "employeeResponsible", i18nKey: "colEmployeeResponsible", hAlign: "Begin", width: "8rem",
          sortPath: ServiceSchema.keys.orderId,
          createCell: function () {
            // RUNTIME-BLOCKED-BY-SERVICE: selecting ResponsibleEmployee via the
            // _SoldToPartyContactInfo navigation causes a backend 500
            // ASSERTION_FAILED dump on this service (confirmed live 2026-08-03,
            // see NOTES.md) — do not add this property back to any $expand
            // without re-verifying against the live backend first.
            return new Text({ text: formatter.masterEmployeeResponsibleTitle(), wrapping: false });
          }
        },
        {
          key: "createdBy", i18nKey: "colCreatedBy", hAlign: "Begin", width: "10rem",
          sortPath: ServiceSchema.headerProperties.createdBy,
          createCell: function () {
            return new HBox({
              width: "100%",
              alignItems: "Center",
              justifyContent: "SpaceBetween",
              items: [
                new Text({
                  wrapping: false,
                  text: {
                    parts: [
                      { path: ServiceSchema.navigation.headerToCreatedByUser + "/" + ServiceSchema.createdByUserProperties.name },
                      { path: ServiceSchema.headerProperties.createdBy }
                    ],
                    formatter: function (sName, sId) {
                      var sTitle = formatter.masterCreatedByTitle(sName);
                      return sTitle !== "—" ? sTitle + (sId ? " (" + sId + ")" : "") : (sId || "—");
                    }
                  }
                }),
                new Button({
                  icon: "sap-icon://slim-arrow-right",
                  type: "Transparent",
                  tooltip: "{i18n>sectionDetails}",
                  press: that.onMasterRowActionPress.bind(that)
                })
              ]
            });
          }
        }
      ];
    },

    _getColumnLayout: function () {
      var oData = VariantStore.load(TABLE_LAYOUT_KEY);
      var oSaved = oData.variants && oData.variants.layout;
      if (oSaved && oSaved.order && oSaved.order.length) {
        if (oSaved.widths && oSaved.widths.description === "50rem") {
          oSaved.widths.description = "14rem";
        }
        if (oSaved.widths && ["8rem", "12rem", "16rem"].indexOf(oSaved.widths.createdBy) !== -1) {
          oSaved.widths.createdBy = "10rem";
        }
        if (oSaved.widths && ["10rem", "12rem"].indexOf(oSaved.widths.employeeResponsible) !== -1) {
          oSaved.widths.employeeResponsible = "8rem";
        }
        if (oSaved.widths && oSaved.widths.contact === "12rem") {
          oSaved.widths.contact = "10rem";
        }
        if (!oSaved.rowCount || oSaved.rowCount > 10) {
          oSaved.rowCount = 10;
        }
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
        var sWidth = (oLayout.widths && oLayout.widths[oDef.key]) || oDef.width || "10rem";
        var oColumn = new Column({
          label: new Text({ text: oBundle.getText(oDef.i18nKey) }),
          template: oDef.createCell(),
          hAlign: oDef.hAlign || "Begin",
          width: sWidth,
          resizable: true,
          autoResizable: true,
          sortProperty: oDef.sortPath || "",
          showSortMenuEntry: true
        });
        oColumn.data("colKey", oDef.key);
        oColumn.data("baselineWidth", sWidth);
        oTable.addColumn(oColumn);
      });

      // oTable.setFixedColumnCount(Math.min(FIXED_COLUMN_KEYS.length, aVisibleDefs.length));
      this.byId("requestsRowMode").setRowCount(oLayout.rowCount || 10);
      this._iLastPersistedRowCount = oLayout.rowCount || 10;

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

    // --- FilterBar search variants. The standard sap.ui.comp variant UI is
    // backed by the app's swappable VariantStore persistence adapter. ---

    _getVariantControlDefs: function () {
      return [
        { id: "filterProviderPin", type: "conditions" },
        { id: "filterRequestId", type: "conditions" },
        { id: "filterExisId", type: "conditions" },
        { id: "filterProvider", type: "conditions" },
        { id: "filterEmployeeResponsible", type: "value" },
        { id: "filterNdc", type: "conditions" },
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
          case "conditions":
            oValues[oDef.id] = {
              value: oControl.getValue(),
              ranges: oControl.getTokens().map(function (oToken) {
                return oToken.data("range");
              }).filter(Boolean)
            };
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
          case "value": oControl.setValue(vValue || ""); break;
          case "conditions":
            this._applyConditionValues(oControl, vValue);
            break;
          case "key": oControl.setSelectedKey(vValue || oDef.defaultValue || ""); break;
          case "keys": oControl.setSelectedKeys(vValue || []); break;
          case "dateRange":
            oControl.setDateValue(vValue && vValue.from ? new Date(vValue.from) : null);
            oControl.setSecondDateValue(vValue && vValue.to ? new Date(vValue.to) : null);
            break;
          default: break;
        }
      }, this);
    },

    _applyConditionValues: function (oControl, vValue) {
      var oConditionState = typeof vValue === "string" ? { value: vValue, ranges: [] } : (vValue || {});
      oControl.setValue(oConditionState.value || "");
      oControl.removeAllTokens();
      (oConditionState.ranges || []).forEach(function (oRange, iIndex) {
        oControl.addToken(this._createConditionToken(oRange, iIndex));
      }, this);
    },

    _createConditionToken: function (oRange, iIndex) {
      var sDisplayValue = oRange.displayValue || oRange.value1;
      var sText = {
        EQ: "=" + sDisplayValue,
        Empty: "<empty>",
        Contains: "*" + sDisplayValue + "*",
        BT: sDisplayValue + "..." + oRange.value2,
        StartsWith: sDisplayValue + "*",
        EndsWith: "*" + sDisplayValue,
        LT: "<" + sDisplayValue,
        LE: "<=" + sDisplayValue,
        GT: ">" + sDisplayValue,
        GE: ">=" + sDisplayValue
      }[oRange.operation] || oRange.operation + " " + sDisplayValue;
      if (oRange.displayValue && oRange.operation === RangeOperation.EQ && !oRange.exclude) {
        sText = sDisplayValue;
      }
      sText = oRange.exclude ? "!(" + sText + ")" : sText;
      return new Token({ key: "condition-" + iIndex, text: sText }).data("range", oRange);
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
        this.byId("filterMaxHits").setValue(50);
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
    }
  });
});
