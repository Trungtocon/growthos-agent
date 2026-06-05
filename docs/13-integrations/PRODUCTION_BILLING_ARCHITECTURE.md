# Production Billing, Subscription & License Gate

Sprint 9O adds a frontend production billing and license gate for commercial readiness. It keeps the current mock/sessionStorage runtime model and does not introduce real payment processing or secret handling.

## Route

- `/production-billing`

## Runtime Modules

- `src/runtime/production-billing.ts`
  - Domain contracts for plans, subscription lifecycle, license entitlements, usage snapshots, license gates, and billing dashboard summaries.
- `src/runtime/production-billing-store.ts`
  - SessionStorage-backed subscription state, plan entitlement registry, usage quota checks, license gate selectors, and billing artifact exports.
- `src/pages/ProductionBillingPage.tsx`
  - Real DOM control surface for subscription state, entitlement visibility, usage warnings/blockers, license checks, and billing exports.

## Subscription Lifecycle

Supported tenant subscription statuses:

- trial
- active
- past_due
- suspended
- cancelled
- expired

The license gate treats `trial` and `active` as valid for frontend readiness simulation, with trial producing a warning. All other states block production tenant activation and Go-Live.

## Plans

Supported plans:

- starter
- growth
- scale
- enterprise

Each plan defines module access, user/workspace/agent/run/storage/artifact quotas, support SLA level, and whether compliance features are enabled.

## Usage Gate

Usage is evaluated against licensed quotas:

- warning at 80 percent or greater
- blocked when usage exceeds quota

The usage gate is combined with the license gate for production activation and Go-Live readiness.

## Production Integrations

The billing gate is consumed by:

- Tenant production activation: invalid or over-quota license blocks activation.
- Go-Live control: invalid or over-quota license creates a Go-Live blocker.
- Production operations/support/compliance/readiness pages: compact billing widgets expose current license status, plan, SLA, and blockers.
- Production support page: shows visible SLA derived from the active plan.

## Artifact Exports

`exportBillingUsageReport()` registers:

- `billing-summary.md`
- `subscription-status.json`
- `license-entitlements.json`
- `usage-quota-report.md`
- `billing-blockers.json`

## Safety

No raw secrets, card details, payment tokens, or provider credentials are stored or displayed. This sprint models commercial readiness state only.
