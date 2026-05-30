# Hermes/Paperclip Sandbox Config

## Purpose

Sprint 6C adds optional sandbox connector support for Hermes Agent and Paperclip while preserving mock mode as the default runtime.

UI components must not import Hermes or Paperclip clients directly. The integration path remains:

```text
command-actions -> async-actions -> runtime-orchestrator -> adapters -> clients
```

## Environment

| Variable | Values | Required | Notes |
|---|---|---|---|
| `VITE_RUNTIME_MODE` | `mock`, `sandbox` | No | Defaults to `mock`. |
| `VITE_HERMES_BASE_URL` | URL | Sandbox only | Hermes sandbox base URL. |
| `VITE_HERMES_API_KEY` | string | Sandbox only | Sandbox key only. Vite exposes this to the browser. |
| `VITE_PAPERCLIP_BASE_URL` | URL | Sandbox only | Paperclip sandbox base URL. |
| `VITE_PAPERCLIP_API_KEY` | string | Sandbox only | Sandbox key only. Vite exposes this to the browser. |
| `VITE_RUNTIME_TIMEOUT_MS` | number | No | Defaults to `15000`. |

Do not use production secrets in these variables. They are browser-visible `VITE_` values and are intended only for local or sandbox connectors.

## Runtime Modes

### Mock

When `VITE_RUNTIME_MODE` is omitted or set to `mock`, the runtime uses local mock Hermes and Paperclip clients.

Expected health:

```text
mode: mock
hermes: online
paperclip: online
```

### Sandbox With Missing Config

When `VITE_RUNTIME_MODE=sandbox` but either service is missing its URL or key, the runtime falls back to mock mode and reports degraded health.

Expected health:

```text
mode: mock
hermes: degraded / missing config
paperclip: degraded / missing config
```

### Sandbox With Config

When both services have base URL and key values, the runtime calls each service health endpoint through the adapter clients.

Expected health:

```text
mode: sandbox
hermes: online/offline/degraded
paperclip: online/offline/degraded
```

## Client Methods

Hermes sandbox client:

- `healthCheck()`
- `createTask(payload)`
- `startRun(taskId)`
- `getRun(runId)`
- `cancelRun(runId)`

Paperclip sandbox client:

- `healthCheck()`
- `createArtifact(payload)`
- `getArtifact(artifactId)`
- `listArtifacts(runId)`

## Error Handling

Connector requests normalize failures into runtime errors:

- `RuntimeIntegrationError`
- `RuntimeTimeoutError`
- `RuntimeConfigError`

Unknown API responses are normalized into internal Hermes/Paperclip shapes before they reach the runtime orchestrator.

## Smoke Test

Run:

```bash
npm run smoke:sandbox-connectors
```

The smoke test verifies:

- mock mode works without env
- sandbox mode with missing env falls back safely
- sandbox health checks normalize service responses
- runtime integration smoke still passes
