import { demoWorkspace } from '../data/demo-fixtures';
import { registerArtifact } from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import { getEvidenceAdjustedAuthReadinessReport } from './auth-readiness-store';
import { getEvidenceAdjustedBackendReadinessReport } from './backend-health';
import { getCertifiedSandboxRunDashboard } from './certified-sandbox-run-store';
import { getEvidenceAdjustedDatabaseReadinessReport } from './database-readiness';
import { getDeploymentConfigDashboard, isDeploymentConfigReadyForGoLive } from './deployment-config-store';
import { getEvidenceAdjustedEnvironmentReadinessReport } from './environment-readiness-store';
import { selectPreGoLiveValidationSummary } from './pre-golive-validation-store';
import { selectProductionConfigEvidenceDashboard } from './production-config-evidence-store';
import { selectObservabilityDashboard } from './production-observability-store';
import { getProductionReadinessDashboard } from './production-readiness-store';
import { selectIncidentCommandReadiness } from './production-incident-store';
import { selectProductionRunbook } from './production-runbook-store';
import { getRuntimeCertificationDashboard } from './runtime-certification-store';
import {
  calculateGoLiveReadinessScore,
  deriveGoLiveVerdict,
  type GoLiveBlocker,
  type GoLiveControlDashboard,
  type GoLiveDecisionState,
  type GoLiveEvidenceChecklistItem,
  type GoLiveFinalVerdict,
  type GoLiveReadinessGate,
  type GoLiveReleaseDecision,
  type GoLiveTimelineEvent,
  type GoLiveWarning,
} from './go-live-control';

const GO_LIVE_CONTROL_KEY = 'uikigai-go-live-control-v1';

export interface GoLiveControlState {
  releases: GoLiveReleaseDecision[];
  activeReleaseId?: string;
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

function emptyState(): GoLiveControlState {
  return { releases: [], artifacts: [], updatedAt: nowIso() };
}

function readState(): GoLiveControlState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(GO_LIVE_CONTROL_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<GoLiveControlState>;
    return {
      releases: parsed.releases ?? [],
      activeReleaseId: parsed.activeReleaseId,
      artifacts: parsed.artifacts ?? [],
      copiedSummary: parsed.copiedSummary,
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: GoLiveControlState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(GO_LIVE_CONTROL_KEY, JSON.stringify({ ...state, updatedAt: nowIso() }));
}

function statusFrom(blockers: string[], warnings: string[], score = 100): GoLiveReadinessGate['status'] {
  if (blockers.length) return 'blocked';
  if (warnings.length || score < 100) return 'warning';
  return 'verified';
}

function blocker(releaseId: string, gateId: string, reason: string, recommendedFix: string, severity: GoLiveBlocker['severity'] = 'blocking'): GoLiveBlocker {
  return { id: `go-live-blocker-${releaseId}-${gateId}-${reason.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`, gateId, reason, recommendedFix, severity, createdAt: nowIso() };
}

function warning(releaseId: string, gateId: string, reason: string, recommendedFix: string): GoLiveWarning {
  return { id: unique(`go-live-warning-${releaseId}-${gateId}`), gateId, reason, recommendedFix, createdAt: nowIso() };
}

function timeline(releaseId: string, type: GoLiveTimelineEvent['type'], message: string, metadata?: Record<string, unknown>): GoLiveTimelineEvent {
  return { id: unique(`go-live-event-${type}`), releaseId, type, message, timestamp: nowIso(), metadata };
}

function createGate(input: Omit<GoLiveReadinessGate, 'required'> & { required?: boolean }): GoLiveReadinessGate {
  return { required: true, ...input };
}

function buildMatrix(releaseId: string): { gates: GoLiveReadinessGate[]; blockers: GoLiveBlocker[]; warnings: GoLiveWarning[] } {
  const productionReadiness = getProductionReadinessDashboard();
  const deployment = getDeploymentConfigDashboard();
  const runtime = getRuntimeCertificationDashboard();
  const sandbox = getCertifiedSandboxRunDashboard();
  const backend = getEvidenceAdjustedBackendReadinessReport('PRODUCTION');
  const database = getEvidenceAdjustedDatabaseReadinessReport('PRODUCTION');
  const auth = getEvidenceAdjustedAuthReadinessReport('PRODUCTION');
  const environment = getEvidenceAdjustedEnvironmentReadinessReport('PRODUCTION');
  const evidence = selectProductionConfigEvidenceDashboard();
  const observability = selectObservabilityDashboard();
  const runbook = selectProductionRunbook();
  const incidentCommand = selectIncidentCommandReadiness();
  const preGoLive = selectPreGoLiveValidationSummary();

  const latestSandbox = sandbox.runs.find((run) => run.status === 'completed');
  const runtimePassed = runtime.status === 'certified' || runtime.runs.some((run) => run.status === 'certified' || run.status === 'passed');
  const readinessApproved = Boolean(productionReadiness.activeCheck?.approvalStatus === 'approved');
  const deploymentReady = isDeploymentConfigReadyForGoLive() || deployment.activeConfig?.status === 'valid';
  const preGoLiveBlocks = preGoLive.blockers.map((entry) => typeof entry === 'string' ? entry : JSON.stringify(entry));
  const evidenceCoversGate = (gateId: string) => {
    const required = evidence.requirements.filter((entry) => entry.relatedGate === gateId);
    return required.length > 0 && required.every((requirement) => evidence.verified.some((entry) => entry.category === requirement.category));
  };
  const blockersForGate = (gateId: string, blockers: string[]) => evidenceCoversGate(gateId) ? [] : blockers;
  const warningsForGate = (gateId: string, blockers: string[], warnings: string[]) => evidenceCoversGate(gateId) && blockers.length
    ? [...warnings, ...blockers.map((entry) => `Resolved by verified production evidence: ${entry}`)]
    : warnings;
  const backendBlockers = blockersForGate('backend-readiness', backend.blockers);
  const backendWarnings = warningsForGate('backend-readiness', backend.blockers, backend.warnings);
  const databaseBlockers = blockersForGate('database-readiness', database.blockers);
  const databaseWarnings = warningsForGate('database-readiness', database.blockers, database.warnings);
  const authBlockers = blockersForGate('auth-readiness', auth.blockers);
  const authWarnings = warningsForGate('auth-readiness', auth.blockers, auth.warnings);
  const environmentBlockers = blockersForGate('environment-readiness', environment.blockers);
  const environmentWarnings = warningsForGate('environment-readiness', environment.blockers, environment.warnings);

  const gates = [
    createGate({
      gateId: 'production-readiness',
      name: 'Production Readiness',
      status: readinessApproved ? 'verified' : 'blocked',
      score: readinessApproved ? 100 : productionReadiness.blockers.length ? 0 : productionReadiness.status === 'READY' ? 100 : 85,
      blockers: readinessApproved ? [] : ['Production readiness is not approved or still has blockers.'],
      warnings: productionReadiness.warnings.map((entry) => entry.reason),
      evidence: productionReadiness.activeCheck ? [productionReadiness.activeCheck.id, productionReadiness.activeCheck.approvalStatus] : [],
      route: '/production-readiness',
    }),
    createGate({
      gateId: 'deployment-config',
      name: 'Deployment Config',
      status: deploymentReady ? 'verified' : 'blocked',
      score: deployment.readiness.productionReady ? 100 : 0,
      blockers: deploymentReady ? [] : ['Deployment configuration is not marked READY for production.'],
      warnings: deployment.warnings.map((entry) => entry.reason),
      evidence: deployment.activeConfig ? [deployment.activeConfig.id, deployment.activeConfig.status] : [],
      route: '/deployment-config',
    }),
    createGate({
      gateId: 'runtime-certification',
      name: 'Runtime Certification',
      status: runtimePassed ? 'verified' : 'blocked',
      score: runtimePassed ? 100 : 0,
      blockers: runtimePassed ? [] : ['Runtime certification is not passed.'],
      warnings: runtime.findings.map((entry) => entry.message),
      evidence: runtime.runs.map((run) => `${run.id}:${run.status}`),
      route: '/runtime-certification',
    }),
    createGate({
      gateId: 'certified-sandbox-run',
      name: 'Certified Sandbox Run',
      status: latestSandbox ? 'verified' : 'blocked',
      score: latestSandbox ? 100 : 0,
      blockers: latestSandbox ? [] : ['Certified sandbox run is not completed.'],
      warnings: sandbox.blockers.length && latestSandbox ? sandbox.blockers.map((blocker) => blocker.message) : [],
      evidence: latestSandbox ? [latestSandbox.id] : [],
      route: '/certified-sandbox-run',
    }),
    createGate({
      gateId: 'backend-readiness',
      name: 'Backend Readiness',
      status: statusFrom(backendBlockers, backendWarnings, backend.readinessScore),
      score: backendBlockers.length ? 0 : Math.max(backend.readinessScore, evidenceCoversGate('backend-readiness') ? 100 : backend.readinessScore),
      blockers: backendBlockers,
      warnings: backendWarnings,
      evidence: [`status:${backend.status}`, `score:${backend.readinessScore}`],
      route: '/backend-readiness',
    }),
    createGate({
      gateId: 'database-readiness',
      name: 'Database Readiness',
      status: statusFrom(databaseBlockers, databaseWarnings, database.readinessScore),
      score: databaseBlockers.length ? 0 : Math.max(database.readinessScore, evidenceCoversGate('database-readiness') ? 100 : database.readinessScore),
      blockers: databaseBlockers,
      warnings: databaseWarnings,
      evidence: [`schema:${database.schemaVersion}`, `migration:${database.migrationStatus}`],
      route: '/database-readiness',
    }),
    createGate({
      gateId: 'auth-readiness',
      name: 'Auth Readiness',
      status: statusFrom(authBlockers, authWarnings, auth.readinessScore),
      score: authBlockers.length ? 0 : Math.max(auth.readinessScore, evidenceCoversGate('auth-readiness') ? 100 : auth.readinessScore),
      blockers: authBlockers,
      warnings: authWarnings,
      evidence: [`status:${auth.status}`, `score:${auth.readinessScore}`],
      route: '/auth-readiness',
    }),
    createGate({
      gateId: 'environment-readiness',
      name: 'Environment Readiness',
      status: statusFrom(environmentBlockers, environmentWarnings, environment.readinessScore),
      score: environmentBlockers.length ? 0 : Math.max(environment.readinessScore, evidenceCoversGate('environment-readiness') ? 100 : environment.readinessScore),
      blockers: environmentBlockers,
      warnings: environmentWarnings,
      evidence: [`status:${environment.status}`, `score:${environment.readinessScore}`],
      route: '/environment-readiness',
    }),
    createGate({
      gateId: 'production-config-evidence',
      name: 'Production Config Evidence',
      status: evidence.verdict === 'READY' ? 'verified' : evidence.verdict === 'WARNING' ? 'warning' : 'blocked',
      score: evidence.readinessScore,
      blockers: evidence.remainingBlockers,
      warnings: [...evidence.expiryWarnings, ...evidence.rejected.map((entry) => `${entry.category} rejected`)],
      evidence: evidence.verified.map((entry) => `${entry.category}:${entry.status}`),
      route: '/production-config-evidence',
    }),
    createGate({
      gateId: 'production-observability',
      name: 'Production Observability',
      status: observability.verdict === 'READY' ? 'verified' : observability.verdict === 'WARNING' ? 'warning' : 'blocked',
      score: observability.readinessScore,
      blockers: observability.blockers.map((entry) => `Production observability: ${entry}`),
      warnings: observability.warnings,
      evidence: observability.checks.map((entry) => `${entry.type}:${entry.status}`),
      route: '/production-observability',
    }),
    createGate({
      gateId: 'production-runbook',
      name: 'Production Runbook & Operator Handoff',
      status: (runbook.runbookStatus === 'ready' || runbook.runbookStatus === 'approved')
        && runbook.handoffStatus === 'accepted'
        && runbook.rollbackStatus !== 'missing'
        && runbook.monitoringStatus !== 'missing'
        && Boolean(runbook.escalationOwner)
        && Boolean(runbook.incidentOwner)
        && Boolean(runbook.supportWindow)
        ? 'verified'
        : 'blocked',
      score: runbook.blockers.length ? 0 : runbook.handoffStatus === 'accepted' ? 100 : Math.max(runbook.checklistCompletion, 50),
      blockers: [
        ...(runbook.runbookStatus === 'ready' || runbook.runbookStatus === 'approved' ? [] : ['Production runbook is not ready or approved.']),
        ...(runbook.handoffStatus === 'accepted' ? [] : ['Operator handoff is not accepted.']),
        ...(runbook.rollbackStatus !== 'missing' ? [] : ['Rollback procedure is missing from production runbook.']),
        ...(runbook.monitoringStatus !== 'missing' ? [] : ['Post-release monitoring checklist is missing from production runbook.']),
        ...(runbook.escalationOwner ? [] : ['Escalation owner is missing from production runbook.']),
        ...(runbook.incidentOwner ? [] : ['Incident owner is missing from production runbook.']),
        ...(runbook.supportWindow ? [] : ['Support window is missing from production runbook.']),
      ],
      warnings: runbook.warnings.map((entry) => entry.reason),
      evidence: [`runbook:${runbook.runbookStatus}`, `handoff:${runbook.handoffStatus}`, `completion:${runbook.checklistCompletion}`],
      route: '/production-runbook',
    }),
    createGate({
      gateId: 'production-incidents',
      name: 'Production Incident Command',
      status: incidentCommand.blockers.length ? 'blocked' : incidentCommand.warnings.length ? 'warning' : 'verified',
      score: incidentCommand.blockers.length ? 0 : incidentCommand.warnings.length ? 85 : 100,
      blockers: incidentCommand.blockers.map((entry) => entry.reason),
      warnings: incidentCommand.warnings.map((entry) => entry.reason),
      evidence: [
        `status:${incidentCommand.status}`,
        `active:${incidentCommand.activeCount}`,
        `critical:${incidentCommand.criticalCount}`,
        `rollback:${incidentCommand.rollbackRequestCount}`,
      ],
      route: '/production-incidents',
    }),
    createGate({
      gateId: 'pre-golive-validation',
      name: 'Pre-Go-Live Validation',
      status: preGoLive.finalVerdict === 'READY' || preGoLive.finalVerdict === 'READY_WITH_WARNINGS' || (preGoLiveBlocks.length === 0 && evidence.verdict === 'READY') ? preGoLiveBlocks.length ? 'blocked' : 'verified' : 'blocked',
      score: preGoLiveBlocks.length ? preGoLive.readinessScore : Math.max(preGoLive.readinessScore, evidence.verdict === 'READY' ? 100 : preGoLive.readinessScore),
      blockers: preGoLiveBlocks,
      warnings: preGoLive.warnings.map((entry) => typeof entry === 'string' ? entry : JSON.stringify(entry)),
      evidence: [`verdict:${preGoLive.finalVerdict}`, `score:${preGoLive.readinessScore}`],
      route: '/pre-golive-validation',
    }),
  ];

  const blockers = gates.flatMap((gate) => gate.blockers.map((reason) => blocker(releaseId, gate.gateId, reason, `Resolve ${gate.name} at ${gate.route}.`, gate.status === 'blocked' ? 'critical' : 'blocking')));
  const warnings = gates.flatMap((gate) => gate.warnings.map((reason) => warning(releaseId, gate.gateId, reason, `Review ${gate.name} warning at ${gate.route}.`)));
  return { gates, blockers, warnings };
}

function checklistFrom(release: Pick<GoLiveReleaseDecision, 'releaseWindow' | 'approvedBy' | 'rollbackPlanStatus' | 'evidencePackStatus'>, gates: GoLiveReadinessGate[]): GoLiveEvidenceChecklistItem[] {
  return [
    {
      id: 'checklist-all-gates',
      label: 'All readiness gates verified',
      status: gates.every((gate) => gate.status === 'verified') ? 'complete' : 'missing',
      evidence: gates.map((gate) => `${gate.gateId}:${gate.status}`),
      required: true,
    },
    {
      id: 'checklist-release-approver',
      label: 'Release approver assigned',
      status: release.approvedBy ? 'complete' : 'missing',
      evidence: release.approvedBy ? [release.approvedBy] : [],
      required: true,
    },
    {
      id: 'checklist-release-window',
      label: 'Release window scheduled',
      status: release.releaseWindow ? 'complete' : 'missing',
      evidence: release.releaseWindow ? [`${release.releaseWindow.start} - ${release.releaseWindow.end}`] : [],
      required: true,
    },
    {
      id: 'checklist-rollback-plan',
      label: 'Rollback plan verified',
      status: release.rollbackPlanStatus === 'verified' || release.rollbackPlanStatus === 'triggered' ? 'complete' : 'missing',
      evidence: [release.rollbackPlanStatus],
      required: true,
    },
    {
      id: 'checklist-evidence-pack',
      label: 'Final go-live pack exported',
      status: release.evidencePackStatus === 'exported' ? 'complete' : 'warning',
      evidence: [release.evidencePackStatus],
      required: false,
    },
  ];
}

function applyReadiness(release: GoLiveReleaseDecision): GoLiveReleaseDecision {
  const matrix = buildMatrix(release.releaseId);
  let blockers = matrix.blockers;
  const warnings = matrix.warnings;
  let checklist = checklistFrom(release, matrix.gates);

  if (!release.approvedBy && release.state !== 'waiting_approval' && release.state !== 'approved' && release.state !== 'released' && release.state !== 'rolled_back') {
    blockers = [...blockers, blocker(release.releaseId, 'release-approval', 'Release approver is missing.', 'Request go-live approval from an authorized release approver.')];
  }
  if (!release.releaseWindow) {
    blockers = [...blockers, blocker(release.releaseId, 'release-window', 'Release window is missing.', 'Set a release window before requesting go-live approval.')];
  }
  if (release.rollbackPlanStatus === 'missing') {
    blockers = [...blockers, blocker(release.releaseId, 'rollback-plan', 'Rollback plan is missing.', 'Verify rollback plan before requesting go-live approval.')];
  }
  checklist = checklistFrom(release, matrix.gates);
  const readinessScore = calculateGoLiveReadinessScore(matrix.gates, checklist);
  const finalVerdict: GoLiveFinalVerdict = deriveGoLiveVerdict({
    state: release.state,
    blockers,
    warnings,
    readinessScore,
    approvedBy: release.approvedBy,
  });

  return {
    ...release,
    finalVerdict,
    readinessScore,
    blockerCount: blockers.length,
    warningCount: warnings.length,
    productionConfigStatus: matrix.gates.find((gate) => gate.gateId === 'production-config-evidence')?.status ?? 'not_checked',
    backendStatus: matrix.gates.find((gate) => gate.gateId === 'backend-readiness')?.status ?? 'not_checked',
    databaseStatus: matrix.gates.find((gate) => gate.gateId === 'database-readiness')?.status ?? 'not_checked',
    authStatus: matrix.gates.find((gate) => gate.gateId === 'auth-readiness')?.status ?? 'not_checked',
    environmentStatus: matrix.gates.find((gate) => gate.gateId === 'environment-readiness')?.status ?? 'not_checked',
    observabilityStatus: matrix.gates.find((gate) => gate.gateId === 'production-observability')?.status ?? 'not_checked',
    certifiedSandboxStatus: matrix.gates.find((gate) => gate.gateId === 'certified-sandbox-run')?.status ?? 'not_checked',
    runtimeCertificationStatus: matrix.gates.find((gate) => gate.gateId === 'runtime-certification')?.status ?? 'not_checked',
    readinessMatrix: matrix.gates,
    blockers,
    warnings,
    evidenceChecklist: checklist,
    goLiveChecklistStatus: checklist.every((item) => item.required ? item.status === 'complete' : true) ? 'complete' : checklist.some((item) => item.status === 'warning') ? 'warning' : 'missing',
    updatedAt: nowIso(),
  };
}

function persistRelease(release: GoLiveReleaseDecision): GoLiveReleaseDecision {
  const state = readState();
  const updated = applyReadiness({ ...release, updatedAt: nowIso() });
  writeState({
    ...state,
    releases: [updated, ...state.releases.filter((entry) => entry.releaseId !== updated.releaseId)].slice(0, 20),
    activeReleaseId: updated.releaseId,
  });
  return clone(updated);
}

function activeRelease(): GoLiveReleaseDecision {
  const state = readState();
  const existing = state.activeReleaseId ? state.releases.find((release) => release.releaseId === state.activeReleaseId) : state.releases[0];
  return existing ? clone(existing) : createReleaseCandidate();
}

function resolveRelease(releaseId?: string): GoLiveReleaseDecision {
  if (!releaseId) return activeRelease();
  const found = readState().releases.find((release) => release.releaseId === releaseId);
  return found ? clone(found) : activeRelease();
}

export function getGoLiveControlState(): GoLiveControlState {
  return clone(readState());
}

export function clearGoLiveControlStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(GO_LIVE_CONTROL_KEY);
}

export function createReleaseCandidate(input: { version?: string; commitHash?: string; releaseCandidate?: string } = {}): GoLiveReleaseDecision {
  const createdAt = nowIso();
  const release: GoLiveReleaseDecision = {
    releaseId: unique('go-live-release'),
    environment: 'PRODUCTION',
    version: input.version ?? '9H.0.0',
    commitHash: input.commitHash ?? 'local',
    releaseCandidate: input.releaseCandidate ?? `GrowthOS ${input.version ?? '9H.0.0'} release candidate`,
    state: 'draft',
    finalVerdict: 'BLOCKED',
    readinessScore: 0,
    blockerCount: 0,
    warningCount: 0,
    rollbackPlanStatus: 'missing',
    evidencePackStatus: 'missing',
    goLiveChecklistStatus: 'missing',
    productionConfigStatus: 'not_checked',
    backendStatus: 'not_checked',
    databaseStatus: 'not_checked',
    authStatus: 'not_checked',
    environmentStatus: 'not_checked',
    observabilityStatus: 'not_checked',
    certifiedSandboxStatus: 'not_checked',
    runtimeCertificationStatus: 'not_checked',
    readinessMatrix: [],
    blockers: [],
    warnings: [],
    evidenceChecklist: [],
    timeline: [timeline('pending', 'release.created', 'Release candidate created.')],
    createdAt,
    updatedAt: createdAt,
  };
  release.timeline = [timeline(release.releaseId, 'release.created', `Release candidate ${release.version} created.`)];
  return persistRelease(release);
}

export function refreshReadiness(releaseId?: string): GoLiveReleaseDecision {
  const release = resolveRelease(releaseId);
  return persistRelease({
    ...release,
    state: release.blockers.length ? 'blocked' : release.state === 'draft' ? 'waiting_evidence' : release.state,
    timeline: [timeline(release.releaseId, 'readiness.refreshed', 'Go-live readiness refreshed.'), ...release.timeline],
  });
}

export function setReleaseWindow(releaseId?: string, window = { start: '2026-06-05T02:00:00.000Z', end: '2026-06-05T03:00:00.000Z' }): GoLiveReleaseDecision {
  const release = resolveRelease(releaseId);
  return persistRelease({ ...release, releaseWindow: window, timeline: [timeline(release.releaseId, 'window.set', 'Release window scheduled.', window), ...release.timeline] });
}

export function verifyRollbackPlan(releaseId?: string): GoLiveReleaseDecision {
  const release = resolveRelease(releaseId);
  return persistRelease({ ...release, rollbackPlanStatus: 'verified', timeline: [timeline(release.releaseId, 'rollback.verified', 'Rollback plan verified.'), ...release.timeline] });
}

export function requestGoLiveApproval(releaseId?: string, approver = 'Release Captain'): GoLiveReleaseDecision {
  const release = resolveRelease(releaseId);
  const withApprover = { ...release, approvedBy: approver };
  const evaluated = applyReadiness(withApprover);
  const state: GoLiveDecisionState = evaluated.blockers.length ? 'blocked' : 'waiting_approval';
  return persistRelease({ ...evaluated, state, timeline: [timeline(release.releaseId, 'approval.requested', `Go-live approval requested from ${approver}.`), ...release.timeline] });
}

export function approveGoLive(releaseId?: string, approvedBy = 'GrowthOS Release Approver'): GoLiveReleaseDecision {
  const release = resolveRelease(releaseId);
  const evaluated = applyReadiness({ ...release, approvedBy });
  if (evaluated.blockers.length) return persistRelease({ ...evaluated, state: 'blocked' });
  return persistRelease({
    ...evaluated,
    state: 'approved',
    approvedBy,
    approvalTimestamp: nowIso(),
    timeline: [timeline(release.releaseId, 'approval.approved', `Go-live approved by ${approvedBy}.`), ...release.timeline],
  });
}

export function rejectGoLive(releaseId?: string, reason = 'Go-live rejected by release approver.'): GoLiveReleaseDecision {
  const release = resolveRelease(releaseId);
  return persistRelease({
    ...release,
    state: 'rejected',
    rejectedBy: 'Release Approver',
    rejectedReason: reason,
    timeline: [timeline(release.releaseId, 'approval.rejected', reason), ...release.timeline],
  });
}

export function markReleased(releaseId?: string): GoLiveReleaseDecision {
  const release = resolveRelease(releaseId);
  const evaluated = applyReadiness(release);
  if (evaluated.state !== 'approved' || evaluated.blockers.length) return persistRelease({ ...evaluated, state: evaluated.blockers.length ? 'blocked' : evaluated.state });
  return persistRelease({
    ...evaluated,
    state: 'released',
    finalVerdict: 'GO',
    timeline: [timeline(release.releaseId, 'release.released', 'Production release marked released.'), ...release.timeline],
  });
}

export function triggerRollback(releaseId?: string): GoLiveReleaseDecision {
  const release = resolveRelease(releaseId);
  if (release.state !== 'released') return persistRelease({ ...release, timeline: [timeline(release.releaseId, 'release.rolled_back', 'Rollback requested before release and held for review.'), ...release.timeline] });
  return persistRelease({
    ...release,
    state: 'rolled_back',
    rollbackPlanStatus: 'triggered',
    timeline: [timeline(release.releaseId, 'release.rolled_back', 'Rollback triggered after production release.'), ...release.timeline],
  });
}

function exportedArtifact(name: string, type: ArtifactRecord['type'], content: unknown): ArtifactRecord {
  const createdAt = nowIso();
  return registerArtifact({
    id: `artifact-go-live-control-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    name,
    type,
    lifecycle: 'AVAILABLE',
    workspaceId: demoWorkspace.id,
    version: 1,
    metadata: {
      workspaceId: demoWorkspace.id,
      source: 'mock',
      sourceType: 'go-live-control',
      contentSummary: `${name} generated by go-live control center. Raw secrets are excluded.`,
      tags: ['go-live', 'release-control', 'production-readiness'],
      sizeBytes: JSON.stringify(content).length,
    },
    createdAt,
    updatedAt: createdAt,
  });
}

export function exportGoLivePack(releaseId?: string): ArtifactRecord[] {
  const release = refreshReadiness(releaseId);
  const artifacts = [
    exportedArtifact('go-live-final-verdict.md', 'REPORT', { verdict: release.finalVerdict, state: release.state }),
    exportedArtifact('go-live-control-report.md', 'REPORT', release),
    exportedArtifact('go-live-readiness-matrix.json', 'AUDIT', release.readinessMatrix),
    exportedArtifact('go-live-blockers.json', 'AUDIT', release.blockers),
    exportedArtifact('go-live-approval-record.md', 'REPORT', { approvedBy: release.approvedBy, approvalTimestamp: release.approvalTimestamp, state: release.state }),
    exportedArtifact('go-live-release-checklist.md', 'REPORT', release.evidenceChecklist),
    exportedArtifact('go-live-rollback-plan.md', 'REPORT', { rollbackPlanStatus: release.rollbackPlanStatus }),
    exportedArtifact('go-live-pack.zip.md', 'EXPORT', { note: 'Markdown placeholder for go-live pack archive.', releaseId: release.releaseId }),
  ];
  const state = readState();
  const updatedRelease = { ...release, evidencePackStatus: 'exported' as const, timeline: [timeline(release.releaseId, 'pack.exported', 'Final go-live pack exported.'), ...release.timeline] };
  const evaluated = applyReadiness(updatedRelease);
  writeState({
    ...state,
    artifacts,
    releases: [evaluated, ...state.releases.filter((entry) => entry.releaseId !== release.releaseId)],
    activeReleaseId: release.releaseId,
  });
  return clone(artifacts);
}

export function copyReleaseSummary(releaseId?: string): string {
  const release = selectGoLiveControl(releaseId);
  const summary = `Release ${release.version}: ${release.finalVerdict}, ${release.blockerCount} blocker(s), ${release.warningCount} warning(s), approval ${release.approvedBy ?? 'missing'}.`;
  const state = readState();
  const updatedRelease = { ...release, timeline: [timeline(release.releaseId, 'summary.copied', 'Release summary copied to control state.'), ...release.timeline] };
  writeState({
    ...state,
    copiedSummary: summary,
    releases: [updatedRelease, ...state.releases.filter((entry) => entry.releaseId !== release.releaseId)],
    activeReleaseId: release.releaseId,
  });
  return summary;
}

export function selectGoLiveControl(releaseId?: string): GoLiveControlDashboard {
  const release = resolveRelease(releaseId);
  const evaluated = applyReadiness(release);
  return clone({
    ...evaluated,
    canApprove: evaluated.state === 'waiting_approval' && evaluated.blockers.length === 0,
    canMarkReleased: evaluated.state === 'approved' && evaluated.blockers.length === 0,
    canTriggerRollback: evaluated.state === 'released',
  });
}

export function selectGoLiveVerdict(): GoLiveFinalVerdict {
  return selectGoLiveControl().finalVerdict;
}

export function selectGoLiveReadinessMatrix(): GoLiveReadinessGate[] {
  return selectGoLiveControl().readinessMatrix;
}

export function selectGoLiveBlockers(): GoLiveBlocker[] {
  return selectGoLiveControl().blockers;
}

export function selectGoLiveWarnings(): GoLiveWarning[] {
  return selectGoLiveControl().warnings;
}

export function selectGoLiveEvidenceChecklist(): GoLiveEvidenceChecklistItem[] {
  return selectGoLiveControl().evidenceChecklist;
}

export function selectGoLiveApprovalStatus() {
  const release = selectGoLiveControl();
  return { state: release.state, approvedBy: release.approvedBy, approvalTimestamp: release.approvalTimestamp, rejectedReason: release.rejectedReason };
}

export function selectGoLiveRollbackStatus() {
  return selectGoLiveControl().rollbackPlanStatus;
}

export function selectGoLiveReleaseWindow() {
  return selectGoLiveControl().releaseWindow;
}

export function selectGoLiveTimeline(): GoLiveTimelineEvent[] {
  return selectGoLiveControl().timeline;
}

export function selectGoLivePackArtifacts(): ArtifactRecord[] {
  return clone(readState().artifacts);
}

export function selectCanApproveGoLive(): boolean {
  return selectGoLiveControl().canApprove;
}

export function selectCanMarkReleased(): boolean {
  return selectGoLiveControl().canMarkReleased;
}

export function selectCanTriggerRollback(): boolean {
  return selectGoLiveControl().canTriggerRollback;
}
