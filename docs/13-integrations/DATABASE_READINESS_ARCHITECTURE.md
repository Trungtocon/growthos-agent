# Database Readiness Architecture

## Purpose

Sprint 9C adds a production database and persistence readiness layer without replacing the existing mock/session runtime. The layer prepares GrowthOS for real persistence by making database configuration, domain binding, audit logging, and go-live blockers explicit.

## Runtime Modules

| Module | Responsibility |
|---|---|
| `src/runtime/database-config.ts` | Defines mock, local, supabase, postgres, and production database configs without storing secrets. |
| `src/runtime/database-client-factory.ts` | Selects a mock/local/sandbox/staging/production database client by environment. Missing config returns degraded/blocked status instead of crashing. |
| `src/runtime/persistence-registry.ts` | Lists persistence domains required for production: runs, artifacts, approvals, governance decisions, workers, evaluations, feedback, recommendations, audit logs, usage, cost, and pre-go-live reports. |
| `src/runtime/audit-log-store.ts` | Stores runtime/database/auth/governance/backend audit events in sessionStorage for frontend evidence. |
| `src/runtime/database-readiness.ts` | Evaluates production database readiness and exports readiness evidence into Artifact Registry. |

## Readiness Rules

Production is `BLOCKED` when:

- production database config is missing;
- schema version is missing;
- migration status is missing;
- required persistence domains are not production-bound;
- audit log is not writable.

Local and sandbox modes return `WARNING` when falling back to mock/session persistence. They must never crash the UI or silently claim production readiness.

## UI Surface

`/database-readiness` shows:

- database mode;
- connection health;
- schema and migration status;
- persistence domain matrix;
- audit log status;
- blockers and warnings;
- readiness score;
- artifact exports.

Compact `DatabaseReadinessCompactWidget` surfaces the same state on production-adjacent routes without changing layout.

## Artifact Exports

The readiness engine registers:

- `database-readiness-report.md`
- `database-config.json`
- `persistence-domain-matrix.json`
- `audit-log-summary.md`
- `database-blockers.json`
- `database-go-live-evidence.md`

## Integration Points

Pre-Go-Live Validation includes a `Database Readiness` gate. Backend Readiness also reads the database readiness summary so backend health evidence reflects missing persistence.
