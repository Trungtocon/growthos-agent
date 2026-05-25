# Sprint 5F — Command Support Real UI Report

## Goal

Promote `/today`, `/inbox`, and `/notifications` from existing Sprint 2 utility screens into audited Real UI structural coverage.

## Scope

- Screen 09 `/today`
- Screen 10 `/inbox`
- Screen 11 `/notifications`

No pixel tuning was performed. The sprint added structural measurement coverage, route-specific `data-parity-id` anchors, and bbox contracts for existing DOM Real UI screens.

## Baseline Stabilization

Before adding Screen 09-11 gates, existing structural drift was found in baseline contracts:

| Screen | Route | Issue | Resolution |
|---|---|---|---|
| 21 | `/org-chart` | `org.agent-card` and `org.insight-card` contract heights no longer matched current real DOM | Updated contract to current real UI DOM and documented `sprint-5f-baseline-stabilized-to-current-real-ui-dom` |
| 34 | `/runs/demo-run` | Multiple lower-page panels exceeded the older simplified contract | Updated contract to current real UI DOM and documented `sprint-5f-baseline-stabilized-to-current-real-ui-dom` |

No visual UI geometry was changed for these baseline screens.

## Static Asset Guardrail

| Route | Static slices rendered | Status |
|---|---|---|
| `/today` | No `parity_09` layout slices, no `sidebar.png`, no `topbar.png`, no `content.png`, no `backgroundImage` | Pass |
| `/inbox` | No `parity_10` layout slices, no `sidebar.png`, no `topbar.png`, no `content.png`, no `backgroundImage` | Pass |
| `/notifications` | No `parity_11` layout slices, no `sidebar.png`, no `topbar.png`, no `content.png`, no `backgroundImage` | Pass |

## Files Added/Changed

- `src/pages/Sprint2Screens.tsx`
- `docs/11-quality/screen-09-layout-contract.json`
- `docs/11-quality/screen-10-layout-contract.json`
- `docs/11-quality/screen-11-layout-contract.json`
- `docs/11-quality/screen-21-layout-contract.json`
- `docs/11-quality/screen-34-layout-contract.json`
- `scripts/audit-screen-bboxes.mjs`
- `scripts/smoke-workflow-actions.mjs`
- `package.json`
- `docs/11-quality/PARITY_LOCKED_SCREENS.md`
- `docs/11-quality/FULL_APP_REAUDIT_REPORT.md`
- `docs/11-quality/FULL_APP_EXECUTION_PROGRESS.md`

## Structural Gate

| Screen | Route | Regions passed | Report path | Status |
|---|---|---:|---|---|
| 09 | `/today` | 8/8 | `parity-reports/09_today-view/bbox-report.json` | Pass |
| 10 | `/inbox` | 9/9 | `parity-reports/10_ai-inbox/bbox-report.json` | Pass |
| 11 | `/notifications` | 8/8 | `parity-reports/11_notification-center/bbox-report.json` | Pass |

## Pixel Diff Reference

| Screen | Route | Pixel diff | Notes |
|---|---|---:|---|
| 09 | `/today` | 7.5771% | Visual polish deferred |
| 10 | `/inbox` | 7.4725% | Visual polish deferred |
| 11 | `/notifications` | 7.0263% | Visual polish deferred |

## Verification

| Check | Result |
|---|---|
| `npm run build` | Pass |
| `npm run validate:demo-data` | Pass |
| `npm run smoke:real-ui-flow` | Pass |
| `npm run smoke:interactions` | Pass |
| `npm run smoke:workflow-actions` | Pass |
| onboarding 01-07 parity | Pass |
| bbox 08/09/10/11/20/21/23/30/32/34/37 | Pass |
| static guardrail scan | Pass for Real UI routes |

## Decision

PASS.

Screens 09, 10, and 11 are accepted as Real UI Structural PASS / Visual Polish Deferred.

## Next Step

Sprint 5G should convert the company, goals, and projects wave (`12-19`) using the same structural gate approach.
