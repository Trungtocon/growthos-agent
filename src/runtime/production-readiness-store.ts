import { DEMO_RUN_ID, demoWorkspace } from '../data/demo-fixtures';
import type { Artifact } from '../domain/types';
import { getBillingLedger, getQuotaReports, getUsageByRun } from '../runtime-store/usage-ledger-store';
import { getApprovalExecutionSummary } from './approval-execution-store';
import { buildExecutionGraphForRun, getGraphSummary } from './agent-execution-graph-store';
import { registerArtifact, searchArtifacts } from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import { getAuthorizationAuditSummary } from './authorization-audit-store';
import { getCertifiedSandboxRunDashboard, getCertifiedSandboxRuns } from './certified-sandbox-run-store';
import { getChaosDashboard } from './chaos-simulation-store';
import { getReconciliationReport } from './cost-reconciliation-store';
import { getEvaluationFeedbackByRun, generateWorkspaceFeedbackSummary } from './evaluation-feedback-store';
import { getReplayControlState } from './execution-replay-control-store';
import { buildTimelineForRun, getReplayFrames, getTimelineSummary } from './execution-timeline-store';
import { getGovernanceReadinessReport } from './governance-readiness-store';
import { getWorkspaceImprovementLoopSummary } from './improvement-loop-store';
import { getLearningMemorySummary } from './learning-memory-store';
import { getRbacSummary } from './rbac-store';
import { getRunEvaluation } from './run-evaluation-store';
import { getRuntimeCertificationDashboard } from './runtime-certification-store';
import { getWorkerObservationDashboard } from './worker-observability-store';
import { getWorkerRecoveryDashboard } from './worker-recovery-store';
import type {
  ProductionReadinessBlocker,
  ProductionReadinessBlockerCode,
  ProductionReadinessCategory,
  ProductionReadinessCheck,
  ProductionReadinessChecklistItem,
  ProductionReadinessDashboard,
  ProductionReadinessStatus,
  ProductionReadinessWarning,
} from './production-readiness';

const PRODUCTION_READINESS_KEY = 'uikigai-production-readiness-v1';

interface ProductionReadinessState {
  checks: Record<string, ProductionReadinessCheck>;
  activeCheckId?: string;
  artifacts: Record<string, ArtifactRecord>;
  updatedAt: string;
}

const CATEGORY_LABELS: Record<ProductionReadinessCategory, string> = {
  certified_sandbox_run: 'Certified Sandbox Run',
  runtime_certification: 'Runtime Certification',
  governance_exit_gate: 'Governance Exit Gate',
  approval_execution: 'Approval Execution',
  artifact_registry: 'Artifact Registry',
  execution_graph: 'Execution Graph',
  execution_timeline: 'Execution Timeline',
  replay_control: 'Replay Control',
  run_evaluation: 'Run Evaluation',
  feedback_loop: 'Feedback Loop',
  learning_memory: 'Learning Memory',
  improvement_loop: 'Improvement Loop',
  worker_observability: 'Worker Observability',
  worker_recovery: 'Worker Recovery',
  chaos_simulation: 'Chaos Simulation',
  cost_reconciliation: 'Cost Reconciliation',
  usage_ledger: 'Usage Ledger',
  rbacs_and_authorization_audit: 'RBAC & Authorization Audit',
  environment_config: 'Environment Config',
  ui_action_wiring: 'UI Action Wiring',
};

export const PRODUCTION_READINESS_CATEGORIES = Object.keys(CATEGORY_LABELS) as ProductionReadinessCategory[];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyState(): ProductionReadinessState {
  return { checks: {}, artifacts: {}, updatedAt: nowIso() };
}

function readState(): ProductionReadinessState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(PRODUCTION_READINESS_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ProductionReadinessState>;
    return {
      checks: parsed.checks ?? {},
      activeCheckId: parsed.activeCheckId,
      artifacts: parsed.artifacts ?? {},
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: ProductionReadinessState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PRODUCTION_READINESS_KEY, JSON.stringify({ ...state, updatedAt: nowIso() }));
}

function persistCheck(check: ProductionReadinessCheck): ProductionReadinessCheck {
  const state = readState();
  const updated = { ...check, updatedAt: nowIso() };
  writeState({ ...state, checks: { ...state.checks, [updated.id]: updated }, activeCheckId: updated.id });
  return clone(updated);
}

function item(
  checkId: string,
  category: ProductionReadinessCategory,
  status: ProductionReadinessStatus,
  reason: string,
  recommendedFix: string,
  evidence: string[] = [],
  required = true,
): ProductionReadinessChecklistItem {
  return {
    id: `production-readiness-item-${checkId}-${category}`,
    category,
    label: CATEGORY_LABELS[category],
    required,
    status,
    reason,
    recommendedFix,
    evidence,
    evidenceCount: evidence.length,
    updatedAt: nowIso(),
  };
}

function blocker(
  checkId: string,
  category: ProductionReadinessCategory,
  code: ProductionReadinessBlockerCode,
  reason: string,
  recommendedFix: string,
): ProductionReadinessBlocker {
  return { id: `production-readiness-blocker-${checkId}-${code}-${category}`, checkId, category, code, reason, recommendedFix, severity: 'blocking', createdAt: nowIso() };
}

function warning(checkId: string, category: ProductionReadinessCategory, reason: string, recommendedFix: string): ProductionReadinessWarning {
  return { id: `production-readiness-warning-${checkId}-${category}-${Date.now()}`, checkId, category, reason, recommendedFix, createdAt: nowIso() };
}

function statusFromItems(items: ProductionReadinessChecklistItem[], blockers: ProductionReadinessBlocker[], warnings: ProductionReadinessWarning[]): ProductionReadinessStatus {
  if (blockers.length || items.some((entry) => entry.required && entry.status === 'BLOCKED')) return 'BLOCKED';
  if (warnings.length || items.some((entry) => entry.status === 'WARNING' || entry.status === 'NEEDS_REVIEW')) return 'NEEDS_REVIEW';
  if (items.every((entry) => entry.status === 'READY')) return 'READY';
  return 'NOT_CHECKED';
}

function latestRuntimeCertificationRun() {
  return getRuntimeCertificationDashboard().runs.find((run) => run.status === 'certified' || run.status === 'passed');
}

function latestCompletedCertifiedSandboxRun() {
  return getCertifiedSandboxRuns().find((run) => run.status === 'completed');
}

function environmentWarningReason() {
  const env = import.meta.env as Record<string, string | undefined>;
  const productionConfigured = Boolean(env.VITE_PRODUCTION_BASE_URL || env.VITE_HERMES_PRODUCTION_BASE_URL || env.VITE_PAPERCLIP_PRODUCTION_BASE_URL);
  return productionConfigured ? undefined : 'Production endpoint is not configured in frontend env. Keep go-live in review mode until backend deployment config exists.';
}

function buildReadinessEvidence(checkId: string): {
  items: ProductionReadinessChecklistItem[];
  blockers: ProductionReadinessBlocker[];
  warnings: ProductionReadinessWarning[];
  lastCertifiedSandboxRunId?: string;
  lastRuntimeCertificationRunId?: string;
  summaries: Pick<ProductionReadinessDashboard, 'chaosRecoverySummary' | 'workerRecoverySummary' | 'costQuotaSummary' | 'approvalSummary'>;
} {
  const items: ProductionReadinessChecklistItem[] = [];
  const blockers: ProductionReadinessBlocker[] = [];
  const warnings: ProductionReadinessWarning[] = [];
  const certified = getCertifiedSandboxRunDashboard();
  const completedSandbox = latestCompletedCertifiedSandboxRun();
  const runtime = getRuntimeCertificationDashboard();
  const runtimeRun = latestRuntimeCertificationRun();
  const governance = getGovernanceReadinessReport();
  const approvals = getApprovalExecutionSummary();
  const registryArtifacts = searchArtifacts();
  const graphSummary = getGraphSummary(demoWorkspace.id);
  const timelineSummary = getTimelineSummary(demoWorkspace.id);
  const replay = getReplayControlState();
  const evaluation = getRunEvaluation(DEMO_RUN_ID);
  const feedback = getEvaluationFeedbackByRun(DEMO_RUN_ID);
  const feedbackSummary = generateWorkspaceFeedbackSummary(demoWorkspace.id);
  const learning = getLearningMemorySummary(demoWorkspace.id);
  const loopSummary = getWorkspaceImprovementLoopSummary();
  const worker = getWorkerObservationDashboard();
  const recovery = getWorkerRecoveryDashboard();
  const chaos = getChaosDashboard();
  const cost = getReconciliationReport();
  const usage = getUsageByRun(DEMO_RUN_ID);
  const ledger = getBillingLedger(DEMO_RUN_ID);
  const quotaReports = getQuotaReports();
  const rbac = getRbacSummary();
  const auth = getAuthorizationAuditSummary();
  const envWarning = environmentWarningReason();

  if (!completedSandbox) {
    blockers.push(blocker(checkId, 'certified_sandbox_run', 'sandbox_not_certified', 'No completed certified sandbox run exists.', 'Create, start, and complete a certified sandbox run before production go-live.'));
    items.push(item(checkId, 'certified_sandbox_run', 'BLOCKED', 'Certified sandbox completion is missing.', 'Complete `/certified-sandbox-run`.', certified.runs.map((run) => `${run.id}:${run.status}`)));
  } else {
    items.push(item(checkId, 'certified_sandbox_run', 'READY', `Completed certified sandbox run ${completedSandbox.id}.`, 'Keep final sandbox artifacts attached to the go-live packet.', [completedSandbox.id]));
  }

  if (!runtimeRun) {
    blockers.push(blocker(checkId, 'runtime_certification', 'runtime_not_certified', `Runtime certification status is ${runtime.status}.`, 'Run and certify `/runtime-certification` before go-live.'));
    items.push(item(checkId, 'runtime_certification', 'BLOCKED', `Runtime certification status is ${runtime.status}.`, 'Certify runtime contracts.', runtime.runs.map((run) => `${run.id}:${run.status}`)));
  } else {
    items.push(item(checkId, 'runtime_certification', 'READY', `Runtime certification ${runtimeRun.id} is ${runtimeRun.status}.`, 'Keep runtime certification artifacts attached.', [runtimeRun.id]));
  }

  if (governance.blockedReasons.length) {
    blockers.push(...governance.blockedReasons.map((reason) => blocker(checkId, 'governance_exit_gate', 'unresolved_governance_blocker', reason, 'Resolve governance exit gate blocker before go-live.')));
    items.push(item(checkId, 'governance_exit_gate', 'BLOCKED', `${governance.blockedReasons.length} governance blocker(s).`, 'Resolve governance readiness blockers.', governance.blockedReasons));
  } else {
    if (governance.warnings.length) warnings.push(...governance.warnings.map((reason) => warning(checkId, 'governance_exit_gate', reason, 'Review governance warning before final approval.')));
    items.push(item(checkId, 'governance_exit_gate', governance.warnings.length ? 'WARNING' : 'READY', governance.warnings.length ? `${governance.warnings.length} governance warning(s).` : 'Governance exit gate has no blockers.', 'Review warnings or proceed.', governance.readyModules));
  }

  if (certified.activeRun?.approvalRequired && !certified.activeRun.approvalApproved) {
    blockers.push(blocker(checkId, 'approval_execution', 'unresolved_approval_hold', 'Certified sandbox approval hold is unresolved.', 'Approve or reject the certified sandbox hold before go-live.'));
    items.push(item(checkId, 'approval_execution', 'BLOCKED', 'Approval hold is unresolved.', 'Resolve approval hold.', [certified.activeRun.id]));
  } else {
    items.push(item(checkId, 'approval_execution', approvals.totalRequests ? 'READY' : 'WARNING', approvals.totalRequests ? `${approvals.totalRequests} approval request(s) processed.` : 'No approval execution evidence recorded in this session.', 'Generate approval evidence for final audit if required.', [`approved:${approvals.approved}`, `rejected:${approvals.rejected}`]));
  }

  if (!registryArtifacts.length) {
    blockers.push(blocker(checkId, 'artifact_registry', 'failed_artifact_registry', 'Artifact Registry has no registered evidence.', 'Run certified sandbox export or registry smoke before go-live.'));
    items.push(item(checkId, 'artifact_registry', 'BLOCKED', 'No artifact records are registered.', 'Register runtime and go-live artifacts.', []));
  } else {
    items.push(item(checkId, 'artifact_registry', 'READY', `${registryArtifacts.length} artifact registry record(s).`, 'Keep registry health report attached.', registryArtifacts.slice(0, 8).map((artifact) => artifact.name)));
  }

  const replayFrames = getReplayFrames(DEMO_RUN_ID);
  items.push(item(checkId, 'execution_graph', graphSummary.nodeCount ? 'READY' : 'WARNING', graphSummary.nodeCount ? `${graphSummary.nodeCount} graph node(s).` : 'Execution graph has no snapshot yet.', 'Build graph evidence for target run.', [`nodes:${graphSummary.nodeCount}`, `edges:${graphSummary.edgeCount}`]));
  items.push(item(checkId, 'execution_timeline', timelineSummary.eventCount ? 'READY' : 'WARNING', timelineSummary.eventCount ? `${timelineSummary.eventCount} timeline event(s).` : 'Execution timeline has no events yet.', 'Build timeline evidence for target run.', [`events:${timelineSummary.eventCount}`]));
  items.push(item(checkId, 'replay_control', replayFrames.length ? 'READY' : 'WARNING', replayFrames.length ? `${replayFrames.length} replay frame(s).` : 'Replay frames are not initialized yet.', 'Open execution timeline and initialize replay frames.', [`speed:${replay.playbackSpeed}`, `frame:${replay.selectedFrameIndex}`]));
  items.push(item(checkId, 'run_evaluation', evaluation.overallScore > 0 ? 'READY' : 'WARNING', `Run evaluation overall score ${evaluation.overallScore}.`, 'Refresh run evaluation before go-live.', [`score:${evaluation.overallScore}`]));
  items.push(item(checkId, 'feedback_loop', feedback.suggestions.length || feedbackSummary.suggestionCount ? 'READY' : 'WARNING', feedback.suggestions.length ? `${feedback.suggestions.length} suggestion(s).` : 'Feedback suggestions are not generated yet.', 'Generate feedback and recommendations from latest run evaluation.', [`suggestions:${feedback.suggestions.length}`, `workspace:${feedbackSummary.suggestionCount}`]));
  items.push(item(checkId, 'learning_memory', learning.signalCount || learning.recommendationCount ? 'READY' : 'WARNING', `${learning.signalCount} signal(s), ${learning.recommendationCount} recommendation(s).`, 'Generate learning memory from outcome evidence.', [`signals:${learning.signalCount}`, `recommendations:${learning.recommendationCount}`]));
  items.push(item(checkId, 'improvement_loop', loopSummary.total ? 'READY' : 'WARNING', `${loopSummary.total} loop(s), ${loopSummary.active} active.`, 'Queue improvement loop evidence when autonomous loop is in scope.', [`loops:${loopSummary.total}`, `failed:${loopSummary.failed}`]));
  items.push(item(checkId, 'worker_observability', worker.observation.status !== 'idle' || worker.health.tickCount || worker.incidents.length ? 'READY' : 'WARNING', `Worker status ${worker.observation.status}, ${worker.health.tickCount} tick(s).`, 'Start worker observability before go-live.', [`incidents:${worker.incidents.length}`, `sla:${worker.health.slaStatus}`]));

  if (recovery.results.some((result) => result.status === 'failed')) {
    blockers.push(blocker(checkId, 'worker_recovery', 'failed_worker_recovery', 'Worker recovery has failed result(s).', 'Resolve failed recovery plan before production go-live.'));
    items.push(item(checkId, 'worker_recovery', 'BLOCKED', 'Failed worker recovery result found.', 'Resolve worker recovery failure.', recovery.results.map((result) => `${result.id}:${result.status}`)));
  } else {
    items.push(item(checkId, 'worker_recovery', recovery.readiness.ready ? 'READY' : 'WARNING', recovery.readiness.ready ? 'Worker recovery readiness is ready.' : recovery.readiness.blockedReasons.join('; ') || 'Worker recovery evidence is incomplete.', 'Create recovery evidence if warnings remain.', [`plans:${recovery.plans.length}`, `results:${recovery.results.length}`]));
  }

  if (chaos.runs.some((run) => run.status === 'failed') || chaos.scorecards.some((score) => score.score < 60)) {
    blockers.push(blocker(checkId, 'chaos_simulation', 'failed_chaos_recovery', 'Chaos simulation has failed or low-score recovery evidence.', 'Resolve chaos recovery failure before go-live.'));
    items.push(item(checkId, 'chaos_simulation', 'BLOCKED', 'Chaos recovery score failed.', 'Re-run chaos recovery and resolve blockers.', chaos.scorecards.map((score) => `${score.runId}:${score.score}`)));
  } else {
    items.push(item(checkId, 'chaos_simulation', chaos.scorecards.length ? 'READY' : 'WARNING', chaos.scorecards.length ? `${chaos.scorecards.length} chaos scorecard(s).` : 'No chaos recovery scorecard generated yet.', 'Run controlled chaos simulation before final signoff.', chaos.scorecards.map((score) => `${score.runId}:${score.score}`)));
  }

  items.push(item(checkId, 'cost_reconciliation', cost.records.length || cost.varianceHistory.length ? 'READY' : 'WARNING', cost.records.length ? `${cost.records.length} provider/runtime cost record(s).` : 'Cost reconciliation has no variance evidence yet.', 'Run cost reconciliation smoke or certified sandbox cost export.', [`variance:${cost.varianceHistory.length}`]));

  const exceededQuota = quotaReports.find((report) => report.status === 'exceeded');
  if (exceededQuota) {
    blockers.push(blocker(checkId, 'usage_ledger', 'cost_or_quota_policy_blocked', `Quota ${exceededQuota.targetId} is ${exceededQuota.status}.`, 'Increase quota, reduce run budget, or approve override before go-live.'));
    items.push(item(checkId, 'usage_ledger', 'BLOCKED', `Quota ${exceededQuota.targetId} blocks go-live.`, 'Resolve quota block.', [exceededQuota.targetId]));
  } else {
    items.push(item(checkId, 'usage_ledger', usage.length || ledger.records.length ? 'READY' : 'WARNING', usage.length ? `${usage.length} usage record(s).` : 'Usage ledger has no records for demo run yet.', 'Execute certified sandbox run to record usage.', [`actual:${ledger.actualTotal}`, `estimated:${ledger.estimatedTotal}`]));
  }

  items.push(item(checkId, 'rbacs_and_authorization_audit', rbac.roles.length && rbac.effectivePermissions.length ? 'READY' : 'BLOCKED', `${rbac.roles.length} role(s), ${auth.totalEvents} authorization audit event(s).`, 'Restore RBAC defaults and run authorization audit if missing.', [`roles:${rbac.roles.length}`, `permissions:${rbac.effectivePermissions.length}`, `auth:${auth.totalEvents}`]));
  if (!(rbac.roles.length && rbac.effectivePermissions.length)) blockers.push(blocker(checkId, 'rbacs_and_authorization_audit', 'unresolved_governance_blocker', 'RBAC roles or effective permissions are missing.', 'Restore RBAC defaults before production go-live.'));

  if (envWarning) {
    warnings.push(warning(checkId, 'environment_config', envWarning, 'Configure production endpoint secrets outside the frontend bundle before real go-live.'));
    items.push(item(checkId, 'environment_config', 'WARNING', envWarning, 'Configure production endpoint and secret injection in deployment environment.', ['mock/sandbox fallback active']));
  } else {
    items.push(item(checkId, 'environment_config', 'READY', 'Production endpoint configuration marker exists.', 'Verify secrets are injected by deployment platform.', ['production env marker present']));
  }

  items.push(item(checkId, 'ui_action_wiring', 'READY', 'Sprint 8U.1 UI action wiring smoke gate covers visible actions.', 'Continue running smoke:ui-action-wiring before release.', ['smoke:ui-action-wiring']));

  return {
    items,
    blockers,
    warnings,
    lastCertifiedSandboxRunId: completedSandbox?.id,
    lastRuntimeCertificationRunId: runtimeRun?.id,
    summaries: {
      chaosRecoverySummary: chaos.scorecards.length ? `${chaos.scorecards.length} scorecard(s), latest ${chaos.scorecards[0]?.score ?? 'n/a'}/100` : 'No chaos scorecard yet.',
      workerRecoverySummary: `${recovery.plans.length} plan(s), ${recovery.results.length} result(s).`,
      costQuotaSummary: `${usage.length} usage record(s), ledger actual $${ledger.actualTotal.toFixed(4)}, quota reports ${quotaReports.length}.`,
      approvalSummary: `${approvals.totalRequests} approval request(s), ${approvals.approved} approved, ${approvals.rejected} rejected.`,
    },
  };
}

export function createProductionReadinessCheck(input: { workspaceId?: string } = {}): ProductionReadinessCheck {
  const timestamp = nowIso();
  const check: ProductionReadinessCheck = {
    id: unique('production-readiness-check'),
    workspaceId: input.workspaceId ?? demoWorkspace.id,
    status: 'NOT_CHECKED',
    approvalStatus: 'not_requested',
    checklist: PRODUCTION_READINESS_CATEGORIES.map((category) => item('draft', category, 'NOT_CHECKED', 'Not checked yet.', 'Run production readiness evaluation.', [])),
    blockers: [],
    warnings: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return persistCheck(check);
}

export function evaluateProductionReadiness(checkId?: string): ProductionReadinessCheck {
  const existing = checkId ? readState().checks[checkId] : getActiveProductionReadinessCheck() ?? createProductionReadinessCheck();
  if (!existing) throw new Error(`Cannot evaluate missing production readiness check: ${checkId}`);
  buildExecutionGraphForRun(DEMO_RUN_ID);
  buildTimelineForRun(DEMO_RUN_ID);
  const evidence = buildReadinessEvidence(existing.id);
  const status = statusFromItems(evidence.items, evidence.blockers, evidence.warnings);
  return persistCheck({
    ...existing,
    status,
    checklist: evidence.items,
    blockers: evidence.blockers,
    warnings: evidence.warnings,
    lastCertifiedSandboxRunId: evidence.lastCertifiedSandboxRunId,
    lastRuntimeCertificationRunId: evidence.lastRuntimeCertificationRunId,
    evaluatedAt: nowIso(),
  });
}

export function approveProductionGoLive(checkId: string, approvedBy = 'GrowthOS Operator'): ProductionReadinessCheck {
  const evaluated = evaluateProductionReadiness(checkId);
  if (evaluated.blockers.length) return persistCheck({ ...evaluated, approvalStatus: 'not_requested' });
  return persistCheck({ ...evaluated, approvalStatus: 'approved', approvedBy, approvedAt: nowIso(), rejectedReason: undefined, rejectedAt: undefined });
}

export function rejectProductionGoLive(checkId: string, reason = 'Go-live rejected by operator review.'): ProductionReadinessCheck {
  const existing = readState().checks[checkId] ?? evaluateProductionReadiness(checkId);
  return persistCheck({ ...existing, approvalStatus: 'rejected', rejectedReason: reason, rejectedAt: nowIso() });
}

function exportArtifact(id: string, name: string, contentText: string, type: Artifact['type'] = 'report'): Artifact {
  return { id, runId: DEMO_RUN_ID, type, name, source: 'mock', contentSummary: `Production readiness export for ${DEMO_RUN_ID}`, contentText, createdAt: nowIso() };
}

export function exportProductionReadinessArtifacts(checkId?: string): ArtifactRecord[] {
  const check = evaluateProductionReadiness(checkId);
  const artifacts = [
    exportArtifact(`artifact-${DEMO_RUN_ID}-production-readiness-report-md`, 'production-readiness-report.md', ['# Production Readiness Report', '', `Status: ${check.status}`, `Approval: ${check.approvalStatus}`, `Blockers: ${check.blockers.length}`, `Warnings: ${check.warnings.length}`, ''].join('\n'), 'markdown'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-production-readiness-json`, 'production-readiness.json', JSON.stringify(check, null, 2), 'json'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-go-live-checklist-md`, 'go-live-checklist.md', ['# Go-Live Checklist', '', ...check.checklist.map((entry) => `- [${entry.status === 'READY' ? 'x' : ' '}] ${entry.label}: ${entry.status} - ${entry.reason}`), ''].join('\n'), 'markdown'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-go-live-blockers-json`, 'go-live-blockers.json', JSON.stringify(check.blockers, null, 2), 'json'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-go-live-approval-summary-md`, 'go-live-approval-summary.md', ['# Go-Live Approval Summary', '', `Approval status: ${check.approvalStatus}`, `Approved by: ${check.approvedBy ?? '-'}`, `Rejected reason: ${check.rejectedReason ?? '-'}`, ''].join('\n'), 'markdown'),
  ];
  const records = artifacts.map((artifact) => registerArtifact(artifact, { type: artifact.name.endsWith('.json') ? 'AUDIT' : 'REPORT', metadata: { runId: DEMO_RUN_ID, workspaceId: demoWorkspace.id, tags: ['production-readiness', 'go-live'] } }));
  const state = readState();
  writeState({ ...state, artifacts: { ...state.artifacts, ...Object.fromEntries(records.map((record) => [record.id, record])) } });
  return records.map(clone);
}

export function getProductionReadinessChecks(): ProductionReadinessCheck[] {
  return Object.values(readState().checks).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone);
}

export function getActiveProductionReadinessCheck(): ProductionReadinessCheck | undefined {
  const state = readState();
  const active = state.activeCheckId ? state.checks[state.activeCheckId] : undefined;
  return active ? clone(active) : getProductionReadinessChecks()[0];
}

export function getProductionReadinessChecklist(checkId?: string): ProductionReadinessChecklistItem[] {
  const check = checkId ? readState().checks[checkId] : getActiveProductionReadinessCheck();
  return check ? clone(check.checklist) : [];
}

export function getProductionReadinessBlockers(checkId?: string): ProductionReadinessBlocker[] {
  const check = checkId ? readState().checks[checkId] : getActiveProductionReadinessCheck();
  return check ? clone(check.blockers) : [];
}

export function getProductionReadinessWarnings(checkId?: string): ProductionReadinessWarning[] {
  const check = checkId ? readState().checks[checkId] : getActiveProductionReadinessCheck();
  return check ? clone(check.warnings) : [];
}

export function getProductionReadinessStatus(checkId?: string): ProductionReadinessStatus {
  const check = checkId ? readState().checks[checkId] : getActiveProductionReadinessCheck();
  return check?.status ?? 'NOT_CHECKED';
}

export function getProductionReadinessDashboard(): ProductionReadinessDashboard {
  const active = getActiveProductionReadinessCheck();
  const check = active?.evaluatedAt ? active : active ? evaluateProductionReadiness(active.id) : evaluateProductionReadiness(createProductionReadinessCheck().id);
  const evidence = buildReadinessEvidence(check.id);
  return {
    checks: getProductionReadinessChecks(),
    activeCheck: check,
    status: check.status,
    blockers: check.blockers,
    warnings: check.warnings,
    checklist: check.checklist,
    lastCertifiedSandboxRunId: check.lastCertifiedSandboxRunId,
    lastRuntimeCertificationRunId: check.lastRuntimeCertificationRunId,
    chaosRecoverySummary: evidence.summaries.chaosRecoverySummary,
    workerRecoverySummary: evidence.summaries.workerRecoverySummary,
    costQuotaSummary: evidence.summaries.costQuotaSummary,
    approvalSummary: evidence.summaries.approvalSummary,
    artifacts: Object.values(readState().artifacts).map(clone),
  };
}

export function clearProductionReadinessStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PRODUCTION_READINESS_KEY);
}
