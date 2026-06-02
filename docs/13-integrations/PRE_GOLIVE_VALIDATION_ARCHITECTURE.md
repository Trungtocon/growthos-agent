# Pre-Go-Live Validation Suite Architecture

## Purpose

The Pre-Go-Live Validation Suite is the final aggregation layer before production deployment. It does not bypass existing gates. Instead, it reads the current runtime/control-plane evidence and summarizes whether production can proceed.

## Route

`/pre-golive-validation`

The page provides:

- readiness score
- final go-live verdict
- gate matrix
- blockers
- warnings
- evidence
- production checklist
- go-live pack export

## Gate Categories

The suite aggregates:

- deployment configuration
- production readiness
- runtime certification
- certified sandbox run
- backend adapter
- API contracts
- E2E action flow
- UI action wiring
- real UI flow
- interactions
- workflow actions
- artifact registry
- governance, RBAC and approval
- worker control and recovery
- evaluation, feedback and improvement loop
- static assets
- BBox 35
- core bbox 08/20/21/23/30/32/34/37
- onboarding parity 01-07

## Verdict Logic

| Condition | Verdict |
|---|---|
| Any failed gate | `FAILED` |
| Any critical blocker | `BLOCKED` |
| All pass with warnings | `READY_WITH_WARNINGS` |
| All pass with no blockers or warnings | `READY` |

Current local/mock-safe environments are expected to remain `BLOCKED` until production deployment config, production readiness, runtime certification, and certified sandbox evidence are all present.

## Artifact Exports

The go-live pack registers:

- `pre-golive-validation-report.md`
- `pre-golive-validation.json`
- `production-blockers.json`
- `go-live-checklist.md`
- `go-live-final-verdict.md`

## UI Integration

Compact widgets are attached to:

- `/production-readiness`
- `/deployment-config`
- `/runtime-certification`
- `/certified-sandbox-run`
- `/backend-adapter`
- `/api-contracts`
- `/e2e-action-flow`
- `/runs/demo-run`

