# Sprint 7E — Plan Execution Policy Report

## Goal

Add policy and approval constraints to `RunPlan` and `RunPlanStep` before runtime execution while preserving the existing runtime-orchestrator integration path.

## Policies Added

| Policy | Severity | Result |
|---|---|---|
| `missing_capability_blocks_execution` | blocking | Prevents plans with missing required capabilities from starting. |
| `incompatible_tool_model_blocks_step` | blocking | Prevents incompatible tool/model execution. |
| `approval_required_for_artifact_generation` | warning | Artifact steps are approval gated. |
| `approval_required_for_external_action` | warning | External runtime actions are approval gated. |
| `deployment_capability_required_for_deployment` | blocking | Deployment workflows need deployment capability. |
| `unknown_tool_requires_review` | warning | Unknown tools are surfaced for review. |
| `high_risk_tool_requires_approval` | warning | High-risk tools require approval. |

## Runtime Behavior

| Scenario | Outcome |
|---|---|
| Ready demo run plan | Policy allowed; artifact step creates approval gate when started. |
| Deployment-readiness plan | Policy blocked; `startRunFromPlan` throws and no run starts. |
| Unknown tool on otherwise ready plan | Policy warning; warning persists and can be rendered through selectors. |
| Artifact generation step | Approval is created with `planId`, `stepId`, `runId`, and `toolId`. |

## UI Wiring

| Route | Policy Surface |
|---|---|
| `/tickets/demo-ticket` | Run plan policy status, policy warnings/blockers, disabled start button when blocked. |
| `/runs/demo-run` | Plan status includes policy state; inspector shows policy checks and approval-required step count. |
| `/approvals` | Plan policy approvals appear in the approval queue/detail flow. |

## Verification

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run validate:demo-data` | pass |
| `npm run audit:static-assets` | pass |
| runtime smoke suite | pass |
| `npm run smoke:plan-policy` | pass 8/8 |
| onboarding 01-07 | pass 7/7 |
| bbox 08/20/21/23/30/32/34/37 | pass |

## Decision

PASS.
