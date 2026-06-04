# Sprint 9H Go-Live Control Report

## Summary

Sprint 9H introduces the Production Release Approval & Go-Live Control Center at `/go-live-control`. The implementation aggregates final production readiness gates, release approval, release window, rollback readiness, evidence checklist, blockers, warnings, timeline, and go-live pack artifacts.

## Files

Created:

- `src/runtime/go-live-control.ts`
- `src/runtime/go-live-control-store.ts`
- `src/pages/GoLiveControlPage.tsx`
- `scripts/smoke-go-live-control.mjs`
- `docs/13-integrations/GO_LIVE_CONTROL_ARCHITECTURE.md`
- `docs/13-integrations/SPRINT_9H_GO_LIVE_CONTROL_REPORT.md`

Modified:

- `src/App.tsx`
- `src/domain/selectors.ts`
- `package.json`
- readiness and production pages with compact go-live widgets

## Gate Matrix

The control layer reads:

- Production Readiness
- Deployment Config
- Runtime Certification
- Certified Sandbox Run
- Backend Readiness
- Database Readiness
- Auth Readiness
- Environment Readiness
- Production Config Evidence
- Production Observability
- Pre-Go-Live Validation

## Current Behavior

The default dashboard remains blocked until production evidence, release approver, release window, and rollback plan are present. A completed, verified readiness state can request approval, approve go-live, mark the release, and trigger rollback.

## Smoke Coverage

`npm run smoke:go-live-control` validates route registration, selector exposure, blocked/default verdicts, evidence completion, approval, release, rollback, artifact exports, button wiring, and secret redaction.

## Verification

Final verification results are recorded in the assistant sprint output after local commands complete.
