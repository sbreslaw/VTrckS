/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/schema/OrdersSchema",
  "cdc/vaccreq/model/schema/ReturnsSchema",
  "cdc/vaccreq/service/CreateOrderService",
  "cdc/vaccreq/model/formatter"
], function (ServiceSchema, OrdersSchema, ReturnsSchema, CreateOrderService, formatter) {
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

  // GH-81: CreateOrderService.enter() seeds the order type's createStatusDefault
  // only on a profile with a writable header status (Returns); Orders seed none.
  QUnit.test("create seed: Returns start on the type's status, Orders seed none (GH-81)", function (assert) {
    function seed(sOrderType) {
      var oData;
      var oModel = {
        bindList: function () {
          return {
            create: function (oInitialData) {
              oData = oInitialData;
              return { created: function () { return Promise.resolve(); } };
            }
          };
        }
      };
      CreateOrderService.enter(oModel, sOrderType, {});
      return oData;
    }

    ServiceSchema.use(ReturnsSchema);
    assert.strictEqual(seed("ZKR")[ReturnsSchema.headerProperties.status], "E0001", "ZKR");
    ["ZISL", "ZXFR", "ZWST"].forEach(function (sType) {
      assert.strictEqual(seed(sType)[ReturnsSchema.headerProperties.status], "E0003", sType);
    });

    ServiceSchema.use(OrdersSchema);
    assert.notOk(Object.prototype.hasOwnProperty.call(seed("ZKB"), OrdersSchema.headerProperties.status), "orders: no status seeded");
  });

  // Create-mode section gate (Detail.controller.js#_hasMandatoryHeaderFields):
  // Provider Orders open the other sections once the Provider is set (Reason is
  // optional, code owner 2026-11-12); Returns keep Provider/Return Type/Return Reason.
  QUnit.test("create-mode mandatory header fields per profile", function (assert) {
    function fields(oSchema) {
      return oSchema.createMandatoryHeaderFields.map(function (oField) { return oField.field; });
    }
    assert.deepEqual(fields(OrdersSchema), ["providerId"], "orders: Provider only");
    assert.deepEqual(fields(ReturnsSchema), ["providerId", "returnType", "orderReason"], "returns unchanged");
  });

  QUnit.test("both profiles address the session's Contact Person row by key", function (assert) {
    ServiceSchema.use(ReturnsSchema);
    assert.strictEqual(ServiceSchema.buildHeaderPartnerPath("", ServiceSchema.contactPartnerFunction),
      "/HeaderPartner(CustomerReturn='',PartnerFunction='AP')", "same key the standard returns app PATCHes in session");

    ServiceSchema.use(OrdersSchema);
    assert.strictEqual(ServiceSchema.buildHeaderPartnerPath("", ServiceSchema.contactPartnerFunction),
      "/HeaderPartner(SalesOrder='',PartnerFunction='AP')", "orders session row");
  });

  QUnit.test("both profiles expose the shared order log contract", function (assert) {
    [OrdersSchema, ReturnsSchema].forEach(function (oSchema) {
      assert.strictEqual(oSchema.providerOrderService.entitySets.orderLogMessage, "OrderLogMessage", oSchema.profileId);
      assert.strictEqual(oSchema.providerOrderService.orderLogMessageProperties.sequence, "MessageSequence", oSchema.profileId + " sequence");
      assert.strictEqual(oSchema.providerOrderService.orderLogMessageProperties.text, "MessageText", oSchema.profileId + " text");
    });
  });

  // GH-87: only Returns run Items edit in an edit session.
  QUnit.test("Items edit session action: Returns PrepareForEdit, Orders none (GH-87)", function (assert) {
    ServiceSchema.use(ReturnsSchema);
    assert.strictEqual(ServiceSchema.itemsEditAction, "com.sap.gateway.srvd.ui_customerreturnmanage.v0001.PrepareForEdit", "returns");
    ServiceSchema.use(OrdersSchema);
    assert.strictEqual(ServiceSchema.itemsEditAction, null, "orders: sessionless Items edit");
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

  // Live bug 2026-11-11: the Parties row-action guard {:= ${PartnerFunction} !== 'AG' }
  // never evaluated (V4 converted "AG" to boolean and threw), so Delete/Change
  // showed on the Sold-To row. The guard now reads the profile's Sold-To code.
  QUnit.test("Parties row actions are hidden only on the orders Sold-To row", function (assert) {
    ServiceSchema.use(OrdersSchema);
    assert.strictEqual(ServiceSchema.partnerFunctions.soldTo, "AG", "orders Sold-To function");
    assert.strictEqual(formatter.isNotSoldTo("AG"), false, "Sold-To: hidden");
    ["AP", "RE", "RG", "WE"].forEach(function (sFunction) {
      assert.strictEqual(formatter.isNotSoldTo(sFunction), true, sFunction + ": shown");
    });
  });
});
