# Agent Execution Graph Architecture

## Purpose

The Agent Execution Graph gives GrowthOS a traceable model for one runtime execution. It connects the operational entities that previously lived in separate stores:

Agent -> RunPlan -> RunPlanStep -> RuntimeToolCall -> ArtifactRecord -> ApprovalRequest -> UsageRecord -> GovernanceDecision

## Runtime Boundary

UI never talks directly to Hermes or Paperclip. Graph construction reads normalized GrowthOS stores only:

- workflow data for agents, tickets, and base runs
- runtime-store for persisted runs, approvals, tool calls, usage, and billing ledger
- artifact registry for generated outputs and exports
- governance stores for decisions, blocked executions, and enforcement state

## Node Types

| Type | Source |
|---|---|
| AGENT | demo workflow data |
| RUN | runtime run-store |
| PLAN | run-plan-store |
| STEP | run plan steps |
| TOOL_CALL | tool-call-store |
| ARTIFACT | artifact-registry-store |
| APPROVAL | approval-store |
| GOVERNANCE_DECISION | governance-decision-store |
| USAGE | usage-ledger-store |
| COST | billing ledger |
| ERROR | failed runs or blocked enforcement |

## Edge Types

| Type | Meaning |
|---|---|
| CREATED | Plan created a run |
| EXECUTES | Agent/plan/step execution relationship |
| USES_TOOL | Run or step uses a runtime tool |
| PRODUCES | Tool/run produces artifact |
| REQUIRES_APPROVAL | Run/tool requires approval |
| APPROVED_BY | Approval or governance permits execution |
| BLOCKED_BY | Governance/enforcement blocks execution |
| BILLED_AS | Run/tool is billed as usage/cost |
| FAILED_AT | Run failed at a runtime point |

## Persistence

`src/runtime/agent-execution-graph-store.ts` persists snapshots in `sessionStorage` under `uikigai-agent-execution-graphs-v1`. The store prevents duplicate node IDs and duplicate edge IDs by using deterministic IDs.

## Artifact Lineage

When a graph is built, artifact registry metadata is enriched with lineage fields:

- `runId`
- `agentId`
- `ticketId`
- `planId`
- `stepId`
- `toolId`
- `approvalId`

Graph exports are registered back into Artifact Registry as run-linked export artifacts:

- `execution-graph.json`
- `execution-trace.md`
- `artifact-lineage.md`
- `approval-lineage.md`

## UI

The `/execution-graph` route renders a lightweight DOM/SVG graph without introducing a graph dependency. Compact graph markers are exposed on:

- `/runs/demo-run`
- `/tickets/demo-ticket`
- `/agents/demo-agent`

These markers are selector-driven and do not change visual parity layout.
