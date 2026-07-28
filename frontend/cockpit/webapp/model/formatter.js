sap.ui.define([], function () {
  "use strict";

  var mStatusText = {
    "1A": "Draft",
    "1B": "Saved",
    "1C": "Submitted with Warnings",
    "1D": "Submitted",
    "1E": "Cancelled",
    "1F": "Partially Fulfilled",
    "1G": "Fulfilled"
  };

  var mStatusState = {
    "1A": "Information",
    "1B": "None",
    "1C": "Warning",
    "1D": "Success",
    "1E": "Error",
    "1F": "Warning",
    "1G": "Success"
  };

  return {
    statusText: function (sCode) {
      return mStatusText[sCode] || sCode || "";
    },

    statusState: function (sCode) {
      return mStatusState[sCode] || "None";
    }
  };
});
