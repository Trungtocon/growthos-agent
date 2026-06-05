import { AlertTriangle, CheckCircle2, Download, Eye, PlayCircle, RefreshCw, RotateCcw, ShieldCheck, UserCheck } from 'lucide-react';
import { Badge, Button, PageHeader, Panel, ProgressBar } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import {
  acknowledgeOpsAlert,
  assignOpsOwner,
  createOpsSnapshot,
  escalateOpsItem,
  exportOpsPack,
  markOpsItemResolved,
  refreshReadinessSnapshot,
  requestGoLiveReview,
  requestRollbackReview,
  selectProductionOperationsDashboard,
} from '../runtime/production-operations-store';
import { TenantProductionBindingCompactWidget } from './TenantProductionBindingPage';
import { ProductionComplianceCompactWidget } from './ProductionCompliancePage';
import { ProductionBillingCompactWidget } from './ProductionBillingPage';

type ProductionOperationsWidgetSurface =
  | 'go-live-control'
  | 'production-readiness'
  | 'production-incidents'
  | 'production-support'
  | 'production-runbook'
  | 'production-observability'
  | 'backend-readiness'
  | 'database-readiness'
  | 'auth-readiness'
  | 'environment-readiness'
  | 'pre-golive-validation';

function toneFor(value: string): Tone {
  if (/healthy|ready|online|verified|resolved/i.test(value)) return 'green';
  if (/warning|degraded|assigned|acknowledged/i.test(value)) return 'amber';
  if (/blocked|critical|breached|missing|escalated/i.test(value)) return 'red';
  return 'slate';
}

function reload() {
  window.location.reload();
}

export function ProductionOperationsCompactWidget({ surface }: { surface: ProductionOperationsWidgetSurface }) {
  const dashboard = selectProductionOperationsDashboard();
  return (
    <span
      data-production-operations-widget
      data-production-operations-surface={surface}
      data-production-operations-health={dashboard.overallHealth}
      data-production-operations-queue={dashboard.actionQueue.length}
      data-production-operations-blockers={dashboard.blockers.length}
      data-production-operations-warnings={dashboard.warnings.length}
      className="sr-only"
    >
      Production operations {surface}: {dashboard.overallHealth}, {dashboard.actionQueue.length} queue item(s).
    </span>
  );
}

export function ProductionOperationsPage() {
  const dashboard = selectProductionOperationsDashboard();
  const activeItem = dashboard.actionQueue[0];
  const hasItem = Boolean(activeItem);

  return (
    <div data-route="/production-operations" data-production-operations-route>
      <TenantProductionBindingCompactWidget surface="production-operations" />
      <ProductionComplianceCompactWidget surface="production-operations" />
      <ProductionBillingCompactWidget surface="production-operations" />
      <PageHeader
        title="Production Operations Console & Live Ops Dashboard"
        subtitle="Live operator surface for production health, readiness, incidents, support SLA, rollback readiness, and action queue ownership."
        actions={(
          <>
            <Button data-action="createOpsSnapshot" onClick={() => { createOpsSnapshot(); reload(); }}>
              <PlayCircle className="h-4 w-4" />Create ops snapshot
            </Button>
            <Button variant="secondary" data-action="refreshReadinessSnapshot" onClick={() => { refreshReadinessSnapshot(); reload(); }}>
              <RefreshCw className="h-4 w-4" />Refresh readiness
            </Button>
            <Button variant="secondary" data-action="acknowledgeOpsAlert" disabled={!hasItem} data-disabled-reason={!hasItem ? 'No operations action item is available to acknowledge.' : undefined} title={!hasItem ? 'No operations action item is available to acknowledge.' : undefined} onClick={() => { if (activeItem) acknowledgeOpsAlert(activeItem.id); reload(); }}>
              <Eye className="h-4 w-4" />Acknowledge alert
            </Button>
            <Button variant="secondary" data-action="assignOpsOwner" disabled={!hasItem} data-disabled-reason={!hasItem ? 'No operations action item is available to assign.' : undefined} title={!hasItem ? 'No operations action item is available to assign.' : undefined} onClick={() => { if (activeItem) assignOpsOwner(activeItem.id, 'Live Ops Lead'); reload(); }}>
              <UserCheck className="h-4 w-4" />Assign owner
            </Button>
            <Button variant="danger" data-action="escalateOpsItem" disabled={!hasItem} data-disabled-reason={!hasItem ? 'No operations action item is available to escalate.' : undefined} title={!hasItem ? 'No operations action item is available to escalate.' : undefined} onClick={() => { if (activeItem) escalateOpsItem(activeItem.id, 'VP Operations'); reload(); }}>
              <AlertTriangle className="h-4 w-4" />Escalate item
            </Button>
            <Button variant="success" data-action="markOpsItemResolved" disabled={!hasItem} data-disabled-reason={!hasItem ? 'No operations action item is available to resolve.' : undefined} title={!hasItem ? 'No operations action item is available to resolve.' : undefined} onClick={() => { if (activeItem) markOpsItemResolved(activeItem.id); reload(); }}>
              <CheckCircle2 className="h-4 w-4" />Resolve item
            </Button>
            <Button variant="danger" data-action="requestRollbackReview" onClick={() => { requestRollbackReview(activeItem?.id); reload(); }}>
              <RotateCcw className="h-4 w-4" />Rollback review
            </Button>
            <Button variant="secondary" data-action="requestGoLiveReview" onClick={() => { requestGoLiveReview(); reload(); }}>
              <ShieldCheck className="h-4 w-4" />Go-Live review
            </Button>
            <Button variant="secondary" data-action="exportOpsPack" onClick={() => { exportOpsPack(); reload(); }}>
              <Download className="h-4 w-4" />Export ops pack
            </Button>
          </>
        )}
      />

      <div className="grid grid-cols-5 gap-4" data-production-operations-dashboard>
        {[
          { label: 'Overall health', value: dashboard.overallHealth, tone: toneFor(dashboard.overallHealth) },
          { label: 'Go-Live', value: dashboard.goLiveStatus, tone: toneFor(dashboard.goLiveStatus) },
          { label: 'Readiness', value: dashboard.productionReadiness, tone: toneFor(dashboard.productionReadiness) },
          { label: 'Action queue', value: dashboard.actionQueue.length, tone: dashboard.actionQueue.length ? 'amber' : 'green' },
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

      <div className="mt-5 grid grid-cols-[390px_1fr_380px] gap-5">
        <Panel title="Live System Status">
          <div className="space-y-3 p-4 text-sm">
            {dashboard.signals.map((signal) => (
              <div key={signal.id} className="rounded-xl border border-slate-100 p-3" data-ops-signal={signal.source}>
                <div className="flex items-center justify-between gap-3">
                  <b>{signal.label}</b>
                  <Badge tone={toneFor(signal.status)}>{signal.status}</Badge>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{signal.value}</span>
                  <span>{signal.route}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Operator Action Queue">
          <div className="max-h-[570px] space-y-3 overflow-auto p-4 text-sm" data-ops-action-queue>
            {dashboard.actionQueue.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-100 p-3" data-ops-item={item.id}>
                <div className="flex items-center justify-between gap-3">
                  <b>{item.title}</b>
                  <Badge tone={toneFor(`${item.priority} ${item.status}`)}>{item.priority}</Badge>
                </div>
                <p className="mt-2 text-slate-600">{item.details}</p>
                <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-slate-500">
                  <span>{item.type}</span>
                  <span>{item.status}</span>
                  <span>{item.owner ?? 'owner missing'}</span>
                  <span>{item.route}</span>
                </div>
              </div>
            ))}
            {!dashboard.actionQueue.length ? <p className="rounded-xl bg-green-50 p-3 text-green-700">No live operations action items.</p> : null}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Support SLA Status">
            <div className="space-y-3 p-4 text-sm">
              <div className="flex justify-between"><span>Support SLA</span><Badge tone={toneFor(dashboard.supportSlaStatus)}>{dashboard.supportSlaStatus}</Badge></div>
              <div className="flex justify-between"><span>Incident status</span><Badge tone={toneFor(dashboard.incidentStatus)}>{dashboard.incidentStatus}</Badge></div>
              <div className="flex justify-between"><span>Observability</span><Badge tone={toneFor(dashboard.observabilityStatus)}>{dashboard.observabilityStatus}</Badge></div>
            </div>
          </Panel>

          <Panel title="Rollback Readiness">
            <div className="space-y-3 p-4 text-sm">
              <div className="flex justify-between"><span>Rollback tasks</span><b>{dashboard.actionQueue.filter((item) => item.type === 'rollback_readiness').length}</b></div>
              <ProgressBar value={dashboard.actionQueue.some((item) => item.type === 'rollback_readiness') ? 35 : 100} />
              <p className="text-slate-600">Rollback review requests create action items only; they do not trigger rollback or bypass blockers.</p>
            </div>
          </Panel>

          <Panel title="Go-Live Review Behavior">
            <div className="space-y-3 p-4 text-sm">
              <div className="flex justify-between"><span>Current blockers</span><b>{dashboard.blockers.length}</b></div>
              <div className="flex justify-between"><span>Warnings</span><b>{dashboard.warnings.length}</b></div>
              <p className="text-slate-600">Go-Live review only creates operator queue evidence. It never auto-marks GO.</p>
            </div>
          </Panel>
        </div>

        <Panel title="Blocker Panel">
          <div className="max-h-[340px] space-y-2 overflow-auto p-4 text-sm">
            {dashboard.blockers.map((entry) => <p key={entry} className="rounded-xl bg-red-50 p-3 text-red-700">{entry}</p>)}
            {!dashboard.blockers.length ? <p className="rounded-xl bg-green-50 p-3 text-green-700">No active production operations blockers.</p> : null}
          </div>
        </Panel>

        <Panel title="Warning Panel">
          <div className="max-h-[340px] space-y-2 overflow-auto p-4 text-sm">
            {dashboard.warnings.map((entry) => <p key={entry} className="rounded-xl bg-amber-50 p-3 text-amber-700">{entry}</p>)}
            {!dashboard.warnings.length ? <p className="rounded-xl bg-green-50 p-3 text-green-700">No active production operations warnings.</p> : null}
          </div>
        </Panel>

        <Panel title="Operations Artifact Export Panel">
          <div className="space-y-2 p-4 text-sm">
            {dashboard.artifacts.map((artifact) => <div key={artifact.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><span>{artifact.name}</span><Badge tone="blue">{artifact.type}</Badge></div>)}
            {!dashboard.artifacts.length ? <p className="text-slate-500">Operations artifacts appear after export.</p> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
