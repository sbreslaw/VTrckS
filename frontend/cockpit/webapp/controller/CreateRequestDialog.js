sap.ui.define([
  "sap/ui/core/Fragment",
  "sap/ui/model/json/JSONModel",
  "cdc/vaccreq/model/Enums",
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/service/CreateRequestService"
], function (Fragment, JSONModel, Enums, ServiceSchema, CreateRequestService) {
  "use strict";

  // Standalone dialog handler owned by Master.controller.js (CRUD Task 1,
  // design/NEwVaccReq.md). Master lazy-instantiates this once, then calls
  // open(fnOnSuccess); this object owns the dialog's own lifecycle
  // (open/close/validate/create), and only hands back to Master via
  // fnOnSuccess(sSalesDocument) for the shared post-success steps
  // (toast/refresh/navigate).
  function CreateRequestDialog(oMasterController) {
    this._oMasterController = oMasterController;
  }

  CreateRequestDialog.prototype.open = function (fnOnSuccess) {
    this._fnOnSuccess = fnOnSuccess;
    if (!this._oDialog) {
      return this._createDialog().then(function () {
        this._resetModel();
        this._oDialog.open();
      }.bind(this));
    }
    this._resetModel();
    this._oDialog.open();
    return Promise.resolve();
  };

  CreateRequestDialog.prototype._createDialog = function () {
    var oView = this._oMasterController.getView();
    return Fragment.load({
      id: oView.getId(),
      name: "cdc.vaccreq.view.fragments.CreateRequestDialog",
      controller: this
    }).then(function (oDialog) {
      this._oDialog = oDialog;
      oView.addDependent(oDialog);
    }.bind(this));
  };

  CreateRequestDialog.prototype._getBundle = function () {
    return this._oMasterController.getOwnerComponent().getModel("i18n").getResourceBundle();
  };

  CreateRequestDialog.prototype._resolveEnumItems = function (aEnum, oBundle, bAddEmpty) {
    var aItems = aEnum.map(function (oEntry) {
      return { key: oEntry.key, text: oBundle.getText(oEntry.i18nKey) };
    });
    if (bAddEmpty) {
      aItems.unshift({ key: "", text: oBundle.getText("selectNone") });
    }
    return aItems;
  };

  CreateRequestDialog.prototype._newItemRow = function () {
    return {
      ndc: "", ndcState: "None",
      quantity: "", quantityState: "None",
      uom: ServiceSchema.createPayloadUom,
      intention: Enums.INTENTION_DEFAULT
    };
  };

  CreateRequestDialog.prototype._resetModel = function () {
    var oBundle = this._getBundle();
    var oData = {
      busy: false,
      provider: "", providerState: "None", providerStateText: "",
      description: "", descriptionState: "None", descriptionStateText: "",
      contactId: "",
      priority: "",
      orderReason: "",
      category: "",
      exisId: "",
      items: [this._newItemRow()],
      itemsStateText: "",
      errorSummary: "",
      enums: {
        priority: this._resolveEnumItems(Enums.PRIORITY, oBundle, true),
        orderReason: this._resolveEnumItems(Enums.ORDER_REASON, oBundle, true),
        category: this._resolveEnumItems(Enums.CATEGORY, oBundle, true),
        intention: this._resolveEnumItems(Enums.INTENTION, oBundle, false)
      }
    };
    this._oDialog.setModel(new JSONModel(oData), "create");
  };

  CreateRequestDialog.prototype.onProviderChange = function () {
    // Contact is cleared automatically if Provider changes (design/NEwVaccReq.md
    // "Contact ... Cleared automatically if Provider changes"). Contact input is
    // currently disabled (no ZI_VR_CONTACTVH exposed yet), so this is a no-op in
    // practice today but kept so the behavior is already correct once the VH ships.
    this._oDialog.getModel("create").setProperty("/contactId", "");
  };

  CreateRequestDialog.prototype.onAddItem = function () {
    var oModel = this._oDialog.getModel("create");
    var aItems = oModel.getProperty("/items");
    aItems.push(this._newItemRow());
    oModel.setProperty("/items", aItems);
  };

  CreateRequestDialog.prototype.onDeleteItem = function (oEvent) {
    var oModel = this._oDialog.getModel("create");
    var oRowContext = oEvent.getSource().getParent().getBindingContext("create");
    var iIndex = Number(oRowContext.getPath().split("/").pop());
    var aItems = oModel.getProperty("/items");
    aItems.splice(iIndex, 1);
    oModel.setProperty("/items", aItems);
  };

  CreateRequestDialog.prototype.onCancelPress = function () {
    this._oDialog.close();
  };

  CreateRequestDialog.prototype.onCreatePress = function () {
    var oBundle = this._getBundle();
    var oModel = this._oDialog.getModel("create");
    if (!this._validate(oModel, oBundle)) {
      return;
    }

    var oData = oModel.getData();
    var oPayload = CreateRequestService.buildPayload(oData);
    oModel.setProperty("/busy", true);
    oModel.setProperty("/errorSummary", "");

    CreateRequestService.create(this._oMasterController.getView().getModel(), oPayload)
      .then(function (oResult) {
        oModel.setProperty("/busy", false);
        this._oDialog.close();
        if (this._fnOnSuccess) {
          this._fnOnSuccess(oResult.salesDocument);
        }
      }.bind(this))
      .catch(function (oError) {
        oModel.setProperty("/busy", false);
        this._applyServiceMessages(oModel, oBundle, (oError && oError.messages) || []);
      }.bind(this));
  };

  // Required: Provider, Description, >=1 valid item row (Enums.MIN_ITEMS) with
  // NDC + a positive Quantity. Sets per-field valueStates + a MessageStrip
  // summary; returns true only if every check passes.
  CreateRequestDialog.prototype._validate = function (oModel, oBundle) {
    var bValid = true;
    var sRequired = oBundle.getText("createRequestFieldRequired");

    var sProvider = oModel.getProperty("/provider");
    oModel.setProperty("/providerState", sProvider ? "None" : "Error");
    oModel.setProperty("/providerStateText", sProvider ? "" : sRequired);
    bValid = bValid && !!sProvider;

    var sDescription = oModel.getProperty("/description");
    oModel.setProperty("/descriptionState", sDescription ? "None" : "Error");
    oModel.setProperty("/descriptionStateText", sDescription ? "" : sRequired);
    bValid = bValid && !!sDescription;

    var aItems = oModel.getProperty("/items");
    var iValidRows = 0;
    aItems.forEach(function (oRow) {
      var fQty = parseFloat(oRow.quantity);
      var bRowValid = !!oRow.ndc && !isNaN(fQty) && fQty > 0;
      oRow.ndcState = oRow.ndc ? "None" : "Error";
      oRow.quantityState = (!isNaN(fQty) && fQty > 0) ? "None" : "Error";
      if (bRowValid) {
        iValidRows++;
      }
    });
    oModel.setProperty("/items", aItems);

    var bItemsValid = iValidRows >= Enums.MIN_ITEMS;
    oModel.setProperty("/itemsStateText", bItemsValid ? "" : oBundle.getText("createRequestMinItemsError"));
    bValid = bValid && bItemsValid;

    oModel.setProperty("/errorSummary", bValid ? "" : oBundle.getText("createRequestValidationSummary"));
    return bValid;
  };

  // Maps backend action messages (design/NEwVaccReq.md: "map target->field
  // valueState where provided") onto the same per-field states _validate uses;
  // anything untargeted (or with an unrecognized target) goes into the
  // top-level MessageStrip summary instead.
  CreateRequestDialog.prototype._applyServiceMessages = function (oModel, oBundle, aMessages) {
    var aUnmapped = [];
    var aItems = oModel.getProperty("/items");

    aMessages.forEach(function (oMessage) {
      var sTarget = oMessage.target;
      var oItemMatch = sTarget && /^items\/(\d+)\/(ndc|quantity)$/.exec(sTarget);
      if (sTarget === "provider") {
        oModel.setProperty("/providerState", "Error");
        oModel.setProperty("/providerStateText", oMessage.text);
      } else if (sTarget === "description") {
        oModel.setProperty("/descriptionState", "Error");
        oModel.setProperty("/descriptionStateText", oMessage.text);
      } else if (oItemMatch && aItems[oItemMatch[1]]) {
        aItems[oItemMatch[1]][oItemMatch[2] + "State"] = "Error";
      } else {
        aUnmapped.push(oMessage.text);
      }
    });

    oModel.setProperty("/items", aItems);
    oModel.setProperty("/errorSummary", aUnmapped.length ? aUnmapped.join("\n") : oBundle.getText("createRequestServiceError"));
  };

  return CreateRequestDialog;
});
