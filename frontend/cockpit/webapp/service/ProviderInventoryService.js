sap.ui.define([
  "cdc/vaccreq/model/ServiceSchema"
], function (ServiceSchema) {
  "use strict";

  var UPDATE_GROUP = ServiceSchema.providerIohUpdateGroup;

  function quantity(vValue) {
    var fValue = Number(vValue);
    return Number.isFinite(fValue) ? String(fValue) : null;
  }

  function isValidNewRow(oRow) {
    return !!(oRow.ndc && oRow.lot && oRow.unit && quantity(oRow.quantity) !== null);
  }

  var ProviderInventoryService = {
    UPDATE_GROUP: UPDATE_GROUP,

    hasInvalidRows: function (aRows) {
      return (aRows || []).some(function (oRow) {
        return oRow.isNew && !isValidNewRow(oRow);
      });
    },

    save: function (oModel, oListBinding, sProviderId, aRows, aDeletedContexts) {
      if (!oListBinding) {
        return Promise.resolve({ skipped: true });
      }

      var oProps = ServiceSchema.providerOrderService.providerIohProperties;
      var aOperationPromises = [];

      (aDeletedContexts || []).forEach(function (oContext) {
        aOperationPromises.push(oContext.delete(UPDATE_GROUP));
      });

      (aRows || []).forEach(function (oRow) {
        var sQuantity = quantity(oRow.quantity);
        if (oRow.isNew) {
          var oPayload = {};
          oPayload[oProps.soldToParty] = sProviderId;
          oPayload[oProps.material] = oRow.ndc;
          oPayload[oProps.batch] = oRow.lot;
          oPayload[oProps.quantity] = sQuantity;
          oPayload[oProps.unit] = oRow.unit;
          oPayload[oProps.expirationDate] = oRow.expirationDate || null;
          oPayload[oProps.brand] = oRow.brand || "";
          aOperationPromises.push(oListBinding.create(oPayload).created());
          return;
        }

        if (oRow.backendContext && quantity(oRow.originalQuantity) !== sQuantity) {
          aOperationPromises.push(oRow.backendContext.setProperty(oProps.quantity, sQuantity, UPDATE_GROUP));
        }
      });

      if (!aOperationPromises.length) {
        return Promise.resolve({ skipped: true });
      }

      return oModel.submitBatch(UPDATE_GROUP).then(function () {
        if (oModel.hasPendingChanges(UPDATE_GROUP)) {
          throw new Error("Provider inventory save failed: one or more changes were rejected");
        }
        return Promise.all(aOperationPromises).then(function () {
          return { skipped: false };
        });
      }).catch(function (oError) {
        oModel.resetChanges(UPDATE_GROUP);
        throw oError;
      });
    }
  };

  return ProviderInventoryService;
});