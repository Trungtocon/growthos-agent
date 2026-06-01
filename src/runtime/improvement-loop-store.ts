import { DEMO_RUN_ID, demoWorkspace } from '../data/demo-fixtures';
import type { Artifact } from '../domain/types';
import type { ArtifactRecord } from './artifact-registry';
import { registerArtifact } from './artifact-registry-store';
import {
  completeRecommendationExecution,
  createExecutionFromRecommendation,
  failRecommendationExecution,
  getExecutionByRecommendation,
  startRecommendationExecution,
  verifyRecommendationImpact,
} from './recommendation-execution-store';
import { getRecommendations, updateRecommendationConfidence } from './learning-memory-store';
import type { Recommendation } from './learning-memory';
import {
  improvementLoopId,
  improvementLoopRunId,
  type ImprovementLoop,
  type ImprovementLoopOutcome,
  type ImprovementLoopOutcomeSummary,
  type ImprovementLoopPolicy,
  type ImprovementLoopReadiness,
  type ImprovementLoopRun,
  type ImprovementLoopSchedule,
  type ImprovementLoopScheduleFrequency,
  type ImprovementLoopScheduleSummary,
  type ImprovementLoopStatus,
  type ImprovementLoopTriggerType,
  type WorkspaceImprovementLoopSummary,
} from './improvement-loop';

const IMPROVEMENT_LOOP_STORAGE_KEY = 'uikigai-improvement-loop-v1';
const MIN_CONFIDENCE = 50;

interface ImprovementLoopStoreState {
  loops: Record<string, ImprovementLoop>;
  runs: Record<string, ImprovementLoopRun>;
  schedules: Record<string, ImprovementLoopSchedule>;
  outcomes: Record<string, ImprovementLoopOutcome>;
  updatedAt: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyState(): ImprovementLoopStoreState {
  return { loops: {}, runs: {}, schedules: {}, outcomes: {}, updatedAt: nowIso() };
}

function readState(): ImprovementLoopStoreState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(IMPROVEMENT_LOOP_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ImprovementLoopStoreState>;
    return {
      loops: parsed.loops ?? {},
      runs: parsed.runs ?? {},
      schedules: parsed.schedules ?? {},
      outcomes: parsed.outcomes ?? {},
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: ImprovementLoopStoreState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(IMPROVEMENT_LOOP_STORAGE_KEY, JSON.stringify(state));
}

function persistLoop(loop: ImprovementLoop): ImprovementLoop {
  const state = readState();
  writeState({
    ...state,
    loops: { ...state.loops, [loop.id]: loop },
    updatedAt: nowIso(),
  });
  return clone(loop);
}

function persistRun(run: ImprovementLoopRun): ImprovementLoopRun {
  const state = readState();
  writeState({
    ...state,
    runs: { ...state.runs, [run.id]: run },
    updatedAt: nowIso(),
  });
  return clone(run);
}

function persistSchedule(schedule: ImprovementLoopSchedule): ImprovementLoopSchedule {
  const state = readState();
  writeState({
    ...state,
    schedules: { ...state.schedules, [schedule.id]: schedule },
    updatedAt: nowIso(),
  });
  return clone(schedule);
}

function persistOutcome(outcome: ImprovementLoopOutcome): ImprovementLoopOutcome {
  const state = readState();
  writeState({
    ...state,
    outcomes: { ...state.outcomes, [outcome.id]: outcome },
    updatedAt: nowIso(),
  });
  return clone(outcome);
}

function findRecommendation(recommendationId: string): Recommendation | undefined {
  return getRecommendations().find((recommendation) => recommendation.id === recommendationId);
}

function isHighRisk(recommendation: Recommendation): boolean {
  return recommendation.impact.priority === 'critical'
    || recommendation.type === 'add_governance_rule'
    || recommendation.type === 'require_approval';
}

function buildPolicies(recommendation: Recommendation, triggerType: ImprovementLoopTriggerType): ImprovementLoopPolicy[] {
  const highRisk = isHighRisk(recommendation);
  return [
    {
      id: 'minimum_recommendation_confidence',
      name: 'Minimum recommendation confidence',
      threshold: MIN_CONFIDENCE,
      severity: recommendation.confidence >= MIN_CONFIDENCE ? 'info' : 'blocking',
      passed: recommendation.confidence >= MIN_CONFIDENCE,
      requiresApproval: false,
      message: recommendation.confidence >= MIN_CONFIDENCE
        ? `Confidence ${recommendation.confidence}% is above the execution threshold.`
        : `Confidence ${recommendation.confidence}% is below the ${MIN_CONFIDENCE}% execution threshold.`,
    },
    {
      id: 'governance_warning_review',
      name: 'Governance warning review',
      severity: triggerType === 'governance_warning' ? 'blocking' : 'info',
      passed: triggerType !== 'governance_warning',
      requiresApproval: triggerType === 'governance_warning',
      message: triggerType === 'governance_warning'
        ? 'Governance warning trigger requires manual review before autonomous execution.'
        : 'No governance warning blocks this loop.',
    },
    {
      id: 'high_risk_requires_approval',
      name: 'High-risk loop approval',
      severity: highRisk ? 'warning' : 'info',
      passed: true,
      requiresApproval: highRisk,
      message: highRisk ? 'High-risk recommendation requires approval hold before execution.' : 'Recommendation is low risk for autonomous execution.',
    },
  ];
}

function updateLoopStatus(loopId: string, status: ImprovementLoopStatus, patch: Partial<ImprovementLoop> = {}): ImprovementLoop {
  const state = readState();
  const loop = state.loops[loopId];
  if (!loop) throw new Error(`Missing improvement loop: ${loopId}`);
  return persistLoop({ ...loop, ...patch, status, updatedAt: nowIso() });
}

export function createImprovementLoop(recommendationId: string, triggerType: ImprovementLoopTriggerType = 'manual'): ImprovementLoop {
  const id = improvementLoopId(recommendationId);
  const existing = readState().loops[id];
  if (existing) return clone(existing);
  const recommendation = findRecommendation(recommendationId);
  if (!recommendation) throw new Error(`Cannot create loop for missing recommendation: ${recommendationId}`);
  if (recommendation.status === 'rejected') throw new Error(`Rejected recommendation cannot create an improvement loop: ${recommendationId}`);
  if (recommendation.status !== 'accepted') throw new Error(`Only accepted recommendations can create an improvement loop: ${recommendationId}`);
  const execution = getExecutionByRecommendation(recommendationId) ?? createExecutionFromRecommendation(recommendationId);
  const timestamp = nowIso();
  return persistLoop({
    id,
    recommendationId,
    recommendationExecutionId: execution.id,
    runId: recommendation.context.runId ?? DEMO_RUN_ID,
    agentId: recommendation.context.agentId,
    workflowId: recommendation.context.workflowId,
    status: 'draft',
    priority: recommendation.impact.priority,
    confidenceAtCreation: recommendation.confidence,
    trigger: {
      id: `${id}-trigger-${triggerType}`,
      type: triggerType,
      sourceId: recommendation.context.outcomeId,
      description: `Loop created from ${triggerType.replace(/_/g, ' ')} trigger.`,
      createdAt: timestamp,
    },
    policies: buildPolicies(recommendation, triggerType),
    runIds: [],
    outcomeIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function evaluateLoopReadiness(loopId: string): ImprovementLoopReadiness {
  const loop = readState().loops[loopId];
  if (!loop) throw new Error(`Cannot evaluate missing improvement loop: ${loopId}`);
  const recommendation = findRecommendation(loop.recommendationId);
  const policies = recommendation ? buildPolicies(recommendation, loop.trigger.type) : loop.policies;
  const blockers = [
    ...policies.filter((policy) => policy.severity === 'blocking' && !policy.passed).map((policy) => policy.message),
    ...(recommendation?.status === 'rejected' ? ['Rejected recommendation cannot be executed.'] : []),
    ...(loop.status === 'cancelled' ? ['Cancelled loop cannot restart.'] : []),
  ];
  const approvalWarnings = policies.filter((policy) => policy.requiresApproval && policy.passed).map((policy) => policy.message);
  return {
    loopId,
    status: blockers.length ? 'blocked' : approvalWarnings.length ? 'approval_required' : 'ready',
    ready: blockers.length === 0,
    blockers,
    warnings: [
      ...policies.filter((policy) => policy.severity === 'warning').map((policy) => policy.message),
      ...approvalWarnings,
    ],
    policies,
  };
}

export function scheduleImprovementLoop(loopId: string, frequency: ImprovementLoopScheduleFrequency = 'daily'): ImprovementLoopSchedule {
  const state = readState();
  const loop = state.loops[loopId];
  if (!loop) throw new Error(`Cannot schedule missing improvement loop: ${loopId}`);
  const timestamp = nowIso();
  const nextRun = new Date(Date.now() + (frequency === 'hourly' ? 60 : frequency === 'weekly' ? 10080 : 1440) * 60 * 1000).toISOString();
  const schedule = persistSchedule({
    id: `${loopId}-schedule`,
    loopId,
    frequency,
    nextRunAt: nextRun,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  updateLoopStatus(loopId, 'scheduled', { scheduleId: schedule.id });
  return schedule;
}

export function startImprovementLoop(loopId: string): ImprovementLoopRun {
  const state = readState();
  const loop = state.loops[loopId];
  if (!loop) throw new Error(`Cannot start missing improvement loop: ${loopId}`);
  const readiness = evaluateLoopReadiness(loopId);
  if (readiness.status === 'blocked') {
    updateLoopStatus(loopId, 'waiting_review', { policies: readiness.policies, lastReviewedAt: nowIso() });
    throw new Error(`Improvement loop blocked: ${readiness.blockers.join(' ')}`);
  }
  const execution = loop.recommendationExecutionId ? startRecommendationExecution(loop.recommendationExecutionId) : undefined;
  const attempt = loop.runIds.length + 1;
  const run: ImprovementLoopRun = {
    id: improvementLoopRunId(loop.id, attempt),
    loopId,
    recommendationExecutionId: execution?.id,
    status: readiness.status === 'approval_required' ? 'waiting_review' : 'running',
    attempt,
    startedAt: nowIso(),
    evidence: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  persistRun(run);
  updateLoopStatus(loopId, run.status, { policies: readiness.policies, runIds: [...loop.runIds, run.id], lastReviewedAt: nowIso() });
  return clone(run);
}

export function pauseImprovementLoop(loopId: string): ImprovementLoop {
  return updateLoopStatus(loopId, 'paused');
}

export function resumeImprovementLoop(loopId: string): ImprovementLoop {
  const readiness = evaluateLoopReadiness(loopId);
  return updateLoopStatus(loopId, readiness.status === 'approval_required' ? 'waiting_review' : 'running', { policies: readiness.policies });
}

export function cancelImprovementLoop(loopId: string): ImprovementLoop {
  const loop = updateLoopStatus(loopId, 'cancelled');
  const state = readState();
  for (const runId of loop.runIds) {
    const run = state.runs[runId];
    if (run && !['completed', 'failed', 'cancelled'].includes(run.status)) {
      persistRun({ ...run, status: 'cancelled', updatedAt: nowIso() });
    }
  }
  return loop;
}

export function failImprovementLoopRun(runId: string, reason: string): ImprovementLoopRun {
  const state = readState();
  const run = state.runs[runId];
  if (!run) throw new Error(`Cannot fail missing improvement loop run: ${runId}`);
  const loop = state.loops[run.loopId];
  if (run.recommendationExecutionId) failRecommendationExecution(run.recommendationExecutionId, reason);
  const recommendation = loop ? findRecommendation(loop.recommendationId) : undefined;
  if (recommendation) updateRecommendationConfidence(recommendation.id, -5);
  const failedRun = persistRun({ ...run, status: 'failed', failureReason: reason, completedAt: nowIso(), updatedAt: nowIso() });
  if (loop) updateLoopStatus(loop.id, 'failed');
  return failedRun;
}

export function retryImprovementLoopRun(runId: string): ImprovementLoopRun {
  const state = readState();
  const run = state.runs[runId];
  if (!run) throw new Error(`Cannot retry missing improvement loop run: ${runId}`);
  if (run.status !== 'failed') throw new Error(`Only failed loop runs can retry: ${runId}`);
  return startImprovementLoop(run.loopId);
}

export function completeImprovementLoopRun(runId: string, evidence: string[] = ['Loop completed with measurable evidence.']): ImprovementLoopRun {
  const state = readState();
  const run = state.runs[runId];
  if (!run) throw new Error(`Cannot complete missing improvement loop run: ${runId}`);
  const loop = state.loops[run.loopId];
  if (!loop) throw new Error(`Cannot complete run for missing loop: ${run.loopId}`);
  let improvementOutcomeId: string | undefined;
  let confidenceBefore = findRecommendation(loop.recommendationId)?.confidence ?? loop.confidenceAtCreation;
  let confidenceAfter = confidenceBefore;
  let scoreDelta = 0;
  if (run.recommendationExecutionId) {
    completeRecommendationExecution(run.recommendationExecutionId, {
      type: 'note',
      title: 'Autonomous loop completion evidence',
      description: evidence.join(' '),
      createdBy: 'Improvement Loop Scheduler',
    });
    const verified = verifyRecommendationImpact(run.recommendationExecutionId);
    improvementOutcomeId = verified.impactResult?.outcomeId;
    confidenceBefore = verified.impactResult?.confidenceBefore ?? confidenceBefore;
    confidenceAfter = verified.impactResult?.confidenceAfter ?? confidenceAfter;
    scoreDelta = verified.impactResult?.scoreDelta ?? 0;
  }
  const outcome = persistOutcome({
    id: `${run.id}-outcome`,
    loopId: loop.id,
    runId: run.id,
    status: scoreDelta < 0 ? 'regressed' : 'improved',
    improvementOutcomeId,
    recommendationExecutionId: run.recommendationExecutionId,
    confidenceBefore,
    confidenceAfter,
    scoreDelta,
    createdAt: nowIso(),
  });
  const completed = persistRun({ ...run, status: 'completed', evidence, outcomeId: outcome.id, completedAt: nowIso(), updatedAt: nowIso() });
  updateLoopStatus(loop.id, 'completed', { outcomeIds: [...loop.outcomeIds, outcome.id] });
  return completed;
}

export function generateLoopRecommendations() {
  return getRecommendations('accepted').filter((recommendation) => recommendation.confidence >= MIN_CONFIDENCE);
}

export function getImprovementLoops(): ImprovementLoop[] {
  return Object.values(readState().loops).map(clone);
}

export function getActiveImprovementLoops(): ImprovementLoop[] {
  return getImprovementLoops().filter((loop) => ['scheduled', 'running', 'waiting_review'].includes(loop.status));
}

export function getPausedImprovementLoops(): ImprovementLoop[] {
  return getImprovementLoops().filter((loop) => loop.status === 'paused');
}

export function getLoopRuns(loopId?: string): ImprovementLoopRun[] {
  const runs = Object.values(readState().runs).map(clone);
  return loopId ? runs.filter((run) => run.loopId === loopId) : runs;
}

export function getLoopByRecommendation(recommendationId: string): ImprovementLoop | undefined {
  const loop = readState().loops[improvementLoopId(recommendationId)];
  return loop ? clone(loop) : undefined;
}

export function getLoopReadiness(loopId: string): ImprovementLoopReadiness {
  return evaluateLoopReadiness(loopId);
}

export function getLoopOutcomeSummary(): ImprovementLoopOutcomeSummary {
  const outcomes = Object.values(readState().outcomes);
  const deltas = outcomes.map((outcome) => outcome.confidenceAfter - outcome.confidenceBefore);
  return {
    total: outcomes.length,
    improved: outcomes.filter((outcome) => outcome.status === 'improved').length,
    regressed: outcomes.filter((outcome) => outcome.status === 'regressed').length,
    failed: outcomes.filter((outcome) => outcome.status === 'failed').length,
    pending: outcomes.filter((outcome) => outcome.status === 'pending').length,
    averageConfidenceDelta: deltas.length ? Math.round(deltas.reduce((total, delta) => total + delta, 0) / deltas.length) : 0,
    generatedAt: nowIso(),
  };
}

export function getLoopScheduleSummary(): ImprovementLoopScheduleSummary {
  const schedules = Object.values(readState().schedules);
  const activeSchedules = schedules.filter((schedule) => schedule.status === 'active');
  return {
    total: schedules.length,
    active: activeSchedules.length,
    paused: schedules.filter((schedule) => schedule.status === 'paused').length,
    cancelled: schedules.filter((schedule) => schedule.status === 'cancelled').length,
    nextRunAt: activeSchedules.sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt))[0]?.nextRunAt,
    generatedAt: nowIso(),
  };
}

export function getWorkspaceImprovementLoopSummary(): WorkspaceImprovementLoopSummary {
  const loops = getImprovementLoops();
  return {
    workspaceId: demoWorkspace.id,
    total: loops.length,
    active: loops.filter((loop) => ['scheduled', 'running'].includes(loop.status)).length,
    paused: loops.filter((loop) => loop.status === 'paused').length,
    waitingReview: loops.filter((loop) => loop.status === 'waiting_review').length,
    completed: loops.filter((loop) => loop.status === 'completed').length,
    failed: loops.filter((loop) => loop.status === 'failed').length,
    cancelled: loops.filter((loop) => loop.status === 'cancelled').length,
    outcomes: getLoopOutcomeSummary(),
    schedules: getLoopScheduleSummary(),
    generatedAt: nowIso(),
  };
}

export function exportImprovementLoopJson(): string {
  return JSON.stringify(getImprovementLoops(), null, 2);
}

export function exportImprovementLoopSummaryMarkdown(): string {
  const summary = getWorkspaceImprovementLoopSummary();
  return [
    '# Improvement Loop Summary',
    '',
    `Total loops: ${summary.total}`,
    `Active loops: ${summary.active}`,
    `Waiting review: ${summary.waitingReview}`,
    `Completed: ${summary.completed}`,
    `Failed: ${summary.failed}`,
    `Average confidence delta: ${summary.outcomes.averageConfidenceDelta}`,
    '',
  ].join('\n');
}

export function exportImprovementLoopRunsJson(): string {
  return JSON.stringify(getLoopRuns(), null, 2);
}

export function exportImprovementLoopOutcomeMarkdown(): string {
  const outcomes = Object.values(readState().outcomes);
  return [
    '# Improvement Loop Outcomes',
    '',
    ...outcomes.map((outcome) => `- ${outcome.loopId}: ${outcome.status}, confidence ${outcome.confidenceBefore} -> ${outcome.confidenceAfter}`),
    '',
  ].join('\n');
}

export function exportLearningLoopReportMarkdown(): string {
  return [
    '# Learning Loop Report',
    '',
    ...getImprovementLoops().map((loop) => `- ${loop.id}: ${loop.status}, recommendation ${loop.recommendationId}, trigger ${loop.trigger.type}`),
    '',
  ].join('\n');
}

function exportArtifact(id: string, runId: string, name: string, contentText: string, type: Artifact['type'] = 'report'): Artifact {
  return {
    id,
    runId,
    type,
    name,
    source: 'mock',
    contentSummary: `Improvement loop export for ${runId}`,
    contentText,
    createdAt: nowIso(),
  };
}

export function exportImprovementLoopArtifacts(loopId?: string): ArtifactRecord[] {
  const loop = loopId ? readState().loops[loopId] : undefined;
  const runId = loop?.runId ?? DEMO_RUN_ID;
  const exports = [
    exportArtifact(`artifact-${runId}-improvement-loop-json`, runId, 'improvement-loop.json', exportImprovementLoopJson(), 'json'),
    exportArtifact(`artifact-${runId}-improvement-loop-summary-md`, runId, 'improvement-loop-summary.md', exportImprovementLoopSummaryMarkdown(), 'markdown'),
    exportArtifact(`artifact-${runId}-improvement-loop-runs-json`, runId, 'improvement-loop-runs.json', exportImprovementLoopRunsJson(), 'json'),
    exportArtifact(`artifact-${runId}-improvement-loop-outcome-md`, runId, 'improvement-loop-outcome.md', exportImprovementLoopOutcomeMarkdown(), 'markdown'),
    exportArtifact(`artifact-${runId}-learning-loop-report-md`, runId, 'learning-loop-report.md', exportLearningLoopReportMarkdown(), 'markdown'),
  ];
  return exports.map((artifact) => registerArtifact(artifact, { type: 'EXPORT', metadata: { runId, tags: ['improvement-loop', 'learning', 'export'] } }));
}

export function clearImprovementLoopStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(IMPROVEMENT_LOOP_STORAGE_KEY);
}
