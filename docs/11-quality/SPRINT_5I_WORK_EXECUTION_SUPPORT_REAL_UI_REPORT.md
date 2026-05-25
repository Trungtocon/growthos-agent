# Sprint 5I — Work Execution Support Real UI Report

## Goal

Convert remaining work execution support routes from scaffold placeholders into Real UI screens with AppShell, selector-driven data, data-parity regions, and structural bbox gates.

## Scope

| Screen | Route | Component |
|---|---|---|
| 31 | `/tickets/list` | `TicketsListScreen` |
| 33 | `/tickets/new` | `CreateTicketScreen` |
| 35 | `/artifacts` | `ArtifactsLibraryScreen` |
| 36 | `/artifacts/demo-artifact` | `ArtifactDetailScreen` |

## Static Asset Guardrail

| Check | Result |
|---|---|
| `parity_31` rendered | No |
| `parity_33` rendered | No |
| `parity_35` rendered | No |
| `parity_36` rendered | No |
| `sidebar.png`, `topbar.png`, `content.png` rendered | No |
| `backgroundImage` parity screenshot usage | No |

## Data Selectors

Sprint 5I added selector-driven view models for ticket list/create and artifact library/detail routes:

- `selectTicketsListViewModel`
- `selectCreateTicketViewModel`
- `selectArtifactsLibraryViewModel`
- `selectArtifactDetailViewModel`

The screens derive from existing tickets, agents, goals, runs, approvals, and run artifacts instead of screen-local fixture arrays.

## Structural Gate

| Screen | Route | Regions Passed | Status |
|---|---|---:|---|
| 31 | `/tickets/list` | 8/8 | Pass |
| 33 | `/tickets/new` | 8/8 | Pass |
| 35 | `/artifacts` | 8/8 | Pass |
| 36 | `/artifacts/demo-artifact` | 7/7 | Pass |

## Pixel Diff Reference

Pixel diff remains a visual polish metric, not the primary real UI acceptance gate.

| Screen | Route | Pixel diff | Notes |
|---|---|---:|---|
| 31 | `/tickets/list` | 7.3032% | Visual polish deferred |
| 33 | `/tickets/new` | 8.5822% | Visual polish deferred |
| 35 | `/artifacts` | 6.7682% | Visual polish deferred |
| 36 | `/artifacts/demo-artifact` | 6.5207% | Visual polish deferred |

## Verification

| Check | Result |
|---|---|
| `npm run build` | Pass |
| bbox 31/33/35/36 | Pass 31/31 |
| pixel reference 31/33/35/36 under 30% safety gate | Pass |

## Decision

PASS.

Sprint 5I promoted the work execution support routes into Real UI structural coverage.

## Next Step

Sprint 5J should convert governance support routes:

- Screen 38 `/approvals/demo-approval`
- Screen 39 `/governance/policies`
- Screen 40 `/audit-log`
- Screen 41 `/risk-center`
