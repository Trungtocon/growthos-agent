# Sprint 7G - Usage Limits & Runtime Billing Ledger Report

## Goal

Add actual usage tracking, quota enforcement, and a runtime billing ledger on top of Sprint 7F execution budget estimates.

## Usage Records Implemented

| Type | Runtime Source |
|---|---|
| `runtime_duration` | Run start and tool completion duration. |
| `tool_call` | Tool start. |
| `token` | Tool completion. |
| `artifact` | Paperclip/Hermes artifact creation. |
| `approval` | Budget, plan, stream, and quota approval gates. |
| `external_api` | Reserved for future sandbox provider billing. |

## Quota Rules

| Evaluation | Behavior |
|---|---|
| Before run | Blocks plan start if estimated usage exceeds quota. |
| During run | Marks running stream for review if actual usage exceeds quota. |
| After run | Finalizes ledger and records final quota status. |

## Estimated vs Actual

The ledger stores estimated total, actual total, variance, records, and open/finalized status per run. Actual mock cost is deterministic and derived from runtime tool/artifact/approval activity.

## Routes Wired

| Route | Surface |
|---|---|
| `/tickets/demo-ticket` | Estimated vs actual cost and quota status in the existing cost card. |
| `/runs/demo-run` | Billing ledger summary in the existing cost card. |
| `/approvals` | Budget/quota approval count rolls into the existing KPI band. |

## Verification

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run validate:demo-data` | pass |
| `npm run smoke:usage-ledger` | pass 9/9 |
| runtime smoke suite | pass |
| onboarding 01-07 | pass 7/7 |
| bbox 08/20/21/23/30/32/34/37 | pass |
| static asset audit | pass |

## Decision

PASS.
