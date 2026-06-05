import { AlertTriangle, CheckCircle2, FileText, PlayCircle, RefreshCw, RotateCcw, ShieldAlert, UserCheck } from 'lucide-react';
import { Badge, Button, PageHeader, Panel } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import {
  acknowledgeIncident,
  addIncidentTimelineEvent,
  assignIncidentOwner,
  closeIncident,
  createIncident,
  escalateIncident,
  exportIncidentPack,
  markMitigating,
  markMonitoring,
  requestRollback,
  resolveIncident,
  selectProductionIncidentDashboard,
  triggerRollbackProcedure,
} from '../runtime/production-incident-store';
import { ProductionComplianceCompactWidget } from './ProductionCompliancePage';
import { ProductionOperationsCompactWidget } from './ProductionOperationsPage';
import { ProductionSupportCompactWidget } from './ProductionSupportPage';
import { ProductionAccessControlCompactWidget } from './ProductionAccessControlPage';

type IncidentWidgetSurface =
  | 'go-live-control'
  | 'production-runbook'
  | 'production-observability'
  | 'production-readiness'
  | 'pre-golive-validation'
  | 'deployment-config'
  | 'backend-readiness'
  | 'database-readiness'
  | 'auth-readiness'
  | 'environment-readiness'
  | 'runtime-certification'
  | 'certified-sandbox-run';

function toneFor(value: string): Tone {
  if (/closed|resolved|ready/i.test(value)) return 'green';
  if (/monitoring|mitigating|triaging|investigating|warning/i.test(value)) return 'amber';
  if (/SEV0|SEV1|rollback|required|blocked|detected|escalated/i.test(value)) return 'red';
  return 'slate';
}

function reload() {
  window.location.reload();
}

export function ProductionIncidentCompactWidget({ surface }: { surface: IncidentWidgetSurface }) {
  const dashboard = selectProductionIncidentDashboard();
  return (
    <span
      data-production-incident-widget
      data-production-incident-surface={surface}
      data-production-incident-status={dashboard.status}
      data-production-incident-active={dashboard.activeCount}
      data-production-incident-critical={dashboard.criticalCount}
      data-production-incident-blockers={dashboard.blockers.length}
      data-production-incident-rollback={dashboard.rollbackRequestCount}
      className="sr-only"
    >
      Production incidents {surface}: {dashboard.status}, {dashboard.activeCount} active, {dashboard.criticalCount} critical.
    </span>
  );
}

export function ProductionIncidentPage() {
  const dashboard = selectProductionIncidentDashboard();
  const active = dashboard.activeIncidents[0] ?? dashboard.incidents[0];
  const canAcknowledge = Boolean(active && active.status === 'detected');
  const canResolve = Boolean(active && ['mitigating', 'monitoring', 'escalated', 'rollback_required'].includes(active.status));
  const canClose = Boolean(active && active.status === 'resolved');

  return (
    <div data-route="/production-incidents" data-production-incidents-route>
      <ProductionOperationsCompactWidget surface="production-incidents" />
      <ProductionSupportCompactWidget surface="production-incidents" />
      <ProductionComplianceCompactWidget surface="production-incidents" />
      <ProductionAccessControlCompactWidget surface="production-incidents" />
      <PageHeader
        title="Production Incident Command Center"
        subtitle="Post-go-live command surface for severity triage, escalation, mitigation, rollback decisions, resolution evidence, and incident export packs."
        actions={(
          <>
            <Button data-action="createIncident" onClick={() => { createIncident({ severity: 'SEV1', releaseId: 'production-current', affectedServices: ['runtime', 'worker'], customerImpact: 'Production reliability degradation under triage.' }); reload(); }}>
              <PlayCircle className="h-4 w-4" />Create incident
            </Button>
            <Button variant="secondary" data-action="acknowledgeIncident" disabled={!canAcknowledge} data-disabled-reason={!canAcknowledge ? 'Only newly detected incidents can be acknowledged.' : undefined} title={!canAcknowledge ? 'Only newly detected incidents can be acknowledged.' : undefined} onClick={() => { if (active) acknowledgeIncident(active.incidentId, 'Incident Commander'); reload(); }}>
              <ShieldAlert className="h-4 w-4" />Acknowledge
            </Button>
            <Button variant="secondary" data-action="assignIncidentOwner" disabled={!active} data-disabled-reason={!active ? 'Create an incident before assigning owner.' : undefined} title={!active ? 'Create an incident before assigning owner.' : undefined} onClick={() => { if (active) assignIncidentOwner(active.incidentId, { owner: 'SRE Primary', commander: 'Incident Commander', responders: ['Runtime Lead', 'Support Lead'] }); reload(); }}>
              <UserCheck className="h-4 w-4" />Assign owner
            </Button>
            <Button variant="secondary" data-action="escalateIncident" disabled={!active} data-disabled-reason={!active ? 'Create an incident before escalation.' : undefined} title={!active ? 'Create an incident before escalation.' : undefined} onClick={() => { if (active) escalateIncident(active.incidentId, 'VP Engineering'); reload(); }}>
              <AlertTriangle className="h-4 w-4" />Escalate
            </Button>
            <Button variant="secondary" data-action="addIncidentTimelineEvent" disabled={!active} data-disabled-reason={!active ? 'Create an incident before adding timeline events.' : undefined} title={!active ? 'Create an incident before adding timeline events.' : undefined} onClick={() => { if (active) addIncidentTimelineEvent(active.incidentId, 'operator.note', 'Operator added incident timeline evidence.'); reload(); }}>
              <RefreshCw className="h-4 w-4" />Add timeline event
            </Button>
            <Button variant="secondary" data-action="markMitigating" disabled={!active} data-disabled-reason={!active ? 'Create an incident before mitigation.' : undefined} title={!active ? 'Create an incident before mitigation.' : undefined} onClick={() => { if (active) markMitigating(active.incidentId, 'Mitigation checklist started by incident command.'); reload(); }}>
              <ShieldAlert className="h-4 w-4" />Mark mitigating
            </Button>
            <Button variant="secondary" data-action="markMonitoring" disabled={!active} data-disabled-reason={!active ? 'Create an incident before monitoring.' : undefined} title={!active ? 'Create an incident before monitoring.' : undefined} onClick={() => { if (active) markMonitoring(active.incidentId, 'Monitoring after mitigation started.'); reload(); }}>
              <CheckCircle2 className="h-4 w-4" />Mark monitoring
            </Button>
            <Button variant="danger" data-action="requestRollback" disabled={!active} data-disabled-reason={!active ? 'Create an incident before requesting rollback.' : undefined} title={!active ? 'Create an incident before requesting rollback.' : undefined} onClick={() => { if (active) requestRollback(active.incidentId, 'Rollback requested by incident command.'); reload(); }}>
              <RotateCcw className="h-4 w-4" />Request rollback
            </Button>
            <Button variant="danger" data-action="triggerRollbackProcedure" disabled={!dashboard.rollbackRequests.length} data-disabled-reason={!dashboard.rollbackRequests.length ? 'A rollback request is required before triggering rollback procedure.' : undefined} title={!dashboard.rollbackRequests.length ? 'A rollback request is required before triggering rollback procedure.' : undefined} onClick={() => { triggerRollbackProcedure(dashboard.rollbackRequests[0]?.incidentId, 'Release Operator'); reload(); }}>
              <RotateCcw className="h-4 w-4" />Trigger rollback
            </Button>
            <Button variant="success" data-action="resolveIncident" disabled={!canResolve} data-disabled-reason={!canResolve ? 'Incident must be mitigating, monitoring, escalated, or rollback_required before resolution.' : undefined} title={!canResolve ? 'Incident must be mitigating, monitoring, escalated, or rollback_required before resolution.' : undefined} onClick={() => { if (active) resolveIncident(active.incidentId, { rootCause: 'Release flag regression.', mitigationSteps: ['Disabled flag', 'Replayed failed jobs'], evidenceLinks: ['https://status.example.com/incidents/current'] }); reload(); }}>
              <CheckCircle2 className="h-4 w-4" />Resolve with evidence
            </Button>
            <Button variant="success" data-action="closeIncident" disabled={!canClose} data-disabled-reason={!canClose ? 'Incident must be resolved before closure.' : undefined} title={!canClose ? 'Incident must be resolved before closure.' : undefined} onClick={() => { if (active) closeIncident(active.incidentId, { postmortemRequired: true, closedBy: 'Incident Commander' }); reload(); }}>
              <CheckCircle2 className="h-4 w-4" />Close incident
            </Button>
            <Button variant="secondary" data-action="exportIncidentPack" disabled={!dashboard.incidents.length} data-disabled-reason={!dashboard.incidents.length ? 'Create an incident before exporting incident pack.' : undefined} title={!dashboard.incidents.length ? 'Create an incident before exporting incident pack.' : undefined} onClick={() => { exportIncidentPack(active?.incidentId); reload(); }}>
              <FileText className="h-4 w-4" />Export incident pack
            </Button>
          </>
        )}
      />

      <div className="grid grid-cols-5 gap-4" data-incident-command-dashboard>
        {[
          { label: 'Readiness', value: dashboard.status, tone: toneFor(dashboard.status) },
          { label: 'Active', value: dashboard.activeCount, tone: dashboard.activeCount ? 'amber' : 'green' },
          { label: 'Critical', value: dashboard.criticalCount, tone: dashboard.criticalCount ? 'red' : 'green' },
          { label: 'Rollback', value: dashboard.rollbackRequestCount, tone: dashboard.rollbackRequestCount ? 'red' : 'green' },
          { label: 'Postmortem', value: dashboard.postmortemQueueCount, tone: dashboard.postmortemQueueCount ? 'amber' : 'green' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <b className="truncate text-xl text-slate-950">{item.value}</b>
              <Badge tone={item.tone as Tone}>{item.label}</Badge>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[390px_1fr_390px] gap-5">
        <Panel title="Active Incidents">
          <div className="max-h-[520px] space-y-3 overflow-auto p-4 text-sm">
            {(dashboard.incidents.length ? dashboard.incidents : []).map((incident) => (
              <div key={incident.incidentId} className="rounded-xl border border-slate-100 p-3" data-production-incident-id={incident.incidentId}>
                <div className="flex items-center justify-between gap-3">
                  <b>{incident.incidentId}</b>
                  <Badge tone={toneFor(`${incident.severity} ${incident.status}`)}>{incident.severity}</Badge>
                </div>
                <p className="mt-2 text-slate-600">{incident.customerImpact}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>{incident.environment}</span>
                  <span>{incident.status}</span>
                </div>
              </div>
            ))}
            {!dashboard.incidents.length ? <p className="rounded-xl bg-green-50 p-3 text-green-700">No production incidents recorded.</p> : null}
          </div>
        </Panel>

        <Panel title="Incident Timeline">
          <div className="max-h-[520px] space-y-3 overflow-auto p-4 text-sm" data-incident-timeline>
            {(active?.timelineEvents ?? []).map((entry) => (
              <div key={entry.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <b>{entry.type}</b>
                  <span className="text-xs text-slate-400">{entry.timestamp.slice(0, 19)}</span>
                </div>
                <p className="mt-2 text-slate-600">{entry.message}</p>
              </div>
            ))}
            {!active ? <p className="rounded-xl bg-slate-50 p-3 text-slate-500">Create an incident to start command timeline.</p> : null}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Owner / Commander Assignment">
            <div className="space-y-3 p-4 text-sm">
              <div className="flex justify-between"><span>Owner</span><b>{active?.owner ?? 'missing'}</b></div>
              <div className="flex justify-between"><span>Commander</span><b>{active?.commander ?? 'missing'}</b></div>
              <div className="flex justify-between"><span>Escalation</span><b>{active?.escalationOwner ?? 'missing'}</b></div>
              <div className="flex justify-between"><span>Responders</span><b>{active?.responders.length ?? 0}</b></div>
            </div>
          </Panel>

          <Panel title="Rollback Decision Panel">
            <div className="space-y-3 p-4 text-sm">
              <div className="flex justify-between"><span>Required</span><Badge tone={active?.rollbackDecision?.required ? 'red' : 'green'}>{active?.rollbackDecision?.required ? 'required' : 'not required'}</Badge></div>
              <p className="text-slate-600">{active?.rollbackDecision?.reason ?? 'No rollback decision recorded.'}</p>
              <p className="text-xs text-slate-400">Triggered by: {active?.rollbackDecision?.triggeredBy ?? '-'}</p>
            </div>
          </Panel>

          <Panel title="Postmortem Requirement Panel">
            <div className="space-y-3 p-4 text-sm">
              <div className="flex justify-between"><span>Status</span><Badge tone={active?.postmortemRequired ? 'amber' : 'slate'}>{String(active?.postmortemRequired ?? 'undecided')}</Badge></div>
              <p className="text-slate-600">Closing an incident requires an explicit postmortem decision.</p>
            </div>
          </Panel>
        </div>

        <Panel title="Severity Board">
          <div className="grid grid-cols-5 gap-3 p-4 text-sm">
            {['SEV0', 'SEV1', 'SEV2', 'SEV3', 'SEV4'].map((severity) => {
              const count = dashboard.incidents.filter((incident) => incident.severity === severity && incident.status !== 'closed').length;
              return <div key={severity} className="rounded-xl border border-slate-100 p-3"><b>{severity}</b><p className="mt-2 text-2xl font-black text-slate-950">{count}</p></div>;
            })}
          </div>
        </Panel>

        <Panel title="Mitigation Checklist">
          <div className="space-y-2 p-4 text-sm">
            {(active?.mitigationSteps.length ? active.mitigationSteps : ['No mitigation steps recorded yet.']).map((step) => <p key={step} className="rounded-xl bg-slate-50 p-3 text-slate-600">{step}</p>)}
          </div>
        </Panel>

        <Panel title="Incident Artifact Export Panel">
          <div className="space-y-2 p-4 text-sm" data-incident-artifacts>
            {dashboard.artifacts.map((artifact) => <div key={artifact.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><span>{artifact.name}</span><Badge tone="blue">{artifact.type}</Badge></div>)}
            {!dashboard.artifacts.length ? <p className="text-slate-500">Incident artifacts appear after export.</p> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
