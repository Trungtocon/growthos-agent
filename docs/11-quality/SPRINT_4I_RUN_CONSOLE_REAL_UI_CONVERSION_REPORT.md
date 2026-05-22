# Sprint 4I - Run Console Real UI Conversion Report

## Goal

Convert `/runs/demo-run` from static parity expectations to real UI components using the structural gate.

## Baseline

- Screen 08: Real UI Structural PASS / Visual Polish Deferred.
- Screen 20: Real UI Structural PASS / Visual Polish Deferred.
- Screen 30: Real UI Structural PASS / Visual Polish Deferred.
- Screen 32: Real UI Structural PASS / Visual Polish Deferred.

## Route Map

| Screen | Route | Active component | AppShell | Mode |
|---|---|---|---|---|
| 34 | `/runs/demo-run` | `RunConsoleRealPage` | Yes | Real UI Structural PASS |

## Static Asset Guardrail

| Check | Result |
|---|---|
| `parity_34/sidebar.png` rendered | No |
| `parity_34/topbar.png` rendered | No |
| `parity_34/content.png` rendered | No |
| `backgroundImage` rendered | No |
| Full-screen screenshot rendered | No |

## Components Added/Changed

- `RunConsoleRealPage`
- `RunHeader`
- `RunStatusBand`
- `RunTimelinePanel`
- `RunLogsPanel`
- `RunInspectorPanel`
- Screen 34 layout contract
- `audit:bbox:34` npm script

## Structural Gate

| Region | Expected | Actual | dx | dy | dw | dh | Status |
|---|---|---|---:|---:|---:|---:|---|
| `app-shell.sidebar` | 0, 0, 190, 941 | 0, 0, 190, 941 | 0 | 0 | 0 | 0 | Pass |
| `app-shell.topbar` | 190, 0, 1482, 54 | 190, 0, 1482, 54 | 0 | 0 | 0 | 0 | Pass |
| `app-shell.main` | 216, 70, 1430, 1359.5 | 216, 70, 1430, 1359.5 | 0 | 0 | 0 | 0 | Pass |
| `run.header` | 216, 70, 1430, 53.5 | 216, 70, 1430, 53.5 | 0 | 0 | 0 | 0 | Pass |
| `run.status-band` | 216, 135.5, 1430, 230 | 216, 135.5, 1430, 230 | 0 | 0 | 0 | 0 | Pass |
| `run.main-grid` | 216, 385.5, 1430, 1044 | 216, 385.5, 1430, 1044 | 0 | 0 | 0 | 0 | Pass |
| `run.timeline-panel` | 216, 385.5, 531.7, 1044 | 216, 385.5, 531.7, 1044 | 0 | 0 | 0 | 0 | Pass |
| `run.logs-panel` | 763.7, 385.5, 506.3, 1044 | 763.7, 385.5, 506.3, 1044 | 0 | 0 | 0 | 0 | Pass |
| `run.inspector-panel` | 1286, 385.5, 360, 1044 | 1286, 385.5, 360, 1044 | 0 | 0 | 0 | 0 | Pass |
| `run.timeline-card` | 216, 385.5, 531.7, 624 | 216, 385.5, 531.7, 624 | 0 | 0 | 0 | 0 | Pass |
| `run.tool-calls-card` | 763.7, 385.5, 506.3, 574 | 763.7, 385.5, 506.3, 574 | 0 | 0 | 0 | 0 | Pass |
| `run.logs-card` | 763.7, 975.5, 506.3, 370 | 763.7, 975.5, 506.3, 370 | 0 | 0 | 0 | 0 | Pass |
| `run.cost-card` | 1286, 663.5, 360, 166 | 1286, 663.5, 360, 166 | 0 | 0 | 0 | 0 | Pass |
| `run.risk-card` | 1286, 845.5, 360, 166 | 1286, 845.5, 360, 166 | 0 | 0 | 0 | 0 | Pass |
| `run.artifacts-card` | 1286, 1027.5, 360, 216 | 1286, 1027.5, 360, 216 | 0 | 0 | 0 | 0 | Pass |
| `run.controls-card` | 1286, 1259.5, 360, 170 | 1286, 1259.5, 360, 170 | 0 | 0 | 0 | 0 | Pass |

## Pixel Diff Reference

| Screen | Route | Pixel diff | Notes |
|---|---|---:|---|
| 34 | `/runs/demo-run` | 12.5042% | Visual polish deferred |

## Verification

| Check | Result |
|---|---|
| `npm run build` | Pass |
| Onboarding 01-07 parity regression | Pass |
| `npm run audit:bbox:08` | Pass, 14/14 |
| `npm run audit:bbox:20` | Pass, 14/14 |
| `npm run audit:bbox:30` | Pass, 12/12 |
| `npm run audit:bbox:32` | Pass, 15/15 |
| `npm run audit:bbox:34` | Pass, 16/16 |
| `STRICT_MAX_DIFF_PERCENT=15.0 npm run parity:check -- --ids=34` | Pass, 12.5042% |

## Decision

Sprint 4I: **PASS**.

## Next Step

Convert `/approvals` using the same structural gate.
