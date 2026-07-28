# NOTES

## E008 Prototype Repoint (temporary C_SALESORDERMANAGE) - 2026-07-28

### Metadata Discovery (Step 0)

- Attempted metadata fetch endpoint:
  - https://TODO-VERIFY-S4-HOST/sap/opu/odata4/sap/c_salesordermanage_sd/srvd/sap/c_salesordermanage/0001/$metadata
- Result: host resolution failed (`TODO-VERIFY-S4-HOST` placeholder), so live metadata could not be retrieved from this workspace session.

### Provisional schema values (all TODO-VERIFY)

- Service root: `/sap/opu/odata4/sap/c_salesordermanage_sd/srvd/sap/c_salesordermanage/0001/`
- Header entity set: `SalesOrderManage`
- Item entity set: `SalesOrderItemManage`
- Header key: `SalesOrder`
- Draft key: `IsActiveEntity`
- Header -> item navigation: `to_Item`

### Draft and scope behavior implemented

- Fixed list filter for active entities: `IsActiveEntity eq true`
- Fixed list filter for order type allow-list: `SalesOrderType in [ZVR1]` (placeholder)

### Custom fields

- `ZZ1_*` custom fields could not be confirmed from metadata in this session.
- UI currently keeps Fund Type / Order Intention item columns hidden by default and labels custom header block as metadata pending.

### Validation-session warning

- The standard service will show all authorized SD orders unless the order-type filter is correctly configured.
- DCL jurisdiction scoping from the custom E008 service is not present in this temporary service shape.
