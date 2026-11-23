/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/util/ConditionValueCheck",
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/schema/OrdersSchema",
  "cdc/vaccreq/model/schema/ReturnsSchema",
  "sap/m/Input",
  "sap/m/MultiInput",
  "sap/m/P13nConditionPanel",
  "sap/m/Token",
  "sap/ui/comp/valuehelpdialog/ValueHelpDialog",
  "sap/ui/core/library"
], function (ConditionValueCheck, ServiceSchema, OrdersSchema, ReturnsSchema, Input, MultiInput, P13nConditionPanel, Token,
  ValueHelpDialog, coreLibrary) {
  "use strict";

  // GH-99: Provider (ID or Name) value help, Define Conditions tab - type-ahead from the
  // filter field's list and only list keys accepted (default mode). GH-105: free-text mode,
  // and Provider conditions apply to the ID or the name.
  var ValueState = coreLibrary.ValueState;
  var mList = { "40006524": "40006524", "0040006524": "40006524", "40029638": "40029638" };

  function createCheck(oOverrides) {
    var oCalls = { lookups: [], configured: [], removed: 0 };
    var oCheck = ConditionValueCheck.create(Object.assign({
      lookup: function (aValues) {
        oCalls.lookups.push(aValues);
        var mFound = {};
        aValues.forEach(function (sValue) {
          if (mList[sValue]) {
            mFound[sValue] = mList[sValue];
          }
        });
        return Promise.resolve(mFound);
      },
      configureInput: function (oInput) {
        oCalls.configured.push(oInput);
        oInput.setShowSuggestion(true);
        return function () {
          oCalls.removed++;
        };
      },
      notFoundText: function (sValue) {
        return "not found " + sValue;
      },
      checkFailedText: "check failed"
    }, oOverrides));
    return { check: oCheck, calls: oCalls };
  }

  // The condition panel's own change handler, as attached by P13nConditionPanel#_createValueField.
  function panelInput(aSeen) {
    return new Input({
      change: function (oEvent) {
        oEvent.getSource().setValueState(ValueState.None);
        aSeen.push(oEvent.getSource().getValue());
      }
    });
  }

  function flush() {
    return new Promise(function (resolve) {
      setTimeout(resolve, 0);
    });
  }

  QUnit.module("ConditionValueCheck: value fields (GH-99)");

  QUnit.test("attachTo wires the dialog's suggest callback; without it the dialog is left alone", function (assert) {
    var fnCallback;
    var oSetup = createCheck();
    assert.ok(oSetup.check.attachTo({ suggest: function (fn) { fnCallback = fn; } }), "attached");
    assert.strictEqual(typeof fnCallback, "function", "callback handed to the dialog");
    assert.notOk(oSetup.check.attachTo({}), "no suggest -> false, no error");
    assert.notOk(oSetup.check.attachTo(null), "no dialog -> false");
  });

  QUnit.test("the running UI5 still offers ValueHelpDialog#suggest", function (assert) {
    assert.strictEqual(typeof ValueHelpDialog.prototype.suggest, "function",
      "non-public hook used for the Define Conditions type-ahead (feature-detected at runtime)");
  });

  QUnit.test("the provider configures the field; destroy() detaches everything", function (assert) {
    var fnCallback;
    var oSetup = createCheck();
    oSetup.check.attachTo({ suggest: function (fn) { fnCallback = fn; } });
    var oInput = new Input();
    var oProvider = fnCallback(oInput, "Customer");
    assert.strictEqual(oSetup.calls.configured[0], oInput, "configureInput called with the value field");
    assert.ok(oInput.getShowSuggestion(), "type-ahead on");
    assert.ok(oInput.hasListeners("change"), "change handler attached");
    assert.ok(oInput.hasListeners("suggestionItemSelected"), "pick handler attached");
    oProvider.destroy();
    assert.notOk(oInput.hasListeners("change"), "change handler detached");
    assert.notOk(oInput.hasListeners("suggestionItemSelected"), "pick handler detached");
    assert.strictEqual(oSetup.calls.removed, 1, "type-ahead removed");
    oInput.destroy();
  });

  QUnit.test("a picked row is accepted without a lookup; the operator is not touched", function (assert) {
    var fnCallback;
    var aSeen = [];
    var oSetup = createCheck();
    oSetup.check.attachTo({ suggest: function (fn) { fnCallback = fn; } });
    var oInput = panelInput(aSeen);
    fnCallback(oInput, "Customer");
    return flush().then(function () {
      // sap.m.Input on a row pick: suggestionItemSelected, then the first cell as value, then change.
      oInput.fireSuggestionItemSelected({ selectedRow: null });
      oInput.setValue("40029638");
      oInput.fireChange({ value: "40029638" });
      return flush();
    }).then(function () {
      assert.deepEqual(oSetup.calls.lookups, [], "no lookup for a picked value");
      assert.strictEqual(oInput.getValue(), "40029638", "value kept");
      assert.strictEqual(oInput.getValueState(), ValueState.None, "no error");
      oInput.destroy();
    });
  });

  QUnit.test("a typed existing ID is accepted and set to the list key (leading zeros)", function (assert) {
    var aSeen = [];
    var oSetup = createCheck();
    var oInput = panelInput(aSeen);
    oInput.setValue(" 0040006524 ");
    return oSetup.check.checkField(oInput).then(function () {
      assert.deepEqual(oSetup.calls.lookups, [["0040006524"]], "one lookup for the trimmed value");
      assert.strictEqual(oInput.getValue(), "40006524", "list key in the field");
      assert.deepEqual(aSeen, ["40006524"], "the condition panel received the key via change");
      assert.strictEqual(oInput.getValueState(), ValueState.None, "no error");
      oInput.destroy();
    });
  });

  QUnit.test("typed text that is not in the list is cleared from the condition with an error", function (assert) {
    var aSeen = [];
    var oSetup = createCheck();
    var oInput = panelInput(aSeen);
    oInput.setValue("Milwauk");
    return oSetup.check.checkField(oInput).then(function () {
      assert.strictEqual(oInput.getValue(), "", "field emptied");
      assert.deepEqual(aSeen, [""], "the condition panel received an empty value (condition dropped)");
      assert.strictEqual(oInput.getValueState(), ValueState.Error, "error state");
      assert.strictEqual(oInput.getValueStateText(), "not found Milwauk", "message names the value");
      oInput.destroy();
    });
  });

  QUnit.test("a failed lookup flags the field and keeps the value; a stale answer is ignored", function (assert) {
    var fnReject;
    var oSetup = createCheck({
      lookup: function () {
        return new Promise(function (resolve, reject) { fnReject = reject; });
      }
    });
    var oInput = panelInput([]);
    oInput.setValue("40006524");
    var oPending = oSetup.check.checkField(oInput);
    fnReject(new Error("503"));
    return oPending.then(function () {
      assert.strictEqual(oInput.getValueState(), ValueState.Error, "error state");
      assert.strictEqual(oInput.getValueStateText(), "check failed", "check-failed text");
      assert.strictEqual(oInput.getValue(), "40006524", "value kept");

      var oStale = createCheck();
      var oOther = panelInput([]);
      oOther.setValue("Milwauk");
      var oCheck = oStale.check.checkField(oOther);
      oOther.setValue("40006524");
      return oCheck.then(function () {
        assert.strictEqual(oOther.getValue(), "40006524", "a value typed meanwhile is not cleared");
        assert.strictEqual(oOther.getValueState(), ValueState.None, "no error from the stale answer");
        oInput.destroy();
        oOther.destroy();
      });
    });
  });

  QUnit.test("a field filled by the panel after creation (operator change, restored condition) is checked", function (assert) {
    var fnCallback;
    var oSetup = createCheck();
    oSetup.check.attachTo({ suggest: function (fn) { fnCallback = fn; } });
    var oInput = panelInput([]);
    fnCallback(oInput, "Customer");
    oInput.setValue("Milwauk");
    return flush().then(function () {
      assert.strictEqual(oInput.getValue(), "", "carried-over text rejected");
      assert.strictEqual(oInput.getValueState(), ValueState.Error, "error state");
      oInput.destroy();
    });
  });

  QUnit.test("real P13nConditionPanel: the callback runs for each value field (incl. between)", function (assert) {
    var aFields = [];
    var oPanel = new P13nConditionPanel({ maxConditions: "-1" });
    oPanel.setSuggestCallback(function (oControl, sKeyField) {
      aFields.push(sKeyField);
      return { destroy: function () {} };
    });
    oPanel.setKeyFields([{ key: "Customer", text: "Provider", type: "string" }]);
    oPanel.setConditions([
      { key: "c1", keyField: "Customer", operation: "Contains", value1: "40006524", exclude: false },
      { key: "c2", keyField: "Customer", operation: "BT", value1: "40006524", value2: "40029638", exclude: false }
    ]);
    assert.ok(aFields.length >= 4, "value1 and value2 of both conditions (" + aFields.length + " calls)");
    assert.ok(aFields.every(function (sKey) { return sKey === "Customer"; }), "called with the key field");
    oPanel.destroy();
  });

  QUnit.module("ConditionValueCheck: OK safety net (GH-99)");

  QUnit.test("checkRanges: unknown values are reported; known ones get the list key", function (assert) {
    var oSetup = createCheck({ knownValues: ["40029638", null] });
    var aRanges = [
      { exclude: false, operation: "EQ", value1: "40029638", displayValue: "40029638" },
      { exclude: false, operation: "Contains", value1: "Milwauk" },
      { exclude: true, operation: "BT", value1: "0040006524", value2: "zzz" },
      { exclude: false, operation: "Empty", value1: "" }
    ];
    return oSetup.check.checkRanges(aRanges).then(function (oResult) {
      assert.deepEqual(oSetup.calls.lookups, [["Milwauk", "0040006524", "zzz"]], "one lookup, known values skipped");
      assert.deepEqual(oResult.invalid, ["Milwauk", "zzz"], "not in the list");
      assert.strictEqual(oResult.ranges[2].value1, "40006524", "pasted value -> list key");
      assert.strictEqual(oResult.ranges[2].value2, "zzz", "unknown value unchanged");
      assert.strictEqual(oResult.ranges[2].exclude, true, "exclude kept");
      assert.strictEqual(oResult.ranges[2].operation, "BT", "operator kept");
      assert.strictEqual(oResult.ranges[3], aRanges[3], "Empty has no value to check");
      assert.notStrictEqual(oResult.ranges[2], aRanges[2], "input ranges not mutated");
    });
  });

  QUnit.test("checkRanges: all known -> nothing invalid, no request; lookup failure rejects", function (assert) {
    var oSetup = createCheck({ knownValues: ["40006524"] });
    return oSetup.check.checkRanges([{ operation: "StartsWith", value1: "40006524" }]).then(function (oResult) {
      assert.deepEqual(oResult.invalid, [], "valid");
      assert.deepEqual(oSetup.calls.lookups, [], "no request");
      var oFailing = createCheck({ lookup: function () { return Promise.reject(new Error("500")); } });
      return oFailing.check.checkRanges([{ operation: "EQ", value1: "x" }]).then(function () {
        assert.ok(false, "must reject");
      }, function () {
        assert.ok(true, "rejected");
      });
    });
  });

  QUnit.test("rangeValues", function (assert) {
    assert.deepEqual(ConditionValueCheck.rangeValues({ operation: "BT", value1: "1", value2: "2" }), ["1", "2"]);
    assert.deepEqual(ConditionValueCheck.rangeValues({ operation: "GT", value1: "1", value2: "2" }), ["1"]);
    assert.deepEqual(ConditionValueCheck.rangeValues({ operation: "Empty", value1: "x" }), []);
    assert.deepEqual(ConditionValueCheck.rangeValues(null), []);
  });

  // GH-105: Provider (ID or Name) conditions accept free text; exact IDs are still set to the list key.
  QUnit.module("ConditionValueCheck: free text (GH-105)");

  QUnit.test("an unknown typed value is kept without an error", function (assert) {
    var aSeen = [];
    var oSetup = createCheck({ allowUnknown: true });
    var oInput = panelInput(aSeen);
    oInput.setValue("milwau");
    return oSetup.check.checkField(oInput).then(function () {
      assert.strictEqual(oInput.getValue(), "milwau", "value kept");
      assert.deepEqual(aSeen, [], "the condition is not emptied");
      assert.strictEqual(oInput.getValueState(), ValueState.None, "no error");
      assert.deepEqual(oSetup.calls.lookups, [["milwau"]], "one lookup");
      oInput.destroy();
    });
  });

  QUnit.test("typed text is trimmed; a value of only spaces is cleared without a lookup", function (assert) {
    var aSeen = [];
    var aBlankSeen = [];
    var oSetup = createCheck({ allowUnknown: true });
    var oInput = panelInput(aSeen);
    var oBlank = panelInput(aBlankSeen);
    oInput.setValue(" milwau ");
    oBlank.setValue("   ");
    return Promise.all([oSetup.check.checkField(oInput), oSetup.check.checkField(oBlank)]).then(function () {
      assert.strictEqual(oInput.getValue(), "milwau", "trimmed");
      assert.deepEqual(aSeen, ["milwau"], "the condition received the trimmed text via change");
      assert.strictEqual(oBlank.getValue(), "", "spaces cleared");
      assert.deepEqual(aBlankSeen, [""], "the condition received an empty value");
      assert.deepEqual(oSetup.calls.lookups, [["milwau"]], "no lookup for spaces");
      assert.strictEqual(oInput.getValueState(), ValueState.None, "no error");
      oInput.destroy();
      oBlank.destroy();
    });
  });

  QUnit.test("a typed existing ID is still set to the list key", function (assert) {
    var aSeen = [];
    var oSetup = createCheck({ allowUnknown: true });
    var oInput = panelInput(aSeen);
    oInput.setValue(" 0040006524 ");
    return oSetup.check.checkField(oInput).then(function () {
      assert.strictEqual(oInput.getValue(), "40006524", "list key in the field");
      assert.strictEqual(aSeen[aSeen.length - 1], "40006524", "the condition received the key");
      assert.deepEqual(oSetup.calls.lookups, [["0040006524"]], "one lookup for the trimmed value");
      assert.strictEqual(oInput.getValueState(), ValueState.None, "no error");
      oInput.destroy();
    });
  });

  QUnit.test("a failed lookup keeps the trimmed value without an error", function (assert) {
    var aSeen = [];
    var oSetup = createCheck({
      allowUnknown: true,
      lookup: function () {
        return Promise.reject(new Error("503"));
      }
    });
    var oInput = panelInput(aSeen);
    oInput.setValue(" 4000 ");
    return oSetup.check.checkField(oInput).then(function () {
      assert.strictEqual(oInput.getValue(), "4000", "trimmed value kept");
      assert.deepEqual(aSeen, ["4000"], "the condition keeps the value");
      assert.strictEqual(oInput.getValueState(), ValueState.None, "no error");
      oInput.destroy();
    });
  });

  QUnit.test("a field filled by the panel after creation keeps unknown text (trimmed, one lookup)", function (assert) {
    var fnCallback;
    var oSetup = createCheck({ allowUnknown: true });
    oSetup.check.attachTo({ suggest: function (fn) { fnCallback = fn; } });
    var oInput = panelInput([]);
    fnCallback(oInput, "Customer");
    oInput.setValue(" milwau ");
    return flush().then(function () {
      assert.strictEqual(oInput.getValue(), "milwau", "carried-over text kept, trimmed");
      assert.deepEqual(oSetup.calls.lookups, [["milwau"]], "checked once, although the trim re-enters checkField via change");
      assert.strictEqual(oInput.getValueState(), ValueState.None, "no error");
      oInput.destroy();
    });
  });

  QUnit.test("checkRanges: nothing is invalid; unknown values trimmed, known ones get the list key", function (assert) {
    var oSetup = createCheck({ allowUnknown: true, knownValues: ["40029638"] });
    var aRanges = [
      { exclude: false, operation: "EQ", value1: "40029638", displayValue: "40029638" },
      { exclude: false, operation: "Contains", value1: " milwau " },
      { exclude: true, operation: "BT", value1: "0040006524", value2: "zzz" },
      { exclude: false, operation: "Empty", value1: "" }
    ];
    return oSetup.check.checkRanges(aRanges).then(function (oResult) {
      assert.deepEqual(oSetup.calls.lookups, [["milwau", "0040006524", "zzz"]], "one lookup, known values skipped");
      assert.deepEqual(oResult.invalid, [], "free text is valid");
      assert.strictEqual(oResult.ranges[0].value1, "40029638", "known value unchanged");
      assert.strictEqual(oResult.ranges[1].value1, "milwau", "unknown value trimmed");
      assert.strictEqual(oResult.ranges[2].value1, "40006524", "pasted ID -> list key");
      assert.strictEqual(oResult.ranges[2].value2, "zzz", "unknown value kept");
      assert.strictEqual(oResult.ranges[2].exclude, true, "exclude kept");
      assert.strictEqual(oResult.ranges[3], aRanges[3], "Empty has no value to check");
    });
  });

  QUnit.test("checkRanges: a failed lookup does not block - values kept (trimmed), known ones still keyed", function (assert) {
    var oSetup = createCheck({
      allowUnknown: true,
      knownValues: ["40029638"],
      lookup: function () {
        return Promise.reject(new Error("500"));
      }
    });
    return oSetup.check.checkRanges([
      { operation: "Contains", value1: " x " },
      { operation: "EQ", value1: "40029638" }
    ]).then(function (oResult) {
      assert.deepEqual(oResult.invalid, [], "nothing invalid");
      assert.strictEqual(oResult.ranges[0].value1, "x", "trimmed value kept");
      assert.strictEqual(oResult.ranges[1].value1, "40029638", "known value kept");
    }, function () {
      assert.ok(false, "must not reject in free-text mode");
    });
  });

  [false, true].forEach(function (bAllowUnknown) {
    QUnit.test("one lookup per value: a settled 'not found' and an in-flight lookup are reused (" +
      (bAllowUnknown ? "free text" : "list only") + ")", function (assert) {
      var aInvalid = bAllowUnknown ? [] : ["milwau"];
      var oSequential = createCheck({ allowUnknown: bAllowUnknown });
      var oFirst = panelInput([]);
      oFirst.setValue("milwau");
      return oSequential.check.checkField(oFirst).then(function () {
        return oSequential.check.checkRanges([{ operation: "Contains", value1: "milwau" }]);
      }).then(function (oResult) {
        assert.deepEqual(oSequential.calls.lookups, [["milwau"]], "OK reuses the field's 'not found' answer");
        assert.deepEqual(oResult.invalid, aInvalid, "same result as before");

        var aLookups = [];
        var aResolve = [];
        var oConcurrent = createCheck({
          allowUnknown: bAllowUnknown,
          lookup: function (aValues) {
            aLookups.push(aValues);
            return new Promise(function (resolve) {
              aResolve.push(resolve);
            });
          }
        });
        var oSecond = panelInput([]);
        oSecond.setValue("milwau");
        var oField = oConcurrent.check.checkField(oSecond);
        var oRanges = oConcurrent.check.checkRanges([{ operation: "Contains", value1: "milwau" }]);
        assert.deepEqual(aLookups, [["milwau"]], "OK waits for the field's lookup in flight");
        aResolve.forEach(function (fnResolve) {
          fnResolve({});
        });
        return Promise.all([oField, oRanges]).then(function (aResults) {
          assert.strictEqual(aLookups.length, 1, "still one lookup");
          assert.deepEqual(aResults[1].invalid, aInvalid, "same result as before");
          oFirst.destroy();
          oSecond.destroy();
        });
      });
    });
  });

  // ---- Master controller -------------------------------------------------------------------

  var sPreviousProfile;

  function loadMaster() {
    return new Promise(function (resolve, reject) {
      sap.ui.require(["cdc/vaccreq/controller/Master.controller"], resolve, reject);
    });
  }

  function stubMaster(Master, mControls, oModel) {
    var oStub = Object.create(Master.prototype);
    var aTextKeys = [];
    var oBundle = {
      getText: function (sKey, aArgs) {
        aTextKeys.push(sKey);
        return sKey + (aArgs ? ":" + aArgs.join("|") : "");
      }
    };
    oStub.textKeys = aTextKeys;
    oStub.byId = function (sId) { return mControls[sId]; };
    oStub.getOwnerComponent = function () {
      return {
        getModel: function (sName) {
          return sName === "i18n" ? { getResourceBundle: function () { return oBundle; } } : oModel;
        }
      };
    };
    return oStub;
  }

  QUnit.module("Master: Provider conditions (GH-99)", {
    // Master.controller's module graph reads the active profile when it loads.
    beforeEach: function () {
      sPreviousProfile = ServiceSchema.profileId;
      ServiceSchema.use(ReturnsSchema);
    },
    afterEach: function () {
      if (sPreviousProfile) {
        ServiceSchema.use(sPreviousProfile === ReturnsSchema.profileId ? ReturnsSchema : OrdersSchema);
      }
    }
  });

  function filterShape(oFilter) {
    var vValue2 = oFilter.getValue2();
    return [oFilter.getPath(), oFilter.getOperator(), oFilter.getValue1()].join(" ") +
      (vValue2 === undefined || vValue2 === null ? "" : ".." + vValue2);
  }

  QUnit.test("Provider conditions apply to ID or name; excludes match neither (GH-105)", function (assert) {
    return loadMaster().then(function (Master) {
      [ReturnsSchema, OrdersSchema].forEach(function (oProfile) {
        ServiceSchema.use(oProfile);
        var sId = ServiceSchema.headerProperties.providerId;
        var sName = ServiceSchema.headerProperties.providerName;
        assert.strictEqual(sName, oProfile === ReturnsSchema ? "SoldToPartyName" : "CustomerName",
          "name path of the " + oProfile.profileId + " profile");
        var oInput = new MultiInput();
        [
          { exclude: false, operation: "Contains", value1: "40033" },
          { exclude: false, operation: "EQ", value1: "40006524", displayValue: "40006524" },
          { exclude: false, operation: "BT", value1: "40029000", value2: "40030000" },
          { exclude: false, operation: "Empty", value1: "" },
          { exclude: false, operation: "GT", value1: "40001000" },
          { exclude: true, operation: "Contains", value1: "milwau" },
          { exclude: true, operation: "LT", value1: "40001000" }
        ].forEach(function (oRange, iIndex) {
          oInput.addToken(new Token({ text: "condition " + iIndex }).data("range", oRange));
        });
        var oStub = stubMaster(Master, { filterProvider: oInput });
        var aFilters = [];
        oStub._pushConditionFilters(aFilters, "filterProvider");
        assert.strictEqual(aFilters.length, 2, "include group + exclude group");
        assert.notOk(aFilters[0].isAnd(), "includes: ID or name (OR)");
        assert.deepEqual(aFilters[0].getFilters().map(filterShape), [
          sId + " Contains 40033", sName + " Contains 40033",
          sId + " EQ 40006524", sName + " EQ 40006524",
          sId + " BT 40029000..40030000", sName + " BT 40029000..40030000",
          sId + " EQ ", sName + " EQ ",
          sId + " GT 40001000", sName + " GT 40001000"
        ], "every operator on both paths, in token order");
        assert.ok(aFilters[1].isAnd(), "excludes: neither ID nor name (AND)");
        assert.deepEqual(aFilters[1].getFilters().map(filterShape), [
          sId + " NotContains milwau", sName + " NotContains milwau",
          sId + " GE 40001000", sName + " GE 40001000"
        ], "exclude mappings on both paths");
        assert.ok(aFilters[0].getFilters().concat(aFilters[1].getFilters()).every(function (oFilter) {
          return oFilter.isCaseSensitive() !== false;
        }), "never case-insensitive (the services answer tolower with 501)");
        oInput.destroy();
      });
    });
  });

  QUnit.test("other condition fields keep one path; typed Provider text is unchanged (GH-105)", function (assert) {
    return loadMaster().then(function (Master) {
      var oRequestId = new MultiInput();
      oRequestId.addToken(new Token({ text: "*600*" }).data("range", { exclude: false, operation: "Contains", value1: "600" }));
      var oProvider = new MultiInput({ value: "*milwau*" });
      var oStub = stubMaster(Master, { filterRequestId: oRequestId, filterProvider: oProvider });
      var aFilters = [];
      oStub._pushConditionFilters(aFilters, "filterRequestId");
      assert.strictEqual(aFilters.length, 1, "one include group");
      assert.deepEqual(aFilters[0].getFilters().map(filterShape), [ServiceSchema.keys.orderId + " Contains 600"],
        "Request ID: one path");

      aFilters = [];
      oStub._pushConditionFilters(aFilters, "filterProvider");
      assert.strictEqual(aFilters.length, 1, "typed text: one filter");
      assert.notOk(aFilters[0].isAnd(), "ID or name");
      assert.deepEqual(aFilters[0].getFilters().map(filterShape), [
        ServiceSchema.headerProperties.providerId + " Contains milwau",
        ServiceSchema.headerProperties.providerName + " Contains milwau"
      ], "typed *x* -> contains on ID or name, as before");
      oRequestId.destroy();
      oProvider.destroy();
    });
  });

  QUnit.test("the Provider value help asks for free text and needs no 'not found' texts (GH-105)", function (assert) {
    return loadMaster().then(function (Master) {
      var oList = { entitySet: "CustomerSalesArea", key: "Customer" };
      var oInput = new MultiInput().data("suggestionConfig", oList);
      var oStub = stubMaster(Master, { filterProvider: oInput });
      var oConfig;
      oStub._openStandardEntityValueHelp = function (oField, oValueHelpConfig) {
        oConfig = oValueHelpConfig;
      };
      oStub.onProviderFilterValueHelpRequest();
      assert.deepEqual(oConfig.conditionValueList, { suggestionConfig: oList, allowUnknown: true },
        "free text on, the filter field's list as suggestions, no error texts");
      oInput.destroy();
    });
  });

  QUnit.test("_createConditionValueCheck in free-text mode: nothing invalid, IDs set to the list key (GH-105)", function (assert) {
    return loadMaster().then(function (Master) {
      var aRequests = [];
      var oModel = {
        bindList: function (sPath, oContext, aSorters, aFilters) {
          var sValue = aFilters[0].getValue1();
          aRequests.push(sValue);
          return {
            requestContexts: function () {
              return Promise.resolve(mList[sValue] ? [{ getProperty: function () { return mList[sValue]; } }] : []);
            },
            destroy: function () {}
          };
        }
      };
      var oInput = new MultiInput();
      var oStub = stubMaster(Master, {}, oModel);
      var oCheck = oStub._createConditionValueCheck(oInput, {
        suggestionConfig: { modelName: "ord", entitySet: "CustomerSalesArea", key: "Customer", description: "CustomerName",
          keyLabel: "providerHelpId", descriptionLabel: "providerHelpName" },
        allowUnknown: true
      });
      return oCheck.checkRanges([
        { operation: "Contains", value1: "milwau" },
        { operation: "EQ", value1: "0040006524" }
      ]).then(function (oResult) {
        assert.deepEqual(aRequests, ["milwau", "0040006524"], "one exact lookup per value");
        assert.deepEqual(oResult.invalid, [], "free text accepted");
        assert.strictEqual(oResult.ranges[0].value1, "milwau", "free text kept");
        assert.strictEqual(oResult.ranges[1].value1, "40006524", "typed ID normalised to the list key");
        assert.ok(oStub.textKeys.every(function (sKey) {
          return typeof sKey === "string" && sKey.length > 0;
        }), "no text read with a missing key");
        oInput.destroy();
      });
    });
  });

  QUnit.test("_createConditionValueCheck: one exact lookup per value on the list's model; tokens from the list are known", function (assert) {
    return loadMaster().then(function (Master) {
      var aRequests = [];
      var oModel = {
        bindList: function (sPath, oContext, aSorters, aFilters, mParameters) {
          var sValue = aFilters[0].getValue1();
          aRequests.push({ path: sPath, filter: aFilters[0].getPath() + " " + aFilters[0].getOperator() + " " + sValue,
            select: mParameters.$select });
          var bDestroyed = false;
          // Like V4: a context of a destroyed list binding can no longer be read.
          var oContext = {
            getProperty: function () {
              if (bDestroyed) {
                throw new TypeError("Cannot read properties of undefined (reading 'checkSuspended')");
              }
              return mList[sValue];
            }
          };
          return {
            requestContexts: function () {
              return Promise.resolve(mList[sValue] ? [oContext] : []);
            },
            destroy: function () {
              bDestroyed = true;
            }
          };
        }
      };
      var oInput = new MultiInput();
      oInput.addToken(new Token({ text: "40029638" }).data("range",
        { exclude: false, operation: "EQ", value1: "40029638", displayValue: "40029638" }));
      oInput.addToken(new Token({ text: "*Mil*" }).data("range", { exclude: false, operation: "Contains", value1: "Mil" }));
      var oStub = stubMaster(Master, {}, oModel);
      var oCheck = oStub._createConditionValueCheck(oInput, {
        suggestionConfig: { modelName: "ord", entitySet: "CustomerSalesArea", key: "Customer", description: "CustomerName",
          keyLabel: "providerHelpId", descriptionLabel: "providerHelpName" },
        notFoundKey: "testNotFound",
        invalidKey: "testInvalid",
        checkFailedKey: "testCheckFailed"
      });
      return oCheck.checkRanges([
        { operation: "EQ", value1: "40029638" },
        { operation: "Contains", value1: "Mil" },
        { operation: "EQ", value1: "0040006524" }
      ]).then(function (oResult) {
        assert.deepEqual(aRequests, [
          { path: "/CustomerSalesArea", filter: "Customer EQ Mil", select: "Customer" },
          { path: "/CustomerSalesArea", filter: "Customer EQ 0040006524", select: "Customer" }
        ], "exact lookups for the unknown values only");
        assert.deepEqual(oResult.invalid, ["Mil"], "free text rejected (also when restored from a token)");
        assert.strictEqual(oResult.ranges[2].value1, "40006524", "typed ID normalised to the list key");

        var oValueInput = new Input();
        var fnCallback;
        oCheck.attachTo({ suggest: function (fn) { fnCallback = fn; } });
        var oProvider = fnCallback(oValueInput, "Customer");
        assert.strictEqual(oValueInput.data("suggestionConfig").entitySet, "CustomerSalesArea", "field uses the filter's list");
        assert.strictEqual(oValueInput.getSuggestionColumns().length, 2, "ID and name columns");
        assert.ok(oValueInput.hasListeners("suggest"), "type-ahead handler");
        assert.notOk((oValueInput.mEventRegistry.suggestionItemSelected || []).some(function (oListener) {
          return oListener.fFunction === Master.prototype.onFilterSuggestionSelected;
        }), "a pick does not create filter-field tokens");
        oProvider.destroy();
        assert.notOk(oValueInput.hasListeners("suggest"), "type-ahead handler removed");
        oValueInput.destroy();
        oInput.destroy();
      });
    });
  });
});
