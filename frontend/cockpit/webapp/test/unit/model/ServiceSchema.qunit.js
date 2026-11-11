/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/schema/OrdersSchema",
  "cdc/vaccreq/model/schema/ReturnsSchema",
  "cdc/vaccreq/service/CreateOrderService"
], function (ServiceSchema, OrdersSchema, ReturnsSchema, CreateOrderService) {
  "use strict";

  // Regression guard: the Returns and Provider Orders apps share one module
  // graph in an FLP session, so Component.init re-runs ServiceSchema.use() on
  // a cross-category relaunch. Live bug (2026-11-11): Returns-only keys
  // (f4Product, defaultStatus) survived into Orders, putting Returns'
  // SalesOrganization filter on the Orders /Product NDC lookup.
  QUnit.module("ServiceSchema.use - cross-profile relaunch");

  QUnit.test("keys only the previous profile defines are dropped", function (assert) {
    ServiceSchema.use(ReturnsSchema);
    assert.ok(ServiceSchema.f4Product, "returns exposes f4Product");
    assert.ok(ServiceSchema.defaultStatus, "returns exposes defaultStatus");

    ServiceSchema.use(OrdersSchema);
    assert.strictEqual(ServiceSchema.profileId, "orders");
    assert.strictEqual(ServiceSchema.f4Product, undefined, "f4Product gone after switching to orders");
    assert.strictEqual(ServiceSchema.defaultStatus, undefined, "defaultStatus gone after switching to orders");
    assert.strictEqual(typeof ServiceSchema.use, "function", "use() itself survives");
  });

  QUnit.test("Returns writes Contact in session; Orders keeps CreatePartner", function (assert) {
    ServiceSchema.use(ReturnsSchema);
    assert.strictEqual(ServiceSchema.contactInSession, true);
    assert.strictEqual(ServiceSchema.buildHeaderPartnerPath("", ServiceSchema.contactPartnerFunction),
      "/HeaderPartner(CustomerReturn='',PartnerFunction='AP')", "same key the standard app PATCHes in session");

    ServiceSchema.use(OrdersSchema);
    assert.notOk(ServiceSchema.contactInSession, "orders has no in-session contact write");
    assert.ok(ServiceSchema.createPartnerAction, "orders still creates the AP partner after SaveChanges");
  });

  QUnit.test("item payload whitelist follows the active profile", function (assert) {
    var oRow = {};
    oRow[ReturnsSchema.itemProperties.returnReason] = "200";
    oRow[OrdersSchema.itemProperties.fundType] = "VFC";

    ServiceSchema.use(ReturnsSchema);
    var oReturnsPayload = CreateOrderService.cleanItemPayload(oRow);
    assert.strictEqual(oReturnsPayload[ReturnsSchema.itemProperties.returnReason], "200", "returns keeps ReasonCode");
    assert.notOk(OrdersSchema.itemProperties.fundType in oReturnsPayload, "returns drops the orders fund type field");

    ServiceSchema.use(OrdersSchema);
    var oOrdersPayload = CreateOrderService.cleanItemPayload(oRow);
    assert.strictEqual(oOrdersPayload[OrdersSchema.itemProperties.fundType], "VFC", "orders keeps the fund type field");
    assert.notOk(ReturnsSchema.itemProperties.returnReason in oOrdersPayload, "orders drops ReasonCode");
  });
});
