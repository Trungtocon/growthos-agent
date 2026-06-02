import { DEMO_RUN_ID } from '../data/demo-fixtures';
import type { Artifact } from '../domain/types';
import type { ArtifactRecord } from './artifact-registry';
import { registerArtifact } from './artifact-registry-store';
import {
  cancelQueuedLoop,
  getImprovementLoopQueue,
  getQueueAuditTrail,
  holdQueuedLoopForApproval,
  requeueLoopItem,
  retryFailedLoop,
} from './improvement-loop-queue-store';
import { enableGlobalLoopKillSwitch } from './improvement-loop-governance-store';
import {
  getActiveImprovementLoopWorker,
  getImprovementLoopWorkerStatus,
  getStaleWorkerWarnings,
  getWorkerBlockedReason,
  getWorkerExecutionResults,
  getWorkerExecutionSummary,
  getWorkerHeartbeat,
  getWorkerTickHistory,
  pauseImprovementLoopWorker,
  resumeImprovementLoopWorker,
  stopImprovementLoopWorker,
} from './improvement-loop-worker-store';
import type {
  WorkerBlockedReason,
  WorkerControlAction,
  WorkerControlActionType,
  WorkerControlEligibility,
  WorkerHealthSnapshot,
  WorkerIncident,
  WorkerObservation,
  WorkerObservationDashboard,
  WorkerRunTrace,
  WorkerSLAStatus,
} from './worker-observability';

const OBSERVABILITY_STORAGE_KEY = 'uikigai-worker-observability-v1';
const HEARTBEAT_WARNING_MS = 30_000;
const HEARTBEAT_BREACH_MS = 60_000;
const SLA_TICK_WARNING = 12;

interface WorkerObservabilityState {
  observations: Record<string, WorkerObservation>;
  incidents: Record<string, WorkerIncident>;
  controlActions: Record<string, WorkerControlAction>;
  diagnosticsArtifacts: Record<string, string>;
  healthSnapshots: Record<string, WorkerHealthSnapshot>;
  updatedAt: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyState(): WorkerObservabilityState {
  return { observations: {}, incidents: {}, controlActions: {}, diagnosticsArtifacts: {}, healthSnapshots: {}, updatedAt: nowIso() };
}

function readState(): WorkerObservabilityState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(OBSERVABILITY_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<WorkerObservabilityState>;
    return {
      observations: parsed.observations ?? {},
      incidents: parsed.incidents ?? {},
      controlActions: parsed.controlActions ?? {},
      diagnosticsArtifacts: parsed.diagnosticsArtifacts ?? {},
      healthSnapshots: parsed.healthSnapshots ?? {},
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: WorkerObservabilityState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(OBSERVABILITY_STORAGE_KEY, JSON.stringify(state));
}

function heartbeatAgeMs(lastHeartbeatAt?: string): number {
  if (!lastHeartbeatAt) return HEARTBEAT_BREACH_MS + 1;
  return Math.max(0, Date.now() - Date.parse(lastHeartbeatAt));
}

function slaStatus(heartbeatAge: number, tickCount: number): WorkerSLAStatus {
  if (heartbeatAge > HEARTBEAT_BREACH_MS || tickCount > SLA_TICK_WARNING * 2) return 'breached';
  if (heartbeatAge > HEARTBEAT_WARNING_MS || tickCount > SLA_TICK_WARNING) return 'warning';
  return 'healthy';
}

function activeQueueItem() {
  const worker = getActiveImprovementLoopWorker();
  const queue = getImprovementLoopQueue();
  return queue.find((item) => item.id === worker?.activeQueueItemId) ?? queue.find((item) => item.status === 'running') ?? queue[0];
}

function averageExecutionTimeMs(): number {
  const completed = getWorkerExecutionResults().filter((result) => result.completedAt);
  if (!completed.length) return 0;
  const total = completed.reduce((sum, result) => sum + Math.max(0, Date.parse(result.completedAt!) - Date.parse(result.startedAt)), 0);
  return Math.round(total / completed.length);
}

function waitTimeByStatus(status: string): number {
  const item = activeQueueItem();
  if (!item || item.status !== status) return 0;
  return Math.max(0, Date.now() - Date.parse(item.updatedAt));
}

function persistObservation(observation: WorkerObservation): WorkerObservation {
  const state = readState();
  writeState({ ...state, observations: { ...state.observations, [observation.id]: observation }, updatedAt: nowIso() });
  return clone(observation);
}

function persistHealthSnapshot(snapshot: WorkerHealthSnapshot): WorkerHealthSnapshot {
  const state = readState();
  writeState({ ...state, healthSnapshots: { ...state.healthSnapshots, [snapshot.id]: snapshot }, updatedAt: nowIso() });
  return clone(snapshot);
}

function persistControlAction(action: WorkerControlAction): WorkerControlAction {
  const state = readState();
  writeState({ ...state, controlActions: { ...state.controlActions, [action.id]: action }, updatedAt: nowIso() });
  return clone(action);
}

function persistIncident(incident: WorkerIncident): WorkerIncident {
  const state = readState();
  writeState({ ...state, incidents: { ...state.incidents, [incident.id]: incident }, updatedAt: nowIso() });
  return clone(incident);
}

export function buildWorkerObservation(): WorkerObservation {
  const worker = getActiveImprovementLoopWorker();
  const heartbeat = getWorkerHeartbeat(worker?.id);
  const summary = getWorkerExecutionSummary();
  const activeItem = activeQueueItem();
  const tickCount = summary.totalTicks;
  const retryCount = activeItem?.retryPolicy.retryCount ?? 0;
  const heartbeatAge = heartbeatAgeMs(heartbeat?.recordedAt ?? worker?.lastHeartbeatAt);
  const staleWarning = getStaleWorkerWarnings().length > 0 || heartbeatAge > HEARTBEAT_WARNING_MS;
  const observation: WorkerObservation = {
    id: `worker-observation-${Date.now()}`,
    workerId: worker?.id ?? 'improvement-loop-worker-default',
    status: getImprovementLoopWorkerStatus(),
    activeQueueItemId: activeItem?.id,
    currentStep: worker?.status === 'executing' ? 'executing_queue_item' : worker?.status ?? 'idle',
    lastHeartbeatAt: heartbeat?.recordedAt ?? worker?.lastHeartbeatAt,
    tickCount,
    retryCount,
    averageExecutionTimeMs: averageExecutionTimeMs(),
    queueWaitTimeMs: activeItem ? Math.max(0, Date.now() - Date.parse(activeItem.enqueuedAt)) : 0,
    governanceWaitTimeMs: waitTimeByStatus('waiting_governance'),
    approvalWaitTimeMs: waitTimeByStatus('waiting_approval'),
    lastFailureReason: getWorkerBlockedReason() as WorkerBlockedReason | undefined,
    staleWarning,
    slaStatus: slaStatus(heartbeatAge, tickCount),
    createdAt: nowIso(),
  };
  if (observation.lastFailureReason) {
    recordWorkerIncident(observation.lastFailureReason, `Worker blocked by ${observation.lastFailureReason}.`, observation.activeQueueItemId);
  }
  if (observation.slaStatus === 'breached') {
    recordWorkerIncident('stale_worker', 'Worker SLA breach detected.', observation.activeQueueItemId);
  }
  return persistObservation(observation);
}

export function buildWorkerHealthSnapshot(): WorkerHealthSnapshot {
  const worker = getActiveImprovementLoopWorker();
  const heartbeat = getWorkerHeartbeat(worker?.id);
  const age = heartbeatAgeMs(heartbeat?.recordedAt ?? worker?.lastHeartbeatAt);
  const snapshot: WorkerHealthSnapshot = {
    id: `worker-health-${Date.now()}`,
    workerId: worker?.id ?? 'improvement-loop-worker-default',
    status: getImprovementLoopWorkerStatus(),
    heartbeatAgeMs: age,
    stale: age > HEARTBEAT_WARNING_MS || getStaleWorkerWarnings().length > 0,
    tickCount: getWorkerExecutionSummary().totalTicks,
    incidentCount: getWorkerIncidents().length,
    slaStatus: slaStatus(age, getWorkerExecutionSummary().totalTicks),
    generatedAt: nowIso(),
  };
  return persistHealthSnapshot(snapshot);
}

export function buildWorkerRunTrace(): WorkerRunTrace {
  const worker = getActiveImprovementLoopWorker();
  const ticks = getWorkerTickHistory(worker?.id);
  const results = getWorkerExecutionResults(worker?.id);
  const steps = [
    ...ticks.map((tick) => ({ id: tick.id, label: tick.message, status: tick.status, timestamp: tick.createdAt })),
    ...results.map((result) => ({ id: result.id, label: result.message, status: result.status === 'started' ? 'executing' as const : result.status, timestamp: result.completedAt ?? result.startedAt })),
  ].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return {
    id: `worker-trace-${worker?.id ?? 'default'}`,
    workerId: worker?.id ?? 'improvement-loop-worker-default',
    queueItemId: worker?.activeQueueItemId,
    steps,
    startedAt: steps[0]?.timestamp,
    completedAt: steps[steps.length - 1]?.timestamp,
  };
}

export function recordWorkerIncident(reason: WorkerBlockedReason, message: string, queueItemId?: string, severity: WorkerIncident['severity'] = 'warning'): WorkerIncident {
  const worker = getActiveImprovementLoopWorker();
  const incident: WorkerIncident = {
    id: `worker-incident-${reason}-${Date.now()}`,
    workerId: worker?.id ?? 'improvement-loop-worker-default',
    queueItemId,
    severity,
    reason,
    message,
    createdAt: nowIso(),
  };
  return persistIncident(incident);
}

export function getWorkerObservationDashboard(): WorkerObservationDashboard {
  const observation = buildWorkerObservation();
  const health = buildWorkerHealthSnapshot();
  return {
    observation,
    activeQueueItem: activeQueueItem(),
    health,
    incidents: getWorkerIncidents(),
    controlActions: getWorkerControlActions(),
    diagnosticsArtifacts: getWorkerDiagnosticsArtifacts(),
  };
}

export function getWorkerCurrentTrace(): WorkerRunTrace {
  return buildWorkerRunTrace();
}

export function getWorkerHealthSnapshot(): WorkerHealthSnapshot {
  return buildWorkerHealthSnapshot();
}

export function getWorkerIncidents(): WorkerIncident[] {
  return Object.values(readState().incidents).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(clone);
}

export function getWorkerControlActions(): WorkerControlAction[] {
  return Object.values(readState().controlActions).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(clone);
}

export function getWorkerSLAStatus(): WorkerSLAStatus {
  return buildWorkerHealthSnapshot().slaStatus;
}

export function getWorkerDiagnosticsArtifacts(): string[] {
  return Object.values(readState().diagnosticsArtifacts).map(clone);
}

export function getWorkerControlEligibility(): WorkerControlEligibility {
  const worker = getActiveImprovementLoopWorker();
  const active = activeQueueItem();
  const running = worker?.status === 'executing';
  const paused = worker?.status === 'paused';
  const retryable = Boolean(active && ['failed', 'blocked', 'retrying'].includes(active.status) && active.retryPolicy.retryCount < active.retryPolicy.maxRetries);
  return {
    canPause: Boolean(worker && !paused),
    canResume: Boolean(worker && paused),
    canStop: Boolean(worker && worker.status !== 'stopped'),
    canKill: true,
    canRetryNow: retryable,
    canSkip: Boolean(active),
    canRequeue: Boolean(active),
    canEscalateToApproval: Boolean(active && running),
    reason: active ? undefined : 'no_active_item',
  };
}

function controlAction(type: WorkerControlActionType, status: WorkerControlAction['status'], reason?: string, blockedReason?: WorkerBlockedReason, queueItemId?: string): WorkerControlAction {
  const worker = getActiveImprovementLoopWorker();
  return persistControlAction({
    id: `worker-control-${type}-${Date.now()}`,
    type,
    workerId: worker?.id ?? 'improvement-loop-worker-default',
    queueItemId,
    status,
    reason,
    blockedReason,
    createdAt: nowIso(),
  });
}

function rejectControl(type: WorkerControlActionType, blockedReason: WorkerBlockedReason, reason?: string): WorkerControlAction {
  recordWorkerIncident(blockedReason, `Control action ${type} rejected: ${blockedReason}.`, activeQueueItem()?.id, 'warning');
  return controlAction(type, 'rejected', reason, blockedReason, activeQueueItem()?.id);
}

export function requestWorkerPause(reason = 'pause requested'): WorkerControlAction {
  if (!getWorkerControlEligibility().canPause) return rejectControl('pause', 'rbac_denied', reason);
  controlAction('pause', 'requested', reason, undefined, activeQueueItem()?.id);
  // imported lazily through store boundary: pause action mutates worker state, not UI.
  const { pauseImprovementLoopWorker } = requireWorkerStore();
  pauseImprovementLoopWorker();
  return controlAction('pause', 'executed', reason, undefined, activeQueueItem()?.id);
}

export function requestWorkerResume(reason = 'resume requested'): WorkerControlAction {
  if (!getWorkerControlEligibility().canResume) return rejectControl('resume', 'rbac_denied', reason);
  controlAction('resume', 'requested', reason, undefined, activeQueueItem()?.id);
  const { resumeImprovementLoopWorker } = requireWorkerStore();
  resumeImprovementLoopWorker();
  return controlAction('resume', 'executed', reason, undefined, activeQueueItem()?.id);
}

export function requestWorkerStop(reason = 'stop requested'): WorkerControlAction {
  if (!getWorkerControlEligibility().canStop) return rejectControl('stop', 'rbac_denied', reason);
  controlAction('stop', 'requested', reason, undefined, activeQueueItem()?.id);
  const { stopImprovementLoopWorker } = requireWorkerStore();
  stopImprovementLoopWorker();
  return controlAction('stop', 'executed', reason, undefined, activeQueueItem()?.id);
}

export function requestWorkerKill(reason = 'kill requested'): WorkerControlAction {
  controlAction('kill', 'requested', reason, undefined, activeQueueItem()?.id);
  enableGlobalLoopKillSwitch(reason);
  recordWorkerIncident('governance_denied', `Worker kill switch enabled: ${reason}.`, activeQueueItem()?.id, 'critical');
  return controlAction('kill', 'executed', reason, undefined, activeQueueItem()?.id);
}

export function requestWorkerRetryNow(reason = 'retry requested'): WorkerControlAction {
  const item = activeQueueItem();
  if (!item) return rejectControl('retry_now', 'no_active_item', reason);
  if (!['failed', 'blocked', 'retrying'].includes(item.status)) return rejectControl('retry_now', 'governance_denied', reason);
  if (item.retryPolicy.retryCount >= item.retryPolicy.maxRetries) return rejectControl('retry_now', 'retry_policy_exhausted', reason);
  controlAction('retry_now', 'requested', reason, undefined, item.id);
  retryFailedLoop(item.id);
  return controlAction('retry_now', 'executed', reason, undefined, item.id);
}

export function requestWorkerSkipItem(reason: string): WorkerControlAction {
  const item = activeQueueItem();
  if (!reason) return rejectControl('skip_item', 'missing_reason');
  if (!item) return rejectControl('skip_item', 'no_active_item', reason);
  controlAction('skip_item', 'requested', reason, undefined, item.id);
  cancelQueuedLoop(item.id);
  return controlAction('skip_item', 'executed', reason, undefined, item.id);
}

export function requestWorkerRequeueItem(reason: string): WorkerControlAction {
  const item = activeQueueItem();
  if (!reason) return rejectControl('requeue_item', 'missing_reason');
  if (!item) return rejectControl('requeue_item', 'no_active_item', reason);
  controlAction('requeue_item', 'requested', reason, undefined, item.id);
  requeueLoopItem(item.id);
  return controlAction('requeue_item', 'executed', reason, undefined, item.id);
}

export function requestWorkerEscalateToApproval(reason = 'manual approval escalation'): WorkerControlAction {
  const item = activeQueueItem();
  if (!item) return rejectControl('escalate_to_approval', 'no_active_item', reason);
  controlAction('escalate_to_approval', 'requested', reason, undefined, item.id);
  holdQueuedLoopForApproval(item.id, reason);
  recordWorkerIncident('governance_denied', `Queue item escalated to approval: ${reason}.`, item.id, 'info');
  return controlAction('escalate_to_approval', 'executed', reason, undefined, item.id);
}

function requireWorkerStore() {
  return { pauseImprovementLoopWorker, resumeImprovementLoopWorker, stopImprovementLoopWorker };
}

export function exportWorkerObservationJson(): string {
  return JSON.stringify(getWorkerObservationDashboard(), null, 2);
}

export function exportWorkerHealthReportMarkdown(): string {
  const health = getWorkerHealthSnapshot();
  return ['# Worker Health Report', '', `Status: ${health.status}`, `Heartbeat age: ${health.heartbeatAgeMs}ms`, `SLA: ${health.slaStatus}`, `Incidents: ${health.incidentCount}`, ''].join('\n');
}

export function exportWorkerIncidentsJson(): string {
  return JSON.stringify(getWorkerIncidents(), null, 2);
}

export function exportWorkerControlAuditMarkdown(): string {
  return ['# Worker Control Audit', '', ...getWorkerControlActions().map((action) => `- ${action.createdAt}: ${action.type} ${action.status} ${action.reason ?? ''}`), ''].join('\n');
}

export function exportWorkerDiagnosticsJson(): string {
  return JSON.stringify({ dashboard: getWorkerObservationDashboard(), trace: getWorkerCurrentTrace(), queueAudit: getQueueAuditTrail() }, null, 2);
}

function exportArtifact(id: string, name: string, contentText: string, type: Artifact['type'] = 'report'): Artifact {
  return { id, runId: DEMO_RUN_ID, type, name, source: 'mock', contentSummary: `Worker observability export for ${DEMO_RUN_ID}`, contentText, createdAt: nowIso() };
}

export function requestWorkerExportDiagnostics(reason = 'diagnostics export'): WorkerControlAction {
  const artifacts = exportWorkerDiagnosticsArtifacts();
  const state = readState();
  writeState({ ...state, diagnosticsArtifacts: { ...state.diagnosticsArtifacts, ...Object.fromEntries(artifacts.map((artifact) => [artifact.name, artifact.id])) }, updatedAt: nowIso() });
  return controlAction('export_diagnostics', 'executed', reason, undefined, activeQueueItem()?.id);
}

export function exportWorkerDiagnosticsArtifacts(): ArtifactRecord[] {
  const artifacts = [
    exportArtifact(`artifact-${DEMO_RUN_ID}-worker-observation-json`, 'worker-observation.json', exportWorkerObservationJson(), 'json'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-worker-health-report-md`, 'worker-health-report.md', exportWorkerHealthReportMarkdown(), 'markdown'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-worker-incidents-json`, 'worker-incidents.json', exportWorkerIncidentsJson(), 'json'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-worker-control-audit-md`, 'worker-control-audit.md', exportWorkerControlAuditMarkdown(), 'markdown'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-worker-diagnostics-json`, 'worker-diagnostics.json', exportWorkerDiagnosticsJson(), 'json'),
  ];
  return artifacts.map((artifact) => registerArtifact(artifact, { type: 'AUDIT', metadata: { runId: DEMO_RUN_ID, tags: ['worker-observability', 'control-center'] } }));
}

export function clearWorkerObservabilityStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(OBSERVABILITY_STORAGE_KEY);
}
