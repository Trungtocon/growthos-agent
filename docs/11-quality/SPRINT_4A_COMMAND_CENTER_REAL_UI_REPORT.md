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
| 08 | `/command-center` | Real UI Components | 10.4747% | Needs tuning |

## Sprint 4A.2 Region Tuning

| Pass | Before diff | After diff | Regions tuned | Status |
|---|---:|---:|---|---|
| 1 | 10.5867% | 10.6187% | Main-left health metric row geometry | Reverted direction; increased diff |
| 2 | 10.5867% | 10.4747% | Main-left health donut SVG geometry | Kept; small improvement |
| 3 | 10.4747% | 10.9151% | Typography webfont import | Reverted direction; increased diff |

Current Screen 08 real UI diff: 10.4747%.

Static asset guard remains clean:

- `parity_08/sidebar.png`: not rendered.
- `parity_08/topbar.png`: not rendered.
- `parity_08/content.png`: not rendered.
- `backgroundImage`: not used to fake UI.

Gate status:

- `<=3%`: fail.
- `<=1%`: not run because the 3% gate is not met.

Top remaining diff regions:

| Region | Diff |
|---|---:|
| Main left | 15.9438% |
| Main right | 10.2973% |
| Topbar | 8.2360% |
| KPI band | 7.8894% |
| Sidebar | 7.5215% |
| Page heading | 3.9073% |

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
- `CommandHealthDonut`
- `AvatarBot`

## Regression

- Onboarding 01-07: pass.
- Screen 08 under 3% gate: fail, current diff 10.4747%.
- Screen 08 under 1% gate: not run because 3% gate is not met.

## Known Tradeoffs

- `/command-center` is no longer a screenshot-backed screen.
- The current real UI is functionally inspectable DOM, but visual parity is still far from the target.
- The largest remaining diff comes from chart geometry, icon artwork, text anti-aliasing/wrapping, and dense card internals.
- Further tuning should be done with real DOM/SVG/CSS components, not by reintroducing static screenshots.
