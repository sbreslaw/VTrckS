/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/schema/OrdersSchema",
  "cdc/vaccreq/model/schema/ReturnsSchema",
  "sap/ui/model/json/JSONModel"
], function (ServiceSchema, OrdersSchema, ReturnsSchema, JSONModel) {
  "use strict";

  // GH-104: Return Reason options per return type (po>/OrderReason filtered by OrderType).

  function loadController() {
    return new Promise(function (resolve, reject) {
      sap.ui.require(["cdc/vaccreq/controller/Detail.controller"], resolve, reject);
    });
  }

  function row(sCode, sText) {
    var mRow = { OrderType: "ZWST", OrderReason: sCode, OrderReasonText: sText };
    return { getProperty: function (sName) { return mRow[sName]; } };
  }

  function deferred() {
    var oDeferred = {};
    oDeferred.promise = new Promise(function (resolve, reject) {
      oDeferred.resolve = resolve;
      oDeferred.reject = reject;
    });
    return oDeferred;
  }

  // Fake controller: the view holds the returnReasons model, the component the "po" model.
  // fnRequest(iCall) returns the promise each requestContexts call resolves with.
  function fakeController(fnRequest) {
    var oVHModel = new JSONModel({ list: [], options: [] });
    var aCalls = [];
    var oPoModel = {
      bindList: function (sPath, oContext, aSorters, aFilters, mParameters) {
        var iCall = aCalls.length;
        aCalls.push({ path: sPath, filters: aFilters, parameters: mParameters });
        return { requestContexts: function () { return fnRequest(iCall); } };
      }
    };
    return {
      vhModel: oVHModel,
      calls: aCalls,
      controller: {
        getView: function () {
          return { getModel: function (sName) { return sName === "returnReasons" ? oVHModel : undefined; } };
        },
        getOwnerComponent: function () {
          return { getModel: function (sName) { return sName === "po" ? oPoModel : undefined; } };
        }
      }
    };
  }

  function typeFilter(oCall) {
    var oFilter = oCall.filters[0];
    var aInner = oFilter.getFilters ? oFilter.getFilters() : null;
    return aInner && aInner.length ? aInner[0] : oFilter;
  }

  function fetchXml(sPath) {
    return fetch(sap.ui.require.toUrl(sPath)).then(function (oResponse) {
      return oResponse.text();
    }).then(function (sXml) {
      return new DOMParser().parseFromString(sXml, "application/xml");
    });
  }

  function byAttribute(oDoc, sTag, sAttribute, sValue) {
    return Array.prototype.filter.call(oDoc.getElementsByTagNameNS("*", sTag), function (oNode) {
      return oNode.getAttribute(sAttribute) === sValue;
    })[0];
  }

  function bindsEntitySetLiteral(oDoc) {
    return Array.prototype.some.call(oDoc.getElementsByTagName("*"), function (oNode) {
      return Array.prototype.some.call(oNode.attributes, function (oAttribute) {
        return oAttribute.value.indexOf("/SDDocumentReason") !== -1;
      });
    });
  }

  QUnit.module("Return Reason options: schema (GH-104)");

  QUnit.test("both profiles carry the same OrderReason constants", function (assert) {
    [OrdersSchema, ReturnsSchema].forEach(function (oSchema) {
      assert.strictEqual(oSchema.providerOrderService.entitySets.orderReason, "OrderReason", oSchema.profileId + " entity set");
      assert.deepEqual(oSchema.providerOrderService.orderReasonProperties,
        { orderType: "OrderType", code: "OrderReason", text: "OrderReasonText" }, oSchema.profileId + " properties");
    });
  });

  QUnit.module("Return Reason options: loader (GH-104)", {
    beforeEach: function () { ServiceSchema.use(ReturnsSchema); }
  });

  QUnit.test("reads po>/OrderReason filtered by the return type into returnReasons>/options", function (assert) {
    var oFake = fakeController(function () {
      return Promise.resolve([row("100", "Broken Vial/Syringe"), row("G99", "Multiple Reasons")]);
    });
    return loadController().then(function (Detail) {
      return Detail.prototype._loadReturnReasonOptions.call(oFake.controller, "ZWST");
    }).then(function () {
      assert.strictEqual(oFake.calls.length, 1, "one request");
      assert.strictEqual(oFake.calls[0].path, "/OrderReason", "entity set");
      var oFilter = typeFilter(oFake.calls[0]);
      assert.strictEqual(oFilter.getPath(), "OrderType", "filter property");
      assert.strictEqual(oFilter.getOperator(), "EQ", "filter operator");
      assert.strictEqual(oFilter.getValue1(), "ZWST", "filter value = the return type");
      assert.strictEqual(oFake.calls[0].parameters.$select, "OrderReason,OrderReasonText", "$select");
      assert.deepEqual(oFake.vhModel.getProperty("/options"),
        [{ key: "100", text: "Broken Vial/Syringe" }, { key: "G99", text: "Multiple Reasons" }], "options");
    });
  });

  QUnit.test("options are cleared as soon as a new type starts loading", function (assert) {
    var oPending = deferred();
    var oFake = fakeController(function () { return oPending.promise; });
    oFake.vhModel.setProperty("/options", [{ key: "200", text: "Transfer" }]);
    return loadController().then(function (Detail) {
      var pLoad = Detail.prototype._loadReturnReasonOptions.call(oFake.controller, "ZWST");
      assert.deepEqual(oFake.vhModel.getProperty("/options"), [], "never the previous type's list");
      oPending.resolve([row("100", "Broken Vial/Syringe")]);
      return pLoad;
    }).then(function () {
      assert.deepEqual(oFake.vhModel.getProperty("/options"), [{ key: "100", text: "Broken Vial/Syringe" }]);
    });
  });

  QUnit.test("a late response of an older type is dropped", function (assert) {
    var aPending = [deferred(), deferred()];
    var oFake = fakeController(function (iCall) { return aPending[iCall].promise; });
    return loadController().then(function (Detail) {
      var pFirst = Detail.prototype._loadReturnReasonOptions.call(oFake.controller, "ZWST");
      var pSecond = Detail.prototype._loadReturnReasonOptions.call(oFake.controller, "ZXFR");
      aPending[1].resolve([row("200", "Transfer")]);
      return pSecond.then(function () {
        aPending[0].resolve([row("100", "Broken Vial/Syringe")]);
        return pFirst;
      });
    }).then(function () {
      assert.strictEqual(typeFilter(oFake.calls[1]).getValue1(), "ZXFR", "second request for ZXFR");
      assert.deepEqual(oFake.vhModel.getProperty("/options"), [{ key: "200", text: "Transfer" }], "ZXFR list kept");
    });
  });

  QUnit.test("no rows or a failed read gives an empty picker (no fallback)", function (assert) {
    var oEmpty = fakeController(function () { return Promise.resolve([]); });
    var oFailed = fakeController(function () { return Promise.reject(new Error("500")); });
    oEmpty.vhModel.setProperty("/list", [{ key: "100", text: "Broken Vial/Syringe" }]);
    return loadController().then(function (Detail) {
      return Promise.all([
        Detail.prototype._loadReturnReasonOptions.call(oEmpty.controller, "ZISL"),
        Detail.prototype._loadReturnReasonOptions.call(oFailed.controller, "ZISL")
      ]);
    }).then(function () {
      assert.deepEqual(oEmpty.vhModel.getProperty("/options"), [], "empty result");
      assert.deepEqual(oFailed.vhModel.getProperty("/options"), [], "failed read");
      assert.strictEqual(oEmpty.vhModel.getProperty("/list").length, 1, "the full text list is untouched");
    });
  });

  QUnit.test("Provider Orders send no OrderReason request", function (assert) {
    ServiceSchema.use(OrdersSchema);
    var oFake = fakeController(function () { return Promise.resolve([row("100", "x")]); });
    return loadController().then(function (Detail) {
      return Detail.prototype._loadReturnReasonOptions.call(oFake.controller, "ZKB");
    }).then(function () {
      assert.strictEqual(oFake.calls.length, 0, "no request");
      assert.deepEqual(oFake.vhModel.getProperty("/options"), [], "no options");
    });
  });

  QUnit.module("Return Reason options: fragments (GH-104)");

  QUnit.test("header create picker lists the type options", function (assert) {
    return fetchXml("cdc/vaccreq/sections/returns/Details.fragment.xml").then(function (oDoc) {
      var oCombo = byAttribute(oDoc, "ComboBox", "change", ".onReturnReasonChange");
      assert.ok(oCombo, "header ComboBox found");
      assert.notStrictEqual(oCombo.getAttribute("items").indexOf("returnReasons>/options"), -1, "items = returnReasons>/options");
      var oItem = oCombo.getElementsByTagNameNS("*", "Item")[0];
      assert.strictEqual(oItem.getAttribute("key"), "{returnReasons>key}", "item key");
      assert.strictEqual(oItem.getAttribute("text"), "{returnReasons>text}", "item text");
      assert.notOk(bindsEntitySetLiteral(oDoc), "no /SDDocumentReason binding left");
    });
  });

  QUnit.test("item cell: Text from the full list when not editable, type-restricted Select when editable", function (assert) {
    return fetchXml("cdc/vaccreq/sections/returns/Items.fragment.xml").then(function (oDoc) {
      var oSelect = byAttribute(oDoc, "Select", "change", ".onItemReturnReasonChange");
      assert.ok(oSelect, "item Select found");
      assert.notStrictEqual(oSelect.getAttribute("items").indexOf("returnReasons>/options"), -1, "items = returnReasons>/options");
      assert.strictEqual(oSelect.getAttribute("forceSelection"), "false", "forceSelection false");
      assert.strictEqual(oSelect.getAttribute("resetOnMissingKey"), "true", "a missing key clears the shown selection");
      var oItem = oSelect.getElementsByTagNameNS("*", "Item")[0];
      assert.strictEqual(oItem.getAttribute("key"), "{returnReasons>key}", "item key");

      var oBox = oSelect.parentNode;
      assert.strictEqual(oBox.localName, "HBox", "Select sits in an HBox");
      var oText = Array.prototype.filter.call(oBox.children, function (oNode) { return oNode.localName === "Text"; })[0];
      var sText = oText ? oText.getAttribute("text") : "";
      assert.notStrictEqual(sText.indexOf("returnReasons>/list"), -1, "Text uses the full list");
      assert.notStrictEqual(sText.indexOf(".formatter.categoryText"), -1, "Text derives the text with categoryText");

      var aSelectVisible = /^\{= (.*) \}$/.exec(oSelect.getAttribute("visible") || "");
      assert.ok(aSelectVisible, "Select visible is an expression");
      assert.strictEqual(oText.getAttribute("visible"), "{= !(" + (aSelectVisible && aSelectVisible[1]) + ") }", "Text shows exactly when the Select does not");
      assert.notOk(bindsEntitySetLiteral(oDoc), "no /SDDocumentReason binding left");
    });
  });
});
