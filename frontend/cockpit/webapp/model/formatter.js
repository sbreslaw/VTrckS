sap.ui.define([
  "cdc/vaccreq/model/ServiceSchema"
], function (ServiceSchema) {
  "use strict";

  var mStatusTextE008 = {
    "1A": "Draft",
    "1B": "Saved",
    "1C": "Submitted with Warnings",
    "1D": "Submitted",
    "1E": "Cancelled",
    "1F": "Partially Fulfilled",
    "1G": "Fulfilled"
  };

  var mStatusStateE008 = {
    "1A": "Information",
    "1B": "None",
    "1C": "Warning",
    "1D": "Success",
    "1E": "Error",
    "1F": "Warning",
    "1G": "Success"
  };

  var mStatusTextStandard = {
    "A": "Not Processed",
    "B": "Partially Processed",
    "C": "Completed"
  };

  var mStatusStateStandard = {
    "A": "Information",
    "B": "Warning",
    "C": "Success"
  };

  return {
    masterRequestId: function (sOrderId) {
      return sOrderId || "";
    },

    masterProvider: function (sId, sName) {
      sId = sId || "";
      sName = sName || "";
      return sName ? (sId + " - " + sName) : sId;
    },

    masterStatusText: function (sCode) {
      return this.statusText(sCode);
    },

    masterStatusState: function (sCode) {
      return this.statusState(sCode);
    },

    masterCreatedOn: function (sValue) {
      return sValue || "";
    },

    masterCreatedBy: function (sValue) {
      return sValue || "";
    },

    masterNetValue: function (sValue) {
      return sValue || "";
    },

    masterCurrency: function (sValue) {
      return sValue || "";
    },

    detailTitle: function (sOrderId, sPrefix, sFallback) {
      return sOrderId ? (sPrefix + " " + sOrderId) : sFallback;
    },

    detailStatusText: function (sCode) {
      return this.statusText(sCode);
    },

    detailStatusState: function (sCode) {
      return this.statusState(sCode);
    },

    detailCreatedOnBy: function (sOn, sBy, sLabel) {
      sOn = sOn || "";
      sBy = sBy || "";
      return sLabel + ": " + sOn + " / " + sBy;
    },

    detailNetValue: function (sValue) {
      return sValue || "";
    },

    detailCurrency: function (sValue) {
      return sValue || "";
    },

    statusText: function (sCode) {
      if (ServiceSchema.statusSource === "e008") {
        return mStatusTextE008[sCode] || sCode || "";
      }
      return mStatusTextStandard[sCode] || sCode || "";
    },

    statusState: function (sCode) {
      if (ServiceSchema.statusSource === "e008") {
        return mStatusStateE008[sCode] || "None";
      }
      return mStatusStateStandard[sCode] || "None";
    }
  };
});
