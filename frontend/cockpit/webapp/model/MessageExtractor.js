sap.ui.define([
  "sap/ui/core/Messaging",
  "sap/ui/core/message/Message"
], function (Messaging, Message) {
  "use strict";

  // Corrective Work Order Fix 4 — the ONE place every create-flow network
  // failure (bootstrap invoke, submitBatch, enrichment, IoH) must be routed
  // through, replacing the generic MessageToast that made every distinct
  // backend rejection look identical (the bug that cost three debugging
  // rounds — the real text only ever reached the console, never the user).
  // Parses a V4 action/batch error body (lead message + details[], each with
  // an optional `target`) into sap/ui/core/Messaging; untargeted messages are
  // popover-only, targeted ones are also mapped to a section id so the caller
  // can auto-expand the panel that actually has the offending field.

  // OData property name (last path segment of `target`) -> section id.
  // Extend as new targets are seen; anything unmapped is still shown in the
  // popover, just without an auto-expand.
  var TARGET_SECTION_MAP = {
    SoldToParty: "details",
    SoldToPartyForCreate: "details",
    SalesOrderType: "details",
    SalesOrganization: "orgData",
    DistributionChannel: "orgData",
    OrganizationDivision: "orgData",
    Product: "items",
    RequestedQuantity: "items",
    RequestedQuantityUnit: "items"
  };

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

  // Walks Error#cause chains (e.g. V4's "HTTP request was not processed
  // because $batch failed" wrapper around an ABAP short dump's own "ABAP
  // Runtime error '...'" cause) to surface the innermost, actually useful
  // message instead of the generic wrapper text.
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

  // Same cause-chain walk as deepestMessage, but for the structured OData
  // error BODY (".error", with its own .details[] array), not just the
  // plain-string ".message". A changeset/batch failure's outermost error is
  // often just a generic wrapper (e.g. "Save failed") with NO .error of its
  // own — the real structured body (details[] with the actual BAL/business
  // message, like "Fund '' does not exist for sales org...") lives on
  // oError.cause.error one or more levels down. Using only the top-level
  // oError.error (as this used to) silently drops that entire body and
  // falls back to deepestMessage()'s bare string, which is exactly why a
  // specific backend message got replaced by a generic "Save failed" toast.
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

  // A ".error" body is only useful if it actually carries a message or a
  // details[] array — an empty/placeholder object at some level of the
  // cause chain must not win over a real body found elsewhere.
  function hasContent(oBody) {
    return !!(oBody && (oBody.message || (oBody.details && oBody.details.length)));
  }

  var MessageExtractor = {
    // oError: the raw rejection from an execute()/invoke()/submitBatch()
    // promise. sBasePath (optional): the canonical entity path (e.g.
    // oContext.getPath()) to qualify relative targets against, so the
    // message model's own target actually resolves to the bound control
    // (only meaningful once a real context exists — omit pre-bootstrap).
    // Returns the deduped list of section ids the messages resolved to.
    extract: function (oError, sBasePath) {
      var aSectionIds = [];
      var oBody = deepestErrorBody(oError);

      function addMessage(sText, sTarget) {
        var sFullTarget = sTarget && sBasePath ? sBasePath + "/" + sTarget : undefined;
        Messaging.addMessages(new Message({
          message: sText || "Unknown error",
          type: "Error",
          target: sFullTarget,
          technical: !sFullTarget
        }));
        var sSectionId = sectionForTarget(sTarget);
        if (sSectionId && aSectionIds.indexOf(sSectionId) === -1) {
          aSectionIds.push(sSectionId);
        }
      }

      if (oBody) {
        addMessage(textOf(oBody.message), oBody.target);
        (oBody.details || []).forEach(function (oDetail) {
          addMessage(textOf(oDetail.message), oDetail.target);
        });
      } else {
        // No parsed OData error body (e.g. a network/batch-structural failure,
        // including an unhandled ABAP short dump) — still routed through
        // Messaging/popover, never silent, never a toast. Prefer the deepest
        // cause's message over the generic "$batch failed" wrapper text.
        addMessage(deepestMessage(oError));
      }

      return aSectionIds;
    }
  };

  return MessageExtractor;
});
