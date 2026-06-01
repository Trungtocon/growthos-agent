# Sprint 8C - Agent Execution Graph Report

## Goal

Build an Agent Execution Graph layer that connects agents, plans, steps, tool calls, approvals, artifacts, cost, usage, and governance decisions into one traceable execution model.

## Files Added

- `src/runtime/agent-execution-graph.ts`
- `src/runtime/agent-execution-graph-store.ts`
- `src/pages/ExecutionGraphPage.tsx`
- `scripts/smoke-agent-execution-graph.mjs`
- `docs/13-integrations/AGENT_EXECUTION_GRAPH_ARCHITECTURE.md`
- `docs/13-integrations/SPRINT_8C_AGENT_EXECUTION_GRAPH_REPORT.md`

## Files Changed

- `src/App.tsx`
- `src/domain/selectors.ts`
- `src/runtime/artifact-registry.ts`
- `src/pages/DemoScreens.tsx`
- `package.json`

## Graph Model

| Area | Supported |
|---|---|
| Node types | AGENT, RUN, PLAN, STEP, TOOL_CALL, ARTIFACT, APPROVAL, GOVERNANCE_DECISION, USAGE, COST, ERROR |
| Edge types | CREATED, EXECUTES, USES_TOOL, PRODUCES, REQUIRES_APPROVAL, APPROVED_BY, BLOCKED_BY, BILLED_AS, FAILED_AT |
| Persistence | sessionStorage graph snapshots |
| Duplicate prevention | deterministic node and edge IDs |
| Artifact lineage | run, agent, ticket, plan, step, tool, approval metadata |
| Exports | execution graph JSON, execution trace, artifact lineage, approval lineage |

## Routes Wired

| Route | Result |
|---|---|
| `/execution-graph` | New graph route |
| `/runs/demo-run` | Compact graph marker |
| `/tickets/demo-ticket` | Compact graph marker |
| `/agents/demo-agent` | Compact graph marker |

## Smoke Coverage

`npm run smoke:agent-execution-graph` validates:

1. graph builds for demo run
2. graph contains agent/run/plan/step/tool/artifact nodes
3. artifact lineage works
4. approval lineage works
5. governance blocked node appears
6. cost and usage nodes attach correctly
7. no duplicate node IDs
8. no duplicate edges
9. graph persists after reload
10. graph exports register into Artifact Registry

## Decision

PARTIAL in dirty workspace verification.

Sprint 8C implementation gates passed:

- `npm run build`
- `npm run validate:demo-data`
- `npm run smoke:artifact-registry`
- `npm run smoke:agent-execution-graph` (12/12)
- runtime/governance smoke suite
- onboarding parity 01-07
- bbox core 08/20/21/23/30/32/34/37

Known unrelated dirty-tree blockers observed during full verification:

- `npm run audit:static-assets` reports `src/pages/Sprint2Screens.tsx` using `parity_35/content.png` from an existing unstaged visual hunk.
- `npm run smoke:real-ui-flow` reports `/artifacts` failed because the same unstaged Screen 35 visual hunk is active in the working tree.
- `npm run audit:bbox:35` reports 0/8 for `/artifacts`; this is outside Sprint 8C and not staged.

Sprint 8C files are safe to checkpoint independently; generated evidence and unrelated dirty source are intentionally left unstaged.
