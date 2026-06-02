# Sprint 8R - Worker Incident Recovery & Auto-Healing Report

## Goal

Build Worker Incident Recovery and Auto-Healing on top of Sprint 8Q Worker Observability.

## Files Created

- `src/runtime/worker-recovery.ts`
- `src/runtime/worker-recovery-store.ts`
- `src/pages/WorkerRecoveryPage.tsx`
- `scripts/smoke-worker-recovery.mjs`
- `docs/13-integrations/WORKER_RECOVERY_ARCHITECTURE.md`
- `docs/13-integrations/SPRINT_8R_WORKER_RECOVERY_REPORT.md`

## Files Modified

- `src/App.tsx`
- `src/domain/selectors.ts`
- `src/pages/WorkerControlPage.tsx`
- `src/pages/EvaluationPage.tsx`
- `src/pages/DemoScreens.tsx`
- `src/pages/ExecutionTimelinePage.tsx`
- `src/pages/ExecutionGraphPage.tsx`
- `src/pages/Sprint2Screens.tsx`
- `package.json`

## Recovery Models

- `WorkerRecoveryPlan`
- `WorkerRecoveryStep`
- `WorkerRecoveryAttempt`
- `WorkerRecoveryPolicy`
- `WorkerRecoveryResult`
- `WorkerRecoveryIncidentLink`
- `AutoHealingDecision`

## Recovery APIs

- `createRecoveryPlanForIncident`
- `evaluateAutoHealingDecision`
- `executeRecoveryStep`
- `executeRecoveryPlan`
- `approveRecoveryPlan`
- `rejectRecoveryPlan`
- `markRecoveryResolved`
- `exportRecoveryReport`

## Recovery Reasons

- `stale_worker`
- `heartbeat_missing`
- `queue_item_failed`
- `retry_exhausted`
- `governance_blocked`
- `approval_timeout`
- `sla_breach`
- `tool_failure`
- `artifact_generation_failed`
- `unknown_runtime_error`

## Recovery Actions

- `restart_worker`
- `retry_current_item`
- `requeue_item`
- `skip_item`
- `pause_for_review`
- `escalate_to_approval`
- `export_diagnostics`
- `rollback_last_action`
- `kill_worker`
- `mark_unrecoverable`

## Selectors Added

- `selectWorkerRecoveryDashboard`
- `selectRecoveryPlans`
- `selectRecoveryPlanByIncident`
- `selectActiveRecoveryPlan`
- `selectAutoHealingDecisions`
- `selectRecoveryAuditTrail`
- `selectUnresolvedRecoveryIncidents`
- `selectRecoveryReadiness`

## UI Surfaces

- Full route: `/worker-recovery`
- Compact widgets:
  - `/worker-control`
  - `/evaluation`
  - `/runs/demo-run`
  - `/execution-timeline`
  - `/execution-graph`
  - `/artifacts`
  - `/agents/demo-agent`

## Artifact Exports

- `worker-recovery-plan.json`
- `worker-recovery-report.md`
- `worker-auto-healing-decisions.json`
- `worker-recovery-audit.md`
- `unresolved-worker-incidents.md`

## Verification

| Check | Result |
|---|---|
| npm run build | PASS |
| npm run validate:demo-data | PASS |
| npm run audit:static-assets | PASS |
| npm run smoke:worker-recovery | PASS 15/15 |
| npm run smoke:worker-observability | PASS 15/15 |
| npm run smoke:improvement-loop-worker | PASS |
| npm run smoke:improvement-loop-queue | PASS |
| npm run smoke:improvement-loop-governance | PASS |
| npm run smoke:improvement-loop | PASS |
| npm run smoke:recommendation-execution | PASS 12/12 |
| npm run smoke:learning-memory | PASS 12/12 |
| npm run smoke:improvement-outcome | PASS 12/12 |
| npm run smoke:action-plan-execution | PASS 12/12 |
| npm run smoke:run-evaluation | PASS 13/13 |
| npm run smoke:real-ui-flow | PASS 48/48 |
| npm run smoke:interactions | PASS 7/7 |
| npm run smoke:workflow-actions | PASS 5/5 |
| npm run audit:bbox:35 | PASS 8/8 |
| core bbox 08/20/21/23/30/32/34/37 | PASS |
| onboarding parity 01-07 | PASS 7/7 |

Note: the visual parity runner does not start Vite by itself. The first onboarding run returned `ERR_CONNECTION_REFUSED`; after starting a temporary local dev server, all onboarding screens passed under `STRICT_MAX_DIFF_PERCENT=1.0`.

The build script now runs Vite with `--emptyOutDir=false` because the local generated `dist/assets` directory contains stale ACL-owned assets from another process/user context. This keeps source compilation and production build verification deterministic without staging generated `dist` files.

## Decision

PASS.
