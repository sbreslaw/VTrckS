/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/schema/ReturnsSchema",
  "cdc/vaccreq/model/ReturnReasonLogic",
  "cdc/vaccreq/model/formatter"
], function (ServiceSchema, ReturnsSchema, ReturnReasonLogic, formatter) {
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

  // GH-75: Items edit rewrites the header code, so the General display must
  // derive its text from the code - the header's loaded nav text never follows.
  QUnit.module("Returns Details: header Return Reason display (GH-75)", oUseReturns);

  QUnit.test("display Text binds the code and the reason list, not the loaded nav text", function (assert) {
    return fetch(sap.ui.require.toUrl("cdc/vaccreq/sections/returns/Details.fragment.xml")).then(function (oResponse) {
      return oResponse.text();
    }).then(function (sXml) {
      var oDoc = new DOMParser().parseFromString(sXml, "application/xml");
      var oCombo = Array.prototype.filter.call(oDoc.getElementsByTagNameNS("*", "ComboBox"), function (oNode) {
        return oNode.getAttribute("change") === ".onReturnReasonChange";
      })[0];
      var oText = oCombo && Array.prototype.filter.call(oCombo.parentNode.children, function (oNode) {
        return oNode.localName === "Text";
      })[0];
      var sText = oText ? oText.getAttribute("text") : "";
      assert.notStrictEqual(sText.indexOf("path: '" + ReturnsSchema.headerProperties.orderReason + "'"), -1, "binds the header code");
      assert.notStrictEqual(sText.indexOf("returnReasons>/list"), -1, "binds the reason list");
      assert.notStrictEqual(sText.indexOf(".formatter.categoryText"), -1, "derives the text with categoryText");
      assert.strictEqual(sText.indexOf(ReturnsSchema.navigation.headerToOrderReason + "/"), -1, "no loaded nav text");
    });
  });

  QUnit.test("categoryText maps the header code to its list text", function (assert) {
    var aList = [{ key: "100", text: "Broken Vial/Syringe" }, { key: G99, text: "Multiple Reasons" }];
    assert.strictEqual(formatter.categoryText(G99, aList), "Multiple Reasons");
    assert.strictEqual(formatter.categoryText("100", aList), "Broken Vial/Syringe");
    assert.strictEqual(formatter.categoryText("999", aList), "999", "unknown code shown as is");
    assert.strictEqual(formatter.categoryText("", aList), "", "blank stays blank");
  });
});
