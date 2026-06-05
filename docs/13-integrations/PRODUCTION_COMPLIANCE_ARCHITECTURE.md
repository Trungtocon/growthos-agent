# Production Compliance & Audit Center

Sprint 9N adds a selector-driven compliance layer for production operations auditability. It does not replace governance, Go-Live, incident, runbook, or tenant binding stores. Instead, it records audit evidence when those systems complete regulated production actions.

## Route

- `/production-compliance`

## Runtime Modules

- `src/runtime/production-compliance.ts`
  - Domain types for audit records, change approvals, compliance controls, dashboard summaries, and evidence vault exports.
- `src/runtime/production-compliance-store.ts`
  - SessionStorage-backed compliance state, approval lifecycle commands, audit recording, selectors, and evidence artifact exports.
- `src/pages/ProductionCompliancePage.tsx`
  - Real DOM compliance center and compact widget used by production control pages.

## Audit Model

Every compliance audit record captures:

- actor
- timestamp
- action
- object
- beforeState
- afterState
- justification
- evidence
- mapped compliance controls

The compliance store intentionally stores state snapshots as JSON-compatible values so audit records can be exported without leaking raw secrets.

## Change Approval Lifecycle

The compliance approval lifecycle is:

`draft -> submitted -> reviewed -> approved/rejected -> implemented -> verified -> closed`

Each lifecycle command records an audit event so approval history is visible and exportable.

## Compliance Controls

The default control inventory covers:

- ISO27001
- SOC2
- GDPR
- PCI-DSS
- HIPAA
- InternalPolicy

Controls aggregate related audit event and approval counts for the dashboard.

## Production Integrations

The following production actions automatically create compliance audit records:

- Go-Live approval: `go-live.approved`
- Incident closure: `incident.closed`
- Runbook approval: `runbook.approved`
- Tenant activation: `tenant-binding.activated`

Integration remains one-way from the source stores into the compliance store. UI pages read through selectors and never call backend clients directly.

## Evidence Vault

`exportComplianceEvidenceVault()` registers these Artifact Registry records:

- `audit-report.md`
- `approval-record.md`
- `change-history.json`
- `evidence-log.json`
- `compliance-summary.md`

## UI Surfaces

Full center:

- `/production-compliance`

Compact widgets:

- `/production-readiness`
- `/go-live-control`
- `/production-operations`
- `/production-incidents`
- `/tenant-production-binding`

## Verification

Primary smoke command:

```bash
npm run smoke:production-compliance
```

Required sprint gates also cover build, demo data validation, static asset guardrail, real UI flow, interactions, workflow actions, and Screen 35 bbox.
