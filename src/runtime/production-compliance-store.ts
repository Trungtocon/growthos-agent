import { demoWorkspace } from '../data/demo-fixtures';
import { registerArtifact } from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import { evaluateActionAccess } from './production-access-control-store';
import type {
  ComplianceApprovalStatus,
  ComplianceAuditRecord,
  ComplianceChangeApproval,
  ComplianceChangeInput,
  ComplianceControl,
  ComplianceControlType,
  ProductionComplianceDashboard,
} from './production-compliance';

const PRODUCTION_COMPLIANCE_KEY = 'uikigai-production-compliance-v1';

const DEFAULT_CONTROLS: ComplianceControlType[] = ['ISO27001', 'SOC2', 'GDPR', 'PCI-DSS', 'HIPAA', 'InternalPolicy'];

interface ProductionComplianceState {
  auditTrail: ComplianceAuditRecord[];
  approvals: ComplianceChangeApproval[];
  artifacts: ArtifactRecord[];
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyState(): ProductionComplianceState {
  return { auditTrail: [], approvals: [], artifacts: [], updatedAt: nowIso() };
}

function readState(): ProductionComplianceState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(PRODUCTION_COMPLIANCE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ProductionComplianceState>;
    return {
      auditTrail: parsed.auditTrail ?? [],
      approvals: parsed.approvals ?? [],
      artifacts: parsed.artifacts ?? [],
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: ProductionComplianceState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PRODUCTION_COMPLIANCE_KEY, JSON.stringify({ ...state, updatedAt: nowIso() }));
}

function persistApproval(approval: ComplianceChangeApproval): ComplianceChangeApproval {
  const state = readState();
  const updated = { ...approval, updatedAt: nowIso() };
  writeState({
    ...state,
    approvals: [updated, ...state.approvals.filter((entry) => entry.approvalId !== updated.approvalId)].slice(0, 100),
  });
  return clone(updated);
}

export function clearProductionComplianceStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PRODUCTION_COMPLIANCE_KEY);
}

export function getProductionComplianceState(): ProductionComplianceState {
  return clone(readState());
}

export function recordComplianceAuditEvent(input: {
  actor?: string;
  action: string;
  object: string;
  beforeState?: unknown;
  afterState?: unknown;
  justification?: string;
  evidence?: string[];
  controls?: ComplianceControlType[];
}): ComplianceAuditRecord {
  const state = readState();
  const record: ComplianceAuditRecord = {
    auditId: unique('compliance-audit'),
    actor: input.actor ?? 'System',
    timestamp: nowIso(),
    action: input.action,
    object: input.object,
    beforeState: input.beforeState,
    afterState: input.afterState,
    justification: input.justification ?? 'Production governance audit event.',
    evidence: input.evidence ?? [],
    controls: input.controls?.length ? input.controls : ['InternalPolicy'],
  };
  writeState({ ...state, auditTrail: [record, ...state.auditTrail].slice(0, 300) });
  return clone(record);
}

export function createComplianceChangeApproval(input: ComplianceChangeInput): ComplianceChangeApproval {
  const createdAt = nowIso();
  const approval: ComplianceChangeApproval = {
    approvalId: unique('compliance-approval'),
    object: input.object,
    status: 'draft',
    actor: input.actor ?? 'Compliance Operator',
    justification: input.justification ?? 'Production change requires compliance approval.',
    evidence: input.evidence ?? [],
    controls: input.controls?.length ? input.controls : ['ISO27001', 'SOC2', 'InternalPolicy'],
    createdAt,
    updatedAt: createdAt,
  };
  const stored = persistApproval(approval);
  recordComplianceAuditEvent({
    actor: stored.actor,
    action: 'compliance-change.created',
    object: stored.object,
    afterState: stored,
    justification: stored.justification,
    evidence: stored.evidence,
    controls: stored.controls,
  });
  return stored;
}

function transitionComplianceChange(approvalId: string | undefined, status: ComplianceApprovalStatus, actor: string, action: string): ComplianceChangeApproval {
  const approval = approvalId ? readState().approvals.find((entry) => entry.approvalId === approvalId) : readState().approvals[0];
  const existing = approval ?? createComplianceChangeApproval({ object: 'production-change' });
  const now = nowIso();
  const updated: ComplianceChangeApproval = {
    ...existing,
    status,
    reviewer: status === 'reviewed' || status === 'approved' || status === 'verified' || status === 'closed' ? actor : existing.reviewer,
    submittedAt: status === 'submitted' ? now : existing.submittedAt,
    reviewedAt: status === 'reviewed' ? now : existing.reviewedAt,
    approvedAt: status === 'approved' ? now : existing.approvedAt,
    rejectedAt: status === 'rejected' ? now : existing.rejectedAt,
    implementedAt: status === 'implemented' ? now : existing.implementedAt,
    verifiedAt: status === 'verified' ? now : existing.verifiedAt,
    closedAt: status === 'closed' ? now : existing.closedAt,
  };
  const stored = persistApproval(updated);
  recordComplianceAuditEvent({
    actor,
    action,
    object: stored.object,
    beforeState: existing,
    afterState: stored,
    justification: stored.justification,
    evidence: stored.evidence,
    controls: stored.controls,
  });
  return stored;
}

export function submitComplianceChange(approvalId?: string, actor = 'Compliance Operator') {
  return transitionComplianceChange(approvalId, 'submitted', actor, 'compliance-change.submitted');
}

export function reviewComplianceChange(approvalId?: string, reviewer = 'Compliance Reviewer') {
  return transitionComplianceChange(approvalId, 'reviewed', reviewer, 'compliance-change.reviewed');
}

export function approveComplianceChange(approvalId?: string, reviewer = 'Compliance Reviewer') {
  const access = evaluateActionAccess({ actor: reviewer, action: 'approve', moduleId: 'production-compliance', objectId: approvalId });
  if (!access.allowed) {
    recordComplianceAuditEvent({
      actor: reviewer,
      action: 'compliance-change.approval-blocked',
      object: approvalId ?? 'production-change',
      justification: access.reasons.join(' ') || 'Compliance approval actor is not authorized.',
      evidence: ['access-control:blocked'],
      controls: ['SOC2', 'ISO27001', 'InternalPolicy'],
    });
    return transitionComplianceChange(approvalId, 'reviewed', reviewer, 'compliance-change.reviewed');
  }
  return transitionComplianceChange(approvalId, 'approved', reviewer, 'compliance-change.approved');
}

export function rejectComplianceChange(approvalId?: string, reviewer = 'Compliance Reviewer') {
  return transitionComplianceChange(approvalId, 'rejected', reviewer, 'compliance-change.rejected');
}

export function implementComplianceChange(approvalId?: string, actor = 'Release Operator') {
  return transitionComplianceChange(approvalId, 'implemented', actor, 'compliance-change.implemented');
}

export function verifyComplianceChange(approvalId?: string, reviewer = 'Audit Reviewer') {
  return transitionComplianceChange(approvalId, 'verified', reviewer, 'compliance-change.verified');
}

export function closeComplianceChange(approvalId?: string, reviewer = 'Audit Reviewer') {
  return transitionComplianceChange(approvalId, 'closed', reviewer, 'compliance-change.closed');
}

export function selectComplianceAuditTrail(): ComplianceAuditRecord[] {
  return clone(readState().auditTrail);
}

export function selectComplianceApprovalHistory(): ComplianceChangeApproval[] {
  return clone(readState().approvals);
}

export function selectComplianceControls(): ComplianceControl[] {
  const state = readState();
  return DEFAULT_CONTROLS.map((control) => {
    const relatedEvents = state.auditTrail.filter((event) => event.controls.includes(control));
    return {
      control,
      status: relatedEvents.length ? 'covered' : 'warning',
      evidenceCount: relatedEvents.reduce((total, event) => total + event.evidence.length, 0),
      lastAuditAt: relatedEvents[0]?.timestamp,
    };
  });
}

export function selectComplianceArtifacts(): ArtifactRecord[] {
  return clone(readState().artifacts);
}

export function selectProductionComplianceDashboard(): ProductionComplianceDashboard {
  const state = readState();
  const controls = selectComplianceControls();
  const approvedChanges = state.approvals.filter((approval) => approval.status === 'approved' || approval.status === 'implemented' || approval.status === 'verified' || approval.status === 'closed').length;
  return {
    auditTrail: clone(state.auditTrail),
    approvals: clone(state.approvals),
    controls,
    artifacts: clone(state.artifacts),
    summary: {
      auditEvents: state.auditTrail.length,
      approvals: state.approvals.length,
      approvedChanges,
      rejectedChanges: state.approvals.filter((approval) => approval.status === 'rejected').length,
      evidenceArtifacts: state.artifacts.length,
      controlsCovered: controls.filter((control) => control.status === 'covered').length,
    },
    warnings: controls.filter((control) => control.status !== 'covered').map((control) => `${control.control} has no linked audit evidence yet.`),
    blockers: state.auditTrail.length ? [] : ['No production compliance audit events have been recorded.'],
  };
}

function exportedArtifact(name: string, type: ArtifactRecord['type'], content: unknown): ArtifactRecord {
  const createdAt = nowIso();
  return registerArtifact({
    id: `artifact-production-compliance-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    name,
    type,
    lifecycle: 'AVAILABLE',
    workspaceId: demoWorkspace.id,
    version: 1,
    metadata: {
      workspaceId: demoWorkspace.id,
      source: 'mock',
      sourceType: 'production-compliance',
      contentSummary: `${name} generated by Production Compliance & Audit Center. Raw secrets are excluded.`,
      tags: ['production-compliance', 'audit', 'evidence-vault'],
      sizeBytes: JSON.stringify(content).length,
    },
    createdAt,
    updatedAt: createdAt,
  });
}

export function exportComplianceEvidenceVault(): ArtifactRecord[] {
  const dashboard = selectProductionComplianceDashboard();
  const artifacts = [
    exportedArtifact('audit-report.md', 'REPORT', dashboard.auditTrail),
    exportedArtifact('approval-record.md', 'APPROVAL', dashboard.approvals),
    exportedArtifact('change-history.json', 'AUDIT', dashboard.approvals),
    exportedArtifact('evidence-log.json', 'AUDIT', dashboard.auditTrail.flatMap((entry) => entry.evidence)),
    exportedArtifact('compliance-summary.md', 'REPORT', dashboard.summary),
  ];
  const state = readState();
  writeState({ ...state, artifacts });
  return clone(artifacts);
}
