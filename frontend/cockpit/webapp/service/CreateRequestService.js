sap.ui.define([
  "sap/m/MessageBox",
  "cdc/vaccreq/model/ServiceSchema"
], function (MessageBox, ServiceSchema) {
  "use strict";

  // Create New Provider Order (CRUD Task 1, design/NEwVaccReq.md) bypasses the
  // client draft protocol entirely via a server-side OrderCreate action (ledger
  // note: AGENT_ONBOARDING guardrail #1's "no draft" gate now applies to edit
  // flows only, not this create flow).
  //
  // TODO(CRUD-BLOCKER): the OrderCreate action does not exist in the currently
  // bound service ($metadata confirmed 2026-08-19 — only standard
  // C_SALESORDERMANAGE_SD actions are present; see NOTES.md/PAYLOAD_CONTRACT.md).
  // USE_MOCK below is the work order's explicitly-sanctioned temporary bridge —
  // _mockCreate just alerts where the real invoke() belongs and fakes success;
  // flip to false and delete _mockCreate once the real action ships and is verified.
  var USE_MOCK = true;

  var F = ServiceSchema.createPayloadFields;

  function buildPayload(oDialogData) {
    oDialogData = oDialogData || {};
    var oPayload = {};
    oPayload[F.provider] = oDialogData.provider;
    oPayload[F.description] = oDialogData.description;
    if (oDialogData.contactId) { oPayload[F.contactId] = oDialogData.contactId; }
    if (oDialogData.priority) { oPayload[F.priority] = oDialogData.priority; }
    if (oDialogData.orderReason) { oPayload[F.orderReason] = oDialogData.orderReason; }
    if (oDialogData.category) { oPayload[F.category] = oDialogData.category; }
    if (oDialogData.exisId) { oPayload[F.exisId] = oDialogData.exisId; }

    oPayload.items = (oDialogData.items || [])
      .filter(function (oRow) { return oRow.ndc && Number(oRow.quantity) > 0; })
      .map(function (oRow) {
        var oItem = {};
        oItem[F.itemNdc] = oRow.ndc;
        oItem[F.itemQuantity] = Number(oRow.quantity);
        oItem[F.itemUom] = ServiceSchema.createPayloadUom;
        oItem[F.itemIntention] = oRow.intention;
        return oItem;
      });

    return oPayload;
  }

  // oModel: the app's main OData V4 model. Resolves {salesDocument, messages}
  // or rejects {messages} — messages: [{type, text, target?}].
  function create(oModel, oPayload) {
    if (USE_MOCK) {
      return _mockCreate(oPayload);
    }

    var sActionName = ServiceSchema.orderCreateAction; // TODO-VERIFY exact qualified name from $metadata
    var oAction = oModel.bindContext("/" + sActionName + "(...)");

    // TODO-VERIFY parameter shape against the real $metadata once the action
    // exists: either a structured parameter (set each field individually) or a
    // single Edm.String parameter carrying JSON.stringify(oPayload) — see
    // design/NEwVaccReq.md "Action discovery". Defaulting to the single-string
    // shape here; adjust the setParameter call(s) once confirmed.
    oAction.setParameter("Payload", JSON.stringify(oPayload));

    return oAction.invoke().then(function () {
      var oResultContext = oAction.getBoundContext();
      return {
        salesDocument: oResultContext.getProperty(ServiceSchema.keys.orderId),
        messages: []
      };
    }, function (oError) {
      throw { messages: _extractMessages(oError) };
    });
  }

  function _mockCreate(oPayload) {
    return new Promise(function (resolve) {
      MessageBox.alert("OrderCreate action will execute here.", {
        onClose: function () {
          resolve({
            salesDocument: "MOCK" + Date.now().toString().slice(-8),
            messages: []
          });
        }
      });
    });
  }

  function _extractMessages(oError) {
    if (oError && oError.error && Array.isArray(oError.error.details) && oError.error.details.length) {
      return oError.error.details.map(function (oDetail) {
        return { type: "Error", text: oDetail.message, target: oDetail.target };
      });
    }
    return [{ type: "Error", text: (oError && oError.message) || String(oError) }];
  }

  return {
    buildPayload: buildPayload,
    create: create
  };
});
