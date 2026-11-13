// Lot Number input rule (code owner 2026-11-13): free text, letters, digits and
// the dash only - every other character (e.g. ? * % & = < > ~ or a space) is
// rejected. Pure function, no UI5 controls; the caller supplies the max length
// from ServiceSchema.itemFieldLimits.
sap.ui.define([], function () {
  "use strict";

  var ALLOWED = /^[A-Za-z0-9-]*$/;

  return {
    // Returns { value } (trimmed, possibly "") when acceptable, otherwise
    // { error, args } with an i18n key (and its placeholder values).
    check: function (sRawValue, iMaxLength) {
      var sValue = String(sRawValue === undefined || sRawValue === null ? "" : sRawValue).trim();
      if (!ALLOWED.test(sValue)) {
        return { error: "lotNumberInvalidChars" };
      }
      if (iMaxLength && sValue.length > iMaxLength) {
        return { error: "pasteSkippedTooLong", args: [iMaxLength] };
      }
      return { value: sValue };
    }
  };
});
