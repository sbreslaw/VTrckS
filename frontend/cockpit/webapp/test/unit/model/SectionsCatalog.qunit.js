/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/sections/SectionCatalog",
  "cdc/vaccreq/model/OrderModeConfig"
], function (SectionCatalog, OrderModeConfig) {
  "use strict";

  // Sections Catalog PR1 (prompts/E008_SectionsCatalog_Personalization_Session_
  // Prompt.md) — DoD: "unit tests for resolveSections (default/override/
  // replace/locked/editable-AND-editLive)".

  QUnit.module("SectionCatalog");

  QUnit.test("all() returns every section exactly once, catalog order preserved", function (assert) {
    var aIds = SectionCatalog.all().map(function (o) { return o.id; });
    assert.strictEqual(aIds.length, new Set(aIds).size, "no duplicate ids");
    assert.strictEqual(aIds[0], "details", "details is first (matches the old iIndex===0 forced-expand section)");
    assert.strictEqual(aIds[1], "items");
  });

  QUnit.test("get() resolves a known id, returns undefined for an unknown one", function (assert) {
    assert.strictEqual(SectionCatalog.get("orgData").fragment, "cdc.vaccreq.sections.OrgData");
    assert.strictEqual(SectionCatalog.get("doesNotExist"), undefined);
  });

  QUnit.test("availableFor('returns') excludes sections not confirmed safe on the returns service", function (assert) {
    var aReturnsIds = SectionCatalog.availableFor("returns").map(function (o) { return o.id; });
    assert.ok(aReturnsIds.indexOf("details") > -1, "details has a returns fragment variant");
    assert.ok(aReturnsIds.indexOf("shipping") > -1, "shipping has a returns fragment variant");
    assert.ok(aReturnsIds.indexOf("inventory") === -1, "inventory (IoH) not ported to returns per ADR-002");
    assert.ok(aReturnsIds.indexOf("orgData") > -1, "orgData has a read-only returns fragment variant");
    assert.ok(aReturnsIds.indexOf("partiesInvolved") > -1, "partiesInvolved has a read-only returns fragment variant");
  });

  QUnit.test("Billing is intentionally excluded from the catalog", function (assert) {
    assert.strictEqual(SectionCatalog.get("billing"), undefined);
  });

  QUnit.module("OrderModeConfig.resolveSections");

  QUnit.test("default: ZKB (no per-type hides) — every section visible, unlocked", function (assert) {
    var aResolved = OrderModeConfig.resolveSections("ZKB", "display");
    assert.strictEqual(aResolved.length, SectionCatalog.all().length, "one resolved entry per catalog section");
    aResolved.forEach(function (oResolved) {
      assert.strictEqual(oResolved.visible, true, oResolved.id + " visible");
      assert.strictEqual(oResolved.locked, false, oResolved.id + " not locked");
    });
  });

  QUnit.test("override + locked: ZISL (a _RET type) hides and locks the provider-only sections", function (assert) {
    var aResolved = OrderModeConfig.resolveSections("ZISL", "display");
    var oInventory = aResolved.filter(function (o) { return o.id === "inventory"; })[0];
    assert.strictEqual(oInventory.visible, false, "inventory hidden for _RET");
    assert.strictEqual(oInventory.locked, true, "inventory locked for _RET (not a mere display preference)");
    var oShipping = aResolved.filter(function (o) { return o.id === "shipping"; })[0];
    assert.strictEqual(oShipping.visible, true, "shipping un-hidden for _RET (ret-10-28 #1)");
    assert.strictEqual(oShipping.locked, false, "shipping not locked for _RET");
  });

  QUnit.test("expanded: details/items always expanded; create mode additionally expands the migrated createVisible set", function (assert) {
    var aDisplay = OrderModeConfig.resolveSections("ZKB", "display");
    var oDetailsDisplay = aDisplay.filter(function (o) { return o.id === "details"; })[0];
    var oOrgDataDisplay = aDisplay.filter(function (o) { return o.id === "orgData"; })[0];
    assert.strictEqual(oDetailsDisplay.expanded, true, "details expanded in display mode");
    assert.strictEqual(oOrgDataDisplay.expanded, false, "orgData collapsed in display mode");

    var aCreate = OrderModeConfig.resolveSections("ZKB", "create");
    var oOrgDataCreate = aCreate.filter(function (o) { return o.id === "orgData"; })[0];
    var oStatusCreate = aCreate.filter(function (o) { return o.id === "status"; })[0];
    assert.strictEqual(oOrgDataCreate.expanded, true, "orgData expands eagerly in create mode (migrated createVisible)");
    assert.strictEqual(oStatusCreate.expanded, false, "status was never createVisible — stays collapsed in create mode too");
  });

  QUnit.test("replace semantics: a _RET type's sections map fully overrides, not merges with, ZKB's", function (assert) {
    // ZXFR additionally hides detailsReturnType/detailsExisDate at the FIELD
    // level (unrelated kind), but its SECTIONS map is still exactly
    // RETURNS_UI_HIDDEN.sections (+ shipping un-hidden) — same as every other
    // _RET type, never a leftover from ZKB's empty section hide set.
    var aZxfr = OrderModeConfig.resolveSections("ZXFR", "display");
    var aZisl = OrderModeConfig.resolveSections("ZISL", "display");
    aZxfr.forEach(function (oZxfrEntry, i) {
      assert.strictEqual(oZxfrEntry.visible, aZisl[i].visible, oZxfrEntry.id + " visible matches across _RET types");
      assert.strictEqual(oZxfrEntry.locked, aZisl[i].locked, oZxfrEntry.id + " locked matches across _RET types");
    });
  });

  QUnit.test("unknown order type falls back to the default order type, never throws", function (assert) {
    var aResolved = OrderModeConfig.resolveSections("NOT_A_TYPE", "display");
    assert.strictEqual(aResolved.length, SectionCatalog.all().length);
  });

  // prompts/E008_Returns_ZKR_Sections_Session_Prompt.md: read-only sections
  // on ZKR only, collapsed on open and in create.
  function findSection(aResolved, sId) {
    return aResolved.filter(function (o) { return o.id === sId; })[0];
  }

  QUnit.test("ZKR: Price Totals and Org Data visible, read-only, collapsed in display and create", function (assert) {
    ["display", "create"].forEach(function (sMode) {
      var aResolved = OrderModeConfig.resolveSections("ZKR", sMode);
      ["priceTotals", "orgData"].forEach(function (sId) {
        var oSection = findSection(aResolved, sId);
        assert.strictEqual(oSection.visible, true, sMode + "/" + sId + ": visible");
        assert.strictEqual(oSection.locked, false, sMode + "/" + sId + ": not locked");
        assert.strictEqual(oSection.editable, false, sMode + "/" + sId + ": no Edit button");
        assert.strictEqual(oSection.expanded, false, sMode + "/" + sId + ": collapsed (per-type expanded beats SECTION_CREATE_EXPANDED)");
      });
    });
  });

  QUnit.test("ZISL/ZWST/ZXFR keep the ZKR-only sections hidden and locked; ZKB create still expands them", function (assert) {
    ["ZISL", "ZWST", "ZXFR"].forEach(function (sType) {
      var aResolved = OrderModeConfig.resolveSections(sType, "display");
      ["priceTotals", "orgData"].forEach(function (sId) {
        var oSection = findSection(aResolved, sId);
        assert.strictEqual(oSection.visible, false, sType + "/" + sId + ": hidden");
        assert.strictEqual(oSection.locked, true, sType + "/" + sId + ": locked");
      });
    });
    var aZkbCreate = OrderModeConfig.resolveSections("ZKB", "create");
    ["priceTotals", "orgData"].forEach(function (sId) {
      var oSection = findSection(aZkbCreate, sId);
      assert.strictEqual(oSection.visible, true, "ZKB/" + sId + ": visible");
      assert.strictEqual(oSection.editable, true, "ZKB/" + sId + ": editability unchanged");
      assert.strictEqual(oSection.expanded, true, "ZKB/" + sId + ": expanded in create (unchanged)");
    });
  });

  QUnit.test("ZKR: Parties Involved read-only and collapsed in display, absent in create", function (assert) {
    ["display", "edit"].forEach(function (sMode) {
      var oParties = findSection(OrderModeConfig.resolveSections("ZKR", sMode), "partiesInvolved");
      assert.strictEqual(oParties.visible, true, sMode + ": visible");
      assert.strictEqual(oParties.locked, false, sMode + ": not locked");
      assert.strictEqual(oParties.editable, false, sMode + ": no Edit button");
      assert.strictEqual(oParties.expanded, false, sMode + ": collapsed");
    });
    assert.strictEqual(findSection(OrderModeConfig.resolveSections("ZKR", "create"), "partiesInvolved").visible, false, "create: hidden");
    ["ZISL", "ZWST", "ZXFR"].forEach(function (sType) {
      var oParties = findSection(OrderModeConfig.resolveSections(sType, "display"), "partiesInvolved");
      assert.strictEqual(oParties.visible, false, sType + ": hidden");
      assert.strictEqual(oParties.locked, true, sType + ": locked");
    });
    assert.strictEqual(findSection(OrderModeConfig.resolveSections("ZKB", "create"), "partiesInvolved").visible, true, "ZKB create: still visible (unchanged)");
  });
});
