/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/ItemsTableAccess",
  "cdc/vaccreq/model/OrderModeConfig",
  "cdc/vaccreq/model/schema/ReturnsSchema"
], function (ItemsTableAccess, OrderModeConfig, ReturnsSchema) {
  "use strict";

  function stubTable(sClass) {
    var aCalls = [];
    return {
      calls: aCalls,
      isA: function (sName) { return sName === sClass; },
      getBinding: function (sAggregation) { aCalls.push("getBinding:" + sAggregation); return "binding-" + sAggregation; },
      getBindingInfo: function (sAggregation) { aCalls.push("getBindingInfo:" + sAggregation); return { path: sAggregation }; },
      bindRows: function (oInfo) { aCalls.push("bindRows:" + oInfo.path); },
      bindItems: function (oInfo) { aCalls.push("bindItems:" + oInfo.path); },
      getRows: function () { return ["row"]; },
      getItems: function () { return ["item"]; }
    };
  }

  function stubContext(sPath, iIndex) {
    return { getPath: function () { return sPath; }, getIndex: function () { return iIndex; } };
  }

  QUnit.module("ItemsTableAccess");

  QUnit.test("grid table uses the rows aggregation", function (assert) {
    var oTable = stubTable("sap.ui.table.Table");
    assert.ok(ItemsTableAccess.isGrid(oTable));
    assert.strictEqual(ItemsTableAccess.getBinding(oTable), "binding-rows");
    ItemsTableAccess.bind(oTable, ItemsTableAccess.getBindingInfo(oTable));
    assert.deepEqual(ItemsTableAccess.getRowControls(oTable), ["row"]);
    assert.deepEqual(oTable.calls, ["getBinding:rows", "getBindingInfo:rows", "bindRows:rows"]);
  });

  QUnit.test("sap.m.Table uses the items aggregation", function (assert) {
    var oTable = stubTable("sap.m.Table");
    assert.notOk(ItemsTableAccess.isGrid(oTable));
    assert.strictEqual(ItemsTableAccess.getBinding(oTable), "binding-items");
    ItemsTableAccess.bind(oTable, ItemsTableAccess.getBindingInfo(oTable));
    assert.deepEqual(ItemsTableAccess.getRowControls(oTable), ["item"]);
    assert.deepEqual(oTable.calls, ["getBinding:items", "getBindingInfo:items", "bindItems:items"]);
  });

  QUnit.test("no table / no binding yields nothing", function (assert) {
    assert.notOk(ItemsTableAccess.isGrid(null));
    assert.strictEqual(ItemsTableAccess.getBinding(null), undefined);
    assert.deepEqual(ItemsTableAccess.getRowControls(null), []);
    assert.deepEqual(ItemsTableAccess.getContexts(undefined), []);
  });

  // GH-77: create mode leaves the Items binding in vrCreate/$auto.
  QUnit.test("needsGroupRebind: only a binding in another update group", function (assert) {
    function tableWith(oBinding) {
      return {
        isA: function (sName) { return sName === "sap.ui.table.Table"; },
        getBinding: function () { return oBinding; }
      };
    }
    function binding(sGroupId) {
      return { getUpdateGroupId: function () { return sGroupId; } };
    }
    assert.strictEqual(ItemsTableAccess.needsGroupRebind(tableWith(binding("vrCreate")), "vrEdit"), true, "vrCreate");
    assert.strictEqual(ItemsTableAccess.needsGroupRebind(tableWith(binding("$auto")), "vrEdit"), true, "$auto");
    assert.strictEqual(ItemsTableAccess.needsGroupRebind(tableWith(binding("vrEdit")), "vrEdit"), false, "already vrEdit");
    assert.strictEqual(ItemsTableAccess.needsGroupRebind(tableWith(undefined), "vrEdit"), false, "no binding");
    assert.strictEqual(ItemsTableAccess.needsGroupRebind(tableWith({}), "vrEdit"), false, "binding without getUpdateGroupId");
    assert.strictEqual(ItemsTableAccess.needsGroupRebind(null, "vrEdit"), false, "no table");
  });

  // GH-71: the Orders Items viewport height (Detail.controller.js#_sizeItemsViewport).
  QUnit.test("viewportContentHeight: whole table up to the cap, header + capped rows above, null when not laid out", function (assert) {
    function rect(iWidth, iHeight) {
      return { getBoundingClientRect: function () { return { width: iWidth, height: iHeight }; } };
    }
    function rowDom(iHeight, iPopinHeight) {
      var oDom = rect(800, iHeight);
      if (iPopinHeight) {
        oDom.nextElementSibling = rect(800, iPopinHeight);
        oDom.nextElementSibling.classList = { contains: function (sClass) { return sClass === "sapMListTblSubRow"; } };
      } else {
        oDom.nextElementSibling = { classList: { contains: function () { return false; } } };
      }
      return oDom;
    }
    function table(oTableDom, aItemDoms) {
      return {
        getDomRef: function () { return oTableDom; },
        getItems: function () {
          return aItemDoms.map(function (oDom) { return { getDomRef: function () { return oDom; } }; });
        }
      };
    }
    function tableDom(iWidth, iHeight, iHeaderHeight) {
      var oDom = rect(iWidth, iHeight);
      oDom.querySelector = function (sSelector) { return sSelector === ".sapMListTblHeader" ? rect(iWidth, iHeaderHeight) : null; };
      return oDom;
    }
    var aRows = [];
    for (var i = 0; i < 12; i += 1) {
      aRows.push(i === 4 ? null : rowDom(30, i === 1 ? 20 : 0));
    }

    assert.strictEqual(ItemsTableAccess.viewportContentHeight(null, 10), null, "no table");
    assert.strictEqual(ItemsTableAccess.viewportContentHeight(table(null, []), 10), null, "no DOM");
    assert.strictEqual(ItemsTableAccess.viewportContentHeight(table(tableDom(0, 0, 0), aRows), 10), null, "hidden: 0 x 0");
    assert.strictEqual(ItemsTableAccess.viewportContentHeight(table(tableDom(800, 0, 0), aRows), 10), null, "collapsed: height 0");
    assert.strictEqual(ItemsTableAccess.viewportContentHeight(table(tableDom(800, 150, 40), aRows.slice(0, 3)), 10), 150, "3 items: the whole table");
    assert.strictEqual(ItemsTableAccess.viewportContentHeight(table(tableDom(800, 600, 40), aRows), 10), 40 + 9 * 30 + 20,
      "12 items: header + first 10 rows (row 5 without DOM skipped) + the pop-in of row 2");
  });

  QUnit.test("getContexts returns every loaded context in view order", function (assert) {
    var oBinding = {
      getAllCurrentContexts: function () {
        return [stubContext("/c", 2), stubContext("/kept", undefined), stubContext("/a", 0), stubContext("/b", 1)];
      }
    };
    assert.deepEqual(ItemsTableAccess.getContexts(oBinding).map(function (oCtx) { return oCtx.getPath(); }), ["/a", "/b", "/c"]);
  });

  QUnit.test("every sortable Returns column maps to a ReturnsSchema item property", function (assert) {
    OrderModeConfig.getItemsColumnLayout("returns").keys.filter(function (sKey) {
      return sKey !== "rowAction";
    }).forEach(function (sKey) {
      var sSchemaKey = ItemsTableAccess.SORT_PROPERTY_KEYS[sKey];
      var sProperty = sSchemaKey && ReturnsSchema.itemProperties[sSchemaKey];
      assert.ok(typeof sProperty === "string" && sProperty.length > 0, sKey + " -> " + sSchemaKey + " -> " + sProperty);
    });
  });

  QUnit.test("GH-91: every grid-selected key is a Returns column; Item Category is not", function (assert) {
    var aReturnsKeys = OrderModeConfig.getItemsColumnLayout("returns").keys;
    Object.keys(ItemsTableAccess.SORT_PROPERTY_KEYS).forEach(function (sKey) {
      assert.ok(aReturnsKeys.indexOf(sKey) !== -1, sKey + " is a Returns column");
    });
    assert.strictEqual(ItemsTableAccess.SORT_PROPERTY_KEYS.itemCategory, undefined, "Item Category is not selected");
  });
});
