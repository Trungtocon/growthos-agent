import { DEMO_AGENT_ID, DEMO_RUN_ID, demoWorkspace } from '../data/demo-fixtures';
import type { Artifact } from '../domain/types';
import type { ArtifactRecord } from './artifact-registry';
import { registerArtifact } from './artifact-registry-store';
import type { ImprovementOutcome, OutcomeVerificationStatus } from './improvement-outcome';
import { getOutcomesByRun } from './improvement-outcome-store';
import {
  buildRecommendationFromSignal,
  calculateRecommendationConfidenceFromSignals,
} from './recommendation-engine';
import {
  learningSignalId,
  priorityRank,
  recommendationContextKey,
  signalTypeFromOutcome,
  type LearningMemory,
  type LearningMemorySummary,
  type LearningSignal,
  type Recommendation,
  type RecommendationContext,
  type RecommendationStatus,
} from './learning-memory';
import type { RunEvaluationDimension } from './run-evaluation';

const LEARNING_MEMORY_STORAGE_KEY = 'uikigai-learning-memory-v1';
const DEFAULT_WORKFLOW_ID = 'demo-run-execution';

interface LearningMemoryStoreState {
  signals: Record<string, LearningSignal>;
  recommendations: Record<string, Recommendation>;
  updatedAt: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyState(): LearningMemoryStoreState {
  return {
    signals: {},
    recommendations: {},
    updatedAt: nowIso(),
  };
}

function readState(): LearningMemoryStoreState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(LEARNING_MEMORY_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<LearningMemoryStoreState>;
    return {
      signals: parsed.signals ?? {},
      recommendations: parsed.recommendations ?? {},
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: LearningMemoryStoreState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(LEARNING_MEMORY_STORAGE_KEY, JSON.stringify(state));
}

function findOutcome(outcomeId: string): ImprovementOutcome | undefined {
  return getOutcomesByRun(DEMO_RUN_ID).find((outcome) => outcome.id === outcomeId || outcome.actionExecutionId === outcomeId || outcome.actionTaskExecutionId === outcomeId);
}

function statusStrength(status: OutcomeVerificationStatus): number {
  if (status === 'improved') return 85;
  if (status === 'regressed') return 78;
  if (status === 'unchanged') return 45;
  return 35;
}

function signalFromOutcome(outcome: ImprovementOutcome): LearningSignal {
  const timestamp = nowIso();
  const targetDimensions = outcome.targetDimensions.length
    ? outcome.targetDimensions
    : ['overall_score' as RunEvaluationDimension];
  return {
    id: learningSignalId(outcome.id),
    outcomeId: outcome.id,
    runId: outcome.runId,
    agentId: DEMO_AGENT_ID,
    workflowId: DEFAULT_WORKFLOW_ID,
    type: signalTypeFromOutcome(outcome.status),
    sourceStatus: outcome.status,
    strength: statusStrength(outcome.status),
    targetDimensions,
    evidenceIds: outcome.evidence.map((evidence) => evidence.id),
    createdAt: timestamp,
  };
}

function persistSignal(signal: LearningSignal): LearningSignal {
  const state = readState();
  const existing = state.signals[signal.id];
  if (existing) return clone(existing);
  writeState({
    ...state,
    signals: { ...state.signals, [signal.id]: signal },
    updatedAt: nowIso(),
  });
  return clone(signal);
}

function sameRecommendationContext(left: Recommendation, right: Recommendation): boolean {
  return recommendationContextKey(left.type, left.context) === recommendationContextKey(right.type, right.context);
}

function mergeRecommendation(existing: Recommendation, incoming: Recommendation, signals: LearningSignal[]): Recommendation {
  const evidenceById = new Map([...existing.evidence, ...incoming.evidence].map((evidence) => [evidence.id, evidence]));
  const confidence = calculateRecommendationConfidenceFromSignals(existing, signals);
  return {
    ...existing,
    confidence,
    impact: { ...existing.impact, confidence },
    evidence: [...evidenceById.values()],
    updatedAt: nowIso(),
  };
}

function persistRecommendation(recommendation: Recommendation): Recommendation {
  const state = readState();
  const signals = Object.values(state.signals);
  const duplicate = Object.values(state.recommendations).find((candidate) => sameRecommendationContext(candidate, recommendation));
  const next = duplicate ? mergeRecommendation(duplicate, recommendation, signals) : recommendation;
  writeState({
    ...state,
    recommendations: { ...state.recommendations, [next.id]: next },
    updatedAt: nowIso(),
  });
  return clone(next);
}

function allSignals(): LearningSignal[] {
  return Object.values(readState().signals).map(clone);
}

function allRecommendations(): Recommendation[] {
  return Object.values(readState().recommendations).map(clone);
}

function sortRecommendations(recommendations: Recommendation[]): Recommendation[] {
  return recommendations.sort((a, b) => {
    const priorityDelta = priorityRank(b.impact.priority) - priorityRank(a.impact.priority);
    if (priorityDelta) return priorityDelta;
    return b.confidence - a.confidence;
  });
}

function matchesContext(recommendation: Recommendation, context: Partial<RecommendationContext>): boolean {
  if (context.runId && recommendation.context.runId !== context.runId) return false;
  if (context.agentId && recommendation.context.agentId !== context.agentId) return false;
  if (context.workflowId && recommendation.context.workflowId !== context.workflowId) return false;
  return true;
}

export function createLearningSignalFromOutcome(outcomeId: string): LearningSignal {
  const outcome = findOutcome(outcomeId);
  if (!outcome) {
    throw new Error(`Cannot create learning signal for missing outcome: ${outcomeId}`);
  }
  return persistSignal(signalFromOutcome(outcome));
}

export function generateRecommendationFromSignal(signalId: string): Recommendation {
  const state = readState();
  const signal = state.signals[signalId];
  if (!signal) throw new Error(`Cannot generate recommendation for missing signal: ${signalId}`);
  return persistRecommendation(buildRecommendationFromSignal(signal));
}

export function rankRecommendations(context: Partial<RecommendationContext> = {}): Recommendation[] {
  return sortRecommendations(allRecommendations().filter((recommendation) => matchesContext(recommendation, context)));
}

export function getRecommendationsForRun(runId = DEMO_RUN_ID): Recommendation[] {
  return rankRecommendations({ runId });
}

export function getRecommendationsForAgent(agentId = DEMO_AGENT_ID): Recommendation[] {
  return rankRecommendations({ agentId });
}

export function getRecommendationsForWorkflow(workflowId = DEFAULT_WORKFLOW_ID): Recommendation[] {
  return rankRecommendations({ workflowId });
}

export function markRecommendationAccepted(recommendationId: string): Recommendation {
  const state = readState();
  const existing = state.recommendations[recommendationId];
  if (!existing) throw new Error(`Cannot accept missing recommendation: ${recommendationId}`);
  const updated: Recommendation = {
    ...existing,
    status: 'accepted',
    acceptedAt: nowIso(),
    rejectedAt: undefined,
    rejectionReason: undefined,
    updatedAt: nowIso(),
  };
  writeState({
    ...state,
    recommendations: { ...state.recommendations, [recommendationId]: updated },
    updatedAt: nowIso(),
  });
  return clone(updated);
}

export function markRecommendationRejected(recommendationId: string, reason: string): Recommendation {
  const state = readState();
  const existing = state.recommendations[recommendationId];
  if (!existing) throw new Error(`Cannot reject missing recommendation: ${recommendationId}`);
  const updated: Recommendation = {
    ...existing,
    status: 'rejected',
    rejectedAt: nowIso(),
    rejectionReason: reason,
    updatedAt: nowIso(),
  };
  writeState({
    ...state,
    recommendations: { ...state.recommendations, [recommendationId]: updated },
    updatedAt: nowIso(),
  });
  return clone(updated);
}

export function updateRecommendationConfidence(recommendationId: string, delta: number): Recommendation {
  const state = readState();
  const existing = state.recommendations[recommendationId];
  if (!existing) throw new Error(`Cannot update missing recommendation: ${recommendationId}`);
  const confidence = Math.max(0, Math.min(99, existing.confidence + delta));
  const updated: Recommendation = {
    ...existing,
    confidence,
    impact: { ...existing.impact, confidence },
    updatedAt: nowIso(),
  };
  writeState({
    ...state,
    recommendations: { ...state.recommendations, [recommendationId]: updated },
    updatedAt: nowIso(),
  });
  return clone(updated);
}

export function calculateRecommendationConfidence(recommendationId: string): number {
  const state = readState();
  const recommendation = state.recommendations[recommendationId];
  if (!recommendation) return 0;
  return calculateRecommendationConfidenceFromSignals(recommendation, Object.values(state.signals));
}

export function getLearningSignals(): LearningSignal[] {
  return allSignals();
}

export function getRecommendations(status?: RecommendationStatus): Recommendation[] {
  const recommendations = allRecommendations();
  return sortRecommendations(status ? recommendations.filter((recommendation) => recommendation.status === status) : recommendations);
}

export function getTopRecommendations(limit = 5): Recommendation[] {
  return rankRecommendations().slice(0, limit);
}

export function getLearningMemory(workspaceId = demoWorkspace.id): LearningMemory {
  const state = readState();
  return {
    id: `learning-memory-${workspaceId}`,
    workspaceId,
    signals: Object.values(state.signals).map(clone),
    recommendations: Object.values(state.recommendations).map(clone),
    updatedAt: state.updatedAt,
  };
}

export function getLearningMemorySummary(workspaceId = demoWorkspace.id): LearningMemorySummary {
  const recommendations = allRecommendations();
  const confidenceTotal = recommendations.reduce((total, recommendation) => total + recommendation.confidence, 0);
  return {
    workspaceId,
    signalCount: allSignals().length,
    recommendationCount: recommendations.length,
    proposed: recommendations.filter((recommendation) => recommendation.status === 'proposed').length,
    accepted: recommendations.filter((recommendation) => recommendation.status === 'accepted').length,
    rejected: recommendations.filter((recommendation) => recommendation.status === 'rejected').length,
    averageConfidence: recommendations.length ? Math.round(confidenceTotal / recommendations.length) : 0,
    generatedAt: nowIso(),
  };
}

export function exportLearningMemoryJson(runId = DEMO_RUN_ID): string {
  return JSON.stringify({
    signals: getLearningSignals().filter((signal) => signal.runId === runId),
    recommendations: getRecommendationsForRun(runId),
  }, null, 2);
}

export function exportRecommendationsJson(runId = DEMO_RUN_ID): string {
  return JSON.stringify(getRecommendationsForRun(runId), null, 2);
}

export function exportRecommendationSummaryMarkdown(runId = DEMO_RUN_ID): string {
  const recommendations = getRecommendationsForRun(runId);
  return [
    '# Recommendation Summary',
    '',
    `Run: ${runId}`,
    '',
    '| Recommendation | Type | Status | Confidence |',
    '|---|---|---|---:|',
    ...recommendations.map((recommendation) => `| ${recommendation.title} | ${recommendation.type} | ${recommendation.status} | ${recommendation.confidence} |`),
    '',
  ].join('\n');
}

export function exportRecommendationEvidenceMarkdown(runId = DEMO_RUN_ID): string {
  return [
    '# Recommendation Evidence',
    '',
    ...getRecommendationsForRun(runId).flatMap((recommendation) => recommendation.evidence.map((evidence) => `- ${recommendation.title}: ${evidence.title} - ${evidence.description}`)),
    '',
  ].join('\n');
}

export function exportLearningSignalReportJson(runId = DEMO_RUN_ID): string {
  return JSON.stringify(getLearningSignals().filter((signal) => signal.runId === runId), null, 2);
}

function exportArtifact(id: string, runId: string, name: string, contentText: string, type: Artifact['type'] = 'report'): Artifact {
  return {
    id,
    runId,
    type,
    name,
    source: 'mock',
    contentSummary: `Learning memory export for ${runId}`,
    contentText,
    createdAt: nowIso(),
  };
}

export function registerLearningMemoryExports(runId = DEMO_RUN_ID): ArtifactRecord[] {
  const exports = [
    exportArtifact(`artifact-${runId}-learning-memory-json`, runId, 'learning-memory.json', exportLearningMemoryJson(runId), 'json'),
    exportArtifact(`artifact-${runId}-recommendations-json`, runId, 'recommendations.json', exportRecommendationsJson(runId), 'json'),
    exportArtifact(`artifact-${runId}-recommendation-summary-md`, runId, 'recommendation-summary.md', exportRecommendationSummaryMarkdown(runId), 'markdown'),
    exportArtifact(`artifact-${runId}-recommendation-evidence-md`, runId, 'recommendation-evidence.md', exportRecommendationEvidenceMarkdown(runId), 'markdown'),
    exportArtifact(`artifact-${runId}-learning-signal-report-json`, runId, 'learning-signal-report.json', exportLearningSignalReportJson(runId), 'json'),
  ];
  return exports.map((artifact) => registerArtifact(artifact, { type: 'EXPORT', metadata: { runId, tags: ['learning-memory', 'recommendations', 'export'] } }));
}

export function clearLearningMemoryStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(LEARNING_MEMORY_STORAGE_KEY);
}
