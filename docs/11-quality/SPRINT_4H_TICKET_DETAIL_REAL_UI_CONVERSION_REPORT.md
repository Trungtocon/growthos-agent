# Sprint 4H - Ticket Detail Real UI Conversion Report

## Goal

Convert `/tickets/demo-ticket` from static parity expectations to real UI components using the structural gate.

## Baseline

- Screen 08: Real UI Structural PASS / Visual Polish Deferred.
- Screen 20: Real UI Structural PASS / Visual Polish Deferred.
- Screen 30: Real UI Structural PASS / Visual Polish Deferred.

## Route Map

| Screen | Route | Active component | AppShell | Mode |
|---|---|---|---|---|
| 32 | `/tickets/demo-ticket` | `TicketDetailRealPage` | Yes | Real UI Structural PASS |

## Static Asset Guardrail

| Check | Result |
|---|---|
| `parity_32/sidebar.png` rendered | No |
| `parity_32/topbar.png` rendered | No |
| `parity_32/content.png` rendered | No |
| `backgroundImage` rendered | No |
| Full-screen screenshot rendered | No |

## Components Added/Changed

- `TicketDetailRealPage`
- `TicketDetailHeader`
- `TicketDetailTabs`
- `TicketInfoPanel`
- `TicketTranscriptPanel`
- `TicketStatusPanel`
- Screen 32 layout contract
- `audit:bbox:32` npm script

## Structural Gate

| Region | Expected | Actual | dx | dy | dw | dh | Status |
|---|---|---|---:|---:|---:|---:|---|
| `app-shell.sidebar` | 0, 0, 185, 941 | 0, 0, 185, 941 | 0 | 0 | 0 | 0 | Pass |
| `app-shell.topbar` | 185, 0, 1487, 60 | 185, 0, 1487, 60 | 0 | 0 | 0 | 0 | Pass |
| `app-shell.main` | 215, 72, 1427, 1217.5 | 215, 72, 1427, 1217.5 | 0 | 0 | 0 | 0 | Pass |
| `ticket.header` | 215, 72, 1427, 129.5 | 215, 72, 1427, 129.5 | 0 | 0 | 0 | 0 | Pass |
| `ticket.tabs` | 215, 221.5, 1427, 38 | 215, 221.5, 1427, 38 | 0 | 0 | 0 | 0 | Pass |
| `ticket.main-grid` | 215, 275.5, 1427, 1014 | 215, 275.5, 1427, 1014 | 0 | 0 | 0 | 0 | Pass |
| `ticket.left-panel` | 215, 275.5, 330, 1014 | 215, 275.5, 330, 1014 | 0 | 0 | 0 | 0 | Pass |
| `ticket.center-panel` | 561, 275.5, 655, 1014 | 561, 275.5, 655, 1014 | 0 | 0 | 0 | 0 | Pass |
| `ticket.right-panel` | 1232, 275.5, 410, 1014 | 1232, 275.5, 410, 1014 | 0 | 0 | 0 | 0 | Pass |
| `ticket.info-card` | 215, 275.5, 330, 374 | 215, 275.5, 330, 374 | 0 | 0 | 0 | 0 | Pass |
| `ticket.criteria-card` | 215, 835.5, 330, 198 | 215, 835.5, 330, 198 | 0 | 0 | 0 | 0 | Pass |
| `ticket.transcript-card` | 561, 275.5, 655, 868 | 561, 275.5, 655, 868 | 0 | 0 | 0 | 0 | Pass |
| `ticket.status-card` | 1232, 275.5, 410, 252 | 1232, 275.5, 410, 252 | 0 | 0 | 0 | 0 | Pass |
| `ticket.actions-card` | 1232, 907.5, 410, 174 | 1232, 907.5, 410, 174 | 0 | 0 | 0 | 0 | Pass |
| `ticket.artifacts-card` | 1232, 1097.5, 410, 192 | 1232, 1097.5, 410, 192 | 0 | 0 | 0 | 0 | Pass |

## Pixel Diff Reference

| Screen | Route | Pixel diff | Notes |
|---|---|---:|---|
| 32 | `/tickets/demo-ticket` | 7.7372% | Visual polish deferred |

## Verification

| Check | Result |
|---|---|
| `npm run build` | Pass |
| Onboarding 01-07 parity regression | Pass |
| `npm run audit:bbox:08` | Pass, 14/14 |
| `npm run audit:bbox:20` | Pass, 14/14 |
| `npm run audit:bbox:30` | Pass, 12/12 |
| `npm run audit:bbox:32` | Pass, 15/15 |
| `STRICT_MAX_DIFF_PERCENT=15.0 npm run parity:check -- --ids=32` | Pass, 7.7372% |

## Decision

Sprint 4H: **PASS**.

## Next Step

Convert `/runs/demo-run` using the same structural gate.
