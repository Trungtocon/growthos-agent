# Sprint 7D — Run Planning Engine Report

## Goal

Create a planning engine that converts a ticket/workflow request into an executable run plan using Capability Registry and Tool Registry.

## Files Added/Changed

| File | Purpose |
|---|---|
| `src/integrations/growthos-runtime/run-planner.ts` | Run plan domain model and planner logic. |
| `src/runtime-store/run-plan-store.ts` | Session-persisted run plan store. |
| `src/integrations/growthos-runtime/runtime-orchestrator.ts` | Plan creation, plan approval, and start-from-plan runtime entry points. |
| `src/domain/selectors.ts` | Plan selectors and ticket/run view model wiring. |
| `src/state/command-actions.ts` | Shared command actions for create/start plan. |
| `src/state/event-log.ts` | Workflow event command types for planning actions. |
| `src/pages/DemoScreens.tsx` | Lightweight ticket/run plan UI wiring. |
| `scripts/smoke-run-planner.mjs` | Planner smoke automation. |
| `package.json` | Adds `smoke:run-planner`. |
| `docs/13-integrations/RUN_PLANNING_ENGINE_ARCHITECTURE.md` | Architecture documentation. |

## Plan Model

The planner creates `RunPlan` and `RunPlanStep` records with capability coverage, missing capability detection, mapped tool/model IDs, expected outputs, and approval estimates.

## Workflow Mapping

| Workflow | Expected status | Notes |
|---|---|---|
| `demo-run-execution` | ready | Maps research, planning, execution, and artifact generation. |
| `approval-gated-artifact` | ready | Adds approval handling. |
| `deployment-readiness` | blocked | Current mock Hermes registry does not expose deployment capability. |

## Runtime Rules

- Blocked plans cannot start.
- Ready plans start the existing streaming run path.
- Starting from a plan seeds `tool-call-store` with queued tool calls derived from plan steps.
- UI reads plan state through selectors/store.

## Verification

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run validate:demo-data` | pass |
| `npm run audit:static-assets` | pass |
| `npm run smoke:run-planner` | pass, 9/9 |
| Existing smoke gates | pass |
| Onboarding 01-07 | pass |
| Core bbox gates | pass |

## Decision

PASS.
