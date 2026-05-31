# Sprint 7F - Execution Budget & Cost Governance Report

## Goal

Add execution cost, risk, and budget governance to the run planning and runtime execution path without changing AppShell or bypassing selectors/runtime-orchestrator.

## Cost Model

| Model | Description |
|---|---|
| Tool cost profile | Estimates cost, token usage, duration, and risk for a Hermes-discovered tool. |
| Model cost profile | Adds model-level token/cost/duration estimates. |
| Execution estimate | Aggregates tool/model cost profiles for a `RunPlan`. |
| Execution budget | Sets max cost, approval threshold, duration threshold, and max risk. |

## Risk Model

Risk is ranked as `low`, `medium`, `high`, `critical`. Tool names/categories/descriptions infer risk deterministically for the mock/sandbox registry.

## Budget Policies

| Policy | Severity | Result |
|---|---|---|
| `budget_limit_exceeded` | blocking | Prevents execution above max budget. |
| `high_risk_execution` | blocking | Prevents execution above configured risk. |
| `expensive_model_requires_approval` | warning | Requires approval for expensive plans. |
| `deployment_requires_budget_review` | warning | Requires budget review for deployment workflows. |

## Routes Wired

| Route | Budget Surface |
|---|---|
| `/tickets/demo-ticket` | Estimated cost, duration, risk, budget status. |
| `/runs/demo-run` | Execution estimate in run inspector. |
| `/approvals` | Budget approval request count and generated approval queue entries. |

## Verification

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run validate:demo-data` | pass |
| `npm run smoke:execution-budget` | pass 8/8 |
| runtime smoke suite | pass |
| onboarding 01-07 | pass 7/7 |
| bbox 08/20/21/23/30/32/34/37 | pass |
| static asset audit | pass |

## Decision

PASS.
