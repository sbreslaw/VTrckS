sap.ui.define([], function () {
  "use strict";

  // CRUD Task 1 (Create New Provider Order, design/NEwVaccReq.md) enum lists.
  // Keys are placeholders pending backend value-help/config confirmation —
  // texts are resolved from i18n keys by the caller, never hardcoded here.

  // Session Prompt (Detail View Adjustments) 3.1/3.2: PRIORITY and CATEGORY
  // hardcoded enum lists DELETED - both fields are now backed by real
  // service value helps (DeliveryPriority entity set / CustomerPurchaseOrderType
  // entity set, see ServiceSchema.js) instead of local placeholder lists. See
  // NOTES.md for the retirement entry.

  // TODO: replace with backend value help; keys pending config confirmation
  var ORDER_REASON = [
    { key: "NATURAL_DISASTER", i18nKey: "enumOrderReasonNaturalDisaster" },
    { key: "OUTBREAK_RESPONSE", i18nKey: "enumOrderReasonOutbreakResponse" },
    { key: "OTHER", i18nKey: "enumOrderReasonOther" }
  ];

  // TODO: replace with backend value help; keys pending config confirmation
  // (MVGR1 mapping — see design/NEwVaccReq.md backend dependency #4)
  var INTENTION = [
    { key: "ADULT", i18nKey: "enumIntentionAdult" },
    { key: "PED_AND_ADULT", i18nKey: "enumIntentionPedAndAdult" },
    { key: "PEDIATRIC", i18nKey: "enumIntentionPediatric" }
  ];

  // CRUD Task 1 v4 (Create Order field adjustments): hardcoded Status list for
  // the createMode Select in Details.fragment.xml - VH is TBD, keys/texts as
  // given in the work order.
  var STATUS = [
    { key: "1A", i18nKey: "enumStatus1A" },
    { key: "1B", i18nKey: "enumStatus1B" },
    { key: "1E", i18nKey: "enumStatus1E" },
    { key: "1F", i18nKey: "enumStatus1F" }
  ];

  // Client requirement (2026-08-31, VBAP-MVGR2/MaterialGroup2 - Items.fragment.xml
  // Fund Type column). Codes confirmed by the client (2026-08-31) - real
  // MaterialGroup2 domain values, all fit the Edm.String MaxLength=3
  // (design/so.xml/metadata.xml).
  var FUND_TYPE = [
    { key: "VFC", i18nKey: "enumFundTypeVfc" },
    { key: "317", i18nKey: "enumFundType317" },
    { key: "S/L", i18nKey: "enumFundTypeState" },
    { key: "CHP", i18nKey: "enumFundTypeChip" },
    { key: "SPL", i18nKey: "enumFundTypeSplit" },
    { key: "PAN", i18nKey: "enumFundTypePan" },
    { key: "ARR", i18nKey: "enumFundTypeArr" },
    { key: "N/A", i18nKey: "enumFundTypeNa" }
  ];

  // Which FUND_TYPE keys are selectable per Order Intention (MaterialGroup1) -
  // Adult is a strict subset of Pediatric, so the combined "AdultPediatric"
  // intention uses the Pediatric set. ARR/N/A/PAN are intentionally NOT gated
  // by intention - no business rule was given for them (PAN's own auto-default
  // source, the NDC's Pan indicator from Material Master, is not exposed by
  // this service yet).
  // Real MVGR1 codes (2026-09-16 client confirmation): ADU/PED/MIX.
  var FUND_TYPE_BY_INTENTION = {
    ADU: ["317", "S/L", "SPL"],
    PED: ["VFC", "317", "S/L", "CHP", "SPL"],
    MIX: ["VFC", "317", "S/L", "CHP", "SPL"]
  };

  return {
    ORDER_REASON: ORDER_REASON,
    INTENTION: INTENTION,
    STATUS: STATUS,
    FUND_TYPE: FUND_TYPE,
    FUND_TYPE_BY_INTENTION: FUND_TYPE_BY_INTENTION,
    INTENTION_DEFAULT: "PED_AND_ADULT",
    MIN_ITEMS: 1
  };
});
