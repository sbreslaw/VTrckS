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
  // Live-test, 2026-10-01: the backend's own first-item POST can ALSO return
  // an adjusted RequestedQuantity (e.g. 1 -> 10, a pack-size/minimum-order
  // rule) - a snapshot taken before that adjustment must be rescaled to the
  // new total before being restored, or the allocation silently stays stuck
  // at the pre-adjustment number (surfaces later as the backend's own
  // "Total Split Qty does not match the Order Qty" validation). Stashed
  // alongside the six ZZ fields under this key, not in ZZ_FIELDS itself.
  var QUANTITY_FIELD = ServiceSchema.itemProperties.quantity;
  var mAllocationCache = {};

  function snapshotZzFields(oRowContext) {
    var oSnapshot = {};
    ZZ_FIELDS.forEach(function (sField) {
      oSnapshot[sField] = oRowContext.getProperty(sField);
    });
    oSnapshot[QUANTITY_FIELD] = parseFloat(oRowContext.getProperty(QUANTITY_FIELD)) || 0;
    return oSnapshot;
  }

  // Proportionally rescales every nonzero ZZ field in a snapshot to a NEW
  // RequestedQuantity total - a single-fund (one nonzero field) snapshot
  // simply becomes the new total; a split snapshot keeps its relative
  // proportions. The last nonzero field absorbs the rounding remainder so
  // the fields still sum EXACTLY to the new quantity (the backend's own
  // split-total validation requires an exact match). No-op if there's
  // nothing to rescale from/to.
  function rescaleSnapshot(oSnapshot, fNewQty) {
    var fOldQty = oSnapshot[QUANTITY_FIELD];
    if (!fOldQty || !fNewQty || fOldQty === fNewQty) {
      return oSnapshot;
    }
    var aNonZeroFields = ZZ_FIELDS.filter(function (sField) { return oSnapshot[sField]; });
    if (!aNonZeroFields.length) {
      return oSnapshot;
    }
    var oResult = Object.assign({}, oSnapshot);
    var iRunningTotal = 0;
    aNonZeroFields.forEach(function (sField, iIndex) {
      if (iIndex === aNonZeroFields.length - 1) {
        oResult[sField] = fNewQty - iRunningTotal;
      } else {
        var iScaled = Math.round(oSnapshot[sField] * fNewQty / fOldQty);
        oResult[sField] = iScaled;
        iRunningTotal += iScaled;
      }
    });
    oResult[QUANTITY_FIELD] = fNewQty;
    return oResult;
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
    // this context's six ZZ*QTY fields and re-caches the result under THIS
    // context's own path. Live-test follow-up: must NOT blindly overwrite
    // every field - a field the backend returns as a real, non-zero value
    // (e.g. a legitimate server-side quantity recalculation, confirmed live:
    // entered 10 -> backend adjusted to 140, mirror recalculated to match)
    // is authoritative and would otherwise get stomped back down to the
    // stale client-entered number; only a field the backend genuinely
    // echoed back as 0 (the known read-path defect) is restored from the
    // snapshot. Any authoritative non-zero value also updates the cache, so
    // a LATER echo-zero doesn't revert to a now-stale pre-recalculation
    // number. getProperty (unlike setProperty) throws "invalid segment" if
    // this field was never part of THIS context's own request - true right
    // after _postFirstItemRow's postItem, whose create response only
    // selects SAP__Messages - so a throw here must be treated the same as
    // "unreadable/unknown", not as "confirmed 0".
    applySnapshot: function (oRowContext, oSnapshot) {
      if (!oRowContext || !oSnapshot) {
        return Promise.resolve();
      }
      var fCurrentQty = parseFloat(oRowContext.getProperty(QUANTITY_FIELD)) || 0;
      var oEffectiveSnapshot = rescaleSnapshot(oSnapshot, fCurrentQty);
      var oNewSnapshot = {};
      var aPending = [];
      ZZ_FIELDS.forEach(function (sField) {
        var iCurrent;
        try {
          iCurrent = parseInt(oRowContext.getProperty(sField), 10);
        } catch (oError) {
          iCurrent = NaN;
        }
        if (!isNaN(iCurrent) && iCurrent !== 0) {
          oNewSnapshot[sField] = iCurrent;
        } else if (oEffectiveSnapshot[sField]) {
          aPending.push(oRowContext.setProperty(sField, oEffectiveSnapshot[sField]));
          oNewSnapshot[sField] = oEffectiveSnapshot[sField];
        } else {
          oNewSnapshot[sField] = 0;
        }
      });
      oNewSnapshot[QUANTITY_FIELD] = fCurrentQty;
      mAllocationCache[oRowContext.getPath()] = oNewSnapshot;
      return Promise.all(aPending);
    },

    // Carries a snapshot from an OLD row context onto a brand-new one's own
    // cache key (Detail.controller.js#_postFirstItemRow, right after
    // postItem) - cache move only, no setProperty: that new context's own
    // request only ever selected SAP__Messages, so neither a read (would log
    // "invalid segment", even wrapped in try/catch - the _Cache layer logs
    // the drill-down failure as a side effect of computing the rejected
    // promise, before the rejection reaches application code) nor a same-
    // tick write here is ever user-visible anyway (the Items table stays on
    // the OLD scratch row until _bindItemsTableToSession's dataReceived
    // switches it). Live-test, 2026-10-01: a same-tick write here was also
    // actively WRONG whenever the backend's create response adjusted
    // RequestedQuantity (e.g. 1 -> 10) - it could only ever replay the
    // stale pre-adjustment numbers, since this context can't read the new
    // quantity back to rescale against. Just move the cache entry so the
    // very next _reapplyFundAllocations (applySnapshot) - which DOES have
    // the real, now-fetched row, quantity included - finds it under the new
    // path and does the one real, rescale-aware restore.
    transferSnapshot: function (oNewRowContext, oSnapshot) {
      if (!oNewRowContext || !oSnapshot) {
        return;
      }
      mAllocationCache[oNewRowContext.getPath()] = oSnapshot;
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
    },

    // Live-test (9-30-001 follow-up): these six fields are never bound to
    // any Items table control, so autoExpandSelect never includes them in
    // the _Item list's own $select on its own - Detail.controller.js's
    // _rebindItemsGroup must force them in explicitly, or the getProperty()
    // calls above throw "invalid segment" (confirmed live).
    ZZ_FIELDS: ZZ_FIELDS
  };
});
