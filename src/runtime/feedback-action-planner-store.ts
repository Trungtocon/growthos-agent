import { demoWorkspace, DEMO_RUN_ID } from '../data/demo-fixtures';
import type { Artifact } from '../domain/types';
import { registerArtifact } from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import {
  feedbackPriorityWeight,
  type EvaluationFeedback,
  type FeedbackCategory,
  type FeedbackPriority,
  type ImprovementSuggestion,
} from './evaluation-feedback';
import {
  generateFeedbackForRun,
  getEvaluationFeedbackByRun,
  generateWorkspaceFeedbackSummary,
} from './evaluation-feedback-store';
import {
  feedbackActionPlanId,
  type FeedbackActionAcceptanceCriteria,
  type FeedbackActionDependency,
  type FeedbackActionOwner,
  type FeedbackActionPlan,
  type FeedbackActionPlanSummary,
  type FeedbackActionStatus,
  type FeedbackActionTask,
} from './feedback-action-planner';

const FEEDBACK_ACTION_PLAN_STORAGE_KEY = 'uikigai-feedback-action-plan-v1';

interface FeedbackActionPlanStoreState {
  plans: Record<string, FeedbackActionPlan>;
  updatedAt: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyState(): FeedbackActionPlanStoreState {
  return { plans: {}, updatedAt: new Date().toISOString() };
}

function readState(): FeedbackActionPlanStoreState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(FEEDBACK_ACTION_PLAN_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<FeedbackActionPlanStoreState>;
    return {
      plans: parsed.plans ?? {},
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: FeedbackActionPlanStoreState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(FEEDBACK_ACTION_PLAN_STORAGE_KEY, JSON.stringify(state));
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function planStatus(tasks: FeedbackActionTask[]): FeedbackActionPlan['status'] {
  if (tasks.some((task) => task.status === 'in_progress')) return 'in_progress';
  if (tasks.some((task) => task.status === 'blocked')) return 'blocked';
  if (tasks.every((task) => task.status === 'completed')) return 'completed';
  if (tasks.some((task) => task.status === 'ready')) return 'ready';
  return 'draft';
}

function taskOwner(category: FeedbackCategory): FeedbackActionOwner {
  if (category === 'governance_policy' || category === 'approval_process') return 'governance';
  if (category === 'cost_optimization') return 'cost_ops';
  if (category === 'tool_selection' || category === 'replay_integrity') return 'runtime';
  return 'agent_ops';
}

function taskTitle(suggestion: ImprovementSuggestion): string {
  const prefix: Record<FeedbackCategory, string> = {
    prompt_improvement: 'Improve prompt and planning input',
    tool_selection: 'Validate tool capability and fallback',
    artifact_quality: 'Create output schema checklist',
    approval_process: 'Review approval gate design',
    governance_policy: 'Review policy control',
    cost_optimization: 'Review budget and cost controls',
    replay_integrity: 'Add instrumentation checkpoint',
    workflow_design: 'Refactor workflow sequence',
  };
  return `${prefix[suggestion.category]}: ${suggestion.title}`;
}

function acceptanceCriteria(suggestion: ImprovementSuggestion, taskId: string): FeedbackActionAcceptanceCriteria[] {
  const categoryCriteria: Record<FeedbackCategory, string[]> = {
    prompt_improvement: ['Prompt includes input constraints, success criteria, and failure fallback.', 'Planner can produce a ready run plan from revised prompt.'],
    tool_selection: ['Tool capability matrix reviewed for selected workflow.', 'Fallback tool or retry policy documented.'],
    artifact_quality: ['Output schema or checklist exists.', 'Artifact preview validates required sections.'],
    approval_process: ['Approval trigger is explicit.', 'Reviewer owner and expected SLA are documented.'],
    governance_policy: ['Policy owner reviews suggested update.', 'Decision outcome is recorded in governance timeline.'],
    cost_optimization: ['Budget impact is estimated.', 'Cheaper model/tool alternative is documented.'],
    replay_integrity: ['Timeline event coverage is verified.', 'Replay frame count matches execution events.'],
    workflow_design: ['Workflow dependency order is documented.', 'Blocked capability path has mitigation.'],
  };
  return categoryCriteria[suggestion.category].map((description, index) => ({
    id: `criteria-${taskId}-${index + 1}`,
    taskId,
    description,
    required: true,
    completed: false,
  }));
}

function initialTaskStatus(suggestion: ImprovementSuggestion): FeedbackActionStatus {
  if (suggestion.priority === 'critical') return 'ready';
  if (suggestion.priority === 'high') return 'ready';
  return 'draft';
}

export function createActionTasksFromSuggestions(suggestions: ImprovementSuggestion[], planId = 'feedback-action-plan-draft'): FeedbackActionTask[] {
  const now = new Date().toISOString();
  return suggestions.map((suggestion) => {
    const taskId = `feedback-task-${slug(suggestion.id)}`;
    return {
      id: taskId,
      planId,
      suggestionId: suggestion.id,
      title: taskTitle(suggestion),
      description: suggestion.description,
      category: suggestion.category,
      priority: suggestion.priority,
      owner: taskOwner(suggestion.category),
      status: initialTaskStatus(suggestion),
      expectedImpact: suggestion.expectedImpact,
      acceptanceCriteria: acceptanceCriteria(suggestion, taskId),
      createdAt: now,
      updatedAt: now,
    };
  });
}

export function rankActionTasksByPriority(tasks: FeedbackActionTask[]): FeedbackActionTask[] {
  return [...tasks].sort((a, b) => (
    feedbackPriorityWeight(b.priority) - feedbackPriorityWeight(a.priority)
    || b.expectedImpact - a.expectedImpact
    || a.title.localeCompare(b.title)
  ));
}

export function detectActionDependencies(tasks: FeedbackActionTask[], planId = 'feedback-action-plan-draft'): FeedbackActionDependency[] {
  const dependencies: FeedbackActionDependency[] = [];
  const byCategory = new Map<FeedbackCategory, FeedbackActionTask>();
  for (const task of tasks) byCategory.set(task.category, task);
  const add = (task: FeedbackActionTask | undefined, dependsOn: FeedbackActionTask | undefined, reason: string) => {
    if (!task || !dependsOn || task.id === dependsOn.id) return;
    dependencies.push({
      id: `dependency-${task.id}-${dependsOn.id}`,
      planId,
      taskId: task.id,
      dependsOnTaskId: dependsOn.id,
      reason,
      blocking: true,
    });
  };
  add(byCategory.get('cost_optimization'), byCategory.get('governance_policy'), 'Budget review depends on current governance policy fit.');
  add(byCategory.get('tool_selection'), byCategory.get('workflow_design'), 'Tool capability validation depends on workflow shape.');
  add(byCategory.get('artifact_quality'), byCategory.get('prompt_improvement'), 'Artifact schema follows revised prompt and acceptance criteria.');
  add(byCategory.get('replay_integrity'), byCategory.get('tool_selection'), 'Replay instrumentation depends on known tool execution path.');
  return dependencies;
}

function applyDependencies(tasks: FeedbackActionTask[], dependencies: FeedbackActionDependency[]): FeedbackActionTask[] {
  const activeTasks = new Map(tasks.map((task) => [task.id, task]));
  return tasks.map((task) => {
    const blockingDeps = dependencies.filter((dependency) => dependency.taskId === task.id && dependency.blocking);
    const hasIncompleteDependency = blockingDeps.some((dependency) => {
      const parent = activeTasks.get(dependency.dependsOnTaskId);
      return parent && parent.status !== 'completed' && parent.status !== 'cancelled';
    });
    return hasIncompleteDependency && task.status === 'ready'
      ? { ...task, status: 'blocked' as FeedbackActionStatus, updatedAt: new Date().toISOString() }
      : task;
  });
}

function persistPlan(plan: FeedbackActionPlan): FeedbackActionPlan {
  const state = readState();
  writeState({
    plans: { ...state.plans, [plan.id]: plan },
    updatedAt: new Date().toISOString(),
  });
  return clone(plan);
}

export function createActionPlanFromFeedback(feedbackId: string): FeedbackActionPlan {
  const feedback = getFeedbackById(feedbackId);
  const existing = readState().plans[feedbackActionPlanId(feedback.id)];
  const planId = feedbackActionPlanId(feedback.id);
  const ranked = rankActionTasksByPriority(createActionTasksFromSuggestions(feedback.suggestions, planId));
  const dependencies = detectActionDependencies(ranked, planId);
  const tasks = applyDependencies(ranked, dependencies);
  const now = new Date().toISOString();
  return persistPlan({
    id: planId,
    feedbackId: feedback.id,
    runId: feedback.runId,
    status: planStatus(tasks),
    readiness: tasks.some((task) => task.status === 'blocked') ? 'blocked' : tasks.some((task) => task.status === 'ready') ? 'ready' : 'draft',
    version: existing ? existing.version + 1 : 1,
    tasks,
    dependencies,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

function getFeedbackById(feedbackId: string): EvaluationFeedback {
  if (feedbackId.startsWith('evaluation-feedback-')) {
    const runId = feedbackId.replace(/^evaluation-feedback-/, '');
    return getEvaluationFeedbackByRun(runId);
  }
  return generateFeedbackForRun(DEMO_RUN_ID);
}

export function regenerateActionPlanFromFeedback(feedbackId: string): FeedbackActionPlan {
  return createActionPlanFromFeedback(feedbackId);
}

export function getFeedbackActionPlan(planId: string): FeedbackActionPlan | undefined {
  const plan = readState().plans[planId];
  return plan ? clone(plan) : undefined;
}

export function getFeedbackActionPlanByRun(runId = DEMO_RUN_ID): FeedbackActionPlan {
  const feedback = getEvaluationFeedbackByRun(runId);
  const planId = feedbackActionPlanId(feedback.id);
  return getFeedbackActionPlan(planId) ?? createActionPlanFromFeedback(feedback.id);
}

export function getActionPlansByRun(runId = DEMO_RUN_ID): FeedbackActionPlan[] {
  return Object.values(readState().plans).filter((plan) => plan.runId === runId).map(clone);
}

export function getActionTasksByStatus(status: FeedbackActionStatus, runId = DEMO_RUN_ID): FeedbackActionTask[] {
  return getFeedbackActionPlanByRun(runId).tasks.filter((task) => task.status === status);
}

export function getReadyActionTasks(runId = DEMO_RUN_ID): FeedbackActionTask[] {
  return getActionTasksByStatus('ready', runId);
}

export function getBlockedActionTasks(runId = DEMO_RUN_ID): FeedbackActionTask[] {
  return getActionTasksByStatus('blocked', runId);
}

export function evaluateActionReadiness(planId: string): FeedbackActionPlan['readiness'] {
  const plan = getFeedbackActionPlan(planId);
  if (!plan) return 'draft';
  if (plan.tasks.some((task) => task.status === 'blocked')) return 'blocked';
  if (plan.tasks.some((task) => task.status === 'ready' || task.status === 'in_progress')) return 'ready';
  return 'draft';
}

export function markActionTaskStatus(taskId: string, status: FeedbackActionStatus): FeedbackActionTask | undefined {
  const state = readState();
  const plan = Object.values(state.plans).find((item) => item.tasks.some((task) => task.id === taskId));
  if (!plan) return undefined;
  const now = new Date().toISOString();
  const tasks = plan.tasks.map((task) => task.id === taskId ? { ...task, status, updatedAt: now } : task);
  const nextPlan: FeedbackActionPlan = {
    ...plan,
    tasks,
    status: planStatus(tasks),
    readiness: tasks.some((task) => task.status === 'blocked') ? 'blocked' : tasks.some((task) => task.status === 'ready' || task.status === 'in_progress') ? 'ready' : 'draft',
    updatedAt: now,
  };
  persistPlan(nextPlan);
  return clone(nextPlan.tasks.find((task) => task.id === taskId));
}

export function generateActionPlanSummary(planId: string): string {
  const plan = getFeedbackActionPlan(planId) ?? getFeedbackActionPlanByRun(DEMO_RUN_ID);
  return [
    `Plan ${plan.id}`,
    `Run ${plan.runId}`,
    `Status ${plan.status}`,
    `Readiness ${plan.readiness}`,
    `Tasks ${plan.tasks.length}`,
    `Dependencies ${plan.dependencies.length}`,
  ].join(' | ');
}

export function getActionPlanReadiness(planId: string): { planId: string; readiness: FeedbackActionPlan['readiness']; blocked: number; ready: number } {
  const plan = getFeedbackActionPlan(planId) ?? getFeedbackActionPlanByRun(DEMO_RUN_ID);
  return {
    planId: plan.id,
    readiness: evaluateActionReadiness(plan.id),
    blocked: plan.tasks.filter((task) => task.status === 'blocked').length,
    ready: plan.tasks.filter((task) => task.status === 'ready').length,
  };
}

export function getWorkspaceActionPlanSummary(workspaceId = demoWorkspace.id): FeedbackActionPlanSummary {
  const feedbackSummary = generateWorkspaceFeedbackSummary(workspaceId);
  const plans = Object.values(readState().plans);
  const tasks = plans.flatMap((plan) => plan.tasks);
  return {
    workspaceId,
    planCount: plans.length,
    taskCount: tasks.length,
    readyTasks: tasks.filter((task) => task.status === 'ready').length,
    blockedTasks: tasks.filter((task) => task.status === 'blocked').length,
    completedTasks: tasks.filter((task) => task.status === 'completed').length,
    totalExpectedImpact: tasks.reduce((total, task) => total + task.expectedImpact, 0),
    generatedAt: feedbackSummary.generatedAt,
  };
}

export function exportFeedbackActionPlanJson(runId = DEMO_RUN_ID): string {
  return JSON.stringify(getFeedbackActionPlanByRun(runId), null, 2);
}

export function exportFeedbackActionPlanMarkdown(runId = DEMO_RUN_ID): string {
  const plan = getFeedbackActionPlanByRun(runId);
  return [
    '# Feedback Action Plan',
    '',
    `Plan: ${plan.id}`,
    `Run: ${plan.runId}`,
    `Status: ${plan.status}`,
    `Readiness: ${plan.readiness}`,
    '',
    '| Task | Priority | Owner | Status |',
    '|---|---|---|---|',
    ...plan.tasks.map((task) => `| ${task.title} | ${task.priority} | ${task.owner} | ${task.status} |`),
    '',
  ].join('\n');
}

export function exportFeedbackActionTasksJson(runId = DEMO_RUN_ID): string {
  return JSON.stringify(getFeedbackActionPlanByRun(runId).tasks, null, 2);
}

export function exportImprovementRoadmapMarkdown(runId = DEMO_RUN_ID): string {
  const plan = getFeedbackActionPlanByRun(runId);
  return [
    '# Improvement Roadmap',
    '',
    ...plan.tasks.map((task, index) => `${index + 1}. [${task.priority.toUpperCase()}] ${task.title} - ${task.status}`),
    '',
    '## Dependencies',
    ...plan.dependencies.map((dependency) => `- ${dependency.taskId} depends on ${dependency.dependsOnTaskId}: ${dependency.reason}`),
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
    contentSummary: `Feedback action plan export for ${runId}`,
    contentText,
    createdAt: new Date().toISOString(),
  };
}

export function registerFeedbackActionPlanExports(runId = DEMO_RUN_ID): ArtifactRecord[] {
  const exports = [
    exportArtifact(`artifact-${runId}-feedback-action-plan-json`, runId, 'feedback-action-plan.json', exportFeedbackActionPlanJson(runId), 'json'),
    exportArtifact(`artifact-${runId}-feedback-action-plan-md`, runId, 'feedback-action-plan.md', exportFeedbackActionPlanMarkdown(runId), 'markdown'),
    exportArtifact(`artifact-${runId}-feedback-action-tasks-json`, runId, 'feedback-action-tasks.json', exportFeedbackActionTasksJson(runId), 'json'),
    exportArtifact(`artifact-${runId}-improvement-roadmap-md`, runId, 'improvement-roadmap.md', exportImprovementRoadmapMarkdown(runId), 'markdown'),
  ];
  return exports.map((artifact) => registerArtifact(artifact, { type: 'EXPORT', metadata: { runId, tags: ['feedback-action-plan', 'improvement', 'export'] } }));
}

export function clearFeedbackActionPlanStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(FEEDBACK_ACTION_PLAN_STORAGE_KEY);
}
