# Sprint 5Q — Lowest 1:1 Visual Polish Report

## Goal

Improve the five lowest 1:1 screens without reintroducing static parity slices or breaking existing structural gates.

## Target Screens

| Screen | Route | Before diff | Before 1:1 | After diff | After 1:1 | Result |
|---|---|---:|---:|---:|---:|---|
| 34 | `/runs/demo-run` | 12.2634% | 87.7366% | 12.1734% | 87.8266% | Improved |
| 21 | `/org-chart` | 11.1021% | 88.8979% | 10.9151% | 89.0849% | Improved |
| 26 | `/agents/performance` | 11.2214% | 88.7786% | 11.2214% | 88.7786% | Unchanged |
| 17 | `/projects` | 11.1671% | 88.8329% | 11.1671% | 88.8329% | Unchanged |
| 25 | `/agents/templates` | 10.9707% | 89.0293% | 10.9707% | 89.0293% | Unchanged |

## Changes Kept

- Screen 34 Run Console status KPI cards now use the compact metric variant while preserving the existing `run.status-band` bounding box.
- Screen 21 Org Chart right detail card now includes denser metadata/tags inside the existing locked `org.agent-card` bbox.
- No bbox contract changes were made.
- No static parity screenshots, cropped slices, or `backgroundImage` usage were introduced.

## Reverted Attempts

- Screen 17 and Screen 25 section-level rebuilds were tested but reverted because pixel diff worsened despite bbox passing.
- Screen 26 selector-scale tuning for cost scatter data was tested but reverted because pixel diff worsened slightly.
- Screen 34 macro vertical offset and compact tool-call table variants were tested and reverted because they worsened pixel diff or structural alignment.
- Screen 17 and Screen 25 header/KPI/filter-only variants were tested and reverted because they worsened pixel diff.

## Verification

| Check | Result |
|---|---|
| `npm run build` | Pass |
| `npm run audit:bbox:34` | Pass 16/16 |
| `npm run audit:bbox:21` | Pass 10/10 |
| `STRICT_MAX_DIFF_PERCENT=20.0 npm run parity:check -- --ids=34,21,26,17,25` | Pass 5/5 |

## Decision

PARTIAL. The sprint produced a measured improvement on the lowest screen, but the other four low-ratio screens need deeper source-PNG-driven rebuild passes rather than isolated component tweaks.
