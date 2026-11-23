/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/schema/OrdersSchema",
  "cdc/vaccreq/model/schema/ReturnsSchema",
  "sap/ui/model/json/JSONModel"
], function (ServiceSchema, OrdersSchema, ReturnsSchema, JSONModel) {
  "use strict";

  // GH-98: Returns General edit changes the Contact Person (AP) inside an edit
  // session opened at Save, only when Contact changed.
  var sPreviousProfile;

  QUnit.module("Details Contact edit (GH-98)", {
    // Detail.controller's module graph reads the active profile when it loads
    // (FundLogicService), and QUnit may run this module first - select one.
    beforeEach: function () {
      sPreviousProfile = ServiceSchema.profileId;
      ServiceSchema.use(ReturnsSchema);
    },
    afterEach: function () {
      ServiceSchema.use(sPreviousProfile === OrdersSchema.profileId ? OrdersSchema : ReturnsSchema);
    }
  });

  function load() {
    return new Promise(function (resolve, reject) {
      sap.ui.require([
        "cdc/vaccreq/controller/Detail.controller",
        "cdc/vaccreq/service/EditRequestService",
        "cdc/vaccreq/service/CreateOrderService",
        "cdc/vaccreq/model/MessageExtractor"
      ], function (Detail, EditRequestService, CreateOrderService, MessageExtractor) {
        resolve({ Detail: Detail, ERS: EditRequestService, COS: CreateOrderService, ME: MessageExtractor });
      }, reject);
    });
  }

  function models(oOverrides) {
    var mModels = {
      sectionFlags: new JSONModel({ createMode: false, details: { editing: true } }),
      detailContact: new JSONModel({ name: "Old Person", tooltip: "", id: "100", exists: true, editable: true }),
      createEnrich: new JSONModel({ contactId: "", contactName: "", notes: "", notesOriginal: "" }),
      createState: new JSONModel({ providerChosen: false })
    };
    Object.keys(oOverrides || {}).forEach(function (sName) {
      mModels[sName] = oOverrides[sName];
    });
    return mModels;
  }

  function stubController(Detail, mModels, oContext) {
    var oStub = Object.create(Detail.prototype);
    var oView = {
      getBindingContext: function () { return oContext; },
      getModel: function (sName) { return mModels[sName]; },
      setBusy: function (bBusy) { oStub.aBusy.push(bBusy); }
    };
    oStub.aBusy = [];
    oStub.getView = function () { return oView; };
    oStub.getOwnerComponent = function () { return { getModel: function () { return oContext && oContext.getModel(); } }; };
    oStub.getResourceBundle = function () { return { getText: function (sKey) { return sKey; } }; };
    return oStub;
  }

  // HeaderPartner list read for _loadDetailContact: resolves the given rows.
  function partnerModel(aRows) {
    return {
      bindList: function () {
        return {
          requestContexts: function () {
            return Promise.resolve(aRows.map(function (oRow) {
              return { getObject: function () { return oRow; } };
            }));
          },
          destroy: function () {}
        };
      }
    };
  }

  function row(sContactPerson, sFullName) {
    var oRow = {};
    oRow[ReturnsSchema.headerPartnerProperties.contactPerson] = sContactPerson;
    oRow[ReturnsSchema.headerPartnerProperties.fullName] = sFullName;
    return oRow;
  }

  QUnit.test("schema flag: Returns edit Contact in General edit, Orders do not", function (assert) {
    assert.strictEqual(ReturnsSchema.contactEditableInEdit, true, "returns");
    assert.strictEqual(OrdersSchema.contactEditableInEdit, false, "orders");
  });

  QUnit.test("_loadDetailContact keeps id, row existence and editability", function (assert) {
    return load().then(function (m) {
      var mModels = models({ sectionFlags: new JSONModel({ createMode: false, details: { editing: false } }) });
      var oStub = stubController(m.Detail, mModels, null);
      var fnRun = function (aRows) {
        oStub.getOwnerComponent = function () { return { getModel: function () { return partnerModel(aRows); } }; };
        return oStub._loadDetailContact("1").then(function () {
          return mModels.detailContact.getData();
        });
      };
      return fnRun([row("20017", "Some Person")]).then(function (oData) {
        assert.deepEqual([oData.id, oData.name, oData.exists, oData.editable], ["20017", "Some Person", true, true], "row with a contact");
        return fnRun([row("0", "")]);
      }).then(function (oData) {
        assert.deepEqual([oData.id, oData.name, oData.exists, oData.editable], ["", "", true, true], "blank contact row stays editable (Q13)");
        return fnRun([]);
      }).then(function (oData) {
        assert.deepEqual([oData.exists, oData.editable], [false, false], "no row: read-only (Q2)");
        ServiceSchema.use(OrdersSchema);
        return fnRun([row("20017", "Some Person")]);
      }).then(function (oData) {
        assert.deepEqual([oData.exists, oData.editable], [true, false], "orders: never editable (Q3)");
      });
    });
  });

  QUnit.test("seed, change detection and restore", function (assert) {
    return load().then(function (m) {
      var mModels = models();
      var oStub = stubController(m.Detail, mModels, null);
      oStub._seedDetailsContact();
      assert.deepEqual([mModels.createEnrich.getProperty("/contactId"), mModels.createEnrich.getProperty("/contactName")],
        ["100", "Old Person"], "seeded from the loaded contact");
      assert.strictEqual(oStub._isDetailsContactChanged(), false, "unchanged after seeding");
      mModels.createEnrich.setProperty("/contactId", "200");
      assert.strictEqual(oStub._isDetailsContactChanged(), true, "a pick is a change");
      mModels.detailContact.setProperty("/editable", false);
      assert.strictEqual(oStub._isDetailsContactChanged(), false, "never a change when Contact is read-only");
      mModels.detailContact.setProperty("/editable", true);
      mModels.sectionFlags.setProperty("/details/editing", false);
      assert.strictEqual(oStub._isDetailsContactChanged(), false, "never a change outside General edit");
      mModels.sectionFlags.setProperty("/details/editing", true);
      oStub._restoreDetailsContact();
      assert.deepEqual([mModels.createEnrich.getProperty("/contactId"), mModels.createEnrich.getProperty("/contactName")],
        ["100", "Old Person"], "Cancel restores the seed");
    });
  });

  QUnit.test("a late contact read seeds an untouched field but never overwrites a pick", function (assert) {
    return load().then(function (m) {
      var mModels = models({ detailContact: new JSONModel({ name: "", tooltip: "", id: "", exists: false, editable: false }) });
      var oStub = stubController(m.Detail, mModels, null);
      oStub._seedDetailsContact();
      oStub.getOwnerComponent = function () { return { getModel: function () { return partnerModel([row("20017", "Some Person")]); } }; };
      return oStub._loadDetailContact("1").then(function () {
        assert.strictEqual(mModels.createEnrich.getProperty("/contactId"), "20017", "untouched field follows the read");
        mModels.createEnrich.setProperty("/contactId", "20061");
        return oStub._loadDetailContact("1");
      }).then(function () {
        assert.strictEqual(mModels.createEnrich.getProperty("/contactId"), "20061", "the pick stays");
      });
    });
  });

  QUnit.test("an open Items session or a changed Contact counts as unsaved", function (assert) {
    return load().then(function (m) {
      var oContext = { getModel: function () { return { hasPendingChanges: function () { return false; } }; } };
      var mModels = models();
      var oStub = stubController(m.Detail, mModels, oContext);
      oStub._seedDetailsContact();
      assert.strictEqual(oStub._hasUnsavedOrderChanges(), false, "nothing changed");
      mModels.createEnrich.setProperty("/contactId", "200");
      assert.strictEqual(oStub._hasUnsavedOrderChanges(), true, "picked contact (Q11)");
    });
  });

  // Save: a stub controller runs the real onSectionSavePress with stubbed
  // services; each test records the service calls in order.
  function saveHarness(m, mOptions) {
    var aCalls = [];
    var oModel = {
      hasPendingChanges: function () { return !!mOptions.pendingAuto; },
      resetChanges: function (sGroup) { aCalls.push("reset:" + sGroup); }
    };
    var oContext = {
      getModel: function () { return oModel; },
      getPath: function () { return "/R('1')"; },
      getProperty: function (sPath) { return sPath === ReturnsSchema.keys.orderId ? "1" : undefined; }
    };
    var mModels = models();
    var oStub = stubController(m.Detail, mModels, oContext);
    oStub._seedDetailsContact();
    if (mOptions.changeContact) {
      mModels.createEnrich.setProperty("/contactId", "200");
      mModels.createEnrich.setProperty("/contactName", "New Person");
    }
    oStub.byId = function () { return { setEnabled: function () {} }; };
    oStub._byIdInSection = function () { return null; };
    oStub._stageHeaderNotes = function () { return Promise.resolve(); };
    oStub._openMessagePopover = function () { aCalls.push("popover"); };
    oStub._oSectionFactory = { expandSection: function () {} };
    oStub._getSectionTitle = function () { return ""; };
    oStub._endEditSession = function () { aCalls.push("end"); };
    oStub._showConflictDialog = function () { aCalls.push("conflict"); };
    oStub._reloadHeaderContext = function () { aCalls.push("reload"); return Promise.resolve(); };
    oStub._loadDetailContact = function () { aCalls.push("loadContact"); return Promise.resolve(); };
    var mOriginals = {
      openSession: m.ERS.openSession, save: m.ERS.save, saveSession: m.ERS.saveSession, discardSession: m.ERS.discardSession,
      patch: m.COS._patchSessionContact, extract: m.ME.extract, addNote: m.ME.addNote
    };
    m.ERS.openSession = function () {
      aCalls.push("open");
      return mOptions.openError ? Promise.reject(mOptions.openError)
        : Promise.resolve({ plainContext: { getBinding: function () { return { destroy: function () { aCalls.push("destroyPlain"); } }; } } });
    };
    m.COS._patchSessionContact = function (oM, oOptions, sOrderId) {
      aCalls.push("patch:" + oOptions.contactId + "@" + sOrderId);
      return mOptions.patchError ? Promise.reject(mOptions.patchError) : Promise.resolve();
    };
    m.ERS.save = function () { aCalls.push("save"); return Promise.resolve(); };
    m.ERS.saveSession = function () { aCalls.push("saveSession"); return mOptions.saveSessionError ? Promise.reject(mOptions.saveSessionError) : Promise.resolve(); };
    m.ERS.discardSession = function () { aCalls.push("discard"); return Promise.resolve(); };
    m.ME.extract = function () { aCalls.push("extract"); return []; };
    m.ME.addNote = function (sText) { aCalls.push("note:" + sText); };
    var fnRestore = function () {
      m.ERS.openSession = mOriginals.openSession; m.ERS.save = mOriginals.save; m.ERS.saveSession = mOriginals.saveSession;
      m.ERS.discardSession = mOriginals.discardSession; m.COS._patchSessionContact = mOriginals.patch;
      m.ME.extract = mOriginals.extract; m.ME.addNote = mOriginals.addNote;
    };
    return { stub: oStub, calls: aCalls, restore: fnRestore, models: mModels };
  }

  function runSave(m, mOptions) {
    var oHarness = saveHarness(m, mOptions);
    return new Promise(function (resolve) {
      oHarness.stub.onSectionSavePress("details");
      setTimeout(resolve, 50);
    }).then(function () {
      oHarness.restore();
      return oHarness;
    }, function (oError) {
      oHarness.restore();
      throw oError;
    });
  }

  QUnit.test("Save without a Contact change sends today's requests only", function (assert) {
    return load().then(function (m) {
      return runSave(m, {}).then(function (h) {
        assert.strictEqual(h.calls.indexOf("open"), -1, "no session");
        assert.strictEqual(h.calls.filter(function (s) { return s === "save"; }).length, 1, "vrEdit submitted once");
        assert.notStrictEqual(h.calls.indexOf("end"), -1, "edit ends");
      });
    });
  });

  QUnit.test("Save with a Contact change: session, Contact first, then header, then SaveChanges (Q7)", function (assert) {
    return load().then(function (m) {
      return runSave(m, { changeContact: true }).then(function (h) {
        assert.deepEqual(h.calls.slice(0, 5), ["open", "destroyPlain", "patch:200@1", "save", "saveSession"], "order");
        assert.strictEqual(h.calls.indexOf("discard"), -1, "nothing discarded");
        assert.notStrictEqual(h.calls.indexOf("reload"), -1, "header and Contact reloaded");
        assert.notStrictEqual(h.calls.indexOf("end"), -1, "edit ends");
        assert.deepEqual(h.stub.aBusy, [true, false], "view busy during the session");
      });
    });
  });

  QUnit.test("refused session (lock): nothing else sent, reported message not extracted again (Q14, Q18)", function (assert) {
    return load().then(function (m) {
      var oError = new Error("locked");
      oError.status = 423;
      oError.$reported = true;
      return runSave(m, { changeContact: true, openError: oError }).then(function (h) {
        assert.deepEqual(h.calls, ["open", "popover"], "no patch, no save, no discard, no extract");
        assert.strictEqual(h.calls.indexOf("end"), -1, "General stays in edit");
      });
    });
  });

  QUnit.test("failed Contact write: in-session writes discarded, no re-send, General stays in edit (Q5, Q20)", function (assert) {
    return load().then(function (m) {
      return runSave(m, { changeContact: true, patchError: new Error("rejected"), pendingAuto: true }).then(function (h) {
        assert.strictEqual(h.calls.indexOf("saveSession"), -1, "no SaveChanges");
        assert.strictEqual(h.calls.indexOf("save"), -1, "header changes stay pending");
        var iDiscard = h.calls.indexOf("discard");
        assert.ok(iDiscard > 0, "discarded");
        assert.strictEqual(h.calls[iDiscard - 1], "reset:" + ReturnsSchema.itemInteractiveGroup, "immediate group reset before the discard");
        assert.strictEqual(h.calls[iDiscard + 1], "reset:" + ReturnsSchema.itemInteractiveGroup, "and after it");
        assert.notStrictEqual(h.calls.indexOf("extract"), -1, "backend message shown");
        assert.strictEqual(h.calls.indexOf("reload"), -1, "no reload: nothing was accepted client-side");
        assert.strictEqual(h.calls.indexOf("end"), -1, "General stays in edit");
        assert.strictEqual(h.models.createEnrich.getProperty("/contactId"), "200", "pick kept for a retry");
      });
    });
  });

  QUnit.test("failed SaveChanges: discard, reload, note, pick kept (Q8, Q18)", function (assert) {
    return load().then(function (m) {
      var oError = new Error("save failed");
      oError.$reported = true;
      return runSave(m, { changeContact: true, saveSessionError: oError }).then(function (h) {
        var iDiscard = h.calls.indexOf("discard");
        assert.ok(iDiscard > h.calls.indexOf("saveSession"), "discarded after the failed SaveChanges");
        assert.ok(h.calls.indexOf("reload") > iDiscard, "header reloaded after the discard");
        assert.notStrictEqual(h.calls.indexOf("note:detailsSessionSaveDiscarded"), -1, "nothing-saved note");
        assert.strictEqual(h.calls.indexOf("extract"), -1, "reported action error not extracted again");
        assert.notStrictEqual(h.calls.indexOf("popover"), -1, "popover opened");
        assert.strictEqual(h.calls.indexOf("end"), -1, "General stays in edit");
        assert.strictEqual(h.models.createEnrich.getProperty("/contactId"), "200", "pick kept for a retry");
      });
    });
  });

  QUnit.test("_patchSessionContact addresses the return's row in edit and the session row in create", function (assert) {
    return load().then(function (m) {
      var aPaths = [];
      var oModel = {
        bindContext: function (sPath) {
          aPaths.push(sPath);
          var oContext = {
            requestProperty: function () { return Promise.resolve("0"); },
            setProperty: function () { return Promise.resolve(); }
          };
          return { getBoundContext: function () { return oContext; }, destroy: function () {} };
        }
      };
      return m.COS._patchSessionContact(oModel, { contactId: "200" }, "1").then(function () {
        return m.COS._patchSessionContact(oModel, { contactId: "200" });
      }).then(function () {
        assert.deepEqual(aPaths, [
          "/HeaderPartner(CustomerReturn='1',PartnerFunction='AP')",
          "/HeaderPartner(CustomerReturn='',PartnerFunction='AP')"
        ]);
      });
    });
  });

  QUnit.test("both Details fragments show the Contact input in General edit only when editable", function (assert) {
    return Promise.all(["cdc/vaccreq/sections/Details.fragment.xml", "cdc/vaccreq/sections/returns/Details.fragment.xml"].map(function (sPath) {
      return fetch(sap.ui.require.toUrl(sPath)).then(function (oResponse) { return oResponse.text(); }).then(function (sXml) {
        var oDoc = new DOMParser().parseFromString(sXml, "application/xml");
        var oInput = Array.prototype.filter.call(oDoc.getElementsByTagNameNS("*", "Input"), function (oNode) {
          return oNode.getAttribute("id") === "contactInput";
        })[0];
        var oText = Array.prototype.filter.call(oInput.parentNode.children, function (oNode) {
          return oNode.localName === "Text";
        })[0];
        return { path: sPath, input: oInput, text: oText };
      });
    })).then(function (aFragments) {
      aFragments.forEach(function (o) {
        var sVisible = o.input.getAttribute("visible");
        assert.notStrictEqual(sVisible.indexOf("detailContact>/editable"), -1, o.path + ": input visible reads detailContact>/editable");
        assert.notStrictEqual(sVisible.indexOf("sectionFlags>/details/editing"), -1, o.path + ": input visible reads General edit");
        assert.notStrictEqual(o.input.getAttribute("enabled").indexOf("sectionFlags>/createMode"), -1, o.path + ": providerChosen gates create only");
        assert.notStrictEqual(o.text.getAttribute("visible").indexOf("detailContact>/editable"), -1, o.path + ": Text hides when the input shows");
      });
      assert.strictEqual(aFragments[0].input.getAttribute("visible"), aFragments[1].input.getAttribute("visible"), "identical in both fragments (Q9)");
      assert.strictEqual(aFragments[0].text.getAttribute("visible"), aFragments[1].text.getAttribute("visible"), "identical Text visibility");
    });
  });
});
