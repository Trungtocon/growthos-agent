# End-to-End Production Action Flow Architecture

## Purpose

Sprint 8Z adds an auditable action-flow layer that proves representative UI actions travel through the API contract registry and production API client before state, artifact, and audit outputs are exposed to the UI.

The implementation remains mock-safe by default. Sandbox requests fall back with warnings when configuration is incomplete. Production requests stay blocked until readiness gates allow them.

## Runtime Path

```text
UI action
  -> E2E action-flow store
  -> production-api-client
  -> API contract registry
  -> backend API gateway
  -> normalized response
  -> action-flow audit timeline
  -> artifact registry exports
  -> selector-driven UI
```

The page layer never calls `fetch`, Hermes, or Paperclip directly.

## Flow Registry

| Flow | Contract sequence |
|---|---|
| Start Run Flow | `runtime.run.start` |
| Approval Required Flow | `runtime.run.start -> approval.submit` |
| Approve And Resume Flow | `approval.submit -> runtime.run.approve -> runtime.run.start` |
| Reject And Cancel Flow | `approval.submit -> runtime.run.reject -> runtime.run.cancel` |
| Worker Start/Pause/Resume/Stop Flow | `worker.start -> worker.pause -> worker.resume -> worker.stop` |
| Artifact Export Flow | `artifact.export` |
| Governance Blocked Flow | `governance.evaluate -> runtime.run.start` |
| Production Readiness Check Flow | `productionReadiness.check` |
| Certified Sandbox Run Flow | `certifiedSandbox.run` |

## State Model

Each flow records:

- current step and final status
- backend mode
- contract sequence
- request and response logs
- normalized errors
- readiness gates
- blocker and warning messages
- artifact outputs
- audit timeline
- final verdict

State persists in session storage under `uikigai-e2e-action-flow-v1`.

## Artifact Exports

The action-flow layer registers:

- `e2e-action-flow-report.md`
- `e2e-action-flow-results.json`
- `production-action-audit.md`
- `contract-execution-trace.json`
- `go-live-action-readiness.md`

## UI Surfaces

The full dashboard is available at `/e2e-action-flow`.

Compact widgets are added to:

- `/api-contracts`
- `/backend-adapter`
- `/production-readiness`
- `/deployment-config`
- `/certified-sandbox-run`
- `/runs/demo-run`
- `/worker-control`
- `/artifacts`

