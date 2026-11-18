sap.ui.define([
  "sap/ui/core/Messaging",
  "cdc/vaccreq/model/MessageExtractor",
  "cdc/vaccreq/model/ServiceSchema"
], function (Messaging, MessageExtractor, ServiceSchema) {
  "use strict";

  // CRUD Task 2 v2 (Change Mode, design/Work Order 2 - CRUD Task 2 - Change
  // Mode.md v2): R_SalesOrderTP BDEF verified unmanaged/no-draft/late-numbering/
  // lock-master/etag-master-LastChangeTime; independently re-confirmed against
  // this bound service (Core.OptimisticConcurrency on LastChangeDateTime, no
  // IsActiveEntity key). v1's Edit/Activate/Discard + DraftAdministrativeData
  // choreography never shipped and is deleted on this evidence \u2014 gate item #1
  // is closed: edit is a plain PATCH against the active entity, concurrency is
  // ETag/412, this module is a thin wrapper around the update group only. See
  // NOTES.md "CRUD Task 2 v2" entry for the closing judgment line.
  var UPDATE_GROUP = "vrEdit";

  var EditRequestService = {
    UPDATE_GROUP: UPDATE_GROUP,

    // No server round trip on entering edit \u2014 this only snapshots current
    // values for potential inspection; the actual Cancel revert is done by
    // oModel.resetChanges(), which is authoritative for what's pending.
    beginEdit: function (oContext, sSectionId, aProperties) {
      var oSnapshot = { sectionId: sSectionId, values: {} };
      (aProperties || []).forEach(function (sPath) {
        oSnapshot.values[sPath] = oContext.getProperty(sPath);
      });
      return oSnapshot;
    },

    // Resolves once the batch completes; rejects with an Error carrying
    // isConflict=true when the failure looks like a 412 (stale ETag), else
    // isConflict=false for ordinary validation/business errors.
    save: function (oContext) {
      // Message Accuracy & Hygiene task, Gap 1 - pre-attempt clearing: a
      // stale extractor/technical message from a PRIOR failed save attempt
      // must never carry over and look like part of THIS attempt's result.
      MessageExtractor.clearStaleMessages();
      var oModel = oContext.getModel();
      return oModel.submitBatch(UPDATE_GROUP).then(function () {
        if (oModel.hasPendingChanges(UPDATE_GROUP)) {
          // submitBatch() resolves even when an individual change in the
          // batch was rejected (e.g. a 412 or a business-rule error) \u2014 a
          // change still pending afterwards is how that failure surfaces.
          var oError = new Error("Save failed: one or more changes were rejected");
          oError.isConflict = EditRequestService._hasConflictMessage();
          throw oError;
        }
      }, function (oError) {
        oError.isConflict = EditRequestService._isConflictError(oError);
        throw oError;
      });
    },

    cancel: function (oContext) {
      return oContext.getModel().resetChanges(UPDATE_GROUP);
    },

    // GH-87: Returns Items edit session (ServiceSchema.itemsEditAction ...
    // saveAction / discardAction, all in the immediate itemInteractiveGroup);
    // Details and the other sections stay sessionless. Resolves the session
    // object CreateOrderService.postItem accepts. If-Match:* - the Items rows
    // are re-read inside the session right after it opens.
    openSession: function (oHeaderContext) {
      var oModel = oHeaderContext.getModel();
      var sGroupId = ServiceSchema.itemInteractiveGroup;
      var oAction = oModel.bindContext(ServiceSchema.itemsEditAction + "(...)", oHeaderContext);
      return oAction.execute(sGroupId, true).then(function () {
        return {
          opened: true,
          plainContext: oModel.bindContext(oHeaderContext.getPath(), undefined, {
            $$updateGroupId: sGroupId
          }).getBoundContext()
        };
      }).finally(function () {
        oAction.destroy();
      });
    },

    saveSession: function (oHeaderContext) {
      var oAction = oHeaderContext.getModel().bindContext(ServiceSchema.saveAction + "(...)", oHeaderContext, {
        $select: "SAP__Messages"
      });
      return oAction.execute(ServiceSchema.itemInteractiveGroup, true).then(function () {
        oAction.destroy();
      }, function (oError) {
        oAction.destroy();
        oError.isConflict = EditRequestService._isConflictError(oError);
        throw oError;
      });
    },

    // Best effort, never rejects. resetChanges throws while a request of the
    // group is still running (e.g. a field's PATCH sent right before Cancel) -
    // DiscardChanges reverts the whole session server-side anyway.
    discardSession: function (oModel) {
      var sGroupId = ServiceSchema.itemInteractiveGroup;
      var oAction;
      return Promise.resolve().then(function () {
        try {
          if (oModel.hasPendingChanges(sGroupId)) {
            oModel.resetChanges(sGroupId);
          }
        } catch (oResetError) {
          // see above
        }
        oAction = oModel.bindContext(ServiceSchema.discardAction + "(...)");
        return oAction.execute(sGroupId);
      }).catch(function (oError) {
        console.error("EditRequestService: DiscardChanges failed", oError && oError.message, oError);
      }).then(function () {
        if (oAction) {
          oAction.destroy();
        }
      });
    },

    // GH-87: a failed in-session Items write that means the session is gone:
    // 404, or a 5xx (a dump ends the sticky session on this service).
    isSessionLostError: function (oError) {
      var oCurrent = oError;
      while (oCurrent) {
        var iStatus = Number(oCurrent.status);
        if (iStatus === 404 || iStatus >= 500) {
          return true;
        }
        oCurrent = oCurrent.cause;
      }
      return false;
    },

    _isConflictError: function (oError) {
      var iStatus = oError && (oError.status || (oError.cause && oError.cause.status));
      return iStatus === 412 || /412/.test((oError && oError.message) || "");
    },

    // TODO-VERIFY: sap.ui.core.message.Message#getTechnicalDetails().httpStatus
    // is the documented way to recover the raw HTTP status of a V4 technical
    // message; confirm against a live 412 response before relying on this.
    _hasConflictMessage: function () {
      return Messaging.getMessageModel().getData().some(function (oMessage) {
        var oDetails = oMessage.getTechnicalDetails && oMessage.getTechnicalDetails();
        return oDetails && oDetails.httpStatus === 412;
      });
    }
  };

  return EditRequestService;
});
