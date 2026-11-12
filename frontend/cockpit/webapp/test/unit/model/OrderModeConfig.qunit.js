/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/OrderModeConfig",
  "sap/base/i18n/ResourceBundle"
], function (OrderModeConfig, ResourceBundle) {
  "use strict";

  QUnit.module("OrderModeConfig.resolveOrderType");

  // Provider Orders create: the Status Select (createEnrich>/status) starts on
  // E0001, the status the backend's status profile assigns at save.
  QUnit.test("Provider Order types default the create-mode status to E0001", function (assert) {
    OrderModeConfig.getCategoryOrderTypes("_ORD").forEach(function (sType) {
      assert.strictEqual(OrderModeConfig.resolveOrderType(sType).createStatusDefault, "E0001", sType);
    });
  });

  QUnit.module("OrderModeConfig.getItemsColumnLayout");

  // Column keys in the order the profile's Items fragment renders them
  // (each Column's visible="{itemsColumns>/<key>}").
  function fragmentColumnKeys(sFragmentPath) {
    return fetch(sap.ui.require.toUrl(sFragmentPath)).then(function (oResponse) {
      return oResponse.text();
    }).then(function (sXml) {
      var oDoc = new DOMParser().parseFromString(sXml, "application/xml");
      return Array.prototype.map.call(oDoc.getElementsByTagName("Column"), function (oColumn) {
        var aMatch = /itemsColumns>\/(\w+)/.exec(oColumn.getAttribute("visible") || "");
        return aMatch ? aMatch[1] : null;
      });
    });
  }

  QUnit.test("returns: exactly the code owner's 13 columns, in order (2026-11-12)", function (assert) {
    assert.deepEqual(OrderModeConfig.getItemsColumnLayout("returns").keys, [
      "rowAction", "itemNumber", "ndcCode", "lotNumber", "expirationDate", "qty", "uom", "ndcDescription",
      "itemStatus", "rejectionReason", "returnReason", "itemCategory", "exisId"
    ]);
  });

  QUnit.test("orders layout unchanged; unknown profile falls back to it", function (assert) {
    var aOrders = [
      "rowAction", "optOut", "itemNumber", "exisId", "brand", "ndcCode", "lotNumber", "expirationDate", "ndcDescription",
      "qty", "uom", "orderIntention", "fundType", "poReference", "deliveryStatus", "netValue", "rejectionReason"
    ];
    assert.deepEqual(OrderModeConfig.getItemsColumnLayout("orders").keys, aOrders);
    assert.deepEqual(OrderModeConfig.getItemsColumnLayout(undefined).keys, aOrders);
  });

  QUnit.test("every column has a label key that exists in i18n", function (assert) {
    return ResourceBundle.create({ url: sap.ui.require.toUrl("cdc/vaccreq/i18n/i18n.properties"), async: true }).then(function (oBundle) {
      ["orders", "returns"].forEach(function (sProfile) {
        var oLayout = OrderModeConfig.getItemsColumnLayout(sProfile);
        oLayout.keys.forEach(function (sKey) {
          var sTextKey = oLayout.i18n[sKey];
          assert.ok(sTextKey && oBundle.hasText(sTextKey), sProfile + "/" + sKey + " -> " + sTextKey);
        });
      });
    });
  });

  QUnit.test("each profile's Items fragment renders its columns in the layout order", function (assert) {
    return Promise.all([
      fragmentColumnKeys("cdc/vaccreq/sections/Items.fragment.xml"),
      fragmentColumnKeys("cdc/vaccreq/sections/returns/Items.fragment.xml")
    ]).then(function (aKeys) {
      assert.deepEqual(aKeys[0], OrderModeConfig.getItemsColumnLayout("orders").keys, "orders");
      assert.deepEqual(aKeys[1], OrderModeConfig.getItemsColumnLayout("returns").keys, "returns");
    });
  });
});
