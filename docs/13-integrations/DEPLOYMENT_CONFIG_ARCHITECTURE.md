# Deployment Configuration Architecture

## Purpose

The Deployment Configuration Wizard prepares GrowthOS for a real production go-live after certified sandbox readiness. It validates runtime mode, environment groups, endpoint health, security checks, and production readiness dependencies. It does not deploy, does not call Hermes or Paperclip directly from UI, and does not bypass governance, runtime certification, approval, budget, quota, worker recovery, chaos, artifact registry, certified sandbox, or production readiness gates.

## Runtime Flow

```text
UI /deployment-config
-> deployment config actions
-> deployment-config-store
-> runtime certification selectors/store
-> production readiness selectors/store
-> artifact registry
-> selectors
-> UI
```

Production go-live approval remains guarded by `/production-readiness`. Sprint 8W adds the reverse dependency: production go-live approval cannot proceed unless Deployment Config is marked ready.

## Domain Files

- `src/runtime/deployment-config.ts`
- `src/runtime/deployment-config-store.ts`

Primary models:

- `DeploymentConfigCheck`
- `DeploymentEnvGroupCheck`
- `DeploymentEnvKeyCheck`
- `DeploymentEndpointHealth`
- `DeploymentReadiness`
- `DeploymentBlocker`
- `DeploymentWarning`
- `DeploymentConfigDashboard`

## Runtime Modes

Supported modes:

- `mock`
- `sandbox`
- `production`

Mock mode remains available for local development. Sandbox mode can pass sandbox readiness while warning that production configuration is still incomplete. Production mode requires explicit production environment values plus runtime certification and production readiness evidence.

## Environment Groups

The wizard groups environment keys into:

- `app`
- `hermes`
- `paperclip`
- `growthos_runtime`
- `auth`
- `storage`
- `logging`
- `billing`
- `notification`
- `deployment`

Required keys covered by the validation model:

- `APP_ENV`
- `APP_BASE_URL`
- `HERMES_RUNTIME_MODE`
- `HERMES_SANDBOX_BASE_URL`
- `HERMES_SANDBOX_API_KEY`
- `HERMES_SANDBOX_WORKSPACE_ID`
- `HERMES_PRODUCTION_BASE_URL`
- `HERMES_PRODUCTION_API_KEY`
- `PAPERCLIP_BASE_URL`
- `PAPERCLIP_API_KEY`
- `GROWTHOS_WORKSPACE_ID`
- `AUTH_SECRET`
- `STORAGE_DRIVER`
- `LOG_LEVEL`
- `BILLING_PROVIDER`
- `DEPLOYMENT_TARGET`

## Validation Status

Supported status values:

- `valid`
- `missing`
- `invalid`
- `warning`
- `blocked`
- `not_checked`

## Safety Rules

Production mode is blocked when:

- production endpoint is missing
- production API key is missing
- `APP_ENV` is not `production`
- runtime certification has not passed
- production readiness is not ready enough for go-live
- production endpoint health is offline

Sandbox mode can become sandbox-ready but not production-ready. Mock mode remains available and reports a warning when used during go-live preparation.

## Wizard UI

Route:

- `/deployment-config`

Wizard steps:

1. Runtime mode
2. Environment variables
3. Endpoint health
4. Security checks
5. Production readiness dependency
6. Final deployment checklist

Actions:

- Validate config
- Re-check endpoint health
- Export config report
- Mark config ready
- Block config
- Reset check

All visible buttons either execute a store action or expose a disabled reason.

## Compact Widgets

Deployment Config compact widgets are rendered on:

- `/production-readiness`
- `/runtime-certification`
- `/certified-sandbox-run`
- `/worker-control`
- `/chaos`
- `/evaluation`
- `/runs/demo-run`

## Artifact Exports

Exports are registered through Artifact Registry:

- `deployment-config.json`
- `deployment-config-report.md`
- `deployment-env-checklist.md`
- `deployment-blockers.json`
- `production-env-readiness.md`

## Production Readiness Integration

`approveProductionGoLive()` now checks the Deployment Config snapshot in sessionStorage. If the active deployment config is not marked ready with production readiness true, go-live approval remains `not_requested` and a production readiness blocker is added.

This keeps the dependency enforceable without importing Hermes/Paperclip clients or creating UI-level bypass paths.
