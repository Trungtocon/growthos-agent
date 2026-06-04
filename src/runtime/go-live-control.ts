import type { RuntimeEnvironmentId } from './environment-registry';

export type GoLiveFinalVerdict = 'GO' | 'NO_GO' | 'BLOCKED' | 'WARNING';
export type GoLiveDecisionState =
  | 'draft'
  | 'waiting_evidence'
  | 'waiting_approval'
  | 'approved'
  | 'rejected'
  | 'blocked'
  | 'released'
  | 'rolled_back';

export type GoLiveGateStatus = 'verified' | 'warning' | 'blocked' | 'not_checked';

export interface GoLiveReadinessGate {
  gateId: string;
  name: string;
  status: GoLiveGateStatus;
  score: number;
  blockers: string[];
  warnings: string[];
  evidence: string[];
  route: string;
  required: boolean;
}

export interface GoLiveBlocker {
  id: string;
  gateId: string;
  reason: string;
  recommendedFix: string;
  severity: 'blocking' | 'critical';
  createdAt: string;
}

export interface GoLiveWarning {
  id: string;
  gateId: string;
  reason: string;
  recommendedFix: string;
  createdAt: string;
}

export interface GoLiveEvidenceChecklistItem {
  id: string;
  label: string;
  status: 'complete' | 'missing' | 'warning';
  evidence: string[];
  required: boolean;
}

export interface GoLiveTimelineEvent {
  id: string;
  releaseId: string;
  type:
    | 'release.created'
    | 'readiness.refreshed'
    | 'approval.requested'
    | 'approval.approved'
    | 'approval.rejected'
    | 'release.released'
    | 'release.rolled_back'
    | 'pack.exported'
    | 'summary.copied'
    | 'rollback.verified'
    | 'window.set';
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface GoLiveReleaseDecision {
  releaseId: string;
  environment: RuntimeEnvironmentId;
  version: string;
  commitHash: string;
  releaseCandidate: string;
  state: GoLiveDecisionState;
  finalVerdict: GoLiveFinalVerdict;
  readinessScore: number;
  blockerCount: number;
  warningCount: number;
  approvedBy?: string;
  approvalTimestamp?: string;
  rejectedBy?: string;
  rejectedReason?: string;
  releaseWindow?: {
    start: string;
    end: string;
  };
  rollbackPlanStatus: 'missing' | 'verified' | 'triggered';
  evidencePackStatus: 'missing' | 'exported';
  goLiveChecklistStatus: 'missing' | 'complete' | 'warning';
  productionConfigStatus: GoLiveGateStatus;
  backendStatus: GoLiveGateStatus;
  databaseStatus: GoLiveGateStatus;
  authStatus: GoLiveGateStatus;
  environmentStatus: GoLiveGateStatus;
  observabilityStatus: GoLiveGateStatus;
  certifiedSandboxStatus: GoLiveGateStatus;
  runtimeCertificationStatus: GoLiveGateStatus;
  readinessMatrix: GoLiveReadinessGate[];
  blockers: GoLiveBlocker[];
  warnings: GoLiveWarning[];
  evidenceChecklist: GoLiveEvidenceChecklistItem[];
  timeline: GoLiveTimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface GoLiveControlDashboard extends GoLiveReleaseDecision {
  canApprove: boolean;
  canMarkReleased: boolean;
  canTriggerRollback: boolean;
}

export function calculateGoLiveReadinessScore(gates: GoLiveReadinessGate[], checklist: GoLiveEvidenceChecklistItem[]): number {
  const requiredGates = gates.filter((gate) => gate.required);
  const verifiedGates = requiredGates.filter((gate) => gate.status === 'verified').length;
  const requiredChecklist = checklist.filter((item) => item.required);
  const completeChecklist = requiredChecklist.filter((item) => item.status === 'complete').length;
  const gateScore = requiredGates.length ? verifiedGates / requiredGates.length : 0;
  const checklistScore = requiredChecklist.length ? completeChecklist / requiredChecklist.length : 0;
  return Math.round(((gateScore * 0.75) + (checklistScore * 0.25)) * 100);
}

export function deriveGoLiveVerdict(input: {
  state: GoLiveDecisionState;
  blockers: GoLiveBlocker[];
  warnings: GoLiveWarning[];
  readinessScore: number;
  approvedBy?: string;
}): GoLiveFinalVerdict {
  if (input.state === 'released') return 'GO';
  if (input.state === 'rejected' || input.state === 'rolled_back') return 'NO_GO';
  if (input.blockers.length) return 'BLOCKED';
  if (!input.approvedBy) return 'BLOCKED';
  if (input.warnings.length || input.readinessScore < 100) return 'WARNING';
  return 'GO';
}
