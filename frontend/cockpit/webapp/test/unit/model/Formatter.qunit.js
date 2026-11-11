/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/formatter"
], function (formatter) {
  "use strict";

  QUnit.module("formatter.codeAndText");

  QUnit.test("text and code, code only, or an em dash", function (assert) {
    assert.strictEqual(formatter.codeAndText("107", "Chicago"), "Chicago (107)");
    assert.strictEqual(formatter.codeAndText("107", null), "107", "text navigation empty (e.g. not loaded)");
    assert.strictEqual(formatter.codeAndText("", null), "\u2014", "no code (e.g. Sales Group not set)");
  });
});
