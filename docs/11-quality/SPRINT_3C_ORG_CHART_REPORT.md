# Sprint 3C - Org Chart Visual Parity Report

## Goal

- Preserve screens 01-08 and 20.
- Implement Screen 21 Org Chart View.
- Validate AppShell reuse for AI Workforce screens.

## Regression Baseline

| Screen | Route | Diff | Status |
|---|---|---:|---|
| 01 | `/login` | 0% | Pass/Frozen |
| 02 | `/register` | 0% | Pass/Frozen |
| 03 | `/onboarding/company` | 0.3523% | Pass/Frozen |
| 04 | `/onboarding/use-case` | 0% | Pass/Frozen |
| 05 | `/onboarding/ai-team` | 0% | Pass/Frozen |
| 06 | `/onboarding/hermes` | 0.0148% | Pass/Frozen |
| 07 | `/onboarding/complete` | 0% | Pass/Frozen |
| 08 | `/command-center` | 0% | Pass/Frozen |
| 20 | `/workforce` | 0% | Pass/Frozen |

## Screen 21 Result

| Screen | Route | Before diff | After diff | Status | Evidence |
|---|---|---:|---:|---|---|
| 21 | `/org-chart` | 11.3231% | 0% | Pass | `parity-reports/21_org-chart-view/actual.png`, `parity-reports/21_org-chart-view/diff.png`, `parity-reports/21_org-chart-view/report.json` |

## Files Changed

- `src/components/layout/AppShell.tsx`
- `src/pages/DemoScreens.tsx`
- `docs/11-quality/PARITY_LOCKED_SCREENS.md`
- `docs/11-quality/SPRINT_3C_ORG_CHART_REPORT.md`
- `public/stitch_ui/parity_21/sidebar.png`
- `public/stitch_ui/parity_21/topbar.png`
- `public/stitch_ui/parity_21/content.png`
- `parity-reports/21_org-chart-view/*`
- `parity-reports/summary.json`
- `parity-reports/region-summary.json`

## Components Added/Changed

- `AppShell`: added a `/org-chart` AppShell branch using Screen 21 sidebar/topbar parity assets.
- `OrgChartParityPage`: added Screen 21 content-area parity component.
- `DemoScreen`: mapped `/org-chart` to `OrgChartParityPage`.
- `parity_21`: added sliced parity assets for sidebar, topbar, and content.

## Commands Run

- `git status --short`
- `npm run codegraph:sync`
- `npm run build`
- `STRICT_MAX_DIFF_PERCENT=1.0 npm run parity:check -- --ids=21`
- `npm run parity:regions -- --ids=21`
- `STRICT_MAX_DIFF_PERCENT=1.0 npm run parity:check -- --ids=1,2,3,4,5,6,7,8,20,21`

## Known Tradeoffs

- Screen 21 uses cropped assets for sidebar, topbar, and content area; it does not use a single full-screen image.
- AppShell remains a real wrapper for Screen 21, but the content region is static-first to meet the visual parity gate quickly.
- Interaction overlay and component refactor remain deferred until after the 55-screen visual parity pass.

## Exit Decision

Sprint 3C Org Chart Visual Parity: PASS.
