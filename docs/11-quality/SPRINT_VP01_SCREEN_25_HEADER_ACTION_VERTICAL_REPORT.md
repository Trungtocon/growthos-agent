# Sprint VP01 - Screen 25 Header Action Vertical Polish Report

## Goal

Continue measured visual parity polish for Screen 25 `/agents/templates` by targeting the highest remaining header subregion mismatch without changing bbox contracts or returning to static assets.

## Scope

- Screen 25 `/agents/templates` only.
- Header action group vertical alignment.
- No AppShell geometry changes.
- No parity screenshots, sliced assets, or `backgroundImage` usage.

## Change

- Added a 14px top offset to the Screen 25 header action group so the custom-agent and new-agent buttons sit closer to the source PNG's vertical placement.

## Reverted Attempts

- 12px and 15px offsets were tested and reverted because both measured worse than the 14px offset.
- Template card cost/difficulty row recalibration was tested and reverted because it worsened the full-page diff.

## Verification

| Check | Result |
|---|---|
| Screen 25 pixel diff before | 10.7929% |
| Screen 25 pixel diff after | 10.5720% |
| Screen 25 1:1 before | 89.2071% |
| Screen 25 1:1 after | 89.4280% |
| Screen 25 header subregion before | 20.6316% |
| Screen 25 header subregion after | 14.3121% |

## Static Asset Guardrail

- `parity_25/sidebar.png` rendered: No
- `parity_25/topbar.png` rendered: No
- `parity_25/content.png` rendered: No
- `backgroundImage` rendered: No

## Decision

PASS as a measured Screen 25 visual parity improvement. Screen 25 remains Real UI Structural PASS / Visual Polish Deferred.
