# Tenant Production Binding Architecture

Sprint 9M adds the tenant/workspace production binding layer for GrowthOS go-live administration.

## Purpose

The binding records which tenant and workspace are allowed to target production profiles. It is an administrative readiness gate, not a deployment trigger.

## Flow

1. Admin creates a tenant binding at `/tenant-production-binding`.
2. Admin attaches profile IDs for backend, database, auth, observability, support, and deployment.
3. Admin attaches verified masked evidence. Raw secrets are not stored in frontend state.
4. Owner and reviewer are assigned.
5. Reviewer approval is required.
6. Activation is allowed only when all readiness blockers are clear.
7. Pre-Go-Live and Go-Live Control read the active binding as a required gate.

## Safety Rules

- Production binding cannot activate without reviewer approval.
- Production binding cannot activate with readiness blockers.
- Backend, database, auth, environment evidence, production config evidence, observability, support owner, runbook handoff, rollback owner, and Go-Live non-bypass checks are required.
- The frontend stores profile IDs and masked metadata only.
- Go-Live Control can read binding status but cannot auto-approve it.

## Stores And Selectors

Runtime store:

- `src/runtime/tenant-production-binding-store.ts`

Stable selectors:

- `selectTenantProductionBindings`
- `selectActiveTenantProductionBinding`
- `selectTenantBindingReadiness`
- `selectTenantBindingBlockers`
- `selectTenantBindingWarnings`
- `selectTenantBindingReviewState`
- `selectTenantBindingArtifacts`
- `selectTenantBindingCompactSummary`

## Artifact Exports

The binding pack registers:

- `tenant-production-binding.json`
- `tenant-production-binding-report.md`
- `tenant-binding-readiness.md`
- `tenant-binding-blockers.json`
- `tenant-binding-approval-record.md`
- `tenant-go-live-binding-pack.md`

## Gate Integration

Pre-Go-Live includes gate `tenant-production-binding`.

Go-Live Control includes gate `tenant-production-binding`.

Both gates block when no active approved production binding exists.
