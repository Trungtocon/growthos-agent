import { AlertTriangle, CheckCircle2, FileText, FlaskConical, Play, ShieldCheck, XCircle } from 'lucide-react';
import { Badge, Button, PageHeader, Panel } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import {
  selectActiveChaosRun,
  selectChaosArtifacts,
  selectChaosDashboard,
  selectChaosEvents,
  selectChaosReadiness,
  selectChaosRecoveryResults,
  selectChaosScenarios,
  selectChaosScorecard,
} from '../domain/selectors';
import {
  completeChaosRun,
  createChaosScenario,
  exportChaosReport,
  failChaosRun,
  injectChaosEvent,
  startChaosRun,
} from '../runtime/chaos-simulation-store';
import type { ChaosScenarioType } from '../runtime/chaos-simulation';
import { RuntimeCertificationCompactWidget } from './RuntimeCertificationPage';
import { CertifiedSandboxRunCompactWidget } from './CertifiedSandboxRunPage';
import { ProductionReadinessCompactWidget } from './ProductionReadinessPage';

const scenarioLibrary: Array<{ type: ChaosScenarioType; name: string; description: string }> = [
  { type: 'worker_stale', name: 'Worker stale', description: 'Inject stale heartbeat and recover the worker.' },
  { type: 'queue_retry_exhausted', name: 'Retry exhausted', description: 'Force queue retry exhaustion and governance review.' },
  { type: 'approval_timeout', name: 'Approval timeout', description: 'Hold recovery while approval remains unavailable.' },
  { type: 'sandbox_offline', name: 'Sandbox offline', description: 'Simulate sandbox outage without endpoint calls.' },
  { type: 'tool_call_failure', name: 'Tool call failure', description: 'Fail a runtime tool call and inspect recovery.' },
  { type: 'artifact_export_failure', name: 'Artifact export failure', description: 'Exercise artifact export fallback.' },
  { type: 'quota_exceeded', name: 'Quota exceeded', description: 'Block execution through quota governance.' },
  { type: 'cost_spike', name: 'Cost spike', description: 'Require review after a simulated budget spike.' },
  { type: 'recovery_loop_failure', name: 'Recovery loop failure', description: 'Escalate failed auto-healing to manual rollback.' },
  { type: 'kill_switch_triggered', name: 'Kill switch', description: 'Stop new worker execution through governance kill switch.' },
];

function toneFor(value: string): Tone {
  if (value.includes('critical') || value.includes('failed') || value.includes('blocked')) return 'red';
  if (value.includes('approval') || value.includes('warning') || value.includes('waiting') || value.includes('high')) return 'amber';
  if (value.includes('running') || value.includes('medium')) return 'blue';
  return 'green';
}

function reload() {
  window.location.reload();
}

export function ChaosSimulationCompactWidget({ surface }: { surface: 'worker-control' | 'worker-recovery' | 'evaluation' | 'execution-timeline' | 'execution-graph' | 'agent' }) {
  const dashboard = selectChaosDashboard();
  return (
    <span data-chaos-simulation-widget={surface} data-chaos-scenarios={dashboard.scenarios.length} data-chaos-runs={dashboard.runs.length} data-chaos-events={dashboard.events.length} className="sr-only">
      Chaos simulation {surface}: {dashboard.scenarios.length} scenarios, {dashboard.runs.length} runs, {dashboard.events.length} events.
    </span>
  );
}

export function ChaosSimulationPage() {
  const dashboard = selectChaosDashboard();
  const scenarios = selectChaosScenarios();
  const activeRun = selectActiveChaosRun();
  const events = selectChaosEvents();
  const results = selectChaosRecoveryResults();
  const scorecard = selectChaosScorecard();
  const readiness = selectChaosReadiness();
  const artifacts = selectChaosArtifacts();

  return (
    <div data-route="/chaos" data-chaos-simulation-route>
      <RuntimeCertificationCompactWidget surface="chaos" />
      <CertifiedSandboxRunCompactWidget surface="chaos" />
      <ProductionReadinessCompactWidget surface="chaos" />
      <PageHeader
        title="Recovery Simulation & Chaos Testing"
        subtitle="Inject controlled mock failures to validate worker recovery, auto-healing, governance, queue safety, and audit evidence."
        actions={<><Button variant="secondary" onClick={() => { exportChaosReport(); reload(); }}><FileText className="h-4 w-4" />Export report</Button><Button data-workflow="chaos-start-run" onClick={() => { const scenario = createChaosScenario(scenarioLibrary[0]); startChaosRun(scenario.id); reload(); }}><FlaskConical className="h-4 w-4" />Start stale worker</Button></>}
      />
      <div className="grid grid-cols-5 gap-4" data-chaos-readiness>
        {[
          { label: 'Safety guards', value: readiness.safetyGuards.length, tone: readiness.ready ? 'green' : 'red' },
          { label: 'Scenarios', value: scenarios.length, tone: 'blue' },
          { label: 'Chaos runs', value: dashboard.runs.length, tone: 'blue' },
          { label: 'Injected failures', value: events.length, tone: events.length ? 'amber' : 'green' },
          { label: 'Reports', value: artifacts.length, tone: 'slate' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</div>
            <div className="mt-3 flex items-center justify-between gap-3"><b className="text-2xl text-slate-950">{item.value}</b><Badge tone={item.tone as Tone}>{item.label}</Badge></div>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-[380px_1fr_420px] gap-5">
        <Panel title="Scenario Library">
          <div className="space-y-3 p-4" data-chaos-scenario-library>
            {scenarioLibrary.map((scenario) => (
              <div key={scenario.type} className="rounded-xl border border-slate-100 p-3 text-sm">
                <div className="flex items-center justify-between gap-3"><b>{scenario.name}</b><Badge tone={toneFor(scenario.type)}>{scenario.type}</Badge></div>
                <p className="mt-2 text-slate-500">{scenario.description}</p>
                <Button className="mt-3 w-full" variant="secondary" onClick={() => { const created = createChaosScenario(scenario); startChaosRun(created.id); reload(); }}><Play className="h-4 w-4" />Start scenario</Button>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Active Chaos Run">
          <div className="space-y-3 p-4 text-sm" data-active-chaos-run>
            {activeRun ? (
              <>
                <div className="flex items-center justify-between gap-3"><b>{activeRun.scenarioType}</b><Badge tone={toneFor(activeRun.status)}>{activeRun.status}</Badge></div>
                <p className="text-slate-500">Runtime mode {activeRun.runtimeMode}. Real endpoint calls {activeRun.realEndpointCalls}.</p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => { injectChaosEvent(activeRun.id); reload(); }}><FlaskConical className="h-4 w-4" />Inject failure</Button>
                  <Button variant="secondary" onClick={() => { completeChaosRun(activeRun.id); reload(); }}><CheckCircle2 className="h-4 w-4" />Complete</Button>
                  <Button variant="danger" onClick={() => { failChaosRun(activeRun.id, 'Failed manually from chaos dashboard.'); reload(); }}><XCircle className="h-4 w-4" />Fail safely</Button>
                </div>
              </>
            ) : <p className="text-slate-500">Start a controlled scenario to open a chaos run.</p>}
          </div>
        </Panel>
        <Panel title="Governance / Kill-Switch Behavior">
          <div className="space-y-3 p-4 text-sm" data-chaos-governance>
            {readiness.safetyGuards.map((guard) => (
              <div key={guard.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-3"><b>{guard.name}</b><Badge tone={guard.enforced ? 'green' : 'red'}>{guard.enforced ? 'PASS' : 'FAIL'}</Badge></div>
                <p className="mt-2 text-slate-500">{guard.message}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Injected Failures">
          <div className="grid grid-cols-3 gap-3 p-4" data-chaos-events>
            {events.slice(-9).map((event) => <div key={event.id} className="rounded-xl border border-slate-100 p-3 text-sm"><div className="flex items-start justify-between gap-2"><b>{event.type}</b><Badge tone={toneFor(event.severity)}>{event.severity}</Badge></div><p className="mt-2 text-slate-500">{event.message}</p></div>)}
            {!events.length ? <p className="text-sm text-slate-500">No injected failures.</p> : null}
          </div>
        </Panel>
        <Panel title="Recovery Response & Auto-Healing">
          <div className="grid grid-cols-2 gap-3 p-4" data-chaos-recovery-results>
            {results.slice(0, 6).map((result) => <div key={result.id} className="rounded-xl border border-slate-100 p-3 text-sm"><div className="flex items-start justify-between gap-2"><b>{result.autoHealingDecision}</b><Badge tone={toneFor(result.risk)}>{result.risk}</Badge></div><p className="mt-2 text-slate-500">{result.message}</p></div>)}
            {!results.length ? <p className="text-sm text-slate-500">Recovery responses appear after injection.</p> : null}
          </div>
        </Panel>
        <Panel title="Scorecard & Exported Reports">
          <div className="space-y-3 p-4 text-sm" data-chaos-scorecard>
            {scorecard ? <div className="rounded-xl bg-blue-50 p-3 text-blue-700"><ShieldCheck className="mr-2 inline h-4 w-4" />Latest score {scorecard.score}/100</div> : <p className="text-slate-500">Complete a run to score recovery reliability.</p>}
            {artifacts.map((artifact) => <div key={artifact} className="rounded-lg bg-slate-50 p-2 font-semibold text-slate-600">{artifact}</div>)}
            {!artifacts.length ? <p className="text-slate-500">Exported reports appear after report generation.</p> : null}
            {results.some((result) => result.autoHealingDecision === 'REQUIRE_APPROVAL') ? <p className="rounded-xl bg-amber-50 p-3 text-amber-700"><AlertTriangle className="mr-2 inline h-4 w-4" />Manual governance approval is required for high-risk recovery.</p> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
