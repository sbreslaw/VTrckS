// Trimmed from frontend/cockpit/webapp/model/MessageExtractor.js @ VTrckS —
// keep in sync until library extraction. The cockpit's version is heavily
// create/save-flow specific (clearStaleMessages/dedupeMessages/addNote,
// generic-wrapper detection tuned to "Save failed" text); this app is
// read-only in MVP-1 (prompt §1 scope guard — no create/edit/PATCH/POST), so
// only the read-error extraction path (`extract`) is kept.
sap.ui.define([
  "sap/ui/core/Messaging",
  "sap/ui/core/message/Message"
], function (Messaging, Message) {
  "use strict";

  // Parses a V4 read-error body (lead message + details[], each with an
  // optional `target`) into sap/ui/core/Messaging for the shared message
  // popover; targeted messages are also mapped to a section id so the
  // caller can auto-expand the panel with the offending field.

  // OData property name (last path segment of `target`) -> SectionConfig.js id.
  var TARGET_SECTION_MAP = {
    SoldToParty: "general",
    CustomerReturnType: "general",
    ReturnsOrderReason: "general",
    ShippingCondition: "general",
    Product: "items",
    Batch: "items",
    RequestedQuantity: "items",
    RequestedQuantityUnit: "items",
    PartnerFunction: "parties",
    Partner: "parties",
    LongTextID: "texts",
    ConditionType: "prices"
  };

  var SOURCE_TAG = "vrExtract";

  // @Common.numericSeverity -> sap.ui.core.MessageType. Unknown/absent
  // numeric severity defaults to "Error" (fail-loud, never silently
  // downgrade a message we can't classify).
  var SEVERITY_MAP = { 1: "Success", 2: "Information", 3: "Warning", 4: "Error" };

  function mapSeverity(vNumericSeverity) {
    return SEVERITY_MAP[Number(vNumericSeverity)] || "Error";
  }

  // Matches a target reaching through the _Item deep-navigation, e.g.
  // ".../_Item(CustomerReturn='60000000',CustomerReturnItem='000010')/Product"
  // — captures the raw (zero-padded) item number.
  var ITEM_TARGET_RE = /_Item\(CustomerReturn='[^']*',CustomerReturnItem='0*(\d+)'\)/;

  function textOf(vMessage) {
    if (!vMessage) {
      return "";
    }
    // OData V4's "Message" structured type is {lang, value}; most SAP
    // Gateway services just send a plain string — handle both.
    return typeof vMessage === "string" ? vMessage : (vMessage.value || "");
  }

  function lastSegment(sTarget) {
    if (!sTarget) {
      return "";
    }
    var sClean = sTarget.split("(")[0];
    var aParts = sClean.split("/");
    return aParts[aParts.length - 1];
  }

  function sectionForTarget(sTarget) {
    return TARGET_SECTION_MAP[lastSegment(sTarget)] || null;
  }

  // Walks Error#cause chains to surface the innermost, actually useful
  // message instead of a generic wrapper.
  function deepestMessage(oError) {
    var oCurrent = oError;
    var sMessage = oError && oError.message;
    while (oCurrent && oCurrent.cause) {
      oCurrent = oCurrent.cause;
      if (oCurrent && oCurrent.message) {
        sMessage = oCurrent.message;
      }
    }
    return sMessage;
  }

  function hasContent(oBody) {
    return !!(oBody && (oBody.message || (oBody.details && oBody.details.length)));
  }

  function deepestErrorBody(oError) {
    var oCurrent = oError;
    var oBody = hasContent(oError && oError.error) ? oError.error : undefined;
    while (oCurrent && oCurrent.cause) {
      oCurrent = oCurrent.cause;
      if (hasContent(oCurrent && oCurrent.error)) {
        oBody = oCurrent.error;
      }
    }
    return oBody;
  }

  // "Item <n>: <text>" for a target reaching an _Item row (leading zeros
  // stripped); the raw text, untouched, otherwise — an unresolvable target
  // must never cause a message to be dropped.
  function attributeText(sText, sTarget, oBundle) {
    if (!sTarget) {
      return sText;
    }
    var oItemMatch = ITEM_TARGET_RE.exec(sTarget);
    if (oItemMatch) {
      var sItemNo = String(parseInt(oItemMatch[1], 10));
      var sPrefix = oBundle ? oBundle.getText("msgItemPrefix", [sItemNo]) : ("Item " + sItemNo);
      return sPrefix + ": " + sText;
    }
    return sText;
  }

  var MessageExtractor = {
    SOURCE_TAG: SOURCE_TAG,

    // oError: the raw rejection from a requestContexts()/getProperty()/
    // bindElement dataReceived promise. sBasePath (optional): the canonical
    // entity path to qualify relative targets against. oBundle (optional):
    // resource bundle for item-attribution text. Returns the deduped list of
    // section ids the messages resolved to.
    extract: function (oError, sBasePath, oBundle) {
      var aSectionIds = [];
      var oBody = deepestErrorBody(oError);

      function addMessage(sRawText, sTarget, sCode, vNumericSeverity) {
        var sFullTarget = sTarget && sBasePath ? sBasePath + "/" + sTarget : undefined;
        var sDisplayText = attributeText(sRawText || "Unknown error", sTarget, oBundle);
        Messaging.addMessages(new Message({
          message: sDisplayText,
          code: sCode,
          type: mapSeverity(vNumericSeverity),
          target: sFullTarget,
          technical: !sFullTarget,
          technicalDetails: { source: SOURCE_TAG, code: sCode, numericSeverity: vNumericSeverity }
        }));
        var sSectionId = sectionForTarget(sTarget);
        if (sSectionId && aSectionIds.indexOf(sSectionId) === -1) {
          aSectionIds.push(sSectionId);
        }
      }

      if (oBody) {
        var aDetails = oBody.details || [];
        if (aDetails.length) {
          aDetails.forEach(function (oDetail) {
            addMessage(textOf(oDetail.message), oDetail.target, oDetail.code, oDetail["@Common.numericSeverity"]);
          });
        } else {
          addMessage(textOf(oBody.message), oBody.target, oBody.code, oBody["@Common.numericSeverity"]);
        }
      } else {
        // No parsed OData error body (e.g. a network/structural failure) —
        // still routed through Messaging/popover, never silent, never a toast.
        addMessage(deepestMessage(oError));
      }

      return aSectionIds;
    }
  };

  return MessageExtractor;
});
