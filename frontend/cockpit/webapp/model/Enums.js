sap.ui.define([], function () {
  "use strict";

  // CRUD Task 1 (Create New Provider Order, design/NEwVaccReq.md) enum lists.
  // Keys are placeholders pending backend value-help/config confirmation —
  // texts are resolved from i18n keys by the caller, never hardcoded here.

  // TODO: replace with backend value help; keys pending config confirmation
  var PRIORITY = [
    { key: "NORMAL", i18nKey: "enumPriorityNormal" },
    { key: "HIGH", i18nKey: "enumPriorityHigh" }
  ];

  // TODO: replace with backend value help; keys pending config confirmation
  var ORDER_REASON = [
    { key: "NATURAL_DISASTER", i18nKey: "enumOrderReasonNaturalDisaster" },
    { key: "OUTBREAK_RESPONSE", i18nKey: "enumOrderReasonOutbreakResponse" },
    { key: "OTHER", i18nKey: "enumOrderReasonOther" }
  ];

  // TODO: replace with backend value help; keys pending config confirmation
  var CATEGORY = [
    { key: "INTERNET_SALES", i18nKey: "enumCategoryInternetSales" },
    { key: "PROVIDER_EMAILED", i18nKey: "enumCategoryProviderEmailed" },
    { key: "PROVIDER_FAXED", i18nKey: "enumCategoryProviderFaxed" },
    { key: "PROVIDER_TELEPHONED", i18nKey: "enumCategoryProviderTelephoned" },
    { key: "VACMAN", i18nKey: "enumCategoryVacman" }
  ];

  // TODO: replace with backend value help; keys pending config confirmation
  // (MVGR1 mapping — see design/NEwVaccReq.md backend dependency #4)
  var INTENTION = [
    { key: "ADULT", i18nKey: "enumIntentionAdult" },
    { key: "PED_AND_ADULT", i18nKey: "enumIntentionPedAndAdult" },
    { key: "PEDIATRIC", i18nKey: "enumIntentionPediatric" }
  ];

  return {
    PRIORITY: PRIORITY,
    ORDER_REASON: ORDER_REASON,
    CATEGORY: CATEGORY,
    INTENTION: INTENTION,
    INTENTION_DEFAULT: "PED_AND_ADULT",
    MIN_ITEMS: 1
  };
});
