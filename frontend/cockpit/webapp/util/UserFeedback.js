sap.ui.define([
  "sap/ui/core/InvisibleMessage",
  "sap/ui/core/library"
], function (InvisibleMessage, coreLibrary) {
  "use strict";

  // Accessibility remediation (2026-11-06 review, package C): sap.m.MessageToast
  // already renders role="alert" (auto-announced to screen readers) - the real
  // problem with using it for backend/validation ERRORS is persistence, not
  // silence: it auto-dismisses after ~3s with no after-the-fact record, and it
  // bypasses sap.ui.core.Messaging's structured popover/badge/target-section
  // system the rest of the app already relies on (MessageExtractor.js). This
  // module is the shared replacement for every view that already has that
  // Messaging/MessagePopover plumbing wired up (Detail/ItemDetail) - it does
  // NOT build new popover UI for a view that doesn't have one.
  var InvisibleMessageMode = coreLibrary.InvisibleMessageMode;

  return {
    // oMessageExtractor: the cdc/vaccreq/model/MessageExtractor module (DI'd
    // in, not required here, so this stays a thin, dependency-free helper).
    // sText: the already-resolved (getText'd) message. fnOpenPopover:
    // optional, opens/focuses the caller's own MessagePopover instance.
    reportError: function (oMessageExtractor, sText, fnOpenPopover) {
      oMessageExtractor.addNote(sText, "Error");
      if (fnOpenPopover) {
        fnOpenPopover();
      }
      InvisibleMessage.getInstance().announce(sText, InvisibleMessageMode.Assertive);
    },

    // For non-error, non-toast status updates that previously had no
    // screen-reader-facing equivalent at all (search complete, paste summary,
    // section edit start/save/cancel, IoH load) - polite by default so it
    // never interrupts whatever the user is doing.
    announce: function (sText, bAssertive) {
      InvisibleMessage.getInstance().announce(sText,
        bAssertive ? InvisibleMessageMode.Assertive : InvisibleMessageMode.Polite);
    }
  };
});
