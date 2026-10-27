// Port of frontend/cockpit/webapp/service/CreateOrderService.js @ VTrckS,
// trimmed to what Step-0 proved this service actually needs
// (VTrckS-design traces/returns-create-probe-2026-10-26.md): UNLIKE
// SalesOrderManage, CreateWithCustomerReturnType does not need a local JS
// scratch buffer replayed after the fact — the create action and an
// in-session header PATCH (at least SoldToParty) both work immediately and
// stick, live-verified. So the session's own transient OData context IS the
// "scratch" state: every General-section Input in the create fragment is a
// normal two-way binding straight against it (groupId "vrCreate"), no
// replay batch. The one thing Step-0 proved CANNOT be a live two-way
// binding is an item row: once POSTed, an item's fields can no longer be
// PATCHed (nav-path PATCH 501s, non-containment; absolute-path PATCH 404s
// on the still-blank key; DELETE 400s, containment-only) — so item rows are
// gathered in a local scratch buffer by Detail.controller.js and POSTed
// only once complete (see Detail.controller.js#_isCreateItemRowComplete).
sap.ui.define([
  "cdc/vaccret/model/ServiceSchema"
], function (ServiceSchema) {
  "use strict";

  var CREATE_GROUP = ServiceSchema.groups.create;

  function CreateReturnService(oModel) {
    this._oModel = oModel;
    this._oHeaderContext = null;
    this._bSessionOpen = false;
  }

  CreateReturnService.prototype.isSessionOpen = function () {
    return this._bSessionOpen;
  };

  CreateReturnService.prototype.getHeaderContext = function () {
    return this._oHeaderContext;
  };

  // Fires CreateWithCustomerReturnType with the sales-area triad (read by
  // the caller from po>/CustomerSalesArea once Sold-To is picked — Step-0
  // §6: c_soldtosalesareavh does NOT carry this triad) and binds a plain
  // context at the canonical "('')" path, group "vrCreate" — every
  // two-way-bound Input in the create General/Items fragments PATCHes/POSTs
  // into this one group, flushed explicitly by save()/discard() only.
  CreateReturnService.prototype.enter = function (sReturnType, mTriad) {
    var oModel = this._oModel;
    var oHeaderListBinding = oModel.bindList("/" + ServiceSchema.sets.header);
    var oAction = oModel.bindContext(ServiceSchema.actions.createWithCustomerReturnType + "(...)", oHeaderListBinding.getHeaderContext(), {
      $select: "SAP__Messages"
    });
    oAction.setParameter("CustomerReturnType", sReturnType);
    oAction.setParameter("SalesOrganization", mTriad.salesOrganization);
    oAction.setParameter("DistributionChannel", mTriad.distributionChannel);
    oAction.setParameter("OrganizationDivision", mTriad.organizationDivision);
    var that = this;
    var pExecute = oAction.execute(CREATE_GROUP);
    var pSubmit = oModel.submitBatch(CREATE_GROUP);
    return Promise.all([pExecute, pSubmit]).then(function () {
      var oHeaderContext = oModel.bindContext(ServiceSchema.buildHeaderPath(""), undefined, {
        $$updateGroupId: CREATE_GROUP
      }).getBoundContext();
      that._oHeaderContext = oHeaderContext;
      that._bSessionOpen = true;
      return oHeaderContext;
    });
  };

  // Items table list binding, bound to the session header's _Item nav —
  // same update/create group as every other write in this session.
  CreateReturnService.prototype.bindItems = function () {
    return this._oModel.bindList(ServiceSchema.navs.headerToItem, this._oHeaderContext, undefined, undefined, {
      $$updateGroupId: CREATE_GROUP,
      $$groupId: CREATE_GROUP
    });
  };

  // POST one complete item row (Step-0: ALL known fields must be in this one
  // call — no post-POST PATCH is possible pre-save). oItemData keys are
  // ServiceSchema.itemProperties values; RequestedQuantity MUST be a raw
  // number (Step-0 §1: a quoted string 400s with an unparseable response).
  CreateReturnService.prototype.postItem = function (oItemsBinding, oItemData) {
    var oModel = this._oModel;
    var oContext = oItemsBinding.create(oItemData, false, true, { groupId: CREATE_GROUP });
    var pCreated = oContext.created();
    var pSubmit = oModel.submitBatch(CREATE_GROUP);
    return Promise.all([pCreated, pSubmit]).then(function () {
      return oContext;
    });
  };

  // submitBatch("vrCreate") + SaveChanges — the one group plan Step-0 proved
  // (no "vrCreateReplay" step needed for the header/item fields this app
  // writes in create). Resolves with the real, backend-assigned return number.
  CreateReturnService.prototype.save = function () {
    var oModel = this._oModel;
    var oHeaderContext = this._oHeaderContext;
    var oSave = oModel.bindContext(ServiceSchema.actions.saveChanges + "(...)", oHeaderContext, {
      $$updateGroupId: CREATE_GROUP,
      $select: "CustomerReturn,SAP__Messages"
    });
    var pExecute = oSave.execute(CREATE_GROUP, true);
    var pSubmit = oModel.submitBatch(CREATE_GROUP);
    return Promise.all([pExecute, pSubmit]).then(function () {
      return oSave.getBoundContext().getProperty(ServiceSchema.headerProperties.returnId);
    });
  };

  // DiscardChanges (unbound ActionImport) + local pending-change reset.
  // Safe to call even when the session was never opened (e.g. Cancel
  // pressed before Sold-To was picked) — then it is a pure local no-op.
  CreateReturnService.prototype.discard = function () {
    var oModel = this._oModel;
    var bWasOpen = this._bSessionOpen;
    if (oModel.hasPendingChanges(CREATE_GROUP)) {
      oModel.resetChanges(CREATE_GROUP);
    }
    this._bSessionOpen = false;
    this._oHeaderContext = null;
    if (!bWasOpen) {
      return Promise.resolve();
    }
    var oDiscard = oModel.bindContext(ServiceSchema.actions.discardChanges + "(...)");
    var pExecute = oDiscard.execute(CREATE_GROUP);
    var pSubmit = oModel.submitBatch(CREATE_GROUP);
    return Promise.all([pExecute, pSubmit]).catch(function (oError) {
      // Best-effort cleanup (cockpit's discardSession precedent) — never
      // lets a discard failure mask whatever error the caller already has.
      console.error("CreateReturnService.discard: DiscardChanges cleanup failed",
        oError && oError.message, oError);
    });
  };

  return CreateReturnService;
});
