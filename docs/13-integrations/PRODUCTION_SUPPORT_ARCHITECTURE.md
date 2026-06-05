# Production Support Desk Architecture

Sprint 9K adds a selector-driven production support layer that connects customer-impact tickets to production incidents, SLA readiness, Go-Live Control, and Production Readiness.

## Runtime Flow

UI actions on `/production-support` call `production-support-store`, which persists state in sessionStorage and exposes selectors through `src/domain/selectors.ts`.

```
Support Desk UI
  -> production-support-store
  -> Production Support selectors
  -> Go-Live Control / Production Readiness gates
  -> Artifact Registry exports
```

No UI component calls Hermes, Paperclip, backend adapters, or production endpoints directly.

## Ticket Lifecycle

Supported statuses:

- `new`
- `acknowledged`
- `investigating`
- `waiting_customer`
- `waiting_internal`
- `escalated`
- `resolved`
- `closed`

Closing a ticket requires a resolution summary. Escalated tickets require an escalation owner. Critical unresolved tickets block Go-Live.

## Readiness Rules

- Unresolved `SEV0`, `SEV1`, or critical-impact support tickets create Go-Live blockers.
- Breached SLA tickets create readiness warnings.
- High-impact unresolved tickets create warnings.
- Production incidents cannot close cleanly while linked critical support tickets remain unresolved.

## Artifact Exports

The support pack registers:

- `production-support-report.md`
- `support-ticket-log.json`
- `customer-impact-summary.md`
- `sla-breach-report.md`
- `support-escalation-log.json`
- `customer-communication-drafts.md`
- `support-resolution-evidence.md`
- `support-handoff-summary.md`

All exports are registered through Artifact Registry.
