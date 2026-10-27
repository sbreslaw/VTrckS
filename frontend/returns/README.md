# Manage Returns (`cdc.vaccret`)

Read-only Master/Detail SAPUI5 freestyle app over `UI_CUSTOMERRETURNMANAGE`
(customer returns: ZISL/ZXFR/ZWST/ZKR). A separate app from `frontend/cockpit`
— see `VTrckS-design/design/ADR-001_Returns_Separate_App.md` for why.

MVP-1 scope: list + display only. No create, no edit, no PATCH/POST.

## Run locally
```
npm install
npm start          # proxy to the live dev backend
npm run start-mock # local mock server (no backend needed)
```

See `AGENTS.md` in this folder for branch/PR conventions.
