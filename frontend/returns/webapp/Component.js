sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/model/json/JSONModel",
  "cdc/vaccret/model/ReturnTypeConfig"
], function (UIComponent, JSONModel, ReturnTypeConfig) {
  "use strict";

  // No startup parameter resolution — this app is returns-only (ADR-001),
  // unlike the cockpit's OrderModeConfig.resolve(oComponentData.startupParameters).
  // returnContext carries the fixed four-return-type scope (ReturnTypeConfig);
  // an opened document still applies its OWN type's `ui` baseline via
  // ReturnTypeConfig.resolveType() (Detail.controller.js#_applyReturnUi).
  return UIComponent.extend("cdc.vaccret.Component", {
    metadata: {
      manifest: "json"
    },

    init: function () {
      UIComponent.prototype.init.apply(this, arguments);
      var oBundle = this.getModel("i18n").getResourceBundle();
      var oReturnContext = ReturnTypeConfig.resolve();
      oReturnContext.title = oBundle.getText("appTitle");
      oReturnContext.returnTypes.forEach(function (oType) {
        oType.title = oBundle.getText(oType.titleKey);
      });
      this.setModel(new JSONModel(oReturnContext), "returnContext");
      this._setShellTitle(oReturnContext.title);
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
