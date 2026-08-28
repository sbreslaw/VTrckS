sap.ui.define([
  "sap/ui/core/Messaging",
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/Enums"
], function (Messaging, ServiceSchema, Enums) {
  "use strict";

  // CRUD Task 1 v4 (Action-Based Create, supersedes v3's "standard CRUD
  // create" spine — design/prompts/CRUD Task 1 Prompt v3.md, ADDENDUM-001).
  //
  // Live testing surfaced a 405 "Creating operations are disabled for entity
  // ... SalesOrderManage" on Save; design/so.xml confirms this is a static,
  // unconditional `SAP__capabilities.InsertRestrictions.Insertable=false` on
  // SalesOrderManage — a raw POST/deep-insert against this entity set can
  // never succeed, regardless of payload. The service instead exposes a
  // bound action, CreateWithSalesOrderType, as the sanctioned way to create a
  // new order (ServiceSchema.createAction).
  //
  // Rather than rewrite every createMode fragment (Details/OrgData/Shipping/
  // Items all bind directly to the createMode binding context today), the v3
  // transient context is KEPT as a pure local scratchpad: fragments still
  // edit it exactly as before, in the deferred "vrCreate" group — but that
  // group's batch is NEVER submitted (the POST it would produce always
  // 405s). At Save, its accumulated header/item values are harvested and
  // REPLAYED as: (1) the CreateWithSalesOrderType action call, (2) a PATCH of
  // any other header field the action doesn't accept, (3) real deep-creates
  // of each scratch item row — all against the new real context, in "vrEdit"
  // (the same group real edit-session PATCHes/adds already use, and already
  // confirmed working). The scratch context is then discarded locally
  // (delete() — nothing in it was ever sent to the backend).
  var CREATE_GROUP = ServiceSchema.createUpdateGroup;
  var EDIT_GROUP = ServiceSchema.editUpdateGroup;
  var ACTION_PARAMS = ServiceSchema.createActionParameters;
  var REPLAY_HEADER_PROPERTIES = ServiceSchema.createReplayHeaderProperties;
  var ITEM_PROPERTIES = [
    ServiceSchema.itemProperties.material,
    ServiceSchema.itemProperties.itemText,
    ServiceSchema.itemProperties.optOutAncillary,
    ServiceSchema.itemProperties.quantity,
    ServiceSchema.itemProperties.unit,
    ServiceSchema.itemProperties.exisId,
    ServiceSchema.itemProperties.orderIntention
  ];

  var CreateOrderService = {
    UPDATE_GROUP: CREATE_GROUP,

    // Enter create mode: a transient list-binding context bound to the whole
    // Detail view — a local scratchpad only (see header comment); no backend
    // contact happens here, and none of its own group is ever submitted.
    enter: function (oModel) {
      var oListBinding = oModel.bindList("/" + ServiceSchema.entitySets.header, undefined, undefined, undefined, {
        $$updateGroupId: CREATE_GROUP
      });
      var oInitialData = {};
      oInitialData[ServiceSchema.headerProperties.salesOrderType] = ServiceSchema.fixedOrderTypes[0];
      var oContext = oListBinding.create(oInitialData);
      return { listBinding: oListBinding, context: oContext };
    },

    // Cancel = delete the transient scratch context. Nothing was ever sent to
    // the backend, so there is nothing to clean up server-side.
    cancel: function (oContext) {
      return oContext.delete();
    },

    isDirty: function (oContext) {
      var oModel = oContext && oContext.getModel();
      return !!oModel && oModel.hasPendingChanges(CREATE_GROUP);
    },

    // Client-side MIN_ITEMS rule enforced at Save (design/prompts/CRUD Task 1
    // Prompt v3.md "Items" section) — counts transient item rows with an NDC
    // and a positive quantity.
    hasMinItems: function (oItemsBinding) {
      if (!oItemsBinding) {
        return Enums.MIN_ITEMS <= 0;
      }
      var aContexts = oItemsBinding.getCurrentContexts ? oItemsBinding.getCurrentContexts() : [];
      var iValid = aContexts.filter(function (oCtx) {
        var sNdc = oCtx.getProperty(ServiceSchema.itemProperties.material);
        var fQty = parseFloat(oCtx.getProperty(ServiceSchema.itemProperties.quantity));
        return !!sNdc && !isNaN(fQty) && fQty > 0;
      }).length;
      return iValid >= Enums.MIN_ITEMS;
    },

    // Step ① — replay the scratch transient context as a real create: the
    // CreateWithSalesOrderType action call, then (one further batch) the
    // remaining header PATCHes + item deep-creates. Resolves with the NEW,
    // real context — callers MUST switch to using this from here on (the
    // original oScratchContext is deleted before this resolves). Rejects if
    // any step fails; the caller can't tell apart "action itself failed"
    // (nothing created) from "replay after it failed" (order exists, items/
    // extra fields may be incomplete) purely from this promise — see
    // Detail.controller.js#onCreateSavePress, which treats any rejection here
    // as step ① failing (order not created), same as v3.
    save: function (oScratchContext, oItemsBinding) {
      var oModel = oScratchContext.getModel();
      var oScratchData = oScratchContext.getObject() || {};

      var oHeaderListBinding = oModel.bindList("/" + ServiceSchema.entitySets.header);
      var oAction = oModel.bindContext(ServiceSchema.createAction + "(...)", oHeaderListBinding.getHeaderContext());
      ACTION_PARAMS.forEach(function (oParam) {
        oAction.setParameter(oParam.actionParam, oScratchData[oParam.scratchProperty] || "");
      });

      // "vrEdit" is submit:"API" (manifest.json) - execute()'s promise only
      // resolves once the batch is actually sent, so submitBatch() must be
      // triggered alongside it, not chained inside its .then() (that would
      // deadlock: submitBatch() would never run because execute() never
      // resolves without it).
      var oExecutePromise = oAction.execute(EDIT_GROUP);
      oModel.submitBatch(EDIT_GROUP);

      return oExecutePromise
        .catch(function (oError) {
          // A rejection here is a genuine OData/batch-level error (e.g. a
          // business-validation failure on the action's own required
          // parameters) - it never throws a JS exception you can breakpoint
          // on, and the message model is the only place the real backend
          // text shows up before the generic createSaveError toast fires.
          console.error("CreateOrderService.save: CreateWithSalesOrderType request failed",
            "\nerror:", oError && oError.message, oError,
            "\nmessages:", JSON.stringify(Messaging.getMessageModel().getData(), null, 2));
          throw oError;
        })
        .then(function () {
          // This entity set is SAP__session.StickySessionSupported (design/
          // so.xml ~9983) - CreateWithSalesOrderType only opens a buffered,
          // not-yet-numbered sticky session (confirmed live: its own response
          // has SalesOrder=""). setProperty/PATCH against this context
          // ("Not a (navigation) property") is unsupported, but deep-create
          // via a navigation property (_Item) is a plain POST to that
          // context's own path, which the metamodel CAN resolve. There is no
          // action parameter for items on CreateWithSalesOrderType at all
          // (design/so.xml) - they must be attached here, inside the sticky
          // session, before SaveChanges - SaveChanges is the actual SD
          // commit and (like VA01/VA02) is expected to reject a header-only
          // order with zero items, the same MIN_ITEMS rule hasMinItems()
          // already enforces client-side.
          var oStickyContext = oAction.getBoundContext();
          var aScratchItemContexts = (oItemsBinding && oItemsBinding.getCurrentContexts) ? oItemsBinding.getCurrentContexts() : [];
          var oStickyItemsBinding = oModel.bindList(ServiceSchema.navigation.headerToItems, oStickyContext, undefined, undefined, {
            $$updateGroupId: EDIT_GROUP
          });
          aScratchItemContexts.forEach(function (oItemContext) {
            var oItemData = oItemContext.getObject() || {};
            var oNewItemData = {};
            ITEM_PROPERTIES.forEach(function (sProperty) {
              if (oItemData[sProperty] !== undefined) {
                oNewItemData[sProperty] = oItemData[sProperty];
              }
            });
            oStickyItemsBinding.create(oNewItemData);
          });
          var oItemsPromise = oModel.submitBatch(EDIT_GROUP);

          return oItemsPromise
            .catch(function (oError) {
              console.error("CreateOrderService.save: item deep-create on sticky session failed",
                "\nerror:", oError && oError.message, oError,
                "\nmessages:", JSON.stringify(Messaging.getMessageModel().getData(), null, 2));
              throw oError;
            })
            .then(function () {
              // SaveAction, SaveChanges, is what actually commits the
              // document and assigns the real key - call it (still bound to
              // the same sticky session/context) now that items exist.
              var oSaveAction = oModel.bindContext(ServiceSchema.saveAction + "(...)", oStickyContext);
              var oSavePromise = oSaveAction.execute(EDIT_GROUP);
              oModel.submitBatch(EDIT_GROUP);

              return oSavePromise
                .catch(function (oError) {
                  console.error("CreateOrderService.save: SaveChanges request failed",
                    "\nerror:", oError && oError.message, oError,
                    "\nmessages:", JSON.stringify(Messaging.getMessageModel().getData(), null, 2));
                  throw oError;
                })
                .then(function () {
                  var oSaveResultContext = oSaveAction.getBoundContext();
                  var sNewId = oSaveResultContext.getProperty(ServiceSchema.keys.orderId);
                  if (!sNewId) {
                    // Fail fast: an empty key here means the order still
                    // wasn't actually persisted - proceeding would silently
                    // PATCH against a bogus "SalesOrder=''" path instead of
                    // surfacing the real failure. Log whatever the backend
                    // actually returned - the generic createSaveError toast
                    // alone doesn't say why.
                    console.error("CreateOrderService.save: SaveChanges returned no " + ServiceSchema.keys.orderId,
                      "\nraw value:", JSON.stringify(sNewId),
                      "\nfull action result entity:", JSON.stringify(oSaveResultContext.getObject(), null, 2),
                      "\nmessages:", JSON.stringify(Messaging.getMessageModel().getData(), null, 2));
                    throw new Error("SaveChanges returned no " + ServiceSchema.keys.orderId + " - order was not created");
                  }
                  // Now a normal, fully-numbered order - PATCH its remaining
                  // header fields against the canonical path exactly like an
                  // existing order (EditRequestService.js). Items are already
                  // attached above, before Save - do not create them again here.
                  var oNewContext = oModel.bindContext(ServiceSchema.buildHeaderPath(sNewId), undefined, {
                    $$updateGroupId: EDIT_GROUP
                  }).getBoundContext();
                  return CreateOrderService._replayHeaderProperties(oNewContext, oScratchData).then(function () {
                    oScratchContext.delete();
                    return oNewContext;
                  });
                });
            });
        });
    },

    // Internal — PATCH the non-action header fields onto the new real
    // context, in one batch. Items are deep-created earlier, on the sticky
    // session context, before SaveChanges (see save() above).
    _replayHeaderProperties: function (oNewContext, oScratchData) {
      REPLAY_HEADER_PROPERTIES.forEach(function (sProperty) {
        if (oScratchData[sProperty] !== undefined && oScratchData[sProperty] !== "") {
          oNewContext.setProperty(sProperty, oScratchData[sProperty]);
        }
      });

      return oNewContext.getModel().submitBatch(EDIT_GROUP);
    },

    // Step ② — post-create enrichment action (description/status-if-changed/
    // category/contactId). BLOCKED-BY-SERVICE: per ADDENDUM-001 this is a
    // planned behavior-definition extension action, not yet activated on any
    // bound service (ServiceSchema.enrichmentAction is null — never invented,
    // Onboarding guardrail 7). Degrades exactly per the v3 prompt's own
    // Step-0 rule: skip the call entirely; the affected fields already stay
    // read-only in createMode (Details.fragment.xml), so there is nothing
    // pending to lose here.
    enrich: function (oContext, oEnrichmentData) {
      if (!ServiceSchema.enrichmentAction) {
        return Promise.resolve({ skipped: true, reason: "enrichment action not available (ADDENDUM-001, pending backend activation)" });
      }
      // TODO-VERIFY once the action ships: qualified name + parameter shape.
      var oAction = oContext.getModel().bindContext(ServiceSchema.enrichmentAction + "(...)", oContext);
      Object.keys(oEnrichmentData || {}).forEach(function (sKey) {
        oAction.setParameter(sKey, oEnrichmentData[sKey]);
      });
      return oAction.invoke();
    },

    // Step ③ — IoH deep-create/createFromProposal from the local IoH rows
    // (CR-002: IoH is a separate, decoupled activity document). BLOCKED-BY-
    // SERVICE: the IoH BO/companion service (design/prompts/e008_ext_build.md)
    // is a build prompt only, nothing is activated on-system yet
    // (ServiceSchema.iohCreateAction is null). Degrades the same way as step
    // ②: skip, rows stay local-only and are lost on exit — documented, not
    // silently swallowed (see NOTES.md).
    submitIoH: function (sSalesDocument, aRows) {
      if (!ServiceSchema.iohCreateAction) {
        return Promise.resolve({ skipped: true, reason: "IoH backend not available (design/prompts/e008_ext_build.md, not yet activated)", rows: aRows });
      }
      // TODO-VERIFY once the IoH BO/companion service ships: real invocation.
      return Promise.resolve({ skipped: false, salesDocument: sSalesDocument, rows: aRows });
    }
  };

  return CreateOrderService;
});
