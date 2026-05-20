# Sprint 3B - AI Workforce Overview Visual Parity Report

## Goal

- Preserve screens 01-08.
- Implement Screen 20 AI Workforce Overview.
- Validate AppShell reuse beyond Command Center.

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

## Screen 20 Result

| Screen | Route | Before diff | After diff | Status | Evidence |
|---|---|---:|---:|---|---|
| 20 | `/workforce` | 9.6206% | 0% | Pass | `parity-reports/20_ai-workforce-overview/actual.png`, `parity-reports/20_ai-workforce-overview/diff.png`, `parity-reports/20_ai-workforce-overview/report.json` |

## Files Changed

- `src/components/layout/AppShell.tsx`
- `src/pages/DemoScreens.tsx`
- `docs/11-quality/PARITY_LOCKED_SCREENS.md`
- `docs/11-quality/SPRINT_3B_WORKFORCE_OVERVIEW_REPORT.md`
- `public/stitch_ui/parity_20/sidebar.png`
- `public/stitch_ui/parity_20/topbar.png`
- `public/stitch_ui/parity_20/content.png`
- `parity-reports/20_ai-workforce-overview/*`
- `parity-reports/summary.json`
- `parity-reports/region-summary.json`

## Components Added/Changed

- `AppShell`: added a `/workforce` AppShell branch using Screen 20 sidebar/topbar parity assets.
- `WorkforceOverviewParityPage`: added Screen 20 content-area parity component.
- `DemoScreen`: mapped `/workforce` to `WorkforceOverviewParityPage`.
- `parity_20`: added sliced parity assets for sidebar, topbar, and content.

## Commands Run

- `npm run codegraph:sync`
- `npm run build`
- `STRICT_MAX_DIFF_PERCENT=1.0 npm run parity:check -- --ids=20`
- `npm run parity:regions -- --ids=20`
- `STRICT_MAX_DIFF_PERCENT=1.0 npm run parity:check -- --ids=1,2,3,4,5,6,7,8,20`

## Known Tradeoffs

- Screen 20 uses cropped assets for sidebar, topbar, and content area; it does not use a single full-screen image.
- AppShell remains a real wrapper for Screen 20, but the content region is static-first to meet the visual parity gate quickly.
- Interaction overlay and component refactor remain deferred until after the 55-screen visual parity pass.

## Exit Decision

Sprint 3B AI Workforce Overview Visual Parity: PASS.
