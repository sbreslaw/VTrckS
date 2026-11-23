/* global QUnit */
sap.ui.define([
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/schema/OrdersSchema",
  "cdc/vaccreq/model/MessageExtractor",
  "sap/ui/core/Messaging",
  "sap/ui/core/message/Message"
], function (ServiceSchema, OrdersSchema, MessageExtractor, Messaging, Message) {
  "use strict";

  function loadController() {
    return new Promise(function (resolve, reject) {
      sap.ui.require([
        "cdc/vaccreq/controller/Detail.controller",
        "cdc/vaccreq/service/EditRequestService",
        "sap/m/MessageToast"
      ], function (Detail, EditRequestService, MessageToast) {
        resolve({ Detail: Detail, EditRequestService: EditRequestService, MessageToast: MessageToast });
      }, reject);
    });
  }

  function messageRows() {
    return Messaging.getMessageModel().getData().filter(function (oMessage) {
      var oDetails = oMessage.getTechnicalDetails && oMessage.getTechnicalDetails();
      return oDetails && oDetails.source === MessageExtractor.ORDER_LOG_SOURCE_TAG;
    });
  }

  QUnit.module("Order log messages", {
    beforeEach: function () {
      ServiceSchema.use(OrdersSchema);
      Messaging.removeAllMessages();
    },
    afterEach: function () {
      Messaging.removeAllMessages();
    }
  });

  QUnit.test("maps SAP severities, sorts by sequence, and keeps client messages", function (assert) {
    var oProps = OrdersSchema.providerOrderService.orderLogMessageProperties;
    Messaging.addMessages(new Message({ message: "client validation", code: "ZFM/006", type: "Warning" }));
    MessageExtractor.replaceOrderLogMessages([
      { MessageSequence: 4, MessageType: "W", MessageText: "warning", MessageClass: "ZFM", MessageNumber: "004" },
      { MessageSequence: 2, MessageType: "A", MessageText: "abort", MessageClass: "ZFM", MessageNumber: "002" },
      { MessageSequence: 1, MessageType: "E", MessageText: "error", MessageClass: "ZFM", MessageNumber: "001" },
      { MessageSequence: 5, MessageType: "I", MessageText: "information", MessageClass: "ZFM", MessageNumber: "005" },
      { MessageSequence: 3, MessageType: "S", MessageText: "success", MessageClass: "ZFM", MessageNumber: "003" },
      { MessageSequence: 6, MessageType: "W", MessageText: "client validation", MessageClass: "ZFM", MessageNumber: "006" }
    ], oProps);

    var aLogMessages = messageRows();
    assert.deepEqual(aLogMessages.map(function (oMessage) {
      return oMessage.getMessage();
    }), ["error", "abort", "success", "warning", "information"], "MessageSequence order is preserved");
    assert.deepEqual(aLogMessages.map(function (oMessage) {
      return oMessage.getType();
    }), ["Error", "Error", "Success", "Warning", "Information"], "SAP types use the popover severities");
    assert.strictEqual(aLogMessages[0].getCode(), "ZFM/001", "SAP message class and number are retained");
    assert.strictEqual(Messaging.getMessageModel().getData().length, 6, "the existing client message remains without a duplicate");
  });

  QUnit.test("empty result clears only prior order log messages", function (assert) {
    var oProps = OrdersSchema.providerOrderService.orderLogMessageProperties;
    Messaging.addMessages(new Message({ message: "client validation", type: "Information" }));
    MessageExtractor.replaceOrderLogMessages([
      { MessageSequence: 1, MessageType: "E", MessageText: "old order", MessageClass: "ZFM", MessageNumber: "001" }
    ], oProps);

    MessageExtractor.replaceOrderLogMessages([], oProps);

    assert.strictEqual(messageRows().length, 0, "old log message is gone");
    assert.deepEqual(Messaging.getMessageModel().getData().map(function (oMessage) {
      return oMessage.getMessage();
    }), ["client validation"], "client validation remains");
  });

  QUnit.test("deduplication preserves different severities and codes but removes exact repeats", function (assert) {
    var oProps = OrdersSchema.providerOrderService.orderLogMessageProperties;
    Messaging.addMessages(new Message({ message: "same text", code: "ZFM/001", type: "Warning" }));
    MessageExtractor.replaceOrderLogMessages([
      { MessageSequence: 1, MessageType: "E", MessageText: "same text", MessageClass: "ZFM", MessageNumber: "001" },
      { MessageSequence: 2, MessageType: "E", MessageText: "same text", MessageClass: "ZFM", MessageNumber: "001" },
      { MessageSequence: 3, MessageType: "E", MessageText: "same text", MessageClass: "ZFM", MessageNumber: "002" },
      { MessageSequence: 4, MessageType: "W", MessageText: "same text", MessageClass: "ZFM", MessageNumber: "001" }
    ], oProps);

    assert.deepEqual(Messaging.getMessageModel().getData().map(function (oMessage) {
      return [oMessage.getCode(), oMessage.getType()];
    }), [["ZFM/001", "Warning"], ["ZFM/001", "Error"], ["ZFM/002", "Error"]],
    "the warning cannot suppress an error, different codes remain, and exact duplicates collapse");
  });

  QUnit.test("controller exit prevents a late response from adding messages", function (assert) {
    return loadController().then(function (m) {
      var fnResolveRead;
      var bBindingDestroyed = false;
      var bSessionDiscarded = false;
      var oStub = Object.create(m.Detail.prototype);
      oStub._discardItemsEditSession = function () { bSessionDiscarded = true; };
      oStub.getOwnerComponent = function () {
        return { getModel: function () {
          return { bindList: function () {
            return {
              requestContexts: function () {
                return new Promise(function (resolve) { fnResolveRead = resolve; });
              },
              destroy: function () { bBindingDestroyed = true; }
            };
          } };
        } };
      };

      var pRead = oStub._loadOrderLogMessages("0518000521");
      oStub.onExit();
      fnResolveRead([{ getObject: function () {
        return { MessageSequence: 1, MessageType: "E", MessageText: "late error" };
      } }]);
      return pRead.then(function () {
        assert.strictEqual(messageRows().length, 0, "late response does not populate global messages");
        assert.strictEqual(bBindingDestroyed, true, "completed request binding is destroyed");
        assert.strictEqual(bSessionDiscarded, true, "existing session cleanup still runs");
      });
    });
  });

  QUnit.test("controller exit prevents a queued retry from accessing the component", function (assert) {
    return loadController().then(function (m) {
      var iAttempts = 0;
      var oStub = Object.create(m.Detail.prototype);
      oStub._discardItemsEditSession = function () {};
      oStub.getOwnerComponent = function () {
        return { getModel: function () {
          return { bindList: function () {
            return {
              requestContexts: function () {
                iAttempts += 1;
                return Promise.resolve([]);
              },
              destroy: function () {}
            };
          } };
        } };
      };

      var pRead = oStub._loadOrderLogMessages("0518000521", { retryWhenEmpty: true, retryDelayMs: 20 });
      return new Promise(function (resolve) { setTimeout(resolve, 0); }).then(function () {
        oStub.onExit();
        oStub.getOwnerComponent = function () { throw new Error("Controller has exited"); };
        return pRead;
      }).then(function () {
        assert.strictEqual(iAttempts, 1, "queued retry does not issue another request");
        assert.strictEqual(messageRows().length, 0, "messages remain empty");
      });
    });
  });

  QUnit.test("filtered load retries an empty post-save response with a bound", function (assert) {
    return loadController().then(function (m) {
      var iAttempts = 0;
      var oCaptured;
      var oProps = OrdersSchema.providerOrderService.orderLogMessageProperties;
      var oModel = {
        bindList: function (sPath, oContext, oSorter, aFilters, oParameters) {
          oCaptured = { path: sPath, filters: aFilters, parameters: oParameters };
          return {
            requestContexts: function () {
              iAttempts += 1;
              var aRows = iAttempts < 3 ? [] : [{
                SalesOrder: "0518000521",
                MessageSequence: 1,
                MessageType: "E",
                MessageText: "delayed message",
                MessageClass: "ZFM",
                MessageNumber: "012"
              }];
              return Promise.resolve(aRows.map(function (oRow) {
                return { getObject: function () { return oRow; } };
              }));
            },
            destroy: function () {}
          };
        }
      };
      var oStub = Object.create(m.Detail.prototype);
      oStub.getOwnerComponent = function () {
        return { getModel: function () { return oModel; } };
      };

      return oStub._loadOrderLogMessages("0518000521", {
        retryWhenEmpty: true,
        retryDelayMs: 0
      }).then(function () {
        assert.strictEqual(oCaptured.path, "/" + OrdersSchema.providerOrderService.entitySets.orderLogMessage);
        assert.strictEqual(oCaptured.filters[0].getPath(), oProps.salesOrder, "SalesOrder filter property");
        assert.strictEqual(oCaptured.filters[0].getValue1(), "0518000521", "SalesOrder filter value");
        assert.strictEqual(iAttempts, 3, "first request plus two bounded retries");
        assert.strictEqual(messageRows()[0].getMessage(), "delayed message", "delayed log message is shown");
      });
    });
  });

  QUnit.test("request failure is non-fatal and is not retried", function (assert) {
    return loadController().then(function (m) {
      var iAttempts = 0;
      var oModel = {
        bindList: function () {
          return {
            requestContexts: function () {
              iAttempts += 1;
              return Promise.reject(new Error("read failed"));
            },
            destroy: function () {}
          };
        }
      };
      var oStub = Object.create(m.Detail.prototype);
      oStub.getOwnerComponent = function () {
        return { getModel: function () { return oModel; } };
      };

      return oStub._loadOrderLogMessages("0518000521", {
        retryWhenEmpty: true,
        retryDelayMs: 0
      }).then(function (aRows) {
        assert.deepEqual(aRows, [], "failure resolves without breaking the page");
        assert.strictEqual(iAttempts, 1, "request failures are not treated as empty responses");
      });
    });
  });

  QUnit.test("a stale response cannot populate messages for a different order", function (assert) {
    return loadController().then(function (m) {
      var fnResolveFirst;
      var oModel = {
        bindList: function (sPath, oContext, oSorter, aFilters) {
          var sOrderId = aFilters[0].getValue1();
          return {
            requestContexts: function () {
              if (sOrderId === "0000000001") {
                return new Promise(function (resolve) { fnResolveFirst = resolve; });
              }
              return Promise.resolve([{
                getObject: function () {
                  return {
                    SalesOrder: sOrderId,
                    MessageSequence: 1,
                    MessageType: "W",
                    MessageText: "second order",
                    MessageClass: "ZFM",
                    MessageNumber: "002"
                  };
                }
              }]);
            },
            destroy: function () {}
          };
        }
      };
      var oStub = Object.create(m.Detail.prototype);
      oStub.getOwnerComponent = function () {
        return { getModel: function () { return oModel; } };
      };

      var pFirst = oStub._loadOrderLogMessages("0000000001");
      return oStub._loadOrderLogMessages("0000000002").then(function () {
        fnResolveFirst([{
          getObject: function () {
            return {
              SalesOrder: "0000000001",
              MessageSequence: 1,
              MessageType: "E",
              MessageText: "first order",
              MessageClass: "ZFM",
              MessageNumber: "001"
            };
          }
        }]);
        return pFirst;
      }).then(function () {
        assert.deepEqual(messageRows().map(function (oMessage) {
          return oMessage.getMessage();
        }), ["second order"], "only the selected order's message remains");
      });
    });
  });

  QUnit.test("section Save rejects pre-save logs even when the save fails", function (assert) {
    return loadController().then(function (m) {
      var fnOriginalSave = m.EditRequestService.save;
      var fnResolveLog;
      var fnRejectSave;
      var pSaveResult = new Promise(function (resolve, reject) { fnRejectSave = reject; });
      var oContext = {
        getPath: function () { return "/SalesOrderManage('0518000521')"; },
        getProperty: function () { return "0518000521"; }
      };
      var oStub = Object.create(m.Detail.prototype);
      oStub.getView = function () { return { getBindingContext: function () { return oContext; } }; };
      oStub.getResourceBundle = function () { return { getText: function (sKey) { return sKey; } }; };
      oStub.byId = function () { return { setEnabled: function () {} }; };
      oStub._openMessagePopover = function () {};
      oStub._oSectionFactory = { expandSection: function () {} };
      oStub._sDisplayedOrderId = "0518000521";
      oStub.getOwnerComponent = function () {
        return { getModel: function () {
          return { bindList: function () {
            return {
              requestContexts: function () {
                return new Promise(function (resolve) { fnResolveLog = resolve; });
              },
              destroy: function () {}
            };
          } };
        } };
      };
      m.EditRequestService.save = function () { return pSaveResult; };

      var pLog = oStub._loadOrderLogMessages("0518000521", { retryWhenEmpty: true });
      Messaging.addMessages(new Message({ message: "old validation", type: "Warning" }));
      var pSave = oStub.onSectionSavePress("orgData");
      assert.strictEqual(Messaging.getMessageModel().getData().length, 0, "Save still clears previous messages");
      fnResolveLog([{ getObject: function () {
        return { MessageSequence: 1, MessageType: "E", MessageText: "stale validation" };
      } }]);

      return pLog.then(function () {
        fnRejectSave(new Error("current save failure"));
        return pSave;
      }).then(function () {
        assert.deepEqual(Messaging.getMessageModel().getData().map(function (oMessage) {
          return oMessage.getMessage();
        }), ["current save failure"], "only the current failure remains, without pre-save logs");
        assert.strictEqual(oStub._sDisplayedOrderId, "0518000521", "Save preserves displayed-order tracking");
      }).finally(function () {
        m.EditRequestService.save = fnOriginalSave;
      });
    });
  });

  QUnit.test("successful section save refreshes order logs after destroying the old header context", function (assert) {
    return loadController().then(function (m) {
      var fnOriginalSave = m.EditRequestService.save;
      var fnOriginalToast = m.MessageToast.show;
      var bContextDestroyed = false;
      var oContext = {
        getPath: function () { return "/SalesOrderManage('0518000521')"; },
        getProperty: function () {
          if (bContextDestroyed) {
            throw new Error("Cannot read a destroyed header context");
          }
          return "0518000521";
        }
      };
      var oView = {
        getBindingContext: function () { return oContext; },
        getModel: function () { return { getData: function () { return {}; } }; },
        setBusy: function () {}
      };
      var oStub = Object.create(m.Detail.prototype);
      var oLoadCall;
      oStub.getView = function () { return oView; };
      oStub.byId = function () { return { setEnabled: function () {} }; };
      oStub.getResourceBundle = function () { return { getText: function (sKey) { return sKey; } }; };
      oStub._byIdInSection = function () { return null; };
      oStub._reloadHeaderContext = function () { bContextDestroyed = true; };
      oStub._endEditSession = function () {};
      oStub._getSectionTitle = function () { return "Details"; };
      oStub._loadOrderLogMessages = function (sOrderId, oOptions) {
        oLoadCall = { orderId: sOrderId, options: oOptions };
        return Promise.resolve([]);
      };
      oStub._oSectionFactory = { expandSection: function () {} };
      m.EditRequestService.save = function () { return Promise.resolve(); };
      m.MessageToast.show = function () {};

      return oStub.onSectionSavePress("orgData").then(function () {
        assert.strictEqual(bContextDestroyed, true, "header reload destroyed the old context");
        assert.strictEqual(oLoadCall.orderId, "0518000521", "current order is reloaded");
        assert.strictEqual(oLoadCall.options.retryWhenEmpty, true, "post-save update-task retry is enabled");
      }).finally(function () {
        m.EditRequestService.save = fnOriginalSave;
        m.MessageToast.show = fnOriginalToast;
      });
    });
  });
});
