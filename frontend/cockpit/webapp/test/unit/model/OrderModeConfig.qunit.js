/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/OrderModeConfig"
], function (OrderModeConfig) {
  "use strict";

  QUnit.module("OrderModeConfig.resolveOrderType");

  // Provider Orders create: the Status Select (createEnrich>/status) starts on
  // E0001, the status the backend's status profile assigns at save.
  QUnit.test("Provider Order types default the create-mode status to E0001", function (assert) {
    OrderModeConfig.getCategoryOrderTypes("_ORD").forEach(function (sType) {
      assert.strictEqual(OrderModeConfig.resolveOrderType(sType).createStatusDefault, "E0001", sType);
    });
  });
});
