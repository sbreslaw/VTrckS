sap.ui.define([
  "sap/ui/Device"
], function (Device) {
  "use strict";

  var MIN_ROW_COUNT = 5;
  var MAX_ROW_COUNT = 15;

  function fit(oDialog, oTable) {
    var oDialogDomRef = oDialog.getDomRef();
    var oTableDomRef = oTable.getDomRef();
    var oContentDomRef = oDialogDomRef && oDialogDomRef.querySelector(".compVHContentContainer");
    var oRenderedRow = oTableDomRef && oTableDomRef.querySelector(".sapUiTableTr");
    var oTableContainerDomRef = oTableDomRef && oTableDomRef.parentElement;
    if (!oContentDomRef || !oTableDomRef || !oTableContainerDomRef) {
      return;
    }

    var oRowMode = oTable.getRowMode();
    var iRenderedRows = oTableDomRef.querySelectorAll(".sapUiTableTr").length;
    var iRowHeight = oRenderedRow ? oRenderedRow.getBoundingClientRect().height :
      (oRowMode.getRowContentHeight() || 33);
    var iCurrentRows = iRenderedRows || oRowMode.getMaxRowCount() || oRowMode.getMinRowCount();
    if (!iRowHeight || !iCurrentRows) {
      return;
    }

    var iTableHeight = oTableDomRef.getBoundingClientRect().height;
    var iExpectedRowsHeight = iCurrentRows * iRowHeight;
    var iTableChromeHeight = iRenderedRows || iTableHeight > iExpectedRowsHeight ?
      iTableHeight - iExpectedRowsHeight : iTableHeight;
    var iTableMarginBottom = parseFloat(getComputedStyle(oTableDomRef).marginBottom) || 0;
    var iAvailableTableHeight = oTableContainerDomRef.getBoundingClientRect().height - iTableMarginBottom;
    var iTargetRows = Math.floor((iAvailableTableHeight - iTableChromeHeight) / iRowHeight);
    var iOverflow = oContentDomRef.scrollHeight - oContentDomRef.clientHeight;
    if (iOverflow > 2) {
      iTargetRows -= Math.ceil(iOverflow / iRowHeight);
    }
    iTargetRows = Math.max(MIN_ROW_COUNT, Math.min(MAX_ROW_COUNT, iTargetRows));
    if (iTargetRows !== iCurrentRows) {
      oRowMode.setMinRowCount(iTargetRows);
      oRowMode.setMaxRowCount(iTargetRows);
    }
    if (iRenderedRows) {
      oTableDomRef.style.removeProperty("min-height");
    } else {
      oTableDomRef.style.minHeight = (iTableChromeHeight + (iTargetRows * iRowHeight)) + "px";
    }
  }

  function attach(oDialog, oTable, ResizeHandler) {
    var sResizeHandlerId;
    var iFitTimer;
    var fnFit = function () {
      clearTimeout(iFitTimer);
      iFitTimer = setTimeout(function () {
        fit(oDialog, oTable);
      }, 0);
    };

    oDialog.attachAfterOpen(function () {
      fit(oDialog, oTable);
      sResizeHandlerId = ResizeHandler.register(
        oDialog.getDomRef().querySelector(".compVHContentContainer"),
        fnFit
      );
      Device.resize.attachHandler(fnFit);
      oTable.attachRowsUpdated(fnFit);
    });
    oDialog.attachAfterClose(function () {
      clearTimeout(iFitTimer);
      Device.resize.detachHandler(fnFit);
      oTable.detachRowsUpdated(fnFit);
      if (sResizeHandlerId) {
        ResizeHandler.deregister(sResizeHandlerId);
        sResizeHandlerId = null;
      }
    });
  }

  return {
    attach: attach,
    fit: fit
  };
});