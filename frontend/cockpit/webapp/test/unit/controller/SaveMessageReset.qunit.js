/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/schema/OrdersSchema",
  "cdc/vaccreq/model/schema/ReturnsSchema",
  "sap/ui/core/Messaging",
  "sap/ui/core/message/Message",
  "sap/ui/model/json/JSONModel"
], function (ServiceSchema, OrdersSchema, ReturnsSchema, Messaging, Message, JSONModel) {
  "use strict";

  // GH-92: every Save press starts with an empty message store.
  var sPreviousProfile;

  QUnit.module("Save empties the message store (GH-92)", {
    // Detail.controller's module graph reads the active profile when it loads
    // (FundLogicService), and QUnit may run this module first - select one.
    beforeEach: function () {
      sPreviousProfile = ServiceSchema.profileId;
      ServiceSchema.use(OrdersSchema);
      Messaging.removeAllMessages();
    },
    afterEach: function () {
      Messaging.removeAllMessages();
      ServiceSchema.use(sPreviousProfile === ReturnsSchema.profileId ? ReturnsSchema : OrdersSchema);
    }
  });

  function load() {
    return new Promise(function (resolve, reject) {
      sap.ui.require([
        "cdc/vaccreq/controller/Detail.controller",
        "cdc/vaccreq/service/CreateOrderService",
        "cdc/vaccreq/model/MessageExtractor"
      ], function (Detail, CreateOrderService, MessageExtractor) {
        resolve({ Detail: Detail, CreateOrderService: CreateOrderService, MessageExtractor: MessageExtractor });
      }, reject);
    });
  }

  // A persistent model message from an earlier successful response (no
  // httpStatus, untagged) plus a note from an earlier client-side check.
  function seedMessages(MessageExtractor) {
    Messaging.addMessages(new Message({ message: "old", type: "Information", persistent: true }));
    MessageExtractor.addNote("old note", "Error");
  }

  function texts() {
    return Messaging.getMessageModel().getData().map(function (oMessage) {
      return oMessage.getMessage();
    });
  }

  function stubController(Detail, oContext, bSaveEnabled) {
    var oStub = Object.create(Detail.prototype);
    var mModels = { orderUi: new JSONModel({}) };
    oStub.getView = function () {
      return {
        getBindingContext: function () { return oContext; },
        getModel: function (sName) { return mModels[sName]; },
        byId: function () { return { getEnabled: function () { return bSaveEnabled; } }; }
      };
    };
    oStub.byId = function () { return { setEnabled: function () {} }; };
    oStub.getResourceBundle = function () { return { getText: function (sKey) { return sKey; } }; };
    oStub._byIdInSection = function () { return null; };
    oStub._openMessagePopover = function () {};
    oStub._oSectionFactory = { expandSection: function () {} };
    return oStub;
  }

  QUnit.test("section Save: earlier messages are gone, the check's message shows alone", function (assert) {
    return load().then(function (m) {
      var fnOriginal = m.CreateOrderService.hasIncompleteItems;
      m.CreateOrderService.hasIncompleteItems = function () { return true; };
      try {
        seedMessages(m.MessageExtractor);
        var oStub = stubController(m.Detail, { getPath: function () { return "/x"; } }, true);
        oStub.onSectionSavePress("items");
        assert.deepEqual(texts(), ["itemsIncompleteItemsError"], "first Save: only its own message");
        oStub.onSectionSavePress("items");
        assert.deepEqual(texts(), ["itemsIncompleteItemsError"], "second Save: still one message");
      } finally {
        m.CreateOrderService.hasIncompleteItems = fnOriginal;
      }
    });
  });

  QUnit.test("section Save without an order keeps the messages", function (assert) {
    return load().then(function (m) {
      seedMessages(m.MessageExtractor);
      stubController(m.Detail, null, true).onSectionSavePress("details");
      assert.deepEqual(texts(), ["old", "old note"], "nothing removed");
    });
  });

  QUnit.test("create Save: earlier messages are gone, the check's message shows alone", function (assert) {
    return load().then(function (m) {
      seedMessages(m.MessageExtractor);
      var oContext = { getPath: function () { return "/x"; }, getProperty: function () { return ""; } };
      var oStub = stubController(m.Detail, oContext, true);
      oStub.onCreateSavePress();
      assert.deepEqual(texts(), ["createRequestFieldRequired"], "first Save: only its own message");
      oStub.onCreateSavePress();
      assert.deepEqual(texts(), ["createRequestFieldRequired"], "second Save: still one message");
    });
  });

  QUnit.test("create Save pressed while a Save is running keeps the messages", function (assert) {
    return load().then(function (m) {
      seedMessages(m.MessageExtractor);
      var oContext = { getPath: function () { return "/x"; }, getProperty: function () { return ""; } };
      stubController(m.Detail, oContext, false).onCreateSavePress();
      assert.deepEqual(texts(), ["old", "old note"], "nothing removed");
    });
  });
});
