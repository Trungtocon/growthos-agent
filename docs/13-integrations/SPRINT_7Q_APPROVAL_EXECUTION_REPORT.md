# Sprint 7Q - Approval Execution Workflow Report

## Goal

Complete the reviewer approval workflow that sits after governance enforcement:

Governance hold -> reviewer decision -> approve or reject -> resume or cancel runtime -> audit events -> artifact export.

## Scope

- No backend APIs were added.
- No AppShell or bbox contracts were changed.
- React components still read through selectors and runtime stores.
- Runtime execution remains routed through governance decision, governance enforcement, approval execution, and runtime orchestrator.

## Files Added

- `src/runtime/approval-execution.ts`
- `src/runtime/approval-execution-store.ts`
- `scripts/smoke-approval-execution.mjs`
- `docs/13-integrations/APPROVAL_EXECUTION_ARCHITECTURE.md`
- `docs/13-integrations/SPRINT_7Q_APPROVAL_EXECUTION_REPORT.md`

## Files Changed

- `src/integrations/growthos-runtime/runtime-orchestrator.ts`
- `src/domain/selectors.ts`
- `src/state/command-actions.ts`
- `src/state/event-log.ts`
- `src/pages/DemoScreens.tsx`
- `src/pages/Sprint2Screens.tsx`
- `package.json`

## Workflow Implemented

| Step | Behavior |
|---|---|
| Approval request creation | Only governance enforcement `approvalHold` records can create approval execution requests. |
| Approve | Reviewer approval records a decision and enables resume. |
| Reject | Reviewer rejection records a decision and enables cancellation. |
| Request changes | Keeps the request in `PENDING_REVIEW` and appends a timeline event. |
| Escalate | Keeps the request pending, raises priority to `high`, and appends escalation evidence. |
| Resume | Only approved requests can resume the original runtime target. |
| Cancel | Only rejected requests can cancel the original runtime target. |
| Runtime guard | Rejected, cancelled, or expired approval executions block subsequent runtime start attempts for the target. |

## Store Coverage

| Store bucket | Status |
|---|---|
| `approvalRequests` | implemented |
| `approvalDecisions` | implemented |
| `approvalEvents` | implemented |
| `resumedExecutions` | implemented |
| `cancelledExecutions` | implemented |

## Selectors Added

- `selectApprovalExecutionRequests`
- `selectPendingApprovalExecutions`
- `selectApprovedExecutions`
- `selectRejectedApprovalExecutions`
- `selectApprovalExecutionTimeline`
- `selectApprovalExecutionSummary`
- `selectApprovalExecutionByRun`
- `selectApprovalExecutionByActor`
- `selectEscalatedApprovals`
- `selectApprovalExecutionViewModel`

## UI Wiring

| Route | Wiring |
|---|---|
| `/approvals` | Pending execution holds, reviewer actions, escalation/request-changes actions, execution timeline context. |
| `/enforcement` | Approval execution summary widget. |
| `/governance` | Approval execution pending/resumed summary. |
| `/runs/demo-run` | Compact execution pending indicator in the run risk inspector. |
| `/tickets/demo-ticket` | Compact execution pending indicator in ticket authorization panel. |
| `/access` | Approval execution pending count in governance status. |
| `/policies` | Approval execution summary widget. |

## Artifacts

The approval execution export produces:

- `approval-execution-report.md`
- `approval-decisions.json`
- `approval-timeline.md`
- `rejected-executions.json`
- `resumed-executions.json`

## Smoke Result

| Check | Result |
|---|---|
| Approval hold creates request | pass |
| Approve resumes execution | pass |
| Reject cancels execution | pass |
| Request changes keeps hold | pass |
| Escalation raises review priority | pass |
| Direct resume without approval blocked | pass |
| Rejected execution cannot run | pass |
| Artifact export generated | pass |
| Selectors expose summary and timeline | pass |
| Route widgets render | pass |

## Decision

PASS.

## Verification

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run validate:demo-data` | pass |
| `npm run audit:static-assets` | pass |
| `npm run smoke:governance-decision` | pass |
| `npm run smoke:governance-enforcement` | pass |
| `npm run smoke:approval-execution` | pass, 10/10 |
| Full runtime smoke suite | pass |
| Onboarding parity 01-07 | pass |
| BBox 08/20/21/23/30/32/34/37 | pass |

## Notes

- `WorkspaceAdmin` intentionally cannot approve budget overrides because it lacks `budget.edit`; the approval execution smoke uses `OrganizationAdmin` to exercise the intended `REQUIRE_APPROVAL` path instead of the RBAC block path.
- Generated parity and smoke evidence remains outside the Sprint 7Q source checkpoint.
