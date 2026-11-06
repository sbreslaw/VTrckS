/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/sections/SectionResolver",
  "cdc/vaccreq/sections/SectionCatalog",
  "cdc/vaccreq/model/OrderModeConfig"
], function (SectionResolver, SectionCatalog, OrderModeConfig) {
  "use strict";

  // Sections Catalog & Personalization PR2 (prompts/
  // E008_SectionsCatalog_Personalization_Session_Prompt.md) — DoD: unit
  // tests for SectionResolver.resolve (baseline-only, valid reorder,
  // stale-id-dropped-with-fallback, all-ids-dropped-fallback, profile
  // gating, and the 2026-11-06 user-confirmed "profile-safe but
  // business-locked-hidden section must still be offerable" fix).

  QUnit.module("SectionResolver.resolve");

  function idsOf(aResolved) {
    return aResolved.map(function (o) { return o.id; });
  }

  QUnit.test("no personalization: matches OrderModeConfig.resolveSections directly (baseline-only)", function (assert) {
    var aBaseline = OrderModeConfig.resolveSections("ZKB", "display");
    var aResolved = SectionResolver.resolve({ type: "ZKB", mode: "display", profileId: "orders", personalization: null });

    assert.strictEqual(aResolved.length, SectionCatalog.all().length, "one entry per catalog section");
    assert.deepEqual(idsOf(aResolved), SectionCatalog.all().map(function (o) { return o.id; }), "catalog order preserved");
    aResolved.forEach(function (oResolved, i) {
      assert.strictEqual(oResolved.visible, aBaseline[i].visible, oResolved.id + " visible matches baseline");
      assert.strictEqual(oResolved.expanded, aBaseline[i].expanded, oResolved.id + " expanded matches baseline");
      assert.strictEqual(oResolved.title, null, oResolved.id + " no custom title");
    });
  });

  QUnit.test("empty personalization.sections array behaves the same as null (baseline-only)", function (assert) {
    var aResolved = SectionResolver.resolve({ type: "ZKB", mode: "display", profileId: "orders", personalization: { version: 1, sections: [] } });
    assert.deepEqual(idsOf(aResolved), SectionCatalog.all().map(function (o) { return o.id; }));
  });

  QUnit.test("valid personalization: reorders included ids, applies custom title/expanded, forces visible true", function (assert) {
    var oPersonalization = {
      version: 1,
      sections: [
        { id: "items", title: "My Items", expanded: true },
        { id: "details", expanded: false }
      ]
    };
    var aResolved = SectionResolver.resolve({ type: "ZKB", mode: "display", profileId: "orders", personalization: oPersonalization });

    assert.strictEqual(aResolved[0].id, "items", "items first (personalized order)");
    assert.strictEqual(aResolved[0].title, "My Items", "custom title applied");
    assert.strictEqual(aResolved[0].expanded, true, "expanded override applied");
    assert.strictEqual(aResolved[0].visible, true, "included section forced visible");

    assert.strictEqual(aResolved[1].id, "details", "details second (personalized order)");
    assert.strictEqual(aResolved[1].title, null, "no custom title given -> null, not baseline titleKey");
    assert.strictEqual(aResolved[1].expanded, false, "expanded override applied even though baseline expands details");

    assert.strictEqual(aResolved.length, SectionCatalog.all().length, "every catalog id still present");
    var aExcludedTail = aResolved.slice(2);
    aExcludedTail.forEach(function (o) {
      assert.strictEqual(o.visible, false, o.id + " excluded section appended hidden");
    });
  });

  QUnit.test("stale/unknown personalized id is dropped; remaining valid ids still apply", function (assert) {
    var oPersonalization = { version: 1, sections: [{ id: "doesNotExist" }, { id: "items", expanded: true }] };
    var aResolved = SectionResolver.resolve({ type: "ZKB", mode: "display", profileId: "orders", personalization: oPersonalization });

    assert.strictEqual(aResolved[0].id, "items", "the one valid id still applied first");
    assert.strictEqual(aResolved[0].expanded, true);
    assert.strictEqual(aResolved.length, SectionCatalog.all().length);
  });

  QUnit.test("all personalized ids invalid: falls back to baseline order entirely", function (assert) {
    var oPersonalization = { version: 1, sections: [{ id: "doesNotExist" }, { id: "alsoNotReal" }] };
    var aResolved = SectionResolver.resolve({ type: "ZKB", mode: "display", profileId: "orders", personalization: oPersonalization });
    assert.deepEqual(idsOf(aResolved), SectionCatalog.all().map(function (o) { return o.id; }), "same order as baselineOnly");
  });

  QUnit.test("profile gating: a personalized id not offerable for this profile is dropped like a stale id", function (assert) {
    // "inventory" is orders-only (SectionCatalog profiles: ["orders"]).
    var oPersonalization = { version: 1, sections: [{ id: "inventory" }, { id: "details" }] };
    var aResolved = SectionResolver.resolve({ type: "ZISL", mode: "display", profileId: "returns", personalization: oPersonalization });

    assert.strictEqual(aResolved[0].id, "details", "inventory dropped (not offerable for returns), details kept");
    var oInventory = aResolved.filter(function (o) { return o.id === "inventory"; })[0];
    assert.strictEqual(oInventory.visible, false, "inventory still present (catalog invariant) but hidden");
  });

  QUnit.test("profile gating in create mode: a non-createCapable id is dropped even if profile-safe", function (assert) {
    // partiesInvolved: profiles ["orders"], createCapable:false.
    var oPersonalization = { version: 1, sections: [{ id: "partiesInvolved" }, { id: "details" }] };
    var aResolved = SectionResolver.resolve({ type: "ZKB", mode: "create", profileId: "orders", personalization: oPersonalization });
    assert.strictEqual(aResolved[0].id, "details", "partiesInvolved dropped in create mode (createCapable:false)");
  });

  QUnit.test("2026-11-06 fix: a profile-safe but business-locked-hidden section (priceTotals on a _RET type) is offerable and becomes visible when explicitly included", function (assert) {
    var aBaseline = OrderModeConfig.resolveSections("ZISL", "display");
    var oBaselinePriceTotals = aBaseline.filter(function (o) { return o.id === "priceTotals"; })[0];
    assert.strictEqual(oBaselinePriceTotals.visible, false, "precondition: priceTotals is business-hidden by default for ZISL");

    var oPersonalization = { version: 1, sections: [{ id: "priceTotals" }] };
    var aResolved = SectionResolver.resolve({ type: "ZISL", mode: "display", profileId: "returns", personalization: oPersonalization });
    var oResolvedPriceTotals = aResolved.filter(function (o) { return o.id === "priceTotals"; })[0];
    assert.strictEqual(oResolvedPriceTotals.visible, true, "explicitly included priceTotals is visible despite locked-hidden baseline");
  });

  QUnit.test("excluded id always appended hidden, even when its baseline default is visible", function (assert) {
    // "details" defaults visible:true for ZKB; explicitly excluding it (by
    // omitting it from personalization.sections) must still hide it.
    var oPersonalization = { version: 1, sections: [{ id: "items" }] };
    var aResolved = SectionResolver.resolve({ type: "ZKB", mode: "display", profileId: "orders", personalization: oPersonalization });
    var oDetails = aResolved.filter(function (o) { return o.id === "details"; })[0];
    assert.strictEqual(oDetails.visible, false, "excluded details is hidden despite a visible:true baseline default");
  });

  QUnit.test("editable/editVisible/fragment/titleKey are never affected by personalization", function (assert) {
    var oPersonalization = { version: 1, sections: [{ id: "details", title: "Custom" }] };
    var aResolved = SectionResolver.resolve({ type: "ZKB", mode: "display", profileId: "orders", personalization: oPersonalization });
    var oDetails = aResolved.filter(function (o) { return o.id === "details"; })[0];
    var oCatalogDetails = SectionCatalog.get("details");
    assert.strictEqual(oDetails.fragment, oCatalogDetails.fragment);
    assert.strictEqual(oDetails.editable, oCatalogDetails.editable);
    assert.strictEqual(oDetails.titleKey, oCatalogDetails.titleKey);
  });
});
