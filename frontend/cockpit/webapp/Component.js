sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/odata/v4/ODataModel",
  "cdc/vaccreq/model/OrderModeConfig",
  "cdc/vaccreq/model/OrderAuthorization",
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/schema/OrdersSchema",
  "cdc/vaccreq/model/schema/ReturnsSchema"
], function (UIComponent, JSONModel, ODataModel, OrderModeConfig, OrderAuthorization, ServiceSchema, OrdersSchema, ReturnsSchema) {
  "use strict";

  return UIComponent.extend("cdc.vaccreq.Component", {
    metadata: {
      manifest: "json"
    },

    init: function () {
      // ADR-002 (Returns_Single_App_Service_Profile): the default (unnamed)
      // OData model MUST exist before UIComponent.prototype.init() runs -
      // that call synchronously instantiates the root view/App.controller.js,
      // whose onInit() reads this.getOwnerComponent().getModel() straight
      // away (metadata-loaded busy-indicator wiring). getComponentData() is
      // available this early (set during construction, before init()); the
      // i18n/po/shippingAddressVH/view models (manifest-declared) are NOT
      // available yet at this point - they are created as part of the
      // UIComponent.prototype.init() call below, so title-bundle lookups
      // must wait until after that call returns.
      var oComponentData = this.getComponentData() || {};
      var oOrderContext = OrderModeConfig.resolve(oComponentData.startupParameters);
      ServiceSchema.use(oOrderContext.category === "_RET" ? ReturnsSchema : OrdersSchema);
      this.setModel(new ODataModel({
        serviceUrl: ServiceSchema.serviceRoot,
        operationMode: "Server",
        autoExpandSelect: true,
        groupId: "$auto",
        groupProperties: {
          vrEdit: { submit: "API" },
          vrCreate: { submit: "API" },
          vrCreateReplay: { submit: "API" }
        }
      }));

      UIComponent.prototype.init.apply(this, arguments);

      var oBundle = this.getModel("i18n").getResourceBundle();
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
