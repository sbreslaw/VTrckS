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

  // Message Accuracy & Hygiene task (this file's own header comment above is
  // still correct and is extended, never rewritten, below): every message
  // THIS module adds carries this tag in technicalDetails.source so a later
  // save attempt can surgically clear only these (Gap 1), never a
  // client-side validation message added by some other part of the app.
  var SOURCE_TAG = "vrExtract";

  // @Common.numericSeverity -> sap.ui.core.MessageType (Gap 4). TODO-VERIFY:
  // exact annotation key/casing against a live error body that actually
  // carries it - not yet seen live in this app, see NOTES.md severity
  // mapping table. Unknown/absent numeric severity defaults to "Error"
  // (fail-loud, never silently downgrade a message we can't classify).
  var SEVERITY_MAP = { 1: "Success", 2: "Information", 3: "Warning", 4: "Error" };

  function mapSeverity(vNumericSeverity) {
    return SEVERITY_MAP[Number(vNumericSeverity)] || "Error";
  }

  // Matches a target reaching through the _Item deep-navigation, e.g.
  // ".../_Item(SalesOrder='4711',SalesOrderItem='000010')/Product" -
  // captures the raw (zero-padded) item number.
  var ITEM_TARGET_RE = /_Item\(SalesOrder='[^']*',SalesOrderItem='0*(\d+)'\)/;

  // Header-only property -> i18n key for a short field-label prefix (Gap 3).
  // Only properties that can legitimately appear as a HEADER target (never
  // reached through _Item) belong here - an item-level target is always
  // handled by ITEM_TARGET_RE first, regardless of which property it ends
  // in (so Product/RequestedQuantity etc. are NOT listed here even though
  // they're also section-mapped above for "items").
  var HEADER_FIELD_LABEL_I18N = {
    SoldToParty: "msgFieldProvider",
    SoldToPartyForCreate: "msgFieldProvider",
    SalesOrderType: "msgFieldOrderType",
    SalesOrganization: "msgFieldSalesOrg",
    DistributionChannel: "msgFieldDistributionChannel",
    OrganizationDivision: "msgFieldDivision"
  };

  function textOf(vMessage) {
    if (!vMessage) {
      return "";
    }
    // OData V4's "Message" structured type is {lang, value}; most SAP
    // Gateway services just send a plain string — handle both.
    return typeof vMessage === "string" ? vMessage : (vMessage.value || "");
  }

  // Live-confirmed generic wrapper texts that carry no information beyond
  // "something failed" - e.g. RAP_SD_SLS_COMMON/007's whole-document commit
  // rejection ("Save failed", target "$Parameter/_it") arriving on a LATER
  // request (SaveChanges) than the one that already reported the real, root
  // cause (an item-level SAP__Messages entry the V4 model auto-added earlier
  // in the SAME save attempt). Extend this list if a new bare-wrapper string
  // is seen live - never match on partial/unrelated text.
  var GENERIC_WRAPPER_PREFIXES = ["save failed"];

  function isGenericWrapper(sText) {
    var sNormalized = (sText || "").trim().toLowerCase();
    return GENERIC_WRAPPER_PREFIXES.some(function (sPrefix) {
      return sNormalized.indexOf(sPrefix) === 0;
    });
  }

  // A "real" message already in Messaging (most likely the V4 model's own
  // auto-added Message from an earlier step's SAP__Messages, per Gap 0) means
  // a subsequent bare generic wrapper adds nothing for the user - only ever
  // used to SKIP adding another generic wrapper, never to drop the sole
  // message when nothing else exists yet.
  function hasRealMessage() {
    return Messaging.getMessageModel().getData().some(function (oMessage) {
      return !isGenericWrapper(oMessage.getMessage ? oMessage.getMessage() : "");
    });
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

  // Gap 3 - item attribution: "Item 10: <text>" for a target reaching an
  // _Item row (leading zeros stripped); a resolvable header field label
  // otherwise; the raw text, untouched, if neither resolves - an
  // unresolvable target must never cause a message to be dropped.
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
    var sLabelKey = HEADER_FIELD_LABEL_I18N[lastSegment(sTarget)];
    if (sLabelKey && oBundle) {
      return oBundle.getText(sLabelKey) + ": " + sText;
    }
    return sText;
  }

  // Gap 4 - code fidelity: the MessageItem template in Detail.controller.js
  // (_openMessagePopover) does not bind a "code" property, so the only way
  // the user actually sees it today is appended to the text; the raw code
  // is also stashed in technicalDetails.code (below), both for dedup
  // matching and in case a future popover template renders it directly.
  function withCode(sText, sCode) {
    return sCode ? (sText + " (" + sCode + ")") : sText;
  }

  // Gap 2 - dedupe at extraction time: an existing message (ours from an
  // earlier detail in this SAME error body, or the V4 model's own
  // auto-added technical message for this failure - see NOTES.md "Step-0:
  // does the V4 model auto-add its own messages") already covering the same
  // (target, raw text[, code]) triple means skip, not duplicate. Matches on
  // text via substring rather than equality: OUR OWN message carries the
  // raw text embedded inside a decorated string (item/field prefix + code
  // suffix, see attributeText/withCode above), while a model-auto message
  // would carry the bare raw text only.
  function isDuplicate(sTarget, sRawText, sCode) {
    if (!sRawText) {
      return false;
    }
    return Messaging.getMessageModel().getData().some(function (oExisting) {
      var sExistingTarget = oExisting.getTarget ? oExisting.getTarget() : undefined;
      if (sTarget && sExistingTarget !== sTarget) {
        return false;
      }
      var oDetails = oExisting.getTechnicalDetails && oExisting.getTechnicalDetails();
      if (sCode && oDetails && oDetails.code && oDetails.code !== sCode) {
        return false;
      }
      var sExistingText = oExisting.getMessage ? oExisting.getMessage() : "";
      return sExistingText.indexOf(sRawText) !== -1;
    });
  }

  // Companion to isDuplicate() - once real message(s) are safely added for
  // this failure, ANY remaining untagged message (i.e. not added by this
  // module) is the V4 model's own generic auto-parsed technical wrapper for
  // the SAME failure (httpStatus is only ever set by the model's own message
  // parsing - same signal clearStaleMessages/_hasConflictMessage already
  // trust) - noise once a real, specific message exists. Live bug (2026-08-31):
  // this used to remove EVERY untagged/httpStatus message unconditionally,
  // which also wiped out a genuine business message the model itself
  // auto-added from SAP__Messages whenever isDuplicate() (correctly) skipped
  // re-adding it - that real message then had no SOURCE_TAG to protect it,
  // leaving only the generic wrapper visible. Must only ever remove messages
  // whose OWN text is itself a generic wrapper.
  function removeDuplicateAutoMessages() {
    if (!hasRealMessage()) {
      return;
    }
    var aToRemove = Messaging.getMessageModel().getData().filter(function (oExisting) {
      var oDetails = oExisting.getTechnicalDetails && oExisting.getTechnicalDetails();
      if (oDetails && oDetails.source === SOURCE_TAG) {
        return false;
      }
      if (!(oDetails && oDetails.httpStatus !== undefined)) {
        return false;
      }
      return isGenericWrapper(oExisting.getMessage ? oExisting.getMessage() : "");
    });
    if (aToRemove.length) {
      Messaging.removeMessages(aToRemove);
    }
  }

  var MessageExtractor = {
    SOURCE_TAG: SOURCE_TAG,

    // Live evidence (2026-09-01): the create flow's own SaveChanges (step ③)
    // and header PATCH replay (step ④) are TWO separate, both-successful
    // requests that re-run the SAME backend user-exit/validation - each one
    // legitimately carries its own SAP__Messages/sap-messages, so the V4
    // model's automatic message handling adds the identical "has been
    // saved"/"Document is incomplete" pair a second time verbatim, alongside
    // whatever new message the second call actually introduces. Nothing here
    // is an error to extract (both calls succeeded) - call once after the
    // whole ①-④ replay settles to collapse exact repeats down to one.
    dedupeMessages: function () {
      var oSeen = {};
      var aToRemove = Messaging.getMessageModel().getData().filter(function (oMessage) {
        var sCode = oMessage.getCode ? oMessage.getCode() : "";
        var sKey = sCode + "|" + (oMessage.getMessage ? oMessage.getMessage() : "");
        if (oSeen[sKey]) {
          return true;
        }
        oSeen[sKey] = true;
        return false;
      });
      if (aToRemove.length) {
        Messaging.removeMessages(aToRemove);
      }
    },

    // Gap 1 - pre-attempt clearing: call before EVERY save attempt (create
    // chain ①–④ entry point, change-mode save entry point). Removes only
    // (a) messages this module added (technicalDetails.source === SOURCE_TAG)
    // and (b) technical messages the OData model itself added
    // (technicalDetails.httpStatus is only ever set by the model's own
    // message parsing - EditRequestService's existing 412 conflict check
    // already relies on this same signal) - never a plain client-side
    // validation message added by some other part of the app.
    clearStaleMessages: function () {
      var aStale = Messaging.getMessageModel().getData().filter(function (oMessage) {
        var oDetails = oMessage.getTechnicalDetails && oMessage.getTechnicalDetails();
        return !!(oDetails && (oDetails.source === SOURCE_TAG || oDetails.httpStatus !== undefined));
      });
      if (aStale.length) {
        Messaging.removeMessages(aStale);
      }
    },

    // A non-backend, client-composed status note (e.g. "order X was created,
    // finish the rest in Change Mode") that should behave exactly like an
    // extracted message for popover grouping and pre-attempt clearing -
    // tagged the same way, just without a target/section/backend code.
    addNote: function (sText, sType) {
      Messaging.addMessages(new Message({
        message: sText,
        type: sType || "Information",
        technicalDetails: { source: SOURCE_TAG }
      }));
    },

    // oError: the raw rejection from an execute()/invoke()/submitBatch()
    // promise. sBasePath (optional): the canonical entity path (e.g.
    // oContext.getPath()) to qualify relative targets against, so the
    // message model's own target actually resolves to the bound control
    // (only meaningful once a real context exists — omit pre-bootstrap).
    // oBundle (optional): resource bundle for item/field-label attribution
    // text (Gap 3) - omit only when no view/bundle is available yet;
    // attribution is then skipped, text is still shown untouched, never
    // dropped. Returns the deduped list of section ids the messages
    // resolved to.
    extract: function (oError, sBasePath, oBundle) {
      var aSectionIds = [];
      var oBody = deepestErrorBody(oError);

      function addMessage(sRawText, sTarget, sCode, vNumericSeverity) {
        var sFullTarget = sTarget && sBasePath ? sBasePath + "/" + sTarget : undefined;
        if (isDuplicate(sFullTarget, sRawText, sCode)) {
          return;
        }
        var sDisplayText = withCode(attributeText(sRawText || "Unknown error", sTarget, oBundle), sCode);
        Messaging.addMessages(new Message({
          message: sDisplayText,
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
        // When details[] carries the real, specific message(s) (e.g. a single
        // item-level VI-028), oBody.message is just a generic wrapper (seen
        // live as literally "Save failed") that adds no information and only
        // shows as a redundant, unlabeled duplicate - add it only when there
        // is nothing more specific to show instead (never drop the only
        // message available).
        var aDetails = oBody.details || [];
        if (aDetails.length) {
          aDetails.forEach(function (oDetail) {
            addMessage(textOf(oDetail.message), oDetail.target, oDetail.code, oDetail["@Common.numericSeverity"]);
          });
        } else {
          var sTopText = textOf(oBody.message);
          if (!(isGenericWrapper(sTopText) && hasRealMessage())) {
            addMessage(sTopText, oBody.target, oBody.code, oBody["@Common.numericSeverity"]);
          }
        }
      } else {
        // No parsed OData error body (e.g. a network/batch-structural failure,
        // including an unhandled ABAP short dump) — still routed through
        // Messaging/popover, never silent, never a toast. Prefer the deepest
        // cause's message over the generic "$batch failed" wrapper text - but
        // skip it too if a real message already covers this same failure.
        var sDeepest = deepestMessage(oError);
        if (!(isGenericWrapper(sDeepest) && hasRealMessage())) {
          addMessage(sDeepest);
        }
      }

      removeDuplicateAutoMessages();
      return aSectionIds;
    }
  };

  return MessageExtractor;
});
