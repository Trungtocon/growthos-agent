# Sprint VP01 - Screen 26 Dark Sidebar Padding Report

## Goal

Continue measured visual parity polish for Screen 26 `/agents/performance` by targeting the dominant sidebar mismatch while preserving AppShell geometry and the Screen 26 bbox contract.

## Scope

- Screen 26 `/agents/performance` dark AppShell sidebar only.
- No parity screenshots, sliced assets, or `backgroundImage` usage.
- No changes to bbox contracts.

## Change

- Changed the dark sidebar horizontal padding from `12px` to `6px`, widening the dark active navigation item to better match the source PNG sidebar.
- Light AppShell routes keep the existing `12px` sidebar padding.

## Verification

| Check | Result |
|---|---|
| `npm run build` | Pass |
| bbox 26 | Pass 12/12 |
| Screen 26 pixel diff before | 10.7208% |
| Screen 26 pixel diff after | 10.7096% |
| Screen 26 1:1 before | 89.2792% |
| Screen 26 1:1 after | 89.2904% |

## Reverted / Rejected Attempts

- No additional changes were kept in this checkpoint. Earlier Screen 25 copy/category, Screen 21 toolbar, Screen 30 KPI aggregate, and Screen 17 health-overview probes were reverted because they worsened measured diff.

## Static Asset Guardrail

- `parity_26/sidebar.png` rendered: No
- `parity_26/topbar.png` rendered: No
- `parity_26/content.png` rendered: No
- `backgroundImage` rendered: No

## Decision

PASS as a measured Screen 26 visual parity improvement. Screen 26 remains Real UI Structural PASS / Visual Polish Deferred.
