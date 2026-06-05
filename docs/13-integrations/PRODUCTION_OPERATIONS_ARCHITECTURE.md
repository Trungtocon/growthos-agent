# Production Operations Console Architecture

Sprint 9L adds `/production-operations`, a live-ops control surface that aggregates production readiness, incident, support, backend, database, auth, environment, observability, runbook, rollback, and Go-Live state.

## Data Flow

```
Readiness Stores
  -> production-operations-store
  -> operations snapshot + action queue
  -> selectors / compact widgets
  -> /production-operations UI
  -> Artifact Registry exports
```

The console does not mark Go-Live, trigger rollback, or bypass blockers. Operator actions create queue state and evidence only.

## Dashboard Signals

- Go-Live status
- Production readiness
- Backend health
- Database readiness
- Auth readiness
- Environment readiness
- Deployment status
- Observability status
- Incident command status
- Support SLA status

## Operator Queue

The action queue is generated from unresolved blockers and warnings:

- active production incidents
- breached support SLA tickets
- missing evidence
- runbook handoff gaps
- rollback readiness gaps
- Go-Live blockers

Operators can acknowledge, assign, escalate, resolve, request rollback review, request Go-Live review, refresh snapshots, and export the operations pack.

## Artifact Exports

- `production-operations-snapshot.json`
- `production-operations-report.md`
- `production-action-queue.json`
- `production-escalation-summary.md`
- `rollback-readiness-review.md`
- `go-live-ops-handoff.md`
