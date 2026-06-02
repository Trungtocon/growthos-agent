import type { ImprovementLoopQueueItem } from './improvement-loop-queue';
import type { WorkerFailureReason, WorkerStatus } from './improvement-loop-worker';

export type WorkerBlockedReason =
  | WorkerFailureReason
  | 'rbac_denied'
  | 'governance_denied'
  | 'missing_reason'
  | 'retry_policy_exhausted'
  | 'no_active_item';

export type WorkerSLAStatus = 'healthy' | 'warning' | 'breached';

export interface WorkerObservation {
  id: string;
  workerId: string;
  status: WorkerStatus;
  activeQueueItemId?: string;
  currentStep: string;
  lastHeartbeatAt?: string;
  tickCount: number;
  retryCount: number;
  averageExecutionTimeMs: number;
  queueWaitTimeMs: number;
  governanceWaitTimeMs: number;
  approvalWaitTimeMs: number;
  lastFailureReason?: WorkerBlockedReason;
  staleWarning: boolean;
  slaStatus: WorkerSLAStatus;
  createdAt: string;
}

export interface WorkerRunTrace {
  id: string;
  workerId: string;
  queueItemId?: string;
  steps: Array<{
    id: string;
    label: string;
    status: WorkerStatus | 'blocked' | 'completed' | 'skipped';
    timestamp: string;
  }>;
  startedAt?: string;
  completedAt?: string;
}

export interface WorkerHealthSnapshot {
  id: string;
  workerId: string;
  status: WorkerStatus;
  heartbeatAgeMs: number;
  stale: boolean;
  tickCount: number;
  incidentCount: number;
  slaStatus: WorkerSLAStatus;
  generatedAt: string;
}

export type WorkerControlActionType =
  | 'pause'
  | 'resume'
  | 'stop'
  | 'kill'
  | 'retry_now'
  | 'skip_item'
  | 'requeue_item'
  | 'escalate_to_approval'
  | 'export_diagnostics';

export interface WorkerControlAction {
  id: string;
  type: WorkerControlActionType;
  workerId: string;
  queueItemId?: string;
  status: 'requested' | 'executed' | 'rejected';
  reason?: string;
  blockedReason?: WorkerBlockedReason;
  createdAt: string;
}

export interface WorkerIncident {
  id: string;
  workerId: string;
  queueItemId?: string;
  severity: 'info' | 'warning' | 'critical';
  reason: WorkerBlockedReason;
  message: string;
  createdAt: string;
}

export interface WorkerObservationDashboard {
  observation: WorkerObservation;
  activeQueueItem?: ImprovementLoopQueueItem;
  health: WorkerHealthSnapshot;
  incidents: WorkerIncident[];
  controlActions: WorkerControlAction[];
  diagnosticsArtifacts: string[];
}

export interface WorkerControlEligibility {
  canPause: boolean;
  canResume: boolean;
  canStop: boolean;
  canKill: boolean;
  canRetryNow: boolean;
  canSkip: boolean;
  canRequeue: boolean;
  canEscalateToApproval: boolean;
  reason?: WorkerBlockedReason;
}
