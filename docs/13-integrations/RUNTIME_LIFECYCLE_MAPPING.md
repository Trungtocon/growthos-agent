# Runtime Lifecycle Mapping

## Purpose

Sprint 6D maps Hermes/Paperclip sandbox execution data into the GrowthOS runtime store. The UI continues to read through selectors and runtime-store; React components do not call Hermes or Paperclip directly.

## Integration Path

```text
command-actions -> async-actions -> runtime-orchestrator -> adapters -> clients
```

Mock mode remains the default. Sandbox mode is optional and falls back to mock when config is missing.

## Hermes Status Mapping

| Hermes status | GrowthOS lifecycle | GrowthOS run status | Notes |
|---|---|---|---|
| `created` | `CREATED` | `queued` | Task exists but has not started. |
| `queued` | `QUEUED` | `queued` | Runtime accepted the task. |
| `running` | `RUNNING` | `running` | Active execution. |
| `waiting_for_approval` | `WAITING_APPROVAL` | `paused` | Creates or updates an approval gate. |
| `completed` | `COMPLETED` | `success` | Terminal success. |
| `failed` | `FAILED` | `failed` | Terminal failure. |
| `cancelled` | `REJECTED` | `failed` | Operator cancellation is represented as rejected lifecycle. |

Legacy demo run statuses such as `warning`, `paused`, and `success` continue to map into the same lifecycle buckets.

## Tool Call Mapping

Hermes tool calls map into GrowthOS `ToolCall`:

| Hermes field | GrowthOS field |
|---|---|
| `id` | `id` |
| `toolName` | `toolName` |
| `status` | `status` |
| `inputSummary` | `inputSummary` |
| `outputSummary` | `outputSummary` |
| `durationMs` | `durationMs` |
| `cost` | `cost` |
| `startedAt` | `startedAt` |
| `finishedAt` | `finishedAt` |

If Hermes omits timestamps, the mapper uses the sync timestamp for completed calls and leaves running calls open.

## Artifact Mapping

Hermes artifact-like output maps into GrowthOS `Artifact`:

| Source field | GrowthOS field |
|---|---|
| `id` | `id` |
| `runId` | `runId` |
| `type` | `type` |
| `name` | `name` |
| `url` | `url` |
| `contentSummary` | `contentSummary` |
| `source` | `source` |
| `createdAt` | `createdAt` |

Paperclip artifacts preserve `source: paperclip`. Hermes output defaults to `source: hermes`. Mock-generated data can use `source: mock`.

## Event Timeline Mapping

Lifecycle sync writes runtime events:

- `run.created`
- `run.queued`
- `run.started`
- `tool.started`
- `tool.completed`
- `artifact.created`
- `approval.requested`
- `run.completed`
- `run.failed`
- `run.cancelled`

These events are stored in `runtime-store/event-store.ts` and are merged into ticket detail and run console selectors.

## Approval Mapping

When Hermes status is `waiting_for_approval`, or the current step indicates approval, the runtime:

1. upserts an approval gate into `approval-store`
2. sets run lifecycle to `WAITING_APPROVAL`
3. appends `approval.requested`
4. lets `/approvals` render the gate through existing selectors

Approve/reject commands continue to use the runtime adapter path.

## Runtime Functions

`runtime-orchestrator.ts` exposes:

- `startSandboxRun(ticketId)`
- `pollSandboxRun(runId)`
- `syncSandboxRun(runId)`
- `cancelSandboxRun(runId)`

The existing workflow actions remain in place for UI interactions.

## Fallback Behavior

| Mode/config | Behavior |
|---|---|
| mock mode | Uses mock Hermes/Paperclip clients. |
| sandbox mode with missing config | Falls back to mock adapter and reports degraded health. |
| sandbox mode with config | Uses Hermes/Paperclip sandbox clients. |

No real credentials are required for build or smoke tests.
