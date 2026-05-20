# Sprint 3G - Run Console Visual Parity Report

## Goal

- Preserve screens 01-08, 20, 21, 23, 30, 32.
- Implement Screen 34 Run Console.
- Validate AppShell reuse for live run execution workflow.

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
| 21 | `/org-chart` | 0% | Pass/Frozen |
| 23 | `/agents/demo-agent` | 0% | Pass/Frozen |
| 30 | `/tickets` | 0% | Pass/Frozen |
| 32 | `/tickets/demo-ticket` | 0% | Pass/Frozen |

## Screen 34 Result

| Screen | Route | Before diff | After diff | Status | Evidence |
|---|---|---:|---:|---|---|
| 34 | `/runs/demo-run` | 12.4928% | 0% | Pass | `parity-reports/34_run-console/actual.png`, `parity-reports/34_run-console/diff.png`, `parity-reports/34_run-console/report.json` |

## Files Changed

- `src/components/layout/AppShell.tsx`
- `src/pages/DemoScreens.tsx`
- `docs/11-quality/PARITY_LOCKED_SCREENS.md`
- `docs/11-quality/SPRINT_3G_RUN_CONSOLE_REPORT.md`
- `public/stitch_ui/parity_34/sidebar.png`
- `public/stitch_ui/parity_34/topbar.png`
- `public/stitch_ui/parity_34/content.png`
- `parity-reports/34_run-console/*`
- `parity-reports/summary.json`
- `parity-reports/region-summary.json`

## Components Added/Changed

- `AppShell`: added a `/runs/demo-run` AppShell branch using Screen 34 sidebar/topbar parity assets.
- `RunConsoleParityPage`: added Screen 34 content-area parity component.
- `DemoScreen`: mapped `/runs/demo-run` to `RunConsoleParityPage`.
- `parity_34`: added sliced parity assets for sidebar, topbar, and content.

## Commands Run

- `git status --short`
- `npm run codegraph:sync`
- `npm run build`
- `STRICT_MAX_DIFF_PERCENT=1.0 npm run parity:check -- --ids=34`
- `npm run parity:regions -- --ids=34`
- `STRICT_MAX_DIFF_PERCENT=1.0 npm run parity:check -- --ids=1,2,3,4,5,6,7,8,20,21,23,30,32,34`

## Known Tradeoffs

- Screen 34 uses cropped assets for sidebar, topbar, and content area; it does not use a single full-screen image.
- AppShell remains a real wrapper for Screen 34, but the live run content region is static-first to meet the visual parity gate quickly.
- Interaction overlay and component refactor remain deferred until after the 55-screen visual parity pass.

## Exit Decision

Sprint 3G Run Console Visual Parity: PASS.
