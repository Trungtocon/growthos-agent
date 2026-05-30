import type { ApprovalStatus, RunStatus } from '../../domain/types';
import type { WorkflowData } from '../../state/workflow-engine';

export type RuntimeMode = 'mock' | 'remote';
export type RuntimeRunCommand = 'pause' | 'resume' | 'retry' | 'cancel';
export type RuntimeDecisionOutcome = Extract<ApprovalStatus, 'approved' | 'rejected'>;

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
