sap.ui.define([
  "sap/base/Log",
  "cdc/vaccreq/sections/SectionCatalog",
  "cdc/vaccreq/model/OrderModeConfig"
], function (Log, SectionCatalog, OrderModeConfig) {
  "use strict";

  // Sections Catalog & Personalization PR2 (prompts/
  // E008_SectionsCatalog_Personalization_Session_Prompt.md §4.3). Single,
  // pure, synchronous place that merges three layers into the ORDERED,
  // ready-to-render panel list SectionFactory.rebuild()/Detail.controller.js
  // consume directly:
  //   1. SectionCatalog.js — structural facts (fragment, editLive, ...), PR1.
  //   2. OrderModeConfig.resolveSections() — per-order-type/mode baseline
  //      (visible/editable/locked/expanded), UNCHANGED from PR1.
  //   3. personalization value (VariantStore "detailSections.<orderType>",
  //      `{version:1, sections:[{id, expanded, title}]}`) — per-user
  //      order/membership/expanded/title override. Never overrides `editable`
  //      (catalog- and baseline-level) at all — the dialog does not offer
  //      that choice and this resolver does not either.
  //
  // "Offerable" (can a user include this section at all) is governed ONLY by
  // SectionCatalog's `profiles`/`createCapable` — a TECHNICAL capability
  // (fragment/service-data exists for this profile) — never by
  // OrderModeConfig's `locked`/`visible`, which is a BUSINESS default-display
  // decision that personalization is explicitly meant to let the user
  // override (e.g. Returns' priceTotals: profile-safe but locked-hidden by
  // default — user confirmed request 2026-11-06 must still be offerable,
  // unchecked, in the dialog). A section the user explicitly includes is
  // always rendered visible regardless of its baseline default.
  //
  // Returns an array covering EVERY SectionCatalog id (same invariant as PR1's
  // resolveSections) so SectionFactory/sectionFlags/sectionsNav always have a
  // stable set of ids to reference — personalization only changes ORDER and
  // each entry's `visible`/`expanded`/`title`, never which ids structurally
  // exist. Ids the user excluded (or that are new since their personalization
  // was saved, or not offerable at all) are appended at the end, hidden
  // (`visible:false`), so Detail.controller.js needs exactly one mechanism
  // (orderUi>/sections/<id>/visible) for every "don't show this panel" reason.
  //
  // Caller owns loading the personalization value asynchronously
  // (VariantStore.loadAsync) and passes the already-resolved object in —
  // this function does no I/O.
  function isOfferable(sId, sMode, sProfileId) {
    var oCatalogEntry = SectionCatalog.get(sId);
    if (!oCatalogEntry || oCatalogEntry.profiles.indexOf(sProfileId) === -1) {
      return false;
    }
    return sMode !== "create" || oCatalogEntry.createCapable !== false;
  }

  // `oOptions` (all optional): `title`, `expanded`, `visible` — undefined
  // falls back to the baseline's own value for `expanded`/`visible`
  // (the plain "nothing personalized yet" case); personalized callers below
  // always pass an explicit `visible` (true for included, false for
  // excluded/appended-tail) so baseline's default-display decision never
  // silently overrides an explicit user inclusion/exclusion choice.
  function buildEntry(oBaselineById, sId, oOptions) {
    var oCatalogEntry = SectionCatalog.get(sId);
    var oBase = oBaselineById[sId];
    var oOpt = oOptions || {};
    return {
      id: sId,
      titleKey: oCatalogEntry.titleKey,
      title: oOpt.title || null,
      fragment: oCatalogEntry.fragment,
      editable: oCatalogEntry.editable,
      editLive: oCatalogEntry.editLive,
      headerAction: oCatalogEntry.headerAction,
      extraHeaderButtons: oCatalogEntry.extraHeaderButtons,
      createCapable: oCatalogEntry.createCapable !== false,
      // Baseline's own "show the Edit button" runtime flag — never affected
      // by personalization. Named distinctly from the catalog's static
      // `editable` capability flag above to avoid the two being confused.
      editVisible: oBase.editable,
      expanded: oOpt.expanded !== undefined ? oOpt.expanded : oBase.expanded,
      visible: oOpt.visible !== undefined ? oOpt.visible : oBase.visible
    };
  }

  function baselineOnly(oBaselineById) {
    // No personalization to exclude anything — every catalog id is
    // "included"; visible/expanded follow the baseline directly.
    return SectionCatalog.all().map(function (oCatalogEntry) {
      return buildEntry(oBaselineById, oCatalogEntry.id);
    });
  }

  function resolve(oArgs) {
    var sType = oArgs.type;
    var sMode = oArgs.mode;
    var sProfileId = oArgs.profileId;
    var oPersonalization = oArgs.personalization;

    var aBaseline = OrderModeConfig.resolveSections(sType, sMode);
    var oBaselineById = {};
    aBaseline.forEach(function (oEntry) { oBaselineById[oEntry.id] = oEntry; });

    var aPersonalizedSections = (oPersonalization && oPersonalization.sections) || [];
    if (!aPersonalizedSections.length) {
      return baselineOnly(oBaselineById);
    }

    var aValid = aPersonalizedSections.filter(function (oEntry) {
      var bOk = SectionCatalog.get(oEntry.id) && isOfferable(oEntry.id, sMode, sProfileId);
      if (!bOk) {
        Log.info("SectionResolver: dropping stale/unofferable personalized section id '" + oEntry.id + "' for " + sType + "/" + sMode);
      }
      return bOk;
    });

    if (!aValid.length) {
      Log.warning("SectionResolver: personalization for " + sType + " had no valid sections after filtering — falling back to baseline order");
      return baselineOnly(oBaselineById);
    }

    var oIncludedSet = {};
    var aResult = aValid.map(function (oEntry) {
      oIncludedSet[oEntry.id] = true;
      return buildEntry(oBaselineById, oEntry.id, { title: oEntry.title, expanded: !!oEntry.expanded, visible: true });
    });

    SectionCatalog.all().forEach(function (oCatalogEntry) {
      if (!oIncludedSet[oCatalogEntry.id]) {
        aResult.push(buildEntry(oBaselineById, oCatalogEntry.id, { visible: false }));
      }
    });

    return aResult;
  }

  return {
    resolve: resolve
  };
});
