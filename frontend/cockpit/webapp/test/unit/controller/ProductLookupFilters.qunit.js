/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/schema/OrdersSchema",
  "cdc/vaccreq/model/schema/ReturnsSchema",
  "sap/ui/model/FilterOperator"
], function (ServiceSchema, OrdersSchema, ReturnsSchema, FilterOperator) {
  "use strict";

  // GH-86: on an existing return the NDC lookup filters on the header's
  // SalesOrganization/DistributionChannel, which only the collapsed Org Data
  // panel binds - so both header bindings must select them.
  var sPreviousProfile;

  QUnit.module("NDC lookup header fields (GH-86)", {
    // Detail.controller's module graph reads the active profile when it loads
    // (FundLogicService), and QUnit may run this module first - select one.
    beforeEach: function () {
      sPreviousProfile = ServiceSchema.profileId;
      ServiceSchema.use(OrdersSchema);
    },
    afterEach: function () {
      if (sPreviousProfile) {
        ServiceSchema.use(sPreviousProfile === ReturnsSchema.profileId ? ReturnsSchema : OrdersSchema);
      }
    }
  });

  // The controller's module graph loads on first use (cold: tens of seconds through the proxy).
  function loadDetail() {
    return new Promise(function (resolve, reject) {
      sap.ui.require(["cdc/vaccreq/controller/Detail.controller"], resolve, reject);
    });
  }

  // A controller instance without a view: every collaborator of the header
  // binding paths is a no-op, the view records what bindElement receives.
  function stubController(Detail, oHeaderValues) {
    var oStub = Object.create(Detail.prototype);
    var oHeaderContext = {
      getProperty: function (sPath) { return oHeaderValues[sPath]; }
    };
    oStub.bound = [];
    oStub.getView = function () {
      return {
        bindElement: function (oInfo) { oStub.bound.push(oInfo); },
        unbindElement: function () {},
        getBindingContext: function () { return oHeaderContext; },
        getElementBinding: function () { return { attachEventOnce: function () {} }; }
      };
    };
    ["_destroyCreateContext", "_resetCreateSaveState", "_setCreateMode", "_loadHeaderNotes", "_loadDetailContact",
      "_releaseItemsTable", "_bindDetailHeader", "_computeHeaderTaxAmount", "_resetTransactionHistoryState",
      "_refreshTransactionHistory", "_syncOrderUiFromContext"].forEach(function (sName) {
      oStub[sName] = function () {};
    });
    oStub._oSectionFactory = { rebind: function () {} };
    return oStub;
  }

  function selectOf(oBindingInfo) {
    return oBindingInfo.parameters.$select.split(",");
  }

  QUnit.test("only the Returns profile asks for the sales area", function (assert) {
    return loadDetail().then(function (Detail) {
      ServiceSchema.use(ReturnsSchema);
      assert.deepEqual(Detail.prototype._productLookupHeaderSelect.call({}), ["SalesOrganization", "DistributionChannel"], "returns");
      ServiceSchema.use(OrdersSchema);
      assert.deepEqual(Detail.prototype._productLookupHeaderSelect.call({}), [], "orders");
    });
  });

  QUnit.test("opening an order selects the sales area on Returns only", function (assert) {
    var oEvent = { getParameter: function () { return { orderId: "1" }; } };
    return loadDetail().then(function (Detail) {
      ServiceSchema.use(ReturnsSchema);
      var oReturns = stubController(Detail, {});
      oReturns._onObjectMatched(oEvent);
      var aReturnsSelect = selectOf(oReturns.bound[0]);
      assert.ok(aReturnsSelect.indexOf("SalesOrganization") !== -1, "returns: SalesOrganization");
      assert.ok(aReturnsSelect.indexOf("DistributionChannel") !== -1, "returns: DistributionChannel");

      ServiceSchema.use(OrdersSchema);
      var oOrders = stubController(Detail, {});
      oOrders._onObjectMatched(oEvent);
      var aOrdersSelect = selectOf(oOrders.bound[0]);
      assert.strictEqual(aOrdersSelect.indexOf("SalesOrganization"), -1, "orders: no SalesOrganization");
      assert.strictEqual(aOrdersSelect.indexOf("DistributionChannel"), -1, "orders: no DistributionChannel");
    });
  });

  QUnit.test("the header reload after a section save keeps the sales area", function (assert) {
    return loadDetail().then(function (Detail) {
      ServiceSchema.use(ReturnsSchema);
      var oReturns = stubController(Detail, {});
      oReturns._reloadHeaderContext("/x");
      assert.strictEqual(oReturns.bound[0].parameters.$select, "CustomerReturnType,SalesOrganization,DistributionChannel", "returns");

      ServiceSchema.use(OrdersSchema);
      var oOrders = stubController(Detail, {});
      oOrders._reloadHeaderContext("/x");
      assert.strictEqual(oOrders.bound[0].parameters.$select, "SalesOrderType", "orders unchanged");
    });
  });

  QUnit.test("the loaded sales area becomes the NDC lookup filter", function (assert) {
    return loadDetail().then(function (Detail) {
      ServiceSchema.use(ReturnsSchema);
      var oStub = stubController(Detail, { SalesOrganization: "1000", DistributionChannel: "10" });
      var aFilters = oStub._productLookupFilters().map(function (oFilter) {
        return [oFilter.getPath(), oFilter.getOperator(), oFilter.getValue1()];
      });
      assert.deepEqual(aFilters, [
        [ReturnsSchema.f4Product.properties.salesOrganization, FilterOperator.EQ, "1000"],
        [ReturnsSchema.f4Product.properties.distributionChannel, FilterOperator.EQ, "10"]
      ]);
    });
  });
});
