sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/core/routing/HashChanger",
  "sap/ui/model/json/JSONModel",
  "cdc/vaccreq/model/OrderModeConfig",
  "cdc/vaccreq/model/OrderAuthorization"
], function (UIComponent, HashChanger, JSONModel, OrderModeConfig, OrderAuthorization) {
  "use strict";

  // Intent-based navigation parameter: a source app opens New Provider Order
  // for a given provider, e.g. #<SemanticObject>-<action>?providerId=1000123.
  var PROVIDER_ID_PARAMETER = "providerId";
  var CREATE_ROUTE = "create";

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
      oOrderContext.orderTypes.forEach(function (oType) {
        oType.title = oBundle.getText(oType.titleKey);
      });
      this.setModel(new JSONModel(oOrderContext), "orderContext");
      this.setModel(new JSONModel({
        types: OrderAuthorization.resolve(oOrderContext.orderTypes.map(function (oType) {
          return oType.orderType;
        }))
      }), "orderAuth");
      this._setShellTitle(oBundle.getText("appTitleOrderType", [oOrderContext.title]));
      this._prepareStartupProvider(this._getStartupProviderId(oComponentData));
      this.getRouter().initialize();
    },

    // Returns the startup providerId once; the Detail controller applies it to
    // the first New Provider Order screen only, never to later "New" presses.
    consumeStartupProviderId: function () {
      var sProviderId = this._sStartupProviderId || "";
      this._sStartupProviderId = "";
      return sProviderId;
    },

    // FLP intent-based navigation delivers providerId as a startup parameter.
    // Standalone runs (index.html, no FLP) have no startupParameters at all,
    // so fall back to the page's own query string (index.html?providerId=...).
    _getStartupProviderId: function (oComponentData) {
      var oStartupParameters = oComponentData.startupParameters;
      var vProviderId = oStartupParameters
        ? oStartupParameters[PROVIDER_ID_PARAMETER]
        : new URLSearchParams(window.location.search).get(PROVIDER_ID_PARAMETER);
      return String((Array.isArray(vProviderId) ? vProviderId[0] : vProviderId) || "").trim();
    },

    // Standard startup-parameter routing: with no inner-app hash, replace it
    // with the create route before the router initializes. An explicit inner
    // hash (bookmark/deep link) always wins; the provider is only kept when
    // that hash already targets the create route.
    _prepareStartupProvider: function (sProviderId) {
      this._sStartupProviderId = "";
      if (!sProviderId) {
        return;
      }
      var oRouter = this.getRouter();
      var oHashChanger = HashChanger.getInstance();
      var sHash = oHashChanger.getHash();
      if (sHash) {
        var oRouteInfo = oRouter.getRouteInfoByHash(sHash);
        if (oRouteInfo && oRouteInfo.name === CREATE_ROUTE) {
          this._sStartupProviderId = sProviderId;
        }
        return;
      }
      var oAuth = this.getModel("orderAuth");
      var sOrderType = (this.getModel("orderContext").getProperty("/orderTypes") || []).map(function (oType) {
        return oType.orderType;
      }).filter(function (sType) {
        return oAuth.getProperty("/types/" + sType + "/CREATE") === true;
      })[0];
      if (!sOrderType) {
        return;
      }
      this._sStartupProviderId = sProviderId;
      oHashChanger.replaceHash(oRouter.getURL(CREATE_ROUTE, { orderType: sOrderType }));
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
