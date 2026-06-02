import { FileText, Play, Rocket, ShieldAlert } from 'lucide-react';
import { Badge, Button, PageHeader, Panel } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import {
  selectE2EActionFlowArtifacts,
  selectE2EActionFlows,
  selectE2EActionFlowSummary,
} from '../domain/selectors';
import type { E2EActionFlowId } from '../runtime/e2e-action-flow';
import {
  exportE2EActionFlowArtifacts,
  runAllE2EActionFlows,
  runE2EActionFlow,
  validateE2EFlowContracts,
} from '../runtime/e2e-action-flow-store';
import { PreGoLiveValidationCompactWidget } from './PreGoLiveValidationPage';

type E2EWidgetSurface =
  | 'api-contracts'
  | 'backend-adapter'
  | 'production-readiness'
  | 'deployment-config'
  | 'certified-sandbox-run'
  | 'run'
  | 'worker-control'
  | 'artifacts';

function toneFor(value: string): Tone {
  if (value.includes('blocked') || value.includes('failed') || value.includes('BLOCKED')) return 'red';
  if (value.includes('waiting') || value.includes('mock') || value.includes('fallback') || value.includes('WARNING')) return 'amber';
  if (value.includes('completed') || value.includes('COMPLETED')) return 'green';
  if (value.includes('running')) return 'blue';
  return 'slate';
}

function reload() {
  window.location.reload();
}

export function E2EActionFlowCompactWidget({ surface }: { surface: E2EWidgetSurface }) {
  const summary = selectE2EActionFlowSummary();
  return (
    <span
      data-e2e-action-flow-widget={surface}
      data-e2e-action-flow-widget-total={summary.total}
      data-e2e-action-flow-widget-completed={summary.completed}
      data-e2e-action-flow-widget-blocked={summary.blocked}
      className="sr-only"
    >
      E2E action flow {surface}: {summary.completed}/{summary.total} completed, {summary.blocked} blocked.
    </span>
  );
}

export function E2EActionFlowPage() {
  const flows = selectE2EActionFlows();
  const summary = selectE2EActionFlowSummary();
  const artifacts = selectE2EActionFlowArtifacts();
  const selected = flows.find((flow) => flow.status !== 'idle') ?? flows[0];

  return (
    <div data-route="/e2e-action-flow" data-e2e-action-flow-route>
      <PreGoLiveValidationCompactWidget surface="e2e-action-flow" />
      <PageHeader
        title="End-to-End Production Action Flow"
        subtitle="Prove UI actions travel through API contracts, backend adapter, runtime state, artifacts, audit, and readiness verdicts."
        actions={(
          <>
            <Button variant="secondary" onClick={() => { validateE2EFlowContracts(); reload(); }}><ShieldAlert className="h-4 w-4" />Validate flows</Button>
            <Button onClick={async () => { await runAllE2EActionFlows('mock'); reload(); }}><Rocket className="h-4 w-4" />Run All E2E</Button>
            <Button variant="secondary" onClick={() => { exportE2EActionFlowArtifacts(); reload(); }}><FileText className="h-4 w-4" />Export flow report</Button>
          </>
        )}
      />

      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Flows', value: summary.total, tone: 'blue' },
          { label: 'Completed', value: summary.completed, tone: 'green' },
          { label: 'Waiting', value: summary.waitingApproval, tone: 'amber' },
          { label: 'Blocked', value: summary.blocked, tone: summary.blocked ? 'red' : 'green' },
          { label: 'Failed', value: summary.failed, tone: summary.failed ? 'red' : 'green' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</div>
            <div className="mt-3 flex items-center justify-between gap-3"><b className="text-2xl text-slate-950">{item.value}</b><Badge tone={item.tone as Tone}>{item.label}</Badge></div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[1fr_420px] gap-5">
        <Panel title="Flow Board">
          <div className="grid grid-cols-3 gap-3 p-4 text-sm">
            {flows.map((flow) => (
              <div key={flow.flowId} data-e2e-flow-card={flow.flowId} className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <b className="block text-slate-950">{flow.name}</b>
                    <p className="mt-1 text-xs text-slate-500">{flow.description}</p>
                  </div>
                  <Badge tone={toneFor(flow.status)}>{flow.status}</Badge>
                </div>
                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                  {flow.contractSequence.join(' -> ')}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Button
                    variant="secondary"
                    data-e2e-run-flow
                    onClick={async () => { await runE2EActionFlow(flow.flowId as E2EActionFlowId, flow.flowId === 'governance-blocked-flow' ? 'production' : 'mock'); reload(); }}
                  >
                    <Play className="h-4 w-4" />Run Flow
                  </Button>
                  <Badge tone={toneFor(flow.backendMode)}>{flow.backendMode}</Badge>
                </div>
                <p className="mt-3 text-xs font-semibold text-slate-600" data-e2e-final-verdict>{flow.finalVerdict}</p>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Final Readiness Verdict">
            <div className="space-y-3 p-4 text-sm">
              <div className="flex items-center justify-between"><span>Selected flow</span><b>{selected.name}</b></div>
              <div className="flex items-center justify-between"><span>Status</span><Badge tone={toneFor(selected.status)}>{selected.status}</Badge></div>
              <p className="rounded-xl bg-slate-50 p-3 font-semibold text-slate-700">{selected.finalVerdict}</p>
            </div>
          </Panel>

          <Panel title="Blockers / Warnings">
            <div className="space-y-3 p-4 text-sm">
              {selected.warnings.map((warning) => <p key={warning} className="rounded-xl bg-amber-50 p-3 text-amber-700">{warning}</p>)}
              {selected.normalizedErrors.map((error) => <p key={`${error.code}-${error.message}`} className="rounded-xl bg-red-50 p-3 text-red-700">{error.code}: {error.message}</p>)}
              {!selected.warnings.length && !selected.normalizedErrors.length ? <p className="text-slate-500">No blockers or warnings for the selected flow.</p> : null}
            </div>
          </Panel>

          <Panel title="Artifact Outputs">
            <div className="space-y-2 p-4 text-sm">
              {[...selected.artifactOutputs, ...artifacts].slice(0, 8).map((artifact) => <div key={artifact.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><span>{artifact.name}</span><Badge tone="blue">{artifact.type}</Badge></div>)}
              {!selected.artifactOutputs.length && !artifacts.length ? <p className="text-slate-500">Run or export a flow to create artifact outputs.</p> : null}
            </div>
          </Panel>
        </div>

        <Panel title="Timeline">
          <div className="grid gap-3 p-4 text-sm">
            {selected.auditTimeline.map((event) => (
              <div key={event.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-3"><b>{event.type}</b><span className="text-xs text-slate-400">{new Date(event.createdAt).toLocaleTimeString()}</span></div>
                <p className="mt-2 text-slate-600">{event.message}</p>
              </div>
            ))}
            {!selected.auditTimeline.length ? <p className="text-slate-500">Timeline appears after a flow runs.</p> : null}
          </div>
        </Panel>

        <Panel title="Request / Response Inspector">
          <div className="grid grid-cols-2 gap-3 p-4 text-sm">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Requests</h3>
              <div className="mt-3 space-y-2">
                {selected.requestLog.map((request) => <div key={request.id} className="rounded-lg bg-slate-50 p-3"><b>{request.contractId}</b><p className="mt-1 text-xs text-slate-500">{request.payloadSummary}</p></div>)}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Responses</h3>
              <div className="mt-3 space-y-2">
                {selected.responseLog.map((response) => <div key={response.id} className="rounded-lg bg-slate-50 p-3"><div className="flex items-center justify-between"><b>{response.contractId}</b><Badge tone={response.ok ? 'green' : 'red'}>{response.status}</Badge></div><p className="mt-1 text-xs text-slate-500">{response.message}</p></div>)}
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
