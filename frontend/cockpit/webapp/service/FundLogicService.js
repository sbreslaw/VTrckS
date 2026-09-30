sap.ui.define([
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/FundMapProvider"
], function (ServiceSchema, FundMapProvider) {
  "use strict";

  // Fund Split dialog session prompt, Step-0: the only place outside
  // FundMapProvider.js allowed to compare against a literal fund code (SPL),
  // and only via this one exported constant.
  var SPLIT_FUND_CODE = "SPL";

  // vRow: an item row's Context, a plain object keyed by ServiceSchema
  // property names, or the raw MaterialGroup2 code string itself.
  function resolveFundCode(vRow) {
    if (!vRow) {
      return "";
    }
    if (typeof vRow === "string") {
      return vRow;
    }
    if (typeof vRow.getProperty === "function") {
      return vRow.getProperty(ServiceSchema.itemProperties.fundType) || "";
    }
    return vRow[ServiceSchema.itemProperties.fundType] || "";
  }

  return {
    isSplitFund: function (vRow) {
      return resolveFundCode(vRow) === SPLIT_FUND_CODE;
    },

    // Rows the Fund Split dialog table should render for this item -
    // FundMapProvider's IsAllocatable && IsEligible entries, SortOrder'd.
    getAllocatableOptions: function (oBundle, sMaterial, sMaterialGroup1) {
      return FundMapProvider.getAllocatableEligible(oBundle, sMaterial, sMaterialGroup1);
    },

    // Builds the dialog's working-copy rows from the row context's CURRENT
    // ZZ.. values - one entry per eligible option.
    readAllocation: function (oRowContext, aOptions) {
      return aOptions.map(function (oOption) {
        var vQty = oOption.TargetFieldName ? oRowContext.getProperty(oOption.TargetFieldName) : 0;
        var iQty = parseInt(vQty, 10);
        return {
          FundCode: oOption.FundCode,
          FundText: oOption.FundText,
          TargetFieldName: oOption.TargetFieldName,
          Quantity: isNaN(iQty) ? 0 : iQty
        };
      });
    },

    // Writes every working-row Quantity (zeros included - the ZZ.. fields are
    // Edm.Int32 Nullable="false") back onto the row context's own
    // TargetFieldName - the only commit path for the dialog's "Done".
    commitSplit: function (oRowContext, aWorkingRows) {
      aWorkingRows.forEach(function (oRow) {
        if (oRow.TargetFieldName) {
          oRowContext.setProperty(oRow.TargetFieldName, oRow.Quantity || 0);
        }
      });
    }
  };
});
