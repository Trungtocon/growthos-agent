# Sprint 8D — Execution Timeline & Replay Report

## Goal

Build an Execution Timeline & Replay layer on top of Agent Execution Graph, Runtime Store, Tool Calls, Artifacts, Approvals, Usage Ledger, and Governance Decisions.

## Files Added

- `src/runtime/execution-timeline.ts`
- `src/runtime/execution-timeline-store.ts`
- `src/pages/ExecutionTimelinePage.tsx`
- `scripts/smoke-execution-timeline.mjs`
- `docs/13-integrations/EXECUTION_TIMELINE_ARCHITECTURE.md`
- `docs/13-integrations/SPRINT_8D_EXECUTION_TIMELINE_REPORT.md`

## Files Modified

- `src/App.tsx`
- `src/domain/selectors.ts`
- `src/pages/DemoScreens.tsx`
- `src/pages/ExecutionGraphPage.tsx`
- `package.json`

## Event Types

- `RUN_CREATED`
- `PLAN_CREATED`
- `STEP_STARTED`
- `TOOL_STARTED`
- `TOOL_COMPLETED`
- `ARTIFACT_CREATED`
- `APPROVAL_REQUESTED`
- `APPROVAL_APPROVED`
- `APPROVAL_REJECTED`
- `GOVERNANCE_DECISION`
- `USAGE_RECORDED`
- `COST_RECORDED`
- `RUN_COMPLETED`
- `RUN_FAILED`
- `RUN_CANCELLED`

## Routes

| Route | Purpose |
|---|---|
| `/execution-timeline` | Timeline summary, vertical event timeline, replay frames, replay state, references |

## Widgets

Compact timeline widgets were added to:

- `/runs/demo-run`
- `/tickets/demo-ticket`
- `/agents/demo-agent`
- `/execution-graph`

## Artifact Exports

- `execution-timeline.json`
- `execution-timeline.md`
- `execution-replay.json`
- `execution-replay-summary.md`

## Verification

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run validate:demo-data` | pass |
| `npm run audit:static-assets` | pass |
| `npm run smoke:real-ui-flow` | pass |
| `npm run smoke:artifact-registry` | pass |
| `npm run smoke:agent-execution-graph` | pass |
| `npm run smoke:execution-timeline` | pass 10/10 |
| `npm run smoke:interactions` | pass |
| `npm run smoke:workflow-actions` | pass |
| `npm run smoke:runtime-integration` | pass |
| `npm run smoke:runtime-persistence` | pass |
| `npm run audit:bbox:35` | pass 8/8 |
| core bbox 08/20/21/23/30/32/34/37 | pass |

## Decision

PASS.
