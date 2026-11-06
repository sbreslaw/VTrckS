## What / why
<!-- One paragraph. Reference the task/spec you were given, if any. -->

## Evidence
- Task/spec reference (if provided by the code owner):
- Live test: <!-- what was exercised on the dev system; network trace / SE16 / VA03 check where relevant -->
- Console clean: [ ]   Keyboard pass: [ ]   i18n complete: [ ]
- Accessibility — screen reader pass (NVDA or equivalent) on changed flows: [ ]
- Accessibility — 200%/browser-zoom and Windows High Contrast (HCB/HCW) check on changed views: [ ]
- Accessibility — no color-only signaling introduced (status/criticality conveyed via icon+text, not color alone): [ ]

## Checklist
- [ ] No service/entity/property literals outside `model/ServiceSchema.js`
- [ ] No business literals (fund codes, etc.) outside their provider/seam modules
- [ ] Update groups used only in their own flow (`vrCreate` / `vrEdit` / `vrCreateReplay`)
- [ ] No `SimpleForm`, no `localStorage`, no V2 model idioms
- [ ] createMode regression checked if any Items/Details gating changed
- [ ] Branch is up to date with `main`
