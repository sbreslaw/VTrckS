sap.ui.define([], function () {
  "use strict";

  // CR-1014-001 §2: the ONLY place order-type role flags are produced. All true
  // for now; the backend authorization check (CR §2.3, separate CR) replaces this.
  return {
    resolve: function (aOrderTypes) {
      var mFlags = {};
      aOrderTypes.forEach(function (sOrderType) {
        mFlags[sOrderType] = { READ: true, CREATE: true, UPDATE: true };
      });
      return mFlags;
    }
  };
});
