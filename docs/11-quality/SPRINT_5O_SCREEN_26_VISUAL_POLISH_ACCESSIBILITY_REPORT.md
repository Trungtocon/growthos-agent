# Sprint 5O — Screen 26 Visual Polish & Accessibility Report

## Goal

Harden `/agents/performance` against the Screen 26 PNG reference while preserving the Real UI structural baseline and adding a lightweight accessibility smoke gate for authenticated Real UI routes.

## Strategy

Screen 26 was the clearest visual polish outlier after the full app structural exit gate. The previous contract measured a simplified real UI layout, not the denser source PNG. Sprint 5O uses a documented reference recalibration exception for Screen 26 only.

## Static Asset Guardrail

| Check | Result |
|---|---|
| `parity_26/sidebar.png` rendered | No |
| `parity_26/topbar.png` rendered | No |
| `parity_26/content.png` rendered | No |
| `backgroundImage` from parity assets | No |

## Screen 26 Changes

- Rebuilt `AgentPerformanceScreen` into a dense performance dashboard aligned to `public/stitch_ui/26_Agent_Performance.png`.
- Added 6 KPI cards, header action group, ranking panel, detailed table, failure analysis, cost-vs-quality SVG chart, recommendations, and attention agents.
- Extended `selectAgentPerformanceViewModel()` so Screen 26 data comes from shared selector-derived view models instead of screen-local arrays.
- Added a route-specific AppShell profile for `/agents/performance` to match the measured dark-sidebar reference geometry.
- Updated only `docs/11-quality/screen-26-layout-contract.json` with a documented Sprint 5O exception.

## Accessibility Hardening

- Added accessible names to icon-only controls.
- Added progressbar ARIA metadata to `ProgressBar`.
- Added an explicit AppShell search input label.
- Added `scripts/audit-accessibility-smoke.mjs` and `npm run audit:a11y:real-ui`.

## Structural Gate

| Screen | Route | Regions | Result |
|---|---|---:|---|
| 26 | `/agents/performance` | 12/12 | Pass |
| 08-55 | Authenticated Real UI routes | 48/48 route audits | Pass |

## Pixel Reference

| Screen | Route | Before | After | Delta | Safety Gate |
|---|---|---:|---:|---:|---|
| 26 | `/agents/performance` | 17.7707% | 11.2214% | -6.5493 pp | Pass <=15% |

## Verification

| Check | Result |
|---|---|
| `npm run build` | Pass |
| `npm run validate:demo-data` | Pass |
| `npm run smoke:real-ui-flow` | Pass 48/48 |
| `npm run smoke:interactions` | Pass 7/7 |
| `npm run smoke:workflow-actions` | Pass 5/5 |
| `npm run audit:a11y:real-ui` | Pass 48/48 |
| `npm run audit:bbox:26` | Pass 12/12 |
| `npm run audit:bbox:08` through `audit:bbox:55` | Pass 48/48 |
| onboarding parity 01-07 | Pass 7/7 |
| Screen 26 pixel reference at 15% | Pass, 11.2214% |

## Decision

PASS.

Screen 26 is now structurally accepted with a recalibrated contract and is below the 15% visual polish safety gate. Further work should continue from broader product polish or backend adapter readiness without reverting Real UI routes to static slices.
