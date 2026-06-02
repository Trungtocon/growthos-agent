import { DEMO_RUN_ID } from '../data/demo-fixtures';
import type { Artifact } from '../domain/types';
import type { ArtifactRecord } from './artifact-registry';
import { registerArtifact } from './artifact-registry-store';
import type { ImprovementLoop } from './improvement-loop';
import {
  completeImprovementLoopRun,
  createImprovementLoop,
  getImprovementLoops,
  getLoopRuns,
  startImprovementLoop,
} from './improvement-loop-store';
import {
  getGlobalLoopKillSwitch,
  selectLoopGovernanceDecision,
} from './improvement-loop-governance-store';
import {
  queueItemId,
  queuePriorityRank,
  type ImprovementLoopQueueAuditEvent,
  type ImprovementLoopQueueConcurrencyStatus,
  type ImprovementLoopQueueHealthSummary,
  type ImprovementLoopQueueItem,
  type ImprovementLoopQueuePriority,
  type ImprovementLoopQueueStatus,
  type ImprovementLoopRetryPolicy,
  type ImprovementLoopScheduleWindow,
} from './improvement-loop-queue';

const QUEUE_STORAGE_KEY = 'uikigai-improvement-loop-queue-v1';
const MAX_CONCURRENCY = 1;

interface ImprovementLoopQueueStoreState {
  items: Record<string, ImprovementLoopQueueItem>;
  auditEvents: Record<string, ImprovementLoopQueueAuditEvent>;
  maxConcurrency: number;
  lastProcessedTick?: string;
  updatedAt: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyState(): ImprovementLoopQueueStoreState {
  return { items: {}, auditEvents: {}, maxConcurrency: MAX_CONCURRENCY, updatedAt: nowIso() };
}

function readState(): ImprovementLoopQueueStoreState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ImprovementLoopQueueStoreState>;
    return {
      items: parsed.items ?? {},
      auditEvents: parsed.auditEvents ?? {},
      maxConcurrency: parsed.maxConcurrency ?? MAX_CONCURRENCY,
      lastProcessedTick: parsed.lastProcessedTick,
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: ImprovementLoopQueueStoreState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(state));
}

function persistItem(item: ImprovementLoopQueueItem, message: string): ImprovementLoopQueueItem {
  const state = readState();
  const event: ImprovementLoopQueueAuditEvent = {
    id: `improvement-loop-queue-audit-${item.id}-${Date.now()}`,
    itemId: item.id,
    loopId: item.loopId,
    action: item.status,
    status: item.status,
    message,
    createdAt: nowIso(),
  };
  writeState({
    ...state,
    items: { ...state.items, [item.id]: { ...item, updatedAt: nowIso() } },
    auditEvents: { ...state.auditEvents, [event.id]: event },
    updatedAt: nowIso(),
  });
  return clone({ ...item, updatedAt: nowIso() });
}

function defaultRetryPolicy(): ImprovementLoopRetryPolicy {
  return { maxRetries: 2, retryCount: 0, backoffMs: 1000 };
}

function priorityFromLoop(loop: ImprovementLoop): ImprovementLoopQueuePriority {
  if (loop.priority === 'critical') return 'critical';
  if (loop.priority === 'high') return 'urgent';
  if (loop.priority === 'medium') return 'high';
  return 'normal';
}

function isWindowOpen(window?: ImprovementLoopScheduleWindow): boolean {
  if (!window?.enabled) return true;
  const now = Date.now();
  return now >= Date.parse(window.startAt) && now <= Date.parse(window.endAt);
}

function canRetry(item: ImprovementLoopQueueItem): boolean {
  if (item.retryPolicy.retryCount >= item.retryPolicy.maxRetries) return false;
  if (!item.retryPolicy.nextRetryAt) return true;
  return Date.now() >= Date.parse(item.retryPolicy.nextRetryAt);
}

export function enqueueImprovementLoop(
  loopIdOrRecommendationId: string,
  priority?: ImprovementLoopQueuePriority,
  scheduleWindow?: ImprovementLoopScheduleWindow,
): ImprovementLoopQueueItem {
  const existingLoop = getImprovementLoops().find((loop) => loop.id === loopIdOrRecommendationId);
  const loop = existingLoop ?? createImprovementLoop(loopIdOrRecommendationId);
  const id = queueItemId(loop.id);
  const existing = readState().items[id];
  if (existing) return clone(existing);
  const timestamp = nowIso();
  return persistItem({
    id,
    loopId: loop.id,
    recommendationId: loop.recommendationId,
    priority: priority ?? priorityFromLoop(loop),
    status: scheduleWindow?.enabled ? 'scheduled' : 'queued',
    scheduledFor: scheduleWindow?.startAt,
    scheduleWindow,
    retryPolicy: defaultRetryPolicy(),
    enqueuedAt: timestamp,
    order: Object.keys(readState().items).length + 1,
    updatedAt: timestamp,
  }, 'Loop enqueued for autonomous execution.');
}

export function evaluateQueueReadiness(itemId: string): ImprovementLoopQueueStatus {
  const item = readState().items[itemId];
  if (!item) throw new Error(`Missing improvement loop queue item: ${itemId}`);
  if (getGlobalLoopKillSwitch().enabled) return 'paused';
  if (item.status === 'cancelled' || item.status === 'completed' || item.status === 'killed') return item.status;
  if (!isWindowOpen(item.scheduleWindow)) return 'scheduled';
  const decision = selectLoopGovernanceDecision(item.loopId);
  if (decision?.decision === 'KILL') return 'killed';
  if (decision?.decision === 'REQUIRE_REVIEW') return 'waiting_approval';
  if (decision?.decision === 'BLOCK' || decision?.decision === 'ROLLBACK_REQUIRED') return 'blocked';
  if (decision?.decision === 'PAUSE') return 'paused';
  return 'queued';
}

export function getImprovementLoopQueue(): ImprovementLoopQueueItem[] {
  return Object.values(readState().items).sort((a, b) => {
    const rankDelta = queuePriorityRank(b.priority) - queuePriorityRank(a.priority);
    if (rankDelta) return rankDelta;
    return a.order - b.order;
  }).map(clone);
}

export function getQueuedLoops(): ImprovementLoopQueueItem[] {
  return getImprovementLoopQueue().filter((item) => item.status === 'queued' || item.status === 'scheduled' || item.status === 'retrying');
}

export function getRunningLoopQueueItems(): ImprovementLoopQueueItem[] {
  return getImprovementLoopQueue().filter((item) => item.status === 'running');
}

export function getBlockedLoopQueueItems(): ImprovementLoopQueueItem[] {
  return getImprovementLoopQueue().filter((item) => item.status === 'blocked' || item.status === 'killed');
}

export function getWaitingApprovalQueueItems(): ImprovementLoopQueueItem[] {
  return getImprovementLoopQueue().filter((item) => item.status === 'waiting_approval');
}

export function getQueueConcurrencyStatus(): ImprovementLoopQueueConcurrencyStatus {
  const activeCount = getRunningLoopQueueItems().length;
  const maxConcurrency = readState().maxConcurrency;
  return { maxConcurrency, activeCount, availableSlots: Math.max(0, maxConcurrency - activeCount), saturated: activeCount >= maxConcurrency };
}

export function getNextEligibleLoop(): ImprovementLoopQueueItem | undefined {
  if (getGlobalLoopKillSwitch().enabled || getQueueConcurrencyStatus().saturated) return undefined;
  return getImprovementLoopQueue().find((item) => ['queued', 'retrying', 'scheduled'].includes(item.status) && isWindowOpen(item.scheduleWindow) && canRetry(item));
}

export function dequeueNextEligibleLoop(): ImprovementLoopQueueItem | undefined {
  const next = getNextEligibleLoop();
  if (!next) return undefined;
  return persistItem({ ...next, status: 'waiting_governance' }, 'Next eligible loop dequeued for governance check.');
}

function statusFromError(item: ImprovementLoopQueueItem): ImprovementLoopQueueStatus {
  const decision = selectLoopGovernanceDecision(item.loopId);
  if (decision?.decision === 'REQUIRE_REVIEW') return 'waiting_approval';
  if (decision?.decision === 'KILL') return 'killed';
  if (decision?.decision === 'PAUSE') return 'paused';
  return 'blocked';
}

export function startQueuedLoop(itemId: string): ImprovementLoopQueueItem {
  const item = readState().items[itemId];
  if (!item) throw new Error(`Cannot start missing queue item: ${itemId}`);
  if (item.status === 'cancelled') throw new Error(`Cancelled queue item cannot run: ${itemId}`);
  if (!isWindowOpen(item.scheduleWindow)) return persistItem({ ...item, status: 'scheduled' }, 'Queue item is outside the schedule window.');
  if (getQueueConcurrencyStatus().saturated && item.status !== 'running') return persistItem({ ...item, status: 'queued' }, 'Queue concurrency is saturated.');
  if (getGlobalLoopKillSwitch().enabled) return persistItem({ ...item, status: 'paused' }, 'Global kill switch paused queue processing.');
  try {
    const run = startImprovementLoop(item.loopId);
    return persistItem({ ...item, status: run.status === 'waiting_review' ? 'waiting_approval' : 'running', lastRunId: run.id, startedAt: nowIso(), lastDecision: 'ALLOW' }, 'Queue item started.');
  } catch {
    const nextStatus = statusFromError(item);
    const decision = selectLoopGovernanceDecision(item.loopId);
    return persistItem({ ...item, status: nextStatus, blocker: decision?.reasons.join(', ') ?? 'governance_blocker', lastDecision: decision?.decision }, 'Queue item blocked by governance.');
  }
}

export function pauseQueuedLoop(itemId: string): ImprovementLoopQueueItem {
  const item = readState().items[itemId];
  if (!item) throw new Error(`Cannot pause missing queue item: ${itemId}`);
  return persistItem({ ...item, status: 'paused' }, 'Queue item paused.');
}

export function resumeQueuedLoop(itemId: string): ImprovementLoopQueueItem {
  const item = readState().items[itemId];
  if (!item) throw new Error(`Cannot resume missing queue item: ${itemId}`);
  return persistItem({ ...item, status: 'queued' }, 'Queue item resumed.');
}

export function cancelQueuedLoop(itemId: string): ImprovementLoopQueueItem {
  const item = readState().items[itemId];
  if (!item) throw new Error(`Cannot cancel missing queue item: ${itemId}`);
  return persistItem({ ...item, status: 'cancelled' }, 'Queue item cancelled.');
}

export function retryFailedLoop(itemId: string): ImprovementLoopQueueItem {
  const item = readState().items[itemId];
  if (!item) throw new Error(`Cannot retry missing queue item: ${itemId}`);
  if (!['failed', 'blocked', 'retrying'].includes(item.status)) throw new Error(`Only failed, blocked, or retrying queue items can retry: ${itemId}`);
  if (item.retryPolicy.retryCount >= item.retryPolicy.maxRetries) return persistItem({ ...item, status: 'failed', blocker: 'max_retries_exceeded' }, 'Retry policy exhausted.');
  const retryPolicy = {
    ...item.retryPolicy,
    retryCount: item.retryPolicy.retryCount + 1,
    nextRetryAt: new Date(Date.now() + item.retryPolicy.backoffMs).toISOString(),
  };
  return persistItem({ ...item, status: 'retrying', retryPolicy }, 'Queue item scheduled for retry.');
}

export function reorderQueue(itemId: string, order: number): ImprovementLoopQueueItem {
  const item = readState().items[itemId];
  if (!item) throw new Error(`Cannot reorder missing queue item: ${itemId}`);
  return persistItem({ ...item, order }, 'Queue item reordered.');
}

export function completeQueuedLoop(itemId: string): ImprovementLoopQueueItem {
  const item = readState().items[itemId];
  if (!item) throw new Error(`Cannot complete missing queue item: ${itemId}`);
  const lastRun = item.lastRunId ? getLoopRuns(item.loopId).find((run) => run.id === item.lastRunId) : undefined;
  if (lastRun && lastRun.status !== 'completed') completeImprovementLoopRun(lastRun.id, ['Queue completed execution evidence.']);
  return persistItem({ ...item, status: 'completed', completedAt: nowIso() }, 'Queue item completed.');
}

export function processQueueTick(): ImprovementLoopQueueItem | undefined {
  const state = readState();
  writeState({ ...state, lastProcessedTick: nowIso(), updatedAt: nowIso() });
  const next = dequeueNextEligibleLoop();
  if (!next) return undefined;
  return startQueuedLoop(next.id);
}

export function getQueueHealthSummary(): ImprovementLoopQueueHealthSummary {
  const items = getImprovementLoopQueue();
  return {
    total: items.length,
    queued: items.filter((item) => item.status === 'queued').length,
    scheduled: items.filter((item) => item.status === 'scheduled').length,
    waitingGovernance: items.filter((item) => item.status === 'waiting_governance').length,
    waitingApproval: items.filter((item) => item.status === 'waiting_approval').length,
    running: items.filter((item) => item.status === 'running').length,
    blocked: items.filter((item) => item.status === 'blocked').length,
    completed: items.filter((item) => item.status === 'completed').length,
    failed: items.filter((item) => item.status === 'failed').length,
    cancelled: items.filter((item) => item.status === 'cancelled').length,
    killed: items.filter((item) => item.status === 'killed').length,
    generatedAt: nowIso(),
  };
}

export function getQueueAuditTrail(itemId?: string): ImprovementLoopQueueAuditEvent[] {
  return Object.values(readState().auditEvents)
    .filter((event) => !itemId || event.itemId === itemId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(clone);
}

export function exportImprovementLoopQueueJson(): string {
  return JSON.stringify(getImprovementLoopQueue(), null, 2);
}

export function exportImprovementLoopQueueSummaryMarkdown(): string {
  const summary = getQueueHealthSummary();
  return ['# Improvement Loop Queue Summary', '', `Total: ${summary.total}`, `Queued: ${summary.queued}`, `Running: ${summary.running}`, `Blocked: ${summary.blocked}`, `Completed: ${summary.completed}`, ''].join('\n');
}

export function exportImprovementLoopQueueAuditMarkdown(): string {
  return ['# Improvement Loop Queue Audit', '', ...getQueueAuditTrail().map((event) => `- ${event.createdAt}: ${event.status} ${event.itemId ?? ''} - ${event.message}`), ''].join('\n');
}

export function exportBlockedQueueItemsJson(): string {
  return JSON.stringify(getBlockedLoopQueueItems(), null, 2);
}

export function exportRetryPolicyReportMarkdown(): string {
  return ['# Retry Policy Report', '', ...getImprovementLoopQueue().map((item) => `- ${item.id}: ${item.retryPolicy.retryCount}/${item.retryPolicy.maxRetries}, next ${item.retryPolicy.nextRetryAt ?? 'none'}`), ''].join('\n');
}

export function exportScheduledLoopReportMarkdown(): string {
  return ['# Scheduled Loop Report', '', ...getImprovementLoopQueue().filter((item) => item.scheduleWindow).map((item) => `- ${item.id}: ${item.scheduleWindow?.startAt} -> ${item.scheduleWindow?.endAt}`), ''].join('\n');
}

function exportArtifact(id: string, name: string, contentText: string, type: Artifact['type'] = 'report'): Artifact {
  return { id, runId: DEMO_RUN_ID, type, name, source: 'mock', contentSummary: `Improvement loop queue export for ${DEMO_RUN_ID}`, contentText, createdAt: nowIso() };
}

export function exportImprovementLoopQueueArtifacts(): ArtifactRecord[] {
  const artifacts = [
    exportArtifact(`artifact-${DEMO_RUN_ID}-improvement-loop-queue-json`, 'improvement-loop-queue.json', exportImprovementLoopQueueJson(), 'json'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-improvement-loop-queue-summary-md`, 'improvement-loop-queue-summary.md', exportImprovementLoopQueueSummaryMarkdown(), 'markdown'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-improvement-loop-queue-audit-md`, 'improvement-loop-queue-audit.md', exportImprovementLoopQueueAuditMarkdown(), 'markdown'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-blocked-queue-items-json`, 'blocked-queue-items.json', exportBlockedQueueItemsJson(), 'json'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-retry-policy-report-md`, 'retry-policy-report.md', exportRetryPolicyReportMarkdown(), 'markdown'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-scheduled-loop-report-md`, 'scheduled-loop-report.md', exportScheduledLoopReportMarkdown(), 'markdown'),
  ];
  return artifacts.map((artifact) => registerArtifact(artifact, { type: 'AUDIT', metadata: { runId: DEMO_RUN_ID, tags: ['improvement-loop-queue', 'scheduler'] } }));
}

export function clearImprovementLoopQueueStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(QUEUE_STORAGE_KEY);
}
