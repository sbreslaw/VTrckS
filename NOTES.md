# NOTES

## E008 Prototype Repoint (temporary C_SALESORDERMANAGE) - 2026-07-28

### Metadata Discovery (Step 0)

- Metadata source used: `design/so.xml` (local service metadata snapshot).

### Confirmed service facts from so.xml

- Service root URL: `/sap/opu/odata4/sap/c_salesordermanage_sd/srvd/sap/c_salesordermanage/0001/`
- Header entity set: `SalesOrderManage` (EntityType `SalesOrderManageType`)
- Item entity set: `SalesOrderItem` (EntityType `SalesOrderItemType`)
- Header key: `SalesOrder` only (no `IsActiveEntity` key in metadata)
- Header -> item navigation: `_Item`
- Header -> partner navigation: `_Partner` (to `HeaderPartner`)
- Header -> ship-to navigation: `_ShipToParty` (to `HeaderShipToParty`)
- Header -> contact navigation: `_SoldToPartyContactInfo` (to `StandardPartnerContactInfo`)
- Status value list set: `OverallSDProcessStatus` with text `OverallSDProcessStatus_Text`

### Provisional schema values (all TODO-VERIFY)

- Remaining TODO: E008 order-type allow-list currently keeps placeholder `ZVR1` until backend confirms full set.

### Draft and scope behavior implemented

- Fixed list filter for order type allow-list: `SalesOrderType in [ZVR1]` (placeholder)
- `IsActiveEntity` fixed filter was removed because the key/property is not present in `so.xml` metadata.

### Custom fields

- `ZZ1_*` fields found on item entity:
  - `ZZ1_SKIPADDANC_SDI`
  - `ZZ1_OptOutAncillary_SDI`
  - `ZZ1_SKIPANC`
- No `ZZ1_*` fields found on `SalesOrderManageType` header entity in this metadata file.

### Validation-session warning

- The standard service will show all authorized SD orders unless the order-type filter is correctly configured.
- DCL jurisdiction scoping from the custom E008 service is not present in this temporary service shape.
