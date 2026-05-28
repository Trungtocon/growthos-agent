# Sprint 5Y — Screen 25 Card Recalibration Report

## Goal
Continue measured visual polish for `/agents/templates` using the Screen 25 subregion audit without changing AppShell geometry or static asset policy.

## Changes
- Reworked `TemplateMarketCard` from flow layout to fixed in-card geometry so avatar, category, title, description, runtime, skills, tools, cost, difficulty, and CTA rows stay visible inside the PNG-aligned card crop.
- Moved the detail drawer primary CTA from `bottom: 28px` to `bottom: 33px` to align with the source PNG drawer CTA region.
- Regenerated `SCREEN_25_SUBREGION_AUDIT.md` after the retained changes.

## Static Asset Guardrail
- `parity_25/sidebar.png` rendered: No
- `parity_25/topbar.png` rendered: No
- `parity_25/content.png` rendered: No
- `backgroundImage` rendered: No

## Measurement
| Check | Before | After | Result |
|---|---:|---:|---|
| Screen 25 pixel diff | 11.1175% | 10.8725% | Improved |
| Screen 25 1:1 score | 88.8825% | 89.1275% | Improved |
| BBox gate | Pass 8/8 | Pass 8/8 | Pass |
| Drawer primary CTA subregion | 22.3280% | 9.8347% | Improved |
| Hermes card subregion | 20.0226% | 18.5458% | Improved |

## Remaining Diff Regions
| Rank | Region | Diff | Note |
|---:|---|---:|---|
| 1 | Page header title/actions | 20.6721% | Header copy/icon typography still differs from PNG |
| 2 | Hermes card | 18.5458% | Avatar art and internal text density still differ |
| 3 | Gallery row two | 16.4602% | Card internals and row crop still need polish |
| 4 | Gallery row one | 14.6608% | Card internals still need polish |

## Decision
PARTIAL. Screen 25 improved and structural gates remain stable, but it still needs additional measured polish before it can approach 1:1.
