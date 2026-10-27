sap.ui.define([
  "sap/ui/core/format/DateFormat",
  "sap/base/strings/formatMessage"
], function (DateFormat, formatMessage) {
  "use strict";

  var EM_DASH = "\u2014";

  var oDateFormat = DateFormat.getDateInstance();

  function orDash(vValue) {
    if (vValue === null || vValue === undefined || vValue === "") {
      return EM_DASH;
    }
    return vValue;
  }

  function formatDate(vValue) {
    if (!vValue) {
      return "";
    }
    if (vValue instanceof Date) {
      return oDateFormat.format(vValue);
    }
    // OData V4 Edm.Date values arrive as "YYYY-MM-DD" strings.
    var oDate = DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" }).parse(vValue);
    return oDate ? oDateFormat.format(oDate) : vValue;
  }

  // OvrlSDProcessStatusCriticality (Edm.Byte) follows the standard SAP
  // UI.CriticalityType convention: 0 Neutral, 1 Negative, 2 Critical, 3 Positive
  // (design/metadata/ui_customerreturnmanage_2026-10-26.xml has no explicit
  // Criticality annotation on this field — TODO-VERIFY against a live read,
  // this mapping is the documented SAP default, not guessed from memory).
  function statusState(iCriticality) {
    switch (Number(iCriticality)) {
      case 1: return "Error";
      case 2: return "Warning";
      case 3: return "Success";
      default: return "None";
    }
  }

  // RequestedQuantity (Edm.Decimal) whole-number display rule (prompt §4.3.2):
  // show as a plain integer when there is no fractional part, otherwise the
  // raw decimal string (the model already brings it as a string).
  function formatQuantity(vValue) {
    if (vValue === null || vValue === undefined || vValue === "") {
      return "";
    }
    var fValue = parseFloat(vValue);
    if (isNaN(fValue)) {
      return String(vValue);
    }
    return fValue % 1 === 0 ? String(fValue) : String(vValue);
  }

  // HeaderPricingElementType/ItemPricingElementType: Rate = ConditionRateAmount
  // when ConditionRateValueIsAmount, ConditionRateRatio when
  // ConditionRateValueIsRatio (metadata-confirmed mutually exclusive flags) —
  // same rule as the cockpit's Prices tables.
  function conditionRate(bIsAmount, bIsRatio, fAmount, fRatio) {
    if (bIsRatio) {
      return fRatio;
    }
    if (bIsAmount) {
      return fAmount;
    }
    return "";
  }

  return {
    orDash: orDash,
    formatDate: formatDate,

    // Generic i18n-pattern + args formatter, same convention as the cockpit's
    // formatter.formatText — e.g. {parts: ['i18n>masterTitle', 'returnContext>/title', 'view>/masterCount'], formatter: '.formatter.formatText'}.
    formatText: function (sPattern) {
      return sPattern ? formatMessage(sPattern, Array.prototype.slice.call(arguments, 1)) : "";
    },
    statusState: statusState,
    formatQuantity: formatQuantity,
    conditionRate: conditionRate,

    returnDate: formatDate,
    requestedDeliveryDate: formatDate,
    creationDate: formatDate,

    returnText: function (sValue) {
      return orDash(sValue);
    },

    soldToPartyText: function (sId, sName) {
      sId = sId || "";
      sName = sName || "";
      return sName ? (sId + " - " + sName) : (sId || EM_DASH);
    },

    codeText: function (sCode, sText) {
      sCode = sCode || "";
      sText = sText || "";
      return sText ? (sCode + " - " + sText) : (sCode || EM_DASH);
    },

    netAmountText: function (sValue, sCurrency) {
      if (sValue === null || sValue === undefined || sValue === "") {
        return EM_DASH;
      }
      return sValue + (sCurrency ? " " + sCurrency : "");
    },

    quantityText: function (vValue, sUnit) {
      var sQuantity = formatQuantity(vValue);
      if (!sQuantity) {
        return EM_DASH;
      }
      return sQuantity + (sUnit ? " " + sUnit : "");
    },

    // Detail page header (Detail.controller.js#_bindDetailHeader) — same
    // "message button" + title/facts pattern as the cockpit's formatter.js.
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

    detailTitle: function (sReturnId, sReturnTypeText, sFallback) {
      if (!sReturnId) {
        return sFallback;
      }
      return sReturnTypeText ? (sReturnId + " \u2013 " + sReturnTypeText) : sReturnId;
    },

    detailCreatedOnBy: function (sOn, sBy, sLabel) {
      var sDate = formatDate(sOn);
      return sLabel + ": " + (sDate || EM_DASH) + " / " + (sBy || EM_DASH);
    }
  };
});
