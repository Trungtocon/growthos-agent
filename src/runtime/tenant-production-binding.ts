import type { ArtifactRecord } from './artifact-registry';

export type TenantBindingEnvironment = 'local' | 'sandbox' | 'staging' | 'production';
export type TenantBindingStatus = 'draft' | 'incomplete' | 'ready_for_review' | 'approved' | 'blocked' | 'active';
export type TenantBindingApprovalStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';
export type TenantBindingReadinessStatus = 'ready' | 'warning' | 'blocked';

export interface TenantBindingTimelineEvent {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  actor?: string;
}

export interface TenantProductionBinding {
  bindingId: string;
  tenantId: string;
  workspaceId: string;
  environment: TenantBindingEnvironment;
  backendProfileId?: string;
  databaseProfileId?: string;
  authProfileId?: string;
  observabilityProfileId?: string;
  supportProfileId?: string;
  deploymentProfileId?: string;
  owner?: string;
  reviewer?: string;
  rollbackOwner?: string;
  status: TenantBindingStatus;
  approvalStatus: TenantBindingApprovalStatus;
  evidenceReady: boolean;
  maskedSecretMetadata: string[];
  blockers: string[];
  warnings: string[];
  timeline: TenantBindingTimelineEvent[];
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  activatedAt?: string;
}

export interface TenantBindingInput {
  tenantId?: string;
  workspaceId?: string;
  environment?: TenantBindingEnvironment;
  backendProfileId?: string;
  databaseProfileId?: string;
  authProfileId?: string;
  observabilityProfileId?: string;
  supportProfileId?: string;
  deploymentProfileId?: string;
  owner?: string;
  reviewer?: string;
  rollbackOwner?: string;
}

export interface TenantBindingReadinessCheck {
  checkId: string;
  label: string;
  status: 'pass' | 'warning' | 'blocked';
  reason: string;
  recommendedFix: string;
}

export interface TenantBindingReadiness {
  bindingId?: string;
  status: TenantBindingReadinessStatus;
  score: number;
  blockers: string[];
  warnings: string[];
  checks: TenantBindingReadinessCheck[];
  lastCheckedAt: string;
}

export interface TenantBindingReviewState {
  bindingId?: string;
  approvalStatus: TenantBindingApprovalStatus;
  owner?: string;
  reviewer?: string;
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  canSubmit: boolean;
  canApprove: boolean;
  canActivate: boolean;
}

export interface TenantBindingCompactSummary {
  status: TenantBindingStatus | 'missing';
  environment: TenantBindingEnvironment | 'missing';
  readinessScore: number;
  blockers: number;
  warnings: number;
  activeBindingId?: string;
  approvalStatus: TenantBindingApprovalStatus | 'missing';
}

export interface TenantProductionBindingState {
  bindings: TenantProductionBinding[];
  activeBindingId?: string;
  artifacts: ArtifactRecord[];
  updatedAt: string;
}

export interface TenantProductionBindingDashboard {
  bindings: TenantProductionBinding[];
  activeBinding?: TenantProductionBinding;
  selectedBinding?: TenantProductionBinding;
  readiness: TenantBindingReadiness;
  review: TenantBindingReviewState;
  artifacts: ArtifactRecord[];
  compactSummary: TenantBindingCompactSummary;
}
