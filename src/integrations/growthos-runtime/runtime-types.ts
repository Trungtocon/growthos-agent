import type { ApprovalStatus, RunStatus } from '../../domain/types';
import type { WorkflowData } from '../../state/workflow-engine';

export type RuntimeMode = 'mock' | 'sandbox';
export type RuntimeRunCommand = 'pause' | 'resume' | 'retry' | 'cancel';
export type RuntimeDecisionOutcome = Extract<ApprovalStatus, 'approved' | 'rejected'>;
export type RuntimeIntegrationStatus = 'online' | 'offline' | 'degraded';
export type RuntimeToolCallStatus = 'queued' | 'running' | 'completed' | 'failed';
export type RunStreamEventType =
  | 'run.queued'
  | 'run.started'
  | 'tool.started'
  | 'tool.progress'
  | 'tool.completed'
  | 'artifact.created'
  | 'approval.requested'
  | 'run.completed'
  | 'run.failed';

export interface HumanApprovalGate {
  id: string;
  approvalId: string;
  ticketId: string;
  runId?: string;
  agentId: string;
  title: string;
  policy: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: ApprovalStatus;
  requestedAt: string;
}

export interface RuntimeActionPlan {
  applyOptimistic: (data: WorkflowData) => WorkflowData;
  commit: () => Promise<void>;
}

export interface RuntimeCommandResult {
  runId: string;
  status: RunStatus;
  message: string;
}

export interface RunStreamEvent {
  id: string;
  runId: string;
  sequence: number;
  type: RunStreamEventType;
  message: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

export interface RuntimeStreamResult {
  runId: string;
  status: RunStatus;
  message: string;
  event: RunStreamEvent;
  complete: boolean;
}

export interface RuntimeToolCall {
  id: string;
  runId: string;
  toolName: string;
  status: RuntimeToolCallStatus;
  startedAt?: string;
  finishedAt?: string;
  input: string;
  output?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface RuntimeServiceHealth {
  service: 'hermes' | 'paperclip';
  mode: RuntimeMode;
  status: RuntimeIntegrationStatus;
  message: string;
  checkedAt: string;
  latencyMs?: number;
}
