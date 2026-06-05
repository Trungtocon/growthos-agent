import type { ArtifactRecord } from './artifact-registry';

export type ComplianceControlType = 'ISO27001' | 'SOC2' | 'GDPR' | 'PCI-DSS' | 'HIPAA' | 'InternalPolicy';
export type ComplianceApprovalStatus = 'draft' | 'submitted' | 'reviewed' | 'approved' | 'rejected' | 'implemented' | 'verified' | 'closed';

export interface ComplianceAuditRecord {
  auditId: string;
  actor: string;
  timestamp: string;
  action: string;
  object: string;
  beforeState?: unknown;
  afterState?: unknown;
  justification: string;
  evidence: string[];
  controls: ComplianceControlType[];
}

export interface ComplianceChangeApproval {
  approvalId: string;
  object: string;
  status: ComplianceApprovalStatus;
  actor: string;
  reviewer?: string;
  justification: string;
  evidence: string[];
  controls: ComplianceControlType[];
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  reviewedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  implementedAt?: string;
  verifiedAt?: string;
  closedAt?: string;
}

export interface ComplianceControl {
  control: ComplianceControlType;
  status: 'covered' | 'warning' | 'missing';
  evidenceCount: number;
  lastAuditAt?: string;
}

export interface ProductionComplianceSummary {
  auditEvents: number;
  approvals: number;
  approvedChanges: number;
  rejectedChanges: number;
  evidenceArtifacts: number;
  controlsCovered: number;
}

export interface ProductionComplianceDashboard {
  auditTrail: ComplianceAuditRecord[];
  approvals: ComplianceChangeApproval[];
  controls: ComplianceControl[];
  artifacts: ArtifactRecord[];
  summary: ProductionComplianceSummary;
  warnings: string[];
  blockers: string[];
}

export interface ComplianceChangeInput {
  object: string;
  actor?: string;
  justification?: string;
  evidence?: string[];
  controls?: ComplianceControlType[];
}
