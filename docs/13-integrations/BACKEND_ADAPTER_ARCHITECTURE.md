# Backend Adapter Architecture

Sprint 8X adds a production backend adapter and API gateway for GrowthOS runtime integration. The adapter keeps the frontend in mock mode by default and only enables sandbox or production requests through validated deployment state and readiness gates.

## Runtime Flow

UI actions remain selector/store driven:

```text
UI
-> command/store action
-> backend adapter store
-> backend API gateway
-> normalized backend result
-> session state + artifact registry
-> selectors
-> UI
```

React pages do not import Hermes or Paperclip clients directly. The `/backend-adapter` route only calls the backend adapter store.

## Modes

- `mock`: default mode. No real backend endpoint is called. Health is reported as `missing_config` or degraded fallback depending on the action.
- `sandbox`: endpoint tests can run through the gateway simulation using sandbox-safe configuration.
- `production`: guarded mode. Production calls are blocked unless deployment config, production readiness, runtime certification, certified sandbox run, and governance readiness are acceptable.

## Gateway Methods

The gateway exposes:

- `checkBackendHealth()`
- `validateBackendAuth()`
- `callRuntimeEndpoint()`
- `callHermesEndpoint()`
- `callPaperclipEndpoint()`
- `callArtifactEndpoint()`
- `callGovernanceEndpoint()`
- `callWorkerEndpoint()`

All methods return normalized GrowthOS backend results with status, duration, fallback state, and optional normalized error.

## Status Model

Supported backend statuses:

- `online`
- `degraded`
- `offline`
- `missing_config`
- `auth_failed`
- `blocked_by_governance`
- `blocked_by_deployment_config`
- `blocked_by_certification`

## Production Gate

Production mode is blocked when any of these conditions are true:

- Deployment Config is not ready for go-live.
- Production Readiness has blockers or no active check.
- Runtime Certification has not passed.
- Certified Sandbox Run has not completed.
- Governance readiness has blocked reasons.

Blocked requests do not call the gateway and instead write a normalized request log entry with a clear blocker reason.

## UI Surfaces

Full route:

- `/backend-adapter`

Compact widgets:

- `/deployment-config`
- `/production-readiness`
- `/runtime-certification`
- `/certified-sandbox-run`
- `/runs/demo-run`
- `/worker-control`
- `/chaos`
- `/evaluation`

## Artifact Exports

Backend adapter exports are registered through Artifact Registry:

- `backend-adapter-report.md`
- `backend-health.json`
- `backend-endpoint-matrix.json`
- `backend-error-report.md`
- `backend-auth-check.json`

