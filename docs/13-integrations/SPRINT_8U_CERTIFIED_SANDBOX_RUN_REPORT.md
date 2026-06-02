# Sprint 8U Certified Sandbox Run Report

## Summary

Sprint 8U adds a certified sandbox end-to-end execution layer. A Hermes/Paperclip-style workflow can run only after certification preflight validates runtime certification, production endpoint safety, governance blockers, sandbox health, and approval requirements.

## Files Created

- `src/runtime/certified-sandbox-run.ts`
- `src/runtime/certified-sandbox-run-store.ts`
- `src/pages/CertifiedSandboxRunPage.tsx`
- `scripts/smoke-certified-sandbox-run.mjs`
- `docs/13-integrations/CERTIFIED_SANDBOX_RUN_ARCHITECTURE.md`
- `docs/13-integrations/SPRINT_8U_CERTIFIED_SANDBOX_RUN_REPORT.md`

## Files Modified

- `src/App.tsx`
- `src/domain/selectors.ts`
- `src/pages/RuntimeCertificationPage.tsx`
- `src/pages/DemoScreens.tsx`
- `src/pages/ExecutionTimelinePage.tsx`
- `src/pages/ExecutionGraphPage.tsx`
- `src/pages/Sprint2Screens.tsx`
- `src/pages/EvaluationPage.tsx`
- `src/pages/WorkerControlPage.tsx`
- `src/pages/ChaosSimulationPage.tsx`
- `package.json`

## APIs Added

- `createCertifiedSandboxRun`
- `evaluateCertifiedSandboxPreflight`
- `startCertifiedSandboxRun`
- `approveCertifiedSandboxRun`
- `rejectCertifiedSandboxRun`
- `completeCertifiedSandboxRun`
- `failCertifiedSandboxRun`
- `exportCertifiedSandboxRunArtifacts`

## Selectors Added

- `selectCertifiedSandboxRunDashboard`
- `selectCertifiedSandboxRuns`
- `selectActiveCertifiedSandboxRun`
- `selectCertifiedSandboxPreflight`
- `selectCertifiedSandboxBlockers`
- `selectCertifiedSandboxArtifacts`
- `selectCertifiedSandboxAuditTrail`
- `selectCertifiedSandboxReadinessStatus`

## Preflight Result

Covered in smoke:

- Missing certification blocks execution.
- Production-looking endpoint blocks execution.
- Missing sandbox env with mock fallback becomes warning.
- Certification warnings require approval.
- Valid certification and online sandbox pass preflight.

## Smoke Result

`npm run smoke:certified-sandbox-run`

- Passed: 18
- Failed: 0

## Verification

Passed:

- `npm run build`
- `npm run validate:demo-data`
- `npm run audit:static-assets`
- `npm run smoke:runtime-certification`
- `npm run smoke:certified-sandbox-run`
- `npm run smoke:chaos-simulation`
- `npm run smoke:worker-recovery`
- `npm run smoke:worker-observability`
- `npm run smoke:improvement-loop-worker`
- `npm run smoke:improvement-loop-queue`
- `npm run smoke:improvement-loop-governance`
- `npm run smoke:improvement-loop`
- `npm run smoke:recommendation-execution`
- `npm run smoke:learning-memory`
- `npm run smoke:improvement-outcome`
- `npm run smoke:action-plan-execution`
- `npm run smoke:run-evaluation`
- `npm run smoke:real-ui-flow`
- `npm run smoke:interactions`
- `npm run smoke:workflow-actions`
- `npm run audit:bbox:35`
- Core bbox `08/20/21/23/30/32/34/37`
- Onboarding parity `01-07` under `STRICT_MAX_DIFF_PERCENT=1.0`

## Notes

The implementation intentionally treats persisted runtime certification `warning` as approval-required rather than blocked, because Sprint 8T certification can return mock-safe warnings for missing sandbox config while preserving fallback mode.
