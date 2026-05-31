export type WorkflowCommand =
  | 'approveApproval'
  | 'rejectApproval'
  | 'approveRunAction'
  | 'rejectRunAction'
  | 'startAgentRun'
  | 'startStreamingRun'
  | 'retryRun'
  | 'assignTicket'
  | 'escalateTicket'
  | 'resolveTicket'
  | 'pauseRun'
  | 'resumeRun'
  | 'cancelAgentRun'
  | 'run.created'
  | 'run.queued'
  | 'run.started'
  | 'tool.started'
  | 'tool.progress'
  | 'tool.completed'
  | 'artifact.created'
  | 'approval.requested'
  | 'run.completed'
  | 'run.failed'
  | 'run.cancelled';

export type WorkflowEntityType = 'approval' | 'ticket' | 'run';
export type WorkflowEventStatus = 'pending' | 'success' | 'failed';

export interface WorkflowEvent {
  id: string;
  command: WorkflowCommand;
  entityType: WorkflowEntityType;
  entityId: string;
  actorId: string;
  title: string;
  createdAt: string;
  status: WorkflowEventStatus;
  error?: string;
}

let eventSequence = 0;

export function createWorkflowEvent(input: Omit<WorkflowEvent, 'id' | 'createdAt'>): WorkflowEvent {
  eventSequence += 1;
  return {
    ...input,
    id: `workflow-event-${eventSequence}`,
    createdAt: new Date().toISOString(),
  };
}
