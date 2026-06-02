import { AlertTriangle, FileText, Pause, Play, RotateCcw, ShieldCheck, Square, XCircle } from 'lucide-react';
import { Badge, Button, PageHeader, Panel } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import {
  selectWorkerControlEligibility,
  selectWorkerCurrentTrace,
  selectWorkerDiagnosticsArtifacts,
  selectWorkerHealthSnapshot,
  selectWorkerIncidents,
  selectWorkerObservationDashboard,
  selectWorkerRecoveryDashboard,
  selectWorkerSLAStatus,
} from '../domain/selectors';
import {
  requestWorkerEscalateToApproval,
  requestWorkerExportDiagnostics,
  requestWorkerKill,
  requestWorkerPause,
  requestWorkerRequeueItem,
  requestWorkerResume,
  requestWorkerRetryNow,
  requestWorkerSkipItem,
  requestWorkerStop,
} from '../runtime/worker-observability-store';
import { ChaosSimulationCompactWidget } from './ChaosSimulationPage';

function statusTone(status: string): Tone {
  if (status.includes('failed') || status.includes('breached') || status.includes('critical')) return 'red';
  if (status.includes('warning') || status.includes('paused') || status.includes('waiting')) return 'amber';
  if (status.includes('executing') || status.includes('polling')) return 'blue';
  return 'green';
}

export function WorkerControlPage() {
  const dashboard = selectWorkerObservationDashboard();
  const trace = selectWorkerCurrentTrace();
  const health = selectWorkerHealthSnapshot();
  const incidents = selectWorkerIncidents();
  const eligibility = selectWorkerControlEligibility();
  const sla = selectWorkerSLAStatus();
  const diagnostics = selectWorkerDiagnosticsArtifacts();
  const recovery = selectWorkerRecoveryDashboard();
  const observation = dashboard.observation;
  const activeItem = dashboard.activeQueueItem;

  const reload = () => window.location.reload();

  return (
    <div data-route="/worker-control" data-worker-control-route>
      <ChaosSimulationCompactWidget surface="worker-control" />
      <PageHeader
        title="Worker Observability & Control Center"
        subtitle="Monitor autonomous improvement loop worker health, queue execution, incidents, SLA warnings, and safe control actions."
        actions={<><Button variant="secondary" onClick={() => { requestWorkerExportDiagnostics(); reload(); }}><FileText className="h-4 w-4" />Export diagnostics</Button><Button variant="danger" onClick={() => { requestWorkerKill('Kill switch from worker control center.'); reload(); }}><AlertTriangle className="h-4 w-4" />Kill worker</Button></>}
      />
      <span data-worker-recovery-widget="worker-control" data-worker-recovery-plans={recovery.plans.length} data-worker-recovery-unresolved={recovery.unresolvedIncidents.length} data-worker-recovery-approval={recovery.readiness.approvalRequired} className="sr-only">
        Worker recovery worker-control: {recovery.plans.length} plans, {recovery.unresolvedIncidents.length} unresolved incidents.
      </span>
      <span data-worker-observability-widget="worker-control" data-worker-observability-status={observation.status} data-worker-observability-sla={sla} data-worker-observability-incidents={incidents.length} className="sr-only">
        Worker observability worker-control: {observation.status}, SLA {sla}, incidents {incidents.length}.
      </span>
      <div className="grid grid-cols-4 gap-4" data-worker-control-summary>
        {[
          { label: 'Worker status', value: observation.status, tone: statusTone(observation.status) },
          { label: 'SLA status', value: sla, tone: statusTone(sla) },
          { label: 'Tick count', value: observation.tickCount, tone: 'blue' as Tone },
          { label: 'Retry count', value: observation.retryCount, tone: observation.retryCount ? 'amber' as Tone : 'green' as Tone },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</div>
            <div className="mt-3 flex items-center justify-between gap-3"><b className="truncate text-2xl">{item.value}</b><Badge tone={item.tone}>{item.label}</Badge></div>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-[360px_1fr_420px] gap-5">
        <Panel title="Worker Status">
          <div className="space-y-3 p-4 text-sm">
            <div className="flex items-center justify-between"><span>Status</span><Badge tone={statusTone(observation.status)}>{observation.status}</Badge></div>
            <div className="flex items-center justify-between"><span>Current step</span><b>{observation.currentStep}</b></div>
            <div className="flex items-center justify-between"><span>Last heartbeat</span><b>{observation.lastHeartbeatAt ? new Date(observation.lastHeartbeatAt).toLocaleTimeString() : 'none'}</b></div>
            <div className="flex items-center justify-between"><span>Average execution</span><b>{observation.averageExecutionTimeMs}ms</b></div>
          </div>
        </Panel>
        <Panel title="Active Queue Item">
          <div data-worker-active-queue-item className="space-y-3 p-4 text-sm">
            {activeItem ? (
              <>
                <div className="flex items-start justify-between gap-3"><b>{activeItem.id}</b><Badge tone={statusTone(activeItem.status)}>{activeItem.status}</Badge></div>
                <p className="text-slate-500">Priority {activeItem.priority}. Retry {activeItem.retryPolicy.retryCount}/{activeItem.retryPolicy.maxRetries}.</p>
                <p className="text-slate-500">Loop: {activeItem.loopId}</p>
              </>
            ) : <p className="text-slate-500">No active queue item.</p>}
          </div>
        </Panel>
        <Panel title="Health / Heartbeat">
          <div className="space-y-3 p-4 text-sm">
            <div className="flex items-center justify-between"><span>Heartbeat age</span><b>{health.heartbeatAgeMs}ms</b></div>
            <div className="flex items-center justify-between"><span>Stale</span><Badge tone={health.stale ? 'red' : 'green'}>{health.stale ? 'yes' : 'no'}</Badge></div>
            <div className="flex items-center justify-between"><span>Incidents</span><b>{health.incidentCount}</b></div>
            <div className="flex items-center justify-between"><span>SLA</span><Badge tone={statusTone(health.slaStatus)}>{health.slaStatus}</Badge></div>
          </div>
        </Panel>
        <Panel title="Current Execution Trace">
          <div className="col-span-2 grid max-h-[380px] grid-cols-3 gap-3 overflow-hidden p-4">
            {trace.steps.slice(-9).map((step) => (
              <div key={step.id} data-worker-trace-step={step.status} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b className="truncate">{step.label}</b><Badge tone={statusTone(step.status)}>{step.status}</Badge></div>
                <p className="mt-2 text-xs text-slate-400">{new Date(step.timestamp).toLocaleTimeString()}</p>
              </div>
            ))}
            {!trace.steps.length ? <p className="text-sm text-slate-500">No worker trace yet.</p> : null}
          </div>
        </Panel>
        <Panel title="Control Actions">
          <div className="grid grid-cols-2 gap-2 p-4 text-sm" data-worker-control-actions>
            <Button variant="secondary" disabled={!eligibility.canPause} onClick={() => { requestWorkerPause('Pause from control center.'); reload(); }}><Pause className="h-4 w-4" />Pause</Button>
            <Button variant="secondary" disabled={!eligibility.canResume} onClick={() => { requestWorkerResume('Resume from control center.'); reload(); }}><Play className="h-4 w-4" />Resume</Button>
            <Button variant="secondary" disabled={!eligibility.canStop} onClick={() => { requestWorkerStop('Stop from control center.'); reload(); }}><Square className="h-4 w-4" />Stop</Button>
            <Button variant="secondary" disabled={!eligibility.canRetryNow} onClick={() => { requestWorkerRetryNow('Retry now from control center.'); reload(); }}><RotateCcw className="h-4 w-4" />Retry</Button>
            <Button variant="secondary" disabled={!eligibility.canSkip} onClick={() => { requestWorkerSkipItem('Skip requested from control center.'); reload(); }}><XCircle className="h-4 w-4" />Skip</Button>
            <Button variant="secondary" disabled={!eligibility.canRequeue} onClick={() => { requestWorkerRequeueItem('Requeue requested from control center.'); reload(); }}><RotateCcw className="h-4 w-4" />Requeue</Button>
            <Button variant="secondary" disabled={!eligibility.canEscalateToApproval} onClick={() => { requestWorkerEscalateToApproval('Approval escalation from control center.'); reload(); }}><ShieldCheck className="h-4 w-4" />Approval</Button>
            <Button variant="secondary" onClick={() => { requestWorkerExportDiagnostics(); reload(); }}><FileText className="h-4 w-4" />Diagnostics</Button>
          </div>
        </Panel>
        <Panel title="Incidents">
          <div className="col-span-2 grid grid-cols-3 gap-3 p-4">
            {incidents.slice(-9).map((incident) => (
              <div key={incident.id} data-worker-incident={incident.reason} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{incident.reason}</b><Badge tone={statusTone(incident.severity)}>{incident.severity}</Badge></div>
                <p className="mt-2 text-slate-500">{incident.message}</p>
              </div>
            ))}
            {!incidents.length ? <p className="text-sm text-slate-500">No worker incidents.</p> : null}
          </div>
        </Panel>
        <Panel title="Diagnostic Artifacts">
          <div className="space-y-2 p-4 text-sm" data-worker-diagnostic-artifacts>
            {diagnostics.length ? diagnostics.map((artifact) => <div key={artifact} className="rounded-lg bg-slate-50 p-2 font-semibold text-slate-600">{artifact}</div>) : <p className="text-slate-500">Diagnostics appear after export.</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
