sap.ui.define([
  "sap/ui/core/library"
], function (coreLibrary) {
  "use strict";

  // GH-99: the Define Conditions tab of a sap.ui.comp ValueHelpDialog accepts
  // only values that exist in a value list (like the standard Manage Customer
  // Returns Sold-to Party value help): its value fields get the list as
  // type-ahead, a picked row is accepted, a typed value is looked up, and a
  // value that does not exist is cleared from the condition with an error on
  // the field. checkRanges() is the OK safety net for values that never passed
  // a value field (pasted rows, conditions restored from a variant).
  var ValueState = coreLibrary.ValueState;
  var PICKED = "conditionValuePicked";

  function normalize(vValue) {
    return vValue == null ? "" : String(vValue).trim();
  }

  // P13nConditionOperation keys; "Empty" has no value field.
  function rangeValues(oRange) {
    if (!oRange || oRange.operation === "Empty") {
      return [];
    }
    return (oRange.operation === "BT" ? [oRange.value1, oRange.value2] : [oRange.value1])
      .map(normalize)
      .filter(Boolean);
  }

  function unique(aValues) {
    return aValues.filter(function (sValue, iIndex) {
      return aValues.indexOf(sValue) === iIndex;
    });
  }

  /**
   * @param {object} oOptions
   * @param {function(string[]):Promise<Object<string,string>>} oOptions.lookup resolves value -> list key
   *   for the values that exist (the key may differ from the value, e.g. leading zeros); rejects on failure
   * @param {function(sap.m.Input):(function|undefined)} oOptions.configureInput adds the type-ahead to a
   *   value field; may return a function that removes it
   * @param {string[]} [oOptions.knownValues] keys already known to exist (picked from the list earlier)
   * @param {function(string):string} oOptions.notFoundText field error for a value that does not exist
   * @param {string} oOptions.checkFailedText field error when the lookup fails
   */
  function create(oOptions) {
    var mKnown = {};
    (oOptions.knownValues || []).map(normalize).filter(Boolean).forEach(function (sKey) {
      mKnown[sKey] = sKey;
    });

    function resolve(aValues) {
      var aMissing = unique(aValues.filter(function (sValue) {
        return !mKnown[sValue];
      }));
      if (!aMissing.length) {
        return Promise.resolve();
      }
      return oOptions.lookup(aMissing).then(function (mFound) {
        aMissing.forEach(function (sValue) {
          var sKey = mFound && mFound[sValue];
          if (sKey) {
            mKnown[sValue] = sKey;
            mKnown[sKey] = sKey;
          }
        });
      });
    }

    // The condition panel reads the field on "change": a programmatic value
    // needs setValue + fireChange to reach the condition.
    function setFieldValue(oInput, sValue) {
      oInput.setValue(sValue);
      oInput.fireChange({ value: sValue });
    }

    function isCurrent(oInput, sValue) {
      return !oInput.bIsDestroyed && normalize(oInput.getValue()) === sValue;
    }

    function checkField(oInput) {
      var sValue = normalize(oInput.getValue());
      var bPicked = oInput.data(PICKED);
      oInput.data(PICKED, null);
      if (!sValue) {
        return Promise.resolve();
      }
      if (bPicked) {
        mKnown[sValue] = sValue;
      }
      return resolve([sValue]).then(function () {
        if (!isCurrent(oInput, sValue)) {
          return;
        }
        var sKey = mKnown[sValue];
        if (!sKey) {
          // An empty value removes the condition; the rejected text stays visible in the error.
          setFieldValue(oInput, "");
          oInput.setValueState(ValueState.Error);
          oInput.setValueStateText(oOptions.notFoundText(sValue));
        } else if (sKey !== oInput.getValue()) {
          setFieldValue(oInput, sKey);
        }
      }, function () {
        if (isCurrent(oInput, sValue)) {
          oInput.setValueState(ValueState.Error);
          oInput.setValueStateText(oOptions.checkFailedText);
        }
      });
    }

    // ValueHelpDialog#suggest callback contract (sap.m.P13nConditionPanel): called for
    // every string value field the panel creates (again after an operator change); the
    // returned object's destroy() runs before the panel replaces the field.
    function provide(oInput) {
      var fnRemoveTypeAhead = oOptions.configureInput(oInput);
      var fnPicked = function () {
        oInput.data(PICKED, true);
      };
      var fnChange = function () {
        checkField(oInput);
      };
      // A row pick fires suggestionItemSelected, then sets the row's first cell (the key) and fires change.
      oInput.attachSuggestionItemSelected(fnPicked);
      oInput.attachChange(fnChange);
      // The panel fills a new field after this callback (restored condition, or the
      // previous field's text after an operator change) without firing change.
      Promise.resolve().then(function () {
        if (!oInput.bIsDestroyed) {
          checkField(oInput);
        }
      });
      return {
        destroy: function () {
          oInput.detachSuggestionItemSelected(fnPicked);
          oInput.detachChange(fnChange);
          if (typeof fnRemoveTypeAhead === "function") {
            fnRemoveTypeAhead();
          }
        }
      };
    }

    return {
      // ValueHelpDialog#suggest is not in the UI5 1.136 public API reference (it is what
      // SmartFilterBar's ValueHelpProvider uses); without it the fields stay plain and
      // only checkRanges() applies.
      attachTo: function (oDialog) {
        if (!oDialog || typeof oDialog.suggest !== "function") {
          return false;
        }
        oDialog.suggest(function (oInput) {
          return provide(oInput);
        });
        return true;
      },

      checkField: checkField,

      // Resolves { invalid: [values that do not exist], ranges: copies with list keys }; rejects when the lookup fails.
      checkRanges: function (aRanges) {
        var aValues = [];
        aRanges.forEach(function (oRange) {
          aValues = aValues.concat(rangeValues(oRange));
        });
        return resolve(aValues).then(function () {
          var fnKey = function (vValue) {
            return mKnown[normalize(vValue)] || vValue;
          };
          return {
            invalid: unique(aValues.filter(function (sValue) {
              return !mKnown[sValue];
            })),
            ranges: aRanges.map(function (oRange) {
              if (!rangeValues(oRange).length) {
                return oRange;
              }
              return Object.assign({}, oRange, {
                value1: fnKey(oRange.value1),
                value2: oRange.operation === "BT" ? fnKey(oRange.value2) : oRange.value2
              });
            })
          };
        });
      }
    };
  }

  return {
    create: create,
    rangeValues: rangeValues
  };
});
