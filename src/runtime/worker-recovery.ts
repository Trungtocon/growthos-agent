import type { WorkerIncident } from './worker-observability';

export type WorkerRecoveryReason =
  | 'stale_worker'
  | 'heartbeat_missing'
  | 'queue_item_failed'
  | 'retry_exhausted'
  | 'governance_blocked'
  | 'approval_timeout'
  | 'sla_breach'
  | 'tool_failure'
  | 'artifact_generation_failed'
  | 'unknown_runtime_error';

export type WorkerRecoveryAction =
  | 'restart_worker'
  | 'retry_current_item'
  | 'requeue_item'
  | 'skip_item'
  | 'pause_for_review'
  | 'escalate_to_approval'
  | 'export_diagnostics'
  | 'rollback_last_action'
  | 'kill_worker'
  | 'mark_unrecoverable';

export type WorkerRecoveryRisk = 'low' | 'medium' | 'high' | 'critical';

export type WorkerRecoveryStatus =
  | 'draft'
  | 'ready'
  | 'approval_required'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'resolved'
  | 'failed'
  | 'unrecoverable';

export type WorkerRecoveryStepStatus = 'pending' | 'ready' | 'blocked' | 'executing' | 'completed' | 'failed' | 'skipped';

export interface WorkerRecoveryPolicy {
  id: string;
  name: string;
  risk: WorkerRecoveryRisk;
  autoExecutable: boolean;
  requiresApproval: boolean;
  requiresReason: boolean;
  message: string;
}

export interface WorkerRecoveryStep {
  id: string;
  order: number;
  action: WorkerRecoveryAction;
  label: string;
  status: WorkerRecoveryStepStatus;
  risk: WorkerRecoveryRisk;
  requiresApproval: boolean;
  requiresReason: boolean;
  reason?: string;
  completedAt?: string;
  error?: string;
}

export interface WorkerRecoveryPlan {
  id: string;
  incidentId: string;
  incidentReason: WorkerRecoveryReason;
  workerId: string;
  queueItemId?: string;
  status: WorkerRecoveryStatus;
  risk: WorkerRecoveryRisk;
  steps: WorkerRecoveryStep[];
  policies: WorkerRecoveryPolicy[];
  approved: boolean;
  rejectedReason?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerRecoveryAttempt {
  id: string;
  planId: string;
  stepId?: string;
  action: WorkerRecoveryAction;
  status: 'started' | 'completed' | 'blocked' | 'failed';
  reason?: string;
  message: string;
  createdAt: string;
}

export interface WorkerRecoveryResult {
  id: string;
  planId: string;
  status: WorkerRecoveryStatus;
  successful: boolean;
  message: string;
  completedSteps: number;
  failedSteps: number;
  createdAt: string;
}

export interface WorkerRecoveryIncidentLink {
  id: string;
  incidentId: string;
  planId: string;
  workerId: string;
  queueItemId?: string;
  status: 'linked' | 'resolved' | 'unresolved';
  createdAt: string;
  resolvedAt?: string;
}

export interface AutoHealingDecision {
  id: string;
  planId: string;
  incidentId: string;
  decision: 'AUTO_EXECUTE' | 'REQUIRE_APPROVAL' | 'BLOCK';
  risk: WorkerRecoveryRisk;
  reasons: string[];
  createdAt: string;
}

export interface WorkerRecoveryDashboard {
  plans: WorkerRecoveryPlan[];
  activePlan?: WorkerRecoveryPlan;
  unresolvedIncidents: WorkerIncident[];
  autoHealingDecisions: AutoHealingDecision[];
  attempts: WorkerRecoveryAttempt[];
  results: WorkerRecoveryResult[];
  links: WorkerRecoveryIncidentLink[];
  readiness: WorkerRecoveryReadiness;
  artifacts: string[];
}

export interface WorkerRecoveryReadiness {
  ready: boolean;
  totalPlans: number;
  activePlans: number;
  approvalRequired: number;
  unresolvedIncidents: number;
  blockedReasons: string[];
}
