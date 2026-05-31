# Sprint 7M — Authorization Audit & Governance Observability Report

## Goal

Make RBAC authorization decisions traceable, reviewable, exportable, and visible without adding a backend auth provider or changing UI layout architecture.

## Files Added

- `src/runtime/authorization-audit.ts`
- `src/runtime/authorization-audit-store.ts`
- `scripts/smoke-authorization-audit.mjs`
- `docs/13-integrations/AUTHORIZATION_AUDIT_ARCHITECTURE.md`
- `docs/13-integrations/SPRINT_7M_AUTHORIZATION_AUDIT_REPORT.md`

## Files Changed

- `src/runtime/rbac-store.ts`
- `src/integrations/growthos-runtime/runtime-orchestrator.ts`
- `src/domain/selectors.ts`
- `src/pages/Sprint2Screens.tsx`
- `src/pages/DemoScreens.tsx`
- `package.json`

## Architecture Summary

RBAC remains the source of truth for authorization decisions. The audit layer records each `AuthorizationDecision` from `rbac-store`, derives risk, creates review items, and exposes read-only selectors for UI and smoke automation.

## Risk Rules

| Rule | Risk |
|---|---|
| Denied budget override | HIGH |
| Denied deployment approval | CRITICAL |
| Denied policy edit | HIGH |
| Repeated denied action >= 3 times | HIGH |
| Organization edit denied | CRITICAL |

## Selectors

- `selectAuthorizationAuditEvents`
- `selectDeniedActionSummary`
- `selectAuthorizationRiskSummary`
- `selectHighRiskAuthorizationEvents`
- `selectAuthorizationReviewQueue`
- `selectAuthorizationAuditByWorkspace`
- `selectAuthorizationAuditByTenant`
- `selectAuthorizationAuditByActor`

## UI Wiring

| Route | Audit Surface |
|---|---|
| `/access` | Full authorization observability dashboard |
| `/runs/demo-run` | Compact audit/high-risk/denied summary |
| `/tickets/demo-ticket` | Compact audit/high-risk/denied summary |
| `/approvals` | Compact audit/high-risk runtime summary |

## Artifact Exports

- `authorization-audit-summary.md`
- `authorization-risk-report.md`
- `authorization-events.json`
- `denied-actions-report.md`

## Verification

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run validate:demo-data` | pass |
| `npm run audit:static-assets` | pass |
| `npm run smoke:rbac` | pass 7/7 |
| `npm run smoke:authorization-audit` | pass 7/7 |
| Full runtime smoke suite | pass |
| Onboarding parity 01-07 | pass 7/7 |
| BBox core 08/20/21/23/30/32/34/37 | pass |

## Decision

PASS.
