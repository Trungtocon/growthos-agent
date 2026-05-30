import type { WorkflowCommand, WorkflowEntityType, WorkflowEvent } from '../state/event-log';
import { readRuntimeState, updateRuntimeState } from './runtime-persistence';

let runtimeEventSequence = 0;

export function appendRuntimeEvent(input: {
  command: WorkflowCommand;
  entityType: WorkflowEntityType;
  entityId: string;
  actorId: string;
  title: string;
  status: WorkflowEvent['status'];
  error?: string;
}): WorkflowEvent {
  runtimeEventSequence += 1;
  const event: WorkflowEvent = {
    ...input,
    id: `runtime-event-${runtimeEventSequence}`,
    createdAt: new Date().toISOString(),
  };
  updateRuntimeState((state) => ({
    ...state,
    events: [event, ...state.events.filter((item) => item.id !== event.id)],
  }));
  return event;
}

export function getRunEvents(runId: string): WorkflowEvent[] {
  return readRuntimeState().events.filter((event) => event.entityId === runId || event.entityType === 'run' && event.entityId === runId);
}

export function getRuntimeEvents(): WorkflowEvent[] {
  return readRuntimeState().events;
}
