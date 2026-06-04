import { BellRing, FileText, HeartPulse, ShieldAlert, ShieldCheck, UserRoundCheck, XCircle } from 'lucide-react';
import { Badge, Button, PageHeader, Panel, ProgressBar } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import {
  addDemoAlertChannel,
  addDemoIncidentOwner,
  addDemoMonitorEvidence,
  exportObservabilityPack,
  getProductionObservabilityArtifacts,
  rejectFirstMonitor,
  selectObservabilityDashboard,
  testFirstAlertChannel,
  verifyFirstConfiguredMonitor,
  verifyRunbook,
} from '../runtime/production-observability-store';
import { GoLiveControlCompactWidget } from './GoLiveControlPage';

type ProductionObservabilityWidgetSurface =
  | 'pre-golive-validation'
  | 'production-readiness'
  | 'deployment-config'
  | 'backend-readiness'
  | 'database-readiness'
  | 'auth-readiness'
  | 'environment-readiness'
  | 'production-config-evidence';

function toneFor(value: string): Tone {
  if (value.includes('BLOCKED') || value.includes('blocked') || value.includes('failed') || value.includes('missing')) return 'red';
  if (value.includes('WARNING') || value.includes('warning') || value.includes('configured')) return 'amber';
  if (value.includes('READY') || value.includes('verified')) return 'green';
  return 'slate';
}

function reload() {
  window.location.reload();
}

export function ProductionObservabilityCompactWidget({ surface }: { surface: ProductionObservabilityWidgetSurface }) {
  const dashboard = selectObservabilityDashboard();
  return (
    <span
      data-production-observability-widget={surface}
      data-production-observability-verdict={dashboard.verdict}
      data-production-observability-health-monitors={dashboard.healthMatrix.length}
      data-production-observability-alert-status={dashboard.alertChannelStatus}
      data-production-observability-owner-status={dashboard.incidentOwnerStatus}
      data-production-observability-runbook-status={dashboard.runbookStatus}
      data-production-observability-slo-sla-status={dashboard.sloSlaStatus}
      data-production-observability-blockers={dashboard.blockers.length}
      className="sr-only"
    >
      Production observability {surface}: {dashboard.verdict}, {dashboard.healthMatrix.length} health monitors, alert {dashboard.alertChannelStatus}, owner {dashboard.incidentOwnerStatus}, runbook {dashboard.runbookStatus}, SLO/SLA {dashboard.sloSlaStatus}, {dashboard.blockers.length} blockers.
    </span>
  );
}

export function ProductionObservabilityPage() {
  const dashboard = selectObservabilityDashboard();
  const artifacts = getProductionObservabilityArtifacts();
  const hasConfiguredMonitor = dashboard.healthMatrix.some((entry) => entry.status === 'configured');
  const hasMonitor = dashboard.healthMatrix.length > 0;
  const hasConfiguredAlert = dashboard.alertChannels.some((entry) => entry.status === 'configured');
  const evidencePanels: Array<{ title: string; entries: typeof dashboard.checks; key: string }> = [
    { title: 'Logging readiness', entries: dashboard.checks.filter((entry) => entry.type === 'logging'), key: 'logging' },
    { title: 'Audit trail readiness', entries: dashboard.checks.filter((entry) => entry.type === 'audit_logging'), key: 'audit' },
    { title: 'Alert channels', entries: dashboard.alertChannels, key: 'alert' },
    { title: 'Incident owners', entries: dashboard.incidentOwners, key: 'owner' },
    { title: 'Escalation policy', entries: dashboard.checks.filter((entry) => entry.type === 'escalation_policy'), key: 'policy' },
    { title: 'Runbook / rollback evidence', entries: dashboard.runbooks, key: 'runbook' },
    { title: 'SLO / SLA panel', entries: dashboard.sloSlaChecks, key: 'slo' },
    { title: 'RTO / RPO panel', entries: dashboard.rtoRpoChecks, key: 'rto' },
    { title: 'Production dashboard availability', entries: dashboard.checks.filter((entry) => entry.type === 'dashboard'), key: 'dashboard' },
  ];

  return (
    <div data-route="/production-observability" data-production-observability-route>
      <GoLiveControlCompactWidget surface="production-observability" />
      <PageHeader
        title="Production Observability & Incident Readiness"
        subtitle="Operational readiness evidence for health monitors, alerting, incident response, runbooks, SLO/SLA, and recovery objectives."
        actions={(
          <>
            <Button data-action="addMonitorEvidence" onClick={() => { addDemoMonitorEvidence(); reload(); }}>
              <HeartPulse className="h-4 w-4" />Add monitor evidence
            </Button>
            <Button
              variant="success"
              data-action="verifyMonitorEvidence"
              disabled={!hasConfiguredMonitor}
              data-disabled-reason={!hasConfiguredMonitor ? 'Add configured monitor evidence before verification.' : undefined}
              onClick={() => { verifyFirstConfiguredMonitor(); reload(); }}
            >
              <ShieldCheck className="h-4 w-4" />Verify monitor
            </Button>
            <Button
              variant="danger"
              data-action="rejectMonitorEvidence"
              disabled={!hasMonitor}
              data-disabled-reason={!hasMonitor ? 'Add monitor evidence before rejection.' : undefined}
              onClick={() => { rejectFirstMonitor(); reload(); }}
            >
              <XCircle className="h-4 w-4" />Reject monitor
            </Button>
            <Button variant="secondary" data-action="addAlertChannel" onClick={() => { addDemoAlertChannel(); reload(); }}>
              <BellRing className="h-4 w-4" />Add alert channel
            </Button>
            <Button
              variant="secondary"
              data-action="testAlertChannel"
              disabled={!hasConfiguredAlert}
              data-disabled-reason={!hasConfiguredAlert ? 'Add an alert channel before testing it.' : undefined}
              onClick={() => { testFirstAlertChannel(); reload(); }}
            >
              <ShieldCheck className="h-4 w-4" />Test alert channel
            </Button>
            <Button variant="secondary" data-action="addIncidentOwner" onClick={() => { addDemoIncidentOwner(); reload(); }}>
              <UserRoundCheck className="h-4 w-4" />Add incident owner
            </Button>
            <Button variant="secondary" data-action="verifyRunbook" onClick={() => { verifyRunbook(); reload(); }}>
              <ShieldCheck className="h-4 w-4" />Verify runbook
            </Button>
            <Button variant="secondary" data-action="exportObservabilityPack" onClick={() => { exportObservabilityPack(); reload(); }}>
              <FileText className="h-4 w-4" />Export observability pack
            </Button>
          </>
        )}
      />

      <div className="grid grid-cols-5 gap-4" data-production-observability-dashboard>
        {[
          { label: 'Verdict', value: dashboard.verdict, tone: toneFor(dashboard.verdict) },
          { label: 'Score', value: `${dashboard.readinessScore}%`, tone: toneFor(dashboard.verdict) },
          { label: 'Health monitors', value: dashboard.healthMatrix.length, tone: dashboard.healthMatrix.some((entry) => entry.status === 'verified') ? 'green' : 'red' },
          { label: 'Alerting', value: dashboard.alertChannelStatus, tone: toneFor(dashboard.alertChannelStatus) },
          { label: 'Blockers', value: dashboard.blockers.length, tone: dashboard.blockers.length ? 'red' : 'green' },
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

      <div className="mt-5 grid grid-cols-[1fr_390px] gap-5">
        <Panel title="Observability Dashboard">
          <div className="space-y-4 p-4 text-sm">
            <div className="flex items-center justify-between"><span>Production operations readiness</span><Badge tone={toneFor(dashboard.verdict)}>{dashboard.verdict}</Badge></div>
            <ProgressBar value={dashboard.readinessScore} tone={toneFor(dashboard.verdict)} />
            <p className="rounded-xl bg-slate-50 p-3 text-slate-600">Production cannot move to ready unless health monitors, alerting, owners, escalation policy, runbook, audit logging, SLO/SLA, RTO/RPO, and dashboards are verified.</p>
          </div>
        </Panel>

        <Panel title="Remaining Blockers">
          <div className="max-h-[280px] space-y-2 overflow-hidden p-4 text-sm">
            {dashboard.blockers.map((item) => <p key={item} className="rounded-xl bg-red-50 p-3 text-red-700"><ShieldAlert className="mr-2 inline h-4 w-4" />{item}</p>)}
            {!dashboard.blockers.length ? <p className="text-green-700">No production observability blockers.</p> : null}
          </div>
        </Panel>

        <Panel title="Health Check Matrix">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-400">
                <tr><th className="px-4 py-3">Monitor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Evidence</th><th className="px-4 py-3">Warnings</th></tr>
              </thead>
              <tbody>
                {(dashboard.healthMatrix.length ? dashboard.healthMatrix : [{ id: 'empty-health', name: 'No production health monitor', status: 'missing', evidence: [], warnings: ['Add monitor evidence before go-live.'] }]).map((entry) => (
                  <tr key={entry.id} data-observability-health-row={entry.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3"><b>{entry.name}</b></td>
                    <td className="px-4 py-3"><Badge tone={toneFor(entry.status)}>{entry.status}</Badge></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{entry.evidence.join(', ') || 'not provided'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{entry.warnings.join('; ') || 'none'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-5">
          {evidencePanels.map(({ title, entries, key }) => (
            <Panel key={key} title={title}>
              <div className="space-y-2 p-4 text-sm">
                {entries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2">
                    <span>{entry.name}</span><Badge tone={toneFor(entry.status)}>{entry.status}</Badge>
                  </div>
                ))}
                {!entries.length ? <p className="text-slate-500">Evidence missing.</p> : null}
              </div>
            </Panel>
          ))}

          <Panel title="Export Observability Pack">
            <div className="space-y-2 p-4 text-sm">
              {artifacts.map((artifact) => <div key={artifact.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><span>{artifact.name}</span><Badge tone="blue">{artifact.type}</Badge></div>)}
              {!artifacts.length ? <p className="text-slate-500">Export observability evidence to register operational readiness artifacts.</p> : null}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
