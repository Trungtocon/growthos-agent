# Sprint 5AC — Screen 17 Health Chart Polish Report

## Goal
Continue measured visual polish for Screen 17 `/projects` without changing AppShell geometry, bbox contracts, or static asset policy.

## Baseline
| Metric | Before |
|---|---:|
| Screen 17 pixel diff | 11.3228% |
| Screen 17 1:1 | 88.6772% |
| BBox 17 | Pass 10/10 |

## GitNexus / AgentMemory
- AgentMemory recalled that Screen 17 legend percentage tweaks had previously worsened diff.
- GitNexus impact for `ProjectHealthOverview` was LOW. Direct caller: `ProjectsListScreen`.

## Changes
- Added DOM dashed horizontal gridlines to the Project Health Overview cost chart.
- Recalibrated cost bar height scale from `84px` max to `94px` max to better match `public/stitch_ui/17_Projects_List.png`.
- Tested legend percentage text against the PNG crop and reverted it because pixel diff worsened.

## Static Asset Guardrail
- `parity_17` rendered: No
- `sidebar.png` rendered: No
- `topbar.png` rendered: No
- `content.png` rendered: No
- `backgroundImage` rendered: No

## Measurement
| Check | Result |
|---|---|
| Screen 17 before | 11.3228% |
| Screen 17 after | 11.1053% |
| Delta | -0.2175 percentage points |
| 1:1 after | 88.8947% |
| BBox 17 | Pass 10/10 |

## Remaining High-Diff Regions
| Rank | Region | Diff |
|---:|---|---:|
| 1 | health chart left | 26.7022% |
| 2 | board archived column | 16.5816% |
| 3 | board active column | 16.3809% |
| 4 | board at risk column | 15.7844% |
| 5 | project board all columns | 15.4600% |

## Decision
PARTIAL. Screen 17 improved and all structural gates remain intact, but pixel polish is still above a strict 1:1 target.

## Next Step
Continue Screen 17 measured polish with the next safest target: board column/card subregions, starting from archived and active columns.
