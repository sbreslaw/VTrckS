sap.ui.define([], function () {
  "use strict";

  // The backend rejects '*' and '+' in contains/startswith/endswith parameters (501 Not Implemented).
  return {
    forFunction: function (vValue) {
      return typeof vValue === "string" ? vValue.replace(/[*+]/g, "") : vValue;
    }
  };
});
