# Sprint 5L - Integrations and Workspace Real UI Conversion Report

## Goal

Convert the integrations/workspace admin wave from scaffold fallback routes into real AppShell UI with selector-driven data and structural bbox gates.

## Screens

| Screen | Route | Component | Status |
|---|---|---|---|
| 46 | `/integrations` | `IntegrationsHubScreen + AppShell` | Real UI Structural PASS |
| 47 | `/integrations/demo-integration` | `IntegrationDetailScreen + AppShell` | Real UI Structural PASS |
| 48 | `/mcp` | `McpServerManagerScreen + AppShell` | Real UI Structural PASS |
| 49 | `/workspaces` | `WorkspacesManagerScreen + AppShell` | Real UI Structural PASS |

## Static Asset Guardrail

| Route | Static slices rendered | Status |
|---|---|---|
| `/integrations` | No `parity_46` slices, no `backgroundImage` | Pass |
| `/integrations/demo-integration` | No `parity_47` slices, no `backgroundImage` | Pass |
| `/mcp` | No `parity_48` slices, no `backgroundImage` | Pass |
| `/workspaces` | No `parity_49` slices, no `backgroundImage` | Pass |

## Components Added/Changed

- `IntegrationsHubScreen`
- `IntegrationDetailScreen`
- `McpServerManagerScreen`
- `WorkspacesManagerScreen`
- `selectIntegrationsHubViewModel`
- `selectIntegrationDetailViewModel`
- `selectMcpServerManagerViewModel`
- `selectWorkspacesManagerViewModel`

## Structural Gate

| Screen | Route | Regions passed | Status |
|---|---|---:|---|
| 46 | `/integrations` | 8/8 | Pass |
| 47 | `/integrations/demo-integration` | 8/8 | Pass |
| 48 | `/mcp` | 8/8 | Pass |
| 49 | `/workspaces` | 8/8 | Pass |

## Pixel Diff Reference

Pixel diff remains a visual polish metric, not the Sprint 5L acceptance gate.

| Screen | Route | Pixel diff | Notes |
|---|---|---:|---|
| 46 | `/integrations` | 7.8805% | Visual polish deferred |
| 47 | `/integrations/demo-integration` | 6.9364% | Visual polish deferred |
| 48 | `/mcp` | 7.1559% | Visual polish deferred |
| 49 | `/workspaces` | 7.1471% | Visual polish deferred |

## Verification

| Check | Result |
|---|---|
| `npm run build` | Pass |
| `npm run validate:demo-data` | Pass |
| `npm run smoke:real-ui-flow` | Pass |
| `npm run smoke:interactions` | Pass |
| `npm run smoke:workflow-actions` | Pass |
| onboarding 01-07 parity | Pass |
| bbox 08-49 | Pass |
| static guardrail | Pass |

## Decision

PASS.

## Next Step

Sprint 5M should convert the remaining admin/help routes 50-55.
