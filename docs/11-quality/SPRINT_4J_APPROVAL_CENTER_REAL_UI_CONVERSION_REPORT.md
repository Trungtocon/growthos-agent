# Sprint 4J - Approval Center Real UI Conversion Report

## Goal

Convert `/approvals` from static parity expectations to real UI components using the structural gate.

## Baseline

- Screen 08: Real UI Structural PASS / Visual Polish Deferred.
- Screen 20: Real UI Structural PASS / Visual Polish Deferred.
- Screen 30: Real UI Structural PASS / Visual Polish Deferred.
- Screen 32: Real UI Structural PASS / Visual Polish Deferred.
- Screen 34: Real UI Structural PASS / Visual Polish Deferred.

## Route Map

| Screen | Route | Active component | AppShell | Mode |
|---|---|---|---|---|
| 37 | `/approvals` | `ApprovalCenterRealPage` | Yes | Real UI Structural PASS |

## Static Asset Guardrail

| Check | Result |
|---|---|
| approval sidebar slice rendered | No |
| approval topbar slice rendered | No |
| approval content slice rendered | No |
| `backgroundImage` rendered | No |
| Full-screen screenshot rendered | No |

## Components Added/Changed

- `ApprovalCenterRealPage`
- `ApprovalHeader`
- `ApprovalKpiBand`
- `ApprovalQueuePanel`
- `ApprovalDetailPanel`
- `ApprovalPolicyPanel`
- Screen 37 layout contract
- `audit:bbox:37` npm script

## Structural Gate

| Region | Expected | Actual | dx | dy | dw | dh | Status |
|---|---|---|---:|---:|---:|---:|---|
| `app-shell.sidebar` | 0, 0, 218, 941 | 0, 0, 218, 941 | 0 | 0 | 0 | 0 | Pass |
| `app-shell.topbar` | 218, 0, 1454, 72 | 218, 0, 1454, 72 | 0 | 0 | 0 | 0 | Pass |
| `app-shell.main` | 240, 90, 1410, 1690 | 240, 90, 1410, 1690 | 0 | 0 | 0 | 0 | Pass |
| `approval.header` | 240, 90, 1410, 64 | 240, 90, 1410, 64 | 0 | 0 | 0 | 0 | Pass |
| `approval.kpi-band` | 240, 170, 1410, 112 | 240, 170, 1410, 112 | 0 | 0 | 0 | 0 | Pass |
| `approval.main-grid` | 240, 356, 1410, 1424 | 240, 356, 1410, 1424 | 0 | 0 | 0 | 0 | Pass |
| `approval.queue-panel` | 240, 356, 601.6, 1424 | 240, 356, 601.6, 1424 | 0 | 0 | 0 | 0 | Pass |
| `approval.detail-panel` | 857.6, 356, 792.4, 1424 | 857.6, 356, 792.4, 1424 | 0 | 0 | 0 | 0 | Pass |
| `approval.policy-panel` | 878.6, 821, 750.4, 150 | 878.6, 821, 750.4, 150 | 0 | 0 | 0 | 0 | Pass |
| `approval.queue-card` | 240, 356, 601.6, 1424 | 240, 356, 601.6, 1424 | 0 | 0 | 0 | 0 | Pass |
| `approval.detail-card` | 857.6, 356, 792.4, 696 | 857.6, 356, 792.4, 696 | 0 | 0 | 0 | 0 | Pass |
| `approval.audit-card` | 857.6, 1068, 792.4, 102 | 857.6, 1068, 792.4, 102 | 0 | 0 | 0 | 0 | Pass |
| `approval.actions-card` | 878.6, 991, 750.4, 40 | 878.6, 991, 750.4, 40 | 0 | 0 | 0 | 0 | Pass |

## Pixel Diff Reference

| Screen | Route | Pixel diff | Notes |
|---|---|---:|---|
| 37 | `/approvals` | 8.6397% | Visual polish deferred |

## Verification

| Check | Result |
|---|---|
| `npm run build` | Pass |
| Onboarding 01-07 parity regression | Pass |
| `npm run audit:bbox:08` | Pass, 14/14 |
| `npm run audit:bbox:20` | Pass, 14/14 |
| `npm run audit:bbox:30` | Pass, 12/12 |
| `npm run audit:bbox:32` | Pass, 15/15 |
| `npm run audit:bbox:34` | Pass, 16/16 |
| `npm run audit:bbox:37` | Pass, 13/13 |
| `STRICT_MAX_DIFF_PERCENT=15.0 npm run parity:check -- --ids=37` | Pass, 8.6397% |

## Decision

Sprint 4J: **PASS**.

## Next Step

Run Real UI Demo Flow Exit Gate across 08, 20, 30, 32, 34, and 37.
