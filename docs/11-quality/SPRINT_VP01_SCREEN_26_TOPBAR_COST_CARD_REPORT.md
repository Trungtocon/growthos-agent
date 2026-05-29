# Sprint VP01 - Screen 26 Topbar Cost Card Report

## Goal

Continue measured Screen 26 `/agents/performance` polish by matching the source PNG topbar cost card more closely without changing AppShell geometry or bbox contracts.

## Scope

- Screen 26 dark AppShell cost card variant.
- No parity screenshots, sliced assets, or `backgroundImage` usage.
- No changes to bbox contracts.

## Change

- Added a dark-sidebar AppShell cost-card variant that replaces the generic blue sparkline with a green cost icon, green value text, and an expand arrow, closer to `public/stitch_ui/26_Agent_Performance.png`.
- The default light AppShell cost card remains unchanged.

## Verification

| Check | Result |
|---|---|
| `npm run build` | Pass |
| bbox 26 | Pass 12/12 |
| Screen 26 pixel diff before | 10.7096% |
| Screen 26 pixel diff after | 10.7083% |
| Screen 26 1:1 before | 89.2904% |
| Screen 26 1:1 after | 89.2917% |

## Static Asset Guardrail

- `parity_26/sidebar.png` rendered: No
- `parity_26/topbar.png` rendered: No
- `parity_26/content.png` rendered: No
- `backgroundImage` rendered: No

## Decision

PASS as a measured Screen 26 visual parity improvement. Screen 26 remains Real UI Structural PASS / Visual Polish Deferred.
