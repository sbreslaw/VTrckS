// Single source of truth for "status code -> text" option lists (ADR-002
// issue ret-10-28 #3): both Master's filterStatus dropdown and Detail's
// Status field Select consume options through this one helper, driven by
// ServiceSchema.statusValueHelp (both profiles: po>/OrderStatus filtered by
// OrderType, 2026-11-09 remap - returns previously used its own default
// model's /OverallSDProcessStatus, unfiltered).
sap.ui.define([
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (Filter, FilterOperator) {
  "use strict";

  // aOrderTypes: used only when oStatusValueHelp.typeFilterProperty is set
  // (both profiles now); ignored when null. Resolves to [] (not a rejection)
  // on any request failure - callers already treat "no options" as non-fatal.
  function load(oComponent, oStatusValueHelp, aOrderTypes) {
    var oModel = oComponent.getModel(oStatusValueHelp.model || undefined);
    var aFilters = [];
    if (oStatusValueHelp.typeFilterProperty && aOrderTypes && aOrderTypes.length) {
      aFilters.push(new Filter({
        filters: aOrderTypes.map(function (sType) {
          return new Filter(oStatusValueHelp.typeFilterProperty, FilterOperator.EQ, sType);
        }),
        and: false
      }));
    }
    var oListBinding = oModel.bindList(
      "/" + oStatusValueHelp.entitySet, undefined, undefined, aFilters,
      { $select: [oStatusValueHelp.codeProperty, oStatusValueHelp.textProperty].join(",") }
    );
    return oListBinding.requestContexts(0, 200).then(function (aContexts) {
      var mSeen = {};
      return aContexts.reduce(function (aOptions, oContext) {
        var sCode = oContext.getProperty(oStatusValueHelp.codeProperty);
        if (mSeen[sCode]) {
          return aOptions;
        }
        mSeen[sCode] = true;
        var sText = oContext.getProperty(oStatusValueHelp.textProperty);
        aOptions.push({ key: sCode, text: sText ? sText : sCode });
        return aOptions;
      }, []);
    }).catch(function () {
      return [];
    });
  }

  return {
    load: load
  };
});
