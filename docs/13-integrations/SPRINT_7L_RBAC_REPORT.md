# Sprint 7L — RBAC Enforcement Layer Report

## Goal

Add a complete Role-Based Access Control layer on top of organization governance, workspace governance, planning, policy, budget, usage ledger, and cost reconciliation.

## Files Added

- `src/runtime/rbac.ts`
- `src/runtime/rbac-store.ts`
- `scripts/smoke-rbac.mjs`
- `docs/13-integrations/RBAC_ARCHITECTURE.md`
- `docs/13-integrations/SPRINT_7L_RBAC_REPORT.md`

## Files Modified

- `src/integrations/growthos-runtime/runtime-orchestrator.ts`
- `src/state/command-actions.ts`
- `src/domain/selectors.ts`
- `src/pages/DemoScreens.tsx`
- `src/pages/Sprint2Screens.tsx`
- `src/data/screens.ts`
- `package.json`

## Roles

- OrganizationOwner
- OrganizationAdmin
- TenantAdmin
- WorkspaceAdmin
- Operator
- Reviewer
- Viewer

## Permission Model

The permission catalog includes organization, tenant, workspace, budget, policy, runtime, artifact, cost, analytics, and governance permissions.

## Enforcement Points

| Operation | Enforcement |
|---|---|
| approveRunPlan | `canApprovePlan()` |
| startRunFromPlan | `canStartRun()` |
| startAgentRun | `canStartRun()` |
| startStreamingRun | `canStartRun()` |
| cancelAgentRun | `canCancelRun()` |
| approval approve/reject | `canApprovePlan()` |
| artifact exports | `canExportArtifact()` |
| budget override decisions | `canOverrideBudget()` |
| policy edit decisions | `canModifyPolicy()` |
| deployment approval decisions | `canApproveDeployment()` |

## UI Wiring

- `/access` read-only dashboard shows role matrix, permission matrix, users, denied actions, and authorization events.
- `/tickets/demo-ticket` surfaces current RBAC role and denied action count.
- `/runs/demo-run` surfaces current RBAC role and denied action count.
- `/approvals` surfaces current RBAC role and denied action count.

## Artifacts

- `rbac-summary.md`
- `permission-matrix.md`
- `access-report.json`
- `authorization-history.json`

## Verification

| Check | Result |
|---|---|
| npm run build | pass |
| npm run validate:demo-data | pass |
| npm run audit:static-assets | pass |
| npm run smoke:rbac | pass 7/7 |
| Existing runtime smoke suite | pass |
| Onboarding 01-07 | pass |
| BBox 08/20/21/23/30/32/34/37 | pass |

## Decision

PASS
