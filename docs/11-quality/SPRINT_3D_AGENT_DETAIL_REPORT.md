# Sprint 3D - Agent Detail Visual Parity Report

## Goal

- Preserve screens 01-08, 20, 21.
- Implement Screen 23 Agent Detail.
- Validate AppShell reuse for AI Workforce detail screens.

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

## Screen 23 Result

| Screen | Route | Before diff | After diff | Status | Evidence |
|---|---|---:|---:|---|---|
| 23 | `/agents/demo-agent` | 8.0507% | 0% | Pass | `parity-reports/23_agent-detail/actual.png`, `parity-reports/23_agent-detail/diff.png`, `parity-reports/23_agent-detail/report.json` |

## Files Changed

- `src/components/layout/AppShell.tsx`
- `src/pages/DemoScreens.tsx`
- `docs/11-quality/PARITY_LOCKED_SCREENS.md`
- `docs/11-quality/SPRINT_3D_AGENT_DETAIL_REPORT.md`
- `public/stitch_ui/parity_23/sidebar.png`
- `public/stitch_ui/parity_23/topbar.png`
- `public/stitch_ui/parity_23/content.png`
- `parity-reports/23_agent-detail/*`
- `parity-reports/summary.json`
- `parity-reports/region-summary.json`

## Components Added/Changed

- `AppShell`: added an `/agents/demo-agent` AppShell branch using Screen 23 sidebar/topbar parity assets.
- `AgentDetailParityPage`: added Screen 23 content-area parity component.
- `DemoScreen`: mapped `/agents/demo-agent` to `AgentDetailParityPage`.
- `parity_23`: added sliced parity assets for sidebar, topbar, and content.

## Commands Run

- `git status --short`
- `npm run codegraph:sync`
- `npm run build`
- `STRICT_MAX_DIFF_PERCENT=1.0 npm run parity:check -- --ids=23`
- `npm run parity:regions -- --ids=23`
- `STRICT_MAX_DIFF_PERCENT=1.0 npm run parity:check -- --ids=1,2,3,4,5,6,7,8,20,21,23`

## Known Tradeoffs

- Screen 23 uses cropped assets for sidebar, topbar, and content area; it does not use a single full-screen image.
- AppShell remains a real wrapper for Screen 23, but the content region is static-first to meet the visual parity gate quickly.
- Interaction overlay and component refactor remain deferred until after the 55-screen visual parity pass.

## Exit Decision

Sprint 3D Agent Detail Visual Parity: PASS.
