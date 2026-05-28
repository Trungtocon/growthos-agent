# Sprint 5AD — Screen 17 Board Tone Polish Report

## Goal
Continue measured visual polish for Screen 17 `/projects` by targeting board column/card mismatches without changing AppShell geometry or bbox contracts.

## Baseline
| Metric | Before |
|---|---:|
| Screen 17 pixel diff | 11.1053% |
| Screen 17 1:1 | 88.8947% |
| BBox 17 | Pass 10/10 |

## GitNexus / AgentMemory
- AgentMemory recalled that broad completed-card rewrites and legend percentage text worsened Screen 17.
- GitNexus impact for `selectProjectsListViewModel`, `ProjectColumn`, `ProjectKanbanCardCompact`, and `ProjectsListScreen` was LOW.

## Changes
- Changed `HR Onboarding Flow` from amber to blue so the planning column matches the PNG's blue-card treatment.
- Removed the green-tinted border from completed project cards, matching the reference's neutral completed card outline more closely.
- Tested planning-column count override, filter icons, and project-specific goal copy; all worsened pixel diff and were reverted.

## Static Asset Guardrail
- `parity_17` rendered: No
- `sidebar.png` rendered: No
- `topbar.png` rendered: No
- `content.png` rendered: No
- `backgroundImage` rendered: No

## Measurement
| Check | Result |
|---|---|
| Screen 17 before | 11.1053% |
| Screen 17 after | 11.0748% |
| Delta | -0.0305 percentage points |
| 1:1 after | 88.9252% |
| BBox 17 | Pass 10/10 |

## Remaining High-Diff Regions
| Rank | Region | Diff |
|---:|---|---:|
| 1 | health chart left | 26.7022% |
| 2 | board archived column | 16.5793% |
| 3 | board active column | 15.8163% |
| 4 | board at risk column | 15.7844% |
| 5 | project board all columns | 15.3501% |

## Decision
PARTIAL. Screen 17 improved while preserving structural gates, but it remains above strict visual parity.

## Next Step
Continue measured polish on Screen 17 only if targeting low-risk text/color/card-density deltas; otherwise move to the next lowest screen from the progress table.
