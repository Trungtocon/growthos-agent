# Sprint 5Z — Screen 17 Projects Board Density Report

## Goal
Continue measured visual polish for `/projects` from the current lowest 1:1 screen, using source-PNG-aligned subregion measurement before changing UI.

## Changes
- Added `scripts/audit-screen-17-subregions.mjs`.
- Added `npm run audit:subregions:17`.
- Added `SCREEN_17_SUBREGION_AUDIT.md`.
- Reduced dense project board card height so high-density columns expose the expected third card and add-project affordance inside the source-PNG board region.

## Static Asset Guardrail
- `parity_17/sidebar.png` rendered: No
- `parity_17/topbar.png` rendered: No
- `parity_17/content.png` rendered: No
- `backgroundImage` rendered: No

## Measurement
| Check | Before | After | Result |
|---|---:|---:|---|
| Screen 17 pixel diff | 11.6005% | 11.5214% | Improved |
| Screen 17 1:1 score | 88.3995% | 88.4786% | Improved |
| BBox gate | Pass 10/10 | Pass 10/10 | Pass |
| Project board all columns | 15.7559% | 15.4866% | Improved |
| Board at risk column | 16.2013% | 15.7797% | Improved |
| Board blocked column | 16.2557% | 15.3333% | Improved |
| Board completed column | 15.4112% | 14.9388% | Improved |

## Remaining Diff Regions
| Rank | Region | Diff | Note |
|---:|---|---:|---|
| 1 | Health chart left | 30.3963% | Requires a targeted health overview rebuild, not container resizing |
| 2 | Health metrics right | 17.0756% | Bar chart internals still diverge from PNG |
| 3 | Health overview | 16.7651% | Lower dashboard remains the largest visual blocker |
| 4 | Archived board column | 16.6413% | Completed-card internal density still differs |

## Decision
PARTIAL. Screen 17 improved and structural gates remain stable, but health overview remains the dominant source of diff.
