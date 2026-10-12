sap.ui.define([
  "cdc/vaccreq/model/ServiceSchema"
], function (ServiceSchema) {
  "use strict";

  function quantity(vValue) {
    var fValue = Number(vValue);
    return Number.isFinite(fValue) ? fValue : null;
  }

  function isValidRow(oRow) {
    return !!(oRow.ndc && oRow.lot && oRow.expirationDate && quantity(oRow.quantity) !== null);
  }

  function responseError(oResponse, oBody) {
    var vMessage = oBody && oBody.error && oBody.error.message;
    var sMessage = typeof vMessage === "string" ? vMessage : vMessage && vMessage.value;
    return new Error(sMessage || "Provider inventory submission failed (HTTP " + oResponse.status + ")");
  }

  function parseBody(oResponse) {
    return oResponse.text().then(function (sBody) {
      var oBody = sBody ? JSON.parse(sBody) : {};
      if (!oResponse.ok) {
        throw responseError(oResponse, oBody);
      }
      return oBody;
    });
  }

  var ProviderInventoryService = {
    hasInvalidRows: function (aRows) {
      return (aRows || []).some(function (oRow) {
        return !isValidRow(oRow);
      });
    },

    save: function (sProviderId, aRows) {
      var oSchema = ServiceSchema.providerOrderService;
      var oPayload = {
        SoldToParty: sProviderId,
        _Items: (aRows || []).map(function (oRow) {
          return {
            Material: oRow.ndc,
            Batch: oRow.lot,
            Quantity: quantity(oRow.quantity),
            ExpirationDate: oRow.expirationDate
          };
        })
      };
      return fetch(oSchema.serviceRoot + oSchema.entitySets.providerIoh + "/" + oSchema.submitInventoryAction, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "OData-Version": "4.0"
        },
        body: JSON.stringify(oPayload)
      }).then(parseBody).then(function (oResult) {
        if (oResult && oResult.Success === false) {
          throw new Error(oResult.Message || "Provider inventory submission failed");
        }
        return oResult || { Success: true };
      });
    }
  };

  return ProviderInventoryService;
});