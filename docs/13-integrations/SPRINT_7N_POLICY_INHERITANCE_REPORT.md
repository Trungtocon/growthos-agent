# Sprint 7N — Policy Inheritance Engine Report

## Goal

Implement policy inheritance across organization, tenant, workspace, and runtime execution scopes with override rules, locked parent behavior, conflict detection, effective policy resolution, selectors, UI, artifacts, and smoke coverage.

## Files Added

- `src/runtime/policy-inheritance.ts`
- `src/runtime/policy-inheritance-store.ts`
- `scripts/smoke-policy-inheritance.mjs`
- `docs/13-integrations/POLICY_INHERITANCE_ARCHITECTURE.md`
- `docs/13-integrations/SPRINT_7N_POLICY_INHERITANCE_REPORT.md`

## Files Changed

- `src/integrations/growthos-runtime/plan-policy.ts`
- `src/integrations/growthos-runtime/execution-budget.ts`
- `src/integrations/growthos-runtime/runtime-orchestrator.ts`
- `src/runtime-store/usage-ledger-store.ts`
- `src/runtime/rbac-store.ts`
- `src/domain/selectors.ts`
- `src/pages/Sprint2Screens.tsx`
- `src/pages/DemoScreens.tsx`
- `src/data/screens.ts`
- `package.json`

## Policy Rules Implemented

| Rule | Status |
|---|---|
| Organization policy is root default | implemented |
| Tenant can override organization unless locked | implemented |
| Workspace can override tenant unless locked | implemented |
| Runtime can override workspace only if `runtimeOverride=true` | implemented |
| Locked parent blocks child override | implemented |
| Conflicts generate `PolicyConflict` | implemented |
| Effective policy includes source trace | implemented |

## Engine Integration

| Engine | Integration |
|---|---|
| Plan Policy | Uses effective `approval.artifactRequiresApproval` |
| Execution Budget | Caps budget with effective `budget.maxCost` |
| Usage Quota | Caps run tool call quota with effective `quota.maxToolCalls` |
| RBAC | Honors effective `rbac.auditRequired` |
| Authorization Audit | Receives decisions when RBAC audit policy is active |
| Runtime Orchestrator | Exports policy inheritance artifacts |

## UI

| Route | Surface |
|---|---|
| `/policies` | Full policy inheritance dashboard |
| `/organization` | Compact policy summary through view model |
| `/workspace` | Compact policy summary through view model |
| `/tickets/demo-ticket` | Compact policy conflict count |
| `/runs/demo-run` | Compact policy conflict count |
| `/approvals` | Compact policy conflict count |
| `/access` | Policy inheritance summary in access view model |

## Artifacts

- `policy-inheritance-summary.md`
- `effective-policy-report.md`
- `policy-conflicts.json`
- `policy-trace-report.md`

## Verification

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run validate:demo-data` | pass |
| `npm run audit:static-assets` | pass |
| `npm run smoke:policy-inheritance` | pass 8/8 |
| `npm run smoke:rbac` | pass 7/7 |
| `npm run smoke:authorization-audit` | pass 7/7 |
| Full runtime smoke suite | pass |
| Onboarding parity 01-07 | pass 7/7 |
| BBox core 08/20/21/23/30/32/34/37 | pass |

## Decision

PASS.
