# Sprint 4G - Tickets Board Real UI Conversion Report

## Goal

Convert `/tickets` from static parity expectations to real UI components using the structural gate.

## Baseline

- Screen 08: Real UI Structural PASS / Visual Polish Deferred.
- Screen 20: Real UI Structural PASS / Visual Polish Deferred.
- Screen 20 pixel diff is a polish metric, not a blocker.

## Route Map

| Screen | Route | Active component | AppShell | Mode |
|---|---|---|---|---|
| 30 | `/tickets` | `TicketsBoardRealPage` | Yes | Real UI Structural PASS |

## Static Asset Guardrail

| Check | Result |
|---|---|
| `parity_30/sidebar.png` rendered | No |
| `parity_30/topbar.png` rendered | No |
| `parity_30/content.png` rendered | No |
| `backgroundImage` rendered | No |
| Full-screen screenshot rendered | No |

## Components Added/Changed

- `TicketsBoardRealPage`
- `TicketsHeader` behavior through `PageHeader`
- `TicketsKpiBand` using existing KPI primitives
- `TicketsFilterBar`
- `TicketsBoard`
- `TicketColumn`
- `TicketCard`
- `TicketInsightsPanel`
- Screen 30 layout contract
- `audit:bbox:30` npm script

## Structural Gate

| Region | Expected | Actual | dx | dy | dw | dh | Status |
|---|---|---|---:|---:|---:|---:|---|
| app-shell.sidebar | 0/0/210/941 | 0/0/210/941 | 0 | 0 | 0 | 0 | passed |
| app-shell.topbar | 210/0/1462/72 | 210/0/1462/72 | 0 | 0 | 0 | 0 | passed |
| app-shell.main | 234/92/1414/849 | 234/92/1414/849 | 0 | 0 | 0 | 0 | passed |
| tickets.header | 234/92/1414/64 | 234/92/1414/64 | 0 | 0 | 0 | 0 | passed |
| tickets.kpi-band | 234/172/1414/112 | 234/172/1414/112 | 0 | 0 | 0 | 0 | passed |
| tickets.filters | 234/304/1414/46 | 234/304/1414/46 | 0 | 0 | 0 | 0 | passed |
| tickets.board | 234/370/1414/560 | 234/370/1414/560 | 0 | 0 | 0 | 0 | passed |
| tickets.column.todo | 234/370/133/560 | 234/370/133/560 | 0 | 0 | 0 | 0 | passed |
| tickets.column.in-progress | 669/370/133/560 | 669/370/133/560 | 0 | 0 | 0 | 0 | passed |
| tickets.column.review | 814/370/133/560 | 814/370/133/560 | 0 | 0 | 0 | 0 | passed |
| tickets.column.done | 959/370/133/560 | 959/370/133/560 | 0 | 0 | 0 | 0 | passed |
| tickets.insights | 1398/370/250/560 | 1398/370/250/560 | 0 | 0 | 0 | 0 | passed |

## Pixel Diff Reference

| Screen | Route | Pixel diff | Notes |
|---|---|---:|---|
| 30 | `/tickets` | 10.6961% | Visual polish deferred |

## Verification

| Check | Result |
|---|---|
| `npm run build` | Pass |
| Onboarding 01-07 parity regression | Pass |
| `npm run audit:bbox:08` | Pass, 14/14 |
| `npm run audit:bbox:20` | Pass, 14/14 |
| `npm run audit:bbox:30` | Pass, 12/12 |
| `STRICT_MAX_DIFF_PERCENT=15.0 npm run parity:check -- --ids=30` | Pass, 10.6961% |

## Decision

Sprint 4G: **PASS**.

## Next Step

Convert `/tickets/demo-ticket` using the same structural gate.
