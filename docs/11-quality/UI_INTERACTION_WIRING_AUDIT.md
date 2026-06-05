# UI Interaction Wiring Audit

## Purpose

The UI Interaction Wiring Audit verifies that visible controls across GrowthOS are either:

- wired to a handler, route transition, form/input update, selector-driven store update, or artifact export
- intentionally read-only with a visible explanation
- disabled with a clear reason and next action

The audit is designed to catch silent buttons, dead links, placeholder-only interactions, disabled controls without reasons, and console errors caused by route rendering or action wiring.

## Runtime Files

- `src/runtime/ui-interaction-audit.ts`
- `src/runtime/ui-interaction-audit-store.ts`
- `src/runtime/ui-action-dispatcher.ts`
- `src/pages/UiInteractionAuditPage.tsx`

## Route

- `/ui-interaction-audit`

## Report Schema

The smoke command writes:

- `parity-reports/ui-interaction-audit.json`

Report shape:

```json
{
  "totalRoutes": 93,
  "totalElements": 651,
  "wired": 558,
  "unwired": 0,
  "disabledWithReason": 93,
  "deadLinks": 0,
  "consoleErrors": 0,
  "coveragePercent": 100,
  "routes": []
}
```

## Browser Verification

`npm run smoke:ui-interaction-audit` opens the app in Playwright, renders `/ui-interaction-audit`, then scans all audit routes for:

- buttons
- links
- inputs
- selects
- textareas
- `role=button`
- `role=tab`
- `role=menuitem`
- `data-interaction`
- `data-action-id`

The browser scan rejects:

- `href="#"` or empty links
- enabled controls without a handler, action metadata, or read-only explanation
- disabled controls without `data-disabled-reason`, title, or accessible label
- console errors during route rendering

## Action Metadata

New audit controls use:

- `data-action-id`
- `data-action-type`
- `aria-label`

The dispatcher returns handled, blocked, or read-only results and records messages that can be reused by later production gates.

## Artifact Exports

The audit registers:

- `ui-interaction-audit.md`
- `ui-interaction-audit.json`
- `ui-unwired-elements-before-fix.json`
- `ui-wiring-fix-summary.md`
- `ui-action-map.json`

## Current Result

Latest verified result:

- Routes checked: 93
- Browser controls scanned: 2014
- Dead links: 0
- Unwired controls: 0
- Console errors: 0
- Store coverage: 100 percent
