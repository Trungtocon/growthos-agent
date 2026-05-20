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

## Sprint 4A.3 Geometry Calibration

| Pass | Before diff | After diff | Regions tuned | Notes |
|---|---:|---:|---|---|
| AppShell geometry | 10.4747% | 10.4863% | Sidebar, topbar, content wrapper | 24px content X offset worsened diff; reverted to 22px. AppShell geometry tokens kept with current values. |
| KPI band | 10.4746% | 10.4823% | KPI labels and trend color logic | Removing label truncation and adjusting trend semantics worsened diff; reverted. |
| Main grid | 10.4823% | 10.6796% | Main-left health metric rows | Full-width metric row structure worsened diff; reverted. |
| Typography | 10.4746% | 10.4746% | Font smoothing | No measurable change; reverted. |

## Current Result

| Screen | Route | Mode | Diff | Gate <=3% | Gate <=1% |
|---|---|---|---:|---|---|
| 08 | `/command-center` | Real UI Components | 10.4747% | Fail | Not run |

## Top Remaining Diff Regions

| Region | Diff |
|---|---:|
| Main left | 15.9438% |
| Main right | 10.2973% |
| Topbar | 8.2360% |
| KPI band | 7.8894% |
| Sidebar | 7.5215% |
| Page heading | 3.9073% |

4A.3 conclusion: macro shell dimensions are already close enough that simple width/padding/card-density changes do not reduce the mismatch. The blocker is now real-component fidelity at the micro layout/artwork layer: exact panel-title iconography, bot/avatar artwork, chart geometry, text rendering, row copy wrapping, and badge/list internals. Do not reintroduce static parity slices; the next pass should rebuild those primitives as route-specific real DOM/SVG components with measured expected coordinates.

## Sprint 4A.4 Measurement-driven Rebuild

| Pass | Before diff | After diff | Contract / Regions changed | Result |
|---|---:|---:|---|---|
| Layout contract | 10.4747% | 10.4747% | Measured Screen 08 canvas, shell, topbar, KPI band, dashboard grid, and card boxes | Contract documented, no source visual change |
| Command-specific primitives | 10.4747% | 10.6766% | KPI band, panel headers, activity timeline/avatar, action rows, alert rows, cost legend | Worsened diff; reverted source changes |
| Font-family rendering probe | 10.6766% | 10.9158% | Global font stack probe | Worsened diff; reverted source changes |

## Layout Contract

See `docs/11-quality/screen-08-layout-contract.md`.

## Static Asset Guardrail

- `parity_08/sidebar.png` rendered: No
- `parity_08/topbar.png` rendered: No
- `parity_08/content.png` rendered: No
- `backgroundImage`: No

## Current Result

| Screen | Route | Mode | Diff | Gate <=3% | Gate <=1% |
|---|---|---|---:|---|---|
| 08 | `/command-center` | Real UI Components | 10.4747% | Fail | Not run |

4A.4 conclusion: the measured contract confirms macro positions are already close, but replacing internals with route-specific real components did not reduce pixel mismatch. The blocker is not missing measured boxes; it is exact visual primitive fidelity versus the PNG reference, especially icons/avatars/charts/text rasterization. Failed source tuning was reverted; only documentation and the layout contract were kept.

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
