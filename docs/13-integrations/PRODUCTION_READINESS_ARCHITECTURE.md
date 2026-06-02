# Production Go-Live Readiness Architecture

## Purpose

The Production Go-Live Readiness Gate is the final frontend-side decision layer before GrowthOS can be treated as production-ready. It does not deploy anything and does not bypass existing runtime governance. It aggregates certified sandbox results, runtime certification, governance, approval, recovery, chaos, artifact, timeline, evaluation, learning, worker, quota, and UI action evidence into one explicit go-live status.

## Required Flow

```text
UI
-> command-actions / runtime actions
-> governance decision
-> governance enforcement
-> approval execution if required
-> runtime-orchestrator
-> adapters / sandbox runtime
-> runtime-store
-> production readiness store
-> selectors
-> UI
```

React pages only read selector-driven dashboard models and call exported runtime-store actions. No UI code imports Hermes or Paperclip clients.

## Domain

Production readiness is implemented in:

- `src/runtime/production-readiness.ts`
- `src/runtime/production-readiness-store.ts`

The model includes:

- `ProductionReadinessCheck`
- `ProductionReadinessChecklistItem`
- `ProductionReadinessBlocker`
- `ProductionReadinessWarning`
- `ProductionReadinessDashboard`
- `ProductionReadinessArtifactExport`

Supported status values:

- `READY`
- `WARNING`
- `BLOCKED`
- `NEEDS_REVIEW`
- `NOT_CHECKED`

## Readiness Categories

The gate evaluates these required categories:

- `certified_sandbox_run`
- `runtime_certification`
- `governance_exit_gate`
- `approval_execution`
- `artifact_registry`
- `execution_graph`
- `execution_timeline`
- `replay_control`
- `run_evaluation`
- `feedback_loop`
- `learning_memory`
- `improvement_loop`
- `worker_observability`
- `worker_recovery`
- `chaos_simulation`
- `cost_reconciliation`
- `usage_ledger`
- `rbacs_and_authorization_audit`
- `environment_config`
- `ui_action_wiring`

## Blocker Rules

The gate cannot become `READY` when any blocking evidence exists. Current blocker codes:

- `missing_required_env`
- `sandbox_not_certified`
- `runtime_not_certified`
- `unresolved_governance_blocker`
- `unresolved_approval_hold`
- `failed_chaos_recovery`
- `failed_worker_recovery`
- `failed_artifact_registry`
- `failed_ui_action_wiring`
- `stale_dirty_production_files`
- `production_endpoint_not_configured`
- `cost_or_quota_policy_blocked`

Missing production endpoint configuration is treated as a warning in mock/sandbox frontend mode so local development does not crash. Certified sandbox and runtime certification are still hard requirements.

## Public APIs

The store exposes:

- `createProductionReadinessCheck`
- `evaluateProductionReadiness`
- `approveProductionGoLive`
- `rejectProductionGoLive`
- `exportProductionReadinessArtifacts`
- `getProductionReadinessDashboard`
- `getProductionReadinessChecklist`
- `getProductionReadinessBlockers`
- `getProductionReadinessWarnings`

Selectors in `src/domain/selectors.ts` expose the same dashboard data to pages and compact widgets.

## UI Surfaces

Full route:

- `/production-readiness`

Compact widgets:

- `/certified-sandbox-run`
- `/runtime-certification`
- `/chaos`
- `/worker-recovery`
- `/evaluation`
- `/runs/demo-run`

The page shows overall go-live status, blockers, warnings, checklist, certified sandbox evidence, runtime certification evidence, chaos/recovery summary, cost/quota summary, approval status, export actions, and approve/reject controls.

## Artifact Exports

Readiness exports are registered through Artifact Registry:

- `production-readiness-report.md`
- `production-readiness.json`
- `go-live-checklist.md`
- `go-live-blockers.json`
- `go-live-approval-summary.md`

## Limitations

This is a frontend readiness gate and does not create backend deployment APIs. Future production integration should replace local sessionStorage persistence with a backend audit store while keeping the selector and domain contracts stable.
