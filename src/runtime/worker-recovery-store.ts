import { DEMO_RUN_ID } from '../data/demo-fixtures';
import type { Artifact } from '../domain/types';
import type { ArtifactRecord } from './artifact-registry';
import { registerArtifact } from './artifact-registry-store';
import {
  getWorkerIncidents,
  requestWorkerExportDiagnostics,
  requestWorkerKill,
  requestWorkerRequeueItem,
  requestWorkerRetryNow,
  requestWorkerSkipItem,
  requestWorkerEscalateToApproval,
} from './worker-observability-store';
import type { WorkerIncident } from './worker-observability';
import {
  recoverStaleWorker,
  startImprovementLoopWorker,
  stopImprovementLoopWorker,
} from './improvement-loop-worker-store';
import {
  type AutoHealingDecision,
  type WorkerRecoveryAction,
  type WorkerRecoveryAttempt,
  type WorkerRecoveryDashboard,
  type WorkerRecoveryIncidentLink,
  type WorkerRecoveryPlan,
  type WorkerRecoveryPolicy,
  type WorkerRecoveryReadiness,
  type WorkerRecoveryReason,
  type WorkerRecoveryResult,
  type WorkerRecoveryRisk,
  type WorkerRecoveryStep,
} from './worker-recovery';

const WORKER_RECOVERY_STORAGE_KEY = 'uikigai-worker-recovery-v1';

interface WorkerRecoveryStoreState {
  recoveryPlans: Record<string, WorkerRecoveryPlan>;
  recoveryAttempts: Record<string, WorkerRecoveryAttempt>;
  recoveryResults: Record<string, WorkerRecoveryResult>;
  autoHealingDecisions: Record<string, AutoHealingDecision>;
  incidentRecoveryLinks: Record<string, WorkerRecoveryIncidentLink>;
  recoveryArtifacts: Record<string, string>;
  updatedAt: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyState(): WorkerRecoveryStoreState {
  return {
    recoveryPlans: {},
    recoveryAttempts: {},
    recoveryResults: {},
    autoHealingDecisions: {},
    incidentRecoveryLinks: {},
    recoveryArtifacts: {},
    updatedAt: nowIso(),
  };
}

function readState(): WorkerRecoveryStoreState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(WORKER_RECOVERY_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<WorkerRecoveryStoreState>;
    return {
      recoveryPlans: parsed.recoveryPlans ?? {},
      recoveryAttempts: parsed.recoveryAttempts ?? {},
      recoveryResults: parsed.recoveryResults ?? {},
      autoHealingDecisions: parsed.autoHealingDecisions ?? {},
      incidentRecoveryLinks: parsed.incidentRecoveryLinks ?? {},
      recoveryArtifacts: parsed.recoveryArtifacts ?? {},
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: WorkerRecoveryStoreState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(WORKER_RECOVERY_STORAGE_KEY, JSON.stringify(state));
}

function normalizeIncidentReason(incident: WorkerIncident): WorkerRecoveryReason {
  if (incident.reason === 'stale_worker') return 'stale_worker';
  if (incident.reason === 'retry_exhausted') return 'retry_exhausted';
  if (incident.reason === 'governance_block' || incident.reason === 'governance_denied') return 'governance_blocked';
  if (incident.reason === 'approval_required') return 'approval_timeout';
  if (incident.reason === 'execution_failed') return 'queue_item_failed';
  if (incident.reason === 'queue_empty') return 'unknown_runtime_error';
  return 'unknown_runtime_error';
}

function riskFromIncident(incident: WorkerIncident, reason: WorkerRecoveryReason): WorkerRecoveryRisk {
  if (incident.severity === 'critical' || reason === 'retry_exhausted' || reason === 'governance_blocked') return 'critical';
  if (reason === 'approval_timeout' || reason === 'sla_breach') return 'high';
  if (incident.severity === 'warning' || reason === 'queue_item_failed') return 'medium';
  return 'low';
}

function riskRank(risk: WorkerRecoveryRisk): number {
  if (risk === 'critical') return 4;
  if (risk === 'high') return 3;
  if (risk === 'medium') return 2;
  return 1;
}

function policiesForRisk(risk: WorkerRecoveryRisk): WorkerRecoveryPolicy[] {
  const requiresApproval = risk !== 'low';
  return [
    {
      id: 'auto_heal_low_risk_only',
      name: 'Auto-heal low-risk recovery only',
      risk,
      autoExecutable: risk === 'low',
      requiresApproval,
      requiresReason: false,
      message: risk === 'low' ? 'Low-risk recovery may run automatically.' : 'Medium, high, and critical recovery require governance approval.',
    },
    {
      id: 'destructive_actions_require_reason',
      name: 'Destructive actions require reason',
      risk,
      autoExecutable: false,
      requiresApproval: requiresApproval || riskRank(risk) >= 3,
      requiresReason: true,
      message: 'Kill, rollback, skip, and unrecoverable actions must carry an operator reason.',
    },
  ];
}

function step(id: string, order: number, action: WorkerRecoveryAction, label: string, risk: WorkerRecoveryRisk, requiresReason = false): WorkerRecoveryStep {
  const requiresApproval = risk !== 'low' || action === 'kill_worker' || action === 'rollback_last_action' || action === 'skip_item';
  return { id, order, action, label, status: 'pending', risk, requiresApproval, requiresReason };
}

function stepsForIncident(reason: WorkerRecoveryReason, risk: WorkerRecoveryRisk): WorkerRecoveryStep[] {
  if (reason === 'stale_worker' || reason === 'heartbeat_missing' || reason === 'sla_breach') {
    return [
      step('restart-worker', 1, 'restart_worker', 'Restart worker and recover heartbeat.', risk),
      step('export-diagnostics', 2, 'export_diagnostics', 'Export worker diagnostics after restart.', risk),
    ];
  }
  if (reason === 'queue_item_failed' || reason === 'tool_failure' || reason === 'artifact_generation_failed') {
    return [
      step('retry-current-item', 1, 'retry_current_item', 'Retry the active failed queue item.', risk),
      step('export-diagnostics', 2, 'export_diagnostics', 'Export recovery diagnostics.', risk),
    ];
  }
  if (reason === 'retry_exhausted') {
    return [
      step('requeue-item', 1, 'requeue_item', 'Requeue item for manual recovery.', 'high', true),
      step('rollback-last-action', 2, 'rollback_last_action', 'Rollback last worker action before retrying.', 'critical', true),
      step('pause-for-review', 3, 'pause_for_review', 'Pause worker for operator review.', 'high', true),
    ];
  }
  if (reason === 'governance_blocked' || reason === 'approval_timeout') {
    return [
      step('escalate-approval', 1, 'escalate_to_approval', 'Escalate recovery to approval workflow.', 'high', true),
      step('export-diagnostics', 2, 'export_diagnostics', 'Export governance recovery diagnostics.', risk),
    ];
  }
  return [
    step('export-diagnostics', 1, 'export_diagnostics', 'Export diagnostics for unknown incident.', risk),
    step('pause-for-review', 2, 'pause_for_review', 'Pause worker for manual investigation.', 'medium', true),
    step('kill-worker', 3, 'kill_worker', 'Kill worker only after governance approval.', 'critical', true),
  ];
}

function persistPlan(plan: WorkerRecoveryPlan): WorkerRecoveryPlan {
  const state = readState();
  writeState({ ...state, recoveryPlans: { ...state.recoveryPlans, [plan.id]: { ...plan, updatedAt: nowIso() } }, updatedAt: nowIso() });
  return clone({ ...plan, updatedAt: nowIso() });
}

function persistAttempt(attempt: WorkerRecoveryAttempt): WorkerRecoveryAttempt {
  const state = readState();
  writeState({ ...state, recoveryAttempts: { ...state.recoveryAttempts, [attempt.id]: attempt }, updatedAt: nowIso() });
  return clone(attempt);
}

function persistResult(result: WorkerRecoveryResult): WorkerRecoveryResult {
  const state = readState();
  writeState({ ...state, recoveryResults: { ...state.recoveryResults, [result.id]: result }, updatedAt: nowIso() });
  return clone(result);
}

function persistDecision(decision: AutoHealingDecision): AutoHealingDecision {
  const state = readState();
  writeState({ ...state, autoHealingDecisions: { ...state.autoHealingDecisions, [decision.id]: decision }, updatedAt: nowIso() });
  return clone(decision);
}

function persistLink(link: WorkerRecoveryIncidentLink): WorkerRecoveryIncidentLink {
  const state = readState();
  writeState({ ...state, incidentRecoveryLinks: { ...state.incidentRecoveryLinks, [link.id]: link }, updatedAt: nowIso() });
  return clone(link);
}

function attempt(plan: WorkerRecoveryPlan, stepItem: WorkerRecoveryStep | undefined, status: WorkerRecoveryAttempt['status'], message: string, reason?: string): WorkerRecoveryAttempt {
  return persistAttempt({
    id: `worker-recovery-attempt-${plan.id}-${stepItem?.id ?? 'plan'}-${Date.now()}`,
    planId: plan.id,
    stepId: stepItem?.id,
    action: stepItem?.action ?? 'mark_unrecoverable',
    status,
    reason,
    message,
    createdAt: nowIso(),
  });
}

function updateStep(plan: WorkerRecoveryPlan, stepId: string, patch: Partial<WorkerRecoveryStep>): WorkerRecoveryPlan {
  return persistPlan({ ...plan, steps: plan.steps.map((candidate) => candidate.id === stepId ? { ...candidate, ...patch } : candidate) });
}

function completePlanIfDone(planId: string): WorkerRecoveryPlan {
  const plan = readState().recoveryPlans[planId];
  if (!plan) throw new Error(`Missing recovery plan: ${planId}`);
  const failed = plan.steps.filter((item) => item.status === 'failed').length;
  const completed = plan.steps.filter((item) => item.status === 'completed').length;
  if (failed) {
    const failedPlan = persistPlan({ ...plan, status: 'failed' });
    persistResult({ id: `worker-recovery-result-${plan.id}-${Date.now()}`, planId: plan.id, status: 'failed', successful: false, message: 'Recovery failed.', completedSteps: completed, failedSteps: failed, createdAt: nowIso() });
    return failedPlan;
  }
  if (completed === plan.steps.length) {
    const resolved = persistPlan({ ...plan, status: 'resolved', resolvedAt: nowIso() });
    persistResult({ id: `worker-recovery-result-${plan.id}-${Date.now()}`, planId: plan.id, status: 'resolved', successful: true, message: 'Recovery plan resolved.', completedSteps: completed, failedSteps: 0, createdAt: nowIso() });
    const link = Object.values(readState().incidentRecoveryLinks).find((candidate) => candidate.planId === plan.id);
    if (link) persistLink({ ...link, status: 'resolved', resolvedAt: nowIso() });
    return resolved;
  }
  return clone(plan);
}

export function createRecoveryPlanForIncident(incidentId: string): WorkerRecoveryPlan {
  const existing = Object.values(readState().recoveryPlans).find((plan) => plan.incidentId === incidentId);
  if (existing) return clone(existing);
  const incident = getWorkerIncidents().find((candidate) => candidate.id === incidentId);
  if (!incident) throw new Error(`Cannot create recovery plan for missing incident: ${incidentId}`);
  const reason = normalizeIncidentReason(incident);
  const risk = riskFromIncident(incident, reason);
  const timestamp = nowIso();
  const plan: WorkerRecoveryPlan = {
    id: `worker-recovery-plan-${incidentId}`,
    incidentId,
    incidentReason: reason,
    workerId: incident.workerId,
    queueItemId: incident.queueItemId,
    status: risk === 'low' ? 'ready' : 'approval_required',
    risk,
    steps: stepsForIncident(reason, risk),
    policies: policiesForRisk(risk),
    approved: risk === 'low',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const saved = persistPlan(plan);
  persistLink({ id: `worker-recovery-link-${incident.id}`, incidentId: incident.id, planId: saved.id, workerId: incident.workerId, queueItemId: incident.queueItemId, status: 'linked', createdAt: timestamp });
  evaluateAutoHealingDecision(saved.id);
  return saved;
}

export function evaluateAutoHealingDecision(planId: string): AutoHealingDecision {
  const plan = readState().recoveryPlans[planId];
  if (!plan) throw new Error(`Cannot evaluate missing recovery plan: ${planId}`);
  const destructive = plan.steps.some((item) => item.action === 'kill_worker' || item.action === 'rollback_last_action' || item.action === 'skip_item');
  const decision: AutoHealingDecision = {
    id: `worker-auto-heal-${plan.id}-${Date.now()}`,
    planId: plan.id,
    incidentId: plan.incidentId,
    risk: plan.risk,
    decision: plan.risk === 'low' && !destructive ? 'AUTO_EXECUTE' : destructive || riskRank(plan.risk) >= 2 ? 'REQUIRE_APPROVAL' : 'BLOCK',
    reasons: plan.risk === 'low' && !destructive ? ['low_risk_auto_heal'] : ['governance_approval_required'],
    createdAt: nowIso(),
  };
  return persistDecision(decision);
}

export function approveRecoveryPlan(planId: string): WorkerRecoveryPlan {
  const plan = readState().recoveryPlans[planId];
  if (!plan) throw new Error(`Cannot approve missing recovery plan: ${planId}`);
  attempt(plan, undefined, 'completed', 'Recovery plan approved.');
  return persistPlan({ ...plan, status: 'approved', approved: true, rejectedReason: undefined });
}

export function rejectRecoveryPlan(planId: string, reason = 'Recovery rejected by governance review.'): WorkerRecoveryPlan {
  const plan = readState().recoveryPlans[planId];
  if (!plan) throw new Error(`Cannot reject missing recovery plan: ${planId}`);
  attempt(plan, undefined, 'blocked', 'Recovery plan rejected.', reason);
  return persistPlan({ ...plan, status: 'rejected', approved: false, rejectedReason: reason });
}

export function executeRecoveryStep(planId: string, stepId: string, reason?: string): WorkerRecoveryAttempt {
  let plan = readState().recoveryPlans[planId];
  if (!plan) throw new Error(`Cannot execute missing recovery plan: ${planId}`);
  const stepItem = plan.steps.find((candidate) => candidate.id === stepId);
  if (!stepItem) throw new Error(`Cannot execute missing recovery step: ${stepId}`);
  if (stepItem.requiresReason && !reason) {
    updateStep(plan, stepId, { status: 'blocked', error: 'reason_required' });
    return attempt(plan, stepItem, 'blocked', 'Recovery step requires reason.', 'reason_required');
  }
  if (stepItem.requiresApproval && !plan.approved) {
    updateStep(plan, stepId, { status: 'blocked', error: 'approval_required' });
    return attempt(plan, stepItem, 'blocked', 'Recovery step requires approval.', 'approval_required');
  }

  plan = updateStep(plan, stepId, { status: 'executing', reason });
  attempt(plan, stepItem, 'started', `Started recovery action ${stepItem.action}.`, reason);
  try {
    if (stepItem.action === 'restart_worker') {
      stopImprovementLoopWorker();
      startImprovementLoopWorker();
      recoverStaleWorker(undefined, 0);
    } else if (stepItem.action === 'retry_current_item') {
      requestWorkerRetryNow(reason ?? 'Recovery retry current item.');
    } else if (stepItem.action === 'requeue_item') {
      requestWorkerRequeueItem(reason ?? 'Recovery requeue item.');
    } else if (stepItem.action === 'skip_item') {
      requestWorkerSkipItem(reason ?? '');
    } else if (stepItem.action === 'pause_for_review') {
      stopImprovementLoopWorker();
    } else if (stepItem.action === 'escalate_to_approval') {
      requestWorkerEscalateToApproval(reason ?? 'Recovery approval escalation.');
    } else if (stepItem.action === 'export_diagnostics') {
      requestWorkerExportDiagnostics(reason ?? 'Recovery diagnostics export.');
    } else if (stepItem.action === 'kill_worker') {
      requestWorkerKill(reason ?? 'Recovery kill worker.');
    } else if (stepItem.action === 'rollback_last_action') {
      requestWorkerExportDiagnostics(reason ?? 'Recovery rollback evidence export.');
    }
    updateStep(readState().recoveryPlans[planId], stepId, { status: 'completed', completedAt: nowIso(), error: undefined });
    completePlanIfDone(planId);
    return attempt(readState().recoveryPlans[planId], stepItem, 'completed', `Completed recovery action ${stepItem.action}.`, reason);
  } catch (error) {
    updateStep(readState().recoveryPlans[planId], stepId, { status: 'failed', error: error instanceof Error ? error.message : String(error) });
    completePlanIfDone(planId);
    return attempt(readState().recoveryPlans[planId], stepItem, 'failed', `Recovery action ${stepItem.action} failed.`, error instanceof Error ? error.message : String(error));
  }
}

export function executeRecoveryPlan(planId: string, reason?: string): WorkerRecoveryResult {
  let plan = readState().recoveryPlans[planId];
  if (!plan) throw new Error(`Cannot execute missing recovery plan: ${planId}`);
  if (plan.status === 'rejected') {
    return persistResult({ id: `worker-recovery-result-${plan.id}-${Date.now()}`, planId: plan.id, status: 'rejected', successful: false, message: 'Rejected recovery plan cannot execute.', completedSteps: 0, failedSteps: 0, createdAt: nowIso() });
  }
  if (plan.risk !== 'low' && !plan.approved) {
    evaluateAutoHealingDecision(plan.id);
    return persistResult({ id: `worker-recovery-result-${plan.id}-${Date.now()}`, planId: plan.id, status: 'approval_required', successful: false, message: 'Recovery requires approval before execution.', completedSteps: 0, failedSteps: 0, createdAt: nowIso() });
  }
  plan = persistPlan({ ...plan, status: 'executing' });
  for (const item of plan.steps) {
    if (item.status !== 'completed') executeRecoveryStep(plan.id, item.id, item.requiresReason ? reason : undefined);
  }
  const latest = readState().recoveryPlans[plan.id];
  const completed = latest.steps.filter((item) => item.status === 'completed').length;
  const failed = latest.steps.filter((item) => item.status === 'failed').length;
  return persistResult({ id: `worker-recovery-result-${plan.id}-${Date.now()}`, planId: plan.id, status: latest.status, successful: latest.status === 'resolved', message: latest.status === 'resolved' ? 'Recovery plan executed.' : 'Recovery plan needs follow-up.', completedSteps: completed, failedSteps: failed, createdAt: nowIso() });
}

export function markRecoveryResolved(planId: string): WorkerRecoveryPlan {
  const plan = readState().recoveryPlans[planId];
  if (!plan) throw new Error(`Cannot resolve missing recovery plan: ${planId}`);
  const resolved = persistPlan({ ...plan, status: 'resolved', approved: true, resolvedAt: nowIso(), steps: plan.steps.map((item) => ({ ...item, status: item.status === 'completed' ? item.status : 'skipped' })) });
  const link = Object.values(readState().incidentRecoveryLinks).find((candidate) => candidate.planId === planId);
  if (link) persistLink({ ...link, status: 'resolved', resolvedAt: nowIso() });
  return resolved;
}

export function getRecoveryPlans(): WorkerRecoveryPlan[] {
  return Object.values(readState().recoveryPlans).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone);
}

export function getRecoveryPlanByIncident(incidentId: string): WorkerRecoveryPlan | undefined {
  return getRecoveryPlans().find((plan) => plan.incidentId === incidentId);
}

export function getActiveRecoveryPlan(): WorkerRecoveryPlan | undefined {
  return getRecoveryPlans().find((plan) => !['resolved', 'rejected', 'failed', 'unrecoverable'].includes(plan.status));
}

export function getAutoHealingDecisions(): AutoHealingDecision[] {
  return Object.values(readState().autoHealingDecisions).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone);
}

export function getRecoveryAuditTrail(): WorkerRecoveryAttempt[] {
  return Object.values(readState().recoveryAttempts).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(clone);
}

export function getUnresolvedRecoveryIncidents(): WorkerIncident[] {
  const resolvedIncidentIds = new Set(Object.values(readState().incidentRecoveryLinks).filter((link) => link.status === 'resolved').map((link) => link.incidentId));
  return getWorkerIncidents().filter((incident) => !resolvedIncidentIds.has(incident.id));
}

export function getRecoveryReadiness(): WorkerRecoveryReadiness {
  const plans = getRecoveryPlans();
  const activePlans = plans.filter((plan) => !['resolved', 'rejected', 'failed', 'unrecoverable'].includes(plan.status));
  const approvalRequired = plans.filter((plan) => plan.status === 'approval_required').length;
  const unresolved = getUnresolvedRecoveryIncidents();
  return {
    ready: activePlans.length > 0 && approvalRequired === 0,
    totalPlans: plans.length,
    activePlans: activePlans.length,
    approvalRequired,
    unresolvedIncidents: unresolved.length,
    blockedReasons: plans.filter((plan) => plan.status === 'approval_required').map((plan) => `${plan.id}: approval required`),
  };
}

export function getWorkerRecoveryDashboard(): WorkerRecoveryDashboard {
  const plans = getRecoveryPlans();
  return {
    plans,
    activePlan: getActiveRecoveryPlan(),
    unresolvedIncidents: getUnresolvedRecoveryIncidents(),
    autoHealingDecisions: getAutoHealingDecisions(),
    attempts: getRecoveryAuditTrail(),
    results: Object.values(readState().recoveryResults).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone),
    links: Object.values(readState().incidentRecoveryLinks).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone),
    readiness: getRecoveryReadiness(),
    artifacts: Object.values(readState().recoveryArtifacts).map(clone),
  };
}

export function exportRecoveryReport(): ArtifactRecord[] {
  const artifacts = exportRecoveryArtifacts();
  const state = readState();
  writeState({ ...state, recoveryArtifacts: { ...state.recoveryArtifacts, ...Object.fromEntries(artifacts.map((artifact) => [artifact.name, artifact.id])) }, updatedAt: nowIso() });
  return artifacts;
}

function exportArtifact(id: string, name: string, contentText: string, type: Artifact['type'] = 'report'): Artifact {
  return { id, runId: DEMO_RUN_ID, type, name, source: 'mock', contentSummary: `Worker recovery export for ${DEMO_RUN_ID}`, contentText, createdAt: nowIso() };
}

export function exportRecoveryArtifacts(): ArtifactRecord[] {
  const dashboard = getWorkerRecoveryDashboard();
  const artifacts = [
    exportArtifact(`artifact-${DEMO_RUN_ID}-worker-recovery-plan-json`, 'worker-recovery-plan.json', JSON.stringify(dashboard.plans, null, 2), 'json'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-worker-recovery-report-md`, 'worker-recovery-report.md', ['# Worker Recovery Report', '', `Plans: ${dashboard.plans.length}`, `Unresolved incidents: ${dashboard.unresolvedIncidents.length}`, `Approval required: ${dashboard.readiness.approvalRequired}`, ''].join('\n'), 'markdown'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-worker-auto-healing-decisions-json`, 'worker-auto-healing-decisions.json', JSON.stringify(dashboard.autoHealingDecisions, null, 2), 'json'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-worker-recovery-audit-md`, 'worker-recovery-audit.md', ['# Worker Recovery Audit', '', ...dashboard.attempts.map((item) => `- ${item.createdAt}: ${item.action} ${item.status} ${item.message}`), ''].join('\n'), 'markdown'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-unresolved-worker-incidents-md`, 'unresolved-worker-incidents.md', ['# Unresolved Worker Incidents', '', ...dashboard.unresolvedIncidents.map((incident) => `- ${incident.reason}: ${incident.message}`), ''].join('\n'), 'markdown'),
  ];
  return artifacts.map((artifact) => registerArtifact(artifact, { type: 'AUDIT', metadata: { runId: DEMO_RUN_ID, tags: ['worker-recovery', 'auto-healing'] } }));
}

export function clearWorkerRecoveryStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(WORKER_RECOVERY_STORAGE_KEY);
}
