/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/schema/OrdersSchema",
  "cdc/vaccreq/model/OrderModeConfig",
  "cdc/vaccreq/model/VariantStore",
  "sap/ui/model/json/JSONModel"
], function (ServiceSchema, OrdersSchema, OrderModeConfig, VariantStore, JSONModel) {
  "use strict";

  // GH-83: the Provider Orders Items "Personalize" button stays disabled, and a column
  // layout saved through the old dialog no longer applies. GH-95: the Returns grid gets
  // a view selector and its own Personalize (onItemsGridPersonalize).
  // Detail.controller's module graph reads the active profile when it loads
  // (FundLogicService), and QUnit may run this module first - select one.
  QUnit.module("Items Personalize (GH-83, GH-95)", { beforeEach: function () { ServiceSchema.use(OrdersSchema); } });

  function fragmentDoc(sFragmentPath) {
    return fetch(sap.ui.require.toUrl(sFragmentPath)).then(function (oResponse) {
      return oResponse.text();
    }).then(function (sXml) {
      return new DOMParser().parseFromString(sXml, "application/xml");
    });
  }

  function buttonsWithPress(oDoc, sPress) {
    return Array.prototype.filter.call(oDoc.getElementsByTagNameNS("*", "Button"), function (oButton) {
      return oButton.getAttribute("press") === sPress;
    });
  }

  QUnit.test("Orders keeps a disabled Personalize; Returns has the view selector first and an enabled grid Personalize", function (assert) {
    return Promise.all([
      fragmentDoc("cdc/vaccreq/sections/Items.fragment.xml"),
      fragmentDoc("cdc/vaccreq/sections/returns/Items.fragment.xml")
    ]).then(function (aDocs) {
      var aOrders = buttonsWithPress(aDocs[0], ".onItemsPersonalize");
      assert.strictEqual(aOrders.length, 1, "Orders: one Personalize button");
      assert.strictEqual(aOrders[0] && aOrders[0].getAttribute("enabled"), "false", "Orders: disabled");
      assert.strictEqual(aOrders[0] && aOrders[0].getAttribute("text"), "{i18n>itemsPersonalize}", "Orders: label kept");

      var oReturns = aDocs[1];
      assert.strictEqual(buttonsWithPress(oReturns, ".onItemsPersonalize").length, 0, "Returns: old handler not used");
      var aGrid = buttonsWithPress(oReturns, ".onItemsGridPersonalize");
      assert.strictEqual(aGrid.length, 1, "Returns: one grid Personalize button");
      assert.strictEqual(aGrid[0] && aGrid[0].hasAttribute("enabled"), false, "Returns: enabled (no enabled attribute)");
      assert.strictEqual(aGrid[0] && aGrid[0].getAttribute("text"), "{i18n>itemsPersonalize}", "Returns: label kept");
      var oToolbar = oReturns.getElementsByTagNameNS("*", "OverflowToolbar")[0];
      var oFirst = oToolbar && oToolbar.firstElementChild;
      assert.strictEqual(oFirst && oFirst.localName, "VariantManagement", "Returns: the view selector is the left-most toolbar control");
      var oGrid = oReturns.getElementsByTagNameNS("sap.ui.table", "Table")[0];
      assert.strictEqual(oGrid && oGrid.getAttribute("columnMove"), ".onItemsGridColumnMove", "Returns: columnMove handler");
      assert.strictEqual(oGrid && oGrid.getAttribute("columnResize"), ".onItemsGridColumnResize", "Returns: columnResize handler");
      // Owner 2026-11-19: Action, Item Number and NDC Code are frozen.
      assert.strictEqual(oGrid && oGrid.getAttribute("fixedColumnCount"), "3", "Returns: three frozen columns");
      var aFirstKeys = Array.prototype.slice.call(oReturns.getElementsByTagNameNS("sap.ui.table", "Column"), 0, 3).map(function (oColumn) {
        return oColumn.getAttribute("visible");
      });
      assert.deepEqual(aFirstKeys, ["{itemsColumns>/rowAction}", "{itemsColumns>/itemNumber}", "{itemsColumns>/ndcCode}"], "Returns: the frozen columns are Action, Item Number, NDC Code");
    });
  });

  QUnit.test("_getItemsColumnVisibility: order-type flags, then the active Items view (mandatory stays visible)", function (assert) {
    // The controller's module graph loads on first use (cold: tens of seconds through the
    // proxy); this page's QUnit 2.3 has no per-test timeout (QUnit.config.testTimeout unset).
    var fnLoad = VariantStore.load;
    VariantStore.load = function () {
      return { variants: { layout: { ndcCode: false, qty: false, ndcDescription: false } }, lastSelectedKey: "layout" };
    };
    return new Promise(function (resolve, reject) {
      sap.ui.require(["cdc/vaccreq/controller/Detail.controller"], resolve, reject);
    }).then(function (Detail) {
      function stub(oLayout, oViewState) {
        return {
          getView: function () {
            return { getModel: function () { return new JSONModel({ columns: { lotNumber: { visible: false } } }); } };
          },
          _getItemsColumnLayout: function () { return oLayout; },
          _oItemsViewState: oViewState
        };
      }
      ["orders", "returns"].forEach(function (sProfile) {
        var oLayout = OrderModeConfig.getItemsColumnLayout(sProfile);
        var oExpected = {};
        oLayout.keys.forEach(function (sKey) {
          oExpected[sKey] = sKey !== "lotNumber";
        });
        assert.deepEqual(Detail.prototype._getItemsColumnVisibility.call(stub(oLayout, null)), oExpected,
          sProfile + ": no view - every column the order type allows; the old saved layout is ignored");
      });
      var oReturns = OrderModeConfig.getItemsColumnLayout("returns");
      var oResult = Detail.prototype._getItemsColumnVisibility.call(stub(oReturns, { visible: { ndcDescription: false, qty: false, lotNumber: true } }));
      assert.strictEqual(oResult.ndcDescription, false, "returns view: hidden column hidden");
      assert.strictEqual(oResult.qty, true, "returns view: mandatory Quantity stays visible");
      assert.strictEqual(oResult.lotNumber, false, "returns view: the order type's hidden flag wins");
      assert.strictEqual(oResult.itemNumber, true, "returns view: other columns visible");
      var oFrozen = stub(oReturns, { visible: { itemNumber: false } });
      oFrozen._aItemsFrozenKeys = ["rowAction", "itemNumber", "ndcCode"];
      assert.strictEqual(Detail.prototype._getItemsColumnVisibility.call(oFrozen).itemNumber, true, "returns view: frozen Item Number stays visible");
    }).finally(function () {
      VariantStore.load = fnLoad;
    });
  });
});
