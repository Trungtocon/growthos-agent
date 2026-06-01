import { Activity, AlertTriangle, BarChart3, CheckCircle2, ClipboardCheck, FileText, ListChecks, Play, RotateCcw, Scale, ShieldCheck, Sparkles, TrendingUp, Wrench, XCircle } from 'lucide-react';
import { Badge, Button, PageHeader, Panel, ProgressBar } from '../components/ui/DemoPrimitives';
import { DEMO_RUN_ID } from '../data/demo-fixtures';
import type { Tone } from '../data/demoScreens';
import {
  selectRunEvaluation,
  selectRunEvaluationIssues,
  selectRunEvaluationRecommendations,
  selectRunsByEvaluationScore,
  selectEvaluationFeedbackByRun,
  selectFeedbackActions,
  selectActionCompletionEvidence,
  selectActionExecutionTimeline,
  selectActionPlanExecution,
  selectActionPlanProgress,
  selectActionTaskExecutions,
  selectBlockedActionExecutions,
  selectBlockedActionTasks,
  selectCompletedActionExecutions,
  selectFeedbackActionPlan,
  selectReadyActionTasks,
  selectWorkspaceImprovementProgress,
  selectImprovedOutcomes,
  selectInconclusiveOutcomes,
  selectMetricDeltas,
  selectOutcomeEvidence,
  selectOutcomesByRun,
  selectRegressedOutcomes,
  selectWorkspaceOutcomeSummary,
  selectWorkspaceActionPlanSummary,
  selectTopImprovementSuggestions,
  selectWorkspaceFeedbackSummary,
  selectWorkspaceEvaluationSummary,
} from '../domain/selectors';
import { registerEvaluationFeedbackExports, regenerateFeedbackForRun } from '../runtime/evaluation-feedback-store';
import {
  blockActionTask,
  cancelActionTask,
  completeActionTask,
  registerActionPlanExecutionExports,
  startActionPlanExecution,
  startActionTask,
} from '../runtime/action-plan-execution-store';
import { createOutcomeVerification, registerImprovementOutcomeExports } from '../runtime/improvement-outcome-store';
import { registerFeedbackActionPlanExports, regenerateActionPlanFromFeedback } from '../runtime/feedback-action-planner-store';
import { registerRunEvaluationExports } from '../runtime/run-evaluation-store';
import type { ActionTaskLifecycleStatus } from '../runtime/action-plan-execution';
import type { OutcomeVerificationStatus } from '../runtime/improvement-outcome';
import type { RunEvaluationScore } from '../runtime/run-evaluation';
import type { FeedbackPriority } from '../runtime/evaluation-feedback';
import type { FeedbackActionStatus } from '../runtime/feedback-action-planner';

function scoreTone(score: number): Tone {
  if (score >= 90) return 'green';
  if (score >= 75) return 'blue';
  if (score >= 60) return 'amber';
  return 'red';
}

function priorityTone(priority: FeedbackPriority): Tone {
  if (priority === 'critical') return 'red';
  if (priority === 'high') return 'amber';
  if (priority === 'medium') return 'blue';
  return 'slate';
}

function actionStatusTone(status: FeedbackActionStatus): Tone {
  if (status === 'completed') return 'green';
  if (status === 'ready' || status === 'in_progress') return 'blue';
  if (status === 'blocked') return 'red';
  if (status === 'cancelled') return 'slate';
  return 'amber';
}

function actionExecutionStatusTone(status: ActionTaskLifecycleStatus): Tone {
  if (status === 'completed') return 'green';
  if (status === 'in_progress' || status === 'review') return 'blue';
  if (status === 'blocked' || status === 'cancelled') return 'red';
  if (status === 'ready') return 'amber';
  return 'slate';
}

function outcomeStatusTone(status: OutcomeVerificationStatus): Tone {
  if (status === 'improved') return 'green';
  if (status === 'regressed') return 'red';
  if (status === 'inconclusive') return 'amber';
  if (status === 'unchanged') return 'blue';
  return 'slate';
}

function ScoreCard({ score }: { score: RunEvaluationScore }) {
  return (
    <div data-evaluation-score={score.dimension} className="rounded-xl border border-slate-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{score.dimension.replace(/_/g, ' ')}</div>
          <div className="mt-2 text-2xl font-extrabold text-slate-950">{score.value}</div>
        </div>
        <Badge tone={scoreTone(score.value)}>{score.status}</Badge>
      </div>
      <div className="mt-3"><ProgressBar value={score.value} tone={scoreTone(score.value)} label={`${score.dimension} score`} /></div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{score.evidence}</p>
    </div>
  );
}

export function RunEvaluationCompactWidget({ runId = DEMO_RUN_ID, surface }: { runId?: string; surface: 'run' | 'execution-timeline' | 'execution-graph' | 'artifacts' }) {
  const evaluation = selectRunEvaluation(runId);
  return (
    <span data-run-evaluation-widget={surface} data-run-evaluation-score={evaluation.overallScore} data-run-evaluation-status={evaluation.status} className="sr-only">
      Run evaluation {surface} {runId}: score {evaluation.overallScore}, status {evaluation.status}, issues {evaluation.issues.length}.
    </span>
  );
}

export function EvaluationFeedbackCompactWidget({ runId = DEMO_RUN_ID, surface }: { runId?: string; surface: 'run' | 'execution-timeline' | 'execution-graph' | 'artifacts' }) {
  const feedback = selectEvaluationFeedbackByRun(runId);
  return (
    <span data-evaluation-feedback-widget={surface} data-feedback-suggestions={feedback.suggestions.length} data-feedback-version={feedback.version} className="sr-only">
      Evaluation feedback {surface} {runId}: {feedback.suggestions.length} suggestions, {feedback.actions.length} actions, version {feedback.version}.
    </span>
  );
}

export function FeedbackActionPlanCompactWidget({ runId = DEMO_RUN_ID, surface }: { runId?: string; surface: 'run' | 'execution-timeline' | 'execution-graph' | 'artifacts' }) {
  const plan = selectFeedbackActionPlan(undefined, runId)!;
  return (
    <span data-feedback-action-plan-widget={surface} data-action-plan-status={plan.status} data-action-plan-tasks={plan.tasks.length} className="sr-only">
      Feedback action plan {surface} {runId}: {plan.tasks.length} tasks, status {plan.status}, readiness {plan.readiness}.
    </span>
  );
}

export function ActionPlanExecutionCompactWidget({ runId = DEMO_RUN_ID, surface }: { runId?: string; surface: 'run' | 'execution-timeline' | 'execution-graph' | 'artifacts' }) {
  const execution = selectActionPlanExecution(undefined, runId);
  return (
    <span data-action-plan-execution-widget={surface} data-action-execution-status={execution.status} data-action-execution-progress={execution.progress.weightedProgress} className="sr-only">
      Action plan execution {surface} {runId}: status {execution.status}, progress {execution.progress.weightedProgress}, tasks {execution.tasks.length}.
    </span>
  );
}

export function ImprovementOutcomeCompactWidget({ runId = DEMO_RUN_ID, surface }: { runId?: string; surface: 'run' | 'execution-timeline' | 'execution-graph' | 'artifacts' | 'evaluation' }) {
  const outcomes = selectOutcomesByRun(runId);
  return (
    <span data-improvement-outcome-widget={surface} data-improvement-outcomes={outcomes.length} data-improvement-status={outcomes[0]?.status ?? 'unverified'} className="sr-only">
      Improvement outcomes {surface} {runId}: {outcomes.length} outcomes, first status {outcomes[0]?.status ?? 'unverified'}.
    </span>
  );
}

export function EvaluationPage() {
  const evaluation = selectRunEvaluation(DEMO_RUN_ID);
  const summary = selectWorkspaceEvaluationSummary();
  const evaluations = selectRunsByEvaluationScore(0);
  const issues = selectRunEvaluationIssues(DEMO_RUN_ID);
  const recommendations = selectRunEvaluationRecommendations(DEMO_RUN_ID);
  const feedback = selectEvaluationFeedbackByRun(DEMO_RUN_ID);
  const feedbackSummary = selectWorkspaceFeedbackSummary();
  const topSuggestions = selectTopImprovementSuggestions(5, DEMO_RUN_ID);
  const feedbackActions = selectFeedbackActions(DEMO_RUN_ID);
  const actionPlan = selectFeedbackActionPlan(undefined, DEMO_RUN_ID)!;
  const actionPlanSummary = selectWorkspaceActionPlanSummary();
  const readyActionTasks = selectReadyActionTasks(DEMO_RUN_ID);
  const blockedActionTasks = selectBlockedActionTasks(DEMO_RUN_ID);
  const actionExecution = selectActionPlanExecution(undefined, DEMO_RUN_ID);
  const actionTaskExecutions = selectActionTaskExecutions(actionPlan.id, DEMO_RUN_ID);
  const actionExecutionProgress = selectActionPlanProgress(actionPlan.id, DEMO_RUN_ID);
  const actionExecutionTimeline = selectActionExecutionTimeline(actionPlan.id, DEMO_RUN_ID);
  const blockedActionExecutions = selectBlockedActionExecutions(actionPlan.id, DEMO_RUN_ID);
  const completedActionExecutions = selectCompletedActionExecutions(actionPlan.id, DEMO_RUN_ID);
  const actionCompletionEvidence = selectActionCompletionEvidence(actionPlan.id, DEMO_RUN_ID);
  const workspaceImprovementProgress = selectWorkspaceImprovementProgress();
  const outcomes = selectOutcomesByRun(DEMO_RUN_ID);
  const primaryOutcome = outcomes[0];
  const outcomeSummary = selectWorkspaceOutcomeSummary();
  const improvedOutcomes = selectImprovedOutcomes(DEMO_RUN_ID);
  const regressedOutcomes = selectRegressedOutcomes(DEMO_RUN_ID);
  const inconclusiveOutcomes = selectInconclusiveOutcomes(DEMO_RUN_ID);
  const metricDeltas = primaryOutcome ? selectMetricDeltas(primaryOutcome.actionExecutionId) : [];
  const outcomeEvidence = primaryOutcome ? selectOutcomeEvidence(primaryOutcome.actionExecutionId) : [];
  const artifactScore = evaluation.scores.find((score) => score.dimension === 'artifact_quality');
  const toolScore = evaluation.scores.find((score) => score.dimension === 'tool_success');
  const governanceScore = evaluation.scores.find((score) => score.dimension === 'governance_compliance');
  const approvalScore = evaluation.scores.find((score) => score.dimension === 'approval_compliance');
  const costScore = evaluation.scores.find((score) => score.dimension === 'cost_efficiency');

  return (
    <div data-route="/evaluation" data-run-evaluation-route>
      <PageHeader
        title="Run Evaluation & Quality Scoring"
        subtitle="Score completed runs across timeline integrity, artifacts, tools, approvals, governance, cost, and replay evidence."
        actions={<><Button variant="secondary" onClick={() => { registerRunEvaluationExports(DEMO_RUN_ID); registerEvaluationFeedbackExports(DEMO_RUN_ID); registerFeedbackActionPlanExports(DEMO_RUN_ID); registerActionPlanExecutionExports(DEMO_RUN_ID); registerImprovementOutcomeExports(DEMO_RUN_ID); }}><FileText className="h-4 w-4" />Export evaluation</Button><Button variant="secondary" onClick={() => { regenerateFeedbackForRun(DEMO_RUN_ID); regenerateActionPlanFromFeedback(feedback.id); startActionPlanExecution(actionPlan.id); createOutcomeVerification(actionExecution.id); window.location.reload(); }}><RotateCcw className="h-4 w-4" />Regenerate feedback</Button><Button><Sparkles className="h-4 w-4" />Refresh score</Button></>}
      />
      <ImprovementOutcomeCompactWidget runId={DEMO_RUN_ID} surface="evaluation" />
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Average score', value: summary.averageScore, Icon: BarChart3, tone: scoreTone(summary.averageScore) },
          { label: 'Evaluations', value: summary.evaluationCount, Icon: CheckCircle2, tone: 'blue' },
          { label: 'Passed', value: summary.passed, Icon: ShieldCheck, tone: 'green' },
          { label: 'Needs review', value: summary.needsReview, Icon: Wrench, tone: 'amber' },
          { label: 'Critical issues', value: summary.criticalIssues, Icon: FileText, tone: summary.criticalIssues ? 'red' : 'green' },
        ].map(({ label, value, Icon, tone }) => (
          <Panel key={label}>
            <div className="flex items-center gap-3 p-4">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-brand-600"><Icon className="h-5 w-5" /></div>
              <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="text-2xl font-extrabold text-slate-950">{String(value)}</div><Badge tone={tone as Tone}>{label}</Badge></div>
            </div>
          </Panel>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-[360px_1fr_420px] gap-5" data-evaluation-feedback-panel>
        <Panel title="Feedback Summary">
          <div className="space-y-3 p-4 text-sm">
            <div className="flex items-center justify-between"><span>Feedback runs</span><b>{feedbackSummary.feedbackCount}</b></div>
            <div className="flex items-center justify-between"><span>Suggestions</span><b>{feedbackSummary.suggestionCount}</b></div>
            <div className="flex items-center justify-between"><span>Actions</span><b>{feedbackSummary.actionCount}</b></div>
            <div className="flex items-center justify-between"><span>Critical / high</span><Badge tone={feedbackSummary.criticalCount ? 'red' : feedbackSummary.highCount ? 'amber' : 'green'}>{feedbackSummary.criticalCount}/{feedbackSummary.highCount}</Badge></div>
            <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
              Feedback version {feedback.version} generated from evaluation {feedback.evaluationId}.
            </div>
          </div>
        </Panel>
        <Panel title="Top Improvement Suggestions">
          <div className="grid grid-cols-2 gap-3 p-4">
            {topSuggestions.map((suggestion) => (
              <div key={suggestion.id} data-feedback-suggestion={suggestion.category} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{suggestion.title}</b><Badge tone={priorityTone(suggestion.priority)}>{suggestion.priority}</Badge></div>
                <p className="mt-2 text-slate-500">{suggestion.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-400">
                  <span>{suggestion.category.replace(/_/g, ' ')}</span>
                  <span>Impact +{suggestion.expectedImpact}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Priority Breakdown">
          <div className="space-y-3 p-4 text-sm">
            {(['critical', 'high', 'medium', 'low'] as FeedbackPriority[]).map((priority) => {
              const count = feedback.suggestions.filter((suggestion) => suggestion.priority === priority).length;
              return <div key={priority} className="flex items-center justify-between rounded-xl border border-slate-100 p-3"><span className="font-semibold capitalize">{priority}</span><Badge tone={priorityTone(priority)}>{count}</Badge></div>;
            })}
          </div>
        </Panel>
        <Panel title="Recommended Next Actions">
          <div className="col-span-full grid grid-cols-3 gap-3 p-4">
            {feedbackActions.slice(0, 6).map((action) => (
              <div key={action.id} data-feedback-action={action.owner} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{action.title}</b><Badge tone={action.status === 'queued' ? 'blue' : 'slate'}>{action.status}</Badge></div>
                <div className="mt-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-400"><span>{action.owner}</span><span>{action.dueInDays}d</span></div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Feedback Actions Table">
          <div className="col-span-full overflow-hidden p-4">
            <div className="grid grid-cols-[1.6fr_110px_120px_90px] border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              <span>Action</span><span>Owner</span><span>Status</span><span>Due</span>
            </div>
            {feedbackActions.map((action) => (
              <div key={action.id} className="grid grid-cols-[1.6fr_110px_120px_90px] border-b border-slate-50 py-3 text-sm">
                <span className="font-semibold text-slate-800">{action.title}</span><span>{action.owner}</span><span>{action.status}</span><span>{action.dueInDays}d</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="mt-5 grid grid-cols-[360px_1fr_420px] gap-5" data-feedback-action-plan-panel>
        <Panel title="Action Plan">
          <div className="space-y-3 p-4 text-sm">
            <div className="flex items-center justify-between"><span>Plan</span><b>{actionPlan.id.replace('feedback-action-plan-', '')}</b></div>
            <div className="flex items-center justify-between"><span>Status</span><Badge tone={actionStatusTone(actionPlan.status)}>{actionPlan.status}</Badge></div>
            <div className="flex items-center justify-between"><span>Readiness</span><Badge tone={actionPlan.readiness === 'blocked' ? 'red' : actionPlan.readiness === 'ready' ? 'green' : 'amber'}>{actionPlan.readiness}</Badge></div>
            <div className="flex items-center justify-between"><span>Ready / blocked</span><b>{readyActionTasks.length}/{blockedActionTasks.length}</b></div>
            <Button variant="secondary" onClick={() => { regenerateActionPlanFromFeedback(feedback.id); window.location.reload(); }}><ListChecks className="h-4 w-4" />Create action plan</Button>
          </div>
        </Panel>
        <Panel title="Task List by Priority">
          <div className="grid grid-cols-2 gap-3 p-4">
            {actionPlan.tasks.slice(0, 8).map((task) => (
              <div key={task.id} data-feedback-action-task={task.status} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{task.title}</b><Badge tone={priorityTone(task.priority)}>{task.priority}</Badge></div>
                <p className="mt-2 text-slate-500">{task.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-400">
                  <span>{task.owner}</span>
                  <Badge tone={actionStatusTone(task.status)}>{task.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Readiness & Dependencies">
          <div className="space-y-3 p-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-100 p-3"><div className="text-xs font-bold uppercase text-slate-400">Plans</div><div className="text-2xl font-extrabold">{actionPlanSummary.planCount}</div></div>
              <div className="rounded-xl border border-slate-100 p-3"><div className="text-xs font-bold uppercase text-slate-400">Impact</div><div className="text-2xl font-extrabold">{actionPlanSummary.totalExpectedImpact}</div></div>
            </div>
            {actionPlan.dependencies.length ? actionPlan.dependencies.map((dependency) => (
              <div key={dependency.id} data-action-dependency className="rounded-xl bg-slate-50 p-3">
                <b>{dependency.taskId}</b>
                <p className="mt-1 text-slate-500">Depends on {dependency.dependsOnTaskId}. {dependency.reason}</p>
              </div>
            )) : <p className="text-slate-500">No blocking dependencies detected.</p>}
          </div>
        </Panel>
        <Panel title="Acceptance Criteria">
          <div className="col-span-full grid grid-cols-3 gap-3 p-4">
            {actionPlan.tasks.slice(0, 6).flatMap((task) => task.acceptanceCriteria.slice(0, 2).map((criteria) => (
              <div key={criteria.id} data-action-acceptance-criteria className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{task.title}</b><Badge tone={criteria.completed ? 'green' : 'amber'}>{criteria.completed ? 'done' : 'open'}</Badge></div>
                <p className="mt-2 text-slate-500">{criteria.description}</p>
              </div>
            )))}
          </div>
        </Panel>
      </div>
      <div className="mt-5 grid grid-cols-[360px_1fr_420px] gap-5" data-action-plan-execution-panel>
        <Panel title="Action Execution Progress">
          <div className="space-y-3 p-4 text-sm">
            <div className="flex items-center justify-between"><span>Execution</span><b>{actionExecution.id.replace('action-execution-', '')}</b></div>
            <div className="flex items-center justify-between"><span>Status</span><Badge tone={actionExecution.status === 'blocked' ? 'red' : actionExecution.status === 'completed' ? 'green' : 'blue'}>{actionExecution.status}</Badge></div>
            <ProgressBar value={actionExecutionProgress.weightedProgress} tone={actionExecution.status === 'blocked' ? 'red' : 'blue'} label="Action plan execution progress" />
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs font-bold uppercase text-slate-400">Completed</div><div className="text-xl font-extrabold">{actionExecutionProgress.completedTasks}/{actionExecutionProgress.totalTasks}</div></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs font-bold uppercase text-slate-400">Workspace</div><div className="text-xl font-extrabold">{workspaceImprovementProgress.averageProgress}%</div></div>
            </div>
            <Button variant="secondary" onClick={() => { startActionPlanExecution(actionPlan.id); window.location.reload(); }}><Play className="h-4 w-4" />Start execution</Button>
          </div>
        </Panel>
        <Panel title="Task Lifecycle Board">
          <div className="grid grid-cols-3 gap-3 p-4">
            {actionTaskExecutions.slice(0, 9).map((task) => (
              <div key={task.id} data-action-task-execution={task.status} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{task.title}</b><Badge tone={actionExecutionStatusTone(task.status)}>{task.status}</Badge></div>
                <div className="mt-3"><ProgressBar value={task.progress} tone={actionExecutionStatusTone(task.status)} label={`${task.title} progress`} /></div>
                <div className="mt-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-400"><span>{task.owner}</span><span>{task.priority}</span></div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { startActionTask(task.taskId); window.location.reload(); }}><Play className="inline h-3 w-3" /> Start</button>
                  <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { blockActionTask(task.taskId, 'Needs dependency or owner review.'); window.location.reload(); }}><AlertTriangle className="inline h-3 w-3" /> Block</button>
                  <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { completeActionTask(task.taskId, { type: 'note', title: 'Evidence captured', description: 'Task completed with demo evidence.', createdBy: 'GrowthOS demo' }); window.location.reload(); }}><ClipboardCheck className="inline h-3 w-3" /> Done</button>
                  <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { cancelActionTask(task.taskId, 'Cancelled during demo planning review.'); window.location.reload(); }}><XCircle className="inline h-3 w-3" /> Cancel</button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Blocked Tasks">
          <div className="space-y-3 p-4 text-sm">
            {blockedActionExecutions.length ? blockedActionExecutions.map((task) => (
              <div key={task.id} data-action-blocked-task className="rounded-xl border border-red-100 bg-red-50/50 p-3">
                <div className="flex items-center justify-between gap-3"><b>{task.title}</b><Badge tone="red">blocked</Badge></div>
                <p className="mt-2 text-slate-600">{task.blocker ?? 'Blocked by dependency.'}</p>
              </div>
            )) : <p className="text-slate-500">No blocked action executions.</p>}
          </div>
        </Panel>
        <Panel title="Completion Evidence">
          <div className="grid grid-cols-3 gap-3 p-4">
            {actionCompletionEvidence.length ? actionCompletionEvidence.map((evidence) => (
              <div key={evidence.id} data-action-completion-evidence className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{evidence.title}</b><Badge tone="green">{evidence.type}</Badge></div>
                <p className="mt-2 text-slate-500">{evidence.description}</p>
                <div className="mt-3 text-xs font-bold uppercase text-slate-400">{evidence.createdBy}</div>
              </div>
            )) : completedActionExecutions.length ? completedActionExecutions.map((task) => (
              <div key={task.id} data-action-completion-evidence className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <b>{task.title}</b>
                <p className="mt-2 text-slate-500">Completed task awaiting attached evidence export.</p>
              </div>
            )) : <p className="text-sm text-slate-500">Completion evidence appears after tasks are marked complete.</p>}
          </div>
        </Panel>
        <Panel title="Execution Timeline">
          <div className="col-span-full grid grid-cols-4 gap-3 p-4">
            {actionExecutionTimeline.slice(-8).map((event) => (
              <div key={event.id} data-action-execution-event={event.type} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{event.type}</b><Badge tone={actionExecutionStatusTone(event.status)}>{event.status}</Badge></div>
                <p className="mt-2 text-slate-500">{event.message}</p>
                <div className="mt-3 flex items-center gap-2 text-xs font-bold uppercase text-slate-400"><Activity className="h-3 w-3" />{event.timestamp.slice(11, 19)}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="mt-5 grid grid-cols-[360px_1fr_420px] gap-5" data-improvement-outcome-panel>
        <Panel title="Outcome Verification">
          <div className="space-y-3 p-4 text-sm">
            <div className="flex items-center justify-between"><span>Status</span><Badge tone={outcomeStatusTone(primaryOutcome?.status ?? 'unverified')}>{primaryOutcome?.status ?? 'unverified'}</Badge></div>
            <div className="flex items-center justify-between"><span>Improved / regressed</span><b>{improvedOutcomes.length}/{regressedOutcomes.length}</b></div>
            <div className="flex items-center justify-between"><span>Inconclusive</span><b>{inconclusiveOutcomes.length}</b></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs font-bold uppercase text-slate-400">Outcomes</div><div className="text-xl font-extrabold">{outcomeSummary.outcomeCount}</div></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs font-bold uppercase text-slate-400">Evidence</div><div className="text-xl font-extrabold">{outcomeSummary.evidenceCount}</div></div>
            </div>
            <Button variant="secondary" onClick={() => { createOutcomeVerification(actionExecution.id); window.location.reload(); }}><Scale className="h-4 w-4" />Verify outcome</Button>
          </div>
        </Panel>
        <Panel title="Before / After Score Comparison">
          <div className="grid grid-cols-4 gap-3 p-4">
            {metricDeltas.slice(0, 8).map((delta) => (
              <div key={delta.dimension} data-outcome-metric-delta={delta.dimension} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{delta.dimension.replace(/_/g, ' ')}</div>
                <div className="mt-2 flex items-end justify-between gap-3"><b className="text-xl">{delta.before} {'->'} {delta.after}</b><Badge tone={delta.delta > 0 ? 'green' : delta.delta < 0 ? 'red' : 'blue'}>{delta.delta > 0 ? '+' : ''}{delta.delta}</Badge></div>
                <ProgressBar value={delta.after} tone={delta.delta > 0 ? 'green' : delta.delta < 0 ? 'red' : 'blue'} label={`${delta.dimension} after score`} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Regression Findings">
          <div className="space-y-3 p-4 text-sm">
            {primaryOutcome?.regressions.length ? primaryOutcome.regressions.map((finding) => (
              <div key={finding.id} data-outcome-regression className="rounded-xl border border-red-100 bg-red-50/50 p-3">
                <div className="flex items-center justify-between"><b>{finding.dimension.replace(/_/g, ' ')}</b><Badge tone="red">{finding.severity}</Badge></div>
                <p className="mt-2 text-slate-600">{finding.description}</p>
              </div>
            )) : <p className="text-slate-500">No regression findings for verified outcome.</p>}
          </div>
        </Panel>
        <Panel title="Outcome Evidence">
          <div className="col-span-full grid grid-cols-3 gap-3 p-4">
            {outcomeEvidence.length ? outcomeEvidence.map((evidence) => (
              <div key={evidence.id} data-outcome-evidence={evidence.type} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{evidence.title}</b><Badge tone="blue">{evidence.type}</Badge></div>
                <p className="mt-2 text-slate-500">{evidence.description}</p>
              </div>
            )) : <p className="text-sm text-slate-500">Outcome evidence appears after verification runs.</p>}
          </div>
        </Panel>
        <Panel title="Outcome History">
          <div className="col-span-full grid grid-cols-4 gap-3 p-4">
            {outcomes.map((outcome) => (
              <div key={outcome.id} data-improvement-outcome={outcome.status} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{outcome.id.replace('improvement-outcome-', '')}</b><Badge tone={outcomeStatusTone(outcome.status)}>{outcome.status}</Badge></div>
                <div className="mt-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-400"><span>{outcome.targetDimensions.join(', ')}</span><span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />{outcome.comparison?.overallDelta ?? 0}</span></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="mt-5 grid grid-cols-[370px_1fr] gap-5">
        <Panel title="Run Evaluation List">
          <div className="max-h-[640px] space-y-3 overflow-hidden p-4">
            {evaluations.map((item) => (
              <div key={item.id} data-run-evaluation-row={item.runId} className="rounded-xl border border-slate-100 bg-white p-4">
                <div className="flex items-center justify-between"><b>{item.runId}</b><Badge tone={scoreTone(item.overallScore)}>{item.overallScore}</Badge></div>
                <p className="mt-2 text-sm text-slate-500">{item.status} · {item.issues.length} issues · {item.recommendations.length} recommendations</p>
              </div>
            ))}
          </div>
        </Panel>
        <div className="space-y-5">
          <Panel title="Selected Run Scorecard">
            <div className="grid grid-cols-4 gap-4 p-4">
              {evaluation.scores.map((score) => <ScoreCard key={score.dimension} score={score} />)}
            </div>
          </Panel>
          <div className="grid grid-cols-2 gap-5">
            <Panel title="Issue Breakdown">
              <div className="space-y-3 p-4">
                {issues.length ? issues.map((issue) => <div key={issue.id} className="rounded-xl border border-slate-100 p-3 text-sm"><div className="flex justify-between gap-3"><b>{issue.title}</b><Badge tone={issue.severity === 'critical' ? 'red' : 'amber'}>{issue.severity}</Badge></div><p className="mt-2 text-slate-500">{issue.description}</p></div>) : <p className="text-sm text-slate-500">No quality issues detected.</p>}
              </div>
            </Panel>
            <Panel title="Recommendations">
              <div className="space-y-3 p-4">
                {recommendations.map((item) => <div key={item.id} className="rounded-xl border border-slate-100 p-3 text-sm"><div className="flex justify-between gap-3"><b>{item.title}</b><Badge tone={item.priority === 'high' ? 'red' : 'blue'}>{item.priority}</Badge></div><p className="mt-2 text-slate-500">{item.description}</p></div>)}
              </div>
            </Panel>
            <Panel title="Artifact Quality"><div className="p-4 text-sm"><ScoreCard score={artifactScore ?? evaluation.scores[0]} /></div></Panel>
            <Panel title="Tool Failure Analysis"><div className="p-4 text-sm"><ScoreCard score={toolScore ?? evaluation.scores[0]} /><div className="mt-3 font-semibold text-slate-600">Failures: {evaluation.toolFailureCount}</div></div></Panel>
            <Panel title="Governance / Approval Compliance"><div className="grid grid-cols-2 gap-3 p-4"><ScoreCard score={governanceScore ?? evaluation.scores[0]} /><ScoreCard score={approvalScore ?? evaluation.scores[0]} /></div></Panel>
            <Panel title="Cost Efficiency"><div className="p-4"><ScoreCard score={costScore ?? evaluation.scores[0]} /></div></Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
