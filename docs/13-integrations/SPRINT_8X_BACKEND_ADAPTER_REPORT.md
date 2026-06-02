# Sprint 8X Backend Adapter Report

## Summary

Sprint 8X implemented the Production Backend Adapter and API Gateway control layer. The app remains mock-first, supports sandbox endpoint testing, and blocks production backend calls unless readiness gates are satisfied.

## Files Created

- `src/runtime/backend-adapter.ts`
- `src/runtime/backend-adapter-store.ts`
- `src/runtime/backend-api-gateway.ts`
- `src/pages/BackendAdapterPage.tsx`
- `scripts/smoke-backend-adapter.mjs`
- `docs/13-integrations/BACKEND_ADAPTER_ARCHITECTURE.md`
- `docs/13-integrations/SPRINT_8X_BACKEND_ADAPTER_REPORT.md`

## Files Modified

- `package.json`
- `src/App.tsx`
- `src/domain/selectors.ts`
- `src/pages/CertifiedSandboxRunPage.tsx`
- `src/pages/ChaosSimulationPage.tsx`
- `src/pages/DemoScreens.tsx`
- `src/pages/DeploymentConfigPage.tsx`
- `src/pages/EvaluationPage.tsx`
- `src/pages/ProductionReadinessPage.tsx`
- `src/pages/RuntimeCertificationPage.tsx`
- `src/pages/WorkerControlPage.tsx`
- `scripts/smoke-ui-action-wiring.mjs`

## Route Added

- `/backend-adapter`

## Behaviors Implemented

- Mock mode remains default.
- Missing config blocks production backend calls without crashing.
- Sandbox mode can run health and endpoint checks.
- Production mode requires Deployment Config, Production Readiness, Runtime Certification, Certified Sandbox Run, and Governance gates.
- Auth failures and endpoint failures are normalized into readable UI state.
- Backend report artifacts are registered through Artifact Registry.
- Route buttons create visible state changes and are covered by smoke.

## Verification

| Command | Result |
|---|---|
| `npm run build` | PASS |
| `npm run validate:demo-data` | PASS |
| `npm run audit:static-assets` | PASS |
| `npm run smoke:backend-adapter` | PASS 10/10 |
| `npm run smoke:deployment-config` | PASS 9/9 |
| `npm run smoke:production-readiness` | PASS 10/10 |
| `npm run smoke:runtime-certification` | PASS 16/16 |
| `npm run smoke:certified-sandbox-run` | PASS 18/18 |
| `npm run smoke:ui-action-wiring` | PASS 12/12 |
| `npm run smoke:real-ui-flow` | PASS 48/48 |
| `npm run smoke:interactions` | PASS 7/7 |
| `npm run smoke:workflow-actions` | PASS 5/5 |
| `npm run audit:bbox:35` | PASS 8/8 |
| Core bbox `08/20/21/23/30/32/34/37` | PASS |
| Onboarding parity `01-07` with `STRICT_MAX_DIFF_PERCENT=1.0` | PASS 7/7 |

The first onboarding parity attempt failed because no Vite server was listening on port 5173. After starting the dev server, onboarding parity passed.

## Result

PASS. Sprint 8X is ready for checkpoint commit.

