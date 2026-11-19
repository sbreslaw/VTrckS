/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/ItemsGridLayout",
  "cdc/vaccreq/model/OrderModeConfig",
  "cdc/vaccreq/model/VariantStore"
], function (ItemsGridLayout, OrderModeConfig, VariantStore) {
  "use strict";

  // GH-95: the Returns Items grid's view state (columns, order, widths, sort).

  function fakeColumn(sKey, sWidth) {
    var oColumn = {
      width: sWidth,
      getBindingPath: function (sProperty) { return sProperty === "visible" ? "/" + sKey : undefined; },
      getWidth: function () { return oColumn.width; },
      setWidth: function (sNew) { oColumn.width = sNew; }
    };
    return oColumn;
  }

  function fakeTable(aSpecs) {
    var aColumns = aSpecs.map(function (aSpec) { return fakeColumn(aSpec[0], aSpec[1]); });
    return {
      getColumns: function () { return aColumns.slice(); },
      removeColumn: function (oColumn) { aColumns.splice(aColumns.indexOf(oColumn), 1); return oColumn; },
      insertColumn: function (oColumn, iIndex) { aColumns.splice(iIndex, 0, oColumn); }
    };
  }

  function keysOf(oTable) {
    return oTable.getColumns().map(ItemsGridLayout.columnKey);
  }

  var DELIVERED = { columns: [{ key: "a", width: "10%" }, { key: "b", width: "20%" }, { key: "c", width: "" }, { key: "d", width: "5%" }] };

  QUnit.module("ItemsGridLayout (GH-95)");

  QUnit.test("columnKey / readColumns: key = visible binding path, width as set", function (assert) {
    assert.strictEqual(ItemsGridLayout.columnKey(fakeColumn("qty", "5%")), "qty");
    assert.strictEqual(ItemsGridLayout.columnKey({ getBindingPath: function () { return undefined; } }), "");
    assert.deepEqual(ItemsGridLayout.readColumns(fakeTable([["a", "10%"], ["b", ""]])), [{ key: "a", width: "10%" }, { key: "b", width: "" }]);
  });

  QUnit.test("applyColumns: reorders, sets widths, ignores unknown keys, keeps unlisted columns after the listed ones", function (assert) {
    var oTable = fakeTable([["a", "10%"], ["b", "20%"], ["c", ""], ["d", "5%"]]);
    ItemsGridLayout.applyColumns(oTable, [{ key: "c", width: "200px" }, { key: "zz", width: "1px" }, { key: "a", width: "10%" }]);
    assert.deepEqual(keysOf(oTable), ["c", "a", "b", "d"], "order");
    assert.strictEqual(oTable.getColumns()[0].getWidth(), "200px", "width set");
    assert.strictEqual(oTable.getColumns()[1].getWidth(), "10%", "width unchanged");
    ItemsGridLayout.applyColumns(oTable, [{ key: "a" }, { key: "b" }, { key: "c" }, { key: "d" }]);
    assert.deepEqual(keysOf(oTable), ["a", "b", "c", "d"], "back to delivered order");
    assert.strictEqual(oTable.getColumns()[2].getWidth(), "200px", "no width given -> unchanged");
  });

  QUnit.test("normalizeState: null = Standard; unknown keys dropped; missing keys at their delivered index; mandatory visible; unsortable sort dropped", function (assert) {
    assert.deepEqual(ItemsGridLayout.normalizeState(null, DELIVERED, ["a"], ["b", "c"]), {
      columns: DELIVERED.columns,
      visible: { a: true, b: true, c: true, d: true },
      sort: []
    }, "Standard");
    var oState = ItemsGridLayout.normalizeState({
      columns: [{ key: "d", width: "80px" }, { key: "x", width: "1px" }, { key: "a", width: "10%" }, { key: "c", width: "" }],
      visible: { a: false, b: false, d: false, x: false },
      sort: [{ key: "c", descending: true }, { key: "a" }, { key: "c" }, { key: "b" }]
    }, DELIVERED, ["a"], ["b", "c"]);
    assert.deepEqual(oState.columns.map(function (o) { return o.key; }), ["d", "b", "a", "c"], "x dropped, b inserted at index 1");
    assert.strictEqual(oState.columns[1].width, "20%", "inserted key gets its delivered width");
    assert.strictEqual(oState.columns[0].width, "80px", "stored width kept");
    assert.deepEqual(oState.visible, { a: true, b: false, c: true, d: false }, "mandatory a forced visible; x dropped");
    assert.deepEqual(oState.sort, [{ key: "c", descending: true }, { key: "b", descending: false }], "a unsortable, duplicate c dropped");
  });

  QUnit.test("visibility: order-type flag beats the view, mandatory beats the view", function (assert) {
    var fnType = function (sKey) { return sKey !== "d"; };
    assert.deepEqual(ItemsGridLayout.visibility(["a", "b", "c", "d"], fnType, null, ["a"]), { a: true, b: true, c: true, d: false }, "no view");
    assert.deepEqual(ItemsGridLayout.visibility(["a", "b", "c", "d"], fnType, { a: false, b: false, d: true }, ["a"]),
      { a: true, b: false, c: true, d: false }, "view");
  });

  QUnit.test("toSorters: path and direction, entries without a path dropped", function (assert) {
    var aSorters = ItemsGridLayout.toSorters([{ key: "a", descending: true }, { key: "nope" }, { key: "b" }], function (sKey) {
      return { a: "PropA", b: "PropB" }[sKey];
    });
    assert.deepEqual(aSorters.map(function (o) { return [o.sPath, o.bDescending]; }), [["PropA", true], ["PropB", false]]);
  });

  QUnit.test("nextSort: replace, add, remove; input not mutated", function (assert) {
    var aSort = [{ key: "a", descending: false }];
    assert.deepEqual(ItemsGridLayout.nextSort(aSort, "b", "Descending", false), [{ key: "b", descending: true }], "replace");
    assert.deepEqual(ItemsGridLayout.nextSort(aSort, "b", "Ascending", true), [{ key: "a", descending: false }, { key: "b", descending: false }], "add");
    assert.deepEqual(ItemsGridLayout.nextSort(aSort, "a", "Descending", true), [{ key: "a", descending: true }], "add replaces in place");
    assert.deepEqual(ItemsGridLayout.nextSort(aSort, "a", "None", false), [], "remove");
    assert.deepEqual(aSort, [{ key: "a", descending: false }], "not mutated");
  });

  QUnit.test("selectionItems / sortItems use the p13n item shape (name, not key)", function (assert) {
    var fnLabel = function (sKey) { return "L-" + sKey; };
    assert.deepEqual(ItemsGridLayout.selectionItems(["b", "a", "c"], { a: false, b: false }, ["b"], fnLabel), [
      { name: "b", label: "L-b", visible: true },
      { name: "a", label: "L-a", visible: false },
      { name: "c", label: "L-c", visible: true }
    ]);
    assert.deepEqual(ItemsGridLayout.sortItems(["a", "b", "c"], [{ key: "c", descending: true }, { key: "a" }], fnLabel), [
      { name: "c", label: "L-c", sorted: true, descending: true },
      { name: "a", label: "L-a", sorted: true, descending: false },
      { name: "b", label: "L-b", sorted: false, descending: false }
    ]);
  });

  QUnit.test("normalizeStore / emptyStore: nothing stored, unreadable, malformed entries", function (assert) {
    assert.strictEqual(ItemsGridLayout.normalizeStore(null), null, "null");
    assert.strictEqual(ItemsGridLayout.normalizeStore(undefined), null, "undefined");
    assert.strictEqual(ItemsGridLayout.normalizeStore("garbage"), false, "string");
    assert.strictEqual(ItemsGridLayout.normalizeStore([]), false, "array");
    assert.strictEqual(ItemsGridLayout.normalizeStore({ version: 2, views: [] }), false, "other version");
    assert.deepEqual(ItemsGridLayout.emptyStore(), { version: 1, views: [], defaultKey: null, lastSelectedKey: null });
    var oStore = ItemsGridLayout.normalizeStore({
      version: 1,
      views: [
        { key: "v1", title: "One", state: { sort: [] } },
        { key: ItemsGridLayout.STANDARD_KEY, title: "Fake", state: {} },
        { key: "v2", title: "", state: {} },
        { key: "v3", title: "Three" },
        "junk"
      ],
      defaultKey: "v3",
      lastSelectedKey: "v1"
    });
    assert.deepEqual(oStore.views.map(function (o) { return o.key; }), ["v1"], "only the valid view kept");
    assert.strictEqual(oStore.defaultKey, null, "stale default dropped");
    assert.strictEqual(oStore.lastSelectedKey, "v1", "valid last selected kept");
    assert.strictEqual(ItemsGridLayout.normalizeStore({ version: 1, views: [], defaultKey: ItemsGridLayout.STANDARD_KEY }).defaultKey,
      ItemsGridLayout.STANDARD_KEY, "Standard as explicit default kept");
  });

  QUnit.test("initialKey: default > last selected > Standard", function (assert) {
    var S = ItemsGridLayout.STANDARD_KEY;
    assert.strictEqual(ItemsGridLayout.initialKey({ defaultKey: "v1", lastSelectedKey: "v2" }), "v1");
    assert.strictEqual(ItemsGridLayout.initialKey({ defaultKey: S, lastSelectedKey: "v2" }), S);
    assert.strictEqual(ItemsGridLayout.initialKey({ defaultKey: null, lastSelectedKey: "v2" }), "v2");
    assert.strictEqual(ItemsGridLayout.initialKey({ defaultKey: null, lastSelectedKey: null }), S);
  });

  QUnit.test("newKey is unique; vmItems: Standard first and fixed", function (assert) {
    var oStore = ItemsGridLayout.emptyStore();
    var sFirst = ItemsGridLayout.newKey(oStore);
    oStore.views.push({ key: sFirst, title: "One", state: {} });
    var sSecond = ItemsGridLayout.newKey(oStore);
    assert.ok(/^v[0-9a-z]+/.test(sFirst), sFirst);
    assert.notStrictEqual(sSecond, sFirst, "unused key");
    assert.ok(sFirst.length <= 40 && ItemsGridLayout.STORE_ITEM.length <= 40, "Launchpad key limits");
    assert.deepEqual(ItemsGridLayout.vmItems(oStore, "Standard"), [
      { key: ItemsGridLayout.STANDARD_KEY, title: "Standard", changeable: false, remove: false, rename: false },
      { key: sFirst, title: "One", changeable: true, remove: true, rename: true }
    ]);
  });

  QUnit.test("Returns layout declares the mandatory columns (owner Q3); Orders has none", function (assert) {
    assert.deepEqual(OrderModeConfig.getItemsColumnLayout("returns").mandatory, ["rowAction", "ndcCode", "lotNumber", "expirationDate", "qty"]);
    assert.strictEqual(OrderModeConfig.getItemsColumnLayout("orders").mandatory, undefined);
  });

  QUnit.test("VariantStore async API outside the Launchpad: nothing loaded, nothing written", function (assert) {
    assert.strictEqual(sap.ui.require("sap/ushell/Container"), undefined, "no Launchpad on the QUnit page");
    return VariantStore.loadAsync("x").then(function (vValue) {
      assert.strictEqual(vValue, null, "loadAsync -> null");
      return VariantStore.saveAsync("x", {});
    }).then(function (bSaved) {
      assert.strictEqual(bSaved, false, "saveAsync -> false");
    });
  });
});
