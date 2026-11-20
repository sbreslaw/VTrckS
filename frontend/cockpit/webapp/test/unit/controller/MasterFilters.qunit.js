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
  "sap/ui/model/FilterOperator"
], function (ConditionValueCheck, ServiceSchema, OrdersSchema, ReturnsSchema, Input, MultiInput, P13nConditionPanel, Token,
  ValueHelpDialog, coreLibrary, FilterOperator) {
  "use strict";

  // GH-99: Provider (ID or Name) value help, Define Conditions tab - type-ahead from the
  // filter field's list and only list keys accepted.
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

  // ---- Master controller -------------------------------------------------------------------

  var sPreviousProfile;

  function loadMaster() {
    return new Promise(function (resolve, reject) {
      sap.ui.require(["cdc/vaccreq/controller/Master.controller"], resolve, reject);
    });
  }

  function stubMaster(Master, mControls, oModel) {
    var oStub = Object.create(Master.prototype);
    var oBundle = { getText: function (sKey, aArgs) { return sKey + (aArgs ? ":" + aArgs.join("|") : ""); } };
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

  QUnit.test("condition -> filter mapping is unchanged: Provider conditions stay on the Provider ID", function (assert) {
    return loadMaster().then(function (Master) {
      var sId = ServiceSchema.headerProperties.providerId;
      var oInput = new MultiInput();
      oInput.addToken(new Token({ text: "*40006524*" }).data("range",
        { exclude: false, operation: "Contains", value1: "40006524" }));
      oInput.addToken(new Token({ text: "!(=40029638)" }).data("range",
        { exclude: true, operation: "EQ", value1: "40029638" }));
      var oStub = stubMaster(Master, { filterProvider: oInput });
      var aFilters = [];
      oStub._pushConditionFilters(aFilters, "filterProvider");
      assert.strictEqual(aFilters.length, 2, "include group + exclude group");
      var oInclude = aFilters[0].getFilters()[0];
      var oExclude = aFilters[1].getFilters()[0];
      assert.strictEqual(oInclude.getPath(), sId, "contains on " + sId + " only");
      assert.strictEqual(oInclude.getOperator(), FilterOperator.Contains);
      assert.strictEqual(oExclude.getPath(), sId, "exclude on " + sId);
      assert.strictEqual(oExclude.getOperator(), FilterOperator.NE);
      oInput.destroy();
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
          return {
            requestContexts: function () {
              return Promise.resolve(mList[sValue] ? [{ getProperty: function () { return mList[sValue]; } }] : []);
            },
            destroy: function () {}
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
        notFoundKey: "providerConditionNotFound",
        invalidKey: "providerConditionsInvalid",
        checkFailedKey: "providerConditionCheckFailed"
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
