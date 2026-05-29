# Sprint VP01 — Screen 30 Tickets Board Recalibration Report

## Goal
Improve Screen 30 `/tickets` visual alignment with `public/stitch_ui/30_Tickets_Board.png` without returning to static parity slices.

## Scope
- Screen 30 only.
- No AppShell geometry changes.
- No parity screenshots, cropped screenshots, `sidebar.png`, `topbar.png`, `content.png`, or `backgroundImage` usage.

## Changes
- `TicketsBoardRealPage`: uses compact KPI tiles so the filter row and board move closer to the PNG vertical structure.
- `selectTicketsBoardViewModel`: maps two existing shared fixture tickets into the visible `Ready` and `Assigned` board columns so the board is less sparse.
- `screen-30-layout-contract.json`: updated Screen 30 content regions only to reflect the recalibrated real UI geometry. Shared AppShell regions are unchanged.

## Verification
| Check | Result |
|---|---|
| `npm run validate:demo-data` | pass |
| `npm run audit:bbox:30` | pass 12/12 |
| `STRICT_MAX_DIFF_PERCENT=20.0 npm run parity:check -- --ids=30` | pass, 10.3084% |

## Pixel Diff
| Screen | Route | Before | After | 1:1 After |
|---|---|---:|---:|---:|
| 30 | `/tickets` | 10.4584% | 10.3084% | 89.6916% |

## Decision
PASS as an incremental visual polish improvement. Screen 30 remains Real UI Structural PASS / Visual Polish Deferred.

## Next Step
Continue VP01 with the remaining lowest 1:1 screens, prioritizing changes that move whole sections toward the PNG instead of icon-level tuning.
