/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/schema/OrdersSchema",
  "cdc/vaccreq/model/schema/ReturnsSchema",
  "cdc/vaccreq/model/formatter"
], function (OrdersSchema, ReturnsSchema, formatter) {
  "use strict";

  // ret-10-28 #5 regression guard: ItemDetail.controller.js#_bindItemHeader
  // used to hardcode the literal property names "SalesOrder"/"SalesOrderItem"
  // for the Item Detail subtitle binding - those keys don't exist on
  // CustomerReturnManage (confirmed via ui_customerreturnmanage metadata,
  // which uses CustomerReturn/CustomerReturnItem instead) and threw an
  // autoExpandSelect "does not point to a property" error on every _RET item
  // navigation. These tests pin down the schema-driven values the fix now
  // reads instead, for both profiles.
  QUnit.module("ReturnsSchema item-detail key mapping");

  QUnit.test("keys.orderId is CustomerReturn", function (assert) {
    assert.strictEqual(ReturnsSchema.keys.orderId, "CustomerReturn");
  });

  QUnit.test("itemProperties.itemNumber is CustomerReturnItem", function (assert) {
    assert.strictEqual(ReturnsSchema.itemProperties.itemNumber, "CustomerReturnItem");
  });

  QUnit.test("buildItemPath uses CustomerReturn/CustomerReturnItem key predicates", function (assert) {
    var sPath = ReturnsSchema.buildItemPath("690007000", "000010");
    assert.ok(sPath.indexOf("CustomerReturn='690007000'") > -1, "path contains CustomerReturn key: " + sPath);
    assert.ok(sPath.indexOf("CustomerReturnItem='000010'") > -1, "path contains CustomerReturnItem key: " + sPath);
    assert.ok(sPath.indexOf("SalesOrder") === -1, "path must not contain the orders-only SalesOrder key");
  });

  // ret-10-28 #5 (cont'd): itemDetailStatus also used to hardcode the
  // orders-only "_SDProcessStatus/SDProcessStatus_Text" literal path - same
  // bug class, same root cause (absent nav corrupts auto-$expand/$select for
  // the whole item context, cascading "previous request failed" to every
  // other field). Pin down the null-guard value the controller now checks.
  QUnit.test("itemDetailProperties.statusText is null (no equivalent nav on this service)", function (assert) {
    assert.strictEqual(ReturnsSchema.itemDetailProperties.statusText, null);
  });

  QUnit.module("OrdersSchema item-detail key mapping (regression guard)");

  QUnit.test("keys.orderId is SalesOrder", function (assert) {
    assert.strictEqual(OrdersSchema.keys.orderId, "SalesOrder");
  });

  QUnit.test("itemProperties.itemNumber is SalesOrderItem", function (assert) {
    assert.strictEqual(OrdersSchema.itemProperties.itemNumber, "SalesOrderItem");
  });

  QUnit.test("itemDetailProperties.statusText is the real _SDProcessStatus nav", function (assert) {
    assert.strictEqual(OrdersSchema.itemDetailProperties.statusText, "_SDProcessStatus/SDProcessStatus_Text");
  });

  QUnit.module("formatter.itemDetailSubtitle");

  QUnit.test("composes order/item ids with their i18n prefixes", function (assert) {
    var sResult = formatter.itemDetailSubtitle("690007000", "000010", "Return", "Item");
    assert.strictEqual(sResult, "Return: 690007000 / Item: 000010");
  });

  QUnit.test("returns empty string when the order id part is missing (unresolved context)", function (assert) {
    assert.strictEqual(formatter.itemDetailSubtitle("", "000010", "Return", "Item"), "");
  });
});
