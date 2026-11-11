/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/schema/ReturnsSchema",
  "cdc/vaccreq/model/ReturnReasonLogic"
], function (ServiceSchema, ReturnsSchema, ReturnReasonLogic) {
  "use strict";

  // ReturnReasonLogic reads the "Multiple Values" code from the active
  // profile - only ReturnsSchema defines one. Selected before every test:
  // other suites (ServiceSchema.qunit.js) switch the shared facade.
  var oUseReturns = { beforeEach: function () { ServiceSchema.use(ReturnsSchema); } };
  var G99 = ReturnsSchema.headerProperties.orderReasonMultiple;

  QUnit.module("ReturnReasonLogic.defaultForNewItem (rule 2.1.1)", oUseReturns);

  QUnit.test("first item defaults to the header value", function (assert) {
    assert.strictEqual(ReturnReasonLogic.defaultForNewItem("200", []), "200");
  });

  QUnit.test("further items default to the header value", function (assert) {
    assert.strictEqual(ReturnReasonLogic.defaultForNewItem("200", ["201"]), "200");
  });

  QUnit.test("header G99 defaults further items to the first item's value", function (assert) {
    assert.strictEqual(ReturnReasonLogic.defaultForNewItem(G99, ["201", "200"]), "201");
  });

  QUnit.module("ReturnReasonLogic.headerAfterItemChange (rule 2.1.2 + completion a)", oUseReturns);

  QUnit.test("no items -> no header change", function (assert) {
    assert.strictEqual(ReturnReasonLogic.headerAfterItemChange([]), undefined);
  });

  QUnit.test("one item -> header follows it", function (assert) {
    assert.strictEqual(ReturnReasonLogic.headerAfterItemChange(["201"]), "201");
  });

  QUnit.test("mixed items -> G99", function (assert) {
    assert.strictEqual(ReturnReasonLogic.headerAfterItemChange(["200", "201"]), G99);
  });

  QUnit.test("all equal again -> common value", function (assert) {
    assert.strictEqual(ReturnReasonLogic.headerAfterItemChange(["200", "200"]), "200");
  });

  QUnit.module("ReturnReasonLogic.headerAfterItemDelete (completion b)", oUseReturns);

  QUnit.test("no items left -> header unchanged", function (assert) {
    assert.strictEqual(ReturnReasonLogic.headerAfterItemDelete([], G99), undefined);
  });

  QUnit.test("remaining items equal -> common value", function (assert) {
    assert.strictEqual(ReturnReasonLogic.headerAfterItemDelete(["200"], G99), "200");
  });

  QUnit.test("remaining items mixed -> G99", function (assert) {
    assert.strictEqual(ReturnReasonLogic.headerAfterItemDelete(["200", "201"], "200"), G99);
  });

  QUnit.module("ReturnReasonLogic.itemReasonAfterHeaderChange (completion c, broadcast)", oUseReturns);

  QUnit.test("a specific header reason is written to every item", function (assert) {
    assert.strictEqual(ReturnReasonLogic.itemReasonAfterHeaderChange("201"), "201");
  });

  QUnit.test("G99 never overwrites items", function (assert) {
    assert.strictEqual(ReturnReasonLogic.itemReasonAfterHeaderChange(G99), undefined);
  });

  QUnit.test("an empty header reason never overwrites items", function (assert) {
    assert.strictEqual(ReturnReasonLogic.itemReasonAfterHeaderChange(""), undefined);
  });
});
