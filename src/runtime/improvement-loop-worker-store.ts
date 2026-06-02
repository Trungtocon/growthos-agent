import { DEMO_RUN_ID } from '../data/demo-fixtures';
import type { Artifact } from '../domain/types';
import type { ArtifactRecord } from './artifact-registry';
import { registerArtifact } from './artifact-registry-store';
import {
  completeImprovementLoopRun,
  failImprovementLoopRun,
  getLoopRuns,
} from './improvement-loop-store';
import { updateRecommendationConfidence } from './learning-memory-store';
import { getGlobalLoopKillSwitch, selectLoopGovernanceDecision } from './improvement-loop-governance-store';
import {
  completeQueuedLoop,
  failQueuedLoop,
  getImprovementLoopQueue,
  getNextEligibleLoop,
  getQueueConcurrencyStatus,
  retryFailedLoop,
  startQueuedLoop,
} from './improvement-loop-queue-store';
import type { ImprovementLoopQueueItem } from './improvement-loop-queue';
import {
  defaultWorkerId,
  isTerminalWorkerStatus,
  queueItemWorkerMessage,
  type ImprovementLoopWorker,
  type StaleWorkerWarning,
  type WorkerExecutionResult,
  type WorkerFailureReason,
  type WorkerHeartbeat,
  type WorkerStatus,
  type WorkerTick,
  type WorkerExecutionSummary,
} from './improvement-loop-worker';

const WORKER_STORAGE_KEY = 'uikigai-improvement-loop-worker-v1';
const STALE_HEARTBEAT_MS = 30_000;

interface ImprovementLoopWorkerStoreState {
  workers: Record<string, ImprovementLoopWorker>;
  activeWorkerId?: string;
  ticks: Record<string, WorkerTick>;
  results: Record<string, WorkerExecutionResult>;
  heartbeats: Record<string, WorkerHeartbeat>;
  staleWarnings: Record<string, StaleWorkerWarning>;
  updatedAt: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyState(): ImprovementLoopWorkerStoreState {
  return { workers: {}, ticks: {}, results: {}, heartbeats: {}, staleWarnings: {}, updatedAt: nowIso() };
}

function readState(): ImprovementLoopWorkerStoreState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(WORKER_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ImprovementLoopWorkerStoreState>;
    return {
      workers: parsed.workers ?? {},
      activeWorkerId: parsed.activeWorkerId,
      ticks: parsed.ticks ?? {},
      results: parsed.results ?? {},
      heartbeats: parsed.heartbeats ?? {},
      staleWarnings: parsed.staleWarnings ?? {},
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: ImprovementLoopWorkerStoreState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(WORKER_STORAGE_KEY, JSON.stringify(state));
}

function persistWorker(worker: ImprovementLoopWorker): ImprovementLoopWorker {
  const state = readState();
  writeState({
    ...state,
    workers: { ...state.workers, [worker.id]: { ...worker, updatedAt: nowIso() } },
    activeWorkerId: worker.id,
    updatedAt: nowIso(),
  });
  return clone({ ...worker, updatedAt: nowIso() });
}

function activeWorker(): ImprovementLoopWorker {
  const state = readState();
  const id = state.activeWorkerId ?? defaultWorkerId();
  return state.workers[id] ?? createImprovementLoopWorker(id);
}

function recordTick(worker: ImprovementLoopWorker, status: WorkerStatus, message: string, queueItemId?: string): WorkerTick {
  const state = readState();
  const sequence = Object.keys(state.ticks).length + 1;
  const tick: WorkerTick = {
    id: `improvement-loop-worker-tick-${sequence}-${Date.now()}`,
    workerId: worker.id,
    sequence,
    status,
    queueItemId,
    message,
    createdAt: nowIso(),
  };
  writeState({ ...state, ticks: { ...state.ticks, [tick.id]: tick }, updatedAt: nowIso() });
  return clone(tick);
}

function recordResult(result: WorkerExecutionResult): WorkerExecutionResult {
  const state = readState();
  writeState({ ...state, results: { ...state.results, [result.id]: result }, updatedAt: nowIso() });
  return clone(result);
}

function updateWorkerStatus(worker: ImprovementLoopWorker, status: WorkerStatus, patch: Partial<ImprovementLoopWorker> = {}): ImprovementLoopWorker {
  return persistWorker({ ...worker, ...patch, status, updatedAt: nowIso() });
}

function resultFromItem(worker: ImprovementLoopWorker, item: ImprovementLoopQueueItem | undefined, status: WorkerExecutionResult['status'], message: string, reason?: WorkerFailureReason): WorkerExecutionResult {
  const timestamp = nowIso();
  return {
    id: `improvement-loop-worker-result-${worker.id}-${Date.now()}`,
    workerId: worker.id,
    queueItemId: item?.id,
    loopId: item?.loopId,
    status,
    reason,
    message,
    startedAt: timestamp,
    completedAt: status === 'started' ? undefined : timestamp,
  };
}

export function createImprovementLoopWorker(workerId = defaultWorkerId()): ImprovementLoopWorker {
  const state = readState();
  const existing = state.workers[workerId];
  if (existing) return clone(existing);
  const timestamp = nowIso();
  return persistWorker({
    id: workerId,
    status: 'idle',
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function startImprovementLoopWorker(workerId = defaultWorkerId()): ImprovementLoopWorker {
  const worker = createImprovementLoopWorker(workerId);
  if (isTerminalWorkerStatus(worker.status) || worker.status === 'idle' || worker.status === 'paused') {
    const started = updateWorkerStatus(worker, 'polling', { startedAt: worker.startedAt ?? nowIso(), stoppedAt: undefined, pausedAt: undefined, blockedReason: undefined });
    recordTick(started, 'polling', 'Worker started polling improvement loop queue.');
    return started;
  }
  return worker;
}

export function stopImprovementLoopWorker(workerId = defaultWorkerId()): ImprovementLoopWorker {
  const worker = activeWorker().id === workerId ? activeWorker() : createImprovementLoopWorker(workerId);
  const stopped = updateWorkerStatus(worker, 'stopped', { stoppedAt: nowIso(), activeQueueItemId: undefined });
  recordTick(stopped, 'stopped', 'Worker stopped.');
  return stopped;
}

export function pauseImprovementLoopWorker(workerId = defaultWorkerId()): ImprovementLoopWorker {
  const worker = activeWorker().id === workerId ? activeWorker() : createImprovementLoopWorker(workerId);
  const paused = updateWorkerStatus(worker, 'paused', { pausedAt: nowIso() });
  recordTick(paused, 'paused', 'Worker paused.');
  return paused;
}

export function resumeImprovementLoopWorker(workerId = defaultWorkerId()): ImprovementLoopWorker {
  const worker = activeWorker().id === workerId ? activeWorker() : createImprovementLoopWorker(workerId);
  const resumed = updateWorkerStatus(worker, 'polling', { pausedAt: undefined, blockedReason: undefined });
  recordTick(resumed, 'polling', 'Worker resumed polling.');
  return resumed;
}

export function recordWorkerHeartbeat(workerId = defaultWorkerId()): WorkerHeartbeat {
  const worker = createImprovementLoopWorker(workerId);
  const heartbeat: WorkerHeartbeat = {
    id: `improvement-loop-worker-heartbeat-${workerId}-${Date.now()}`,
    workerId,
    status: worker.status,
    activeQueueItemId: worker.activeQueueItemId,
    recordedAt: nowIso(),
  };
  const state = readState();
  writeState({
    ...state,
    workers: { ...state.workers, [worker.id]: { ...worker, lastHeartbeatAt: heartbeat.recordedAt, updatedAt: nowIso() } },
    heartbeats: { ...state.heartbeats, [heartbeat.id]: heartbeat },
    activeWorkerId: worker.id,
    updatedAt: nowIso(),
  });
  return clone(heartbeat);
}

export function executeNextQueueItem(workerId = defaultWorkerId()): WorkerExecutionResult {
  let worker = startImprovementLoopWorker(workerId);
  recordWorkerHeartbeat(worker.id);

  if (getGlobalLoopKillSwitch().enabled) {
    worker = updateWorkerStatus(worker, 'paused', { blockedReason: 'kill_switch_enabled' });
    recordTick(worker, 'paused', 'Kill switch prevented worker execution.');
    return recordResult(resultFromItem(worker, undefined, 'skipped', 'Kill switch prevented execution.', 'kill_switch_enabled'));
  }

  if (getQueueConcurrencyStatus().saturated) {
    worker = updateWorkerStatus(worker, 'polling', { blockedReason: 'concurrency_saturated' });
    recordTick(worker, 'polling', 'Worker found queue concurrency saturated.');
    return recordResult(resultFromItem(worker, undefined, 'skipped', 'Queue concurrency is saturated.', 'concurrency_saturated'));
  }

  const next = getNextEligibleLoop();
  if (!next) {
    worker = updateWorkerStatus(worker, 'idle', { blockedReason: 'queue_empty', activeQueueItemId: undefined });
    recordTick(worker, 'idle', 'Worker found no eligible queue item.');
    return recordResult(resultFromItem(worker, undefined, 'skipped', 'No eligible queue item.', 'queue_empty'));
  }

  const decision = selectLoopGovernanceDecision(next.loopId);
  if (decision?.decision === 'REQUIRE_REVIEW') {
    const item = startQueuedLoop(next.id);
    worker = updateWorkerStatus(worker, 'waiting_approval', { activeQueueItemId: item.id, blockedReason: 'approval_required' });
    recordTick(worker, 'waiting_approval', 'Worker moved queue item to approval hold.', item.id);
    return recordResult(resultFromItem(worker, item, 'waiting_approval', 'Approval is required before execution.', 'approval_required'));
  }

  const started = startQueuedLoop(next.id);
  if (started.status === 'running') {
    worker = updateWorkerStatus(worker, 'executing', { activeQueueItemId: started.id, blockedReason: undefined });
    recordTick(worker, 'executing', 'Worker started queue item execution.', started.id);
    return recordResult(resultFromItem(worker, started, 'started', 'Worker started execution.'));
  }

  const reason: WorkerFailureReason = started.status === 'waiting_approval'
    ? 'approval_required'
    : started.status === 'scheduled'
      ? 'schedule_window_closed'
      : 'governance_block';
  const status: WorkerStatus = started.status === 'waiting_approval' ? 'waiting_approval' : 'waiting_governance';
  worker = updateWorkerStatus(worker, status, { activeQueueItemId: started.id, blockedReason: reason });
  recordTick(worker, status, queueItemWorkerMessage(started), started.id);
  return recordResult(resultFromItem(worker, started, started.status === 'waiting_approval' ? 'waiting_approval' : 'blocked', 'Worker could not start queue item.', reason));
}

export function runWorkerTick(workerId = defaultWorkerId()): WorkerTick {
  const result = executeNextQueueItem(workerId);
  const worker = activeWorker();
  return recordTick(worker, worker.status, result.message, result.queueItemId);
}

export function completeWorkerRun(itemId?: string, workerId = defaultWorkerId()): WorkerExecutionResult {
  let worker = activeWorker().id === workerId ? activeWorker() : createImprovementLoopWorker(workerId);
  const item = itemId ? getImprovementLoopQueue().find((candidate) => candidate.id === itemId) : getImprovementLoopQueue().find((candidate) => candidate.id === worker.activeQueueItemId);
  if (!item) return recordResult(resultFromItem(worker, undefined, 'skipped', 'No active queue item to complete.', 'queue_empty'));
  const latestRun = item.lastRunId ? getLoopRuns(item.loopId).find((run) => run.id === item.lastRunId) : undefined;
  if (latestRun && latestRun.status !== 'completed') completeImprovementLoopRun(latestRun.id, ['Worker completed autonomous improvement loop execution.']);
  const completed = completeQueuedLoop(item.id);
  try { updateRecommendationConfidence(completed.recommendationId, 2); } catch { /* recommendation may be synthetic in smoke fixtures */ }
  worker = updateWorkerStatus(worker, 'idle', { activeQueueItemId: undefined, blockedReason: undefined });
  recordTick(worker, 'idle', 'Worker completed active queue item.', completed.id);
  return recordResult(resultFromItem(worker, completed, 'completed', 'Worker completed queue item.'));
}

export function failWorkerRun(itemId?: string, reason = 'execution_failed', workerId = defaultWorkerId()): WorkerExecutionResult {
  let worker = activeWorker().id === workerId ? activeWorker() : createImprovementLoopWorker(workerId);
  const item = itemId ? getImprovementLoopQueue().find((candidate) => candidate.id === itemId) : getImprovementLoopQueue().find((candidate) => candidate.id === worker.activeQueueItemId);
  if (!item) return recordResult(resultFromItem(worker, undefined, 'skipped', 'No active queue item to fail.', 'queue_empty'));
  const latestRun = item.lastRunId ? getLoopRuns(item.loopId).find((run) => run.id === item.lastRunId) : undefined;
  if (latestRun && latestRun.status !== 'failed') failImprovementLoopRun(latestRun.id, reason);
  const failed = failQueuedLoop(item.id, reason);
  const retried = failed.retryPolicy.retryCount < failed.retryPolicy.maxRetries ? retryFailedLoop(failed.id) : failed;
  const exhausted = retried.status === 'failed';
  worker = updateWorkerStatus(worker, exhausted ? 'failed' : 'retrying', { activeQueueItemId: retried.id, blockedReason: exhausted ? 'retry_exhausted' : 'execution_failed' });
  recordTick(worker, worker.status, exhausted ? 'Worker retry policy exhausted.' : 'Worker scheduled failed item for retry.', retried.id);
  return recordResult(resultFromItem(worker, retried, exhausted ? 'failed' : 'retrying', exhausted ? 'Retry policy exhausted.' : 'Worker scheduled retry.', exhausted ? 'retry_exhausted' : 'execution_failed'));
}

export function recoverStaleWorker(workerId = defaultWorkerId(), staleMs = STALE_HEARTBEAT_MS): ImprovementLoopWorker {
  const worker = createImprovementLoopWorker(workerId);
  const last = worker.lastHeartbeatAt ? Date.parse(worker.lastHeartbeatAt) : 0;
  const staleForMs = last ? Date.now() - last : staleMs + 1;
  if (staleForMs <= staleMs) return worker;
  const warning: StaleWorkerWarning = { workerId, lastHeartbeatAt: worker.lastHeartbeatAt, staleForMs, reason: 'stale_worker' };
  const recovered = updateWorkerStatus(worker, 'paused', { blockedReason: 'stale_worker' });
  const state = readState();
  writeState({ ...state, staleWarnings: { ...state.staleWarnings, [workerId]: warning }, updatedAt: nowIso() });
  recordTick(recovered, 'paused', 'Worker recovered stale heartbeat state.');
  return recovered;
}

export function getActiveImprovementLoopWorker(): ImprovementLoopWorker | undefined {
  const state = readState();
  const id = state.activeWorkerId;
  return id && state.workers[id] ? clone(state.workers[id]) : undefined;
}

export function getImprovementLoopWorkerStatus(): WorkerStatus {
  return getActiveImprovementLoopWorker()?.status ?? 'idle';
}

export function getWorkerHeartbeat(workerId = defaultWorkerId()): WorkerHeartbeat | undefined {
  return Object.values(readState().heartbeats).filter((heartbeat) => heartbeat.workerId === workerId).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
}

export function getWorkerTickHistory(workerId?: string): WorkerTick[] {
  return Object.values(readState().ticks).filter((tick) => !workerId || tick.workerId === workerId).sort((a, b) => a.sequence - b.sequence).map(clone);
}

export function getWorkerExecutionResults(workerId?: string): WorkerExecutionResult[] {
  return Object.values(readState().results).filter((result) => !workerId || result.workerId === workerId).sort((a, b) => a.startedAt.localeCompare(b.startedAt)).map(clone);
}

export function getWorkerExecutionSummary(): WorkerExecutionSummary {
  const results = getWorkerExecutionResults();
  return {
    totalTicks: getWorkerTickHistory().length,
    totalResults: results.length,
    started: results.filter((result) => result.status === 'started').length,
    completed: results.filter((result) => result.status === 'completed').length,
    failed: results.filter((result) => result.status === 'failed').length,
    retrying: results.filter((result) => result.status === 'retrying').length,
    blocked: results.filter((result) => result.status === 'blocked').length,
    waitingApproval: results.filter((result) => result.status === 'waiting_approval').length,
    generatedAt: nowIso(),
  };
}

export function getStaleWorkerWarnings(): StaleWorkerWarning[] {
  return Object.values(readState().staleWarnings).map(clone);
}

export function getWorkerBlockedReason(): WorkerFailureReason | undefined {
  return getActiveImprovementLoopWorker()?.blockedReason;
}

export function exportWorkerStatusJson(): string {
  return JSON.stringify({ worker: getActiveImprovementLoopWorker(), heartbeat: getWorkerHeartbeat(), summary: getWorkerExecutionSummary() }, null, 2);
}

export function exportWorkerSummaryMarkdown(): string {
  const summary = getWorkerExecutionSummary();
  return ['# Improvement Loop Worker Summary', '', `Ticks: ${summary.totalTicks}`, `Results: ${summary.totalResults}`, `Started: ${summary.started}`, `Completed: ${summary.completed}`, `Failed: ${summary.failed}`, ''].join('\n');
}

export function exportWorkerTickLogJson(): string {
  return JSON.stringify(getWorkerTickHistory(), null, 2);
}

export function exportWorkerFailureReportMarkdown(): string {
  return ['# Improvement Loop Worker Failure Report', '', ...getWorkerExecutionResults().filter((result) => result.status === 'failed' || result.status === 'blocked').map((result) => `- ${result.queueItemId ?? 'none'}: ${result.reason ?? 'unknown'} - ${result.message}`), ''].join('\n');
}

export function exportWorkerRecoveryReportMarkdown(): string {
  return ['# Improvement Loop Worker Recovery Report', '', ...getStaleWorkerWarnings().map((warning) => `- ${warning.workerId}: stale for ${warning.staleForMs}ms`), ''].join('\n');
}

function exportArtifact(id: string, name: string, contentText: string, type: Artifact['type'] = 'report'): Artifact {
  return { id, runId: DEMO_RUN_ID, type, name, source: 'mock', contentSummary: `Improvement loop worker export for ${DEMO_RUN_ID}`, contentText, createdAt: nowIso() };
}

export function exportImprovementLoopWorkerArtifacts(): ArtifactRecord[] {
  const artifacts = [
    exportArtifact(`artifact-${DEMO_RUN_ID}-improvement-worker-status-json`, 'improvement-worker-status.json', exportWorkerStatusJson(), 'json'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-improvement-worker-summary-md`, 'improvement-worker-summary.md', exportWorkerSummaryMarkdown(), 'markdown'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-improvement-worker-tick-log-json`, 'improvement-worker-tick-log.json', exportWorkerTickLogJson(), 'json'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-improvement-worker-failure-report-md`, 'improvement-worker-failure-report.md', exportWorkerFailureReportMarkdown(), 'markdown'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-improvement-worker-recovery-report-md`, 'improvement-worker-recovery-report.md', exportWorkerRecoveryReportMarkdown(), 'markdown'),
  ];
  return artifacts.map((artifact) => registerArtifact(artifact, { type: 'AUDIT', metadata: { runId: DEMO_RUN_ID, tags: ['improvement-loop-worker', 'scheduler'] } }));
}

export function clearImprovementLoopWorkerStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(WORKER_STORAGE_KEY);
}
