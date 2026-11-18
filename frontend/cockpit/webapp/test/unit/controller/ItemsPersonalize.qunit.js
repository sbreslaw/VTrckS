/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/schema/OrdersSchema",
  "cdc/vaccreq/model/OrderModeConfig",
  "cdc/vaccreq/model/VariantStore",
  "sap/ui/model/json/JSONModel"
], function (ServiceSchema, OrdersSchema, OrderModeConfig, VariantStore, JSONModel) {
  "use strict";

  // GH-83: the Items "Personalize" button stays in both Items fragments but is
  // disabled, and a column layout saved through it earlier no longer applies.
  // Detail.controller's module graph reads the active profile when it loads
  // (FundLogicService), and QUnit may run this module first - select one.
  QUnit.module("Items Personalize (GH-83)", { beforeEach: function () { ServiceSchema.use(OrdersSchema); } });

  function personalizeButtons(sFragmentPath) {
    return fetch(sap.ui.require.toUrl(sFragmentPath)).then(function (oResponse) {
      return oResponse.text();
    }).then(function (sXml) {
      var oDoc = new DOMParser().parseFromString(sXml, "application/xml");
      return Array.prototype.filter.call(oDoc.getElementsByTagNameNS("*", "Button"), function (oButton) {
        return oButton.getAttribute("press") === ".onItemsPersonalize";
      });
    });
  }

  QUnit.test("both Items fragments keep a disabled Personalize button", function (assert) {
    var aFragments = ["cdc/vaccreq/sections/Items.fragment.xml", "cdc/vaccreq/sections/returns/Items.fragment.xml"];
    return Promise.all(aFragments.map(personalizeButtons)).then(function (aButtons) {
      aButtons.forEach(function (aFound, iIndex) {
        var sFragment = aFragments[iIndex];
        assert.strictEqual(aFound.length, 1, sFragment + ": one Personalize button");
        assert.strictEqual(aFound[0] && aFound[0].getAttribute("enabled"), "false", sFragment + ": disabled");
        assert.strictEqual(aFound[0] && aFound[0].getAttribute("text"), "{i18n>itemsPersonalize}", sFragment + ": label kept");
      });
    });
  });

  QUnit.test("_getItemsColumnVisibility ignores a saved layout", function (assert) {
    // The controller's module graph loads on first use (cold: tens of seconds through the
    // proxy); this page's QUnit 2.3 has no per-test timeout (QUnit.config.testTimeout unset).
    var fnLoad = VariantStore.load;
    VariantStore.load = function () {
      return { variants: { layout: { ndcCode: false, qty: false, ndcDescription: false } }, lastSelectedKey: "layout" };
    };
    return new Promise(function (resolve, reject) {
      sap.ui.require(["cdc/vaccreq/controller/Detail.controller"], resolve, reject);
    }).then(function (Detail) {
      ["orders", "returns"].forEach(function (sProfile) {
        var oLayout = OrderModeConfig.getItemsColumnLayout(sProfile);
        var oStub = {
          getView: function () {
            return { getModel: function () { return new JSONModel({ columns: { lotNumber: { visible: false } } }); } };
          },
          _getItemsColumnLayout: function () { return oLayout; }
        };
        var oExpected = {};
        oLayout.keys.forEach(function (sKey) {
          oExpected[sKey] = sKey !== "lotNumber";
        });
        assert.deepEqual(Detail.prototype._getItemsColumnVisibility.call(oStub), oExpected,
          sProfile + ": every column the order type allows, the order-type-hidden one stays hidden");
      });
    }).finally(function () {
      VariantStore.load = fnLoad;
    });
  });
});
