# Sprint 6B — Runtime Persistence Layer Report

## Goal
Replace transient runtime simulation with a persistent workspace runtime state while keeping Hermes and Paperclip in mock adapter mode.

## Runtime Store
Added `src/runtime-store/`:

| File | Purpose |
|---|---|
| `runtime-persistence.ts` | Session-backed runtime state boundary and lifecycle normalization |
| `run-store.ts` | Run upsert, lifecycle mutation, and `getRunById()` selector |
| `approval-store.ts` | Approval upsert and `getPendingApprovals()` selector |
| `artifact-store.ts` | Artifact upsert and `getRunArtifacts()` selector |
| `event-store.ts` | Runtime event append and `getRunEvents()` selector |

## Lifecycle
Supported runtime lifecycle values:

`CREATED`, `QUEUED`, `RUNNING`, `WAITING_APPROVAL`, `APPROVED`, `REJECTED`, `COMPLETED`, `FAILED`.

## Wiring
Runtime persistence is wired through selectors and adapter actions for:

| Route | Runtime-backed data |
|---|---|
| `/tickets/demo-ticket` | Demo run, Paperclip artifact, runtime approval gate, timeline events |
| `/runs/demo-run` | Persisted run lifecycle, tool/artifact/log state |
| `/approvals` | Persisted runtime approval gate and decision reconciliation |

UI components do not call Hermes or Paperclip directly. Calls still flow through:

`UI -> command action -> workflow engine -> async mock mutation -> runtime orchestrator/adapters -> runtime store -> selectors -> rerender`.

## Rollback Boundary
Sprint 6B keeps optimistic workflow mutations in the workflow store and only reconciles runtime-store approval decisions after the async mock mutation succeeds. This preserves rollback behavior for failed approval mutations.

## Smoke Coverage
Added:

| Script | Result |
|---|---|
| `scripts/smoke-runtime-persistence.mjs` | Pass 4/4 |
| `npm run smoke:runtime-persistence` | Pass |

Smoke verifies:

- Runtime run persists as `WAITING_APPROVAL` after starting Hermes run.
- Paperclip artifact persists across route navigation.
- Runtime approval persists across route navigation.
- Approval decision updates runtime approval and run lifecycle to `APPROVED`.
- Runtime state survives full page reload.

## Verification
| Check | Result |
|---|---|
| `npm run build` | Pass |
| `npm run validate:demo-data` | Pass |
| `npm run smoke:real-ui-flow` | Pass 48/48 |
| `npm run smoke:interactions` | Pass 7/7 |
| `npm run smoke:workflow-actions` | Pass 5/5 |
| `npm run smoke:runtime-integration` | Pass 4/4 |
| `npm run smoke:runtime-persistence` | Pass 4/4 |
| `npm run audit:static-assets` | Pass |
| onboarding 01-07 parity | Pass 7/7 |
| bbox 08/20/21/23/30/32/34/37 | Pass |

## Decision
PASS.

## Next Step
Sprint 6C should introduce a backend adapter boundary contract while keeping mock mode as the default runtime path.
