import { DEMO_RUN_ID, demoWorkspace } from '../data/demo-fixtures';
import type { Artifact } from '../domain/types';
import { registerArtifact } from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import {
  evaluateRun,
  getRunEvaluation,
  getRunsByEvaluationScore,
} from './run-evaluation-store';
import type {
  RunEvaluation,
  RunEvaluationDimension,
  RunEvaluationIssue,
  RunEvaluationRecommendation,
} from './run-evaluation';
import {
  evaluationFeedbackId,
  feedbackPriorityWeight,
  priorityFromIssue,
  priorityFromRecommendation,
  priorityFromScore,
  type EvaluationFeedback,
  type FeedbackAction,
  type FeedbackCategory,
  type FeedbackLearning,
  type FeedbackPriority,
  type ImprovementSuggestion,
  type WorkspaceFeedbackSummary,
} from './evaluation-feedback';

const EVALUATION_FEEDBACK_STORAGE_KEY = 'uikigai-evaluation-feedback-v1';

interface EvaluationFeedbackStoreState {
  feedback: Record<string, EvaluationFeedback>;
  updatedAt: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyState(): EvaluationFeedbackStoreState {
  return { feedback: {}, updatedAt: new Date().toISOString() };
}

function readState(): EvaluationFeedbackStoreState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(EVALUATION_FEEDBACK_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<EvaluationFeedbackStoreState>;
    return {
      feedback: parsed.feedback ?? {},
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: EvaluationFeedbackStoreState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(EVALUATION_FEEDBACK_STORAGE_KEY, JSON.stringify(state));
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function dimensionCategory(dimension: RunEvaluationDimension): FeedbackCategory {
  if (dimension === 'task_completion') return 'prompt_improvement';
  if (dimension === 'artifact_quality') return 'artifact_quality';
  if (dimension === 'tool_success') return 'tool_selection';
  if (dimension === 'approval_compliance') return 'approval_process';
  if (dimension === 'governance_compliance') return 'governance_policy';
  if (dimension === 'cost_efficiency') return 'cost_optimization';
  if (dimension === 'replay_integrity') return 'replay_integrity';
  return 'workflow_design';
}

function defaultTitle(category: FeedbackCategory): string {
  const titles: Record<FeedbackCategory, string> = {
    prompt_improvement: 'Tighten run input and planning prompt',
    tool_selection: 'Add tool fallback and retry criteria',
    artifact_quality: 'Define output schema and artifact validation',
    approval_process: 'Refine approval gate timing',
    governance_policy: 'Review governance policy fit',
    cost_optimization: 'Tune model/tool cost profile',
    replay_integrity: 'Improve timeline and replay instrumentation',
    workflow_design: 'Rebalance workflow design',
  };
  return titles[category];
}

function actionOwner(category: FeedbackCategory): FeedbackAction['owner'] {
  if (category === 'governance_policy' || category === 'approval_process') return 'governance';
  if (category === 'cost_optimization') return 'cost_ops';
  if (category === 'tool_selection' || category === 'replay_integrity') return 'runtime';
  return 'agent_ops';
}

function suggestionFromIssue(issue: RunEvaluationIssue): ImprovementSuggestion {
  const category = dimensionCategory(issue.dimension);
  const priority = priorityFromIssue(issue);
  return {
    id: `suggestion-${issue.id}`,
    category,
    priority,
    title: defaultTitle(category),
    description: `${issue.title}: ${issue.description}`,
    expectedImpact: priority === 'critical' ? 32 : 22,
    sourceIssueId: issue.id,
  };
}

function suggestionFromRecommendation(recommendation: RunEvaluationRecommendation): ImprovementSuggestion {
  const category = dimensionCategory(recommendation.dimension);
  const priority = priorityFromRecommendation(recommendation);
  return {
    id: `suggestion-${recommendation.id}`,
    category,
    priority,
    title: recommendation.title,
    description: recommendation.description,
    expectedImpact: priority === 'high' ? 18 : priority === 'medium' ? 12 : 6,
    sourceRecommendationId: recommendation.id,
  };
}

function suggestionFromLowScore(evaluation: RunEvaluation): ImprovementSuggestion[] {
  return evaluation.scores
    .filter((score) => score.dimension !== 'overall_score' && score.value < 82)
    .map((score) => {
      const category = dimensionCategory(score.dimension);
      const priority = priorityFromScore(score.value);
      return {
        id: `suggestion-score-${evaluation.runId}-${score.dimension}`,
        category,
        priority,
        title: defaultTitle(category),
        description: `Score ${score.value}/100. Evidence: ${score.evidence}`,
        expectedImpact: Math.max(8, Math.round((90 - score.value) * 0.55)),
      };
    });
}

function dedupeSuggestions(suggestions: ImprovementSuggestion[]): ImprovementSuggestion[] {
  const byId = new Map<string, ImprovementSuggestion>();
  for (const suggestion of suggestions) {
    const existing = byId.get(suggestion.id);
    if (!existing || feedbackPriorityWeight(suggestion.priority) > feedbackPriorityWeight(existing.priority)) {
      byId.set(suggestion.id, suggestion);
    }
  }
  return [...byId.values()];
}

export function convertIssuesToSuggestions(issues: RunEvaluationIssue[]): ImprovementSuggestion[] {
  return dedupeSuggestions(issues.map(suggestionFromIssue));
}

export function rankSuggestionsByImpact(suggestions: ImprovementSuggestion[]): ImprovementSuggestion[] {
  return [...suggestions].sort((a, b) => (
    feedbackPriorityWeight(b.priority) - feedbackPriorityWeight(a.priority)
    || b.expectedImpact - a.expectedImpact
    || a.title.localeCompare(b.title)
  ));
}

export function createFeedbackActions(suggestions: ImprovementSuggestion[]): FeedbackAction[] {
  return suggestions.map((suggestion, index) => ({
    id: `feedback-action-${suggestion.id}`,
    suggestionId: suggestion.id,
    title: `Apply: ${suggestion.title}`,
    owner: actionOwner(suggestion.category),
    status: index < 3 ? 'queued' : 'open',
    dueInDays: suggestion.priority === 'critical' ? 1 : suggestion.priority === 'high' ? 3 : suggestion.priority === 'medium' ? 7 : 14,
  }));
}

function createLearnings(evaluation: RunEvaluation, suggestions: ImprovementSuggestion[]): FeedbackLearning[] {
  const grouped = suggestions.reduce<Record<string, number>>((acc, suggestion) => {
    acc[suggestion.category] = (acc[suggestion.category] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(grouped).map(([category, count]) => ({
    id: `feedback-learning-${evaluation.runId}-${category}`,
    category: category as FeedbackCategory,
    summary: `${count} improvement signal(s) detected for ${category.replace(/_/g, ' ')}.`,
    evidence: `Run ${evaluation.runId} overall score ${evaluation.overallScore}; ${evaluation.issues.length} issue(s).`,
    createdAt: new Date().toISOString(),
  }));
}

function persistFeedback(feedback: EvaluationFeedback): EvaluationFeedback {
  const state = readState();
  writeState({
    feedback: { ...state.feedback, [feedback.id]: feedback },
    updatedAt: new Date().toISOString(),
  });
  return clone(feedback);
}

function buildFeedback(evaluation: RunEvaluation, existing?: EvaluationFeedback): EvaluationFeedback {
  const baseSuggestions = [
    ...convertIssuesToSuggestions(evaluation.issues),
    ...evaluation.recommendations.map(suggestionFromRecommendation),
    ...suggestionFromLowScore(evaluation),
  ];
  const suggestions = rankSuggestionsByImpact(dedupeSuggestions(baseSuggestions));
  const now = new Date().toISOString();
  return {
    id: evaluationFeedbackId(evaluation.runId),
    runId: evaluation.runId,
    evaluationId: evaluation.id,
    version: existing ? existing.version + 1 : 1,
    suggestions,
    actions: createFeedbackActions(suggestions),
    learnings: createLearnings(evaluation, suggestions),
    generatedAt: existing?.generatedAt ?? now,
    updatedAt: now,
  };
}

export function generateFeedbackForRun(runId = DEMO_RUN_ID): EvaluationFeedback {
  const evaluation = getRunEvaluation(runId);
  const existing = readState().feedback[evaluationFeedbackId(runId)];
  return persistFeedback(buildFeedback(evaluation, existing));
}

export function generateFeedbackFromEvaluation(evaluationId: string): EvaluationFeedback {
  const knownEvaluation = getRunsByEvaluationScore(0).find((evaluation) => evaluation.id === evaluationId);
  if (knownEvaluation) return persistFeedback(buildFeedback(knownEvaluation, readState().feedback[evaluationFeedbackId(knownEvaluation.runId)]));
  const fallbackRunId = evaluationId.replace(/^run-evaluation-/, '');
  return generateFeedbackForRun(fallbackRunId);
}

export function regenerateFeedbackForRun(runId = DEMO_RUN_ID): EvaluationFeedback {
  evaluateRun(runId);
  return generateFeedbackForRun(runId);
}

export function getEvaluationFeedbackByRun(runId = DEMO_RUN_ID): EvaluationFeedback {
  const existing = readState().feedback[evaluationFeedbackId(runId)];
  return existing ? clone(existing) : generateFeedbackForRun(runId);
}

export function getFeedbackSuggestions(runId = DEMO_RUN_ID): ImprovementSuggestion[] {
  return getEvaluationFeedbackByRun(runId).suggestions;
}

export function getFeedbackByPriority(priority: FeedbackPriority, runId = DEMO_RUN_ID): ImprovementSuggestion[] {
  return getFeedbackSuggestions(runId).filter((suggestion) => suggestion.priority === priority);
}

export function getFeedbackActions(runId = DEMO_RUN_ID): FeedbackAction[] {
  return getEvaluationFeedbackByRun(runId).actions;
}

export function getTopImprovementSuggestions(limit = 5, runId = DEMO_RUN_ID): ImprovementSuggestion[] {
  return getFeedbackSuggestions(runId).slice(0, limit);
}

export function getCriticalFeedbackItems(runId = DEMO_RUN_ID): ImprovementSuggestion[] {
  return getFeedbackSuggestions(runId).filter((suggestion) => suggestion.priority === 'critical');
}

export function generateWorkspaceFeedbackSummary(workspaceId = demoWorkspace.id): WorkspaceFeedbackSummary {
  const evaluations = getRunsByEvaluationScore(0);
  const feedback = evaluations.map((evaluation) => getEvaluationFeedbackByRun(evaluation.runId));
  const suggestions = feedback.flatMap((item) => item.suggestions);
  const categoryCounts = suggestions.reduce<Record<string, number>>((acc, suggestion) => {
    acc[suggestion.category] = (acc[suggestion.category] ?? 0) + 1;
    return acc;
  }, {});
  return {
    workspaceId,
    feedbackCount: feedback.length,
    suggestionCount: suggestions.length,
    actionCount: feedback.reduce((total, item) => total + item.actions.length, 0),
    criticalCount: suggestions.filter((suggestion) => suggestion.priority === 'critical').length,
    highCount: suggestions.filter((suggestion) => suggestion.priority === 'high').length,
    topCategories: Object.entries(categoryCounts)
      .map(([category, count]) => ({ category: category as FeedbackCategory, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    generatedAt: new Date().toISOString(),
  };
}

export function exportEvaluationFeedbackJson(runId = DEMO_RUN_ID): string {
  return JSON.stringify(getEvaluationFeedbackByRun(runId), null, 2);
}

export function exportImprovementSuggestionsMarkdown(runId = DEMO_RUN_ID): string {
  const feedback = getEvaluationFeedbackByRun(runId);
  return [
    '# Improvement Suggestions',
    '',
    `Run: ${runId}`,
    `Feedback version: ${feedback.version}`,
    '',
    '| Priority | Category | Suggestion | Expected impact |',
    '|---|---|---|---:|',
    ...feedback.suggestions.map((suggestion) => `| ${suggestion.priority} | ${suggestion.category} | ${suggestion.title} | ${suggestion.expectedImpact} |`),
    '',
  ].join('\n');
}

export function exportFeedbackActionsJson(runId = DEMO_RUN_ID): string {
  return JSON.stringify(getFeedbackActions(runId), null, 2);
}

export function exportWorkspaceFeedbackSummaryMarkdown(workspaceId = demoWorkspace.id): string {
  const summary = generateWorkspaceFeedbackSummary(workspaceId);
  return [
    '# Workspace Feedback Summary',
    '',
    `Workspace: ${summary.workspaceId}`,
    `Feedback items: ${summary.feedbackCount}`,
    `Suggestions: ${summary.suggestionCount}`,
    `Actions: ${summary.actionCount}`,
    '',
    '| Category | Count |',
    '|---|---:|',
    ...summary.topCategories.map((item) => `| ${item.category} | ${item.count} |`),
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
    contentSummary: `Evaluation feedback export for ${runId}`,
    contentText,
    createdAt: new Date().toISOString(),
  };
}

export function registerEvaluationFeedbackExports(runId = DEMO_RUN_ID): ArtifactRecord[] {
  const exports = [
    exportArtifact(`artifact-${runId}-evaluation-feedback-json`, runId, 'evaluation-feedback.json', exportEvaluationFeedbackJson(runId), 'json'),
    exportArtifact(`artifact-${runId}-improvement-suggestions-md`, runId, 'improvement-suggestions.md', exportImprovementSuggestionsMarkdown(runId), 'markdown'),
    exportArtifact(`artifact-${runId}-feedback-actions-json`, runId, 'feedback-actions.json', exportFeedbackActionsJson(runId), 'json'),
    exportArtifact(`artifact-${runId}-workspace-feedback-summary-md`, runId, 'workspace-feedback-summary.md', exportWorkspaceFeedbackSummaryMarkdown(), 'markdown'),
  ];
  return exports.map((artifact) => registerArtifact(artifact, { type: 'EXPORT', metadata: { runId, tags: ['evaluation-feedback', 'suggestions', 'export'] } }));
}

export function clearEvaluationFeedbackStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(EVALUATION_FEEDBACK_STORAGE_KEY);
}
