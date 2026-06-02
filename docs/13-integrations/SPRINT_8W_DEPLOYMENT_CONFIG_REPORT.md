# Sprint 8W Deployment Config Report

## Summary

Sprint 8W added the Environment & Deployment Configuration Wizard at `/deployment-config`. It validates mock/sandbox/production runtime mode, required environment groups, endpoint health, security checks, production readiness dependencies, and final deployment checklist status.

Result: `PASS`.

## Files Created

- `src/runtime/deployment-config.ts`
- `src/runtime/deployment-config-store.ts`
- `src/pages/DeploymentConfigPage.tsx`
- `scripts/smoke-deployment-config.mjs`
- `docs/13-integrations/DEPLOYMENT_CONFIG_ARCHITECTURE.md`
- `docs/13-integrations/SPRINT_8W_DEPLOYMENT_CONFIG_REPORT.md`

## Files Modified

- `package.json`
- `src/App.tsx`
- `src/domain/selectors.ts`
- `src/runtime/production-readiness-store.ts`
- `src/pages/ProductionReadinessPage.tsx`
- `src/pages/RuntimeCertificationPage.tsx`
- `src/pages/CertifiedSandboxRunPage.tsx`
- `src/pages/WorkerControlPage.tsx`
- `src/pages/ChaosSimulationPage.tsx`
- `src/pages/EvaluationPage.tsx`
- `src/pages/DemoScreens.tsx`
- `scripts/smoke-production-readiness.mjs`
- `scripts/smoke-ui-action-wiring.mjs`

## Behavior Added

- `/deployment-config` renders a real six-step wizard.
- Runtime modes support `mock`, `sandbox`, and `production`.
- Missing production endpoint, API key, and non-production `APP_ENV` create blockers.
- Sandbox env can pass sandbox readiness while warning that production env is missing.
- Production mode requires runtime certification and production readiness evidence.
- Production go-live approval now requires Deployment Config to be ready.
- Exports are registered through Artifact Registry.
- Compact deployment widgets render on production readiness, runtime certification, certified sandbox run, worker control, chaos, evaluation, and run console surfaces.

## Smoke Result

`npm run smoke:deployment-config` passed `9/9`.

Key checks:

- route renders wizard with six steps
- missing production env creates blockers
- sandbox env can pass sandbox readiness but not production readiness
- production readiness dependency blocks go-live until available
- valid production evidence can mark config ready
- endpoint health/reset actions change state
- exports register five deployment artifacts
- selectors and compact widgets resolve state
- route buttons are wired or disabled with reason

## Verification

| Check | Result |
|---|---|
| `npm run build` | PASS |
| `npm run validate:demo-data` | PASS |
| `npm run audit:static-assets` | PASS |
| `npm run smoke:deployment-config` | PASS 9/9 |
| `npm run smoke:production-readiness` | PASS 10/10 |
| `npm run smoke:runtime-certification` | PASS 16/16 |
| `npm run smoke:certified-sandbox-run` | PASS 18/18 |
| `npm run smoke:ui-action-wiring` | PASS 12/12 |
| `npm run smoke:real-ui-flow` | PASS 48/48 |
| `npm run smoke:interactions` | PASS 7/7 |
| `npm run smoke:workflow-actions` | PASS 5/5 |
| `npm run audit:bbox:35` | PASS 8/8 |
| Core bbox 08/20/21/23/30/32/34/37 | PASS |
| Onboarding parity 01-07 at 1% | PASS 7/7 |

## GitNexus

Pre-edit impact checks were LOW for existing page route/widget symbols. Sprint 8W touches `App`, shared selectors, runtime stores, and several integration widget surfaces, so staged GitNexus change detection is expected to report elevated risk before commit.

## Notes

Generated evidence under `parity-reports/` is intentionally not committed. Existing unrelated dirty files remain outside this sprint checkpoint.
