# Sprint VP01 - Screen 17 Header Typography Report

## Goal

Continue measured visual parity polish for Screen 17 `/projects` while preserving the existing structural gate and AppShell baseline.

## Scope

- Screen 17 `/projects` only.
- Page header title typography only.
- No board, health chart, AppShell, or bbox contract changes.

## Changes

- Replaced the generic `SimpleHeader` usage for `/projects` with a route-local header using the same `data-parity-id` and geometry.
- Reduced the Projects title weight from extra-bold to bold.
- Tuned title tone to `text-slate-900`, closer to the source PNG crop.

## Reverted Attempts

- Filter-row chevron/calendar icons were tested and reverted because they worsened pixel diff.
- `slate-800` title tone was tested and did not improve beyond `slate-900`.
- Screen 30 filter expansion and Screen 25 dropdown/category changes were tested in this pass and reverted because they worsened pixel diff.

## Verification

| Check | Result |
|---|---|
| bbox 17 | Pass 10/10 |
| Screen 17 pixel diff before | 10.9848% |
| Screen 17 pixel diff after | 10.9656% |
| Screen 17 1:1 before | 89.0152% |
| Screen 17 1:1 after | 89.0344% |

## Static Asset Guardrail

- `parity_17/sidebar.png` rendered: No
- `parity_17/topbar.png` rendered: No
- `parity_17/content.png` rendered: No
- `backgroundImage` rendered: No

## Decision

PASS as a small measured visual polish improvement. Screen 17 remains Real UI Structural PASS / Visual Polish Deferred.
