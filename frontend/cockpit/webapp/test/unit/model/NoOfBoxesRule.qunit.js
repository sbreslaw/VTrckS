/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/NoOfBoxesRule"
], function (NoOfBoxesRule) {
  "use strict";

  QUnit.module("NoOfBoxesRule");

  QUnit.test("range is 0 to 25 inclusive", function (assert) {
    assert.strictEqual(NoOfBoxesRule.MIN, 0);
    assert.strictEqual(NoOfBoxesRule.MAX, 25);
  });

  QUnit.test("options lists 26 entries, 0 through 25, in numeric order", function (assert) {
    var aOptions = NoOfBoxesRule.options();
    assert.strictEqual(aOptions.length, 26);
    assert.deepEqual(aOptions[0], { key: "0", text: "0" });
    assert.deepEqual(aOptions[25], { key: "25", text: "25" });
    aOptions.forEach(function (oOption, i) {
      assert.strictEqual(oOption.key, String(i), "key at " + i);
      assert.strictEqual(oOption.text, oOption.key, "text equals key at " + i);
    });
  });

  QUnit.test("options returns a fresh array each call", function (assert) {
    var aFirst = NoOfBoxesRule.options();
    aFirst.pop();
    assert.strictEqual(NoOfBoxesRule.options().length, 26);
  });

  QUnit.test("0 boxes forces Shipping Condition 01 and locks it; other values do neither", function (assert) {
    assert.strictEqual(NoOfBoxesRule.shippingConditionFor("0"), "01");
    assert.strictEqual(NoOfBoxesRule.locksShippingCondition("0"), true);
    ["1", "25", "", null, undefined, "00", 0].forEach(function (vValue) {
      assert.strictEqual(NoOfBoxesRule.shippingConditionFor(vValue), null, "forces none for " + JSON.stringify(vValue));
      assert.strictEqual(NoOfBoxesRule.locksShippingCondition(vValue), false, "does not lock for " + JSON.stringify(vValue));
    });
  });
});
