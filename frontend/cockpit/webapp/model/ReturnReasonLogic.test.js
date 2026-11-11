sap.ui.define([
  "cdc/vaccreq/model/ReturnReasonLogic"
], function (ReturnReasonLogic) {
  "use strict";

  QUnit.module("ReturnReasonLogic");

  QUnit.test("defaultForNewItem: first item → defaults to header value", function (assert) {
    var sResult = ReturnReasonLogic.defaultForNewItem("X", []);
    assert.strictEqual(sResult, "X", "First item defaults to header value");
  });

  QUnit.test("defaultForNewItem: further items, header ≠ G99 → defaults to header value", function (assert) {
    var sResult = ReturnReasonLogic.defaultForNewItem("X", ["X"]);
    assert.strictEqual(sResult, "X", "Further item defaults to header value");
  });

  QUnit.test("defaultForNewItem: further items, header = G99 → defaults to first item value", function (assert) {
    // Mock ServiceSchema
    sap.ui.require.cache = sap.ui.require.cache || {};
    sap.ui.require.cache["cdc/vaccreq/model/ServiceSchema"] = {
      headerProperties: { orderReasonMultiple: "G99" }
    };
    
    var sResult = ReturnReasonLogic.defaultForNewItem("G99", ["X", "Y"]);
    assert.strictEqual(sResult, "X", "Further item with G99 header defaults to first item value");
  });

  QUnit.test("headerAfterItemChange: single item → header = item value", function (assert) {
    var sResult = ReturnReasonLogic.headerAfterItemChange(["X"]);
    assert.strictEqual(sResult, "X", "Single item sets header to that value");
  });

  QUnit.test("headerAfterItemChange: all items equal → header = common value (revert from G99)", function (assert) {
    var sResult = ReturnReasonLogic.headerAfterItemChange(["X", "X", "X"]);
    assert.strictEqual(sResult, "X", "All equal items set header to common value");
  });

  QUnit.test("headerAfterItemChange: items differ → header = G99", function (assert) {
    sap.ui.require.cache = sap.ui.require.cache || {};
    sap.ui.require.cache["cdc/vaccreq/model/ServiceSchema"] = {
      headerProperties: { orderReasonMultiple: "G99" }
    };
    
    var sResult = ReturnReasonLogic.headerAfterItemChange(["X", "Y"]);
    assert.strictEqual(sResult, "G99", "Different items set header to G99");
  });

  QUnit.test("headerAfterItemDelete: no items left → header unchanged (undefined)", function (assert) {
    var sResult = ReturnReasonLogic.headerAfterItemDelete([], "X");
    assert.strictEqual(sResult, undefined, "No items returns undefined (no change)");
  });

  QUnit.test("headerAfterItemDelete: remaining items all equal → header = common value", function (assert) {
    var sResult = ReturnReasonLogic.headerAfterItemDelete(["X", "X"], "G99");
    assert.strictEqual(sResult, "X", "All equal remaining items set header to common value");
  });

  QUnit.test("headerAfterItemDelete: remaining items differ → header = G99", function (assert) {
    sap.ui.require.cache = sap.ui.require.cache || {};
    sap.ui.require.cache["cdc/vaccreq/model/ServiceSchema"] = {
      headerProperties: { orderReasonMultiple: "G99" }
    };
    
    var sResult = ReturnReasonLogic.headerAfterItemDelete(["X", "Y"], "X");
    assert.strictEqual(sResult, "G99", "Different remaining items set header to G99");
  });

  QUnit.test("headerAfterItemDelete: single item remains → header = item value", function (assert) {
    var sResult = ReturnReasonLogic.headerAfterItemDelete(["Z"], "G99");
    assert.strictEqual(sResult, "Z", "Single remaining item sets header to that value");
  });
});
