# Sprint 6D — Real Run Lifecycle Mapping Report

## Goal

Map Hermes/Paperclip sandbox execution lifecycle into the GrowthOS runtime store while preserving mock fallback and the existing UI/runtime gates.

## Files Added/Changed

| Area | Files |
|---|---|
| Runtime mapping | `src/integrations/growthos-runtime/run-event-mapper.ts`, `src/integrations/growthos-runtime/runtime-orchestrator.ts`, `src/integrations/growthos-runtime/runtime-types.ts` |
| Domain/contracts | `src/domain/types.ts`, `src/integrations/hermes/hermes-types.ts`, `src/integrations/hermes/hermes-client.ts`, `src/integrations/paperclip/paperclip-types.ts`, `src/integrations/paperclip/paperclip-client.ts` |
| Event model | `src/state/event-log.ts` |
| Smoke | `scripts/smoke-real-run-lifecycle.mjs`, `package.json` |
| Docs | `docs/13-integrations/RUNTIME_LIFECYCLE_MAPPING.md`, `docs/13-integrations/SPRINT_6D_REAL_RUN_LIFECYCLE_REPORT.md` |

## Lifecycle Mapping

| Hermes | GrowthOS lifecycle | GrowthOS run status |
|---|---|---|
| created | CREATED | queued |
| queued | QUEUED | queued |
| running | RUNNING | running |
| waiting_for_approval | WAITING_APPROVAL | paused |
| completed | COMPLETED | success |
| failed | FAILED | failed |
| cancelled | REJECTED | failed |

## Runtime Functions Added

- `startSandboxRun(ticketId)`
- `pollSandboxRun(runId)`
- `syncSandboxRun(runId)`
- `cancelSandboxRun(runId)`

## Tool Calls, Artifacts, and Approvals

- Hermes tool calls now map `startedAt` and `finishedAt` into GrowthOS `ToolCall`.
- Hermes artifact-like output and Paperclip artifacts map into GrowthOS `Artifact` with optional `contentSummary` and `source`.
- Approval-needed executions upsert runtime approvals and append `approval.requested` events.

## Smoke Coverage

`npm run smoke:real-run-lifecycle` verifies:

- mock lifecycle still works
- sandbox missing env falls back to mock lifecycle
- start run creates runtime run
- lifecycle creates events
- artifact appears
- approval can be generated
- cancel run updates status

## Verification

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run validate:demo-data` | pass |
| `npm run smoke:real-ui-flow` | pass, 48/48 |
| `npm run smoke:interactions` | pass, 7/7 |
| `npm run smoke:workflow-actions` | pass, 5/5 |
| `npm run smoke:runtime-integration` | pass, 4/4 |
| `npm run smoke:runtime-persistence` | pass, 4/4 |
| `npm run smoke:sandbox-connectors` | pass, 4/4 |
| `npm run smoke:real-run-lifecycle` | pass, 7/7 |
| `npm run audit:static-assets` | pass |
| onboarding 01-07 | pass, 7/7 |
| bbox 08/20/21/23/30/32/34/37 | pass |

## Decision

PASS. Hermes/Paperclip execution lifecycle now maps into GrowthOS runtime-store with mock fallback preserved and existing UI/runtime gates passing.
