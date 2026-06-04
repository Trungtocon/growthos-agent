import { demoWorkspace } from '../data/demo-fixtures';
import { registerArtifact } from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import {
  calculateRunbookCompletion,
  deriveRunbookStatuses,
  type OperatorHandoffStatus,
  type ProductionRunbook,
  type ProductionRunbookBlocker,
  type ProductionRunbookDashboard,
  type ProductionRunbookEvent,
  type ProductionRunbookInput,
  type ProductionRunbookSection,
  type ProductionRunbookStatus,
  type ProductionRunbookSupportWindow,
  type ProductionRunbookWarning,
  type RunbookSectionType,
} from './production-runbook';

const PRODUCTION_RUNBOOK_KEY = 'uikigai-production-runbook-v1';

interface ProductionRunbookState {
  runbooks: ProductionRunbook[];
  activeRunbookId?: string;
  artifacts: ArtifactRecord[];
  copiedSummary?: string;
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

function emptyState(): ProductionRunbookState {
  return { runbooks: [], artifacts: [], updatedAt: nowIso() };
}

function readState(): ProductionRunbookState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(PRODUCTION_RUNBOOK_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ProductionRunbookState>;
    return {
      runbooks: parsed.runbooks ?? [],
      activeRunbookId: parsed.activeRunbookId,
      artifacts: parsed.artifacts ?? [],
      copiedSummary: parsed.copiedSummary,
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: ProductionRunbookState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PRODUCTION_RUNBOOK_KEY, JSON.stringify({ ...state, updatedAt: nowIso() }));
}

function event(runbookId: string, type: ProductionRunbookEvent['type'], message: string, metadata?: Record<string, unknown>): ProductionRunbookEvent {
  return { id: unique(`production-runbook-${type}`), runbookId, type, message, timestamp: nowIso(), metadata };
}

function blocker(runbookId: string, reason: string, recommendedFix: string, sectionId?: string, severity: ProductionRunbookBlocker['severity'] = 'blocking'): ProductionRunbookBlocker {
  return { id: `runbook-blocker-${runbookId}-${reason.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`, reason, recommendedFix, sectionId, severity, createdAt: nowIso() };
}

function warning(runbookId: string, reason: string, recommendedFix: string, sectionId?: string): ProductionRunbookWarning {
  return { id: unique(`runbook-warning-${runbookId}`), reason, recommendedFix, sectionId, createdAt: nowIso() };
}

function section(type: RunbookSectionType, title: string, description: string, required = true): ProductionRunbookSection {
  const createdAt = nowIso();
  return {
    id: `runbook-section-${type}`,
    type,
    title,
    description,
    required,
    status: 'pending',
    evidence: [],
    updatedAt: createdAt,
  };
}

function defaultSections(): ProductionRunbookSection[] {
  return [
    section('deployment_checklist', 'Deployment checklist', 'Production deployment prerequisites and operator confirmation steps.'),
    section('go_live_checklist', 'Go-live checklist', 'Final go/no-go checklist aligned with certified sandbox and readiness evidence.'),
    section('post_release_monitoring', 'Post-release monitoring checklist', 'Health, latency, error, worker, queue, and artifact registry monitors.'),
    section('incident_response', 'Incident response procedure', 'Severity triage, owner assignment, customer impact, and audit capture procedure.'),
    section('rollback_procedure', 'Rollback procedure', 'Rollback drill, command owner, blast radius, and verification steps.'),
    section('escalation_matrix', 'Escalation matrix', 'Operational escalation owners and decision authority chain.'),
    section('support_contacts', 'Support contacts', 'Primary and secondary support contact plan for release window.'),
    section('slo_sla_rto_rpo', 'SLO/SLA/RTO/RPO summary', 'Operational recovery objectives and service thresholds.'),
    section('known_risks', 'Known risks', 'Residual risks, mitigations, and manual watch points.'),
    section('manual_verification', 'Manual verification steps', 'Operator steps for runtime, artifact, approval, and governance confirmation.'),
  ];
}

function applyReadiness(runbook: ProductionRunbook): ProductionRunbook {
  const statuses = deriveRunbookStatuses(runbook);
  const blockers: ProductionRunbookBlocker[] = [];
  const warnings: ProductionRunbookWarning[] = [];
  const requiredPending = runbook.sections.filter((item) => item.required && item.status !== 'done');

  if (!runbook.operatorOwner) blockers.push(blocker(runbook.runbookId, 'Operator owner is missing.', 'Assign an operator owner before handoff acceptance.'));
  if (!runbook.escalationOwner) blockers.push(blocker(runbook.runbookId, 'Escalation owner is missing.', 'Assign an escalation owner before go-live approval.'));
  if (!runbook.incidentOwner) blockers.push(blocker(runbook.runbookId, 'Incident owner is missing.', 'Assign an incident owner before operator acceptance.'));
  if (!runbook.supportWindow) blockers.push(blocker(runbook.runbookId, 'Support window is missing.', 'Set support coverage window for the release.'));
  if (statuses.rollbackStatus === 'missing') blockers.push(blocker(runbook.runbookId, 'Rollback procedure is missing.', 'Complete rollback procedure checklist.', 'runbook-section-rollback_procedure', 'critical'));
  if (statuses.monitoringStatus === 'missing') blockers.push(blocker(runbook.runbookId, 'Post-release monitoring checklist is missing.', 'Complete monitoring checklist.', 'runbook-section-post_release_monitoring', 'critical'));
  if (requiredPending.length) warnings.push(...requiredPending.map((item) => warning(runbook.runbookId, `${item.title} is not complete.`, 'Mark checklist item done or document a waiver.', item.id)));

  const complete = blockers.length === 0 && requiredPending.length === 0;
  let runbookStatus: ProductionRunbookStatus = runbook.runbookStatus;
  if (runbookStatus === 'draft' || runbookStatus === 'incomplete') runbookStatus = complete ? 'ready' : 'incomplete';
  if (!complete && runbookStatus === 'ready') runbookStatus = 'incomplete';
  const handoffStatus: OperatorHandoffStatus = complete && runbook.handoffStatus === 'pending' ? 'ready' : runbook.handoffStatus;

  return {
    ...runbook,
    ...statuses,
    runbookStatus,
    handoffStatus,
    blockers,
    warnings,
    updatedAt: nowIso(),
  };
}

function persistRunbook(runbook: ProductionRunbook): ProductionRunbook {
  const state = readState();
  const updated = applyReadiness({ ...runbook, updatedAt: nowIso() });
  writeState({
    ...state,
    runbooks: [updated, ...state.runbooks.filter((entry) => entry.runbookId !== updated.runbookId)].slice(0, 20),
    activeRunbookId: updated.runbookId,
  });
  return clone(updated);
}

function activeRunbook(): ProductionRunbook {
  const state = readState();
  const existing = state.activeRunbookId ? state.runbooks.find((entry) => entry.runbookId === state.activeRunbookId) : state.runbooks[0];
  return existing ? clone(existing) : createRunbook();
}

function resolveRunbook(runbookId?: string): ProductionRunbook {
  if (!runbookId) return activeRunbook();
  const found = readState().runbooks.find((entry) => entry.runbookId === runbookId);
  return found ? clone(found) : activeRunbook();
}

export function clearProductionRunbookStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PRODUCTION_RUNBOOK_KEY);
}

export function getProductionRunbookState(): ProductionRunbookState {
  return clone(readState());
}

export function createRunbook(input: ProductionRunbookInput = {}): ProductionRunbook {
  const createdAt = nowIso();
  const runbook: ProductionRunbook = {
    runbookId: unique('production-runbook'),
    releaseId: input.releaseId ?? 'go-live-release-current',
    environment: input.environment ?? 'PRODUCTION',
    operatorOwner: input.operatorOwner,
    escalationOwner: input.escalationOwner,
    incidentOwner: input.incidentOwner,
    supportWindow: input.supportWindow,
    runbookStatus: 'incomplete',
    handoffStatus: 'pending',
    rollbackStatus: 'missing',
    monitoringStatus: 'missing',
    supportStatus: 'missing',
    incidentResponseStatus: 'missing',
    evidencePackStatus: 'missing',
    sections: defaultSections(),
    blockers: [],
    warnings: [],
    timeline: [],
    artifacts: [],
    createdAt,
    updatedAt: createdAt,
  };
  runbook.timeline = [event(runbook.runbookId, 'runbook.created', 'Production runbook created.')];
  return persistRunbook(runbook);
}

export function refreshRunbook(runbookId?: string): ProductionRunbook {
  const runbook = resolveRunbook(runbookId);
  return persistRunbook({
    ...runbook,
    timeline: [event(runbook.runbookId, 'runbook.refreshed', 'Production runbook refreshed.'), ...runbook.timeline],
  });
}

export function markChecklistItemDone(sectionId: string, runbookId?: string): ProductionRunbook {
  const runbook = resolveRunbook(runbookId);
  return persistRunbook({
    ...runbook,
    sections: runbook.sections.map((section) => section.id === sectionId ? { ...section, status: 'done', evidence: [...section.evidence, `${section.title} confirmed by operator.`], updatedAt: nowIso() } : section),
    timeline: [event(runbook.runbookId, 'checklist.completed', `Checklist item ${sectionId} marked done.`), ...runbook.timeline],
  });
}

export function completeRunbookChecklist(runbookId?: string): ProductionRunbook {
  const runbook = resolveRunbook(runbookId);
  return persistRunbook({
    ...runbook,
    sections: runbook.sections.map((section) => ({ ...section, status: 'done', evidence: section.evidence.length ? section.evidence : [`${section.title} verified.`], updatedAt: nowIso() })),
    timeline: [event(runbook.runbookId, 'checklist.completed', 'All required runbook checklist items completed.'), ...runbook.timeline],
  });
}

export function markRunbookReady(runbookId?: string): ProductionRunbook {
  const runbook = applyReadiness(resolveRunbook(runbookId));
  return persistRunbook({
    ...runbook,
    runbookStatus: runbook.blockers.length === 0 ? 'ready' : 'incomplete',
    handoffStatus: runbook.blockers.length === 0 ? 'ready' : runbook.handoffStatus,
    timeline: [event(runbook.runbookId, 'runbook.ready', runbook.blockers.length ? 'Runbook readiness blocked.' : 'Runbook marked ready.'), ...runbook.timeline],
  });
}

export function approveRunbook(runbookId?: string, approvedBy = 'Operations Approver'): ProductionRunbook {
  const runbook = applyReadiness(resolveRunbook(runbookId));
  if (runbook.blockers.length) return persistRunbook({ ...runbook, runbookStatus: 'incomplete' });
  return persistRunbook({
    ...runbook,
    runbookStatus: 'approved',
    handoffStatus: 'ready',
    approvedBy,
    approvedAt: nowIso(),
    timeline: [event(runbook.runbookId, 'runbook.approved', `Runbook approved by ${approvedBy}.`), ...runbook.timeline],
  });
}

export function rejectRunbook(runbookId?: string, reason = 'Runbook rejected by operator review.'): ProductionRunbook {
  const runbook = resolveRunbook(runbookId);
  return persistRunbook({
    ...runbook,
    runbookStatus: 'incomplete',
    handoffStatus: 'rejected',
    rejectedReason: reason,
    timeline: [event(runbook.runbookId, 'runbook.rejected', reason), ...runbook.timeline],
  });
}

export function acceptOperatorHandoff(runbookId?: string, acceptedBy = 'Release Operator'): ProductionRunbook {
  const runbook = applyReadiness(resolveRunbook(runbookId));
  if (runbook.runbookStatus !== 'approved' || runbook.blockers.length) return persistRunbook(runbook);
  return persistRunbook({
    ...runbook,
    handoffStatus: 'accepted',
    acceptedBy,
    acceptedAt: nowIso(),
    timeline: [event(runbook.runbookId, 'handoff.accepted', `Operator handoff accepted by ${acceptedBy}.`), ...runbook.timeline],
  });
}

export function triggerRollbackDrill(runbookId?: string): ProductionRunbook {
  const runbook = resolveRunbook(runbookId);
  return persistRunbook({
    ...runbook,
    rollbackStatus: 'verified',
    timeline: [event(runbook.runbookId, 'rollback.drill', 'Rollback drill triggered and recorded.'), ...runbook.timeline],
  });
}

function exportedArtifact(name: string, type: ArtifactRecord['type'], content: unknown): ArtifactRecord {
  const createdAt = nowIso();
  return registerArtifact({
    id: `artifact-production-runbook-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    name,
    type,
    lifecycle: 'AVAILABLE',
    workspaceId: demoWorkspace.id,
    version: 1,
    metadata: {
      workspaceId: demoWorkspace.id,
      source: 'mock',
      sourceType: 'production-runbook',
      contentSummary: `${name} generated by production runbook handoff layer.`,
      tags: ['production-runbook', 'operator-handoff', 'go-live'],
      sizeBytes: JSON.stringify(content).length,
    },
    createdAt,
    updatedAt: createdAt,
  });
}

export function exportRunbookPack(runbookId?: string): ArtifactRecord[] {
  const runbook = applyReadiness(resolveRunbook(runbookId));
  const artifacts = [
    exportedArtifact('production-runbook.md', 'REPORT', runbook),
    exportedArtifact('operator-handoff-pack.md', 'REPORT', { handoffStatus: runbook.handoffStatus, operatorOwner: runbook.operatorOwner }),
    exportedArtifact('incident-response-runbook.md', 'REPORT', selectIncidentResponsePlan(runbook.runbookId)),
    exportedArtifact('rollback-procedure.md', 'REPORT', selectRollbackProcedure(runbook.runbookId)),
    exportedArtifact('support-escalation-matrix.md', 'REPORT', selectEscalationMatrix(runbook.runbookId)),
    exportedArtifact('post-release-monitoring-checklist.md', 'REPORT', runbook.sections.filter((section) => section.type === 'post_release_monitoring')),
    exportedArtifact('go-live-operator-summary.md', 'REPORT', generateOperatorSummary(runbook)),
  ];
  const updated = persistRunbook({
    ...runbook,
    evidencePackStatus: 'verified',
    artifacts: artifacts.map((artifact) => artifact.id),
    timeline: [event(runbook.runbookId, 'runbook.exported', 'Production runbook handoff pack exported.'), ...runbook.timeline],
  });
  const state = readState();
  writeState({
    ...state,
    artifacts,
    runbooks: [updated, ...state.runbooks.filter((entry) => entry.runbookId !== updated.runbookId)],
    activeRunbookId: updated.runbookId,
  });
  return clone(artifacts);
}

function generateOperatorSummary(runbook: ProductionRunbook): string {
  return `Runbook ${runbook.runbookId}: ${runbook.runbookStatus}, handoff ${runbook.handoffStatus}, rollback ${runbook.rollbackStatus}, monitoring ${runbook.monitoringStatus}.`;
}

export function copyOperatorSummary(runbookId?: string): string {
  const runbook = applyReadiness(resolveRunbook(runbookId));
  const summary = generateOperatorSummary(runbook);
  const state = readState();
  const updated = {
    ...runbook,
    operatorSummary: summary,
    timeline: [event(runbook.runbookId, 'summary.copied', 'Operator summary copied to runbook state.'), ...runbook.timeline],
  };
  writeState({
    ...state,
    copiedSummary: summary,
    runbooks: [updated, ...state.runbooks.filter((entry) => entry.runbookId !== updated.runbookId)],
    activeRunbookId: updated.runbookId,
  });
  return summary;
}

export function selectProductionRunbook(runbookId?: string): ProductionRunbookDashboard {
  const runbook = applyReadiness(resolveRunbook(runbookId));
  const completion = calculateRunbookCompletion(runbook.sections);
  return clone({
    ...runbook,
    checklistCompletion: completion,
    canApproveRunbook: runbook.blockers.length === 0 && (runbook.runbookStatus === 'ready' || runbook.runbookStatus === 'approved'),
    canAcceptHandoff: runbook.blockers.length === 0 && runbook.runbookStatus === 'approved' && runbook.handoffStatus !== 'accepted',
  });
}

export function selectProductionRunbookStatus(): ProductionRunbookStatus {
  return selectProductionRunbook().runbookStatus;
}

export function selectOperatorHandoffStatus(): OperatorHandoffStatus {
  return selectProductionRunbook().handoffStatus;
}

export function selectRunbookChecklist(): ProductionRunbookSection[] {
  return selectProductionRunbook().sections;
}

export function selectRunbookBlockers(): ProductionRunbookBlocker[] {
  return selectProductionRunbook().blockers;
}

export function selectRunbookWarnings(): ProductionRunbookWarning[] {
  return selectProductionRunbook().warnings;
}

export function selectRollbackProcedure(runbookId?: string): ProductionRunbookSection[] {
  return selectProductionRunbook(runbookId).sections.filter((section) => section.type === 'rollback_procedure');
}

export function selectIncidentResponsePlan(runbookId?: string): ProductionRunbookSection[] {
  return selectProductionRunbook(runbookId).sections.filter((section) => section.type === 'incident_response');
}

export function selectEscalationMatrix(runbookId?: string): ProductionRunbookSection[] {
  return selectProductionRunbook(runbookId).sections.filter((section) => section.type === 'escalation_matrix' || section.type === 'support_contacts');
}

export function selectSupportWindow(): ProductionRunbookSupportWindow | undefined {
  return selectProductionRunbook().supportWindow;
}

export function selectCanApproveRunbook(): boolean {
  return selectProductionRunbook().canApproveRunbook;
}

export function selectCanAcceptHandoff(): boolean {
  return selectProductionRunbook().canAcceptHandoff;
}

export function selectRunbookArtifacts(): ArtifactRecord[] {
  return clone(readState().artifacts);
}
