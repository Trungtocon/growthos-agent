import { CheckCircle2, ClipboardCopy, FileText, PlayCircle, RefreshCw, RotateCcw, ShieldCheck, ShieldX, UserCheck } from 'lucide-react';
import { Badge, Button, PageHeader, Panel, ProgressBar } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import {
  acceptOperatorHandoff,
  approveRunbook,
  copyOperatorSummary,
  createRunbook,
  exportRunbookPack,
  markChecklistItemDone,
  markRunbookReady,
  refreshRunbook,
  rejectRunbook,
  selectProductionRunbook,
  triggerRollbackDrill,
} from '../runtime/production-runbook-store';
import { ProductionIncidentCompactWidget } from './ProductionIncidentPage';

type ProductionRunbookWidgetSurface =
  | 'go-live-control'
  | 'pre-golive-validation'
  | 'production-readiness'
  | 'production-observability'
  | 'deployment-config'
  | 'backend-readiness'
  | 'database-readiness'
  | 'auth-readiness'
  | 'environment-readiness';

function toneFor(value: string): Tone {
  if (/approved|accepted|ready|verified|done/i.test(value)) return 'green';
  if (/pending|incomplete|draft|warning/i.test(value)) return 'amber';
  if (/blocked|missing|rejected|failed|expired/i.test(value)) return 'red';
  return 'slate';
}

function reload() {
  window.location.reload();
}

export function ProductionRunbookCompactWidget({ surface }: { surface: ProductionRunbookWidgetSurface }) {
  const dashboard = selectProductionRunbook();
  return (
    <span
      data-production-runbook-widget={surface}
      data-production-runbook-status={dashboard.runbookStatus}
      data-production-runbook-handoff={dashboard.handoffStatus}
      data-production-runbook-completion={dashboard.checklistCompletion}
      data-production-runbook-rollback={dashboard.rollbackStatus}
      data-production-runbook-monitoring={dashboard.monitoringStatus}
      data-production-runbook-escalation-owner={dashboard.escalationOwner ? 'assigned' : 'missing'}
      data-production-runbook-blockers={dashboard.blockers.length}
      data-production-runbook-warnings={dashboard.warnings.length}
      className="sr-only"
    >
      Production runbook {surface}: {dashboard.runbookStatus}, handoff {dashboard.handoffStatus}, completion {dashboard.checklistCompletion}, {dashboard.blockers.length} blockers.
    </span>
  );
}

export function ProductionRunbookPage() {
  const dashboard = selectProductionRunbook();
  const firstPending = dashboard.sections.find((section) => section.status !== 'done');
  const canApprove = dashboard.canApproveRunbook && dashboard.runbookStatus !== 'approved';
  const canAccept = dashboard.canAcceptHandoff;

  return (
    <div data-route="/production-runbook" data-production-runbook-route>
      <ProductionIncidentCompactWidget surface="production-runbook" />
      <PageHeader
        title="Production Runbook & Operator Handoff"
        subtitle="Operational handoff pack for release operators: runbook, support window, incident response, rollback, escalation, and final acceptance."
        actions={(
          <>
            <Button data-action="createRunbook" onClick={() => { createRunbook({ releaseId: 'release-operator-handoff' }); reload(); }}>
              <PlayCircle className="h-4 w-4" />Create runbook
            </Button>
            <Button variant="secondary" data-action="refreshRunbook" onClick={() => { refreshRunbook(); reload(); }}>
              <RefreshCw className="h-4 w-4" />Refresh runbook
            </Button>
            <Button
              variant="secondary"
              data-action="markChecklistItemDone"
              disabled={!firstPending}
              data-disabled-reason={!firstPending ? 'All checklist items are already complete.' : undefined}
              title={!firstPending ? 'All checklist items are already complete.' : undefined}
              onClick={() => { if (firstPending) markChecklistItemDone(firstPending.id); reload(); }}
            >
              <CheckCircle2 className="h-4 w-4" />Mark checklist item done
            </Button>
            <Button variant="secondary" data-action="markRunbookReady" onClick={() => { markRunbookReady(); reload(); }}>
              <ShieldCheck className="h-4 w-4" />Mark ready
            </Button>
            <Button
              variant="success"
              data-action="approveRunbook"
              disabled={!canApprove}
              data-disabled-reason={!canApprove ? 'Complete required owners, support window, rollback and monitoring checklist before approval.' : undefined}
              title={!canApprove ? 'Complete required owners, support window, rollback and monitoring checklist before approval.' : undefined}
              onClick={() => { approveRunbook(undefined, 'VP Operations'); reload(); }}
            >
              <ShieldCheck className="h-4 w-4" />Approve runbook
            </Button>
            <Button variant="danger" data-action="rejectRunbook" onClick={() => { rejectRunbook(undefined, 'Operator rejected runbook handoff.'); reload(); }}>
              <ShieldX className="h-4 w-4" />Reject runbook
            </Button>
            <Button
              variant="success"
              data-action="acceptOperatorHandoff"
              disabled={!canAccept}
              data-disabled-reason={!canAccept ? 'Runbook must be approved and free of blockers before handoff acceptance.' : undefined}
              title={!canAccept ? 'Runbook must be approved and free of blockers before handoff acceptance.' : undefined}
              onClick={() => { acceptOperatorHandoff(undefined, 'Release Operator'); reload(); }}
            >
              <UserCheck className="h-4 w-4" />Accept handoff
            </Button>
            <Button variant="secondary" data-action="triggerRollbackDrill" onClick={() => { triggerRollbackDrill(); reload(); }}>
              <RotateCcw className="h-4 w-4" />Rollback drill
            </Button>
            <Button variant="secondary" data-action="exportRunbookPack" onClick={() => { exportRunbookPack(); reload(); }}>
              <FileText className="h-4 w-4" />Export runbook pack
            </Button>
            <Button variant="secondary" data-action="copyOperatorSummary" onClick={() => { copyOperatorSummary(); reload(); }}>
              <ClipboardCopy className="h-4 w-4" />Copy operator summary
            </Button>
          </>
        )}
      />

      <div className="grid grid-cols-5 gap-4" data-production-runbook-overview>
        {[
          { label: 'Runbook', value: dashboard.runbookStatus, tone: toneFor(dashboard.runbookStatus) },
          { label: 'Handoff', value: dashboard.handoffStatus, tone: toneFor(dashboard.handoffStatus) },
          { label: 'Checklist', value: `${dashboard.checklistCompletion}%`, tone: dashboard.checklistCompletion === 100 ? 'green' : 'amber' },
          { label: 'Rollback', value: dashboard.rollbackStatus, tone: toneFor(dashboard.rollbackStatus) },
          { label: 'Monitoring', value: dashboard.monitoringStatus, tone: toneFor(dashboard.monitoringStatus) },
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
        <Panel title="Runbook Overview">
          <div className="space-y-3 p-4 text-sm">
            <div className="flex justify-between"><span>Runbook ID</span><b className="truncate">{dashboard.runbookId}</b></div>
            <div className="flex justify-between"><span>Release</span><b>{dashboard.releaseId}</b></div>
            <div className="flex justify-between"><span>Environment</span><b>{dashboard.environment}</b></div>
            <ProgressBar value={dashboard.checklistCompletion} label="Required checklist completion" />
            <p className="rounded-xl bg-slate-50 p-3 text-slate-600">Go-live remains blocked until this runbook is ready or approved and operator handoff is accepted.</p>
          </div>
        </Panel>

        <Panel title="Deployment Checklist">
          <div className="max-h-[520px] overflow-auto p-4">
            {dashboard.sections.map((section) => (
              <div key={section.id} data-runbook-section={section.id} className="mb-3 rounded-xl border border-slate-100 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <b className="text-slate-950">{section.title}</b>
                  <Badge tone={toneFor(section.status)}>{section.status}</Badge>
                </div>
                <p className="mt-2 text-slate-500">{section.description}</p>
                <p className="mt-2 text-xs text-slate-400">{section.evidence[0] ?? 'Awaiting operator evidence.'}</p>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Operator Handoff Status">
            <div className="space-y-3 p-4 text-sm">
              <div className="flex justify-between"><span>Operator owner</span><b>{dashboard.operatorOwner ?? 'missing'}</b></div>
              <div className="flex justify-between"><span>Escalation owner</span><b>{dashboard.escalationOwner ?? 'missing'}</b></div>
              <div className="flex justify-between"><span>Incident owner</span><b>{dashboard.incidentOwner ?? 'missing'}</b></div>
              <div className="flex justify-between"><span>Support window</span><b>{dashboard.supportWindow ? `${dashboard.supportWindow.start.slice(0, 16)} - ${dashboard.supportWindow.end.slice(11, 16)}` : 'missing'}</b></div>
              <div className="flex justify-between"><span>Acceptance</span><Badge tone={toneFor(dashboard.handoffStatus)}>{dashboard.handoffStatus}</Badge></div>
            </div>
          </Panel>

          <Panel title="Incident Response Checklist">
            <div className="space-y-2 p-4 text-sm">
              {dashboard.sections.filter((section) => ['incident_response', 'rollback_procedure', 'escalation_matrix', 'support_contacts', 'post_release_monitoring'].includes(section.type)).map((section) => (
                <div key={section.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                  <span>{section.title}</span><Badge tone={toneFor(section.status)}>{section.status}</Badge>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Known Risks">
            <div className="space-y-2 p-4 text-sm">
              {dashboard.blockers.slice(0, 6).map((item) => <p key={item.id} className="rounded-xl bg-red-50 p-3 text-red-700">{item.reason}</p>)}
              {!dashboard.blockers.length ? <p className="rounded-xl bg-green-50 p-3 text-green-700">No runbook blockers.</p> : null}
              {dashboard.warnings.slice(0, 4).map((item) => <p key={item.id} className="rounded-xl bg-amber-50 p-3 text-amber-700">{item.reason}</p>)}
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-5">
        <Panel title="Rollback Procedure">
          <div className="p-4 text-sm text-slate-600">
            {dashboard.sections.filter((section) => section.type === 'rollback_procedure').map((section) => <p key={section.id}>{section.description}</p>)}
          </div>
        </Panel>
        <Panel title="Escalation Matrix">
          <div className="grid grid-cols-3 gap-3 p-4 text-sm">
            {[
              { label: 'Operator', value: dashboard.operatorOwner ?? 'missing' },
              { label: 'Escalation', value: dashboard.escalationOwner ?? 'missing' },
              { label: 'Incident', value: dashboard.incidentOwner ?? 'missing' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-100 p-3">
                <p className="text-xs uppercase text-slate-400">{item.label}</p>
                <b className="mt-2 block text-slate-950">{item.value}</b>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
