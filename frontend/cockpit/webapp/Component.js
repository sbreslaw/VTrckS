sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/model/json/JSONModel",
  "cdc/vaccreq/model/OrderModeConfig"
], function (UIComponent, JSONModel, OrderModeConfig) {
  "use strict";

  return UIComponent.extend("cdc.vaccreq.Component", {
    metadata: {
      manifest: "json"
    },

    init: function () {
      UIComponent.prototype.init.apply(this, arguments);
      var oComponentData = this.getComponentData() || {};
      this.setModel(new JSONModel(OrderModeConfig.resolve(oComponentData.startupParameters)), "orderContext");
      this.getRouter().initialize();
    }
  });
});
