sap.ui.define([], function () {
  "use strict";

  // The OrderModeConfig mechanism (frontend/cockpit/webapp/model/OrderModeConfig.js),
  // reduced to what this app needs: a FIXED, always-applied four-type scope
  // (ADR-001 — this app serves returns only, no category/startup-parameter
  // resolution). `resolveType(sType)` lets an opened document apply its own
  // type's `ui` baseline (Detail.controller.js#_applyReturnUi) even though
  // every baseline here is still empty — add per-type differences to the
  // relevant entry's `ui` object as they are confirmed by functional, same
  // convention as the cockpit:
  //   kinds  - fields, fieldGroups, columns (Items table), sections (SectionConfig.js ids)
  //   flags  - visible, editable; both default to true when absent
  function baselineType(sReturnType, sTitleKey) {
    return {
      returnType: sReturnType,
      titleKey: sTitleKey,
      ui: { fields: {}, fieldGroups: {}, columns: {}, sections: {} }
    };
  }

  // Return types on this landscape (design/metadata/ui_customerreturnmanage_2026-10-26.xml,
  // CustomerReturnType entity set; VOV8-confirmed codes, prompt §2). ZCFR does
  // not exist — do not reintroduce it.
  var RETURN_TYPES = {
    ZISL: baselineType("ZISL", "returnTypeZisl"),
    ZXFR: baselineType("ZXFR", "returnTypeZxfr"),
    ZWST: baselineType("ZWST", "returnTypeZwst"),
    ZKR: baselineType("ZKR", "returnTypeZkr")
  };

  var RETURN_TYPE_ORDER = ["ZISL", "ZXFR", "ZWST", "ZKR"];

  function has(sKey) {
    return Object.prototype.hasOwnProperty.call(RETURN_TYPES, sKey);
  }

  function normalize(vValue) {
    var sValue = Array.isArray(vValue) ? vValue[0] : vValue;
    return typeof sValue === "string" ? sValue.trim().toUpperCase() : "";
  }

  // The fixed, always-applied scope — Master.controller.js#_getReturnTypeFilter
  // ORs this list into every list request, same rule as the cockpit's
  // _getOrderTypeFilter() (prompt §4.2 "type scope always applied").
  function getScopeReturnTypes() {
    return RETURN_TYPE_ORDER.slice();
  }

  // An opened document's own type resolves its `ui` baseline even if that
  // type falls outside the scope above (defensive — should not happen for a
  // document reachable from this app's own Master list).
  function resolveType(sReturnType) {
    var sKey = normalize(sReturnType);
    var oConfig = has(sKey) ? RETURN_TYPES[sKey] : RETURN_TYPES[RETURN_TYPE_ORDER[0]];
    return {
      returnType: oConfig.returnType,
      titleKey: oConfig.titleKey,
      ui: JSON.parse(JSON.stringify(oConfig.ui))
    };
  }

  function resolve() {
    return {
      titleKey: "appTitle",
      returnTypes: getScopeReturnTypes().map(resolveType)
    };
  }

  return {
    resolve: resolve,
    resolveType: resolveType,
    getScopeReturnTypes: getScopeReturnTypes
  };
});
