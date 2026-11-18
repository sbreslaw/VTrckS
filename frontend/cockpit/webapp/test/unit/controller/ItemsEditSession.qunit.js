/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/schema/OrdersSchema",
  "cdc/vaccreq/model/schema/ReturnsSchema",
  "sap/ui/model/json/JSONModel"
], function (ServiceSchema, OrdersSchema, ReturnsSchema, JSONModel) {
  "use strict";

  // GH-87: Returns Items edit opens an edit session before the section enters
  // edit; a completed new line is then posted into it instead of activating.
  var sPreviousProfile;

  QUnit.module("Items edit session wiring (GH-87)", {
    // Detail.controller's module graph reads the active profile when it loads
    // (FundLogicService), and QUnit may run this module first - select one.
    beforeEach: function () {
      sPreviousProfile = ServiceSchema.profileId;
      ServiceSchema.use(OrdersSchema);
    },
    afterEach: function () {
      ServiceSchema.use(sPreviousProfile === ReturnsSchema.profileId ? ReturnsSchema : OrdersSchema);
    }
  });

  function loadDetail() {
    return new Promise(function (resolve, reject) {
      sap.ui.require(["cdc/vaccreq/controller/Detail.controller"], resolve, reject);
    });
  }

  function stubController(Detail, mModels, oContext) {
    var oStub = Object.create(Detail.prototype);
    oStub.getView = function () {
      return {
        getBindingContext: function () { return oContext; },
        getModel: function (sName) { return mModels[sName]; }
      };
    };
    return oStub;
  }

  QUnit.test("Items Edit opens the session first on Returns, directly on Orders", function (assert) {
    var oContext = { getPath: function () { return "/x"; } };
    var mModels = { sectionFlags: new JSONModel({ items: { editing: false } }) };
    return loadDetail().then(function (Detail) {
      ServiceSchema.use(ReturnsSchema);
      var aStarted = [];
      var oReturns = stubController(Detail, mModels, oContext);
      oReturns._startSectionEdit = function (sId, oCtx) { aStarted.push(sId + ":" + (oCtx === oContext)); };
      oReturns._openItemsEditSession = function () { return Promise.resolve(false); };
      oReturns.onSectionEditPress("items");
      assert.deepEqual(aStarted, [], "returns: nothing until the session is open");
      return Promise.resolve().then(function () { return Promise.resolve(); }).then(function () {
        assert.deepEqual(aStarted, [], "returns: a refused open does not start the edit");
        oReturns._openItemsEditSession = function () { return Promise.resolve(true); };
        oReturns.onSectionEditPress("items");
        return new Promise(function (resolve) { setTimeout(resolve, 0); });
      }).then(function () {
        assert.deepEqual(aStarted, ["items:true"], "returns: edit starts once the session is open");

        ServiceSchema.use(OrdersSchema);
        var aOrdersStarted = [];
        var oOrders = stubController(Detail, mModels, oContext);
        oOrders._openItemsEditSession = function () { assert.ok(false, "orders: no session"); };
        oOrders._startSectionEdit = function (sId) { aOrdersStarted.push(sId); };
        oOrders.onSectionEditPress("items");
        assert.deepEqual(aOrdersStarted, ["items"], "orders: sessionless edit starts at once");
      });
    });
  });

  QUnit.test("a completed new line in an Items edit session is posted, not activated", function (assert) {
    return loadDetail().then(function (Detail) {
      ServiceSchema.use(ReturnsSchema);
      var oRow = { created: function () { return new Promise(function () {}); } };
      var aPosted = [];
      var iPrevented = 0;
      var oEvent = {
        getParameter: function () { return oRow; },
        preventDefault: function () { iPrevented += 1; }
      };
      var oStub = stubController(Detail, {}, null);
      oStub.getResourceBundle = function () { return {}; };
      oStub._isScratchRowComplete = function () { return true; };
      oStub._postInactiveSessionRow = function (oCtx) { aPosted.push(oCtx); };
      oStub._bItemsSessionBound = false;
      oStub._oItemsEditSession = { opened: true };
      oStub._onItemCreateActivate(oEvent);
      assert.strictEqual(iPrevented, 1, "activation prevented");
      assert.deepEqual(aPosted, [oRow], "posted into the session");

      oStub._oItemsEditSession = null;
      oStub._onItemCreateActivate(oEvent);
      assert.strictEqual(iPrevented, 1, "without a session the line activates as before");
      assert.strictEqual(aPosted.length, 1, "and is not posted");
    });
  });

  QUnit.test("an open Items edit session counts as unsaved changes", function (assert) {
    return loadDetail().then(function (Detail) {
      ServiceSchema.use(ReturnsSchema);
      var oContext = { getModel: function () { return { hasPendingChanges: function () { return false; } }; } };
      var oStub = stubController(Detail, {
        sectionFlags: new JSONModel({ createMode: false }),
        createEnrich: new JSONModel({ notes: "", notesOriginal: "" })
      }, oContext);
      oStub._oItemsEditSession = null;
      assert.strictEqual(oStub._hasUnsavedOrderChanges(), false, "no session, no change");
      oStub._oItemsEditSession = { opened: true };
      assert.strictEqual(oStub._hasUnsavedOrderChanges(), true, "open session");
    });
  });

  QUnit.test("a route change discards an open Items edit session first; the last route wins", function (assert) {
    return loadDetail().then(function (Detail) {
      var aBusy = [];
      var aShown = [];
      var fnDiscarded;
      var oStub = Object.create(Detail.prototype);
      oStub.getView = function () {
        return { setBusy: function (bBusy) { aBusy.push(bBusy); } };
      };
      oStub._discardItemsEditSession = function () {
        oStub._oItemsEditSession = null;
        return new Promise(function (resolve) { fnDiscarded = resolve; });
      };
      oStub._leaveItemsEditSession(function () { aShown.push("A"); });
      assert.deepEqual(aShown, ["A"], "no session: continues at once");

      oStub._oItemsEditSession = { opened: true };
      oStub._leaveItemsEditSession(function () { aShown.push("B"); });
      oStub._leaveItemsEditSession(function () { aShown.push("C"); });
      assert.deepEqual(aShown, ["A"], "waits for the discard");
      assert.deepEqual(aBusy, [true], "view busy meanwhile");
      fnDiscarded();
      return new Promise(function (resolve) { setTimeout(resolve, 0); }).then(function () {
        assert.deepEqual(aShown, ["A", "C"], "only the last route continues");
        assert.deepEqual(aBusy, [true, false], "busy cleared");
      });
    });
  });
});
