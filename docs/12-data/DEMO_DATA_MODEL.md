# Demo Data Model

## Purpose

Real UI Demo v1 now reads from shared typed demo data, mock API services, view models, and lightweight hooks. The goal is to keep the current structural gates stable while preparing the UI for a real backend.

## Entities

- Workspace
- User
- Agent
- Ticket
- Run
- Approval
- Goal
- Activity
- CostBreakdown
- Artifact
- ToolCall

## Relationships

- Agent owns Tickets through `Ticket.ownerAgentId`.
- Ticket may link to a Goal through `Ticket.relatedGoalId`.
- Ticket may link to a Run through `Ticket.runId`.
- Run belongs to an Agent and Ticket through `Run.agentId` and `Run.ticketId`.
- Approval belongs to Ticket, Agent, and optionally Run.
- Activity can link back to Agent, Ticket, and Run.
- CostBreakdown is shared across dashboard and workforce views.

## Demo Routes Data Mapping

| Route | View Model | Data Source |
|---|---|---|
| /command-center | `selectCommandCenterViewModel` | agents, tickets, runs, approvals, goals, activities, cost |
| /workforce | `selectWorkforceViewModel` | agents, tickets, runs |
| /org-chart | `selectOrgChartViewModel` | agents |
| /agents/demo-agent | `selectAgentDetailViewModel` | agents, tickets, runs |
| /tickets | `selectTicketsBoardViewModel` | tickets, agents |
| /tickets/demo-ticket | `selectTicketDetailViewModel` | ticket, run, approval |
| /runs/demo-run | `selectRunConsoleViewModel` | run, ticket, agent, artifacts |
| /approvals | `selectApprovalCenterViewModel` | approvals, tickets, runs, agents |

## Files

- `src/domain/types.ts` defines the shared contracts.
- `src/data/demo-fixtures.ts` contains linked fixtures.
- `src/domain/selectors.ts` creates route-specific view models.
- `src/services/demo-api.ts` exposes async mock API functions.
- `src/state/demo-data-store.ts` exposes React hooks for current screens.
- `scripts/validate-demo-data.mjs` validates IDs, references, and demo route records.
