/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/schema/OrdersSchema",
  "cdc/vaccreq/model/schema/ReturnsSchema",
  "cdc/vaccreq/service/EditRequestService"
], function (ServiceSchema, OrdersSchema, ReturnsSchema, EditRequestService) {
  "use strict";

  // GH-87: Returns Items edit runs in an edit session (PrepareForEdit ...
  // SaveChanges / DiscardChanges, all in the immediate group).
  var sPreviousProfile;
  var HEADER_PATH = "/CustomerReturnManage(CustomerReturn='1')";
  var SESSION_GROUP = "vrItemsSession";

  QUnit.module("EditRequestService - Items edit session (GH-87)", {
    beforeEach: function () {
      sPreviousProfile = ServiceSchema.profileId;
      ServiceSchema.use(ReturnsSchema);
    },
    afterEach: function () {
      ServiceSchema.use(sPreviousProfile === OrdersSchema.profileId ? OrdersSchema : ReturnsSchema);
    }
  });

  // Records every bindContext/execute; mOptions: executeError, pending, resetThrows, submitError.
  function stubModel(mOptions) {
    var oLog = { bound: [], reset: [], destroyed: 0, sequence: [] };
    var oModel = {
      log: oLog,
      bindContext: function (sPath, oContext, mParameters) {
        var oEntry = { path: sPath, context: oContext, parameters: mParameters };
        oLog.bound.push(oEntry);
        var oBinding = {
          execute: function (sGroupId, bIgnoreETag) {
            oEntry.group = sGroupId;
            oEntry.ignoreETag = bIgnoreETag;
            oLog.sequence.push("execute " + sPath);
            return mOptions.executeError ? Promise.reject(mOptions.executeError) : Promise.resolve();
          },
          getBoundContext: function () {
            return { path: sPath, getBinding: function () { return oBinding; } };
          },
          destroy: function () {
            oLog.destroyed += 1;
          }
        };
        return oBinding;
      },
      submitBatch: function (sGroupId) {
        oLog.sequence.push("submitBatch " + sGroupId);
        return mOptions.submitError ? Promise.reject(mOptions.submitError) : Promise.resolve();
      },
      hasPendingChanges: function () {
        return !!mOptions.pending;
      },
      resetChanges: function (sGroupId) {
        oLog.reset.push(sGroupId);
        oLog.sequence.push("resetChanges " + sGroupId);
        if (mOptions.resetThrows) {
          throw new Error("change requests are running");
        }
      }
    };
    return oModel;
  }

  function headerContext(oModel) {
    return {
      getModel: function () { return oModel; },
      getPath: function () { return HEADER_PATH; }
    };
  }

  QUnit.test("openSession: PrepareForEdit on the order, If-Match *, alone in its batch", function (assert) {
    var oModel = stubModel({});
    var oHeader = headerContext(oModel);
    return EditRequestService.openSession(oHeader).then(function (oSession) {
      var oAction = oModel.log.bound[0];
      assert.strictEqual(oAction.path, ReturnsSchema.itemsEditAction + "(...)", "bound edit action");
      assert.strictEqual(oAction.context, oHeader, "bound to the order");
      assert.deepEqual(oModel.log.sequence, ["execute " + oAction.path, "submitBatch " + SESSION_GROUP], "own deferred group, submitted");
      assert.strictEqual(oAction.ignoreETag, true, "If-Match *");
      assert.strictEqual(oSession.opened, true, "session object postItem accepts");
      assert.strictEqual(oSession.plainContext.path, HEADER_PATH, "plain context on the order");
      assert.strictEqual(oModel.log.bound[1].parameters.$$updateGroupId, "$auto", "session writes in the immediate group");
      assert.strictEqual(oModel.log.destroyed, 1, "action binding destroyed");
    });
  });

  QUnit.test("openSession: a refused open rejects with the backend error", function (assert) {
    var oError = new Error("Sales document is currently being processed");
    oError.status = 423;
    var oModel = stubModel({ executeError: oError });
    return EditRequestService.openSession(headerContext(oModel)).then(function () {
      assert.ok(false, "must reject");
    }, function (oRejected) {
      assert.strictEqual(oRejected, oError, "same error");
      assert.strictEqual(oModel.log.destroyed, 1, "action binding destroyed");
    });
  });

  QUnit.test("saveSession: queued writes first, then SaveChanges alone; a 412 is a conflict", function (assert) {
    var oModel = stubModel({});
    return EditRequestService.saveSession(headerContext(oModel)).then(function () {
      var oAction = oModel.log.bound[0];
      assert.strictEqual(oAction.path, ReturnsSchema.saveAction + "(...)", "bound save action");
      assert.strictEqual(oAction.parameters.$select, "SAP__Messages", "messages selected");
      assert.deepEqual(oModel.log.sequence, ["submitBatch $auto", "execute " + oAction.path, "submitBatch " + SESSION_GROUP],
        "writes flushed, then the save in its own batch");
      assert.strictEqual(oAction.ignoreETag, true, "If-Match *");
      var oConflict = new Error("Precondition failed");
      oConflict.status = 412;
      return EditRequestService.saveSession(headerContext(stubModel({ executeError: oConflict })));
    }).then(function () {
      assert.ok(false, "must reject");
    }, function (oError) {
      assert.strictEqual(oError.isConflict, true, "412 flagged as conflict");
    });
  });

  QUnit.test("saveSession: a write still rejected after the flush fails the save", function (assert) {
    var oModel = stubModel({ pending: true });
    return EditRequestService.saveSession(headerContext(oModel)).then(function () {
      assert.ok(false, "must reject");
    }, function (oError) {
      assert.strictEqual(oError.isConflict, false, "not a conflict");
      assert.strictEqual(oModel.log.bound.length, 0, "SaveChanges not sent");
    });
  });

  QUnit.test("discardSession: queued writes first, then unbound DiscardChanges alone; never rejects", function (assert) {
    var fnConsoleError = console.error;
    var aLogged = [];
    console.error = function () { aLogged.push(arguments[0]); };
    var oModel = stubModel({ pending: true });
    var oFailing = stubModel({ pending: true, resetThrows: true, submitError: new Error("batch"), executeError: new Error("no session") });
    return EditRequestService.discardSession(oModel).then(function () {
      var oAction = oModel.log.bound[0];
      assert.deepEqual(oModel.log.sequence, ["submitBatch $auto", "resetChanges $auto", "execute " + ReturnsSchema.discardAction + "(...)",
        "submitBatch " + SESSION_GROUP], "writes flushed, leftovers reset, then the discard in its own batch");
      assert.strictEqual(oAction.path, ReturnsSchema.discardAction + "(...)", "unbound discard action");
      assert.strictEqual(oAction.context, undefined, "not bound to a context");
      return EditRequestService.discardSession(oFailing);
    }).then(function () {
      assert.strictEqual(oFailing.log.bound.length, 1, "discard still sent when the flush fails and resetChanges throws");
      assert.strictEqual(aLogged.length, 1, "a failed discard is logged, not thrown");
      assert.strictEqual(oFailing.log.destroyed, 1, "action binding destroyed");
    }).finally(function () {
      console.error = fnConsoleError;
    });
  });

  QUnit.test("isSessionLostError: 404 and 5xx (also as cause), not business errors", function (assert) {
    function error(iStatus, oCause) {
      var oError = new Error("x");
      oError.status = iStatus;
      oError.cause = oCause;
      return oError;
    }
    assert.strictEqual(EditRequestService.isSessionLostError(error(404)), true, "404");
    assert.strictEqual(EditRequestService.isSessionLostError(error(500)), true, "500");
    assert.strictEqual(EditRequestService.isSessionLostError(error(undefined, error(503))), true, "5xx cause");
    assert.strictEqual(EditRequestService.isSessionLostError(error(400)), false, "400");
    assert.strictEqual(EditRequestService.isSessionLostError(error(412)), false, "412");
    assert.strictEqual(EditRequestService.isSessionLostError(undefined), false, "no error");
  });
});
