import type { ArtifactRecord } from './artifact-registry';

export type ProductionReadinessCategory =
  | 'certified_sandbox_run'
  | 'runtime_certification'
  | 'governance_exit_gate'
  | 'approval_execution'
  | 'artifact_registry'
  | 'execution_graph'
  | 'execution_timeline'
  | 'replay_control'
  | 'run_evaluation'
  | 'feedback_loop'
  | 'learning_memory'
  | 'improvement_loop'
  | 'worker_observability'
  | 'worker_recovery'
  | 'chaos_simulation'
  | 'cost_reconciliation'
  | 'usage_ledger'
  | 'rbacs_and_authorization_audit'
  | 'environment_config'
  | 'ui_action_wiring';

export type ProductionReadinessStatus = 'READY' | 'WARNING' | 'BLOCKED' | 'NEEDS_REVIEW' | 'NOT_CHECKED';

export type ProductionReadinessBlockerCode =
  | 'missing_required_env'
  | 'sandbox_not_certified'
  | 'runtime_not_certified'
  | 'unresolved_governance_blocker'
  | 'unresolved_approval_hold'
  | 'failed_chaos_recovery'
  | 'failed_worker_recovery'
  | 'failed_artifact_registry'
  | 'failed_ui_action_wiring'
  | 'stale_dirty_production_files'
  | 'production_endpoint_not_configured'
  | 'cost_or_quota_policy_blocked';

export interface ProductionReadinessChecklistItem {
  id: string;
  category: ProductionReadinessCategory;
  label: string;
  required: boolean;
  status: ProductionReadinessStatus;
  reason: string;
  recommendedFix: string;
  evidenceCount: number;
  evidence: string[];
  updatedAt: string;
}

export interface ProductionReadinessBlocker {
  id: string;
  checkId: string;
  category: ProductionReadinessCategory;
  code: ProductionReadinessBlockerCode;
  reason: string;
  recommendedFix: string;
  severity: 'blocking' | 'warning';
  createdAt: string;
}

export interface ProductionReadinessWarning {
  id: string;
  checkId: string;
  category: ProductionReadinessCategory;
  reason: string;
  recommendedFix: string;
  createdAt: string;
}

export interface ProductionReadinessCheck {
  id: string;
  workspaceId: string;
  status: ProductionReadinessStatus;
  approvalStatus: 'not_requested' | 'approved' | 'rejected';
  checklist: ProductionReadinessChecklistItem[];
  blockers: ProductionReadinessBlocker[];
  warnings: ProductionReadinessWarning[];
  lastCertifiedSandboxRunId?: string;
  lastRuntimeCertificationRunId?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;
  rejectedAt?: string;
  createdAt: string;
  evaluatedAt?: string;
  updatedAt: string;
}

export interface ProductionReadinessDashboard {
  checks: ProductionReadinessCheck[];
  activeCheck?: ProductionReadinessCheck;
  status: ProductionReadinessStatus;
  blockers: ProductionReadinessBlocker[];
  warnings: ProductionReadinessWarning[];
  checklist: ProductionReadinessChecklistItem[];
  lastCertifiedSandboxRunId?: string;
  lastRuntimeCertificationRunId?: string;
  chaosRecoverySummary: string;
  workerRecoverySummary: string;
  costQuotaSummary: string;
  approvalSummary: string;
  artifacts: ArtifactRecord[];
}

export interface ProductionReadinessArtifactExport {
  records: ArtifactRecord[];
  names: string[];
}
