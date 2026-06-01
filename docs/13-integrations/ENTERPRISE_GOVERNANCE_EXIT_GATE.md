# Enterprise Governance Exit Gate

## Purpose
The enterprise governance exit gate verifies that UIKIGAI AI Workforce OS can enforce runtime governance before a real Hermes/Paperclip runtime is enabled.

The gate is intentionally frontend-local in Sprint 7R. It does not create backend APIs and it does not bypass the existing path:

UI action -> command action -> runtime orchestrator -> governance decision -> governance enforcement -> runtime store -> selectors -> UI.

## Governed Stack
The exit gate checks these modules:

| Module | Readiness source |
|---|---|
| Policy Inheritance | Effective policies and inheritance report |
| Governance Decision Engine | Decision history and blocked decision summary |
| Governance Enforcement | Enforcement events, approval holds, rejected actions |
| Approval Execution | Pending, approved, resumed, rejected, and cancelled executions |
| RBAC | Roles, permissions, effective permissions |
| Authorization Audit | Recorded authorization events |
| Execution Budget | Runtime budget registry |
| Usage Ledger | Usage records and billing ledgers |
| Cost Reconciliation | Runtime/provider reconciliation records |
| Workspace Governance | Workspace health, quota, budget, roles |
| Organization Governance | Tenant health, budgets, quotas, workspace references |
| Runtime Integration | Mock fallback and sandbox readiness |
| Artifact Export | Governance readiness artifacts |

## Readiness Status
`src/runtime/governance-readiness.ts` defines three statuses:

| Status | Meaning |
|---|---|
| READY | Module has required evidence and can participate in runtime integration. |
| WARNING | Module is available but lacks enough session evidence or sandbox is not online. |
| BLOCKED | Module is missing required configuration/state and must be fixed before real runtime integration. |

The exit gate can proceed to sandbox integration with warnings only when no module is blocked.

## Artifact Exports
`governanceReadinessArtifacts()` generates four artifacts:

- `enterprise-governance-exit-report.md`
- `governance-readiness.json`
- `governance-blockers.json`
- `governance-next-actions.md`

These artifacts are generated from the persisted readiness report and can be displayed by the existing artifact viewer.

## UI
The `/governance-readiness` route displays:

- Overall readiness status.
- Module checklist.
- Blocked reasons.
- Warnings.
- Governance stack map.
- Recommended next action.

Compact readiness cards are surfaced in:

- `/governance`
- `/enforcement`
- `/workspace`
- `/organization`
- `/runs/demo-run`

## Smoke Gate
`npm run smoke:enterprise-governance-exit` validates:

- Allowed execution.
- RBAC denial.
- Policy, budget, and quota blocks.
- Approval hold, approve/resume, reject/cancel.
- Authorization audit.
- Enforcement events.
- Usage ledger and cost reconciliation.
- Workspace and organization governance summaries.
- Artifact export.
- `/governance-readiness` route rendering.
