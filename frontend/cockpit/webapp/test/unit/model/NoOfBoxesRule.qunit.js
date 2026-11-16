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
});
