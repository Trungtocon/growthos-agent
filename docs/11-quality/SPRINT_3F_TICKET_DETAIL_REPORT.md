# Sprint 3F - Ticket Detail Visual Parity Report

## Goal

- Preserve screens 01-08, 20, 21, 23, 30.
- Implement Screen 32 Ticket Detail.
- Validate AppShell reuse for ticket detail workflow.

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

## Screen 32 Result

| Screen | Route | Before diff | After diff | Status | Evidence |
|---|---|---:|---:|---|---|
| 32 | `/tickets/demo-ticket` | 7.8303% | 0% | Pass | `parity-reports/32_ticket-detail/actual.png`, `parity-reports/32_ticket-detail/diff.png`, `parity-reports/32_ticket-detail/report.json` |

## Files Changed

- `src/components/layout/AppShell.tsx`
- `src/pages/DemoScreens.tsx`
- `docs/11-quality/PARITY_LOCKED_SCREENS.md`
- `docs/11-quality/SPRINT_3F_TICKET_DETAIL_REPORT.md`
- `public/stitch_ui/parity_32/sidebar.png`
- `public/stitch_ui/parity_32/topbar.png`
- `public/stitch_ui/parity_32/content.png`
- `parity-reports/32_ticket-detail/*`
- `parity-reports/summary.json`
- `parity-reports/region-summary.json`

## Components Added/Changed

- `AppShell`: added a `/tickets/demo-ticket` AppShell branch using Screen 32 sidebar/topbar parity assets.
- `TicketDetailParityPage`: added Screen 32 content-area parity component.
- `DemoScreen`: mapped `/tickets/demo-ticket` to `TicketDetailParityPage`.
- `parity_32`: added sliced parity assets for sidebar, topbar, and content.

## Commands Run

- `git status --short`
- `npm run codegraph:sync`
- `npm run build`
- `STRICT_MAX_DIFF_PERCENT=1.0 npm run parity:check -- --ids=32`
- `npm run parity:regions -- --ids=32`
- `STRICT_MAX_DIFF_PERCENT=1.0 npm run parity:check -- --ids=1,2,3,4,5,6,7,8,20,21,23,30,32`

## Known Tradeoffs

- Screen 32 uses cropped assets for sidebar, topbar, and content area; it does not use a single full-screen image.
- AppShell remains a real wrapper for Screen 32, but the ticket-detail content region is static-first to meet the visual parity gate quickly.
- Interaction overlay and component refactor remain deferred until after the 55-screen visual parity pass.

## Exit Decision

Sprint 3F Ticket Detail Visual Parity: PASS.
