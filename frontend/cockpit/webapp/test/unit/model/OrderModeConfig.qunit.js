/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/OrderModeConfig",
  "sap/base/i18n/ResourceBundle"
], function (OrderModeConfig, ResourceBundle) {
  "use strict";

  QUnit.module("OrderModeConfig.resolveOrderType");

  // Provider Orders create: the Status Select (createEnrich>/status) starts on
  // E0001, the status the backend's status profile assigns at save.
  QUnit.test("Provider Order types default the create-mode status to E0001", function (assert) {
    OrderModeConfig.getCategoryOrderTypes("_ORD").forEach(function (sType) {
      assert.strictEqual(OrderModeConfig.resolveOrderType(sType).createStatusDefault, "E0001", sType);
    });
  });

  // GH-81: Returns create starts on (and saves) the order type's status -
  // E0001 Open for ZKR, E0003 Pending Grantee Approval for ZISL/ZXFR/ZWST.
  QUnit.test("Return types: create-mode status E0001 for ZKR, E0003 for ZISL/ZXFR/ZWST (GH-81)", function (assert) {
    assert.strictEqual(OrderModeConfig.resolveOrderType("ZKR").createStatusDefault, "E0001", "ZKR");
    ["ZISL", "ZXFR", "ZWST"].forEach(function (sType) {
      assert.strictEqual(OrderModeConfig.resolveOrderType(sType).createStatusDefault, "E0003", sType);
    });
    OrderModeConfig.getCategoryOrderTypes("_RET").forEach(function (sType) {
      assert.ok(/^E00(0[1-9]|10)$/.test(OrderModeConfig.resolveOrderType(sType).createStatusDefault), sType + ": a ZRETURN1 status code");
    });
  });

  // GH-75: closed return statuses (Approved, Complete, Cancelled) are display only.
  QUnit.test("readOnlyStatuses: return types list the closed statuses, Provider Orders none", function (assert) {
    OrderModeConfig.getCategoryOrderTypes("_RET").forEach(function (sType) {
      assert.deepEqual(OrderModeConfig.resolveOrderType(sType).readOnlyStatuses, ["E0008", "E0009", "E0010"], sType);
    });
    OrderModeConfig.getCategoryOrderTypes("_ORD").forEach(function (sType) {
      assert.deepEqual(OrderModeConfig.resolveOrderType(sType).readOnlyStatuses, [], sType);
    });
  });

  QUnit.test("readOnlyStatuses: the returned list is a copy", function (assert) {
    OrderModeConfig.resolveOrderType("ZKR").readOnlyStatuses.push("E0001");
    assert.deepEqual(OrderModeConfig.resolveOrderType("ZKR").readOnlyStatuses, ["E0008", "E0009", "E0010"]);
  });

  QUnit.module("OrderModeConfig.getItemsColumnLayout");

  // Column keys in the order the profile's Items fragment renders them
  // (each Column's visible="{itemsColumns>/<key>}").
  function fragmentColumnKeys(sFragmentPath) {
    return fetch(sap.ui.require.toUrl(sFragmentPath)).then(function (oResponse) {
      return oResponse.text();
    }).then(function (sXml) {
      var oDoc = new DOMParser().parseFromString(sXml, "application/xml");
      // NS-agnostic: the returns fragment uses sap.ui.table's t:Column (VTrckS#69).
      return Array.prototype.map.call(oDoc.getElementsByTagNameNS("*", "Column"), function (oColumn) {
        var aMatch = /itemsColumns>\/(\w+)/.exec(oColumn.getAttribute("visible") || "");
        return aMatch ? aMatch[1] : null;
      });
    });
  }

  QUnit.test("returns: the code owner's 12 columns, in order (2026-11-12, GH-91 without Item Category)", function (assert) {
    var oLayout = OrderModeConfig.getItemsColumnLayout("returns");
    assert.deepEqual(oLayout.keys, [
      "rowAction", "itemNumber", "ndcCode", "lotNumber", "expirationDate", "qty", "uom", "ndcDescription",
      "itemStatus", "rejectionReason", "returnReason", "exisId"
    ]);
    assert.strictEqual(oLayout.i18n.itemCategory, undefined, "no Item Category label");
  });

  QUnit.test("orders layout unchanged; unknown profile falls back to it", function (assert) {
    var aOrders = [
      "rowAction", "optOut", "itemNumber", "exisId", "brand", "ndcCode", "lotNumber", "expirationDate", "ndcDescription",
      "qty", "uom", "orderIntention", "fundType", "poReference", "deliveryStatus", "netValue", "rejectionReason"
    ];
    assert.deepEqual(OrderModeConfig.getItemsColumnLayout("orders").keys, aOrders);
    assert.deepEqual(OrderModeConfig.getItemsColumnLayout(undefined).keys, aOrders);
  });

  QUnit.test("every column has a label key that exists in i18n", function (assert) {
    return ResourceBundle.create({ url: sap.ui.require.toUrl("cdc/vaccreq/i18n/i18n.properties"), async: true, supportedLocales: [""], fallbackLocale: "" }).then(function (oBundle) {
      ["orders", "returns"].forEach(function (sProfile) {
        var oLayout = OrderModeConfig.getItemsColumnLayout(sProfile);
        oLayout.keys.forEach(function (sKey) {
          var sTextKey = oLayout.i18n[sKey];
          assert.ok(sTextKey && oBundle.hasText(sTextKey), sProfile + "/" + sKey + " -> " + sTextKey);
        });
      });
    });
  });

  QUnit.test("each profile's Items fragment renders its columns in the layout order", function (assert) {
    return Promise.all([
      fragmentColumnKeys("cdc/vaccreq/sections/Items.fragment.xml"),
      fragmentColumnKeys("cdc/vaccreq/sections/returns/Items.fragment.xml")
    ]).then(function (aKeys) {
      assert.deepEqual(aKeys[0], OrderModeConfig.getItemsColumnLayout("orders").keys, "orders");
      assert.deepEqual(aKeys[1], OrderModeConfig.getItemsColumnLayout("returns").keys, "returns");
    });
  });

  QUnit.module("Order-type tags (GH-82)");

  function fetchXml(sPath) {
    return fetch(sap.ui.require.toUrl(sPath)).then(function (oResponse) {
      return oResponse.text();
    }).then(function (sXml) {
      return new DOMParser().parseFromString(sXml, "application/xml");
    });
  }

  function loadBundle() {
    return ResourceBundle.create({ url: sap.ui.require.toUrl("cdc/vaccreq/i18n/i18n.properties"), async: true, supportedLocales: [""], fallbackLocale: "" });
  }

  // The Details > General labels built from an order-type text ("{0} ID", "{0} Reason", ...).
  function typedLabelTexts(oDoc) {
    return Array.prototype.map.call(oDoc.getElementsByTagNameNS("*", "Label"), function (oLabel) {
      return oLabel.getAttribute("text") || "";
    }).filter(function (sText) {
      return sText.indexOf("Typed'}") !== -1;
    });
  }

  QUnit.test("every order type has a tag key with the issue's text", function (assert) {
    var mExpected = { ZKB: "Provider Order", ZREP: "Replacement", ZISL: "Return", ZXFR: "Transfer", ZWST: "Wastage", ZKR: "Vaccine Return" };
    return loadBundle().then(function (oBundle) {
      OrderModeConfig.supportedOrderTypes.forEach(function (sType) {
        var sTagKey = OrderModeConfig.resolveOrderType(sType).tagKey;
        assert.strictEqual(sTagKey, "orderTag" + sType.charAt(0) + sType.slice(1).toLowerCase(), sType + " tagKey");
        assert.strictEqual(sTagKey && oBundle.getText(sTagKey), mExpected[sType], sType + " text");
      });
      assert.strictEqual(oBundle.getText("colReturnReasonTyped", ["Wastage"]), "Wastage Reason", "column pattern");
    });
  });

  QUnit.test("Returns Details labels use the tag; Provider Orders Details keep the title", function (assert) {
    return Promise.all([
      fetchXml("cdc/vaccreq/sections/returns/Details.fragment.xml"),
      fetchXml("cdc/vaccreq/sections/Details.fragment.xml")
    ]).then(function (aDocs) {
      var aReturns = typedLabelTexts(aDocs[0]);
      var aOrders = typedLabelTexts(aDocs[1]);
      assert.strictEqual(aReturns.length, 4, "returns: 4 typed labels");
      aReturns.forEach(function (sText) {
        assert.ok(sText.indexOf("orderUi>/tag") !== -1 && sText.indexOf("orderUi>/title") === -1, "returns: " + sText);
      });
      assert.strictEqual(aOrders.length, 4, "orders: 4 typed labels");
      aOrders.forEach(function (sText) {
        assert.ok(sText.indexOf("orderUi>/title") !== -1, "orders: " + sText);
      });
    });
  });

  QUnit.test("Returns Items reason column label is '<tag> Reason'", function (assert) {
    return fetchXml("cdc/vaccreq/sections/returns/Items.fragment.xml").then(function (oDoc) {
      var oColumn = Array.prototype.filter.call(oDoc.getElementsByTagNameNS("*", "Column"), function (oCol) {
        return oCol.getAttribute("visible") === "{itemsColumns>/returnReason}";
      })[0];
      var oLabel = oColumn && Array.prototype.filter.call(oColumn.childNodes, function (oNode) {
        return oNode.localName === "label";
      })[0];
      var aTexts = oLabel ? Array.prototype.slice.call(oLabel.getElementsByTagNameNS("*", "Text")) : [];
      var sText = aTexts.length ? aTexts[0].getAttribute("text") : "";
      assert.strictEqual(aTexts.length, 1, "one Text in the column label");
      assert.ok(sText.indexOf("i18n>colReturnReasonTyped") !== -1 && sText.indexOf("orderUi>/tag") !== -1, sText);
    });
  });
});
