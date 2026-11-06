sap.ui.define([], function () {
  "use strict";

  // Sections Catalog (CR "Sections Catalog", PR1 — prompts/
  // E008_SectionsCatalog_Personalization_Session_Prompt.md §4.1). Single
  // source of truth for the Detail panel stack's STRUCTURAL facts — fragment
  // name, whether a section ever gets a live edit session, the one optional
  // header action, and which service profile(s) it is safe to render on
  // (ADR-002 $select hazard: a fragment with a literal property name absent
  // on the returns service must never be offered/rendered for `profileId:
  // "returns"`). Per-order-type, per-UI-mode visibility/editability/expanded
  // state is NOT here — that is `model/OrderModeConfig.js#resolveSections`,
  // which merges this catalog with per-type config. `SectionFactory.js` and
  // `Detail.controller.js` read this catalog (via `all()`) to build the panel
  // stack structure; nothing else may reference a fragment name directly.
  //
  // `profiles` is a conservative, metadata-confirmed list: a section with no
  // `sections/returns/<Name>.fragment.xml` variant and no ReturnsSchema.js
  // backing is marked orders-only here even though it is ALSO hidden by a
  // per-type `locked` flag today — the two are independent (locked is a
  // business decision that can change; profiles is a technical capability
  // that must not be bypassed by personalization). Re-verify against a fresh
  // metadata dump before ever widening one of these, per AGENT_ONBOARDING §0.
  //
  // `createCapable: false` marks a section that cannot bind against the
  // transient create-mode scratch context at all (today: partiesInvolved —
  // CreatePartner requires an already-persisted SalesOrderManageType
  // context, see PartiesInvolved.fragment.xml). Every other section is
  // createCapable: true even if it has no eager-expand-in-create behavior
  // (that is `expanded` under OrderModeConfig's `create` mode override, a
  // separate concern from "can it exist at all").
  var mSections = {
    details: { id: "details", titleKey: "sectionDetails", fragment: "cdc.vaccreq.sections.Details", editable: true, editLive: true, profiles: ["orders", "returns"], createCapable: true },
    items: { id: "items", titleKey: "sectionItems", fragment: "cdc.vaccreq.sections.Items", editable: true, editLive: true, profiles: ["orders", "returns"], createCapable: true },
    inventory: {
      id: "inventory",
      titleKey: "sectionInventory",
      fragment: "cdc.vaccreq.sections.Inventory",
      editable: false,
      profiles: ["orders"],
      createCapable: true,
      headerAction: { id: "editList", titleKey: "sectionEditList", press: "onInventoryEditListPress", createOnly: true }
    },
    shipping: { id: "shipping", titleKey: "sectionShipping", fragment: "cdc.vaccreq.sections.Shipping", editable: true, editLive: true, profiles: ["orders", "returns"], createCapable: true },
    shippingTransactions: { id: "shippingTransactions", titleKey: "sectionShippingTransactions", fragment: "cdc.vaccreq.sections.ShippingTransactions", editable: false, profiles: ["orders"], createCapable: true },
    transactionHistory: { id: "transactionHistory", titleKey: "sectionTransactionHistory", fragment: "cdc.vaccreq.sections.TransactionHistory", editable: false, profiles: ["orders"], createCapable: true },
    orgData: { id: "orgData", titleKey: "sectionOrgData", fragment: "cdc.vaccreq.sections.OrgData", editable: true, editLive: true, profiles: ["orders"], createCapable: true },
    // NOTES.md 2026-11-05 (VTrckS@21882e9): ReturnsSchema.js already declares
    // pricingElements.properties for HeaderPricingElementType — technically
    // profile-safe — but the section stays business-hidden (locked) for
    // every _RET type until a decision to unhide it.
    priceTotals: { id: "priceTotals", titleKey: "sectionPriceTotals", fragment: "cdc.vaccreq.sections.PriceTotals", editable: false, profiles: ["orders", "returns"], createCapable: true },
    paymentMethod: { id: "paymentMethod", titleKey: "sectionPaymentMethod", fragment: "cdc.vaccreq.sections.PaymentMethod", editable: true, profiles: ["orders"], createCapable: true },
    scheduledActions: { id: "scheduledActions", titleKey: "sectionScheduledActions", fragment: "cdc.vaccreq.sections.ScheduledActions", editable: false, profiles: ["orders"], createCapable: true },
    status: { id: "status", titleKey: "sectionStatus", fragment: "cdc.vaccreq.sections.Status", editable: false, profiles: ["orders"], createCapable: true },
    dates: { id: "dates", titleKey: "sectionDates", fragment: "cdc.vaccreq.sections.Dates", editable: false, profiles: ["orders"], createCapable: true },
    partiesInvolved: { id: "partiesInvolved", titleKey: "sectionPartiesInvolved", fragment: "cdc.vaccreq.sections.PartiesInvolved", editable: false, profiles: ["orders"], createCapable: false },
    attachments: { id: "attachments", titleKey: "sectionAttachments", fragment: "cdc.vaccreq.sections.Attachments", editable: false, profiles: ["orders"], createCapable: true }
    // Billing intentionally excluded (client request, 2026-10-01 — Billing.fragment.xml
    // stays on disk, unreferenced; see the prior SectionConfig.js history).
  };

  // Render order = object key insertion order above (every consumer iterates `all()`).
  var aOrder = Object.keys(mSections);

  function get(sId) {
    return mSections[sId];
  }

  function all() {
    return aOrder.map(function (sId) { return mSections[sId]; });
  }

  function availableFor(sProfileId) {
    return all().filter(function (oEntry) {
      return oEntry.profiles.indexOf(sProfileId) !== -1;
    });
  }

  return {
    get: get,
    all: all,
    availableFor: availableFor
  };
});
