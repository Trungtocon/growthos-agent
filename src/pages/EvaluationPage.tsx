import { Activity, AlertTriangle, BarChart3, CheckCircle2, ClipboardCheck, FileText, Lightbulb, ListChecks, Play, RotateCcw, Scale, ShieldCheck, Sparkles, TrendingUp, Wrench, XCircle } from 'lucide-react';
import { Badge, Button, PageHeader, Panel, ProgressBar } from '../components/ui/DemoPrimitives';
import { ChaosSimulationCompactWidget } from './ChaosSimulationPage';
import { RuntimeCertificationCompactWidget } from './RuntimeCertificationPage';
import { CertifiedSandboxRunCompactWidget } from './CertifiedSandboxRunPage';
import { ProductionReadinessCompactWidget } from './ProductionReadinessPage';
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
  selectAcceptedRecommendations,
  selectLearningMemorySummary,
  selectLearningSignals,
  selectRecommendationConfidence,
  selectRecommendationExecutionSummary,
  selectRecommendationExecutions,
  selectActiveImprovementLoops,
  selectCompletedRecommendationExecutions,
  selectImprovementLoops,
  selectLoopOutcomeSummary,
  selectLoopReadiness,
  selectLoopRuns,
  selectLoopScheduleSummary,
  selectGlobalLoopKillSwitch,
  selectLoopBlockers,
  selectLoopGovernanceAuditTrail,
  selectPausedByGovernanceLoops,
  selectRecommendations,
  selectRecommendationsByRun,
  selectRejectedRecommendations,
  selectRollbackRequiredLoops,
  selectWorkspaceImprovementLoopSummary,
  selectWorkspaceLoopGovernanceSummary,
  selectBlockedLoopQueueItems,
  selectImprovementLoopQueue,
  selectNextEligibleLoop,
  selectQueueAuditTrail,
  selectQueueConcurrencyStatus,
  selectQueueHealthSummary,
  selectRunningLoopQueueItems,
  selectActiveWorker,
  selectImprovementLoopWorkerStatus,
  selectStaleWorkerWarnings,
  selectWorkerBlockedReason,
  selectWorkerExecutionSummary,
  selectWorkerHeartbeat,
  selectWorkerObservationDashboard,
  selectWorkerRecoveryDashboard,
  selectWorkerSLAStatus,
  selectWorkerTickHistory,
  selectWaitingApprovalQueueItems,
  selectVerifiedRecommendationExecutions,
  selectTopRecommendations,
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
import {
  createLearningSignalFromOutcome,
  generateRecommendationFromSignal,
  markRecommendationAccepted,
  markRecommendationRejected,
  registerLearningMemoryExports,
} from '../runtime/learning-memory-store';
import {
  cancelRecommendationExecution,
  completeRecommendationExecution,
  createExecutionFromRecommendation,
  generateRecommendationExecutionArtifacts,
  startRecommendationExecution,
  verifyRecommendationImpact,
} from '../runtime/recommendation-execution-store';
import {
  cancelImprovementLoop,
  completeImprovementLoopRun,
  createImprovementLoop,
  exportImprovementLoopArtifacts,
  pauseImprovementLoop,
  resumeImprovementLoop,
  scheduleImprovementLoop,
  startImprovementLoop,
} from '../runtime/improvement-loop-store';
import {
  disableGlobalLoopKillSwitch,
  enableGlobalLoopKillSwitch,
  exportLoopGovernanceArtifacts,
  pauseAllLoops,
  resumeAllowedLoops,
  rollbackLoop,
} from '../runtime/improvement-loop-governance-store';
import {
  cancelQueuedLoop,
  completeQueuedLoop,
  enqueueImprovementLoop,
  exportImprovementLoopQueueArtifacts,
  pauseQueuedLoop,
  processQueueTick,
  retryFailedLoop,
  startQueuedLoop,
} from '../runtime/improvement-loop-queue-store';
import {
  completeWorkerRun,
  exportImprovementLoopWorkerArtifacts,
  failWorkerRun,
  pauseImprovementLoopWorker,
  recordWorkerHeartbeat,
  recoverStaleWorker,
  resumeImprovementLoopWorker,
  runWorkerTick,
  startImprovementLoopWorker,
  stopImprovementLoopWorker,
} from '../runtime/improvement-loop-worker-store';
import { registerFeedbackActionPlanExports, regenerateActionPlanFromFeedback } from '../runtime/feedback-action-planner-store';
import { registerRunEvaluationExports } from '../runtime/run-evaluation-store';
import type { ActionTaskLifecycleStatus } from '../runtime/action-plan-execution';
import type { OutcomeVerificationStatus } from '../runtime/improvement-outcome';
import type { RecommendationPriority } from '../runtime/learning-memory';
import type { RecommendationExecutionStatus } from '../runtime/recommendation-execution';
import type { ImprovementLoopStatus } from '../runtime/improvement-loop';
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

function recommendationPriorityTone(priority: RecommendationPriority): Tone {
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

function recommendationExecutionTone(status: RecommendationExecutionStatus): Tone {
  if (status === 'verified' || status === 'completed') return 'green';
  if (status === 'in_progress') return 'blue';
  if (status === 'blocked' || status === 'failed') return 'red';
  if (status === 'cancelled') return 'slate';
  return 'amber';
}

function improvementLoopTone(status: ImprovementLoopStatus): Tone {
  if (status === 'completed') return 'green';
  if (status === 'running' || status === 'scheduled') return 'blue';
  if (status === 'waiting_review' || status === 'failed') return 'red';
  if (status === 'paused') return 'amber';
  if (status === 'cancelled') return 'slate';
  return 'amber';
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

export function LearningRecommendationCompactWidget({ runId = DEMO_RUN_ID, surface }: { runId?: string; surface: 'run' | 'execution-timeline' | 'execution-graph' | 'artifacts' | 'evaluation' | 'agent' }) {
  const recommendations = selectRecommendationsByRun(runId);
  const topRecommendation = recommendations[0];
  return (
    <span data-learning-recommendation-widget={surface} data-learning-recommendations={recommendations.length} data-learning-confidence={topRecommendation?.confidence ?? 0} className="sr-only">
      Learning recommendations {surface} {runId}: {recommendations.length} recommendations, top confidence {topRecommendation?.confidence ?? 0}.
    </span>
  );
}

export function RecommendationExecutionCompactWidget({ surface }: { surface: 'run' | 'execution-timeline' | 'execution-graph' | 'artifacts' | 'evaluation' | 'agent' }) {
  const summary = selectRecommendationExecutionSummary();
  return (
    <span data-recommendation-execution-widget={surface} data-recommendation-executions={summary.total} data-recommendation-verified={summary.verified} className="sr-only">
      Recommendation execution {surface}: {summary.total} executions, {summary.verified} verified, {summary.completed} completed.
    </span>
  );
}

export function ImprovementLoopCompactWidget({ surface }: { surface: 'run' | 'execution-timeline' | 'execution-graph' | 'artifacts' | 'evaluation' | 'agent' }) {
  const summary = selectWorkspaceImprovementLoopSummary();
  return (
    <span data-improvement-loop-widget={surface} data-improvement-loops={summary.total} data-improvement-loop-active={summary.active} className="sr-only">
      Improvement loops {surface}: {summary.total} total, {summary.active} active, {summary.completed} completed.
    </span>
  );
}

export function ImprovementLoopGovernanceCompactWidget({ surface }: { surface: 'run' | 'execution-timeline' | 'execution-graph' | 'artifacts' | 'evaluation' | 'agent' }) {
  const summary = selectWorkspaceLoopGovernanceSummary();
  return (
    <span data-improvement-loop-governance-widget={surface} data-loop-governance-blocked={summary.blocked} data-loop-kill-switch={summary.killSwitchEnabled ? 'enabled' : 'disabled'} className="sr-only">
      Improvement loop governance {surface}: {summary.totalDecisions} decisions, {summary.blocked} blocked, kill switch {summary.killSwitchEnabled ? 'enabled' : 'disabled'}.
    </span>
  );
}

export function ImprovementLoopQueueCompactWidget({ surface }: { surface: 'run' | 'execution-timeline' | 'execution-graph' | 'artifacts' | 'evaluation' | 'agent' }) {
  const summary = selectQueueHealthSummary();
  return (
    <span data-improvement-loop-queue-widget={surface} data-loop-queue-total={summary.total} data-loop-queue-running={summary.running} data-loop-queue-blocked={summary.blocked} className="sr-only">
      Improvement loop queue {surface}: {summary.total} total, {summary.running} running, {summary.blocked} blocked.
    </span>
  );
}

export function ImprovementLoopWorkerCompactWidget({ surface }: { surface: 'run' | 'execution-timeline' | 'execution-graph' | 'artifacts' | 'evaluation' | 'agent' }) {
  const status = selectImprovementLoopWorkerStatus();
  const summary = selectWorkerExecutionSummary();
  return (
    <span data-improvement-loop-worker-widget={surface} data-loop-worker-status={status} data-loop-worker-results={summary.totalResults} className="sr-only">
      Improvement loop worker {surface}: {status}, {summary.totalResults} results.
    </span>
  );
}

export function WorkerObservabilityCompactWidget({ surface }: { surface: 'run' | 'execution-timeline' | 'execution-graph' | 'artifacts' | 'evaluation' | 'agent' }) {
  const dashboard = selectWorkerObservationDashboard();
  const sla = selectWorkerSLAStatus();
  return (
    <span data-worker-observability-widget={surface} data-worker-observability-status={dashboard.observation.status} data-worker-observability-sla={sla} data-worker-observability-incidents={dashboard.incidents.length} className="sr-only">
      Worker observability {surface}: {dashboard.observation.status}, SLA {sla}, incidents {dashboard.incidents.length}.
    </span>
  );
}

export function WorkerRecoveryCompactWidget({ surface }: { surface: 'run' | 'execution-timeline' | 'execution-graph' | 'artifacts' | 'evaluation' | 'agent' | 'worker-control' }) {
  const dashboard = selectWorkerRecoveryDashboard();
  return (
    <span data-worker-recovery-widget={surface} data-worker-recovery-plans={dashboard.plans.length} data-worker-recovery-unresolved={dashboard.unresolvedIncidents.length} data-worker-recovery-approval={dashboard.readiness.approvalRequired} className="sr-only">
      Worker recovery {surface}: {dashboard.plans.length} plans, {dashboard.unresolvedIncidents.length} unresolved incidents, {dashboard.readiness.approvalRequired} approvals required.
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
  const learningSignals = selectLearningSignals();
  const learningRecommendations = selectRecommendations();
  const topLearningRecommendations = selectTopRecommendations(5);
  const acceptedRecommendations = selectAcceptedRecommendations();
  const rejectedRecommendations = selectRejectedRecommendations();
  const learningSummary = selectLearningMemorySummary();
  const recommendationExecutions = selectRecommendationExecutions();
  const recommendationExecutionSummary = selectRecommendationExecutionSummary();
  const completedRecommendationExecutions = selectCompletedRecommendationExecutions();
  const verifiedRecommendationExecutions = selectVerifiedRecommendationExecutions();
  const activeRecommendationExecution = recommendationExecutions[0];
  const improvementLoops = selectImprovementLoops();
  const activeImprovementLoops = selectActiveImprovementLoops();
  const loopRuns = selectLoopRuns();
  const loopSummary = selectWorkspaceImprovementLoopSummary();
  const loopOutcomeSummary = selectLoopOutcomeSummary();
  const loopScheduleSummary = selectLoopScheduleSummary();
  const loopGovernanceSummary = selectWorkspaceLoopGovernanceSummary();
  const globalLoopKillSwitch = selectGlobalLoopKillSwitch();
  const pausedByGovernanceLoops = selectPausedByGovernanceLoops();
  const rollbackRequiredLoops = selectRollbackRequiredLoops();
  const loopGovernanceAuditTrail = selectLoopGovernanceAuditTrail();
  const loopQueueItems = selectImprovementLoopQueue();
  const queueSummary = selectQueueHealthSummary();
  const queueConcurrency = selectQueueConcurrencyStatus();
  const nextEligibleQueueItem = selectNextEligibleLoop();
  const runningQueueItems = selectRunningLoopQueueItems();
  const blockedQueueItems = selectBlockedLoopQueueItems();
  const waitingApprovalQueueItems = selectWaitingApprovalQueueItems();
  const queueAuditTrail = selectQueueAuditTrail();
  const workerStatus = selectImprovementLoopWorkerStatus();
  const activeWorker = selectActiveWorker();
  const workerHeartbeat = selectWorkerHeartbeat(activeWorker?.id);
  const workerTicks = selectWorkerTickHistory(activeWorker?.id);
  const workerSummary = selectWorkerExecutionSummary();
  const staleWorkerWarnings = selectStaleWorkerWarnings();
  const workerBlockedReason = selectWorkerBlockedReason();
  const activeImprovementLoop = improvementLoops[0];
  const activeLoopReadiness = activeImprovementLoop ? selectLoopReadiness(activeImprovementLoop.id) : undefined;
  const activeLoopBlockers = activeImprovementLoop ? selectLoopBlockers(activeImprovementLoop.id) : [];
  const activeLoopRuns = activeImprovementLoop ? selectLoopRuns(activeImprovementLoop.id) : [];
  const artifactScore = evaluation.scores.find((score) => score.dimension === 'artifact_quality');
  const toolScore = evaluation.scores.find((score) => score.dimension === 'tool_success');
  const governanceScore = evaluation.scores.find((score) => score.dimension === 'governance_compliance');
  const approvalScore = evaluation.scores.find((score) => score.dimension === 'approval_compliance');
  const costScore = evaluation.scores.find((score) => score.dimension === 'cost_efficiency');

  return (
    <div data-route="/evaluation" data-run-evaluation-route>
      <ChaosSimulationCompactWidget surface="evaluation" />
      <RuntimeCertificationCompactWidget surface="evaluation" />
      <CertifiedSandboxRunCompactWidget surface="evaluation" />
      <ProductionReadinessCompactWidget surface="evaluation" />
      <PageHeader
        title="Run Evaluation & Quality Scoring"
        subtitle="Score completed runs across timeline integrity, artifacts, tools, approvals, governance, cost, and replay evidence."
        actions={<><Button variant="secondary" onClick={() => { registerRunEvaluationExports(DEMO_RUN_ID); registerEvaluationFeedbackExports(DEMO_RUN_ID); registerFeedbackActionPlanExports(DEMO_RUN_ID); registerActionPlanExecutionExports(DEMO_RUN_ID); registerImprovementOutcomeExports(DEMO_RUN_ID); registerLearningMemoryExports(DEMO_RUN_ID); generateRecommendationExecutionArtifacts(); }}><FileText className="h-4 w-4" />Export evaluation</Button><Button variant="secondary" onClick={() => { regenerateFeedbackForRun(DEMO_RUN_ID); regenerateActionPlanFromFeedback(feedback.id); startActionPlanExecution(actionPlan.id); const outcome = createOutcomeVerification(actionExecution.id); const signal = createLearningSignalFromOutcome(outcome.id); generateRecommendationFromSignal(signal.id); window.location.reload(); }}><RotateCcw className="h-4 w-4" />Regenerate feedback</Button><Button data-workflow="run-evaluation" onClick={() => { registerRunEvaluationExports(DEMO_RUN_ID); window.location.reload(); }}><Sparkles className="h-4 w-4" />Refresh score</Button></>}
      />
      <ImprovementOutcomeCompactWidget runId={DEMO_RUN_ID} surface="evaluation" />
      <LearningRecommendationCompactWidget runId={DEMO_RUN_ID} surface="evaluation" />
      <RecommendationExecutionCompactWidget surface="evaluation" />
      <ImprovementLoopCompactWidget surface="evaluation" />
      <ImprovementLoopGovernanceCompactWidget surface="evaluation" />
      <ImprovementLoopQueueCompactWidget surface="evaluation" />
      <ImprovementLoopWorkerCompactWidget surface="evaluation" />
      <WorkerObservabilityCompactWidget surface="evaluation" />
      <WorkerRecoveryCompactWidget surface="evaluation" />
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
      <div className="mt-5 grid grid-cols-[360px_1fr_420px] gap-5" data-learning-memory-panel>
        <Panel title="Learning Memory">
          <div className="space-y-3 p-4 text-sm">
            <div className="flex items-center justify-between"><span>Signals</span><b>{learningSummary.signalCount}</b></div>
            <div className="flex items-center justify-between"><span>Recommendations</span><b>{learningSummary.recommendationCount}</b></div>
            <div className="flex items-center justify-between"><span>Accepted / rejected</span><b>{learningSummary.accepted}/{learningSummary.rejected}</b></div>
            <div className="flex items-center justify-between"><span>Confidence</span><Badge tone={learningSummary.averageConfidence >= 75 ? 'green' : learningSummary.averageConfidence >= 55 ? 'blue' : 'amber'}>{learningSummary.averageConfidence}%</Badge></div>
            <Button data-workflow="generate-recommendation" variant="secondary" onClick={() => { const outcome = primaryOutcome ?? createOutcomeVerification(actionExecution.id); const signal = createLearningSignalFromOutcome(outcome.id); generateRecommendationFromSignal(signal.id); window.location.reload(); }}><Lightbulb className="h-4 w-4" />Generate recommendation</Button>
          </div>
        </Panel>
        <Panel title="Top Recommendations">
          <div className="grid grid-cols-2 gap-3 p-4">
            {topLearningRecommendations.length ? topLearningRecommendations.map((recommendation) => (
              <div key={recommendation.id} data-learning-recommendation={recommendation.type} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{recommendation.title}</b><Badge tone={recommendationPriorityTone(recommendation.impact.priority)}>{recommendation.impact.priority}</Badge></div>
                <p className="mt-2 text-slate-500">{recommendation.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-400">
                  <span>{recommendation.type.replace(/_/g, ' ')}</span>
                  <span>{recommendation.confidence}%</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { markRecommendationAccepted(recommendation.id); window.location.reload(); }}>Accept</button>
                  <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { markRecommendationRejected(recommendation.id, 'Rejected during demo review.'); window.location.reload(); }}>Reject</button>
                </div>
              </div>
            )) : <p className="text-sm text-slate-500">Learning recommendations appear after an outcome is converted into a signal.</p>}
          </div>
        </Panel>
        <Panel title="Recommendation Evidence">
          <div className="space-y-3 p-4 text-sm">
            {topLearningRecommendations.flatMap((recommendation) => recommendation.evidence.slice(0, 2).map((evidence) => (
              <div key={evidence.id} data-recommendation-evidence className="rounded-xl border border-slate-100 bg-white p-3">
                <div className="flex items-start justify-between gap-3"><b>{evidence.title}</b><Badge tone="blue">{selectRecommendationConfidence(recommendation.id)}%</Badge></div>
                <p className="mt-2 text-slate-500">{evidence.description}</p>
              </div>
            ))).slice(0, 5)}
            {!topLearningRecommendations.length ? <p className="text-slate-500">Evidence cards are generated from learning signals and verified outcomes.</p> : null}
          </div>
        </Panel>
        <Panel title="Signal History">
          <div className="col-span-full grid grid-cols-4 gap-3 p-4">
            {learningSignals.map((signal) => (
              <div key={signal.id} data-learning-signal={signal.type} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{signal.type.replace(/_/g, ' ')}</b><Badge tone={outcomeStatusTone(signal.sourceStatus)}>{signal.sourceStatus}</Badge></div>
                <p className="mt-2 text-slate-500">{signal.targetDimensions.join(', ') || 'overall'} from {signal.outcomeId}</p>
                <div className="mt-3 text-xs font-bold uppercase text-slate-400">Strength {signal.strength}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Recommendation Status">
          <div className="col-span-full grid grid-cols-3 gap-3 p-4">
            {[
              { label: 'Proposed', value: learningRecommendations.filter((recommendation) => recommendation.status === 'proposed').length, tone: 'blue' as Tone },
              { label: 'Accepted', value: acceptedRecommendations.length, tone: 'green' as Tone },
              { label: 'Rejected', value: rejectedRecommendations.length, tone: 'red' as Tone },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</div>
                <div className="mt-2 flex items-end justify-between"><b className="text-2xl">{item.value}</b><Badge tone={item.tone}>{item.label}</Badge></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="mt-5 grid grid-cols-[360px_1fr_420px] gap-5" data-recommendation-execution-panel>
        <Panel title="Recommendation Execution">
          <div className="space-y-3 p-4 text-sm">
            <div className="flex items-center justify-between"><span>Total</span><b>{recommendationExecutionSummary.total}</b></div>
            <div className="flex items-center justify-between"><span>Completed / verified</span><b>{recommendationExecutionSummary.completed}/{recommendationExecutionSummary.verified}</b></div>
            <div className="flex items-center justify-between"><span>In progress</span><Badge tone={recommendationExecutionSummary.inProgress ? 'blue' : 'slate'}>{recommendationExecutionSummary.inProgress}</Badge></div>
            <div className="flex items-center justify-between"><span>Confidence after</span><Badge tone={recommendationExecutionSummary.averageConfidenceAfter >= 75 ? 'green' : 'amber'}>{recommendationExecutionSummary.averageConfidenceAfter}%</Badge></div>
            <Button variant="secondary" onClick={() => { const recommendation = acceptedRecommendations[0] ?? (topLearningRecommendations[0] ? markRecommendationAccepted(topLearningRecommendations[0].id) : undefined); if (recommendation) createExecutionFromRecommendation(recommendation.id); window.location.reload(); }}><Play className="h-4 w-4" />Create execution</Button>
          </div>
        </Panel>
        <Panel title="Execution Lifecycle Board">
          <div className="grid grid-cols-2 gap-3 p-4">
            {recommendationExecutions.length ? recommendationExecutions.map((execution) => (
              <div key={execution.id} data-recommendation-execution={execution.status} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{execution.recommendationType.replace(/_/g, ' ')}</b><Badge tone={recommendationExecutionTone(execution.status)}>{execution.status}</Badge></div>
                <p className="mt-2 text-slate-500">Recommendation {execution.recommendationId.replace('recommendation-', '').slice(0, 52)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { startRecommendationExecution(execution.id); window.location.reload(); }}>Start</button>
                  <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { completeRecommendationExecution(execution.id, { type: 'note', title: 'Execution evidence', description: 'Recommendation execution completed with demo evidence.', createdBy: 'GrowthOS demo' }); window.location.reload(); }}>Complete</button>
                  <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { verifyRecommendationImpact(execution.id); window.location.reload(); }}>Verify</button>
                  <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { cancelRecommendationExecution(execution.id); window.location.reload(); }}>Cancel</button>
                </div>
              </div>
            )) : <p className="text-sm text-slate-500">Accept a recommendation, then create an execution to track impact.</p>}
          </div>
        </Panel>
        <Panel title="Impact Result">
          <div className="space-y-3 p-4 text-sm">
            {activeRecommendationExecution?.impactResult ? (
              <>
                <div className="flex items-center justify-between"><span>Status</span><Badge tone={activeRecommendationExecution.impactResult.status === 'improved' ? 'green' : activeRecommendationExecution.impactResult.status === 'regressed' ? 'red' : 'amber'}>{activeRecommendationExecution.impactResult.status}</Badge></div>
                <div className="flex items-center justify-between"><span>Score delta</span><b>{activeRecommendationExecution.impactResult.scoreDelta}</b></div>
                <div className="flex items-center justify-between"><span>Confidence</span><b>{activeRecommendationExecution.impactResult.confidenceBefore} {'->'} {activeRecommendationExecution.impactResult.confidenceAfter}</b></div>
                <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">Outcome {activeRecommendationExecution.impactResult.outcomeId ?? 'pending'} linked to recommendation execution.</div>
              </>
            ) : <p className="text-slate-500">Impact result appears after a completed recommendation execution is verified.</p>}
          </div>
        </Panel>
        <Panel title="Linked Action Plan">
          <div className="col-span-full grid grid-cols-3 gap-3 p-4">
            {recommendationExecutions.slice(0, 6).map((execution) => (
              <div key={execution.id} data-recommendation-linked-plan className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{execution.linkedActionPlanId ?? actionPlan.id}</b><Badge tone={recommendationExecutionTone(execution.status)}>{execution.status}</Badge></div>
                <p className="mt-2 text-slate-500">Recommendation execution shares action-plan evidence and impact verification.</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Verification Evidence">
          <div className="col-span-full grid grid-cols-3 gap-3 p-4">
            {recommendationExecutions.flatMap((execution) => execution.evidence.map((evidence) => (
              <div key={evidence.id} data-recommendation-execution-evidence={evidence.type} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{evidence.title}</b><Badge tone="green">{evidence.type}</Badge></div>
                <p className="mt-2 text-slate-500">{evidence.description}</p>
                <div className="mt-3 text-xs font-bold uppercase text-slate-400">{evidence.createdBy}</div>
              </div>
            )))}
            {!recommendationExecutions.some((execution) => execution.evidence.length) ? <p className="text-sm text-slate-500">Evidence appears after execution completion.</p> : null}
          </div>
        </Panel>
        <Panel title="Verified Executions">
          <div className="col-span-full grid grid-cols-3 gap-3 p-4">
            {[...completedRecommendationExecutions, ...verifiedRecommendationExecutions].slice(0, 6).map((execution) => (
              <div key={execution.id} data-recommendation-execution-result className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{execution.id.replace('recommendation-execution-', '').slice(0, 42)}</b><Badge tone={recommendationExecutionTone(execution.status)}>{execution.status}</Badge></div>
                <p className="mt-2 text-slate-500">Confidence after verification: {execution.impactResult?.confidenceAfter ?? 'pending'}.</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="mt-5 grid grid-cols-[360px_1fr_420px] gap-5" data-improvement-loop-panel>
        <Panel title="Autonomous Improvement Loop">
          <div className="space-y-3 p-4 text-sm">
            <div className="flex items-center justify-between"><span>Total loops</span><b>{loopSummary.total}</b></div>
            <div className="flex items-center justify-between"><span>Active / paused</span><b>{loopSummary.active}/{loopSummary.paused}</b></div>
            <div className="flex items-center justify-between"><span>Waiting review</span><Badge tone={loopSummary.waitingReview ? 'red' : 'green'}>{loopSummary.waitingReview}</Badge></div>
            <div className="flex items-center justify-between"><span>Confidence delta</span><Badge tone={loopOutcomeSummary.averageConfidenceDelta >= 0 ? 'green' : 'red'}>{loopOutcomeSummary.averageConfidenceDelta}</Badge></div>
            <Button variant="secondary" onClick={() => { const recommendation = acceptedRecommendations[0] ?? (topLearningRecommendations[0] ? markRecommendationAccepted(topLearningRecommendations[0].id) : undefined); if (recommendation) createImprovementLoop(recommendation.id); window.location.reload(); }}><RotateCcw className="h-4 w-4" />Create loop</Button>
            <Button variant="secondary" onClick={() => { if (activeImprovementLoop) exportImprovementLoopArtifacts(activeImprovementLoop.id); else exportImprovementLoopArtifacts(); window.location.reload(); }}><FileText className="h-4 w-4" />Export loop</Button>
          </div>
        </Panel>
        <Panel title="Loop Lifecycle Board">
          <div className="grid grid-cols-2 gap-3 p-4">
            {improvementLoops.length ? improvementLoops.map((loop) => {
              const readiness = selectLoopReadiness(loop.id);
              return (
                <div key={loop.id} data-improvement-loop={loop.status} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                  <div className="flex items-start justify-between gap-3"><b>{loop.trigger.type.replace(/_/g, ' ')}</b><Badge tone={improvementLoopTone(loop.status)}>{loop.status}</Badge></div>
                  <p className="mt-2 text-slate-500">Recommendation {loop.recommendationId.replace('recommendation-', '').slice(0, 52)}</p>
                  <div className="mt-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-400">
                    <span>{readiness.status}</span>
                    <span>{loop.confidenceAtCreation}%</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { scheduleImprovementLoop(loop.id); window.location.reload(); }}>Schedule</button>
                    <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { try { startImprovementLoop(loop.id); } catch { /* visible through readiness */ } window.location.reload(); }}>Start</button>
                    <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { pauseImprovementLoop(loop.id); window.location.reload(); }}>Pause</button>
                    <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { resumeImprovementLoop(loop.id); window.location.reload(); }}>Resume</button>
                    <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { cancelImprovementLoop(loop.id); window.location.reload(); }}>Cancel</button>
                  </div>
                </div>
              );
            }) : <p className="text-sm text-slate-500">Create a loop from an accepted recommendation to schedule autonomous improvement actions.</p>}
          </div>
        </Panel>
        <Panel title="Readiness Checklist">
          <div className="space-y-3 p-4 text-sm">
            {activeLoopReadiness ? (
              <>
                <div className="flex items-center justify-between"><span>Status</span><Badge tone={activeLoopReadiness.status === 'ready' ? 'green' : activeLoopReadiness.status === 'approval_required' ? 'amber' : 'red'}>{activeLoopReadiness.status}</Badge></div>
                {activeLoopReadiness.policies.map((policy) => (
                  <div key={policy.id} data-improvement-loop-policy={policy.id} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-center justify-between gap-3"><b>{policy.name}</b><Badge tone={policy.passed ? 'green' : policy.severity === 'blocking' ? 'red' : 'amber'}>{policy.passed ? 'pass' : policy.severity}</Badge></div>
                    <p className="mt-2 text-slate-500">{policy.message}</p>
                  </div>
                ))}
              </>
            ) : <p className="text-slate-500">Readiness appears after the first loop is created.</p>}
          </div>
        </Panel>
        <Panel title="Loop Runs & Outcomes">
          <div className="col-span-full grid grid-cols-3 gap-3 p-4">
            {loopRuns.length ? loopRuns.map((run) => (
              <div key={run.id} data-improvement-loop-run={run.status} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>Attempt {run.attempt}</b><Badge tone={improvementLoopTone(run.status)}>{run.status}</Badge></div>
                <p className="mt-2 text-slate-500">{run.failureReason ?? run.evidence.join(' ') ?? 'Loop run awaiting evidence.'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { completeImprovementLoopRun(run.id, ['Demo loop evidence captured.']); window.location.reload(); }}>Complete</button>
                </div>
              </div>
            )) : <p className="text-sm text-slate-500">Loop runs are created when a ready loop starts.</p>}
          </div>
        </Panel>
        <Panel title="Schedule & Learning Delta">
          <div className="col-span-full grid grid-cols-4 gap-3 p-4">
            <div className="rounded-xl border border-slate-100 bg-white p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-400">Schedules</div><div className="mt-2 text-2xl font-extrabold">{loopScheduleSummary.active}/{loopScheduleSummary.total}</div><p className="mt-2 text-xs text-slate-500">Next {loopScheduleSummary.nextRunAt?.slice(0, 16) ?? 'not scheduled'}</p></div>
            <div className="rounded-xl border border-slate-100 bg-white p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-400">Outcomes</div><div className="mt-2 text-2xl font-extrabold">{loopOutcomeSummary.improved}/{loopOutcomeSummary.regressed}</div><p className="mt-2 text-xs text-slate-500">Improved vs regressed loops.</p></div>
            <div className="rounded-xl border border-slate-100 bg-white p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-400">Active runs</div><div className="mt-2 text-2xl font-extrabold">{activeImprovementLoops.length}</div><p className="mt-2 text-xs text-slate-500">Running, scheduled, or waiting review.</p></div>
            <div className="rounded-xl border border-slate-100 bg-white p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-400">Last run</div><div className="mt-2 text-2xl font-extrabold">{activeLoopRuns[0]?.status ?? 'none'}</div><p className="mt-2 text-xs text-slate-500">Linked recommendation execution {activeImprovementLoop?.recommendationExecutionId?.slice(-8) ?? 'pending'}.</p></div>
          </div>
        </Panel>
      </div>
      <div className="mt-5 grid grid-cols-[360px_1fr_420px] gap-5" data-improvement-loop-governance-panel>
        <Panel title="Loop Governance Status">
          <div className="space-y-3 p-4 text-sm">
            <div className="flex items-center justify-between"><span>Kill switch</span><Badge tone={globalLoopKillSwitch.enabled ? 'red' : 'green'}>{globalLoopKillSwitch.enabled ? 'enabled' : 'disabled'}</Badge></div>
            <div className="flex items-center justify-between"><span>Decisions</span><b>{loopGovernanceSummary.totalDecisions}</b></div>
            <div className="flex items-center justify-between"><span>Blocked / killed</span><b>{loopGovernanceSummary.blocked}/{loopGovernanceSummary.killed}</b></div>
            <div className="flex items-center justify-between"><span>Rollback required</span><Badge tone={loopGovernanceSummary.rollbackRequired ? 'red' : 'green'}>{loopGovernanceSummary.rollbackRequired}</Badge></div>
            <Button data-workflow="loop-kill-switch" variant="secondary" onClick={() => { enableGlobalLoopKillSwitch('Enabled from evaluation governance panel.'); window.location.reload(); }}><AlertTriangle className="h-4 w-4" />Enable kill switch</Button>
            <Button variant="secondary" onClick={() => { disableGlobalLoopKillSwitch(); window.location.reload(); }}><ShieldCheck className="h-4 w-4" />Disable kill switch</Button>
          </div>
        </Panel>
        <Panel title="Blockers & Rollback">
          <div className="grid grid-cols-2 gap-3 p-4">
            {(activeLoopBlockers.length ? activeLoopBlockers : ['No blockers detected']).map((blocker) => (
              <div key={blocker} data-loop-governance-blocker={blocker} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{String(blocker).replace(/_/g, ' ')}</b><Badge tone={blocker === 'No blockers detected' ? 'green' : 'red'}>{blocker === 'No blockers detected' ? 'clear' : 'blocked'}</Badge></div>
                <p className="mt-2 text-slate-500">Current loop governance blocker state for autonomous execution.</p>
              </div>
            ))}
            {rollbackRequiredLoops.map((loop) => (
              <div key={loop.id} data-loop-rollback-required className="rounded-xl border border-red-100 bg-red-50/50 p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{loop.id.slice(0, 48)}</b><Badge tone="red">rollback</Badge></div>
                <p className="mt-2 text-slate-600">Rollback required before another autonomous attempt.</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Governance Controls">
          <div className="space-y-3 p-4 text-sm">
            <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs font-bold uppercase text-slate-400">Paused by governance</div><div className="text-2xl font-extrabold">{pausedByGovernanceLoops.length}</div></div>
            <Button variant="secondary" onClick={() => { pauseAllLoops('Paused from evaluation governance panel.'); window.location.reload(); }}><AlertTriangle className="h-4 w-4" />Pause all loops</Button>
            <Button variant="secondary" onClick={() => { resumeAllowedLoops(); window.location.reload(); }}><Play className="h-4 w-4" />Resume allowed</Button>
            <Button variant="secondary" onClick={() => { if (activeImprovementLoop) rollbackLoop(activeImprovementLoop.id); window.location.reload(); }}><RotateCcw className="h-4 w-4" />Create rollback</Button>
            <Button variant="secondary" onClick={() => { exportLoopGovernanceArtifacts(); window.location.reload(); }}><FileText className="h-4 w-4" />Export governance</Button>
          </div>
        </Panel>
        <Panel title="Governance Audit Timeline">
          <div className="col-span-full grid grid-cols-4 gap-3 p-4">
            {loopGovernanceAuditTrail.length ? loopGovernanceAuditTrail.slice(-8).map((event) => (
              <div key={event.id} data-loop-governance-audit={event.decision} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{event.action}</b><Badge tone={event.decision === 'ALLOW' ? 'green' : event.decision === 'PAUSE' ? 'amber' : 'red'}>{event.decision}</Badge></div>
                <p className="mt-2 text-slate-500">{event.message}</p>
                <div className="mt-3 text-xs font-bold uppercase text-slate-400">{event.createdAt.slice(11, 19)}</div>
              </div>
            )) : <p className="text-sm text-slate-500">Governance decisions appear when loops start, pause, retry, or hit kill switch controls.</p>}
          </div>
        </Panel>
      </div>
      <div className="mt-5 grid grid-cols-[360px_1fr_420px] gap-5" data-improvement-loop-queue-panel>
        <Panel title="Loop Queue Dashboard">
          <div className="space-y-3 p-4 text-sm">
            <div className="flex items-center justify-between"><span>Total queue</span><b>{queueSummary.total}</b></div>
            <div className="flex items-center justify-between"><span>Queued / running</span><b>{queueSummary.queued}/{queueSummary.running}</b></div>
            <div className="flex items-center justify-between"><span>Blocked / approval</span><b>{queueSummary.blocked}/{queueSummary.waitingApproval}</b></div>
            <div className="flex items-center justify-between"><span>Concurrency</span><Badge tone={queueConcurrency.saturated ? 'red' : 'green'}>{queueConcurrency.activeCount}/{queueConcurrency.maxConcurrency}</Badge></div>
            <Button data-workflow="queue-enqueue" variant="secondary" onClick={() => { const loop = activeImprovementLoop ?? (acceptedRecommendations[0] ? createImprovementLoop(acceptedRecommendations[0].id) : undefined); if (loop) enqueueImprovementLoop(loop.id); window.location.reload(); }}><ListChecks className="h-4 w-4" />Enqueue loop</Button>
            <Button variant="secondary" onClick={() => { processQueueTick(); window.location.reload(); }}><Play className="h-4 w-4" />Process tick</Button>
            <Button variant="secondary" onClick={() => { exportImprovementLoopQueueArtifacts(); window.location.reload(); }}><FileText className="h-4 w-4" />Export queue</Button>
          </div>
        </Panel>
        <Panel title="Next Eligible Loop">
          <div className="space-y-3 p-4 text-sm">
            {nextEligibleQueueItem ? (
              <div data-next-eligible-loop className="rounded-xl border border-slate-100 bg-white p-3">
                <div className="flex items-start justify-between gap-3"><b>{nextEligibleQueueItem.priority}</b><Badge tone={nextEligibleQueueItem.priority === 'critical' ? 'red' : nextEligibleQueueItem.priority === 'urgent' ? 'amber' : 'blue'}>{nextEligibleQueueItem.status}</Badge></div>
                <p className="mt-2 text-slate-500">{nextEligibleQueueItem.loopId.slice(0, 72)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button data-workflow="queue-start" className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { startQueuedLoop(nextEligibleQueueItem.id); window.location.reload(); }}>Start</button>
                  <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { cancelQueuedLoop(nextEligibleQueueItem.id); window.location.reload(); }}>Cancel</button>
                </div>
              </div>
            ) : <p className="text-slate-500">No eligible queue item. Kill switch, concurrency, governance, or schedule windows may be holding execution.</p>}
          </div>
        </Panel>
        <Panel title="Queue Health">
          <div className="grid grid-cols-2 gap-3 p-4 text-sm">
            {[['Running', runningQueueItems.length, 'blue'], ['Blocked', blockedQueueItems.length, 'red'], ['Approval', waitingApprovalQueueItems.length, 'amber'], ['Completed', queueSummary.completed, 'green']].map(([label, value, tone]) => (
              <div key={label} className="rounded-xl border border-slate-100 p-3"><div className="text-xs font-bold uppercase text-slate-400">{label}</div><div className="mt-2 flex items-end justify-between"><b className="text-2xl">{value}</b><Badge tone={tone as Tone}>{label}</Badge></div></div>
            ))}
          </div>
        </Panel>
        <Panel title="Queue Items">
          <div className="col-span-full grid grid-cols-3 gap-3 p-4">
            {loopQueueItems.length ? loopQueueItems.map((item) => (
              <div key={item.id} data-improvement-loop-queue-item={item.status} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{item.priority}</b><Badge tone={item.status === 'blocked' || item.status === 'killed' ? 'red' : item.status === 'running' ? 'blue' : item.status === 'completed' ? 'green' : 'amber'}>{item.status}</Badge></div>
                <p className="mt-2 text-slate-500">{item.blocker ?? item.loopId.slice(0, 80)}</p>
                <div className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">Retry {item.retryPolicy.retryCount}/{item.retryPolicy.maxRetries}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button data-workflow="queue-pause" className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { pauseQueuedLoop(item.id); window.location.reload(); }}>Pause</button>
                  <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { retryFailedLoop(item.id); window.location.reload(); }}>Retry</button>
                  <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { completeQueuedLoop(item.id); window.location.reload(); }}>Complete</button>
                  <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { cancelQueuedLoop(item.id); window.location.reload(); }}>Cancel</button>
                </div>
              </div>
            )) : <p className="text-sm text-slate-500">Queue items appear after an improvement loop is enqueued.</p>}
          </div>
        </Panel>
        <Panel title="Queue Audit Trail">
          <div className="col-span-full grid grid-cols-4 gap-3 p-4">
            {queueAuditTrail.slice(-8).map((event) => (
              <div key={event.id} data-loop-queue-audit={event.status} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{event.action}</b><Badge tone={event.status === 'blocked' || event.status === 'killed' ? 'red' : event.status === 'running' ? 'blue' : event.status === 'completed' ? 'green' : 'amber'}>{event.status}</Badge></div>
                <p className="mt-2 text-slate-500">{event.message}</p>
              </div>
            ))}
            {!queueAuditTrail.length ? <p className="text-sm text-slate-500">Queue audit events are recorded for enqueue, start, retry, cancel, and scheduler ticks.</p> : null}
          </div>
        </Panel>
      </div>
      <div className="mt-5 grid grid-cols-[360px_1fr_420px] gap-5" data-improvement-loop-worker-panel>
        <Panel title="Loop Worker Status">
          <div className="space-y-3 p-4 text-sm">
            <div className="flex items-center justify-between"><span>Status</span><Badge tone={workerStatus === 'failed' ? 'red' : workerStatus === 'executing' ? 'blue' : workerStatus === 'paused' ? 'amber' : 'green'}>{workerStatus}</Badge></div>
            <div className="flex items-center justify-between"><span>Active item</span><b className="max-w-[170px] truncate">{activeWorker?.activeQueueItemId ?? 'none'}</b></div>
            <div className="flex items-center justify-between"><span>Heartbeat</span><b>{workerHeartbeat?.recordedAt ? new Date(workerHeartbeat.recordedAt).toLocaleTimeString() : 'none'}</b></div>
            {workerBlockedReason ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-700">Blocked: {workerBlockedReason}</div> : null}
            <div className="grid grid-cols-2 gap-2">
              <Button data-workflow="worker-start" variant="secondary" onClick={() => { startImprovementLoopWorker(); window.location.reload(); }}><Play className="h-4 w-4" />Start</Button>
              <Button variant="secondary" onClick={() => { runWorkerTick(); window.location.reload(); }}><RotateCcw className="h-4 w-4" />Tick</Button>
              <Button variant="secondary" onClick={() => { pauseImprovementLoopWorker(); window.location.reload(); }}>Pause</Button>
              <Button variant="secondary" onClick={() => { resumeImprovementLoopWorker(); window.location.reload(); }}>Resume</Button>
              <Button data-workflow="worker-stop" variant="secondary" onClick={() => { stopImprovementLoopWorker(); window.location.reload(); }}>Stop</Button>
              <Button variant="secondary" onClick={() => { recordWorkerHeartbeat(); window.location.reload(); }}>Heartbeat</Button>
            </div>
          </div>
        </Panel>
        <Panel title="Active Worker Run">
          <div className="space-y-3 p-4 text-sm">
            <div data-worker-active-item className="rounded-xl border border-slate-100 bg-white p-3">
              <div className="text-xs font-bold uppercase text-slate-400">Active queue item</div>
              <p className="mt-2 font-semibold text-slate-700">{activeWorker?.activeQueueItemId ?? 'No active execution'}</p>
              <p className="mt-1 text-slate-500">Worker executes only through queue, governance, and loop stores.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { completeWorkerRun(); window.location.reload(); }}>Complete active</button>
              <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { failWorkerRun(undefined, 'manual_worker_failure'); window.location.reload(); }}>Fail active</button>
              <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { recoverStaleWorker(); window.location.reload(); }}>Recover stale</button>
              <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => { exportImprovementLoopWorkerArtifacts(); window.location.reload(); }}>Export worker</button>
            </div>
          </div>
        </Panel>
        <Panel title="Worker Execution Summary">
          <div className="grid grid-cols-2 gap-3 p-4 text-sm">
            {[['Ticks', workerSummary.totalTicks, 'blue'], ['Results', workerSummary.totalResults, 'green'], ['Retrying', workerSummary.retrying, 'amber'], ['Failed', workerSummary.failed, 'red']].map(([label, value, tone]) => (
              <div key={label} className="rounded-xl border border-slate-100 p-3"><div className="text-xs font-bold uppercase text-slate-400">{label}</div><div className="mt-2 flex items-end justify-between"><b className="text-2xl">{value}</b><Badge tone={tone as Tone}>{label}</Badge></div></div>
            ))}
          </div>
        </Panel>
        <Panel title="Latest Worker Tick Log">
          <div className="col-span-2 grid grid-cols-3 gap-3 p-4">
            {workerTicks.slice(-6).map((tick) => (
              <div key={tick.id} data-worker-tick={tick.status} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>#{tick.sequence}</b><Badge tone={tick.status === 'failed' ? 'red' : tick.status === 'executing' ? 'blue' : tick.status === 'paused' ? 'amber' : 'green'}>{tick.status}</Badge></div>
                <p className="mt-2 text-slate-500">{tick.message}</p>
              </div>
            ))}
            {!workerTicks.length ? <p className="text-sm text-slate-500">Worker ticks appear after the runner starts polling.</p> : null}
          </div>
        </Panel>
        <Panel title="Stale Worker Warnings">
          <div className="p-4 text-sm">
            {staleWorkerWarnings.length ? staleWorkerWarnings.map((warning) => (
              <div key={warning.workerId} data-worker-stale-warning className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
                {warning.workerId} stale for {warning.staleForMs}ms
              </div>
            )) : <p className="text-slate-500">No stale worker warnings.</p>}
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
