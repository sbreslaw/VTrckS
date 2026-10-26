// copied from frontend/cockpit/webapp/util/FilterValue.js @ VTrckS — keep in sync until library extraction.
sap.ui.define([], function () {
  "use strict";

  // The backend rejects '*' and '+' in contains/startswith/endswith parameters (501 Not Implemented).
  return {
    forFunction: function (vValue) {
      return typeof vValue === "string" ? vValue.replace(/[*+]/g, "") : vValue;
    }
  };
});
