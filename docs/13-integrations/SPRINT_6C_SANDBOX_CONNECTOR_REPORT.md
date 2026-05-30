# Sprint 6C — Hermes/Paperclip Sandbox Connector Report

## Goal

Add real sandbox connector support for Hermes Agent and Paperclip through the existing adapter layer while preserving mock fallback mode and all current UI/runtime gates.

## Architecture

Runtime integration remains isolated behind the existing pipeline:

```text
command-actions -> async-actions -> runtime-orchestrator -> adapters -> clients
```

React components do not import Hermes/Paperclip clients directly.

## Files Added/Changed

| Area | Files |
|---|---|
| Hermes config/errors/client | `src/integrations/hermes/hermes-config.ts`, `src/integrations/hermes/hermes-errors.ts`, `src/integrations/hermes/hermes-client.ts`, `src/integrations/hermes/hermes-adapter.ts`, `src/integrations/hermes/hermes-mock.ts`, `src/integrations/hermes/hermes-types.ts` |
| Paperclip config/errors/client | `src/integrations/paperclip/paperclip-config.ts`, `src/integrations/paperclip/paperclip-errors.ts`, `src/integrations/paperclip/paperclip-client.ts`, `src/integrations/paperclip/paperclip-adapter.ts`, `src/integrations/paperclip/paperclip-mock.ts`, `src/integrations/paperclip/paperclip-types.ts` |
| Runtime health/config | `src/integrations/growthos-runtime/runtime-config.ts`, `src/integrations/growthos-runtime/runtime-health.ts`, `src/integrations/growthos-runtime/runtime-orchestrator.ts`, `src/integrations/growthos-runtime/runtime-types.ts` |
| Smoke | `scripts/smoke-sandbox-connectors.mjs`, `package.json` |
| Docs | `docs/13-integrations/HERMES_PAPERCLIP_SANDBOX_CONFIG.md`, `docs/13-integrations/SPRINT_6C_SANDBOX_CONNECTOR_REPORT.md` |

## Runtime Mode Behavior

| Scenario | Result |
|---|---|
| `VITE_RUNTIME_MODE=mock` or missing | Uses mock Hermes/Paperclip clients. |
| `VITE_RUNTIME_MODE=sandbox` with missing service config | Falls back to mock mode and reports degraded health. |
| `VITE_RUNTIME_MODE=sandbox` with service URLs and keys | Calls sandbox health endpoints through adapter clients. |

## Client Methods Added

Hermes:

- `healthCheck()`
- `createTask(payload)`
- `startRun(taskId)`
- `getRun(runId)`
- `cancelRun(runId)`

Paperclip:

- `healthCheck()`
- `createArtifact(payload)`
- `getArtifact(artifactId)`
- `listArtifacts(runId)`

## Normalization and Errors

Unknown sandbox responses are normalized into internal runtime types before use by the orchestrator. Request failures are wrapped as:

- `RuntimeIntegrationError`
- `RuntimeTimeoutError`
- `RuntimeConfigError`

Default request timeout is `15000ms` and can be adjusted with `VITE_RUNTIME_TIMEOUT_MS`.

## Verification

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run validate:demo-data` | pass |
| `npm run smoke:real-ui-flow` | pass, 48/48 |
| `npm run smoke:interactions` | pass, 7/7 |
| `npm run smoke:workflow-actions` | pass, 5/5 |
| `npm run smoke:runtime-integration` | pass, 4/4 |
| `npm run smoke:runtime-persistence` | pass, 4/4 |
| `npm run smoke:sandbox-connectors` | pass |
| `npm run audit:static-assets` | pass |
| onboarding 01-07 | pass, 7/7 |
| bbox 08/20/21/23/30/32/34/37 | pass |

## Decision

PASS. Sandbox connectors are available behind the adapter layer, mock fallback is preserved, and existing UI/runtime gates remain stable.
