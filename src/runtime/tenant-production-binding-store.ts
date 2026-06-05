import { demoWorkspace } from '../data/demo-fixtures';
import { registerArtifact } from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import { recordComplianceAuditEvent } from './production-compliance-store';
import type {
  TenantBindingApprovalStatus,
  TenantBindingCompactSummary,
  TenantBindingInput,
  TenantBindingReadiness,
  TenantBindingReadinessCheck,
  TenantBindingReviewState,
  TenantBindingStatus,
  TenantProductionBinding,
  TenantProductionBindingDashboard,
  TenantProductionBindingState,
} from './tenant-production-binding';

const TENANT_BINDING_KEY = 'uikigai-tenant-production-binding-v1';
const DEFAULT_TENANT_ID = 'tenant-uikigai-demo';

function nowIso(): string {
  return new Date().toISOString();
}

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyState(): TenantProductionBindingState {
  return { bindings: [], artifacts: [], updatedAt: nowIso() };
}

function readState(): TenantProductionBindingState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(TENANT_BINDING_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<TenantProductionBindingState>;
    return {
      bindings: parsed.bindings ?? [],
      activeBindingId: parsed.activeBindingId,
      artifacts: parsed.artifacts ?? [],
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: TenantProductionBindingState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(TENANT_BINDING_KEY, JSON.stringify({ ...state, updatedAt: nowIso() }));
}

function timeline(type: string, message: string, actor?: string) {
  return { id: unique(`tenant-binding-${type}`), type, message, timestamp: nowIso(), actor };
}

function resolveBinding(bindingId?: string): TenantProductionBinding | undefined {
  const state = readState();
  if (bindingId) return state.bindings.find((binding) => binding.bindingId === bindingId);
  if (state.activeBindingId) return state.bindings.find((binding) => binding.bindingId === state.activeBindingId);
  return state.bindings[0];
}

function persistBinding(binding: TenantProductionBinding, active = false): TenantProductionBinding {
  const state = readState();
  const readiness = evaluateTenantBindingReadiness(binding);
  const next: TenantProductionBinding = {
    ...binding,
    blockers: readiness.blockers,
    warnings: readiness.warnings,
    updatedAt: nowIso(),
  };
  writeState({
    ...state,
    bindings: [next, ...state.bindings.filter((entry) => entry.bindingId !== next.bindingId)],
    activeBindingId: active ? next.bindingId : state.activeBindingId === next.bindingId && next.status !== 'active' ? undefined : state.activeBindingId,
  });
  return clone(next);
}

function createCheck(checkId: string, label: string, passed: boolean, reason: string, recommendedFix: string): TenantBindingReadinessCheck {
  return {
    checkId,
    label,
    status: passed ? 'pass' : 'blocked',
    reason: passed ? `${label} verified.` : reason,
    recommendedFix,
  };
}

function evidenceCheck(checkId: string, label: string, binding: TenantProductionBinding, reason: string, fix: string): TenantBindingReadinessCheck {
  return createCheck(checkId, label, binding.evidenceReady, reason, fix);
}

export function evaluateTenantBindingReadiness(binding?: TenantProductionBinding): TenantBindingReadiness {
  const checkedAt = nowIso();
  if (!binding) {
    return {
      status: 'blocked',
      score: 0,
      blockers: ['No tenant production binding exists.'],
      warnings: [],
      checks: [
        {
          checkId: 'tenant-binding-exists',
          label: 'Tenant binding exists',
          status: 'blocked',
          reason: 'No tenant production binding exists.',
          recommendedFix: 'Create a tenant/workspace production binding before production go-live.',
        },
      ],
      lastCheckedAt: checkedAt,
    };
  }

  const checks: TenantBindingReadinessCheck[] = [
    createCheck('backend-binding', 'Backend binding exists', Boolean(binding.backendProfileId), 'Backend profile is missing.', 'Select a verified production backend profile.'),
    createCheck('database-binding', 'Database binding exists', Boolean(binding.databaseProfileId), 'Database profile is missing.', 'Select a verified production database profile.'),
    createCheck('auth-binding', 'Auth/session binding exists', Boolean(binding.authProfileId), 'Auth/session profile is missing.', 'Select a verified production auth/session profile.'),
    evidenceCheck('environment-evidence', 'Environment variables evidence exists', binding, 'Environment variable evidence is missing.', 'Attach verified masked environment evidence.'),
    evidenceCheck('production-config-evidence', 'Production config evidence exists', binding, 'Production config evidence is missing.', 'Attach verified production config evidence.'),
    createCheck('observability-binding', 'Observability binding exists', Boolean(binding.observabilityProfileId), 'Observability profile is missing.', 'Select a verified observability profile.'),
    createCheck('support-owner', 'Support/incident owner exists', Boolean(binding.supportProfileId && binding.owner), 'Support/incident owner is missing.', 'Assign support profile and production owner.'),
    evidenceCheck('runbook-handoff', 'Runbook handoff accepted', binding, 'Runbook handoff evidence is missing.', 'Attach accepted runbook handoff evidence.'),
    createCheck('rollback-owner', 'Rollback owner exists', Boolean(binding.rollbackOwner), 'Rollback owner is missing.', 'Assign rollback owner before activation.'),
    createCheck('go-live-approval', 'Go-Live approval not bypassed', binding.approvalStatus === 'approved', 'Reviewer approval is missing or rejected.', 'Submit for review and record reviewer approval.'),
  ];
  const blockers = checks.filter((check) => check.status === 'blocked').map((check) => check.reason);
  const warnings = [
    ...(binding.environment !== 'production' ? [`Binding targets ${binding.environment}; production go-live requires production.`] : []),
    ...(binding.status === 'draft' ? ['Binding is still draft and has not been submitted for review.'] : []),
    ...(binding.maskedSecretMetadata.length ? [] : ['Only masked secret metadata is stored; raw secrets must remain outside frontend state.']),
  ];
  const score = Math.round((checks.filter((check) => check.status === 'pass').length / checks.length) * 100);
  return {
    bindingId: binding.bindingId,
    status: blockers.length ? 'blocked' : warnings.length ? 'warning' : 'ready',
    score,
    blockers,
    warnings,
    checks,
    lastCheckedAt: checkedAt,
  };
}

export function getTenantProductionBindingState(): TenantProductionBindingState {
  return clone(readState());
}

export function clearTenantProductionBindingStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(TENANT_BINDING_KEY);
}

export function createTenantBinding(input: TenantBindingInput = {}): TenantProductionBinding {
  const createdAt = nowIso();
  const binding: TenantProductionBinding = {
    bindingId: unique('tenant-binding'),
    tenantId: input.tenantId ?? DEFAULT_TENANT_ID,
    workspaceId: input.workspaceId ?? demoWorkspace.id,
    environment: input.environment ?? 'production',
    backendProfileId: input.backendProfileId,
    databaseProfileId: input.databaseProfileId,
    authProfileId: input.authProfileId,
    observabilityProfileId: input.observabilityProfileId,
    supportProfileId: input.supportProfileId,
    deploymentProfileId: input.deploymentProfileId,
    owner: input.owner,
    reviewer: input.reviewer,
    rollbackOwner: input.rollbackOwner,
    status: 'draft',
    approvalStatus: 'not_submitted',
    evidenceReady: false,
    maskedSecretMetadata: ['HERMES_PRODUCTION_API_KEY=********', 'PAPERCLIP_API_KEY=********'],
    blockers: [],
    warnings: [],
    timeline: [timeline('created', 'Tenant production binding draft created.')],
    createdAt,
    updatedAt: createdAt,
  };
  return persistBinding(binding);
}

export function updateTenantBinding(bindingId: string | undefined, patch: TenantBindingInput & { status?: TenantBindingStatus; approvalStatus?: TenantBindingApprovalStatus; evidenceReady?: boolean }): TenantProductionBinding {
  const binding = resolveBinding(bindingId) ?? createTenantBinding();
  return persistBinding({
    ...binding,
    ...patch,
    timeline: [timeline('updated', 'Tenant production binding profiles updated.'), ...binding.timeline],
  });
}

export function assignBindingOwner(bindingId: string | undefined, owner = 'Production Owner'): TenantProductionBinding {
  const binding = resolveBinding(bindingId) ?? createTenantBinding();
  return persistBinding({
    ...binding,
    owner,
    timeline: [timeline('owner.assigned', `Owner assigned to ${owner}.`, owner), ...binding.timeline],
  });
}

export function assignBindingReviewer(bindingId: string | undefined, reviewer = 'Production Reviewer'): TenantProductionBinding {
  const binding = resolveBinding(bindingId) ?? createTenantBinding();
  return persistBinding({
    ...binding,
    reviewer,
    timeline: [timeline('reviewer.assigned', `Reviewer assigned to ${reviewer}.`, reviewer), ...binding.timeline],
  });
}

export function markTenantBindingEvidenceReady(bindingId?: string): TenantProductionBinding {
  const binding = resolveBinding(bindingId) ?? createTenantBinding();
  return persistBinding({
    ...binding,
    evidenceReady: true,
    maskedSecretMetadata: ['HERMES_PRODUCTION_API_KEY=********', 'PAPERCLIP_API_KEY=********', 'AUTH_SECRET=********'],
    timeline: [timeline('evidence.attached', 'Verified masked production evidence attached.'), ...binding.timeline],
  });
}

export function submitTenantBindingForReview(bindingId?: string): TenantProductionBinding {
  const binding = resolveBinding(bindingId) ?? createTenantBinding();
  const submittedAt = nowIso();
  return persistBinding({
    ...binding,
    status: 'ready_for_review',
    approvalStatus: 'pending',
    submittedAt,
    timeline: [timeline('review.submitted', 'Tenant production binding submitted for reviewer approval.', binding.owner), ...binding.timeline],
  });
}

export function approveTenantBinding(bindingId?: string, reviewer = 'Production Reviewer'): TenantProductionBinding {
  const binding = resolveBinding(bindingId) ?? createTenantBinding();
  const approvedAt = nowIso();
  return persistBinding({
    ...binding,
    reviewer: binding.reviewer ?? reviewer,
    status: 'approved',
    approvalStatus: 'approved',
    approvedAt,
    timeline: [timeline('review.approved', `Tenant production binding approved by ${reviewer}.`, reviewer), ...binding.timeline],
  });
}

export function rejectTenantBinding(bindingId?: string, reason = 'Tenant binding rejected for review.'): TenantProductionBinding {
  const binding = resolveBinding(bindingId) ?? createTenantBinding();
  const rejectedAt = nowIso();
  return persistBinding({
    ...binding,
    status: 'blocked',
    approvalStatus: 'rejected',
    rejectedAt,
    timeline: [timeline('review.rejected', reason, binding.reviewer), ...binding.timeline],
  });
}

export function activateTenantBinding(bindingId?: string): TenantProductionBinding {
  const binding = resolveBinding(bindingId) ?? createTenantBinding();
  const readiness = evaluateTenantBindingReadiness(binding);
  if (readiness.blockers.length || binding.approvalStatus !== 'approved') {
    return persistBinding({
      ...binding,
      status: 'blocked',
      timeline: [timeline('activation.blocked', `Activation blocked by ${readiness.blockers.length} readiness issue(s).`), ...binding.timeline],
    });
  }
  const active = persistBinding({
    ...binding,
    status: 'active',
    activatedAt: nowIso(),
    timeline: [timeline('activation.active', 'Tenant production binding activated for production readiness gates.'), ...binding.timeline],
  }, true);
  recordComplianceAuditEvent({
    actor: active.reviewer ?? active.owner ?? 'Tenant Binding Reviewer',
    action: 'tenant-binding.activated',
    object: active.bindingId,
    beforeState: binding,
    afterState: active,
    justification: 'Every tenant production activation requires compliance audit evidence.',
    evidence: [`tenant:${active.tenantId}`, `workspace:${active.workspaceId}`, `environment:${active.environment}`],
    controls: ['ISO27001', 'SOC2', 'GDPR', 'InternalPolicy'],
  });
  return active;
}

function createArtifact(name: string, binding: TenantProductionBinding | undefined, contentSummary: string, type: ArtifactRecord['type'] = 'AUDIT'): ArtifactRecord {
  const now = nowIso();
  return {
    id: `tenant-binding-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    name,
    type,
    lifecycle: 'AVAILABLE',
    workspaceId: binding?.workspaceId ?? demoWorkspace.id,
    version: 1,
    metadata: {
      workspaceId: binding?.workspaceId ?? demoWorkspace.id,
      source: 'mock',
      sourceType: 'tenant-production-binding',
      contentSummary,
      tags: ['tenant-binding', 'production-readiness', 'admin-settings'],
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function exportTenantBindingPack(bindingId?: string): ArtifactRecord[] {
  const binding = resolveBinding(bindingId);
  const readiness = evaluateTenantBindingReadiness(binding);
  const artifacts = [
    createArtifact('tenant-production-binding.json', binding, `Tenant binding state for ${binding?.tenantId ?? 'missing tenant'}.`, 'EXPORT'),
    createArtifact('tenant-production-binding-report.md', binding, `Tenant binding status ${binding?.status ?? 'missing'} with readiness ${readiness.status}.`, 'REPORT'),
    createArtifact('tenant-binding-readiness.md', binding, `Readiness score ${readiness.score} with ${readiness.blockers.length} blocker(s).`, 'REPORT'),
    createArtifact('tenant-binding-blockers.json', binding, `${readiness.blockers.length} tenant binding blocker(s).`, 'AUDIT'),
    createArtifact('tenant-binding-approval-record.md', binding, `Approval status ${binding?.approvalStatus ?? 'missing'}.`, 'APPROVAL'),
    createArtifact('tenant-go-live-binding-pack.md', binding, 'Go-Live tenant/workspace binding pack for operator handoff.', 'EXPORT'),
  ].map((artifact) => registerArtifact(artifact, { createdBy: 'tenant-production-binding' }));
  const state = readState();
  writeState({ ...state, artifacts: artifacts.concat(state.artifacts.filter((artifact) => !artifacts.some((item) => item.id === artifact.id))) });
  return clone(artifacts);
}

export function selectTenantProductionBindings(): TenantProductionBinding[] {
  return clone(readState().bindings);
}

export function selectActiveTenantProductionBinding(): TenantProductionBinding | undefined {
  const state = readState();
  const active = state.activeBindingId ? state.bindings.find((binding) => binding.bindingId === state.activeBindingId && binding.status === 'active') : undefined;
  return active ? clone(active) : undefined;
}

export function selectTenantBindingReadiness(bindingId?: string): TenantBindingReadiness {
  return evaluateTenantBindingReadiness(resolveBinding(bindingId));
}

export function selectTenantBindingBlockers(bindingId?: string): string[] {
  return selectTenantBindingReadiness(bindingId).blockers;
}

export function selectTenantBindingWarnings(bindingId?: string): string[] {
  return selectTenantBindingReadiness(bindingId).warnings;
}

export function selectTenantBindingReviewState(bindingId?: string): TenantBindingReviewState {
  const binding = resolveBinding(bindingId);
  const readiness = evaluateTenantBindingReadiness(binding);
  return {
    bindingId: binding?.bindingId,
    approvalStatus: binding?.approvalStatus ?? 'not_submitted',
    owner: binding?.owner,
    reviewer: binding?.reviewer,
    submittedAt: binding?.submittedAt,
    approvedAt: binding?.approvedAt,
    rejectedAt: binding?.rejectedAt,
    canSubmit: Boolean(binding && binding.owner && binding.reviewer && binding.approvalStatus !== 'approved'),
    canApprove: Boolean(binding && binding.approvalStatus === 'pending' && binding.reviewer),
    canActivate: Boolean(binding && binding.approvalStatus === 'approved' && readiness.blockers.length === 0),
  };
}

export function selectTenantBindingArtifacts(): ArtifactRecord[] {
  return clone(readState().artifacts);
}

export function selectTenantBindingCompactSummary(): TenantBindingCompactSummary {
  const active = selectActiveTenantProductionBinding();
  const binding = active ?? resolveBinding();
  const readiness = evaluateTenantBindingReadiness(binding);
  return {
    status: binding?.status ?? 'missing',
    environment: binding?.environment ?? 'missing',
    readinessScore: readiness.score,
    blockers: readiness.blockers.length,
    warnings: readiness.warnings.length,
    activeBindingId: active?.bindingId,
    approvalStatus: binding?.approvalStatus ?? 'missing',
  };
}

export function selectTenantProductionBindingDashboard(bindingId?: string): TenantProductionBindingDashboard {
  const selectedBinding = resolveBinding(bindingId);
  return {
    bindings: selectTenantProductionBindings(),
    activeBinding: selectActiveTenantProductionBinding(),
    selectedBinding,
    readiness: selectTenantBindingReadiness(selectedBinding?.bindingId),
    review: selectTenantBindingReviewState(selectedBinding?.bindingId),
    artifacts: selectTenantBindingArtifacts(),
    compactSummary: selectTenantBindingCompactSummary(),
  };
}
