/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/LotNumberRule"
], function (LotNumberRule) {
  "use strict";

  QUnit.module("LotNumberRule");

  QUnit.test("accepts letters, digits and dashes (trimmed); empty clears", function (assert) {
    assert.deepEqual(LotNumberRule.check("AB12-3c", 10), { value: "AB12-3c" });
    assert.deepEqual(LotNumberRule.check("  1542X  ", 10), { value: "1542X" });
    assert.deepEqual(LotNumberRule.check("", 10), { value: "" });
    assert.deepEqual(LotNumberRule.check(null, 10), { value: "" });
  });

  QUnit.test("rejects the listed special characters and any other non-alphanumeric", function (assert) {
    ["?", "*", "%", "&", "=", "<", ">", "~", " ", "_", ".", "/", "#", "É"].forEach(function (sChar) {
      assert.deepEqual(LotNumberRule.check("AB" + sChar + "12", 10), { error: "lotNumberInvalidChars" }, JSON.stringify(sChar));
    });
  });

  QUnit.test("rejects values longer than the max length", function (assert) {
    assert.deepEqual(LotNumberRule.check("ABCDEFGHIJK", 10), { error: "pasteSkippedTooLong", args: [10] });
    assert.deepEqual(LotNumberRule.check("ABCDEFGHIJ", 10), { value: "ABCDEFGHIJ" });
  });
});
