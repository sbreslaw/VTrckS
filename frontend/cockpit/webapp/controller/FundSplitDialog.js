sap.ui.define([
  "sap/ui/core/Fragment",
  "sap/ui/model/json/JSONModel",
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/service/FundLogicService"
], function (Fragment, JSONModel, ServiceSchema, FundLogicService) {
  "use strict";

  // Fund Split dialog (design session prompt §3.1/3.2). One instance is
  // created lazily by Detail.controller.js and reused across rows/opens -
  // the working-copy JSONModel is fully rebuilt on every open() call, so
  // there is no state bleed between rows (Definition of Done, row-switch test).
  function FundSplitDialog(oView) {
    this._oView = oView;
    this._oDialogPromise = null;
    this._oDialog = null;
    this._oModel = null;
    this._oRowContext = null;
    this._fnResolveClosed = null;
  }

  FundSplitDialog.prototype._getDialog = function () {
    if (!this._oDialogPromise) {
      var that = this;
      this._oDialogPromise = Fragment.load({
        id: this._oView.getId(),
        name: "cdc.vaccreq.view.fragments.FundSplitDialog",
        controller: this
      }).then(function (oDialog) {
        that._oView.addDependent(oDialog);
        that._oDialog = oDialog;
        return oDialog;
      });
    }
    return this._oDialogPromise;
  };

  // oRowContext: the invoking item row's Context. sMode: "edit" | "view" -
  // decided by the caller via FundLogicService.isSplitFund, never a fund
  // literal in this dialog controller.
  FundSplitDialog.prototype.open = function (oRowContext, sMode) {
    var that = this;
    this._oRowContext = oRowContext;
    var oBundle = this._oView.getModel("i18n").getResourceBundle();
    var oItemProps = ServiceSchema.itemProperties;
    var oHeaderProps = ServiceSchema.headerProperties;
    var oHeaderContext = this._oView.getBindingContext();
    var sMaterial = oRowContext.getProperty(oItemProps.material);
    var sIntention = oRowContext.getProperty(oItemProps.orderIntention);
    var aOptions = FundLogicService.getAllocatableOptions(oBundle, sMaterial, sIntention);
    var bEditable = sMode === "edit";

    var oData = {
      editable: bEditable,
      total: 0,
      header: {
        providerId: oHeaderContext ? oHeaderContext.getProperty(oHeaderProps.providerId) : "",
        providerName: oHeaderContext ? oHeaderContext.getProperty(oHeaderProps.providerName) : "",
        material: sMaterial,
        materialText: oRowContext.getProperty(oItemProps.itemText),
        itemNumber: oRowContext.getProperty(oItemProps.itemNumber),
        orderQuantity: oRowContext.getProperty(oItemProps.quantity),
        brand: oRowContext.getProperty(oItemProps.brand),
        intention: sIntention
      },
      rows: FundLogicService.readAllocation(oRowContext, aOptions)
    };

    return this._getDialog().then(function (oDialog) {
      that._oModel = new JSONModel(oData);
      oDialog.setModel(that._oModel, "split");
      that._recalcTotal();
      oDialog.open();
      // Resolves on Done/Cancel (below) - callers that also need to react to
      // the ROW (e.g. post it to the session) must wait for this, not just
      // the dialog opening, or they'd race the user's still-in-progress split.
      return new Promise(function (resolve) {
        that._fnResolveClosed = resolve;
      });
    });
  };

  FundSplitDialog.prototype._recalcTotal = function () {
    var aRows = this._oModel.getProperty("/rows") || [];
    var iTotal = aRows.reduce(function (iSum, oRow) { return iSum + (oRow.Quantity || 0); }, 0);
    this._oModel.setProperty("/total", iTotal);
  };

  // Non-authoritative running total only - never blocks Done (backend judges
  // the split-sum validation at save, per the session prompt's standing
  // decision).
  FundSplitDialog.prototype.onQuantityChange = function () {
    this._recalcTotal();
  };

  FundSplitDialog.prototype.onDefaultSplitPress = function () {
    var aRows = this._oModel.getProperty("/rows") || [];
    aRows.forEach(function (oRow) { oRow.Quantity = 0; });
    this._oModel.setProperty("/rows", aRows);
    this._recalcTotal();
  };

  FundSplitDialog.prototype.onDonePress = function () {
    FundLogicService.commitSplit(this._oRowContext, this._oModel.getProperty("/rows") || []);
    this._oDialog.close();
    this._resolveClosed();
  };

  // Discards the working copy - the row's own context/properties were never
  // touched, so simply closing is enough (also reached via Escape, which
  // sap.m.Dialog handles the same way by default).
  FundSplitDialog.prototype.onCancelPress = function () {
    this._oDialog.close();
    this._resolveClosed();
  };

  FundSplitDialog.prototype._resolveClosed = function () {
    if (this._fnResolveClosed) {
      this._fnResolveClosed();
      this._fnResolveClosed = null;
    }
  };

  FundSplitDialog.prototype.formatIdText = function (sId, sText) {
    sId = sId || "";
    sText = sText || "";
    return sText ? (sId + " | " + sText) : sId;
  };

  FundSplitDialog.prototype.formatAllocatedTotal = function (iTotal, iOrderQuantity) {
    var oBundle = this._oView.getModel("i18n").getResourceBundle();
    return oBundle.getText("fundSplitAllocatedTotal", [iTotal || 0, iOrderQuantity || 0]);
  };

  return FundSplitDialog;
});
