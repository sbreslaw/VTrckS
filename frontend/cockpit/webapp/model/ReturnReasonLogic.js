// Return Reason interdependency logic (E008_Returns_ItemReturnReason_Session_Prompt §5.2)
// Pure functions for client-side header/item reason coordination — no UI5 controls,
// no context reads. Input: plain arrays/strings. Output: the new header reason code,
// or undefined if no change is needed.
//
// The three functions implement the documented rules:
// - Rule 2.1.1 (Item added, default): defaultForNewItem(sHeaderReason, aExistingItemReasons)
// - Rule 2.1.2 (Item changed) + Completion (a) (if equal, revert from G99):
//   headerAfterItemChange(aAllItemReasons)
// - Completion (b) (Item deleted): headerAfterItemDelete(aRemainingItemReasons, sCurrentHeader)
//
// G99 ("Multiple Values") is the only code that appears in this module; it is injected
// from ServiceSchema (never a literal) to keep it repo-searchable and centralized.
sap.ui.define([], function () {
  "use strict";

  return {
    // Rule 2.1.1: Item added — default ReasonCode for the new row.
    // Inputs:
    //   sHeaderReason: current header SDDocumentReason (string or null)
    //   aExistingItemReasons: array of ReasonCode strings from existing items (may be empty)
    // Returns:
    //   default ReasonCode for the new item, or null
    // Logic:
    //   - no items → use header value
    //   - items exist, header === G99 → use first item's value
    //   - items exist, header ≠ G99 → use header value
    defaultForNewItem: function (sHeaderReason, aExistingItemReasons) {
      if (!aExistingItemReasons || aExistingItemReasons.length === 0) {
        // First item → default = header value
        return sHeaderReason;
      }
      // Further items
      var oServiceSchema = sap.ui.require("cdc/vaccreq/model/ServiceSchema");
      var sG99 = oServiceSchema && oServiceSchema.headerProperties && oServiceSchema.headerProperties.orderReasonMultiple;
      if (sHeaderReason === sG99) {
        // Header is "Multiple Values" → default = first item's value
        return aExistingItemReasons[0];
      }
      // Header is a specific value → default = header value
      return sHeaderReason;
    },

    // Rule 2.1.2 (Item changed) + Completion (a): recompute header after any item's reason changes.
    // Inputs:
    //   aAllItemReasons: array of ReasonCode strings from ALL items (after the change)
    // Returns:
    //   new header SDDocumentReason, or undefined if no change needed
    // Logic:
    //   - one item → header = that item's value
    //   - all items equal → header = that common value (completion (a): revert from G99)
    //   - items differ → header = G99
    headerAfterItemChange: function (aAllItemReasons) {
      if (!aAllItemReasons || aAllItemReasons.length === 0) {
        // No items (shouldn't happen, but be safe)
        return undefined;
      }
      if (aAllItemReasons.length === 1) {
        // One item → header = that value
        return aAllItemReasons[0];
      }
      // Multiple items — check if all equal
      var sFirst = aAllItemReasons[0];
      var bAllEqual = aAllItemReasons.every(function (s) { return s === sFirst; });
      if (bAllEqual) {
        // All equal (completion (a): revert from G99)
        return sFirst;
      }
      // Items differ → header = G99
      var oServiceSchema = sap.ui.require("cdc/vaccreq/model/ServiceSchema");
      return oServiceSchema && oServiceSchema.headerProperties && oServiceSchema.headerProperties.orderReasonMultiple;
    },

    // Completion (b): recompute header after item deletion.
    // Inputs:
    //   aRemainingItemReasons: array of ReasonCode strings from items still in the order
    //   sCurrentHeader: current header SDDocumentReason (string or null)
    // Returns:
    //   new header SDDocumentReason, or undefined if no change needed
    // Logic:
    //   - no items → header unchanged
    //   - all remaining items equal → header = that common value
    //   - remaining items differ → header = G99
    headerAfterItemDelete: function (aRemainingItemReasons, sCurrentHeader) {
      if (!aRemainingItemReasons || aRemainingItemReasons.length === 0) {
        // No items left → header unchanged
        return undefined;
      }
      // Check if all remaining equal
      var sFirst = aRemainingItemReasons[0];
      var bAllEqual = aRemainingItemReasons.every(function (s) { return s === sFirst; });
      if (bAllEqual) {
        // All equal → header = that common value
        return sFirst;
      }
      // Items differ → header = G99
      var oServiceSchema = sap.ui.require("cdc/vaccreq/model/ServiceSchema");
      return oServiceSchema && oServiceSchema.headerProperties && oServiceSchema.headerProperties.orderReasonMultiple;
    }
  };
});
