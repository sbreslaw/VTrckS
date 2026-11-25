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
  "sap/ui/core/library",
  "sap/m/ComboBox",
  "sap/m/MultiComboBox",
  "sap/ui/core/Item",
  "sap/ui/comp/filterbar/FilterBar",
  "sap/ui/comp/filterbar/FilterGroupItem",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (ConditionValueCheck, ServiceSchema, OrdersSchema, ReturnsSchema, Input, MultiInput, P13nConditionPanel, Token,
  ValueHelpDialog, coreLibrary, ComboBox, MultiComboBox, Item, FilterBar, FilterGroupItem, Filter, FilterOperator) {
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

  // ---- GH-120: Description and Return Type filters (Manage Returns only) -------------------

  QUnit.module("Master: Description and Return Type filters (GH-120)", {
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

  var RETURN_TYPE_KEYS = ["REPL", "RETO", "RETR"];

  function returnTypeComboBox(sId) {
    return new ComboBox(sId, {
      items: RETURN_TYPE_KEYS.map(function (sKey) {
        return new Item({ key: sKey, text: sKey });
      })
    });
  }

  function deepShape(oFilter) {
    var aFilters = oFilter.getFilters();
    return aFilters ? "(" + aFilters.map(deepShape).join(oFilter.isAnd() ? " and " : " or ") + ")" : filterShape(oFilter);
  }

  function leaves(aFilters) {
    return aFilters.reduce(function (aLeaves, oFilter) {
      return aLeaves.concat(oFilter.getFilters() ? leaves(oFilter.getFilters()) : [oFilter]);
    }, []);
  }

  // onSearch with every control it reads, the async lookups resolved empty and the list binding captured.
  function searchStub(Master) {
    var mControls = {
      filterRequestId: new MultiInput(),
      filterExisId: new MultiInput(),
      filterProvider: new MultiInput(),
      filterCreatedBy: new MultiInput(),
      filterEmployeeResponsible: new Input(),
      filterShipToParty: new Input(),
      filterJurisdiction: new Input(),
      filterDescription: new Input(),
      filterDeliveryBlockReason: new ComboBox(),
      filterSalesOrderType: new ComboBox(),
      filterReturnType: returnTypeComboBox(),
      filterStatus: new MultiComboBox()
    };
    var aCaptured = [];
    var oStub = stubMaster(Master, Object.assign({
      requestsTable: {
        getBinding: function () {
          return {
            filter: function (aFilters) {
              aCaptured.push(aFilters);
            },
            attachEventOnce: function () {}
          };
        }
      }
    }, mControls));
    oStub.getView = function () {
      return { byId: oStub.byId };
    };
    oStub._oViewModel = { setProperty: function () {} };
    oStub._resolveProviderPinFilters = function () {
      return Promise.resolve([]);
    };
    oStub._resolveNdcFilters = function () {
      return Promise.resolve([]);
    };
    oStub._getOrderTypeFilter = function () {
      return new Filter("OrderTypeScope", FilterOperator.EQ, "X");
    };
    oStub._getCreatedOnFilter = function () {
      return null;
    };
    oStub.controls = mControls;
    oStub.search = function () {
      oStub.onSearch();
      return flush().then(function () {
        return aCaptured[aCaptured.length - 1];
      });
    };
    oStub.destroyControls = function () {
      Object.keys(mControls).forEach(function (sId) {
        mControls[sId].destroy();
      });
    };
    return oStub;
  }

  QUnit.test("Search: Description adds contains, Return Type adds eq; empty fields add nothing", function (assert) {
    return loadMaster().then(function (Master) {
      var sDescription = ServiceSchema.headerProperties.description;
      var sReturnType = ServiceSchema.headerProperties.returnType;
      assert.strictEqual(sDescription, "ZZ1_Description_SDH", "Returns Description property");
      assert.strictEqual(sReturnType, "ZZ1_VaccineReturnType_SDH", "Returns Return Type property");
      var oStub = searchStub(Master);
      var oControls = oStub.controls;
      var aBaseline;
      var fnAdded = function (aFilters) {
        var aBase = aBaseline.map(deepShape);
        return aFilters.map(deepShape).filter(function (sShape) {
          return aBase.indexOf(sShape) === -1;
        });
      };
      var fnRest = function (aFilters, aAdded) {
        return aFilters.map(deepShape).filter(function (sShape) {
          return aAdded.indexOf(sShape) === -1;
        });
      };
      return oStub.search().then(function (aFilters) {
        aBaseline = aFilters;
        assert.ok(aFilters.length > 0, "the search ran (" + aFilters.length + " filters)");
        assert.notOk(leaves(aFilters).some(function (oFilter) {
          return oFilter.getPath() === sDescription || oFilter.getPath() === sReturnType;
        }), "both empty -> no Description or Return Type condition");

        oControls.filterDescription.setValue("  gh115 ");
        return oStub.search();
      }).then(function (aFilters) {
        var aAdded = fnAdded(aFilters);
        assert.deepEqual(aAdded, [sDescription + " Contains gh115"], "Description -> contains, trimmed");
        assert.deepEqual(fnRest(aFilters, aAdded), aBaseline.map(deepShape), "every other filter unchanged, same order");
        assert.ok(leaves(aFilters).every(function (oFilter) {
          return oFilter.isCaseSensitive() !== false;
        }), "never case-insensitive (tolower -> 501)");

        oControls.filterDescription.setValue("");
        oControls.filterReturnType.setSelectedKey("REPL");
        return oStub.search();
      }).then(function (aFilters) {
        var aAdded = fnAdded(aFilters);
        assert.deepEqual(aAdded, [sReturnType + " EQ REPL"], "Return Type -> eq");
        assert.deepEqual(fnRest(aFilters, aAdded), aBaseline.map(deepShape), "every other filter unchanged");

        oControls.filterDescription.setValue("test");
        return oStub.search();
      }).then(function (aFilters) {
        var aAdded = fnAdded(aFilters);
        assert.deepEqual(aAdded, [sDescription + " Contains test", sReturnType + " EQ REPL"], "both together");
        assert.deepEqual(fnRest(aFilters, aAdded), aBaseline.map(deepShape), "every other filter unchanged");

        oControls.filterDescription.setValue("*");
        oControls.filterReturnType.setSelectedKey("");
        return oStub.search();
      }).then(function (aFilters) {
        assert.deepEqual(aFilters.map(deepShape), aBaseline.map(deepShape), "'*' and a cleared Return Type add nothing");

        oControls.filterDescription.setValue("   ");
        return oStub.search();
      }).then(function (aFilters) {
        assert.deepEqual(aFilters.map(deepShape), aBaseline.map(deepShape), "spaces only add nothing");

        oControls.filterDescription.setValue("=GH115");
        return oStub.search();
      }).then(function (aFilters) {
        assert.deepEqual(fnAdded(aFilters), [sDescription + " EQ GH115"], "typed syntax: =x -> eq (as Ship-To)");
        oStub.destroyControls();
      });
    });
  });

  function availabilityStub(Master) {
    var oFilterBar = new FilterBar({
      filterGroupItems: [
        new FilterGroupItem({ name: "salesOrderType", label: "Sales Order Type", groupName: "default", visibleInFilterBar: true,
          control: new ComboBox("gh120--filterSalesOrderType") }),
        new FilterGroupItem({ name: "description", label: "Description", groupName: "default", visibleInFilterBar: true,
          control: new Input("gh120--filterDescription") }),
        new FilterGroupItem({ name: "returnType", label: "Return Type", groupName: "default", visibleInFilterBar: true,
          control: new ComboBox("gh120--filterReturnType") }),
        new FilterGroupItem({ name: "shipToParty", label: "Ship-To", groupName: "dialog", visibleInFilterBar: false,
          control: new Input("gh120--filterShipToParty") })
      ]
    });
    var mControls = {
      filterBar: oFilterBar,
      filterPriority: new ComboBox(),
      filterJurisdiction: new Input(),
      filterDeliveryBlockReason: new ComboBox()
    };
    var oStub = stubMaster(Master, mControls);
    oStub.getView = function () {
      return {
        getLocalId: function (sId) {
          return sId.replace(/^.*--/, "");
        }
      };
    };
    oStub.hidden = function () {
      var mHidden = {};
      oFilterBar.getFilterGroupItems().forEach(function (oItem) {
        mHidden[oItem.getName()] = oItem.getHiddenFilter();
      });
      return mHidden;
    };
    oStub.destroyControls = function () {
      Object.keys(mControls).forEach(function (sId) {
        mControls[sId].destroy();
      });
    };
    return oStub;
  }

  QUnit.test("Both filters are hidden on Provider Orders and shown on Manage Returns", function (assert) {
    return loadMaster().then(function (Master) {
      ServiceSchema.use(OrdersSchema);
      var oOrders = availabilityStub(Master);
      oOrders._applyFilterAvailability();
      assert.deepEqual(oOrders.hidden(), { salesOrderType: false, description: true, returnType: true, shipToParty: false },
        "Orders: Description and Return Type hidden (bar and Adapt Filters)");
      assert.deepEqual(oOrders._mHiddenFilterControls, { filterDescription: true, filterReturnType: true },
        "Orders: their controls are left out of variants");
      oOrders.destroyControls();

      ServiceSchema.use(ReturnsSchema);
      var oReturns = availabilityStub(Master);
      oReturns._applyFilterAvailability();
      assert.deepEqual(oReturns.hidden(), { salesOrderType: false, description: false, returnType: false, shipToParty: true },
        "Returns: both shown; Ship-To stays hidden (#70)");
      assert.deepEqual(oReturns._mHiddenFilterControls, { filterShipToParty: true }, "Returns: only Ship-To left out of variants");
      oReturns.destroyControls();
    });
  });

  QUnit.test("Return Type items are bound to the provider-order value list only where the filter is shown", function (assert) {
    return loadMaster().then(function (Master) {
      var oSchema = ServiceSchema.providerOrderService;
      var oCombo = new ComboBox();
      var oStub = stubMaster(Master, { filterReturnType: oCombo });
      oStub._mHiddenFilterControls = { filterShipToParty: true, filterDeliveryBlockReason: true };
      oStub._populateReturnTypeItems();
      var oInfo = oCombo.getBindingInfo("items");
      assert.ok(oInfo, "Returns: items bound");
      assert.strictEqual(oInfo.model, "po", "on the provider-order model");
      assert.strictEqual(oInfo.path, "/" + oSchema.entitySets.vaccineReturnType, "the Return Type value list");
      var oKeyPart = oInfo.template.getBindingInfo("key").parts[0];
      var oTextPart = oInfo.template.getBindingInfo("text").parts[0];
      assert.deepEqual([oKeyPart.model, oKeyPart.path], ["po", oSchema.vaccineReturnTypeProperties.code], "key = code");
      assert.deepEqual([oTextPart.model, oTextPart.path], ["po", oSchema.vaccineReturnTypeProperties.text], "text = text");
      oCombo.destroy();

      var oHiddenCombo = new ComboBox();
      var oHidden = stubMaster(Master, { filterReturnType: oHiddenCombo });
      oHidden._mHiddenFilterControls = { filterDescription: true, filterReturnType: true };
      oHidden._populateReturnTypeItems();
      assert.notOk(oHiddenCombo.getBindingInfo("items"), "Orders: not bound, no request");
      oHiddenCombo.destroy();

      // The other caller keeps the default model (Delivery Block Reason on Provider Orders).
      ServiceSchema.use(OrdersSchema);
      var oBlock = new ComboBox();
      var oBlockStub = stubMaster(Master, { filterDeliveryBlockReason: oBlock });
      oBlockStub._populateValueHelp("filterDeliveryBlockReason", ServiceSchema.entitySets.deliveryBlockReason,
        ServiceSchema.valueHelpProperties.deliveryBlockReasonCode, ServiceSchema.valueHelpProperties.deliveryBlockReasonText);
      var oBlockInfo = oBlock.getBindingInfo("items");
      assert.strictEqual(oBlockInfo.model, undefined, "Delivery Block Reason: default model, as before");
      assert.strictEqual(oBlockInfo.path, "/" + ServiceSchema.entitySets.deliveryBlockReason, "Delivery Block Reason: same path");
      assert.strictEqual(oBlockInfo.template.getBindingInfo("key").parts[0].path, ServiceSchema.valueHelpProperties.deliveryBlockReasonCode,
        "Delivery Block Reason: same key");
      assert.strictEqual(oBlockInfo.template.getBindingInfo("text").parts[0].path, ServiceSchema.valueHelpProperties.deliveryBlockReasonText,
        "Delivery Block Reason: same text");
      assert.notOk(oBlockInfo.template.getBindingInfo("key").parts[0].model, "Delivery Block Reason: no model name");
      oBlock.destroy();
    });
  });

  QUnit.test("Variants and Clear: both values are saved, restored and emptied; older variants still load", function (assert) {
    return loadMaster().then(function (Master) {
      var mControls = {
        filterDescription: new Input(),
        filterReturnType: returnTypeComboBox(),
        filterEmployeeResponsible: new Input()
      };
      var oStub = stubMaster(Master, mControls);
      oStub.getView = function () {
        return { byId: oStub.byId };
      };
      oStub._mHiddenFilterControls = { filterShipToParty: true, filterDeliveryBlockReason: true };
      var fnNewDefs = function () {
        return oStub._getVariantControlDefs().filter(function (oDef) {
          return oDef.id === "filterDescription" || oDef.id === "filterReturnType";
        });
      };
      assert.deepEqual(fnNewDefs(), [{ id: "filterDescription", type: "value" }, { id: "filterReturnType", type: "key" }],
        "Returns: both in the variant definitions");

      mControls.filterDescription.setValue("test");
      mControls.filterReturnType.setSelectedKey("RETO");
      var oCaptured = oStub._captureVariantValues();
      assert.strictEqual(oCaptured.filterDescription, "test", "Description saved");
      assert.strictEqual(oCaptured.filterReturnType, "RETO", "Return Type saved");

      mControls.filterDescription.setValue("other");
      mControls.filterReturnType.setSelectedKey("RETR");
      oStub._applyVariantValues(oCaptured);
      assert.strictEqual(mControls.filterDescription.getValue(), "test", "Description restored");
      assert.strictEqual(mControls.filterReturnType.getSelectedKey(), "RETO", "Return Type restored");

      oStub._applyVariantValues({});
      assert.strictEqual(mControls.filterDescription.getValue(), "", "Standard: Description empty");
      assert.strictEqual(mControls.filterReturnType.getSelectedKey(), "", "Standard: Return Type empty");

      mControls.filterDescription.setValue("test");
      mControls.filterReturnType.setSelectedKey("RETO");
      var bSearched = false;
      oStub.onSearch = function () {
        bSearched = true;
      };
      oStub.onFilterBarClear();
      assert.strictEqual(mControls.filterDescription.getValue(), "", "onFilterBarClear: Description empty");
      assert.strictEqual(mControls.filterReturnType.getSelectedKey(), "", "onFilterBarClear: Return Type empty");
      assert.ok(bSearched, "onFilterBarClear searches");

      mControls.filterDescription.setValue("test");
      mControls.filterReturnType.setSelectedKey("RETO");
      oStub._applyVariantValues({ filterEmployeeResponsible: "x" });
      assert.strictEqual(mControls.filterEmployeeResponsible.getValue(), "x", "older variant: its values apply");
      assert.strictEqual(mControls.filterDescription.getValue(), "", "older variant: Description empty");
      assert.strictEqual(mControls.filterReturnType.getSelectedKey(), "", "older variant: Return Type empty");

      oStub._mHiddenFilterControls = { filterDescription: true, filterReturnType: true };
      assert.deepEqual(fnNewDefs(), [], "Orders: neither in the variant definitions");
      Object.keys(mControls).forEach(function (sId) {
        mControls[sId].destroy();
      });
    });
  });

  QUnit.test("Profiles, view and texts: Orders hides both; the bar shows them after Sales Order Type", function (assert) {
    assert.ok(OrdersSchema.hiddenMasterFilters.indexOf("description") !== -1, "Orders hides description");
    assert.ok(OrdersSchema.hiddenMasterFilters.indexOf("returnType") !== -1, "Orders hides returnType");
    assert.strictEqual(ReturnsSchema.hiddenMasterFilters.indexOf("description"), -1, "Returns shows description");
    assert.strictEqual(ReturnsSchema.hiddenMasterFilters.indexOf("returnType"), -1, "Returns shows returnType");
    var fnText = function (sPath) {
      return fetch(sap.ui.require.toUrl(sPath)).then(function (oResponse) {
        return oResponse.text();
      });
    };
    return Promise.all([fnText("cdc/vaccreq/view/Master.view.xml"), fnText("cdc/vaccreq/i18n/i18n.properties")]).then(function (aTexts) {
      var oDoc = new DOMParser().parseFromString(aTexts[0], "application/xml");
      var aItems = Array.prototype.slice.call(oDoc.getElementsByTagNameNS("*", "FilterGroupItem"));
      var aNames = aItems.map(function (oItem) {
        return oItem.getAttribute("name");
      });
      var iOrderType = aNames.indexOf("salesOrderType");
      assert.deepEqual(aNames.slice(iOrderType, iOrderType + 3), ["salesOrderType", "description", "returnType"],
        "directly after Sales Order Type, Description first");
      var oDescription = aItems[iOrderType + 1];
      var oReturnType = aItems[iOrderType + 2];
      [[oDescription, "{i18n>filterDescription}"], [oReturnType, "{i18n>filterReturnType}"]].forEach(function (aCase) {
        assert.strictEqual(aCase[0].getAttribute("groupName"), "default", aCase[1] + ": filter bar group");
        assert.strictEqual(aCase[0].getAttribute("visibleInFilterBar"), "true", aCase[1] + ": shown in the bar");
        assert.strictEqual(aCase[0].getAttribute("label"), aCase[1], aCase[1] + ": label");
      });
      var oInput = oDescription.getElementsByTagNameNS("*", "Input")[0];
      assert.ok(oInput && oInput.getAttribute("id") === "filterDescription", "Description: Input filterDescription");
      assert.notOk(oInput && oInput.hasAttribute("showValueHelp"), "Description: no value help");
      var oCombo = oReturnType.getElementsByTagNameNS("*", "ComboBox")[0];
      assert.ok(oCombo && oCombo.getAttribute("id") === "filterReturnType", "Return Type: ComboBox filterReturnType");
      assert.strictEqual(oCombo && oCombo.getAttribute("showClearIcon"), "true", "Return Type: clear icon");
      assert.ok(/^filterDescription=Description\r?$/m.test(aTexts[1]), "i18n filterDescription");
      assert.ok(/^filterReturnType=Return Type\r?$/m.test(aTexts[1]), "i18n filterReturnType");
    });
  });
});
