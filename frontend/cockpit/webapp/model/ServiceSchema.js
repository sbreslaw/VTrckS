// ADR-002 (Returns_Single_App_Service_Profile) facade: this module used to BE
// the flat object of every OData literal in the app; it is now a thin
// pass-through that copies whichever profile Component.js selects
// (model/schema/OrdersSchema.js or model/schema/ReturnsSchema.js) based on the
// launch category (_ORD vs _RET). Every consumer in this app keeps reading
// `ServiceSchema.<key>` exactly as before - nothing outside Component.js
// calls `use()`.
sap.ui.define([
  "sap/base/Log"
], function (Log) {
  "use strict";

  var sUsedProfileId = null;

  var ServiceSchema = {
    // Called from Component.init(), BEFORE any other module reads
    // ServiceSchema.* and BEFORE the default ODataModel is constructed (the
    // model's own serviceUrl comes from oProfile.serviceRoot). Copies every
    // own-enumerable key from the profile onto this facade object so existing
    // `ServiceSchema.entitySets.header` style reads keep working unchanged.
    //
    // Live-confirmed (FLP sandbox, 2026-10-27): re-launching the app's own
    // tile in the SAME browser tab (Home -> tile -> Home -> tile, no full
    // page reload) creates a brand-new Component instance but reuses the
    // SAME loaded module graph - the facade's own module-level state (this
    // closure) persists across that re-launch, so use() legitimately runs
    // again for every fresh Component.init(). This is NOT the "called twice
    // within one bootstrap" programming error the original one-shot guard
    // was meant to catch - just overwrite and log at warning level if the
    // profile actually changed (cross-category relaunch - ADR-002 doesn't
    // promise this works for any already-lazily-cached, profile-reading
    // module instantiated under the previous profile, but it must not crash
    // the new Component's own bootstrap).
    use: function (oProfile) {
      if (!oProfile || !oProfile.serviceRoot) {
        throw new Error("ServiceSchema.use() requires a profile object with a serviceRoot");
      }
      if (sUsedProfileId && sUsedProfileId !== oProfile.profileId) {
        Log.warning("ServiceSchema.use(): re-selecting profile '" + oProfile.profileId + "' over previously-used '" + sUsedProfileId + "' in the same browser session - only safe across a fresh Component re-launch, never within one running instance");
      }
      Object.keys(oProfile).forEach(function (sKey) {
        ServiceSchema[sKey] = oProfile[sKey];
      });
      sUsedProfileId = oProfile.profileId;
      return ServiceSchema;
    }
  };

  return ServiceSchema;
});
