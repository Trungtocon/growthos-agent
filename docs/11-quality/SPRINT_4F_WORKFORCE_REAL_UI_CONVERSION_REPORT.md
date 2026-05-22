# Sprint 4F - Workforce Real UI Conversion Report

## Goal

Convert `/workforce` from static parity expectations to real UI components using the structural gate model established for `/command-center`.

## Baseline

- Screen 08 `/command-center` is accepted as Real UI Structural PASS / Visual Polish Deferred.
- Static screenshot routes are not accepted as production-ready for AppShell screens.
- Pixel diff is recorded as a polish metric, not the primary real UI conversion gate.

## Route Map

| Screen | Route | Active component | AppShell | Mode |
|---|---|---|---|---|
| 08 | `/command-center` | `CommandCenter` | Yes | Real UI Structural PASS |
| 20 | `/workforce` | `WorkforceOverviewRealPage` | Yes | Real UI Structural PASS |

## Static Asset Guardrail

| Check | Result |
|---|---|
| `/workforce` renders `parity_20/sidebar.png` | No |
| `/workforce` renders `parity_20/topbar.png` | No |
| `/workforce` renders `parity_20/content.png` | No |
| `/workforce` renders screenshot `backgroundImage` | No |
| `/command-center` static guardrail | Pass |

## Components Added/Changed

- `WorkforceOverviewRealPage`
- Workforce header, KPI band, main grid, left panel, right panel
- Workforce health, agent status, top agents, workload, cost, and recommendations cards
- Generic DOM bounding-box audit script
- Screen 20 layout contract

## Structural Gate

| Region | Expected | Actual | dx | dy | dw | dh | Status |
|---|---|---|---:|---:|---:|---:|---|
| app-shell.sidebar | 0/0/258/941 | 0/0/258/941 | 0 | 0 | 0 | 0 | passed |
| app-shell.topbar | 258/0/1414/72 | 258/0/1414/72 | 0 | 0 | 0 | 0 | passed |
| app-shell.main | 280/98/1370/843 | 280/98/1370/843 | 0 | 0 | 0 | 0 | passed |
| workforce.header | 280/98/1370/64 | 280/98/1370/64 | 0 | 0 | 0 | 0 | passed |
| workforce.kpi-band | 280/178/1370/112 | 280/178/1370/112 | 0 | 0 | 0 | 0 | passed |
| workforce.main-grid | 280/310/1370/582 | 280/310/1370/582 | 0 | 0 | 0 | 0 | passed |
| workforce.left-panel | 280/310/906/582 | 280/310/900/582 | 0 | 0 | -6 | 0 | passed |
| workforce.right-panel | 1206/310/444/582 | 1200/310/450/582 | -6 | 0 | 6 | 0 | passed |
| workforce.health-card | 280/310/443/304 | 280/310/440/304 | 0 | 0 | -3 | 0 | passed |
| workforce.agent-status-card | 743/310/443/304 | 740/310/440/304 | -3 | 0 | -3 | 0 | passed |
| workforce.top-agents-card | 1206/310/444/304 | 1200/310/450/304 | -6 | 0 | 6 | 0 | passed |
| workforce.workload-card | 280/634/443/258 | 280/634/440/258 | 0 | 0 | -3 | 0 | passed |
| workforce.cost-card | 743/634/443/258 | 740/634/440/258 | -3 | 0 | -3 | 0 | passed |
| workforce.recommendations-card | 1206/634/444/258 | 1200/634/450/258 | -6 | 0 | 6 | 0 | passed |

## Pixel Diff Reference

| Screen | Route | Pixel diff | Notes |
|---|---|---:|---|
| 20 | `/workforce` | 9.4318% | Visual polish deferred |

## Verification

| Check | Result |
|---|---|
| `npm run build` | Pass |
| Onboarding 01-07 parity regression | Pass |
| `npm run audit:bbox:08` | Pass, 14/14 |
| `npm run audit:bbox:20` | Pass, 14/14 |
| `STRICT_MAX_DIFF_PERCENT=15.0 npm run parity:check -- --ids=20` | Pass, 9.4318% |

## Decision

Sprint 4F: **PASS**.

## Next Step

Convert `/tickets` using the same real UI structural gate approach.
