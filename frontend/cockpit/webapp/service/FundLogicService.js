sap.ui.define([
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/FundMapProvider"
], function (ServiceSchema, FundMapProvider) {
  "use strict";

  // Fund Split dialog session prompt, Step-0: the only place outside
  // FundMapProvider.js allowed to compare against a literal fund code (SPL),
  // and only via this one exported constant.
  var SPLIT_FUND_CODE = "SPL";

  // Issue Batch 9-30-001 §2/§3.2: the six per-fund-type quantity mirrors
  // (ZZ*QTY) are confirmed WRITTEN correctly into the sticky session's
  // transactional buffer (SaveChanges/the ZFM/000 split-total validation
  // both pass), but any in-session READ (the item create response itself,
  // or a later refresh) comes back from the DB projection instead of that
  // buffer and always shows 0 - a backend read-path defect (see
  // OPEN_QUESTIONS.md), not a write-path bug. This cache holds the LAST
  // value this client itself wrote for each of the six fields, keyed by the
  // row context's own path, so the row/Split dialog can keep showing the
  // real entered allocation across a create/PATCH/refresh response that
  // zeroes them out - purely a display-truth mitigation, never fixes the
  // backend read itself. Cleared on SaveChanges success (the post-commit
  // reload is then authoritative) and on Cancel/Discard - see
  // Detail.controller.js#_completeCreate/_destroyCreateContext.
  var ZZ_FIELDS = [
    ServiceSchema.itemProperties.vfcQty,
    ServiceSchema.itemProperties.stateQty,
    ServiceSchema.itemProperties.qty317,
    ServiceSchema.itemProperties.chipQty,
    ServiceSchema.itemProperties.panQty,
    ServiceSchema.itemProperties.resQty
  ];
  var mAllocationCache = {};

  function snapshotZzFields(oRowContext) {
    var oSnapshot = {};
    ZZ_FIELDS.forEach(function (sField) {
      oSnapshot[sField] = oRowContext.getProperty(sField);
    });
    return oSnapshot;
  }

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
      this.cacheAllocation(oRowContext);
    },

    // Snapshots the row's own six ZZ*QTY fields RIGHT NOW (setProperty already
    // applied its value to the binding's local cache synchronously, before
    // any server round trip) - call immediately after writing any of them
    // (onProdQtyChange/onFundTypeChange/commitSplit above).
    cacheAllocation: function (oRowContext) {
      if (!oRowContext) {
        return;
      }
      mAllocationCache[oRowContext.getPath()] = snapshotZzFields(oRowContext);
    },

    // Returns the last-cached snapshot for this row (or null) - used to carry
    // an allocation across the one-time scratch-context -> real-session-
    // context switch (Detail.controller.js#_postFirstItemRow), where the new
    // context's own path never matches the old scratch path.
    getSnapshot: function (oRowContext) {
      return (oRowContext && mAllocationCache[oRowContext.getPath()]) || null;
    },

    // Re-applies a given snapshot (own or transferred from another row) onto
    // this context's six ZZ*QTY fields and re-caches it under THIS context's
    // own path - a no-op (no network traffic) for any field already at that
    // value; only actually re-PATCHes the fields the last response zeroed out.
    applySnapshot: function (oRowContext, oSnapshot) {
      if (!oRowContext || !oSnapshot) {
        return Promise.resolve();
      }
      var aPending = ZZ_FIELDS
        .filter(function (sField) { return oSnapshot[sField] !== undefined; })
        .map(function (sField) { return oRowContext.setProperty(sField, oSnapshot[sField]); });
      mAllocationCache[oRowContext.getPath()] = oSnapshot;
      return Promise.all(aPending);
    },

    // Convenience: re-apply THIS row's own previously-cached snapshot (by its
    // current path) - the common case after a create/PATCH/refresh response
    // has just zeroed the fields back out. No-op if nothing was ever cached
    // for this path.
    reapplyAllocation: function (oRowContext) {
      return this.applySnapshot(oRowContext, this.getSnapshot(oRowContext));
    },

    clearAllocationCache: function () {
      mAllocationCache = {};
    }
  };
});
