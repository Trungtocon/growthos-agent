# Sprint 5K - Budget and Reporting Real UI Conversion Report

## Goal

Convert the Budget & Reports manifest wave from scaffold fallback routes into real AppShell UI with selector-driven data and structural bbox gates.

## Screens

| Screen | Route | Component | Status |
|---|---|---|---|
| 42 | `/cost` | `CostDashboardScreen + AppShell` | Real UI Structural PASS |
| 43 | `/budget/settings` | `BudgetSettingsScreen + AppShell` | Real UI Structural PASS |
| 44 | `/reports` | `ReportsDashboardScreen + AppShell` | Real UI Structural PASS |
| 45 | `/reports/new` | `ReportBuilderScreen + AppShell` | Real UI Structural PASS |

## Static Asset Guardrail

| Route | Static slices rendered | Status |
|---|---|---|
| `/cost` | No `parity_42` slices, no `backgroundImage` | Pass |
| `/budget/settings` | No `parity_43` slices, no `backgroundImage` | Pass |
| `/reports` | No `parity_44` slices, no `backgroundImage` | Pass |
| `/reports/new` | No `parity_45` slices, no `backgroundImage` | Pass |

## Components Added/Changed

- `CostDashboardScreen`
- `BudgetSettingsScreen`
- `ReportsDashboardScreen`
- `ReportBuilderScreen`
- `selectCostDashboardViewModel`
- `selectBudgetSettingsViewModel`
- `selectReportsDashboardViewModel`
- `selectReportBuilderViewModel`

## Structural Gate

| Screen | Route | Regions passed | Status |
|---|---|---:|---|
| 42 | `/cost` | 8/8 | Pass |
| 43 | `/budget/settings` | 8/8 | Pass |
| 44 | `/reports` | 8/8 | Pass |
| 45 | `/reports/new` | 8/8 | Pass |

## Pixel Diff Reference

Pixel diff remains a visual polish metric, not the Sprint 5K acceptance gate.

| Screen | Route | Pixel diff | Notes |
|---|---|---:|---|
| 42 | `/cost` | 9.2909% | Visual polish deferred |
| 43 | `/budget/settings` | 7.5558% | Visual polish deferred |
| 44 | `/reports` | 6.8316% | Visual polish deferred |
| 45 | `/reports/new` | 7.5491% | Visual polish deferred |

## Verification

| Check | Result |
|---|---|
| `npm run build` | Pass |
| `npm run validate:demo-data` | Pass |
| `npm run smoke:real-ui-flow` | Pass |
| `npm run smoke:interactions` | Pass |
| `npm run smoke:workflow-actions` | Pass |
| onboarding 01-07 parity | Pass |
| bbox 08-45 | Pass |
| static guardrail | Pass |

## Decision

PASS.

## Next Step

Sprint 5L should convert the remaining integrations/workspace/admin/help routes beginning with screens 46-49.
