# Sprint 5H — Workforce Support Real UI Report

## Goal

Convert workforce support routes from scaffold placeholders into Real UI screens with AppShell, selector-driven data, data-parity regions, and structural bbox gates.

## Scope

| Screen | Route | Component |
|---|---|---|
| 22 | `/agents` | `AgentsListScreen` |
| 24 | `/agents/new` | `CreateAgentScreen` |
| 25 | `/agents/templates` | `AgentTemplatesScreen` |
| 26 | `/agents/performance` | `AgentPerformanceScreen` |
| 27 | `/agents/memory` | `AgentMemoryScreen` |
| 28 | `/skills` | `SkillsRegistryScreen` |
| 29 | `/tools/permissions` | `ToolsPermissionsScreen` |

## Static Asset Guardrail

| Check | Result |
|---|---|
| `parity_22` rendered | No |
| `parity_24` rendered | No |
| `parity_25` rendered | No |
| `parity_26` rendered | No |
| `parity_27` rendered | No |
| `parity_28` rendered | No |
| `parity_29` rendered | No |
| `sidebar.png`, `topbar.png`, `content.png` rendered | No |
| `backgroundImage` parity screenshot usage | No |

## Data Selectors

Sprint 5H added selector-driven view models for the workforce support wave:

- `selectAgentsListViewModel`
- `selectCreateAgentViewModel`
- `selectAgentTemplatesViewModel`
- `selectAgentPerformanceViewModel`
- `selectAgentMemoryViewModel`
- `selectSkillsRegistryViewModel`
- `selectToolsPermissionsViewModel`

The screens derive from existing demo agents, tickets, runs, skills, and tools instead of screen-local fixture arrays.

## Structural Gate

| Screen | Route | Regions Passed | Status |
|---|---|---:|---|
| 22 | `/agents` | 8/8 | Pass |
| 24 | `/agents/new` | 8/8 | Pass |
| 25 | `/agents/templates` | 8/8 | Pass |
| 26 | `/agents/performance` | 8/8 | Pass |
| 27 | `/agents/memory` | 8/8 | Pass |
| 28 | `/skills` | 8/8 | Pass |
| 29 | `/tools/permissions` | 8/8 | Pass |

## Pixel Diff Reference

Pixel diff remains a visual polish metric, not the primary real UI acceptance gate.

| Screen | Route | Pixel diff | Notes |
|---|---|---:|---|
| 22 | `/agents` | 8.5378% | Visual polish deferred |
| 24 | `/agents/new` | 8.8690% | Visual polish deferred |
| 25 | `/agents/templates` | 10.9707% | Visual polish deferred |
| 26 | `/agents/performance` | 17.7707% | Visual polish outlier; structural gate still pass |
| 27 | `/agents/memory` | 7.8775% | Visual polish deferred |
| 28 | `/skills` | 8.9239% | Visual polish deferred |
| 29 | `/tools/permissions` | 8.0755% | Visual polish deferred |

## Verification

| Check | Result |
|---|---|
| `npm run build` | Pass |
| `npm run validate:demo-data` | Pass |
| `npm run smoke:real-ui-flow` | Pass 26/26 |
| bbox 22/24/25/26/27/28/29 | Pass 56/56 |
| pixel reference 22/24-29 under 30% safety gate | Pass |

## Decision

PASS.

Sprint 5H promoted Screens 22 and 24-29 into Real UI structural coverage. Screen 26 remains the main visual polish candidate for a future dedicated polish sprint because its reference diff is above 15%.

## Next Step

Sprint 5I should convert the remaining work execution support routes:

- Screen 31 `/tickets/list`
- Screen 33 `/tickets/new`
- Screen 35 `/artifacts`
- Screen 36 `/artifacts/demo-artifact`
