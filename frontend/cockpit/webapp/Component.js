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
      var oBundle = this.getModel("i18n").getResourceBundle();
      var oOrderContext = OrderModeConfig.resolve(oComponentData.startupParameters);
      oOrderContext.title = oBundle.getText(oOrderContext.titleKey);
      this.setModel(new JSONModel(oOrderContext), "orderContext");
      this._setShellTitle(oBundle.getText("appTitleOrderType", [oOrderContext.title]));
      this.getRouter().initialize();
    },

    _setShellTitle: function (sTitle) {
      this.getService("ShellUIService").then(function (oShellUIService) {
        oShellUIService.setTitle(sTitle);
      }, function () {
        // Standalone run (no FLP): no shell header to set.
        document.title = sTitle;
      });
    }
  });
});
