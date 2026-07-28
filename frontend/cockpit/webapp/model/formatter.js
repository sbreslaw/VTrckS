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

  function getValue(oRow, sProperty) {
    return oRow && sProperty ? oRow[sProperty] : null;
  }

  return {
    masterRequestId: function (oRow) {
      return getValue(oRow, ServiceSchema.keys.orderId) || "";
    },

    masterProvider: function (oRow) {
      var sId = getValue(oRow, ServiceSchema.headerProperties.providerId) || "";
      var sName = getValue(oRow, ServiceSchema.headerProperties.providerName) || "";
      return sName ? (sId + " - " + sName) : sId;
    },

    masterStatusText: function (oRow) {
      var sCode = getValue(oRow, ServiceSchema.headerProperties.status);
      return this.statusText(sCode);
    },

    masterStatusState: function (oRow) {
      var sCode = getValue(oRow, ServiceSchema.headerProperties.status);
      return this.statusState(sCode);
    },

    masterCreatedOn: function (oRow) {
      return getValue(oRow, ServiceSchema.headerProperties.createdOn) || "";
    },

    masterCreatedBy: function (oRow) {
      return getValue(oRow, ServiceSchema.headerProperties.createdBy) || "";
    },

    masterNetValue: function (oRow) {
      return getValue(oRow, ServiceSchema.headerProperties.netValue) || "";
    },

    masterCurrency: function (oRow) {
      return getValue(oRow, ServiceSchema.headerProperties.currency) || "";
    },

    detailTitle: function (oRow, sPrefix, sFallback) {
      var sId = getValue(oRow, ServiceSchema.keys.orderId);
      return sId ? (sPrefix + " " + sId) : sFallback;
    },

    detailStatusText: function (oRow) {
      var sCode = getValue(oRow, ServiceSchema.headerProperties.status);
      return this.statusText(sCode);
    },

    detailStatusState: function (oRow) {
      var sCode = getValue(oRow, ServiceSchema.headerProperties.status);
      return this.statusState(sCode);
    },

    detailCreatedOnBy: function (oRow, sLabel) {
      var sOn = getValue(oRow, ServiceSchema.headerProperties.createdOn) || "";
      var sBy = getValue(oRow, ServiceSchema.headerProperties.createdBy) || "";
      return sLabel + ": " + sOn + " / " + sBy;
    },

    detailNetValue: function (oRow) {
      return getValue(oRow, ServiceSchema.headerProperties.netValue) || "";
    },

    detailCurrency: function (oRow) {
      return getValue(oRow, ServiceSchema.headerProperties.currency) || "";
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
