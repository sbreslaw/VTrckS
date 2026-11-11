/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/formatter",
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/schema/OrdersSchema",
  "cdc/vaccreq/model/schema/ReturnsSchema"
], function (formatter, ServiceSchema, OrdersSchema, ReturnsSchema) {
  "use strict";

  QUnit.module("formatter.codeAndText");

  QUnit.test("text and code, code only, or an em dash", function (assert) {
    assert.strictEqual(formatter.codeAndText("107", "Chicago"), "Chicago (107)");
    assert.strictEqual(formatter.codeAndText("107", null), "107", "text navigation empty (e.g. not loaded)");
    assert.strictEqual(formatter.codeAndText("", null), "\u2014", "no code (e.g. Sales Group not set)");
  });

  QUnit.module("formatter.yesNo");

  QUnit.test("only a raw true reads Yes", function (assert) {
    assert.strictEqual(formatter.yesNo(true, "Yes", "No"), "Yes");
    assert.strictEqual(formatter.yesNo(false, "Yes", "No"), "No");
    assert.strictEqual(formatter.yesNo(null, "Yes", "No"), "No", "flag not set (e.g. pricing subtotal rows)");
    assert.strictEqual(formatter.yesNo("No", "Yes", "No"), "No", "a type-formatted string is never mistaken for true");
  });

  // Read-only returns Parties table (prompts/E008_Returns_ZKR_Sections_Session_Prompt.md),
  // values as returned live on ZKR 619000510 / 619000507 (2026-11-11).
  QUnit.module("formatter - Parties Involved");

  QUnit.test("partnerId: Customer first, otherwise the first id that is not a NUMC zero", function (assert) {
    assert.strictEqual(formatter.partnerId("40029638", "", "0", "0"), "40029638", "AG/RE/RG/WE");
    assert.strictEqual(formatter.partnerId("", "", "0", "20185"), "20185", "AP carries its id in ContactPerson");
    assert.strictEqual(formatter.partnerId("", "SUP1", "0", "0"), "SUP1", "supplier function");
    assert.strictEqual(formatter.partnerId("", "", "00000000", "0"), "", "blank AP row before a contact is chosen");
    assert.strictEqual(formatter.partnerId(null, undefined, null, null), "", "nothing loaded");
  });

  QUnit.test("partnerAddress: 'Street HouseNumber, City PostalCode, Country', else the formatted address", function (assert) {
    assert.strictEqual(formatter.partnerAddress("127 Test 7", "", "Atlanta", "30329", "US", "127 Test 7, Atlanta GA 30329, USA"),
      "127 Test 7, Atlanta 30329, US", "parts win over the preformatted address");
    assert.strictEqual(formatter.partnerAddress("Main St", "12", "Springfield", "62702", "US", ""), "Main St 12, Springfield 62702, US");
    assert.strictEqual(formatter.partnerAddress("", "", "", "", "US", "PO Box 7, Atlanta GA 30329, USA"),
      "PO Box 7, Atlanta GA 30329, USA", "no street/city/postal code - fall back to FormattedPostalAddressDesc");
    assert.strictEqual(formatter.partnerAddress("", "", "", "", "", ""), "", "blank row");
  });

  QUnit.test("mainPartnerText: Yes for the profile's Sold-To function, blank when the profile declares none", function (assert) {
    ServiceSchema.use(ReturnsSchema);
    assert.strictEqual(formatter.mainPartnerText("AG", "Yes", "No"), "Yes", "Sold-To");
    assert.strictEqual(formatter.mainPartnerText("WE", "Yes", "No"), "No", "Ship-To");
    assert.strictEqual(formatter.mainPartnerText("", "Yes", "No"), "", "no partner function");

    ServiceSchema.use({ profileId: "withoutSoldTo", serviceRoot: "/test/" });
    assert.strictEqual(formatter.mainPartnerText("AG", "Yes", "No"), "", "a profile without partnerFunctions marks no main partner");
    ServiceSchema.use(OrdersSchema);
  });
});
