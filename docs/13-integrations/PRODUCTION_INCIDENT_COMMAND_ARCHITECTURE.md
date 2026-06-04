# Production Incident Command Architecture

Sprint 9J adds a selector-driven incident command layer for post-go-live operations. It does not mark production GO automatically and does not bypass existing readiness, governance, runbook, or approval gates.

## Runtime Modules

- `src/runtime/production-incident.ts` defines incident severity, status, rollback decision, timeline event, readiness, blocker, and warning contracts.
- `src/runtime/production-incident-store.ts` persists incident command state in `sessionStorage` and registers incident artifacts through the Artifact Registry.
- `src/pages/ProductionIncidentPage.tsx` renders the `/production-incidents` command center and compact incident widgets.

## Incident Workflow

1. Detect or create incident.
2. Acknowledge and assign owner/commander.
3. Escalate if severity or impact requires it.
4. Add timeline evidence and mitigation steps.
5. Request and trigger rollback when required.
6. Resolve only with mitigation evidence.
7. Close only after explicit postmortem decision.
8. Export incident artifact pack for audit.

## Gate Integration

Go-Live Control reads `selectIncidentCommandReadiness()`.

- Active `SEV0` or `SEV1` incidents create production blockers.
- `rollback_required` incidents create production blockers.
- Missing incident owner or commander blocks incident command readiness.
- Non-critical unresolved incidents create warnings.

Production Readiness also consumes incident command readiness through the governance exit gate so unresolved incident risk is visible before go-live approval.

## Artifact Exports

- `production-incident-report.md`
- `production-incident-timeline.json`
- `incident-command-summary.md`
- `rollback-decision-record.md`
- `incident-postmortem-template.md`
- `incident-escalation-log.json`
- `incident-resolution-evidence.md`

## Operator Safety

All UI buttons have real handlers or disabled reasons. Production incident command can block release decisions, but it does not automatically approve or release production.
