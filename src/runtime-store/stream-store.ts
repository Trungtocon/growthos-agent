import type { RunStreamEvent } from '../integrations/growthos-runtime/runtime-types';
import { readRuntimeState, updateRuntimeState } from './runtime-persistence';

type StreamEventInput = Omit<RunStreamEvent, 'id' | 'runId' | 'sequence' | 'timestamp'> &
  Partial<Pick<RunStreamEvent, 'id' | 'runId' | 'sequence' | 'timestamp'>>;

export function appendStreamEvent(runId: string, input: StreamEventInput): RunStreamEvent {
  const existing = getStreamEvents(runId);
  const sequence = input.sequence ?? existing.length + 1;
  const event: RunStreamEvent = {
    id: input.id ?? `stream-${runId}-${sequence}`,
    runId,
    sequence,
    type: input.type,
    message: input.message,
    timestamp: input.timestamp ?? new Date().toISOString(),
    payload: input.payload,
  };

  updateRuntimeState((state) => ({
    ...state,
    streamEvents: {
      ...(state.streamEvents ?? {}),
      [runId]: [...existing.filter((item) => item.id !== event.id), event].sort((a, b) => a.sequence - b.sequence),
    },
    completedStreams: {
      ...(state.completedStreams ?? {}),
      [runId]: input.type === 'run.completed' || input.type === 'run.failed'
        ? true
        : Boolean(state.completedStreams?.[runId]),
    },
  }));

  return event;
}

export function getStreamEvents(runId: string): RunStreamEvent[] {
  return [...(readRuntimeState().streamEvents?.[runId] ?? [])].sort((a, b) => a.sequence - b.sequence);
}

export function clearStream(runId: string) {
  updateRuntimeState((state) => {
    const streamEvents = { ...(state.streamEvents ?? {}) };
    const completedStreams = { ...(state.completedStreams ?? {}) };
    delete streamEvents[runId];
    delete completedStreams[runId];
    return { ...state, streamEvents, completedStreams };
  });
}

export function markStreamComplete(runId: string) {
  updateRuntimeState((state) => ({
    ...state,
    completedStreams: { ...(state.completedStreams ?? {}), [runId]: true },
  }));
}

export function isStreamComplete(runId: string): boolean {
  return Boolean(readRuntimeState().completedStreams?.[runId]);
}
