import type { ApprovalStatus, RunStatus } from '../../domain/types';
import type { WorkflowData } from '../../state/workflow-engine';

export type RuntimeMode = 'mock' | 'sandbox';
export type RuntimeRunCommand = 'pause' | 'resume' | 'retry' | 'cancel';
export type RuntimeDecisionOutcome = Extract<ApprovalStatus, 'approved' | 'rejected'>;
export type RuntimeIntegrationStatus = 'online' | 'offline' | 'degraded';

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

export interface RuntimeServiceHealth {
  service: 'hermes' | 'paperclip';
  mode: RuntimeMode;
  status: RuntimeIntegrationStatus;
  message: string;
  checkedAt: string;
  latencyMs?: number;
}
