# Sprint 6F — Live Run Streaming Simulation Report

## Goal

Add live run streaming simulation for Hermes/Paperclip runtime so the Run Console can show progressive execution events instead of only final state.

## Scope

- Added persistent runtime stream events.
- Added runtime orchestrator streaming APIs.
- Wired ticket detail, run console, and approvals through existing selectors and runtime store.
- Added Playwright smoke coverage for stream lifecycle persistence.

## Stream Events Supported

| Event | Purpose |
|---|---|
| `run.queued` | Streaming run was queued. |
| `run.started` | Runtime stream started. |
| `tool.started` | Active tool call began. |
| `tool.progress` | Active tool call reported progress. |
| `tool.completed` | Active tool call completed. |
| `artifact.created` | Paperclip/Hermes artifact was generated. |
| `approval.requested` | Human approval gate was opened. |
| `run.completed` | Stream finished successfully. |
| `run.failed` | Stream failed and was marked complete. |

## Routes Wired

| Route | Streaming behavior |
|---|---|
| `/tickets/demo-ticket` | Start streaming action, latest stream status, linked artifact preview. |
| `/runs/demo-run` | Current step, timeline, tool calls, logs, artifacts, and completion state read from runtime store. |
| `/approvals` | Stream-generated approvals appear through runtime approvals. |

## Verification

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run validate:demo-data` | pass |
| `npm run smoke:real-ui-flow` | pass |
| `npm run smoke:interactions` | pass |
| `npm run smoke:workflow-actions` | pass |
| `npm run smoke:runtime-integration` | pass |
| `npm run smoke:runtime-persistence` | pass |
| `npm run smoke:sandbox-connectors` | pass |
| `npm run smoke:real-run-lifecycle` | pass |
| `npm run smoke:artifact-viewer` | pass |
| `npm run smoke:live-run-streaming` | pass |
| `npm run audit:static-assets` | pass |
| onboarding 01-07 | pass |
| bbox 08/20/21/23/30/32/34/37 | pass |

## Decision

PASS.
