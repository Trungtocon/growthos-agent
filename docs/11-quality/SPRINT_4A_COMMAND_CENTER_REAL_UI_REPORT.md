# Sprint 4A - Command Center Real UI Conversion Report

## Goal

Convert `/command-center` from static sliced assets to real React components.

## Starting Point

- Previous static-slice parity: 0%.
- Real component baseline diff from audit: 10.7422%.
- Static slices are not allowed for the active `/command-center` route.

## Result

| Screen | Route | Mode | Diff | Status |
|---|---|---|---:|---|
| 08 | `/command-center` | Real UI Components | 10.5867% | Needs tuning |

## Static Asset Audit

- Does `/command-center` render `parity_08/sidebar.png`? No.
- Does `/command-center` render `parity_08/topbar.png`? No.
- Does `/command-center` render `parity_08/content.png`? No.
- Active component: `CommandCenter` in `src/pages/DemoScreens.tsx`, wrapped by `AppShell` in `src/components/layout/AppShell.tsx`.

## Components Added/Changed

- `AppShell`
- `CommandCenter`
- `KpiTile`
- `Panel`
- `ProgressBar`
- `DonutScore`
- `AvatarBot`

## Regression

- Onboarding 01-07: pass.
- Screen 08 under 3% gate: fail, current diff 10.5867%.
- Screen 08 under 1% gate: not run because 3% gate is not met.

## Known Tradeoffs

- `/command-center` is no longer a screenshot-backed screen.
- The current real UI is functionally inspectable DOM, but visual parity is still far from the target.
- The largest remaining diff comes from chart geometry, icon artwork, text anti-aliasing/wrapping, and dense card internals.
- Further tuning should be done with real DOM/SVG/CSS components, not by reintroducing static screenshots.
