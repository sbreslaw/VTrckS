# Payload Contract — OrderCreate Action (Create New Provider Order)

**Status: UNCONFIRMED — pending backend sign-off**

Source: `design/NEwVaccReq.md` (CRUD Task 1 Prompt v2 — supersedes v1). This
describes the *proposed* request/response shape only. No custom `OrderCreate`
action currently exists on the service bound today (`C_SALESORDERMANAGE_SD` —
confirmed via `$metadata`/`localService/metadata.xml` and `design/so.xml`
inspection; only standard actions such as `CreateWithSalesOrderType` and
`CreateWithRefFromSlsQuotation` are present). `frontend/cockpit/webapp/service/CreateRequestService.js`
implements the request mapper (`buildPayload`) and the invocation (`create`)
behind a single module boundary, and currently falls back to a temporary mock
resolve (`USE_MOCK = true`) until the real action ships — see that file's
header comment and `NOTES.md` ("CRUD Task 1" entry) for details.

This file is the single place to update once the backend confirms or changes
the shape; `ServiceSchema.createPayloadFields`/`createPayloadUom`/`orderCreateAction`
are the only places the field names appear in code (grep-isolation pattern).

## Request

```json
{
  "provider": "string (SoldToParty ID) — required",
  "description": "string — required",
  "contactId": "string — optional, omitted if empty",
  "priority": "NORMAL | HIGH — optional, omitted if empty",
  "orderReason": "NATURAL_DISASTER | OUTBREAK_RESPONSE | OTHER — optional, omitted if empty",
  "category": "INTERNET_SALES | PROVIDER_EMAILED | PROVIDER_FAXED | PROVIDER_TELEPHONED | VACMAN — optional, omitted if empty",
  "exisId": "string — optional, omitted if empty",
  "items": [
    {
      "ndc": "string — required",
      "quantity": "number > 0 — required",
      "uom": "EA — fixed, always sent literally",
      "intention": "ADULT | PED_AND_ADULT | PEDIATRIC — required, default PED_AND_ADULT"
    }
  ]
}
```

Empty/unset optional header fields are omitted entirely from the payload (not
sent as `null`/`""`). At least one valid item row is required
(`Enums.MIN_ITEMS = 1`); rows missing an NDC or with a non-positive quantity
are dropped by `buildPayload` before the request is sent.

## Response — success

```json
{
  "salesDocument": "string (new SalesOrder / Provider Order ID)",
  "messages": [ { "type": "string", "text": "string", "target": "string (optional)" } ]
}
```

## Response — failure

```json
{
  "messages": [
    { "type": "Error", "text": "string", "target": "provider | description | items/<index>/ndc | items/<index>/quantity (optional)" }
  ]
}
```
`CreateRequestDialog.js` maps `target === "provider"`/`"description"` and
`items/<n>/(ndc|quantity)` onto the matching field's `valueState`; anything
else (or untargeted) is shown in the dialog's top-level error summary.

## Backend dependencies (blockers — tracked in `PHASE2_AUDIT.md` / `OPEN_QUESTIONS.md`)

1. `OrderCreate` action — exact name, parameter shape (structured parameters
   vs. a single `Edm.String` JSON payload), and response shape. **Not present
   in the currently bound `$metadata`.**
2. `ZI_VR_CONTACTVH` (BUT051/BUT000, provider-parameterized) — value help
   exposure for the Contact field (currently a disabled Input).
3. `ZI_VR_NDCVH` (MARA/MAKT) — value help exposure for the NDC field
   (currently a plain enabled Input).
4. Enum key confirmation: Priority / Order Reason / Category codes; Intention
   keys (MVGR1 mapping) — see `webapp/model/Enums.js`.
5. Description → VBAK-KTEXT physical mapping (informational, backend-side
   only — no frontend action needed).

Flip the status line above to **CONFIRMED — <date>** once the backend signs
off, then update `ServiceSchema.orderCreateAction`, flip
`CreateRequestService.USE_MOCK` to `false`, and complete the real-invocation
`TODO-VERIFY` items in that file.
