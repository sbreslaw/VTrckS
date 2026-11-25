/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/schema/OrdersSchema",
  "cdc/vaccreq/model/schema/ReturnsSchema",
  "cdc/vaccreq/service/CreateOrderService"
], function (ServiceSchema, OrdersSchema, ReturnsSchema, CreateOrderService) {
  "use strict";

  // GH-111: Returns write the header fields into the open create session before
  // SaveChanges; Provider Orders keep the PATCH on the new number after it.
  // CreateOrderService copies its group IDs when the module loads, before any
  // test calls ServiceSchema.use(), so they are undefined here: these tests
  // assert the order of calls and which calls share a group, never group names.
  var NEW_ID = "619000999";
  var sPreviousProfile;

  QUnit.module("CreateOrderService - create save (GH-111)", {
    beforeEach: function () {
      sPreviousProfile = ServiceSchema.profileId;
      ServiceSchema.use(ReturnsSchema);
      this.fnConsoleError = console.error;
      this.aConsoleErrors = [];
      console.error = function (sText) {
        this.aConsoleErrors.push(String(sText));
      }.bind(this);
    },
    afterEach: function () {
      console.error = this.fnConsoleError;
      ServiceSchema.use(sPreviousProfile === OrdersSchema.profileId ? OrdersSchema : ReturnsSchema);
    }
  });

  // Records every model call in one ordered log. mOptions.outcome(sKind, oInfo)
  // may return a promise (resolved, rejected or held) for "set" (setProperty),
  // "execute", "created" and "submit" (submitBatch); default: resolved.
  function stubModel(mOptions) {
    mOptions = mOptions || {};
    var aLog = [];
    var oModel;

    function outcome(sKind, oInfo) {
      return (mOptions.outcome && mOptions.outcome(sKind, oInfo)) || Promise.resolve();
    }

    function context(sPath, oBinding, oData) {
      return {
        getPath: function () { return sPath; },
        getModel: function () { return oModel; },
        getObject: function () { return oData || {}; },
        getProperty: function (sProperty) {
          if (oBinding && oBinding.isSave && sProperty === ServiceSchema.keys.orderId) {
            return NEW_ID;
          }
          return oData ? oData[sProperty] : undefined;
        },
        requestProperty: function (sProperty) {
          aLog.push({ type: "request", path: sPath, prop: sProperty });
          return Promise.resolve("0");
        },
        setProperty: function (sProperty, vValue) {
          var oEntry = { type: "set", path: sPath, prop: sProperty, value: vValue };
          aLog.push(oEntry);
          return outcome("set", oEntry);
        },
        created: function () {
          aLog.push({ type: "created", path: sPath });
          return outcome("created", { path: sPath });
        },
        delete: function () {
          return Promise.resolve();
        }
      };
    }

    oModel = {
      log: aLog,
      // A session context the test hands in, without a logged bindContext.
      contextFor: function (sPath) {
        return context(sPath);
      },
      bindContext: function (sPath, oContext, mParameters) {
        aLog.push({ type: "bindContext", path: sPath, context: oContext && oContext.getPath(), params: mParameters || {} });
        var oBoundContext;
        var oBinding = {
          isSave: /SaveChanges\(\.\.\.\)$/.test(sPath),
          setParameter: function (sName, vValue) {
            aLog.push({ type: "param", path: sPath, name: sName, value: vValue });
          },
          execute: function (sGroupId, bIgnoreETag) {
            var oEntry = { type: "execute", path: sPath, group: sGroupId, ignoreETag: bIgnoreETag };
            aLog.push(oEntry);
            return outcome("execute", oEntry);
          },
          getBoundContext: function () {
            return oBoundContext;
          },
          destroy: function () {
            aLog.push({ type: "destroy", path: sPath });
          }
        };
        oBoundContext = context(sPath, oBinding);
        return oBinding;
      },
      bindList: function (sPath, oContext, aSorters, aFilters, mParameters) {
        aLog.push({ type: "bindList", path: sPath, context: oContext && oContext.getPath(), params: mParameters || {} });
        var iCreated = 0;
        return {
          getHeaderContext: function () {
            return context(sPath + "/$header");
          },
          create: function (oData) {
            iCreated += 1;
            var sItemPath = (oContext ? oContext.getPath() + "/" : "") + sPath + "(" + iCreated + ")";
            aLog.push({ type: "create", path: sItemPath, body: JSON.parse(JSON.stringify(oData || {})) });
            return context(sItemPath, null, oData);
          }
        };
      },
      submitBatch: function (sGroupId) {
        var oEntry = { type: "submit", group: sGroupId };
        aLog.push(oEntry);
        return outcome("submit", oEntry);
      },
      hasPendingChanges: function () {
        return false;
      },
      resetChanges: function (sGroupId) {
        aLog.push({ type: "reset", group: sGroupId });
      }
    };
    return oModel;
  }

  function scratch(oModel, oData) {
    return {
      getModel: function () { return oModel; },
      getObject: function () { return oData; },
      getPath: function () { return "/scratch($uid=1)"; },
      delete: function () { return Promise.resolve(); }
    };
  }

  function openSession(oModel) {
    return { opened: true, plainContext: oModel.contextFor(ServiceSchema.buildHeaderPath("")), pending: null };
  }

  function itemsBinding(aRows) {
    return {
      getAllCurrentContexts: function () {
        return aRows.map(function (oRow, iIndex) {
          return {
            getIndex: function () { return iIndex; },
            getProperty: function (sProperty) { return oRow[sProperty]; },
            getObject: function () { return oRow; }
          };
        });
      }
    };
  }

  // "" / null / undefined are never written; "0" is (Q11).
  function returnsScratch() {
    return {
      CustomerReturnType: "ZKR",
      SoldToParty: "40029638",
      SalesOrganization: "1000",
      DistributionChannel: "10",
      OrganizationDivision: "10",
      SDDocumentReason: "G84",
      PurchaseOrderByCustomer: "EXIS1",
      ShippingCondition: "01",
      ZZ1_Description_SDH: "Desc",
      CustomerPurchaseOrderType: "UI",
      ZZ1_VaccineReturnType_SDH: "",
      CustomerPurchaseOrderDate: null,
      ZZ1_NoofBoxes_SDH: "0"
    };
  }

  var RETURNS_HEADER_WRITES = [
    "SDDocumentReason=G84",
    "PurchaseOrderByCustomer=EXIS1",
    "ShippingCondition=01",
    "ZZ1_Description_SDH=Desc",
    "CustomerPurchaseOrderType=UI",
    "ZZ1_NoofBoxes_SDH=0"
  ];

  function find(aLog, fnMatch, iFrom) {
    for (var i = iFrom || 0; i < aLog.length; i++) {
      if (fnMatch(aLog[i])) {
        return i;
      }
    }
    return -1;
  }

  function findLast(aLog, fnMatch) {
    for (var i = aLog.length - 1; i >= 0; i--) {
      if (fnMatch(aLog[i])) {
        return i;
      }
    }
    return -1;
  }

  function isSaveBind(oEntry) {
    return oEntry.type === "bindContext" && /SaveChanges\(\.\.\.\)$/.test(oEntry.path);
  }

  function isBind(sPath) {
    return function (oEntry) {
      return oEntry.type === "bindContext" && oEntry.path === sPath;
    };
  }

  function nextTicks() {
    return new Promise(function (resolve) {
      setTimeout(resolve, 0);
    });
  }

  QUnit.test("profiles: Returns write the header in the create session, Provider Orders do not", function (assert) {
    assert.strictEqual(ReturnsSchema.createHeaderInSession, true, "returns");
    assert.strictEqual(OrdersSchema.createHeaderInSession, false, "orders");
  });

  QUnit.test("Returns: Contact, then the header fields in the session, then SaveChanges alone; nothing after it", function (assert) {
    var oModel = stubModel();
    var sHeader = ReturnsSchema.buildHeaderPath("");
    return CreateOrderService.save(scratch(oModel, returnsScratch()), null, openSession(oModel), { contactId: "20185" }).then(function (oResult) {
      var aLog = oModel.log;
      var iContact = find(aLog, function (e) { return e.type === "set" && e.prop === "ContactPerson"; });
      var iHeaderBind = find(aLog, isBind(sHeader));
      var iSaveBind = find(aLog, isSaveBind);
      assert.ok(iContact > -1 && iContact < iHeaderBind && iHeaderBind < iSaveBind, "Contact -> header -> SaveChanges");
      assert.strictEqual(aLog.slice(0, iHeaderBind).filter(function (e) { return e.type === "submit"; }).length, 0, "the Contact step submits nothing");
      var oHeaderBind = aLog[iHeaderBind];
      assert.notOk("$select" in oHeaderBind.params, "the header binding is never read");
      var aHeaderSets = aLog.slice(iHeaderBind, iSaveBind).filter(function (e) { return e.type === "set"; });
      assert.deepEqual(aHeaderSets.map(function (e) { return e.prop + "=" + e.value; }), RETURNS_HEADER_WRITES, "non-empty values only, \"0\" kept");
      assert.ok(aHeaderSets.every(function (e) { return e.path === sHeader; }), "written on the session header ''");
      var aSubmits = aLog.slice(iHeaderBind, iSaveBind).filter(function (e) { return e.type === "submit"; });
      assert.strictEqual(aSubmits.length, 1, "one submit for the header write");
      assert.strictEqual(aSubmits[0].group, oHeaderBind.params.$$updateGroupId, "submitted in the header binding's group");
      assert.ok(find(aLog, function (e) { return e.type === "destroy" && e.path === sHeader; }, iHeaderBind) < iSaveBind, "header binding destroyed before SaveChanges");
      assert.strictEqual(aLog[iSaveBind].context, sHeader, "SaveChanges on the session context");
      assert.strictEqual(aLog[iSaveBind].params.$$updateGroupId, oHeaderBind.params.$$updateGroupId, "SaveChanges in the same group");
      var iExecute = find(aLog, function (e) { return e.type === "execute"; }, iSaveBind);
      assert.strictEqual(aLog[iExecute].ignoreETag, true, "If-Match *");
      var iSaveSubmit = find(aLog, function (e) { return e.type === "submit"; }, iExecute);
      assert.ok(iSaveSubmit > iExecute, "SaveChanges submitted");
      var aAfter = aLog.slice(iSaveSubmit + 1);
      assert.strictEqual(aAfter.filter(function (e) { return e.type === "set"; }).length, 0, "no write on the new number");
      assert.strictEqual(aAfter.filter(function (e) { return e.type === "submit"; }).length, 0, "no request after SaveChanges");
      assert.strictEqual(oResult.orderId, NEW_ID, "new number");
    });
  });

  QUnit.test("Returns: SaveChanges is not bound before the header write has settled", function (assert) {
    var fnRelease;
    var oHold = new Promise(function (resolve) { fnRelease = resolve; });
    var oModel = stubModel({
      outcome: function (sKind, oInfo) {
        return sKind === "set" && oInfo.prop === "SDDocumentReason" ? oHold : undefined;
      }
    });
    var pSave = CreateOrderService.save(scratch(oModel, returnsScratch()), null, openSession(oModel), {});
    return nextTicks().then(function () {
      assert.ok(find(oModel.log, isBind(ReturnsSchema.buildHeaderPath(""))) > -1, "header write started");
      assert.strictEqual(find(oModel.log, isSaveBind), -1, "SaveChanges not bound while a header write is pending");
      fnRelease();
      return pSave;
    }).then(function () {
      assert.ok(find(oModel.log, isSaveBind) > -1, "SaveChanges bound after the write settled");
    });
  });

  QUnit.test("Returns: a picked ship-to address is the only write after SaveChanges", function (assert) {
    var oModel = stubModel();
    return CreateOrderService.save(scratch(oModel, returnsScratch()), null, openSession(oModel), { shipToAddressId: "ADR1" }).then(function () {
      var aLog = oModel.log;
      var iSaveSubmit = find(aLog, function (e) { return e.type === "submit"; }, find(aLog, isSaveBind));
      var aAfter = aLog.slice(iSaveSubmit + 1);
      assert.deepEqual(aAfter.filter(function (e) { return e.type === "set"; }).map(function (e) { return e.path + " " + e.prop + "=" + e.value; }),
        [ReturnsSchema.buildHeaderPath(NEW_ID) + " " + ReturnsSchema.navigation.headerToShipToParty + "/" + ReturnsSchema.shipToPartyProperties.addressId + "=ADR1"],
        "ship-to only");
      assert.strictEqual(aAfter.filter(function (e) { return e.type === "submit"; }).length, 1, "one submit");
    });
  });

  QUnit.test("Returns: a refused header write discards the session and never sends SaveChanges", function (assert) {
    var oError = new Error("refused");
    var oModel = stubModel({
      outcome: function (sKind, oInfo) {
        return sKind === "set" && oInfo.prop === "PurchaseOrderByCustomer" ? Promise.reject(oError) : undefined;
      }
    });
    var oSession = openSession(oModel);
    var aConsoleErrors = this.aConsoleErrors;
    return CreateOrderService.save(scratch(oModel, returnsScratch()), null, oSession, {}).then(function () {
      assert.ok(false, "must reject");
    }, function (oActual) {
      var sDiscard = ReturnsSchema.discardAction + "(...)";
      assert.strictEqual(oActual, oError, "the original error");
      assert.notOk("orderCreatedId" in oActual, "nothing was saved");
      assert.ok(find(oModel.log, function (e) { return e.type === "execute" && e.path === sDiscard; }) > -1, "DiscardChanges sent");
      assert.strictEqual(find(oModel.log, isSaveBind), -1, "SaveChanges never bound");
      assert.deepEqual([oSession.opened, oSession.plainContext, oSession.pending], [false, null, null], "session reset");
      assert.ok(aConsoleErrors.some(function (s) { return /header write before SaveChanges failed/.test(s); }), "logged (Q18)");
    });
  });

  QUnit.test("Returns: a failed header $batch discards the session too", function (assert) {
    var oBatchError = new Error("$batch failed");
    var oRequestError = new Error("HTTP request was not processed because $batch failed");
    var bFirstSubmit = true;
    var oModel = stubModel({
      outcome: function (sKind) {
        if (sKind === "set") {
          return Promise.reject(oRequestError);
        }
        if (sKind === "submit" && bFirstSubmit) {
          bFirstSubmit = false;
          return Promise.reject(oBatchError);
        }
        return undefined;
      }
    });
    var oSession = openSession(oModel);
    return CreateOrderService.save(scratch(oModel, returnsScratch()), null, oSession, {}).then(function () {
      assert.ok(false, "must reject");
    }, function (oActual) {
      assert.ok(oActual === oRequestError || oActual === oBatchError, "rejects with the write's error");
      assert.notOk("orderCreatedId" in oActual, "nothing was saved");
      assert.ok(find(oModel.log, function (e) { return e.type === "execute" && e.path === ReturnsSchema.discardAction + "(...)"; }) > -1, "DiscardChanges sent");
      assert.strictEqual(find(oModel.log, isSaveBind), -1, "SaveChanges never bound");
      assert.strictEqual(oSession.opened, false, "session reset");
    });
  });

  QUnit.test("Returns: no header value, no header write; SaveChanges still runs", function (assert) {
    var oModel = stubModel();
    var oData = { CustomerReturnType: "ZKR", SoldToParty: "40029638", SDDocumentReason: "", ShippingCondition: null };
    return CreateOrderService.save(scratch(oModel, oData), null, openSession(oModel), {}).then(function () {
      assert.strictEqual(find(oModel.log, isBind(ReturnsSchema.buildHeaderPath(""))), -1, "no header binding");
      assert.ok(find(oModel.log, isSaveBind) > -1, "SaveChanges bound");
      assert.strictEqual(oModel.log.filter(function (e) { return e.type === "submit"; }).length, 1, "only the SaveChanges submit");
    });
  });

  QUnit.test("Returns: a failed Contact write still writes the header and saves, then reports it (Q9)", function (assert) {
    var oContactError = new Error("contact");
    var oModel = stubModel({
      outcome: function (sKind, oInfo) {
        return sKind === "set" && oInfo.prop === "ContactPerson" ? Promise.reject(oContactError) : undefined;
      }
    });
    return CreateOrderService.save(scratch(oModel, returnsScratch()), null, openSession(oModel), { contactId: "20185" }).then(function () {
      assert.ok(false, "must reject");
    }, function (oActual) {
      var iHeaderBind = find(oModel.log, isBind(ReturnsSchema.buildHeaderPath("")));
      var iSaveBind = find(oModel.log, isSaveBind);
      assert.ok(iHeaderBind > -1 && iHeaderBind < iSaveBind, "header written before SaveChanges");
      assert.strictEqual(oActual, oContactError, "Contact error reported");
      assert.strictEqual(oActual.orderCreatedId, NEW_ID, "after the save");
    });
  });

  QUnit.test("Provider Orders: today's sequence - Contact, SaveChanges, then the header PATCH on the new number", function (assert) {
    ServiceSchema.use(OrdersSchema);
    var oModel = stubModel();
    var oData = {
      SalesOrderType: "ZKB",
      SoldToParty: "40029638",
      SDDocumentReason: "001",
      PurchaseOrderByCustomer: "PO1",
      ShippingCondition: "01",
      ZOrdDesc: "",
      CustomerPurchaseOrderType: null
    };
    return CreateOrderService.save(scratch(oModel, oData), null, openSession(oModel), { contactId: "20185" }).then(function () {
      var aLog = oModel.log;
      var iContact = find(aLog, function (e) { return e.type === "set" && e.prop === OrdersSchema.headerPartnerProperties.contactPerson; });
      var iSaveBind = find(aLog, isSaveBind);
      var iNewBind = find(aLog, isBind(OrdersSchema.buildHeaderPath(NEW_ID)));
      assert.ok(iContact > -1 && iContact < iSaveBind && iSaveBind < iNewBind, "Contact -> SaveChanges -> new number");
      assert.strictEqual(find(aLog, isBind(OrdersSchema.buildHeaderPath(""))), -1, "nothing bound on the session header");
      assert.strictEqual(aLog.filter(function (e) { return e.type === "set" && e.path === OrdersSchema.buildHeaderPath(""); }).length, 0, "no write on the session header");
      assert.deepEqual(aLog.slice(iNewBind).filter(function (e) { return e.type === "set"; }).map(function (e) { return e.prop + "=" + e.value; }),
        ["SDDocumentReason=001", "PurchaseOrderByCustomer=PO1", "ShippingCondition=01"], "non-empty values on the new number");
      assert.strictEqual(aLog.slice(iNewBind).filter(function (e) { return e.type === "submit"; }).length, 1, "one submit after SaveChanges");
    });
  });

  QUnit.test("Returns, no session: Save opens it and posts the items like item entry (Q6)", function (assert) {
    var oModel = stubModel();
    var oSession = { opened: false, plainContext: null, pending: null };
    var oItems = itemsBinding([
      { Product: "49281-0007-10", RequestedQuantity: "12", RequestedQuantityUnit: "DOS", ReasonCode: "100", ZZ1_LotNumber_SDI: "L1", ZZ1_ExpirationDate_SDI: "2027-06-30" },
      { RequestedQuantity: "0" }
    ]);
    var sHeader = ReturnsSchema.buildHeaderPath("");
    return CreateOrderService.save(scratch(oModel, returnsScratch()), oItems, oSession, { contactId: "20185" }).then(function (oResult) {
      var aLog = oModel.log;
      var iAction = find(aLog, function (e) { return e.type === "bindContext" && e.path === ReturnsSchema.createAction + "(...)"; });
      assert.strictEqual(aLog[iAction].context, "/" + ReturnsSchema.entitySets.header + "/$header", "create action on the header list");
      assert.deepEqual(aLog.filter(function (e) { return e.type === "param"; }).map(function (e) { return e.name + "=" + e.value; }).sort(),
        ["CustomerReturnType=ZKR", "DistributionChannel=10", "OrganizationDivision=10", "SalesOrganization=1000"], "create parameters");
      var iSoldTo = find(aLog, function (e) { return e.type === "set" && e.path === sHeader && e.prop === "SoldToParty"; });
      assert.ok(iSoldTo > iAction, "Sold-To written into the session");
      var aCreates = aLog.filter(function (e) { return e.type === "create"; });
      assert.deepEqual(aCreates.map(function (e) { return e.body; }), [{}], "one item (the row with an NDC), empty body");
      var iCreate = find(aLog, function (e) { return e.type === "create"; });
      assert.ok(iCreate > iSoldTo, "item after the Sold-To");
      assert.deepEqual(aLog.slice(iCreate).filter(function (e) { return e.type === "set" && e.path === aCreates[0].path; }).map(function (e) { return e.prop; }).slice(0, 2),
        ["Product", "RequestedQuantityUnit"], "Product + Unit first");
      var iHeaderWrite = findLast(aLog, isBind(sHeader));
      assert.ok(iHeaderWrite > iCreate, "header write after the items");
      assert.ok(find(aLog, function (e) { return e.type === "submit"; }) > iHeaderWrite, "nothing submitted before the header write");
      assert.ok(find(aLog, isSaveBind) > iHeaderWrite, "then SaveChanges");
      assert.strictEqual(oResult.orderId, NEW_ID, "saved");
    });
  });

  QUnit.test("Returns, no session: a refused item post discards the opened session (Q6)", function (assert) {
    var oItemError = new Error("item refused");
    var oModel = stubModel({
      outcome: function (sKind) {
        return sKind === "created" ? Promise.reject(oItemError) : undefined;
      }
    });
    var oSession = { opened: false, plainContext: null, pending: null };
    var oItems = itemsBinding([{ Product: "49281-0007-10", RequestedQuantity: "12", RequestedQuantityUnit: "DOS" }]);
    var aConsoleErrors = this.aConsoleErrors;
    return CreateOrderService.save(scratch(oModel, returnsScratch()), oItems, oSession, {}).then(function () {
      assert.ok(false, "must reject");
    }, function (oActual) {
      assert.strictEqual(oActual, oItemError, "the original error");
      assert.notOk("orderCreatedId" in oActual, "nothing was saved");
      assert.ok(find(oModel.log, function (e) { return e.type === "execute" && e.path === ReturnsSchema.discardAction + "(...)"; }) > -1, "DiscardChanges sent");
      assert.strictEqual(find(oModel.log, isSaveBind), -1, "SaveChanges never bound");
      assert.deepEqual([oSession.opened, oSession.plainContext, oSession.pending], [false, null, null], "session reset");
      assert.ok(aConsoleErrors.some(function (s) { return /item post at Save failed/.test(s); }), "logged (Q18)");
    });
  });

  QUnit.test("Provider Orders, no session: today's fallback - one combined item create, submitted before SaveChanges", function (assert) {
    ServiceSchema.use(OrdersSchema);
    var oModel = stubModel();
    var oSession = { opened: false, plainContext: null, pending: null };
    var oItems = itemsBinding([{ Product: "58160-0821-11", RequestedQuantity: "10", RequestedQuantityUnit: "DOS" }]);
    var oData = { SalesOrderType: "ZKB", SoldToParty: "40029638", SalesOrganization: "1000", DistributionChannel: "10", OrganizationDivision: "10" };
    return CreateOrderService.save(scratch(oModel, oData), oItems, oSession, {}).then(function () {
      var aLog = oModel.log;
      var aCreates = aLog.filter(function (e) { return e.type === "create"; });
      assert.strictEqual(aCreates.length, 1, "one item create");
      assert.strictEqual(aCreates[0].body.Product, "58160-0821-11", "combined body");
      var iCreate = find(aLog, function (e) { return e.type === "create"; });
      var iItemSubmit = find(aLog, function (e) { return e.type === "submit"; }, iCreate);
      assert.ok(iItemSubmit > -1 && iItemSubmit < find(aLog, isSaveBind), "items submitted before SaveChanges");
    });
  });

  QUnit.test("Returns: a session still opening keeps today's fallback, nothing is posted twice (Q17)", function (assert) {
    var oOpenError = new Error("cannot process more than one sales document in one session");
    var oModel = stubModel({
      outcome: function (sKind, oInfo) {
        return sKind === "execute" && /CreateWith/.test(oInfo.path) ? Promise.reject(oOpenError) : undefined;
      }
    });
    var oSession = { opened: false, plainContext: null, pending: new Promise(function () {}) };
    var oItems = itemsBinding([{ Product: "49281-0007-10", RequestedQuantity: "12", RequestedQuantityUnit: "DOS" }]);
    return CreateOrderService.save(scratch(oModel, returnsScratch()), oItems, oSession, {}).then(function () {
      assert.ok(false, "must reject");
    }, function (oActual) {
      var iExecute = find(oModel.log, function (e) { return e.type === "execute" && /CreateWith/.test(e.path); });
      assert.strictEqual(oActual, oOpenError, "the fallback's error");
      assert.strictEqual(oModel.log[iExecute + 1].type, "submit", "the fallback's own submit after the create action");
      assert.strictEqual(oModel.log.filter(function (e) { return e.type === "create"; }).length, 0, "no item posted");
      assert.strictEqual(oModel.log.filter(function (e) { return e.type === "set"; }).length, 0, "no Sold-To or header write");
    });
  });
});
