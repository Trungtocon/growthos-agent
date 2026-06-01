import { demoWorkspace, DEMO_RUN_ID } from '../data/demo-fixtures';
import type { Artifact } from '../domain/types';
import type { ArtifactRecord } from './artifact-registry';
import { registerArtifact } from './artifact-registry-store';
import {
  actionPlanExecutionId,
  actionTaskExecutionId,
  type ActionCompletionEvidence,
  type ActionExecutionEvent,
  type ActionPlanExecution,
  type ActionProgressSnapshot,
  type ActionTaskExecution,
  type ActionTaskLifecycleStatus,
  type WorkspaceImprovementProgress,
} from './action-plan-execution';
import type { FeedbackActionPlan, FeedbackActionTask } from './feedback-action-planner';
import { createActionPlanFromFeedback, getFeedbackActionPlan, getFeedbackActionPlanByRun } from './feedback-action-planner-store';

const ACTION_PLAN_EXECUTION_STORAGE_KEY = 'uikigai-action-plan-execution-v1';

interface ActionPlanExecutionStoreState {
  executions: Record<string, ActionPlanExecution>;
  updatedAt: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyState(): ActionPlanExecutionStoreState {
  return { executions: {}, updatedAt: new Date().toISOString() };
}

function readState(): ActionPlanExecutionStoreState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(ACTION_PLAN_EXECUTION_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ActionPlanExecutionStoreState>;
    return {
      executions: parsed.executions ?? {},
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: ActionPlanExecutionStoreState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(ACTION_PLAN_EXECUTION_STORAGE_KEY, JSON.stringify(state));
}

function eventId(planId: string, type: ActionExecutionEvent['type'], taskId?: string): string {
  return `action-event-${planId}-${taskId ?? 'plan'}-${type}-${Date.now()}`;
}

function priorityWeight(priority: FeedbackActionTask['priority']): number {
  if (priority === 'critical') return 4;
  if (priority === 'high') return 3;
  if (priority === 'medium') return 2;
  return 1;
}

function statusFromPlanner(task: FeedbackActionTask): ActionTaskLifecycleStatus {
  if (task.status === 'ready') return 'ready';
  if (task.status === 'blocked') return 'blocked';
  if (task.status === 'in_progress') return 'in_progress';
  if (task.status === 'completed') return 'completed';
  if (task.status === 'cancelled') return 'cancelled';
  return 'pending';
}

function taskFromPlanner(task: FeedbackActionTask): ActionTaskExecution {
  const status = statusFromPlanner(task);
  const progress = status === 'completed' ? 100 : status === 'in_progress' ? 35 : 0;
  return {
    id: actionTaskExecutionId(task.id),
    planId: task.planId,
    taskId: task.id,
    title: task.title,
    owner: task.owner,
    priority: task.priority,
    status,
    progress,
    updatedAt: new Date().toISOString(),
    notes: [],
    evidence: [],
  };
}

function calculateProgressFromTasks(planId: string, tasks: ActionTaskExecution[]): ActionProgressSnapshot {
  const totalWeight = tasks.reduce((total, task) => total + priorityWeight(task.priority), 0) || 1;
  const completeWeight = tasks.reduce((total, task) => total + (task.progress / 100) * priorityWeight(task.priority), 0);
  const completedTasks = tasks.filter((task) => task.status === 'completed').length;
  const blockedTasks = tasks.filter((task) => task.status === 'blocked').length;
  const inProgressTasks = tasks.filter((task) => task.status === 'in_progress').length;
  const reviewTasks = tasks.filter((task) => task.status === 'review').length;
  const progressPercent = Math.round((completedTasks / Math.max(1, tasks.length)) * 100);
  const weightedProgress = Math.round((completeWeight / totalWeight) * 100);
  return {
    planId,
    totalTasks: tasks.length,
    completedTasks,
    blockedTasks,
    inProgressTasks,
    weightedProgress,
    progressPercent,
    readiness: completedTasks === tasks.length && tasks.length > 0
      ? 'completed'
      : blockedTasks > 0
        ? 'blocked'
        : reviewTasks > 0
          ? 'review'
          : inProgressTasks > 0
            ? 'in_progress'
            : 'not_started',
    generatedAt: new Date().toISOString(),
  };
}

function persistExecution(execution: ActionPlanExecution): ActionPlanExecution {
  const progress = calculateProgressFromTasks(execution.planId, execution.tasks);
  const next: ActionPlanExecution = {
    ...execution,
    progress,
    status: progress.readiness,
    updatedAt: new Date().toISOString(),
  };
  const state = readState();
  writeState({
    executions: { ...state.executions, [next.id]: next },
    updatedAt: new Date().toISOString(),
  });
  return clone(next);
}

function getPlan(planId: string): FeedbackActionPlan {
  const plan = getFeedbackActionPlan(planId);
  if (plan) return plan;
  if (planId.startsWith('feedback-action-plan-')) {
    const feedbackId = planId.replace(/^feedback-action-plan-/, '');
    return createActionPlanFromFeedback(feedbackId);
  }
  return getFeedbackActionPlanByRun(DEMO_RUN_ID);
}

function getExecutionByTaskId(taskId: string): ActionPlanExecution | undefined {
  return Object.values(readState().executions).find((execution) => execution.tasks.some((task) => task.taskId === taskId || task.id === taskId));
}

function addEvent(execution: ActionPlanExecution, event: Omit<ActionExecutionEvent, 'id' | 'timestamp'>): ActionPlanExecution {
  return {
    ...execution,
    timeline: [
      ...execution.timeline,
      {
        id: eventId(event.planId, event.type, event.taskId),
        timestamp: new Date().toISOString(),
        ...event,
      },
    ],
  };
}

function dependenciesSatisfied(plan: FeedbackActionPlan, taskId: string, tasks: ActionTaskExecution[]): boolean {
  const dependencyIds = plan.dependencies.filter((dependency) => dependency.taskId === taskId && dependency.blocking).map((dependency) => dependency.dependsOnTaskId);
  return dependencyIds.every((id) => {
    const dependencyTask = tasks.find((task) => task.taskId === id);
    return !dependencyTask || ['completed', 'cancelled'].includes(dependencyTask.status);
  });
}

export function startActionPlanExecution(planId: string): ActionPlanExecution {
  const state = readState();
  const id = actionPlanExecutionId(planId);
  const existing = state.executions[id];
  if (existing) return clone(existing);
  const plan = getPlan(planId);
  const tasks = plan.tasks.map(taskFromPlanner);
  const progress = calculateProgressFromTasks(plan.id, tasks);
  const execution: ActionPlanExecution = {
    id,
    planId: plan.id,
    runId: plan.runId,
    status: progress.readiness,
    progress,
    tasks,
    timeline: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return persistExecution(addEvent(execution, {
    planId: plan.id,
    type: 'plan.started',
    status: progress.readiness === 'not_started' ? 'ready' : 'in_progress',
    message: `Started action plan execution for ${plan.id}.`,
  }));
}

export function startActionTask(taskId: string): ActionTaskExecution | undefined {
  const execution = getExecutionByTaskId(taskId);
  if (!execution) return undefined;
  const plan = getPlan(execution.planId);
  const tasks = execution.tasks.map((task) => {
    if (task.taskId !== taskId && task.id !== taskId) return task;
    if (task.status !== 'ready') return task;
    if (!dependenciesSatisfied(plan, task.taskId, execution.tasks)) {
      return { ...task, status: 'blocked' as ActionTaskLifecycleStatus, blocker: 'Waiting for dependency completion.', progress: 0, updatedAt: new Date().toISOString() };
    }
    return { ...task, status: 'in_progress' as ActionTaskLifecycleStatus, progress: Math.max(task.progress, 35), startedAt: task.startedAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() };
  });
  const updated = persistExecution(addEvent({ ...execution, tasks }, {
    planId: execution.planId,
    taskId,
    type: 'task.started',
    status: 'in_progress',
    message: `Started action task ${taskId}.`,
  }));
  return updated.tasks.find((task) => task.taskId === taskId || task.id === taskId);
}

export function pauseActionTask(taskId: string, reason: string): ActionTaskExecution | undefined {
  const execution = getExecutionByTaskId(taskId);
  if (!execution) return undefined;
  const tasks = execution.tasks.map((task) => task.taskId === taskId || task.id === taskId ? { ...task, status: 'ready' as ActionTaskLifecycleStatus, pauseReason: reason, updatedAt: new Date().toISOString() } : task);
  const updated = persistExecution(addEvent({ ...execution, tasks }, {
    planId: execution.planId,
    taskId,
    type: 'task.paused',
    status: 'ready',
    message: reason,
  }));
  return updated.tasks.find((task) => task.taskId === taskId || task.id === taskId);
}

export function blockActionTask(taskId: string, blocker: string): ActionTaskExecution | undefined {
  if (!blocker.trim()) throw new Error('Blocked action task requires blocker reason.');
  const execution = getExecutionByTaskId(taskId);
  if (!execution) return undefined;
  const tasks = execution.tasks.map((task) => task.taskId === taskId || task.id === taskId ? { ...task, status: 'blocked' as ActionTaskLifecycleStatus, blocker, progress: Math.min(task.progress, 40), updatedAt: new Date().toISOString() } : task);
  const updated = persistExecution(addEvent({ ...execution, tasks }, {
    planId: execution.planId,
    taskId,
    type: 'task.blocked',
    status: 'blocked',
    message: blocker,
  }));
  return updated.tasks.find((task) => task.taskId === taskId || task.id === taskId);
}

export function completeActionTask(taskId: string, evidence: Omit<ActionCompletionEvidence, 'id' | 'taskId' | 'createdAt'>): ActionTaskExecution | undefined {
  if (!evidence.title.trim() || !evidence.description.trim()) throw new Error('Completed action task requires evidence.');
  const execution = getExecutionByTaskId(taskId);
  if (!execution) return undefined;
  const tasks = execution.tasks.map((task) => {
    if (task.taskId !== taskId && task.id !== taskId) return task;
    const completionEvidence: ActionCompletionEvidence = {
      id: `action-evidence-${task.taskId}-${Date.now()}`,
      taskId: task.taskId,
      createdAt: new Date().toISOString(),
      ...evidence,
    };
    return {
      ...task,
      status: 'completed' as ActionTaskLifecycleStatus,
      progress: 100,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evidence: [...task.evidence, completionEvidence],
    };
  });
  const updated = persistExecution(addEvent({ ...execution, tasks }, {
    planId: execution.planId,
    taskId,
    type: 'task.completed',
    status: 'completed',
    message: `Completed action task ${taskId}.`,
  }));
  return updated.tasks.find((task) => task.taskId === taskId || task.id === taskId);
}

export function cancelActionTask(taskId: string, reason: string): ActionTaskExecution | undefined {
  const execution = getExecutionByTaskId(taskId);
  if (!execution) return undefined;
  const tasks = execution.tasks.map((task) => task.taskId === taskId || task.id === taskId ? { ...task, status: 'cancelled' as ActionTaskLifecycleStatus, cancelReason: reason, updatedAt: new Date().toISOString() } : task);
  const updated = persistExecution(addEvent({ ...execution, tasks }, {
    planId: execution.planId,
    taskId,
    type: 'task.cancelled',
    status: 'cancelled',
    message: reason,
  }));
  return updated.tasks.find((task) => task.taskId === taskId || task.id === taskId);
}

export function calculateActionPlanProgress(planId: string): ActionProgressSnapshot {
  const execution = getActionPlanExecution(planId) ?? startActionPlanExecution(planId);
  return clone(execution.progress);
}

export function generateActionExecutionTimeline(planId: string): ActionExecutionEvent[] {
  const execution = getActionPlanExecution(planId) ?? startActionPlanExecution(planId);
  return clone(execution.timeline);
}

export function getActionPlanExecution(planId: string): ActionPlanExecution | undefined {
  const execution = readState().executions[actionPlanExecutionId(planId)];
  return execution ? clone(execution) : undefined;
}

export function getActionPlanExecutionByRun(runId = DEMO_RUN_ID): ActionPlanExecution {
  const plan = getFeedbackActionPlanByRun(runId);
  return getActionPlanExecution(plan.id) ?? startActionPlanExecution(plan.id);
}

export function getActionTaskExecutions(planId: string): ActionTaskExecution[] {
  return (getActionPlanExecution(planId) ?? startActionPlanExecution(planId)).tasks;
}

export function getBlockedActionExecutions(planId?: string): ActionTaskExecution[] {
  const executions = planId ? [getActionPlanExecution(planId) ?? startActionPlanExecution(planId)] : Object.values(readState().executions);
  return executions.flatMap((execution) => execution.tasks.filter((task) => task.status === 'blocked')).map(clone);
}

export function getCompletedActionExecutions(planId?: string): ActionTaskExecution[] {
  const executions = planId ? [getActionPlanExecution(planId) ?? startActionPlanExecution(planId)] : Object.values(readState().executions);
  return executions.flatMap((execution) => execution.tasks.filter((task) => task.status === 'completed')).map(clone);
}

export function getActionCompletionEvidence(planId?: string): ActionCompletionEvidence[] {
  const executions = planId ? [getActionPlanExecution(planId) ?? startActionPlanExecution(planId)] : Object.values(readState().executions);
  return executions.flatMap((execution) => execution.tasks.flatMap((task) => task.evidence)).map(clone);
}

export function getWorkspaceImprovementProgress(workspaceId = demoWorkspace.id): WorkspaceImprovementProgress {
  const executions = Object.values(readState().executions);
  const tasks = executions.flatMap((execution) => execution.tasks);
  const averageProgress = executions.length
    ? Math.round(executions.reduce((total, execution) => total + execution.progress.weightedProgress, 0) / executions.length)
    : 0;
  return {
    workspaceId,
    executionCount: executions.length,
    taskCount: tasks.length,
    completedTasks: tasks.filter((task) => task.status === 'completed').length,
    blockedTasks: tasks.filter((task) => task.status === 'blocked').length,
    averageProgress,
    evidenceCount: tasks.flatMap((task) => task.evidence).length,
    generatedAt: new Date().toISOString(),
  };
}

export function exportActionExecutionJson(runId = DEMO_RUN_ID): string {
  return JSON.stringify(getActionPlanExecutionByRun(runId), null, 2);
}

export function exportActionExecutionTimelineMarkdown(runId = DEMO_RUN_ID): string {
  const execution = getActionPlanExecutionByRun(runId);
  return [
    '# Action Execution Timeline',
    '',
    `Plan: ${execution.planId}`,
    `Run: ${execution.runId}`,
    '',
    '| Time | Event | Message |',
    '|---|---|---|',
    ...execution.timeline.map((event) => `| ${event.timestamp} | ${event.type} | ${event.message} |`),
    '',
  ].join('\n');
}

export function exportActionCompletionEvidenceJson(runId = DEMO_RUN_ID): string {
  const execution = getActionPlanExecutionByRun(runId);
  return JSON.stringify(execution.tasks.flatMap((task) => task.evidence), null, 2);
}

export function exportWorkspaceImprovementProgressMarkdown(workspaceId = demoWorkspace.id): string {
  const summary = getWorkspaceImprovementProgress(workspaceId);
  return [
    '# Workspace Improvement Progress',
    '',
    `Workspace: ${summary.workspaceId}`,
    `Executions: ${summary.executionCount}`,
    `Tasks: ${summary.taskCount}`,
    `Completed: ${summary.completedTasks}`,
    `Blocked: ${summary.blockedTasks}`,
    `Average progress: ${summary.averageProgress}%`,
    `Evidence: ${summary.evidenceCount}`,
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
    contentSummary: `Action execution export for ${runId}`,
    contentText,
    createdAt: new Date().toISOString(),
  };
}

export function registerActionPlanExecutionExports(runId = DEMO_RUN_ID): ArtifactRecord[] {
  const exports = [
    exportArtifact(`artifact-${runId}-action-execution-json`, runId, 'action-execution.json', exportActionExecutionJson(runId), 'json'),
    exportArtifact(`artifact-${runId}-action-execution-timeline-md`, runId, 'action-execution-timeline.md', exportActionExecutionTimelineMarkdown(runId), 'markdown'),
    exportArtifact(`artifact-${runId}-action-completion-evidence-json`, runId, 'action-completion-evidence.json', exportActionCompletionEvidenceJson(runId), 'json'),
    exportArtifact(`artifact-${runId}-workspace-improvement-progress-md`, runId, 'workspace-improvement-progress.md', exportWorkspaceImprovementProgressMarkdown(), 'markdown'),
  ];
  return exports.map((artifact) => registerArtifact(artifact, { type: 'EXPORT', metadata: { runId, tags: ['action-execution', 'improvement', 'export'] } }));
}

export function clearActionPlanExecutionStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(ACTION_PLAN_EXECUTION_STORAGE_KEY);
}
