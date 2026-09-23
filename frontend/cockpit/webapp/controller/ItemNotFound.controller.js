sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function (Controller) {
  "use strict";

  return Controller.extend("cdc.vaccreq.controller.ItemNotFound", {
    onBackPress: function () {
      this.getOwnerComponent().getRouter().navTo("master", {}, true);
    }
  });
});
