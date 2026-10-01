sap.ui.define([
  "sap/ui/core/Messaging",
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/model/Enums",
  "cdc/vaccreq/model/MessageExtractor"
], function (Messaging, ServiceSchema, Enums, MessageExtractor) {
  "use strict";

  // CRUD Task 1 v5 (design/E008_CRUD1_v5_Sticky_Amendment.md) — reinstates
  // the v4 scratch-context/replay design below as the accepted architecture;
  // the later "Provider-first bootstrap" mandate (Fix-Sequencing Prompt) is
  // VOID. Root cause it closes: CreateWithSalesOrderType can never be fired
  // as a standalone, user-visible step. This entity set is
  // SAP__session.StickySessionSupported (design/so.xml ~9983) — the action
  // alone only opens a buffered, not-yet-numbered session (confirmed live:
  // its own response has SalesOrder:"") and InsertRestrictions.Insertable=
  // false means a raw POST/deep-insert against SalesOrderManage always 405s
  // regardless of payload. Nothing persists until SaveChanges (the real SD
  // commit, like VA01/VA02) runs — and that rejects a header-only, zero-item
  // order (hasMinItems() enforces this client-side first).
  //
  // So: every createMode fragment (Details/OrgData/Shipping/Items) binds to
  // a transient list-binding context (enter(), below) — a pure LOCAL
  // SCRATCHPAD, edited in the deferred "vrCreate" group, whose batch is
  // NEVER submitted (nothing in it was ever POST-able anyway). At Save, its
  // accumulated values are harvested and REPLAYED for real: (1)
  // CreateWithSalesOrderType, (2) item deep-creates on the resulting sticky
  // session, (3) SaveChanges (assigns the real key), (4) a PATCH of the
  // remaining header fields the action doesn't accept — all in one
  // dedicated group, "vrCreateReplay" (v5 Required Fix 1: never "vrEdit",
  // so a stray pending change-mode edit can never ride the same changeset).
  // Any failure from step (1) onward triggers a best-effort DiscardChanges
  // cleanup (v5 Required Fix 2) before the original error is re-thrown.
  var CREATE_GROUP = ServiceSchema.createUpdateGroup;
  var CREATE_REPLAY_GROUP = ServiceSchema.createReplayGroup;
  // Ancillary Items & Opt-Out session prompt: the group every in-session
  // item POST/PATCH/refresh rides once the sticky session is opened EARLY
  // (on first complete item row), never the deferred CREATE_REPLAY_GROUP —
  // see ServiceSchema.js itemInteractiveGroup doc comment.
  var ITEM_GROUP = ServiceSchema.itemInteractiveGroup;
  // v5 Required Fix 4 (replay-list drift guard): this list is DERIVED from
  // updatableHeaderProperties in ServiceSchema.js, not hand-maintained here —
  // see the comment there.
  var REPLAY_HEADER_PROPERTIES = ServiceSchema.createReplayHeaderProperties;
  // Issue Batch 9-30-001 §2 (payload hygiene): the observed live create POST
  // (issues/9-30-001.md #2) also sent SalesOrderItem ("000010" - the client's
  // own scratch numbering, not a real key), SalesOrderItemText (the backend
  // already defaults this from the Product master - see
  // Detail.controller.js#onItemNdcValueHelpRequest's own doc comment), and
  // ZZIndustryStandardName - none of which F3893 (the reference "Manage
  // Sales Order" app) ever sends on create. This whitelist is the ONLY
  // fields actually harvested onto the create payload (cleanItemPayload
  // below) - the six ZZ*QTY mirrors are Nullable="false" Int32s and must
  // always be present (onItemsAddRow seeds them to 0).
  var ITEM_PROPERTIES = [
    ServiceSchema.itemProperties.material,
    ServiceSchema.itemProperties.quantity,
    ServiceSchema.itemProperties.unit,
    ServiceSchema.itemProperties.exisId,
    ServiceSchema.itemProperties.orderIntention,
    ServiceSchema.itemProperties.fundType,
    ServiceSchema.itemProperties.deliveryPriority,
    ServiceSchema.itemProperties.vfcQty,
    ServiceSchema.itemProperties.stateQty,
    ServiceSchema.itemProperties.qty317,
    ServiceSchema.itemProperties.chipQty,
    ServiceSchema.itemProperties.panQty,
    ServiceSchema.itemProperties.resQty
  ];

  // Never JSON.stringify the message model's data in a log statement —
  // sap.ui.core.message.Message#processor points back at this very model, so
  // stringifying it throws "Converting circular structure to JSON" and
  // swallows the real error. Map to plain summaries instead of passing the
  // live Message instances straight to console.error - the browser console
  // otherwise collapses an array of them to "(n) [constructor, constructor...]",
  // hiding the actual backend validation text without manually expanding each.
  function logMessages() {
    return Messaging.getMessageModel().getData().map(function (oMessage) {
      return { message: oMessage.getMessage(), type: oMessage.getType(), targets: oMessage.getTargets(), technicalDetails: oMessage.getTechnicalDetails && oMessage.getTechnicalDetails() };
    });
  }

  // v5 Required Fix 2 (session hygiene) — best-effort cleanup of a sticky
  // session CreateWithSalesOrderType already opened, when a LATER replay
  // step (item deep-create or SaveChanges itself) fails. DiscardChanges is
  // unbound (ServiceSchema.discardAction, no "_it" parameter at all in
  // design/so.xml) — invoked via its ActionImport path; the OData V4 model
  // correlates it to this model's currently-open sticky session (the
  // SAP-ContextId header the framework already tracks from the NewAction
  // response). Never lets a discard failure mask the original error.
  // TODO-VERIFY on first live forced-failure test (v5 verification trace).
  function discardSession(oModel, sReason) {
    var oDiscardAction = oModel.bindContext(ServiceSchema.discardAction + "(...)");
    var pDiscard = oDiscardAction.execute(CREATE_REPLAY_GROUP);
    // Issue Batch 9-30-001 §5: submitBatch()'s OWN returned promise also
    // rejects whenever the batch it just sent contains a failing request -
    // leaving it unawaited/uncaught here is exactly the "Uncaught (in
    // promise) Error: Unspecified provider error" seen in
    // issues/9-30-001.md #5's console trace (pDiscard's catch below only
    // ever covered oDiscardAction.execute()'s own promise, a SEPARATE one).
    oModel.submitBatch(CREATE_REPLAY_GROUP).catch(function () { /* surfaced via pDiscard below */ });
    return pDiscard.catch(function (oDiscardError) {
      console.error("CreateOrderService: DiscardChanges cleanup failed (" + sReason + ")",
        "\nerror:", oDiscardError && oDiscardError.message, oDiscardError);
    });
  }

  // Shared by _ensureSession (early open, on first complete item row) and
  // save()'s own fallback path (session never opened) - same params either
  // way, see "UX phasing + triad sourcing" (v5 amendment) for why these come
  // off the scratch header data rather than the fixed salesArea constant.
  function buildCreateActionParams(oScratchData) {
    return {
      SalesOrderType: ServiceSchema.fixedOrderTypes[0],
      SalesOrganization: oScratchData[ServiceSchema.headerProperties.salesOrganization] || ServiceSchema.salesArea.salesOrganization,
      DistributionChannel: oScratchData[ServiceSchema.headerProperties.distributionChannel] || ServiceSchema.salesArea.distributionChannel,
      OrganizationDivision: oScratchData[ServiceSchema.headerProperties.division] || ServiceSchema.salesArea.organizationDivision,
      SoldToPartyForCreate: oScratchData[ServiceSchema.headerProperties.providerId] || ""
    };
  }

  // Issue Batch 9-30-001 §2 (payload hygiene): keeps ONLY the ITEM_PROPERTIES
  // whitelist above - replaces the old "strip OData annotation keys, keep
  // everything else" approach, which is what let SalesOrderItem/
  // SalesOrderItemText/ZZIndustryStandardName (plain property names, no
  // annotation characters to strip) leak into the create payload.
  function cleanItemPayload(oItemData) {
    var oClean = {};
    Object.keys(oItemData || {}).forEach(function (sProperty) {
      if (ITEM_PROPERTIES.indexOf(sProperty) !== -1 && oItemData[sProperty] !== undefined) {
        oClean[sProperty] = oItemData[sProperty];
      }
    });
    return oClean;
  }

  var CreateOrderService = {
    UPDATE_GROUP: CREATE_GROUP,

    // Exposed so Detail.controller.js can re-seed local scratch rows from
    // an orphaned session's row data (session-death recovery) with the
    // exact same whitelist this module itself replays - no second,
    // drift-prone copy of ITEM_PROPERTIES.
    cleanItemPayload: cleanItemPayload,

    // Enter create mode: a transient list-binding context bound to the whole
    // Detail view — a local scratchpad only (see header comment above); no
    // backend contact happens here, and its own group is never submitted.
    // Seeds SalesOrderType/the fixed sales-area triplet as DEFAULT DISPLAY
    // VALUES only, so the OrgData/Details read-only Text controls show
    // something real immediately, before a Provider is even picked. Once
    // Detail.controller.js#onProviderValueHelpRequest harvests the real
    // triad off the selected VH row, it overwrites these three properties on
    // this same context — save() below then reads whatever is there at that
    // point (the harvested values, or these seeded constants as a fallback
    // only if a picked row somehow lacked them).
    enter: function (oModel) {
      var oListBinding = oModel.bindList("/" + ServiceSchema.entitySets.header, undefined, undefined, undefined, {
        $$updateGroupId: CREATE_GROUP
      });
      var oInitialData = {};
      oInitialData[ServiceSchema.headerProperties.salesOrderType] = ServiceSchema.fixedOrderTypes[0];
      oInitialData[ServiceSchema.headerProperties.salesOrganization] = ServiceSchema.salesArea.salesOrganization;
      oInitialData[ServiceSchema.headerProperties.distributionChannel] = ServiceSchema.salesArea.distributionChannel;
      oInitialData[ServiceSchema.headerProperties.division] = ServiceSchema.salesArea.organizationDivision;
      oInitialData[ServiceSchema.headerProperties.category] = ServiceSchema.defaultCategory;
      oInitialData[ServiceSchema.headerProperties.shippingCondition] = ServiceSchema.defaultShippingCondition;
      var oContext = oListBinding.create(oInitialData);
      // Deleting this transient, never-submitted context later (Cancel, or
      // save()'s own cleanup after replay) cancels its still-pending POST,
      // which rejects created()'s promise - swallow it here since nothing
      // else awaits it; otherwise it surfaces as an uncaught rejection.
      oContext.created().catch(function () {});
      // Ancillary Items & Opt-Out session prompt: mutable state for the
      // early-opened sticky session (opened on the FIRST complete item row,
      // not at Save - see _ensureSession/postItem below). `opened`/
      // `plainContext` start empty; `pending` guards concurrent callers
      // (e.g. two rows completing back-to-back) from opening it twice.
      var oSession = { opened: false, plainContext: null, pending: null };
      return { listBinding: oListBinding, context: oContext, session: oSession };
    },

    // Cancel pre-Save. Nothing was ever sent to the backend for the HEADER
    // scratch (its group is never submitted) - a plain local delete is
    // enough for that. But if items were already posted interactively (a
    // real sticky session is open, oSession.opened), that session genuinely
    // holds server-side data now - v5 Required Fix 2 (session hygiene)
    // applies here too, same as a mid-Save failure: DiscardChanges it before
    // abandoning create mode, don't just leave it to expire on its own.
    cancel: function (oContext, oSession) {
      var pDiscard = (oSession && oSession.opened && oSession.plainContext)
        ? discardSession(oContext.getModel(), "user cancelled create with items already posted in-session")
        : Promise.resolve();
      return pDiscard.then(function () {
        return oContext.delete();
      });
    },

    isDirty: function (oContext) {
      var oModel = oContext && oContext.getModel();
      return !!oModel && oModel.hasPendingChanges(CREATE_GROUP);
    },

    // v5 amendment §3.1 (items go interactive-in-session): opens the sticky
    // session EARLY - the instant the first scratch item row becomes
    // complete - instead of waiting for the final Save button (the prior
    // behavior, still used by save()'s own fallback path below if this was
    // never called, e.g. a header-only retry). Idempotent/re-entrant: a
    // session already opened (or currently opening) is reused, never opened
    // twice. Resolves with the plain sticky context every in-session item
    // POST/PATCH/refresh binds against (ServiceSchema.buildHeaderPath("")),
    // same canonical-path pattern save() already uses, just under
    // ITEM_GROUP ($auto) instead of CREATE_REPLAY_GROUP.
    _ensureSession: function (oSession, oScratchContext) {
      if (oSession.opened && oSession.plainContext) {
        return Promise.resolve(oSession.plainContext);
      }
      if (oSession.pending) {
        return oSession.pending;
      }
      var oModel = oScratchContext.getModel();
      var oScratchData = oScratchContext.getObject() || {};
      var oHeaderListBinding = oModel.bindList("/" + ServiceSchema.entitySets.header);
      var oAction = oModel.bindContext(ServiceSchema.createAction + "(...)", oHeaderListBinding.getHeaderContext(), {
        $select: "SAP__Messages"
      });
      var oActionParams = buildCreateActionParams(oScratchData);
      Object.keys(oActionParams).forEach(function (sKey) {
        oAction.setParameter(sKey, oActionParams[sKey]);
      });
      var pExecute = oAction.execute(ITEM_GROUP);
      oSession.pending = pExecute
        .catch(function (oError) {
          console.error("CreateOrderService._ensureSession: CreateWithSalesOrderType (early open) failed",
            "\nparameters sent:", oActionParams, "\nerror:", oError && oError.message, oError, "\nmessages:", logMessages());
          throw oError;
        })
        .then(function () {
          var oPlainContext = oModel.bindContext(ServiceSchema.buildHeaderPath(""), undefined, {
            $$updateGroupId: ITEM_GROUP
          }).getBoundContext();
          oSession.opened = true;
          oSession.plainContext = oPlainContext;
          return oPlainContext;
        })
        .then(function (oPlainContext) {
          oSession.pending = null;
          return oPlainContext;
        }, function (oError) {
          oSession.pending = null;
          throw oError;
        });
      return oSession.pending;
    },

    // v5 amendment §3.1: POST one completed scratch row straight to the
    // sticky session's own `_Item` navigation ($auto, immediate - matches
    // the observed opt-out traces' group). Opens the session first if this
    // is the very first item (_ensureSession). Resolves once the server
    // response for THIS item lands (created() promise) - the row now carries
    // server truth (adjusted quantity, real SalesOrderItem number); the
    // caller (Detail.controller.js) still owns rebinding the Items table to
    // this session and refreshing the list to pick up any auto-inserted
    // ancillary sibling rows (a single-entity POST response cannot include
    // them).
    postItem: function (oSession, oScratchContext, oItemData) {
      var oModel = oScratchContext.getModel();
      return CreateOrderService._ensureSession(oSession, oScratchContext).then(function (oStickyContext) {
        var oItemsBinding = oModel.bindList(ServiceSchema.navigation.headerToItems, oStickyContext, undefined, undefined, {
          $$updateGroupId: ITEM_GROUP,
          $select: "SAP__Messages"
        });
        var oNewItemContext = oItemsBinding.create(cleanItemPayload(oItemData));
        return oNewItemContext.created().then(function () {
          return oNewItemContext;
        });
      });
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

    // Replay the scratch transient context as a real create: ①
    // CreateWithSalesOrderType, ② item deep-creates on the resulting sticky
    // session, ③ SaveChanges (assigns the real key), ④ PATCH of the
    // remaining header fields. Resolves with the NEW, real context — callers
    // MUST switch to using this from here on (the scratch context is deleted
    // before this resolves). Rejects with the raw error (Detail.controller.js
    // uses MessageExtractor.js to parse it) if any step fails; a best-effort
    // DiscardChanges runs first for any failure from step ① onward (v5
    // Required Fix 2).
    save: function (oScratchContext, oItemsBinding, oSession) {
      // Message Accuracy & Hygiene task, Gap 1 - pre-attempt clearing: a
      // stale extractor/technical message from a PRIOR failed save attempt
      // must never carry over and look like part of THIS ①–④ attempt.
      MessageExtractor.clearStaleMessages();
      var oModel = oScratchContext.getModel();
      var oScratchData = oScratchContext.getObject() || {};

      // v5 amendment §3.1 (items go interactive-in-session): if a sticky
      // session was already opened earlier - the first complete scratch item
      // row triggered postItem()/_ensureSession() well before this Save
      // button press - it already holds every item the table shows. Step ②
      // (bulk item deep-create) DISAPPEARS for that case entirely; jump
      // straight to steps ③④ (SaveChanges commits what the session already
      // has, then the header-extras PATCH) via the shared tail below. Steps
      // ①③④ themselves are otherwise UNCHANGED from the original v5 shape -
      // only WHEN ① ran (here vs. earlier) differs.
      if (oSession && oSession.opened && oSession.plainContext) {
        return CreateOrderService._commitStickySession(oModel, oSession.plainContext, oScratchContext, oScratchData, oSession);
      }

      // Fallback - session never opened interactively (e.g. Save reached
      // with zero items ever completed through the new row-complete seam;
      // should be rare, hasMinItems already blocks a zero-item Save): the
      // original, full ①②③④ replay, unchanged.
      var oHeaderListBinding = oModel.bindList("/" + ServiceSchema.entitySets.header);
      // Message Accuracy & Hygiene task, Gap 0: SAP__Messages is opt-in via
      // $select (RAP's bound-message channel, not returned by default) -
      // explicit $select, not $$inheritExpandSelect, per the workaround
      // bindings already in play here.
      var oAction = oModel.bindContext(ServiceSchema.createAction + "(...)", oHeaderListBinding.getHeaderContext(), {
        $select: "SAP__Messages"
      });
      // SalesOrderType is a fixed constant (Nullable="false", one value in
      // fixedOrderTypes). The sales-area triad and SoldToPartyForCreate are
      // both real user choices now (v5 amendment, "UX phasing + triad
      // sourcing"): Detail.controller.js#onProviderValueHelpRequest harvests
      // SalesOrganization/DistributionChannel/Division straight off the
      // selected Provider VH row (a KNVV-shaped Customer x sales-area
      // combination) onto this same scratch context, alongside SoldToParty -
      // ServiceSchema.salesArea is only a fallback if a picked row somehow
      // lacked area columns (should never happen in practice, TODO-VERIFY(B4)).
      var oActionParams = buildCreateActionParams(oScratchData);
      Object.keys(oActionParams).forEach(function (sKey) {
        oAction.setParameter(sKey, oActionParams[sKey]);
      });

      // "vrCreateReplay" is submit:"API" (manifest.json) - execute()'s
      // promise only resolves once the batch is actually sent, so
      // submitBatch() must be triggered alongside it, not chained inside its
      // .then() (that would deadlock: submitBatch() would never run because
      // execute() never resolves without it).
      var oExecutePromise = oAction.execute(CREATE_REPLAY_GROUP);
      // Issue Batch 9-30-001 §5: submitBatch()'s own promise also rejects on a
      // failing batch - surfaced already via oExecutePromise's catch below,
      // so swallow this second, redundant rejection instead of leaving it
      // uncaught (see the identical fix/comment on discardSession above).
      oModel.submitBatch(CREATE_REPLAY_GROUP).catch(function () { /* surfaced via oExecutePromise below */ });

      return oExecutePromise
        .catch(function (oError) {
          // A rejection here means no sticky session was ever opened —
          // nothing to discard, just surface the error (e.g. a business-
          // validation failure on the action's own required parameters, most
          // likely the hardcoded salesArea triplet no longer matching this
          // customer/provider — see ServiceSchema.js TODO-VERIFY(B4)).
          console.error("CreateOrderService.save: CreateWithSalesOrderType request failed",
            "\nparameters sent:", oActionParams,
            "\nerror:", oError && oError.message, oError,
            "\nmessages:", logMessages());
          throw oError;
        })
        .then(function () {
          // Attach items directly to the sticky session: there is no action
          // parameter for items on CreateWithSalesOrderType (design/so.xml),
          // and setProperty/PATCH against this context is unsupported ("not
          // a (navigation) property") — but a deep-create via the _Item
          // navigation is a plain POST the metamodel CAN resolve. They must
          // be attached here, before SaveChanges — SaveChanges is the actual
          // SD commit and is expected to reject a header-only order.
          var oStickyPlainContext = oModel.bindContext(ServiceSchema.buildHeaderPath(""), undefined, {
            $$updateGroupId: CREATE_REPLAY_GROUP
          }).getBoundContext();
          var aScratchItemContexts = (oItemsBinding && oItemsBinding.getCurrentContexts) ? oItemsBinding.getCurrentContexts() : [];
          // Gap 0 correction (live network evidence): item-level validation
          // messages (e.g. VI-028/FI-759) attach to the _Item entity itself, not
          // the header - the create action's $select above never covered this
          // separate POST, so it was still coming back with no SAP__Messages.
          var oStickyItemsBinding = oModel.bindList(ServiceSchema.navigation.headerToItems, oStickyPlainContext, undefined, undefined, {
            $$updateGroupId: CREATE_REPLAY_GROUP,
            $select: "SAP__Messages"
          });
          aScratchItemContexts.forEach(function (oItemContext) {
            oStickyItemsBinding.create(cleanItemPayload(oItemContext.getObject() || {}));
          });
          var oItemsPromise = oModel.submitBatch(CREATE_REPLAY_GROUP);

          return oItemsPromise
            .catch(function (oError) {
              console.error("CreateOrderService.save: item deep-create on sticky session failed",
                "\nerror:", oError && oError.message, oError,
                "\nmessages:", logMessages());
              return discardSession(oModel, "item deep-create failed").then(function () {
                throw oError;
              });
            })
            .then(function () {
              return CreateOrderService._commitStickySession(oModel, oStickyPlainContext, oScratchContext, oScratchData, oSession);
            });
        });
    },

    // Internal — steps ③④ shared by BOTH save() paths above: SaveChanges
    // (commits + assigns the real key) and the header-extras PATCH. Bound
    // onto oStickyPlainContext, NOT the CreateWithSalesOrderType action's own
    // bound context - see the (still-applicable) v5 gotcha comment history
    // above for why a plain canonical-path context is required here instead.
    _commitStickySession: function (oModel, oStickyPlainContext, oScratchContext, oScratchData, oSession) {
      // v5 gotcha, round 6 (live test, 2026-08-28): without an explicit
      // $$updateGroupId here (unlike its sibling contexts elsewhere in this
      // flow), this operation binding fell back to "$auto" instead of
      // CREATE_REPLAY_GROUP - confirmed live via Network tab, the
      // execute(CREATE_REPLAY_GROUP, ...) argument alone did NOT force it.
      // Gap 0 (Message Accuracy & Hygiene task): same $select opt-in as the
      // create action - SaveChanges is the real SD commit and the most
      // likely place VI-028/FI-759-style business messages actually arrive.
      var oSaveAction = oModel.bindContext(ServiceSchema.saveAction + "(...)", oStickyPlainContext, {
        $$updateGroupId: CREATE_REPLAY_GROUP,
        $select: "SAP__Messages"
      });
      // bIgnoreETag=true sends If-Match:* - safe regardless of whether the
      // model already cached a real ETag for this context from earlier
      // in-session activity (a wildcard match always succeeds).
      var oSavePromise = oSaveAction.execute(CREATE_REPLAY_GROUP, true);
      // Issue Batch 9-30-001 §5: same unhandled-rejection fix as
      // discardSession/save()'s fallback path above.
      oModel.submitBatch(CREATE_REPLAY_GROUP).catch(function () { /* surfaced via oSavePromise below */ });

      return oSavePromise
        .catch(function (oError) {
          console.error("CreateOrderService.save: SaveChanges request failed",
            "\nerror:", oError && oError.message, oError,
            "\nmessages:", logMessages());
          // Issue Batch 9-30-001 §5 follow-up (live evidence, 2026-09-30):
          // Branch B originally skipped DiscardChanges here, assuming a
          // failed SaveChanges always kills the session server-side too
          // (true in that one trace) - but a later retry proved the
          // opposite: the session can survive a failed SaveChanges, and
          // skipping the discard left it open server-side, so the NEXT
          // Save's CreateWithSalesOrderType 400'd ("cannot process more
          // than one sales document in one session"). Always attempt the
          // best-effort discard now - discardSession() already swallows its
          // own failure (e.g. the "session is off" case where it really was
          // already dead), so this covers both outcomes instead of
          // gambling on one.
          return discardSession(oModel, "SaveChanges failed").then(function () {
            if (oSession) {
              oSession.opened = false;
              oSession.plainContext = null;
            }
            throw oError;
          });
        })
        .then(function () {
          var oSaveResultContext = oSaveAction.getBoundContext();
          var sNewId = oSaveResultContext.getProperty(ServiceSchema.keys.orderId);
          if (!sNewId) {
            // Fail fast: an empty key here means the order still
            // wasn't actually persisted - proceeding would silently
            // PATCH against a bogus "SalesOrder=''" path instead of
            // surfacing the real failure.
            console.error("CreateOrderService.save: SaveChanges returned no " + ServiceSchema.keys.orderId,
              "\nraw value:", JSON.stringify(sNewId),
              "\nfull action result entity:", oSaveResultContext.getObject(),
              "\nmessages:", logMessages());
            return discardSession(oModel, "SaveChanges returned no key").then(function () {
              throw new Error("SaveChanges returned no " + ServiceSchema.keys.orderId + " - order was not created");
            });
          }
          // Now a normal, fully-numbered order - PATCH its remaining
          // header fields against the canonical path exactly like an
          // existing order (EditRequestService.js). Items are already
          // attached (either interactively, or by the fallback's own bulk
          // deep-create above) - do not create them again here.
          //
          // v5 Required Fix 3 (unverified, live-test task): does this
          // sessionless PATCH (no PrepareForEdit/SaveChanges bracket
          // around it) actually persist? Verify with: set an
          // updatableHeaderProperties field (e.g. Order Reason) during
          // create, hard-refresh, VA03-check. If it does NOT persist,
          // wrap this call in PrepareForEdit/SaveChanges instead
          // (EditRequestService.js's edit-session pattern).
          var oNewContext = oModel.bindContext(ServiceSchema.buildHeaderPath(sNewId), undefined, {
            $$updateGroupId: CREATE_REPLAY_GROUP
          }).getBoundContext();
          return CreateOrderService._replayHeaderProperties(oNewContext, oScratchData).then(function () {
            // Both SaveChanges above and this PATCH just succeeded,
            // each re-running the same backend validation - collapse
            // the resulting exact-duplicate messages (see
            // MessageExtractor.dedupeMessages doc comment).
            MessageExtractor.dedupeMessages();
            // oScratchContext is a still-pending, never-submitted
            // transient create (deferred "vrCreate" group, nothing
            // was ever POSTed for it) - deleting it locally always
            // rejects with "Request canceled", which is expected/
            // benign here and must never surface as an uncaught error.
            oScratchContext.delete().catch(function () {});
            // oNewContext was only ever bound to a path, never GET'd -
            // getProperty() on it is a synchronous cache read that
            // fails ("invalid segment") since nothing populated the
            // cache yet. Return the already-known sNewId alongside it
            // instead of making callers call getProperty() on it.
            return { context: oNewContext, orderId: sNewId };
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

      return oNewContext.getModel().submitBatch(CREATE_REPLAY_GROUP);
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

