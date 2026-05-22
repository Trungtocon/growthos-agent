# Sprint 4D - Command Center Structural Parity Report

## Goal

Create DOM bounding-box structural parity gate for `/command-center`.

## Why

Pixel diff stayed around 10.5% despite multiple tuning attempts. We need component-level geometry measurement before further visual tuning.

## Static Asset Guardrail

| Check | Result |
|---|---|
| `parity_08/sidebar.png` rendered | No |
| `parity_08/topbar.png` rendered | No |
| `parity_08/content.png` rendered | No |
| `backgroundImage` rendered | No |

## Files Added/Changed

- `docs/11-quality/screen-08-layout-contract.json`
- `scripts/audit-screen-08-bboxes.mjs`
- `package.json`
- `src/components/layout/AppShell.tsx`
- `src/components/ui/DemoPrimitives.tsx`
- `src/pages/DemoScreens.tsx`
- `parity-reports/08_executive-command-center/bbox-report.json`

## Bounding Box Results

| Region | Expected | Actual | dx | dy | dw | dh | Status |
|---|---|---|---:|---:|---:|---:|---|
| app-shell.sidebar | 0/0/218/941 | 0/0/218/941 | 0 | 0 | 0 | 0 | passed |
| app-shell.topbar | 218/0/1454/72 | 218/0/1454/72 | 0 | 0 | 0 | 0 | passed |
| app-shell.main | 240/90/1410/851 | 240/90/1410/851 | 0 | 0 | 0 | 0 | passed |
| command.header | 240/90/334/64 | 240/90/334.1/64 | 0 | 0 | 0.1 | 0 | passed |
| command.kpi-band | 240/170/1400/112 | 240/170/1410/112 | 0 | 0 | 10 | 0 | passed |
| command.main-grid | 240/299/1400/609 | 240/298/1410/609 | 0 | -1 | 10 | 0 | passed |
| command.main-left | 240/299/488/609 | 240/298/491.3/609 | 0 | -1 | 3.3 | 0 | passed |
| command.main-right | 1152/299/488/609 | 1158.7/298/491.3/609 | 6.7 | -1 | 3.3 | 0 | passed |
| command.health-card | 240/299/488/324 | 240/298/491.3/324 | 0 | -1 | 3.3 | 0 | passed |
| command.goals-card | 744/299/392/324 | 747.3/298/395.5/324 | 3.3 | -1 | 3.5 | 0 | passed |
| command.activity-card | 1152/299/488/324 | 1158.7/298/491.3/324 | 6.7 | -1 | 3.3 | 0 | passed |
| command.actions-card | 240/639/488/269 | 240/638/491.3/269 | 0 | -1 | 3.3 | 0 | passed |
| command.alerts-card | 744/639/392/269 | 747.3/638/395.5/269 | 3.3 | -1 | 3.5 | 0 | passed |
| command.cost-card | 1152/639/488/269 | 1158.7/638/491.3/269 | 6.7 | -1 | 3.3 | 0 | passed |

## Pixel Diff

| Screen | Route | Pixel diff before | Pixel diff after | Notes |
|---|---|---:|---:|---|
| 08 | /command-center | 10.5256% | 10.5256% | Structural gate sprint; visual primitive tuning is deferred |

## Decision

PASS.

## Next Step

Sprint 4E can tune visual primitives now that container geometry is measurable:

- typography scale and font rendering
- icon art and avatar art
- chart internals
- status badges
- activity rows and card internals
