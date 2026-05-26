# Sprint 5P — Run Console Visual Polish Report

## Goal

Reduce Screen 34 `/runs/demo-run` visual mismatch while preserving Real UI structural gates and avoiding static parity slices.

## Scope

- Screen 34 only.
- No `parity_34/sidebar.png`, `topbar.png`, `content.png`, full screenshot, cropped screenshot, or `backgroundImage`.
- No changes to the Screen 34 bbox contract.

## Changes Kept

- Added a Run Console-specific AppShell navigation list matching the source PNG labels more closely.
- Removed the topbar `+ Create` action from `/runs/demo-run`, because the source PNG uses route actions in the page header instead.
- Shifted the Run Console topbar search position closer to the source PNG.

## Changes Reverted

- A compact status/KPI band was tested but reverted because it worsened Screen 34 pixel diff from `12.2634%` to `12.9915%`.

## Verification

| Check | Result |
|---|---|
| `npm run build` | Pass |
| `npm run validate:demo-data` | Pass |
| `npm run smoke:real-ui-flow` | Pass 48/48 |
| `npm run smoke:interactions` | Pass 7/7 |
| `npm run smoke:workflow-actions` | Pass 5/5 |
| `npm run audit:a11y:real-ui` | Pass 48/48 |
| `npm run audit:bbox:34` | Pass 16/16 |
| onboarding parity 01-07 | Pass 7/7 |
| Screen 34 pixel reference at 15% | Pass, 12.2634% |

## Pixel Reference

| Screen | Route | Before | After | Delta | Result |
|---|---|---:|---:|---:|---|
| 34 | `/runs/demo-run` | 12.5159% | 12.2634% | -0.2525 pp | Improved |

## Decision

PASS as an incremental visual polish checkpoint.

The next deeper Screen 34 improvement likely requires reference-driven internal component recalibration for the timeline, tool calls, logs, and inspector panels. That should be handled as a separate measured pass because a quick density reduction made the diff worse.
