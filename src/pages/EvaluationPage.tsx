import { BarChart3, CheckCircle2, FileText, ShieldCheck, Sparkles, Wrench } from 'lucide-react';
import { Badge, Button, PageHeader, Panel, ProgressBar } from '../components/ui/DemoPrimitives';
import { DEMO_RUN_ID } from '../data/demo-fixtures';
import type { Tone } from '../data/demoScreens';
import {
  selectRunEvaluation,
  selectRunEvaluationIssues,
  selectRunEvaluationRecommendations,
  selectRunsByEvaluationScore,
  selectWorkspaceEvaluationSummary,
} from '../domain/selectors';
import { registerRunEvaluationExports } from '../runtime/run-evaluation-store';
import type { RunEvaluationScore } from '../runtime/run-evaluation';

function scoreTone(score: number): Tone {
  if (score >= 90) return 'green';
  if (score >= 75) return 'blue';
  if (score >= 60) return 'amber';
  return 'red';
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

export function EvaluationPage() {
  const evaluation = selectRunEvaluation(DEMO_RUN_ID);
  const summary = selectWorkspaceEvaluationSummary();
  const evaluations = selectRunsByEvaluationScore(0);
  const issues = selectRunEvaluationIssues(DEMO_RUN_ID);
  const recommendations = selectRunEvaluationRecommendations(DEMO_RUN_ID);
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
        actions={<><Button variant="secondary" onClick={() => registerRunEvaluationExports(DEMO_RUN_ID)}><FileText className="h-4 w-4" />Export evaluation</Button><Button><Sparkles className="h-4 w-4" />Refresh score</Button></>}
      />
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
