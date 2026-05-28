# Sprint 5AB — Screen 17 Board Header Polish Report

## Goal
Continue measured visual polish for `/projects` after Sprint 5AA by targeting the next lower-risk board mismatch while preserving Screen 17 structural gates.

## GitNexus / AgentMemory
- AgentMemory recalled that Screen 17 health legend percentage tweaks worsened diff and should be avoided unless measured first.
- GitNexus impact for `ProjectColumn` returned LOW risk; direct caller is `ProjectsListScreen`.

## Changes
- Replaced colored count badges in `ProjectColumn` headers with the source-PNG pattern:
  - status color dot before the column title
  - neutral gray count pill at the right
- Tested a completed-card internal rewrite for the archived column, but reverted it because Screen 17 pixel diff worsened from `11.3228%` to `11.4079%`.
- Regenerated `SCREEN_17_SUBREGION_AUDIT.md`.

## Static Asset Guardrail
- `parity_17/sidebar.png` rendered: No
- `parity_17/topbar.png` rendered: No
- `parity_17/content.png` rendered: No
- `backgroundImage` rendered: No

## Measurement
| Check | Before | After | Result |
|---|---:|---:|---|
| Screen 17 pixel diff | 11.3301% | 11.3228% | Improved |
| Screen 17 1:1 score | 88.6699% | 88.6772% | Improved |
| BBox gate | Pass 10/10 | Pass 10/10 | Pass |

## Remaining Diff Regions
| Rank | Region | Diff | Note |
|---:|---|---:|---|
| 1 | Health chart left | 26.5696% | Donut/chart rendering remains the dominant mismatch |
| 2 | Board archived column | 18.1497% | Completed-card internals need a different measured approach |
| 3 | Board active column | 16.3809% | Card internals still differ from PNG |
| 4 | Health metrics right | 16.3087% | Cost chart bars and labels still diverge |

## Decision
PARTIAL. The retained change improves Screen 17 slightly and keeps structural gates stable. Further Screen 17 work should start from health chart or board-card subregions with one measured change at a time.
