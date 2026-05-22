import type { Activity } from '../domain/types';
import type { WorkflowEvent } from '../state/event-log';

function eventActivityStatus(event: WorkflowEvent): Activity['status'] {
  if (event.status === 'failed') return 'failed';
  if (event.status === 'pending') return 'running';
  return 'success';
}

export function workflowEventsToActivities(events: WorkflowEvent[]): Activity[] {
  return events.map((event) => ({
    id: event.id,
    type: event.entityType === 'approval' ? 'approval' : event.entityType,
    title: event.title,
    description: event.status === 'failed' ? `${event.command} failed: ${event.error ?? 'mock mutation rejected'}` : event.command,
    relatedTicketId: event.entityType === 'ticket' ? event.entityId : undefined,
    relatedRunId: event.entityType === 'run' ? event.entityId : undefined,
    createdAt: event.createdAt,
    status: eventActivityStatus(event),
  }));
}

export function mergeActivityTimeline(activities: Activity[], events: WorkflowEvent[]): Activity[] {
  return [...workflowEventsToActivities(events), ...activities]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
