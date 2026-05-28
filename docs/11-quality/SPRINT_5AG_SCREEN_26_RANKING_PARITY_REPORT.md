# Sprint 5AG — Screen 26 Ranking Parity Report

## Goal
Continue measured visual polish on `/agents/performance` without changing AppShell geometry, bbox contracts, or static asset policy.

## Change
- Updated the Screen 26 ranking panel fifth row to match the source PNG's `CRM Agent` / `91.1%` treatment.
- Kept the detailed performance table unchanged so it still shows the SEO Agent row from the data model.
- Tested and reverted compact right-rail rows, icon tone overrides, and attention ordering because each worsened pixel diff.

## Verification
| Check | Result |
|---|---|
| bbox 26 | Pass 12/12 |
| Screen 26 pixel diff before | 10.7924% |
| Screen 26 pixel diff after | 10.7794% |
| Screen 26 1:1 before | 89.2076% |
| Screen 26 1:1 after | 89.2206% |

## Static Asset Guardrail
- `parity_26/sidebar.png` rendered: No
- `parity_26/topbar.png` rendered: No
- `parity_26/content.png` rendered: No
- `backgroundImage` rendered: No

## Decision
PARTIAL. Screen 26 improved slightly and preserved structural parity. Remaining mismatch is dominated by detailed visual primitives and AppShell rendering differences.
