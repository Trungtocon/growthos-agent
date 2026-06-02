# API Contract Architecture

Sprint 8Y introduces a frontend API contract registry between GrowthOS UI actions and the backend adapter gateway. The layer standardizes endpoint metadata, schema expectations, readiness dependencies, and fallback behavior before any backend call is made.

## Contract Flow

```text
UI action
-> command-actions or API contracts page
-> production-api-client
-> api-contract-store
-> backend-api-gateway
-> normalized result
-> contract test result + selectors
-> UI
```

No UI page calls `fetch()` directly and no UI page imports Hermes or Paperclip clients.

## Contract Groups

- `runtime.run.start`
- `runtime.run.cancel`
- `runtime.run.approve`
- `runtime.run.reject`
- `artifact.export`
- `approval.submit`
- `governance.evaluate`
- `worker.start`
- `worker.stop`
- `worker.pause`
- `worker.resume`
- `certifiedSandbox.run`
- `productionReadiness.check`

Each contract includes method, path, required env, request schema, response schema, auth mode, runtime mode, readiness dependencies, fallback behavior, validation timestamp, and status.

## Modes

- `mock`: always available and returns normalized mock responses.
- `sandbox`: uses sandbox endpoint metadata when env exists; otherwise returns a visible fallback result.
- `production`: blocked unless Deployment Config, Production Readiness, Runtime Certification, Certified Sandbox Run, and Governance readiness gates are satisfied.

## Error Normalization

The production API client normalizes:

- `network_error`
- `auth_error`
- `contract_invalid`
- `backend_unavailable`
- `governance_blocked`
- `readiness_failed`
- `timeout`

## UI Surface

Full route:

- `/api-contracts`

Compact widgets:

- `/backend-adapter`
- `/production-readiness`
- `/deployment-config`
- `/certified-sandbox-run`
- `/runs/demo-run`

## Artifact Exports

- `api-contracts.json`
- `api-contract-status.md`
- `endpoint-readiness-report.md`
- `api-contract-test-results.json`

