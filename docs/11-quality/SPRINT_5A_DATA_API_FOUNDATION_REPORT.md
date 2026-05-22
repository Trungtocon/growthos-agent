# Sprint 5A - Data/API Integration Foundation Report

## Goal

Move Real UI Demo v1 from hard-coded screen data toward shared typed data, mock API services, view models, hooks, and data validation without changing visual layout geometry.

## Files Added/Changed

- `src/domain/types.ts`
- `src/data/demo-fixtures.ts`
- `src/domain/selectors.ts`
- `src/services/demo-api.ts`
- `src/state/demo-data-store.ts`
- `scripts/validate-demo-data.mjs`
- `package.json`
- `src/pages/DemoScreens.tsx`
- `docs/12-data/DEMO_DATA_MODEL.md`
- `docs/11-quality/SPRINT_5A_DATA_API_FOUNDATION_REPORT.md`

## Domain Types

- Workspace
- User
- Agent
- Ticket
- Run
- Approval
- Goal
- Activity
- Metric
- CostBreakdown
- Artifact
- ToolCall

## Mock API

- `getWorkspace`
- `getCurrentUser`
- `getCommandCenterSummary`
- `getWorkforceOverview`
- `getOrgChart`
- `getAgentById`
- `getDemoAgent`
- `getTicketsBoard`
- `getTicketById`
- `getDemoTicket`
- `getRunById`
- `getDemoRun`
- `getApprovals`
- `getApprovalById`
- `getRecentActivities`
- `getCostBreakdown`

## View Models / Hooks

View models:

- `selectCommandCenterViewModel`
- `selectWorkforceViewModel`
- `selectOrgChartViewModel`
- `selectAgentDetailViewModel`
- `selectTicketsBoardViewModel`
- `selectTicketDetailViewModel`
- `selectRunConsoleViewModel`
- `selectApprovalCenterViewModel`

Hooks:

- `useCommandCenterData`
- `useWorkforceData`
- `useOrgChartData`
- `useAgentDetailData`
- `useTicketsBoardData`
- `useTicketDetailData`
- `useRunConsoleData`
- `useApprovalCenterData`

## Data Validation

| Check | Result |
|---|---|
| Unique agent IDs | pass |
| Unique ticket IDs | pass |
| Unique run IDs | pass |
| Unique approval IDs | pass |
| Ticket owner references | pass |
| Run ticket/agent references | pass |
| Approval ticket/agent/run references | pass |
| Activity related references | pass |
| Demo agent/ticket/run/approval records | pass |

## UI Data Wiring

| Route | Data wiring |
|---|---|
| /command-center | KPI cards and command center data hook |
| /workforce | Workforce data hook and KPI view model |
| /org-chart | Org chart data hook |
| /agents/demo-agent | Agent detail data hook |
| /tickets | Tickets board data hook and KPI view model |
| /tickets/demo-ticket | Ticket detail data hook |
| /runs/demo-run | Run console data hook |
| /approvals | Approval center data hook and KPI view model |

## Regression

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run validate:demo-data` | pass |
| onboarding 01-07 | pass |
| bbox 08/20/21/23/30/32/34/37 | pass |
| smoke real UI flow | pass |
| static asset guardrail | pass |
| pixel reference 08/20/21/23/30/32/34/37 under 15% | pass |

## Decision

PASS.

## Next Step

Recommended:

- Sprint 5B - Navigation & Interaction Wiring
- Sprint 5C - Visual Polish System
