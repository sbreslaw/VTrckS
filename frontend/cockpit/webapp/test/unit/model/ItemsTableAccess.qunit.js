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
});
