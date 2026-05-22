# Sprint 4N — Real UI Demo v1 Exit Report

## Goal
Validate the full Real UI Demo v1 flow after converting demo-critical routes from static slices to real React UI components.

## Demo v1 Flow

1. `/command-center`
2. `/workforce`
3. `/org-chart`
4. `/agents/demo-agent`
5. `/tickets`
6. `/tickets/demo-ticket`
7. `/runs/demo-run`
8. `/approvals`

## Build & Regression

| Check | Result |
|---|---|
| `npm run build` | pass |
| onboarding 01–07 | pass |

## Route → Component Audit

| Screen | Route | Component | Uses AppShell | Status |
|---|---|---|---|---|
| 08 | `/command-center` | `CommandCenter` | Yes | pass |
| 20 | `/workforce` | `WorkforceOverviewRealPage` | Yes | pass |
| 21 | `/org-chart` | `OrgChartRealPage` | Yes | pass |
| 23 | `/agents/demo-agent` | `AgentDetailRealPage` | Yes | pass |
| 30 | `/tickets` | `TicketsBoardRealPage` | Yes | pass |
| 32 | `/tickets/demo-ticket` | `TicketDetailRealPage` | Yes | pass |
| 34 | `/runs/demo-run` | `RunConsoleRealPage` | Yes | pass |
| 37 | `/approvals` | `ApprovalCenterRealPage` | Yes | pass |

## Static Asset Guardrail

| Route | Static slices rendered | Status |
|---|---|---|
| `/command-center` | No | pass |
| `/workforce` | No | pass |
| `/org-chart` | No | pass |
| `/agents/demo-agent` | No | pass |
| `/tickets` | No | pass |
| `/tickets/demo-ticket` | No | pass |
| `/runs/demo-run` | No | pass |
| `/approvals` | No | pass |

## Structural BBox Results

| Screen | Route | Regions passed | Status |
|---|---|---:|---|
| 08 | `/command-center` | 14/14 | pass |
| 20 | `/workforce` | 14/14 | pass |
| 21 | `/org-chart` | 10/10 | pass |
| 23 | `/agents/demo-agent` | 18/18 | pass |
| 30 | `/tickets` | 12/12 | pass |
| 32 | `/tickets/demo-ticket` | 15/15 | pass |
| 34 | `/runs/demo-run` | 16/16 | pass |
| 37 | `/approvals` | 13/13 | pass |

## Pixel Diff Reference

| Screen | Route | Pixel diff | Notes |
|---|---|---:|---|
| 08 | `/command-center` | 10.5256% | Visual polish deferred |
| 20 | `/workforce` | 9.4318% | Visual polish deferred |
| 21 | `/org-chart` | 11.4165% | Visual polish deferred |
| 23 | `/agents/demo-agent` | 8.0451% | Visual polish deferred |
| 30 | `/tickets` | 10.6961% | Visual polish deferred |
| 32 | `/tickets/demo-ticket` | 7.7372% | Visual polish deferred |
| 34 | `/runs/demo-run` | 12.5042% | Visual polish deferred |
| 37 | `/approvals` | 8.6397% | Visual polish deferred |

## Smoke Navigation

| Route | Loaded | Main selector found | Status |
|---|---|---|---|
| `/command-center` | yes | yes | pass |
| `/workforce` | yes | yes | pass |
| `/org-chart` | yes | yes | pass |
| `/agents/demo-agent` | yes | yes | pass |
| `/tickets` | yes | yes | pass |
| `/tickets/demo-ticket` | yes | yes | pass |
| `/runs/demo-run` | yes | yes | pass |
| `/approvals` | yes | yes | pass |

## Decision

PASS

PASS criteria met:
- Build pass.
- Onboarding pass.
- Static guardrail pass across the full flow.
- BBox pass across the full flow.
- Smoke navigation pass 8/8.

## Next Step

Recommended next sprint options:
1. Sprint 5A — Data/API Integration Foundation.
2. Sprint 5B — Visual Polish System.
3. Sprint 5C — Navigation & Interaction Wiring.
