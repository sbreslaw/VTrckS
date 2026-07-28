sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function (Controller) {
  "use strict";

  return Controller.extend("cdc.vaccreq.controller.App", {
    onInit: function () {
      this.getOwnerComponent().getRouter().getRoute("master").attachPatternMatched(function () {
        this.byId("fcl").setLayout("OneColumn");
      }, this);

      this.getOwnerComponent().getRouter().getRoute("detail").attachPatternMatched(function () {
        this.byId("fcl").setLayout("TwoColumnsMidExpanded");
      }, this);
    }
  });
});
