export type ExecutionTimelineEventType =
  | 'RUN_CREATED'
  | 'PLAN_CREATED'
  | 'STEP_STARTED'
  | 'TOOL_STARTED'
  | 'TOOL_COMPLETED'
  | 'ARTIFACT_CREATED'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_APPROVED'
  | 'APPROVAL_REJECTED'
  | 'GOVERNANCE_DECISION'
  | 'USAGE_RECORDED'
  | 'COST_RECORDED'
  | 'RUN_COMPLETED'
  | 'RUN_FAILED'
  | 'RUN_CANCELLED';

export type ExecutionTimelineSeverity = 'info' | 'success' | 'warning' | 'danger';
export type ExecutionTimelineSource = 'runtime' | 'hermes' | 'paperclip' | 'governance' | 'approval' | 'usage' | 'artifact';

export interface ExecutionTimelineEvent {
  id: string;
  type: ExecutionTimelineEventType;
  runId: string;
  agentId: string;
  ticketId?: string;
  planId?: string;
  stepId?: string;
  toolCallId?: string;
  artifactId?: string;
  approvalId?: string;
  timestamp: string;
  title: string;
  description: string;
  severity: ExecutionTimelineSeverity;
  source: ExecutionTimelineSource;
  metadata?: Record<string, unknown>;
}

export interface ExecutionReplayState {
  runId: string;
  runStatus: string;
  currentStep?: string;
  completedSteps: string[];
  activeTool?: string;
  completedTools: string[];
  producedArtifacts: string[];
  approvalStatus?: string;
  governanceDecision?: string;
  accumulatedCost: number;
  accumulatedUsage: number;
  lastEventType: ExecutionTimelineEventType;
}

export interface ExecutionReplayFrame {
  id: string;
  runId: string;
  frameIndex: number;
  eventId: string;
  timestamp: string;
  title: string;
  state: ExecutionReplayState;
}

export interface ExecutionReplaySummary {
  runId: string;
  frameCount: number;
  finalStatus: string;
  artifactCount: number;
  approvalCount: number;
  totalCost: number;
  totalUsage: number;
  generatedAt: string;
}

export interface ExecutionTimelineSummary {
  workspaceId: string;
  timelineCount: number;
  eventCount: number;
  runCount: number;
  artifactEvents: number;
  approvalEvents: number;
  governanceEvents: number;
  warningEvents: number;
  dangerEvents: number;
  generatedAt: string;
}

export interface ExecutionTimeline {
  id: string;
  workspaceId: string;
  runId?: string;
  agentId?: string;
  ticketId?: string;
  events: ExecutionTimelineEvent[];
  replayFrames: ExecutionReplayFrame[];
  summary: ExecutionReplaySummary;
  generatedAt: string;
}

export function executionTimelineId(scope: 'run' | 'agent' | 'ticket', id: string): string {
  return `execution-timeline-${scope}-${id}`;
}

export function executionTimelineEventId(
  runId: string,
  type: ExecutionTimelineEventType,
  entityId: string,
): string {
  return `timeline-${runId}-${type.toLowerCase()}-${entityId}`;
}
