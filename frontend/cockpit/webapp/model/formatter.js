sap.ui.define([
  "cdc/vaccreq/model/ServiceSchema",
  "sap/ui/core/format/DateFormat"
], function (ServiceSchema, DateFormat) {
  "use strict";

  var EM_DASH = "\u2014";

  var oDateFormat = DateFormat.getDateInstance();

  function orDash(vValue) {
    if (vValue === null || vValue === undefined || vValue === "") {
      return EM_DASH;
    }
    return vValue;
  }

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

  // Extracted as plain functions (not object methods) so status formatting
  // works correctly regardless of how the caller invokes it: some XML fragments
  // reference formatters as bare strings (e.g. '.formatter.detailStatusText'),
  // which does NOT guarantee `this` is bound to the formatter module — using
  // `this.statusText(...)` inside an object method broke under that call style
  // ("this.statusText is not a function", found live 2026-08-03).
  function fnStatusText(sCode) {
    if (ServiceSchema.statusSource === "e008") {
      return mStatusTextE008[sCode] || sCode || "";
    }
    return mStatusTextStandard[sCode] || sCode || "";
  }

  function fnUserStatusText(sCode) {
    if (ServiceSchema.statusSource === "e008") {
      return mStatusTextE008[sCode] || sCode || "";
    }
    return mStatusTextStandard[sCode] || sCode || "";
  }

  function fnStatusState(sCode) {
    if (ServiceSchema.statusSource === "e008") {
      return mStatusStateE008[sCode] || "None";
    }
    return mStatusStateStandard[sCode] || "None";
  }

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
      return fnStatusText(sCode);
    },

    userStatusText: function (sCode) {
      return fnUserStatusText(sCode);
    },

    masterStatusState: function (sCode) {
      return fnStatusState(sCode);
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

    // BLOCKED-BY-SERVICE: no free-text order description on the header entity.
    masterDescription: function () {
      return EM_DASH;
    },

    masterContact: function (sFullName) {
      return '*****';
      // return orDash(sFullName);
    },

    masterCreatedAt: function (oValue) {
      if (!oValue) {
        return "";
      }
      if (oValue instanceof Date) {
        return oDateFormat.format(oValue);
      }
      return oValue;
    },

    // Employee Responsible name is not exposed by this service (only the personnel
    // number via the contact-info navigation's ResponsibleEmployee field) — title is BLOCKED-BY-SERVICE.
    masterEmployeeResponsibleTitle: function () {
      return EM_DASH;
    },

    masterEmployeeResponsibleText: function (sPernr) {
      return orDash(sPernr);
    },

    masterCreatedByTitle: function (sName) {
      return orDash(sName);
    },

    orDash: function (vValue) {
      return orDash(vValue);
    },

    maskCardNumber: function (sValue) {
      if (!sValue) {
        return EM_DASH;
      }
      var sDigits = String(sValue).replace(/\s+/g, "");
      var sLast4 = sDigits.slice(-4);
      return "\u2022\u2022\u2022\u2022 " + sLast4;
    },

    // Standard "message button" pattern: count + severity-driven button type,
    // bound to sap/ui/core/Messaging's message model (live plumbing; empty in
    // Phase 2 since there is no transactional flow yet to raise messages).
    messagePopoverButtonText: function (aMessages) {
      return String((aMessages || []).length);
    },

    messagePopoverButtonType: function (aMessages) {
      aMessages = aMessages || [];
      if (!aMessages.length) {
        return "Transparent";
      }
      var bHasError = aMessages.some(function (oMessage) { return oMessage.type === "Error"; });
      if (bHasError) {
        return "Negative";
      }
      var bHasWarning = aMessages.some(function (oMessage) { return oMessage.type === "Warning"; });
      return bHasWarning ? "Critical" : "Neutral";
    },

    detailTitle: function (sOrderId, sContact, sPrefix, sFallback) {
      if (!sOrderId) {
        return sFallback;
      }
      return sContact ? (sPrefix + ":" + sOrderId + ", " + sContact) : (sPrefix + ":" + sOrderId);
    },

    detailStatusText: function (sCode) {
      return fnStatusText(sCode);
    },

    detailStatusState: function (sCode) {
      return fnStatusState(sCode);
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
      return fnStatusText(sCode);
    },

    statusState: function (sCode) {
      return fnStatusState(sCode);
    }
  };
});
