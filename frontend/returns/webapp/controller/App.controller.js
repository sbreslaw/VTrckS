sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
  "use strict";

  // Clean, minimal FCL shell — deliberately NOT a copy of the cockpit's
  // App.controller.js: that file carries a large, mostly-dead `appView`
  // model (legacy fields like bMaint/iApprCnt from an older app lineage) and
  // binds onStateChange/onColResize/onColNavigate events in its XML view
  // that have NO corresponding controller functions (confirmed by grep — a
  // silent, long-standing dead binding). sap.f.routing.Router sets the FCL's
  // `layout` property directly per-route (manifest.json routes[].layout);
  // the model binding below only supplies the initial value.
  return Controller.extend("cdc.vaccret.controller.App", {
    onInit: function () {
      this.getView().setModel(new JSONModel({
        busy: false,
        delay: 0,
        layout: "OneColumn",
        previousLayout: "",
        // Minimal subset needed by Detail.view.xml's full-screen toggle
        // buttons (Detail.controller.js#toggleFullScreen) — NOT the
        // cockpit's large, partly-dead appView model (see note above).
        actionButtonsInfo: {
          midColumn: { fullScreen: false }
        }
      }), "appView");
    }
  });
});
