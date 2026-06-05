# Production Access Control Architecture

## Purpose

The Production Access Control layer is the SaaS access gate for production operations. It resolves the active actor role, checks license entitlements, evaluates module permissions, records blocked actions, and exports audit evidence for production readiness.

## Route

- `/production-access-control`

## Runtime Files

- `src/runtime/production-access-control.ts`
- `src/runtime/production-access-control-store.ts`
- `src/pages/ProductionAccessControlPage.tsx`

## Role Model

Supported roles:

- owner
- admin
- manager
- operator
- reviewer
- finance
- support
- viewer

Supported permissions:

- view
- create
- edit
- approve
- reject
- export
- configure
- activate
- suspend
- rollback
- delete

## Module Matrix

The module matrix covers:

- Production Billing
- Tenant Production Binding
- Production Readiness
- Go-Live Control
- Production Operations
- Production Support
- Production Compliance
- Production Incidents
- Production Runbook
- Backend Readiness
- Database Readiness
- Auth Readiness
- Environment Readiness

Each module declares allowed roles, allowed permissions, and a plan entitlement requirement. Compliance controls are enterprise-only.

## License-Aware Access

The access layer reads the production billing store to determine plan entitlements and user quota. It:

- locks modules that are outside the current plan entitlement
- warns when user usage reaches 80 percent of the plan limit
- blocks user creation when the tenant exceeds quota
- locks enterprise-only compliance controls for lower plans

## Action Guard

`evaluateActionAccess()` is the shared guard for production actions. It checks:

- actor identity
- actor role
- requested permission
- target module
- license entitlement
- user status

The result includes `allowed`, `reason`, `requiredRole`, and `licenseBlocked`. Every decision writes an audit event.

Production integrations added in this sprint:

- Go-Live approval checks owner/admin/reviewer access.
- Billing configuration checks owner/admin/finance access.
- Incident rollback checks owner/admin/operator access.
- Compliance approval checks owner/admin/reviewer access.

## UI Surfaces

The access center displays:

- role matrix
- permission matrix
- module access matrix
- user quota state
- blocked action log
- audit event log
- export actions

Compact access widgets appear on production billing, tenant binding, go-live control, production operations, production support, production compliance, production incidents, production readiness, and production runbook routes.

## Artifact Exports

The access layer registers:

- `access-control-matrix.json`
- `role-permission-report.md`
- `blocked-actions.json`
- `user-quota-report.md`
- `access-audit-log.json`

## Safety Notes

- No raw secrets are rendered.
- Unauthorized actions show explicit blocked reasons.
- Buttons are wired to real store commands and do not silently no-op.
- UI does not import backend clients.
