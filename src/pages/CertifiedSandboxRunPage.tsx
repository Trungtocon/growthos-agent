import { CheckCircle2, FileText, Play, ShieldCheck, TestTube2, XCircle } from 'lucide-react';
import { Badge, Button, PageHeader, Panel, ProgressBar } from '../components/ui/DemoPrimitives';
import { DEMO_RUN_ID, DEMO_TICKET_ID } from '../data/demo-fixtures';
import type { Tone } from '../data/demoScreens';
import {
  selectCertifiedSandboxArtifacts,
  selectCertifiedSandboxAuditTrail,
  selectCertifiedSandboxBlockers,
  selectCertifiedSandboxPreflight,
  selectCertifiedSandboxRunDashboard,
  selectLearningMemorySummary,
  selectRunEvaluation,
  selectUsageLedger,
} from '../domain/selectors';
import {
  approveCertifiedSandboxRun,
  completeCertifiedSandboxRun,
  createCertifiedSandboxRun,
  evaluateCertifiedSandboxPreflight,
  exportCertifiedSandboxRunArtifacts,
  failCertifiedSandboxRun,
  startCertifiedSandboxRun,
} from '../runtime/certified-sandbox-run-store';
import { ApiContractsCompactWidget } from './ApiContractsPage';
import { BackendAdapterCompactWidget } from './BackendAdapterPage';
import { DeploymentConfigCompactWidget } from './DeploymentConfigPage';
import { ProductionReadinessCompactWidget } from './ProductionReadinessPage';

type CertifiedSandboxWidgetSurface =
  | 'runtime-certification'
  | 'run'
  | 'execution-timeline'
  | 'execution-graph'
  | 'artifacts'
  | 'evaluation'
  | 'worker-control'
  | 'chaos';

function toneFor(value: string): Tone {
  if (value.includes('blocked') || value.includes('failed') || value.includes('production') || value.includes('offline')) return 'red';
  if (value.includes('waiting') || value.includes('warning') || value.includes('approval') || value.includes('draft')) return 'amber';
  if (value.includes('running') || value.includes('ready')) return 'blue';
  if (value.includes('completed') || value.includes('certified') || value.includes('passed')) return 'green';
  return 'slate';
}

function reload() {
  window.location.reload();
}

export function CertifiedSandboxRunCompactWidget({ surface }: { surface: CertifiedSandboxWidgetSurface }) {
  const dashboard = selectCertifiedSandboxRunDashboard();
  return (
    <span
      data-certified-sandbox-widget={surface}
      data-certified-sandbox-status={dashboard.status}
      data-certified-sandbox-runs={dashboard.runs.length}
      data-certified-sandbox-completed={dashboard.completedRuns}
      className="sr-only"
    >
      Certified sandbox {surface}: {dashboard.status}, {dashboard.runs.length} runs, {dashboard.completedRuns} completed.
    </span>
  );
}

export function CertifiedSandboxRunPage() {
  const dashboard = selectCertifiedSandboxRunDashboard();
  const activeRun = dashboard.activeRun;
  const preflight = selectCertifiedSandboxPreflight(activeRun?.id);
  const blockers = selectCertifiedSandboxBlockers(activeRun?.id);
  const artifacts = selectCertifiedSandboxArtifacts(activeRun?.id);
  const auditTrail = selectCertifiedSandboxAuditTrail(activeRun?.id);
  const usage = selectUsageLedger(DEMO_RUN_ID);
  const evaluation = selectRunEvaluation(DEMO_RUN_ID);
  const learning = selectLearningMemorySummary();
  const completedSteps = dashboard.steps.filter((step) => step.status === 'completed').length;
  const stepProgress = dashboard.steps.length ? Math.round((completedSteps / dashboard.steps.length) * 100) : 0;

  return (
    <div data-route="/certified-sandbox-run" data-certified-sandbox-route>
      <ProductionReadinessCompactWidget surface="certified-sandbox-run" />
      <DeploymentConfigCompactWidget surface="certified-sandbox-run" />
      <BackendAdapterCompactWidget surface="certified-sandbox-run" />
      <ApiContractsCompactWidget surface="certified-sandbox-run" />
      <PageHeader
        title="Certified Sandbox End-to-End Run"
        subtitle="Run a full Hermes/Paperclip workflow only after runtime certification, sandbox safety, and governance preflight are satisfied."
        actions={<><Button data-workflow="certified-sandbox-export" variant="secondary" disabled={!activeRun} data-disabled-reason={!activeRun ? 'Create a certified sandbox run before exporting artifacts.' : undefined} title={!activeRun ? 'Create a certified sandbox run before exporting artifacts.' : undefined} onClick={() => { if (activeRun) exportCertifiedSandboxRunArtifacts(activeRun.id); reload(); }}><FileText className="h-4 w-4" />Export final</Button><Button data-workflow="certified-sandbox-create" onClick={() => { createCertifiedSandboxRun({ ticketId: DEMO_TICKET_ID }); reload(); }}><TestTube2 className="h-4 w-4" />Create run</Button></>}
      />

      <div className="grid grid-cols-5 gap-4" data-certified-sandbox-summary>
        {[
          { label: 'Status', value: dashboard.status, tone: toneFor(dashboard.status) },
          { label: 'Runs', value: dashboard.runs.length, tone: 'blue' },
          { label: 'Completed', value: dashboard.completedRuns, tone: 'green' },
          { label: 'Blocked', value: dashboard.blockedRuns, tone: dashboard.blockedRuns ? 'red' : 'green' },
          { label: 'Artifacts', value: artifacts.length, tone: 'slate' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</div>
            <div className="mt-3 flex items-center justify-between gap-3"><b className="truncate text-2xl text-slate-950">{item.value}</b><Badge tone={item.tone as Tone}>{item.label}</Badge></div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[360px_1fr_400px] gap-5">
        <Panel title="Certification Gate">
          <div className="space-y-3 p-4 text-sm" data-certified-sandbox-certification-gate>
            <div className="flex justify-between"><span>Active run</span><b>{activeRun?.id ?? 'none'}</b></div>
            <div className="flex justify-between"><span>Certification</span><Badge tone={toneFor(preflight?.certificationStatus ?? 'not_started')}>{preflight?.certificationStatus ?? 'not_started'}</Badge></div>
            <div className="flex justify-between"><span>Runtime mode</span><Badge tone={toneFor(activeRun?.runtimeMode ?? 'mock')}>{activeRun?.runtimeMode ?? 'mock'}</Badge></div>
            <div className="flex justify-between"><span>Sandbox health</span><Badge tone={toneFor(preflight?.sandboxHealth ?? activeRun?.sandboxHealth ?? 'missing_config')}>{preflight?.sandboxHealth ?? activeRun?.sandboxHealth ?? 'missing_config'}</Badge></div>
            <div className="flex flex-wrap gap-2 pt-2">
              {activeRun ? <Button variant="secondary" onClick={() => { evaluateCertifiedSandboxPreflight(activeRun.id); reload(); }}><ShieldCheck className="h-4 w-4" />Preflight</Button> : null}
              {activeRun ? <Button onClick={() => { startCertifiedSandboxRun(activeRun.id); reload(); }}><Play className="h-4 w-4" />Start</Button> : null}
            </div>
          </div>
        </Panel>

        <Panel title="Sandbox Preflight">
          <div className="grid grid-cols-2 gap-3 p-4 text-sm" data-certified-sandbox-preflight>
            <div className="rounded-xl bg-slate-50 p-3"><b>Preflight status</b><p className="mt-2"><Badge tone={toneFor(preflight?.status ?? 'not_started')}>{preflight?.status ?? 'not_started'}</Badge></p></div>
            <div className="rounded-xl bg-slate-50 p-3"><b>Approval required</b><p className="mt-2"><Badge tone={preflight?.approvalRequired ? 'amber' : 'green'}>{String(Boolean(preflight?.approvalRequired))}</Badge></p></div>
            <div className="rounded-xl bg-slate-50 p-3"><b>Warnings</b><p className="mt-2 font-semibold text-slate-600">{preflight?.warnings.length ?? 0}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><b>Blockers</b><p className="mt-2 font-semibold text-slate-600">{blockers.length}</p></div>
            {blockers.map((blocker) => <div key={blocker.id} className="rounded-xl border border-red-100 bg-red-50 p-3 text-red-700"><b>{blocker.code}</b><p className="mt-1">{blocker.message}</p></div>)}
          </div>
        </Panel>

        <Panel title="Run Lifecycle">
          <div className="space-y-3 p-4 text-sm" data-certified-sandbox-lifecycle>
            <ProgressBar value={stepProgress} label="Certified sandbox progress" />
            <div className="flex flex-wrap gap-2">
              {activeRun?.status === 'waiting_approval' ? <Button onClick={() => { approveCertifiedSandboxRun(activeRun.id); reload(); }}><CheckCircle2 className="h-4 w-4" />Approve</Button> : null}
              {activeRun ? <Button variant="secondary" onClick={() => { completeCertifiedSandboxRun(activeRun.id); reload(); }}>Complete</Button> : null}
              {activeRun ? <Button variant="danger" onClick={() => { failCertifiedSandboxRun(activeRun.id, 'Manual certified sandbox failure.'); reload(); }}><XCircle className="h-4 w-4" />Fail</Button> : null}
            </div>
            <div className="max-h-[310px] space-y-2 overflow-hidden">
              {dashboard.steps.map((step) => <div key={step.id} className="flex justify-between rounded-lg border border-slate-100 px-3 py-2"><span>{step.order}. {step.name}</span><Badge tone={toneFor(step.status)}>{step.status}</Badge></div>)}
            </div>
          </div>
        </Panel>

        <Panel title="Tool Calls">
          <div className="space-y-2 p-4 text-sm" data-certified-sandbox-tool-calls>
            {dashboard.results.map((result) => <div key={result.id} className="rounded-xl border border-slate-100 p-3"><b>{result.toolCallId ?? 'pending tool'}</b><p className="mt-1 text-slate-500">{result.workflowRunId}</p></div>)}
            {!dashboard.results.length ? <p className="text-slate-500">Tool call evidence appears after the run starts.</p> : null}
          </div>
        </Panel>

        <Panel title="Artifact Output">
          <div className="space-y-2 p-4 text-sm" data-certified-sandbox-artifacts>
            {artifacts.map((artifact) => <div key={artifact.id} className="flex justify-between rounded-lg border border-slate-100 px-3 py-2"><span>{artifact.name}</span><Badge tone="green">{artifact.type}</Badge></div>)}
            {!artifacts.length ? <p className="text-slate-500">Paperclip output and export artifacts appear after execution.</p> : null}
          </div>
        </Panel>

        <Panel title="Usage & Cost">
          <div className="space-y-3 p-4 text-sm" data-certified-sandbox-usage>
            <div className="flex justify-between"><span>Usage records</span><b>{usage.records.length}</b></div>
            <div className="flex justify-between"><span>Estimated</span><b>${usage.estimatedTotal.toFixed(4)}</b></div>
            <div className="flex justify-between"><span>Actual</span><b>${usage.actualTotal.toFixed(4)}</b></div>
            <div className="flex justify-between"><span>Variance</span><b>${usage.variance.toFixed(4)}</b></div>
          </div>
        </Panel>

        <Panel title="Evaluation Score">
          <div className="space-y-3 p-4 text-sm" data-certified-sandbox-evaluation>
            <div className="flex justify-between"><span>Status</span><Badge tone={toneFor(evaluation.status)}>{evaluation.status}</Badge></div>
            <div className="flex justify-between"><span>Overall</span><b>{evaluation.overallScore}</b></div>
            <ProgressBar value={evaluation.overallScore} label="Run evaluation score" />
          </div>
        </Panel>

        <Panel title="Learning Memory Update">
          <div className="space-y-3 p-4 text-sm" data-certified-sandbox-learning>
            <div className="flex justify-between"><span>Signals</span><b>{learning.signalCount}</b></div>
            <div className="flex justify-between"><span>Recommendations</span><b>{learning.recommendationCount}</b></div>
            <div className="flex justify-between"><span>Average confidence</span><b>{learning.averageConfidence}</b></div>
          </div>
        </Panel>

        <Panel title="Audit Trail">
          <div className="max-h-[360px] space-y-2 overflow-hidden p-4 text-sm" data-certified-sandbox-audit>
            {auditTrail.map((event) => <div key={event.id} className="rounded-lg border border-slate-100 px-3 py-2"><b>{event.type}</b><p className="mt-1 text-slate-500">{event.message}</p></div>)}
            {!auditTrail.length ? <p className="text-slate-500">Audit trail starts when a certified sandbox run is created.</p> : null}
          </div>
        </Panel>

        <Panel title="Final Export">
          <div className="space-y-3 p-4 text-sm" data-certified-sandbox-final-export>
            {artifacts.slice(0, 8).map((artifact) => <div key={artifact.id} className="rounded-lg bg-slate-50 p-2 font-semibold text-slate-600">{artifact.name}</div>)}
            {!artifacts.length ? <p className="text-slate-500">Final export package is generated after export.</p> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
