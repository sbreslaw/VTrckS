sap.ui.define([], function () {
  "use strict";

  // Fund Split dialog session prompt, Step-0: INTERIM fund mapping table (no
  // real VH/provider service for this exists yet). This is the ONE file in
  // the app allowed to contain fund-code literals (VFC/317/S/L/CHP/SPL/PAN/
  // ARR/N/A) - FundLogicService.js/Detail.controller.js/Items.fragment.xml
  // must only ever compare against the constant this module exports, never a
  // fund literal of their own (grep-enforced). Shape per the fund-session
  // contract: FundCode, FundText, TargetFieldName, IsAllocatable, IsEligible,
  // SortOrder. When a real VH/provider service ships, replace this table's
  // internals only - the getFundMap/getAllocatableEligible API should not
  // need to change.
  var FUND_MAP = [
    { FundCode: "VFC", i18nKey: "enumFundTypeVfc", TargetFieldName: "ZZVFCQTY", IsAllocatable: true, PediatricOnly: true, SortOrder: 10 },
    { FundCode: "317", i18nKey: "enumFundType317", TargetFieldName: "ZZ317QTY", IsAllocatable: true, PediatricOnly: false, SortOrder: 20 },
    { FundCode: "S/L", i18nKey: "enumFundTypeState", TargetFieldName: "ZZSTATEQTY", IsAllocatable: true, PediatricOnly: false, SortOrder: 30 },
    { FundCode: "CHP", i18nKey: "enumFundTypeChip", TargetFieldName: "ZZCHIPQTY", IsAllocatable: true, PediatricOnly: true, SortOrder: 40 },
    { FundCode: "SPL", i18nKey: "enumFundTypeSplit", TargetFieldName: "", IsAllocatable: false, PediatricOnly: false, SortOrder: 50 },
    { FundCode: "PAN", i18nKey: "enumFundTypePan", TargetFieldName: "ZZPANQTY", IsAllocatable: true, PediatricOnly: false, SortOrder: 60 },
    { FundCode: "ARR", i18nKey: "enumFundTypeArr", TargetFieldName: "ZZRESQTY", IsAllocatable: true, PediatricOnly: false, SortOrder: 70 },
    { FundCode: "N/A", i18nKey: "enumFundTypeNa", TargetFieldName: "ZZRESQTY", IsAllocatable: false, PediatricOnly: false, SortOrder: 80 }
  ];

  // Real MaterialGroup1 codes containing a Pediatric component (client-
  // confirmed 2026-09-16, see Detail.controller.js/Items.fragment.xml) - the
  // only eligibility rule this interim table knows about (VFC/CHP).
  var PEDIATRIC_INTENTS = ["PED", "MIX"];

  function isEligible(oEntry, sMaterialGroup1) {
    // sMaterial is accepted by the public API for a future per-material rule
    // (real VH/provider service) - unused by this interim table, which only
    // gates on order intention.
    return !oEntry.PediatricOnly || PEDIATRIC_INTENTS.indexOf(sMaterialGroup1) !== -1;
  }

  return {
    // Every mapping entry resolved for the given row, sorted by SortOrder.
    getFundMap: function (oBundle, sMaterial, sMaterialGroup1) {
      return FUND_MAP.map(function (oEntry) {
        return {
          FundCode: oEntry.FundCode,
          FundText: oBundle.getText(oEntry.i18nKey),
          TargetFieldName: oEntry.TargetFieldName,
          IsAllocatable: oEntry.IsAllocatable,
          IsEligible: isEligible(oEntry, sMaterialGroup1),
          SortOrder: oEntry.SortOrder
        };
      }).sort(function (a, b) { return a.SortOrder - b.SortOrder; });
    },

    // Convenience: only the rows the Fund Split dialog table should ever
    // render (IsAllocatable && IsEligible for this row's Material/Intent).
    getAllocatableEligible: function (oBundle, sMaterial, sMaterialGroup1) {
      return this.getFundMap(oBundle, sMaterial, sMaterialGroup1).filter(function (oRow) {
        return oRow.IsAllocatable && oRow.IsEligible;
      });
    }
  };
});
