# Sprint 5E - Workflow Actions Foundation Report

## Goal

Add an optimistic workflow command pipeline to Real UI Demo v1 while preserving the existing structural gates.

## Files Added/Changed

- Workflow command layer: `src/state/command-actions.ts`, `src/state/workflow-engine.ts`, `src/state/async-actions.ts`.
- Event system: `src/state/event-log.ts`, `src/services/activity-service.ts`.
- Selector and hook reconciliation: `src/domain/selectors.ts`, `src/state/demo-data-store.ts`.
- Mock mutation adapter: `src/services/demo-api.ts`.
- UI command surfaces: `src/pages/DemoScreens.tsx`, `src/components/ui/DemoPrimitives.tsx`.
- Automation: `scripts/smoke-workflow-actions.mjs`, `package.json`.
- Architecture docs: `docs/12-data/WORKFLOW_ARCHITECTURE.md`, `docs/12-data/EVENT_SYSTEM.md`.

## Commands

| Command | Entity | Optimistic effect |
|---|---|---|
| `approveApproval` | Approval | Approved decision and audit row |
| `rejectApproval` | Approval | Rejected decision and audit row |
| `retryRun` | Run | Running status and retry step |
| `pauseRun` | Run | Paused status |
| `resumeRun` | Run | Running status |
| `assignTicket` | Ticket | Owner and agent workload update |
| `escalateTicket` | Ticket | Critical priority and high risk |
| `resolveTicket` | Ticket | Done ticket and completed linked run |

## Optimistic Update Lifecycle

| Stage | Store effect | UI effect |
|---|---|---|
| Pending | Optimistic graph, pending mutation, pending event | Immediate status update and pending tag |
| Success | Mutation settles and success event appends | KPIs and timelines stay selector-consistent |
| Failure | Rollback graph, failure event, entity error | Prior status restored with inline error |

## Timeline Wiring

- Command center activity rows merge workflow events with fixture activity rows.
- Ticket detail shows ticket-linked workflow events.
- Run console shows run control workflow events.
- Approval center audit section shows approval decision workflow events.

## Automation

| Check | Result |
|---|---|
| `npm run smoke:workflow-actions` | Pass 5/5 |
| Approval approve/reject | Pass |
| Run retry/pause/resume | Pass |
| Ticket assign/escalate/resolve | Pass |
| Rollback failure | Pass |

## Regression

| Check | Result |
|---|---|
| `npm run build` | Pass |
| `npm run validate:demo-data` | Pass |
| Static guardrail scan | Pass, no Real UI parity slice or `backgroundImage` source matches |
| Onboarding 01-07 | Pass at <=1% |
| Bbox 08/20/21/23/30/32/34/37 | Pass |
| Smoke real UI flow | Pass 8/8 |
| Smoke interactions | Pass 7/7 |
| Smoke workflow actions | Pass 5/5 |

## Decision

PASS. The workflow command layer is active and the locked Real UI Demo v1 structural gates remain green.
