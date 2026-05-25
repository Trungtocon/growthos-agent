# Sprint 5J — Governance Support Real UI Report

## Goal

Convert governance and audit support routes from scaffold placeholders into Real UI screens with AppShell, selector-driven data, data-parity regions, and structural bbox gates.

## Scope

| Screen | Route | Component |
|---|---|---|
| 38 | `/approvals/demo-approval` | `ApprovalDetailScreen` |
| 39 | `/governance/policies` | `GovernancePoliciesScreen` |
| 40 | `/audit-log` | `AuditLogScreen` |
| 41 | `/risk-center` | `RiskCenterScreen` |

## Static Asset Guardrail

| Check | Result |
|---|---|
| `parity_38` rendered | No |
| `parity_39` rendered | No |
| `parity_40` rendered | No |
| `parity_41` rendered | No |
| `sidebar.png`, `topbar.png`, `content.png` rendered | No |
| `backgroundImage` parity screenshot usage | No |

## Data Selectors

Sprint 5J added selector-driven view models for governance support routes:

- `selectApprovalDetailViewModel`
- `selectGovernancePoliciesViewModel`
- `selectAuditLogViewModel`
- `selectRiskCenterViewModel`

The screens derive from approvals, tickets, agents, runs, activities, tool policy data, and workflow events.

## Structural Gate

| Screen | Route | Regions Passed | Status |
|---|---|---:|---|
| 38 | `/approvals/demo-approval` | 8/8 | Pass |
| 39 | `/governance/policies` | 8/8 | Pass |
| 40 | `/audit-log` | 8/8 | Pass |
| 41 | `/risk-center` | 8/8 | Pass |

## Pixel Diff Reference

Pixel diff remains a visual polish metric, not the primary real UI acceptance gate.

| Screen | Route | Pixel diff | Notes |
|---|---|---:|---|
| 38 | `/approvals/demo-approval` | 8.5569% | Visual polish deferred |
| 39 | `/governance/policies` | 7.8260% | Visual polish deferred |
| 40 | `/audit-log` | 8.3532% | Visual polish deferred |
| 41 | `/risk-center` | 9.3348% | Visual polish deferred |

## Verification

| Check | Result |
|---|---|
| `npm run build` | Pass |
| bbox 38/39/40/41 | Pass 32/32 |
| pixel reference 38/39/40/41 under 30% safety gate | Pass |

## Decision

PASS.

Sprint 5J promoted governance and audit support routes into Real UI structural coverage.

## Next Step

Sprint 5K should convert budget and reporting routes:

- Screen 42 `/cost`
- Screen 43 `/budget/settings`
- Screen 44 `/reports`
- Screen 45 `/reports/new`
