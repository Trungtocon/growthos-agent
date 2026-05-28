# Sprint 5AA — Screen 17 Health Overview Recalibration Report

## Goal
Continue measured visual polish for `/projects` by targeting the dominant Screen 17 health overview mismatch identified in Sprint 5Z.

## Changes
- Replaced the generic `Panel` wrapper for `projects.health-overview` with a route-specific compact header so the lower dashboard content aligns closer to the PNG crop.
- Recalibrated the Project Health Overview donut and cost chart geometry to fit inside the source-PNG-aligned health region without clipping.
- Reordered `/projects` cost bar data to match the PNG sequence: GrowthOS, Marketing, CRM, Weekly, Social, Billing, AI Chatbot, Data Warehouse, Khác.
- Regenerated `SCREEN_17_SUBREGION_AUDIT.md`.

## Static Asset Guardrail
- `parity_17/sidebar.png` rendered: No
- `parity_17/topbar.png` rendered: No
- `parity_17/content.png` rendered: No
- `backgroundImage` rendered: No

## Measurement
| Check | Before | After | Result |
|---|---:|---:|---|
| Screen 17 pixel diff | 11.5214% | 11.3301% | Improved |
| Screen 17 1:1 score | 88.4786% | 88.6699% | Improved |
| BBox gate | Pass 10/10 | Pass 10/10 | Pass |
| Health overview | 16.7651% | 15.4794% | Improved |
| Health metrics right | 17.0756% | 16.3087% | Improved |
| Health chart left | 30.3963% | 26.5696% | Improved |

## Route List
| Screen | Route | Status |
|---:|---|---|
| 17 | `/projects` | Real UI, measured polish improved |

## UAT Notes
- Open `/projects` and verify the bottom Project Health Overview remains visible inside the dashboard viewport.
- Confirm the cost bars follow the PNG order and labels.
- Confirm board columns, filters, KPI band, and AI suggestions still render without layout shifts.

## Remaining Diff Regions
| Rank | Region | Diff | Note |
|---:|---|---:|---|
| 1 | Health chart left | 26.5696% | Donut rendering still differs from PNG antialiasing and internal legend density |
| 2 | Board archived column | 16.6413% | Completed-card density remains a candidate for later board polish |
| 3 | Board active column | 16.3631% | Card internals still differ from PNG |
| 4 | Health metrics right | 16.3087% | Chart geometry improved, but bar/label rendering still differs |

## Decision
PARTIAL. Screen 17 improved while preserving structural gates. Continue visual polish from the next highest measured region rather than changing AppShell geometry.
