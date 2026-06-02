# Sprint 8V Production Readiness Report

## Summary

Sprint 8V added the Production Go-Live Readiness Gate. The gate aggregates certified sandbox, runtime certification, governance, approval, chaos, recovery, cost, quota, artifact, execution, evaluation, learning, worker, and UI action evidence into a single go-live dashboard.

Result: `PASS`.

## Files Created

- `src/runtime/production-readiness.ts`
- `src/runtime/production-readiness-store.ts`
- `src/pages/ProductionReadinessPage.tsx`
- `scripts/smoke-production-readiness.mjs`
- `docs/13-integrations/PRODUCTION_READINESS_ARCHITECTURE.md`
- `docs/13-integrations/SPRINT_8V_PRODUCTION_READINESS_REPORT.md`

## Files Modified

- `src/App.tsx`
- `src/domain/selectors.ts`
- `src/pages/CertifiedSandboxRunPage.tsx`
- `src/pages/RuntimeCertificationPage.tsx`
- `src/pages/ChaosSimulationPage.tsx`
- `src/pages/WorkerRecoveryPage.tsx`
- `src/pages/EvaluationPage.tsx`
- `src/pages/DemoScreens.tsx`
- `scripts/smoke-ui-action-wiring.mjs`
- `package.json`

## Readiness Behavior

- Missing certified sandbox run blocks production readiness.
- Missing or blocked runtime certification blocks production readiness.
- Governance, approval, chaos, recovery, cost, quota, artifact registry, RBAC, and UI action blockers prevent `READY`.
- Missing production endpoint configuration is surfaced as a warning in frontend mock/sandbox mode.
- Approve and reject decisions persist in the readiness check.
- Exported readiness reports are registered through Artifact Registry.

## Status Categories

The gate evaluates 20 categories:

- certified sandbox run
- runtime certification
- governance exit gate
- approval execution
- artifact registry
- execution graph
- execution timeline
- replay control
- run evaluation
- feedback loop
- learning memory
- improvement loop
- worker observability
- worker recovery
- chaos simulation
- cost reconciliation
- usage ledger
- RBAC and authorization audit
- environment config
- UI action wiring

## Smoke Result

`npm run smoke:production-readiness` passed `10/10`.

Key assertions:

- route renders `/production-readiness`
- missing certified sandbox blocks readiness
- runtime certification blocker prevents `READY`
- all required categories are present
- approve/reject go-live decisions persist
- exports register artifact records
- selectors expose dashboard and compact widget data
- route buttons are not silently dead

## Verification

| Check | Result |
|---|---|
| `npm run build` | PASS |
| `npm run validate:demo-data` | PASS |
| `npm run audit:static-assets` | PASS |
| `npm run smoke:certified-sandbox-run` | PASS |
| `npm run smoke:runtime-certification` | PASS |
| `npm run smoke:chaos-simulation` | PASS |
| `npm run smoke:worker-recovery` | PASS |
| `npm run smoke:artifact-registry` | PASS |
| `npm run smoke:agent-execution-graph` | PASS |
| `npm run smoke:execution-timeline` | PASS |
| `npm run smoke:execution-replay-control` | PASS |
| `npm run smoke:run-evaluation` | PASS |
| `npm run smoke:production-readiness` | PASS |
| `npm run smoke:ui-action-wiring` | PASS |
| `npm run smoke:real-ui-flow` | PASS |
| `npm run smoke:interactions` | PASS |
| `npm run smoke:workflow-actions` | PASS |
| `npm run audit:bbox:35` | PASS 8/8 |
| Core bbox 08/20/21/23/30/32/34/37 | PASS |
| Onboarding parity 01-07 at 1% | PASS 7/7 |

## Notes

The first onboarding parity attempt failed because the dev server was not running and every page returned `ERR_CONNECTION_REFUSED`. After starting the local Vite server, onboarding parity passed with the expected locked diffs.

GitNexus impact analysis returned `CRITICAL` for shared selectors, which is expected because Sprint 8V adds selectors used by multiple integration pages. Existing selector semantics were preserved.
