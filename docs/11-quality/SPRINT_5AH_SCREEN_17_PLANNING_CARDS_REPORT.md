# Sprint 5AH — Screen 17 Planning Cards Report

## Goal
Continue VP-01 `/projects` visual parity by improving the highest-diff board subregion without changing AppShell or bbox contracts.

## Change
- Reworked only planning project cards inside `ProjectKanbanCardCompact`.
- Moved the `Lên kế hoạch` status treatment from the card header to the bottom metadata row, matching the source PNG.
- Added owner mini avatars for planning cards only.
- Preserved card heights, board geometry, and data-parity regions.

## Reverted Attempts
- Exact-aligning `projects.health-overview` to the bbox contract worsened pixel diff from 11.0731% to 11.6404%.
- Adding owner avatars to all project cards worsened pixel diff to 11.0781%.
- Overriding the planning column count to `4` worsened pixel diff to 10.9852%.

## Verification
| Check | Result |
|---|---|
| bbox 17 | Pass 10/10 |
| Screen 17 pixel diff before | 11.0731% |
| Screen 17 pixel diff after | 10.9848% |
| Screen 17 1:1 before | 88.9269% |
| Screen 17 1:1 after | 89.0152% |

## Static Asset Guardrail
- `parity_17/sidebar.png` rendered: No
- `parity_17/topbar.png` rendered: No
- `parity_17/content.png` rendered: No
- `backgroundImage` rendered: No

## Decision
PARTIAL. `/projects` improved but remains below the 90% VP-01 target. Remaining dominant diffs are board columns and health overview internals.
