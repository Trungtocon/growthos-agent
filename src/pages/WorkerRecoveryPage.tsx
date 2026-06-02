import { AlertTriangle, CheckCircle2, FileText, Play, RotateCcw, ShieldCheck, Wrench, XCircle } from 'lucide-react';
import { Badge, Button, PageHeader, Panel } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import {
  selectAutoHealingDecisions,
  selectRecoveryAuditTrail,
  selectRecoveryPlans,
  selectRecoveryReadiness,
  selectUnresolvedRecoveryIncidents,
  selectWorkerRecoveryDashboard,
} from '../domain/selectors';
import {
  approveRecoveryPlan,
  createRecoveryPlanForIncident,
  executeRecoveryPlan,
  exportRecoveryReport,
  markRecoveryResolved,
  rejectRecoveryPlan,
} from '../runtime/worker-recovery-store';
import { ChaosSimulationCompactWidget } from './ChaosSimulationPage';
import { RuntimeCertificationCompactWidget } from './RuntimeCertificationPage';

function toneFor(value: string): Tone {
  if (value.includes('critical') || value.includes('failed') || value.includes('blocked') || value.includes('rejected')) return 'red';
  if (value.includes('approval') || value.includes('warning') || value.includes('high') || value.includes('medium')) return 'amber';
  if (value.includes('ready') || value.includes('executing')) return 'blue';
  if (value.includes('resolved') || value.includes('low') || value.includes('AUTO')) return 'green';
  return 'slate';
}

function reload() {
  window.location.reload();
}

export function WorkerRecoveryPage() {
  const dashboard = selectWorkerRecoveryDashboard();
  const plans = selectRecoveryPlans();
  const incidents = selectUnresolvedRecoveryIncidents();
  const decisions = selectAutoHealingDecisions();
  const audit = selectRecoveryAuditTrail();
  const readiness = selectRecoveryReadiness();
  const activePlan = dashboard.activePlan;

  return (
    <div data-route="/worker-recovery" data-worker-recovery-route>
      <ChaosSimulationCompactWidget surface="worker-recovery" />
      <RuntimeCertificationCompactWidget surface="worker-recovery" />
      <PageHeader
        title="Worker Incident Recovery & Auto-Healing"
        subtitle="Plan, approve, execute, and audit recovery for worker incidents without bypassing governance or queue controls."
        actions={<><Button variant="secondary" onClick={() => { exportRecoveryReport(); reload(); }}><FileText className="h-4 w-4" />Export recovery</Button><Button onClick={() => { if (incidents[0]) createRecoveryPlanForIncident(incidents[0].id); reload(); }}><Wrench className="h-4 w-4" />Plan incident</Button></>}
      />
      <div className="grid grid-cols-5 gap-4" data-worker-recovery-overview>
        {[
          { label: 'Recovery plans', value: readiness.totalPlans, tone: 'blue' as Tone },
          { label: 'Active plans', value: readiness.activePlans, tone: readiness.activePlans ? 'amber' as Tone : 'green' as Tone },
          { label: 'Approval required', value: readiness.approvalRequired, tone: readiness.approvalRequired ? 'red' as Tone : 'green' as Tone },
          { label: 'Unresolved incidents', value: readiness.unresolvedIncidents, tone: readiness.unresolvedIncidents ? 'amber' as Tone : 'green' as Tone },
          { label: 'Artifacts', value: dashboard.artifacts.length, tone: 'slate' as Tone },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</div>
            <div className="mt-3 flex items-center justify-between gap-3"><b className="text-2xl text-slate-950">{item.value}</b><Badge tone={item.tone}>{item.label}</Badge></div>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-[360px_1fr_420px] gap-5">
        <Panel title="Active Incidents">
          <div className="space-y-3 p-4" data-worker-recovery-incidents>
            {incidents.slice(0, 6).map((incident) => (
              <div key={incident.id} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{incident.reason}</b><Badge tone={toneFor(incident.severity)}>{incident.severity}</Badge></div>
                <p className="mt-2 text-slate-500">{incident.message}</p>
                <Button className="mt-3 w-full" variant="secondary" onClick={() => { createRecoveryPlanForIncident(incident.id); reload(); }}>Create plan</Button>
              </div>
            ))}
            {!incidents.length ? <p className="text-sm text-slate-500">No unresolved worker incidents.</p> : null}
          </div>
        </Panel>
        <Panel title="Suggested Recovery Plans">
          <div className="grid grid-cols-2 gap-3 p-4" data-worker-recovery-plans>
            {plans.slice(0, 6).map((plan) => (
              <div key={plan.id} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{plan.incidentReason}</b><Badge tone={toneFor(plan.status)}>{plan.status}</Badge></div>
                <p className="mt-2 text-slate-500">Risk {plan.risk}. Steps {plan.steps.length}. Incident {plan.incidentId}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => { approveRecoveryPlan(plan.id); reload(); }}><ShieldCheck className="h-4 w-4" />Approve</Button>
                  <Button variant="secondary" onClick={() => { executeRecoveryPlan(plan.id, 'Recovery execution from control center.'); reload(); }}><Play className="h-4 w-4" />Execute</Button>
                  <Button variant="secondary" onClick={() => { markRecoveryResolved(plan.id); reload(); }}><CheckCircle2 className="h-4 w-4" />Resolve</Button>
                </div>
              </div>
            ))}
            {!plans.length ? <p className="text-sm text-slate-500">Create a plan from an incident to begin recovery.</p> : null}
          </div>
        </Panel>
        <Panel title="Manual Review Required">
          <div className="space-y-3 p-4 text-sm" data-worker-recovery-review>
            {(plans.filter((plan) => plan.status === 'approval_required' || plan.risk === 'high' || plan.risk === 'critical')).slice(0, 5).map((plan) => (
              <div key={plan.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-3"><b>{plan.id}</b><Badge tone={toneFor(plan.risk)}>{plan.risk}</Badge></div>
                <div className="mt-3 flex gap-2"><Button variant="secondary" onClick={() => { approveRecoveryPlan(plan.id); reload(); }}>Approve</Button><Button variant="danger" onClick={() => { rejectRecoveryPlan(plan.id, 'Rejected from recovery center.'); reload(); }}><XCircle className="h-4 w-4" />Reject</Button></div>
              </div>
            ))}
            {!plans.some((plan) => plan.status === 'approval_required' || plan.risk === 'high' || plan.risk === 'critical') ? <p className="text-slate-500">No manual review required.</p> : null}
          </div>
        </Panel>
        <Panel title="Auto-Healing Decisions">
          <div className="grid grid-cols-3 gap-3 p-4" data-worker-auto-healing-decisions>
            {decisions.slice(0, 9).map((decision) => (
              <div key={decision.id} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{decision.decision}</b><Badge tone={toneFor(decision.risk)}>{decision.risk}</Badge></div>
                <p className="mt-2 text-xs text-slate-500">{decision.reasons.join(', ')}</p>
              </div>
            ))}
            {!decisions.length ? <p className="text-sm text-slate-500">No auto-healing decisions yet.</p> : null}
          </div>
        </Panel>
        <Panel title="Recovery Execution Timeline">
          <div className="grid grid-cols-3 gap-3 p-4" data-worker-recovery-timeline>
            {audit.slice(-9).map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-3"><b>{item.action}</b><Badge tone={toneFor(item.status)}>{item.status}</Badge></div>
                <p className="mt-2 text-slate-500">{item.message}</p>
              </div>
            ))}
            {!audit.length ? <p className="text-sm text-slate-500">Recovery execution audit is empty.</p> : null}
          </div>
        </Panel>
        <Panel title="Diagnostic / Recovery Artifacts">
          <div className="space-y-2 p-4 text-sm" data-worker-recovery-artifacts>
            {dashboard.artifacts.map((artifact) => <div key={artifact} className="rounded-lg bg-slate-50 p-2 font-semibold text-slate-600">{artifact}</div>)}
            {!dashboard.artifacts.length ? <p className="text-slate-500">Exports appear after recovery report generation.</p> : null}
            {activePlan ? <div className="rounded-xl bg-blue-50 p-3 text-blue-700"><AlertTriangle className="mr-2 inline h-4 w-4" />Active plan: {activePlan.id}</div> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
