import { ClipboardCopy, FileText, PlayCircle, RefreshCw, RotateCcw, ShieldCheck, ShieldX, Ship, TimerReset } from 'lucide-react';
import { Badge, Button, PageHeader, Panel, ProgressBar } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import {
  approveGoLive,
  copyReleaseSummary,
  createReleaseCandidate,
  exportGoLivePack,
  markReleased,
  refreshReadiness,
  rejectGoLive,
  requestGoLiveApproval,
  selectGoLiveControl,
  setReleaseWindow,
  triggerRollback,
  verifyRollbackPlan,
} from '../runtime/go-live-control-store';
import { ProductionIncidentCompactWidget } from './ProductionIncidentPage';
import { ProductionOperationsCompactWidget } from './ProductionOperationsPage';
import { ProductionRunbookCompactWidget } from './ProductionRunbookPage';
import { ProductionSupportCompactWidget } from './ProductionSupportPage';
import { TenantProductionBindingCompactWidget } from './TenantProductionBindingPage';

type GoLiveWidgetSurface =
  | 'pre-golive-validation'
  | 'production-readiness'
  | 'deployment-config'
  | 'runtime-certification'
  | 'certified-sandbox-run'
  | 'backend-readiness'
  | 'database-readiness'
  | 'auth-readiness'
  | 'environment-readiness'
  | 'production-config-evidence'
  | 'production-observability';

function toneFor(value: string): Tone {
  if (/GO|verified|complete|approved|released/i.test(value)) return 'green';
  if (/WARNING|warning|waiting/i.test(value)) return 'amber';
  if (/NO_GO|BLOCKED|blocked|missing|rejected|rolled_back/i.test(value)) return 'red';
  return 'slate';
}

function reload() {
  window.location.reload();
}

export function GoLiveControlCompactWidget({ surface }: { surface: GoLiveWidgetSurface }) {
  const control = selectGoLiveControl();
  return (
    <span
      data-go-live-widget={surface}
      data-go-live-verdict={control.finalVerdict}
      data-go-live-score={control.readinessScore}
      data-go-live-blockers={control.blockerCount}
      data-go-live-warnings={control.warningCount}
      data-go-live-approval={control.approvedBy ? 'assigned' : 'missing'}
      data-go-live-release-window={control.releaseWindow ? 'scheduled' : 'missing'}
      data-go-live-rollback={control.rollbackPlanStatus}
      className="sr-only"
    >
      Go-live {surface}: {control.finalVerdict}, score {control.readinessScore}, {control.blockerCount} blockers, {control.warningCount} warnings.
    </span>
  );
}

export function GoLiveControlPage() {
  const control = selectGoLiveControl();
  const canRequestApproval = control.rollbackPlanStatus !== 'missing' && Boolean(control.releaseWindow);
  const artifacts = control.evidencePackStatus === 'exported' ? control.releaseId : '';

  return (
    <div data-route="/go-live-control" data-go-live-control-route>
      <ProductionIncidentCompactWidget surface="go-live-control" />
      <ProductionOperationsCompactWidget surface="go-live-control" />
      <ProductionRunbookCompactWidget surface="go-live-control" />
      <ProductionSupportCompactWidget surface="go-live-control" />
      <TenantProductionBindingCompactWidget surface="go-live-control" />
      <PageHeader
        title="Production Release Approval & Go-Live Control Center"
        subtitle="Final release gate for production readiness, evidence, approval, release window, rollback readiness, and go/no-go decision history."
        actions={(
          <>
            <Button data-action="createReleaseCandidate" onClick={() => { createReleaseCandidate({ version: '9H.0.0', commitHash: 'local-candidate' }); reload(); }}>
              <PlayCircle className="h-4 w-4" />Create release candidate
            </Button>
            <Button variant="secondary" data-action="refreshReadiness" onClick={() => { refreshReadiness(); reload(); }}>
              <RefreshCw className="h-4 w-4" />Refresh readiness
            </Button>
            <Button variant="secondary" data-action="requestGoLiveApproval" disabled={!canRequestApproval} data-disabled-reason={!canRequestApproval ? 'Release window and rollback plan are required before approval request.' : undefined} title={!canRequestApproval ? 'Release window and rollback plan are required before approval request.' : undefined} onClick={() => { requestGoLiveApproval(undefined, 'Release Captain'); reload(); }}>
              <ShieldCheck className="h-4 w-4" />Request approval
            </Button>
            <Button variant="success" data-action="approveGoLive" disabled={!control.canApprove} data-disabled-reason={!control.canApprove ? 'Resolve blockers and request approval before approving go-live.' : undefined} title={!control.canApprove ? 'Resolve blockers and request approval before approving go-live.' : undefined} onClick={() => { approveGoLive(undefined, 'VP Engineering'); reload(); }}>
              <ShieldCheck className="h-4 w-4" />Approve Go
            </Button>
            <Button variant="danger" data-action="rejectGoLive" onClick={() => { rejectGoLive(undefined, 'Release approver selected No-Go.'); reload(); }}>
              <ShieldX className="h-4 w-4" />Reject No-Go
            </Button>
            <Button variant="success" data-action="markReleased" disabled={!control.canMarkReleased} data-disabled-reason={!control.canMarkReleased ? 'Go-live must be approved with no blockers before marking released.' : undefined} title={!control.canMarkReleased ? 'Go-live must be approved with no blockers before marking released.' : undefined} onClick={() => { markReleased(); reload(); }}>
              <Ship className="h-4 w-4" />Mark released
            </Button>
            <Button variant="secondary" data-action="triggerRollback" disabled={!control.canTriggerRollback} data-disabled-reason={!control.canTriggerRollback ? 'Rollback can only be triggered after release.' : undefined} title={!control.canTriggerRollback ? 'Rollback can only be triggered after release.' : undefined} onClick={() => { triggerRollback(); reload(); }}>
              <RotateCcw className="h-4 w-4" />Trigger rollback
            </Button>
            <Button variant="secondary" data-action="exportGoLivePack" onClick={() => { exportGoLivePack(); reload(); }}>
              <FileText className="h-4 w-4" />Export Go-Live pack
            </Button>
            <Button variant="secondary" data-action="copyReleaseSummary" onClick={() => { copyReleaseSummary(); reload(); }}>
              <ClipboardCopy className="h-4 w-4" />Copy release summary
            </Button>
          </>
        )}
      />

      <div className="grid grid-cols-5 gap-4" data-go-live-verdict-panel>
        {[
          { label: 'Final verdict', value: control.finalVerdict, tone: toneFor(control.finalVerdict) },
          { label: 'State', value: control.state, tone: toneFor(control.state) },
          { label: 'Score', value: `${control.readinessScore}%`, tone: toneFor(control.finalVerdict) },
          { label: 'Blockers', value: control.blockerCount, tone: control.blockerCount ? 'red' : 'green' },
          { label: 'Warnings', value: control.warningCount, tone: control.warningCount ? 'amber' : 'green' },
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
        <Panel title="Readiness Gate Matrix">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-go-live-readiness-matrix>
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-400">
                <tr><th className="px-4 py-3">Gate</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Evidence</th></tr>
              </thead>
              <tbody>
                {control.readinessMatrix.map((gate) => (
                  <tr key={gate.gateId} className="border-b border-slate-100 align-top" data-go-live-gate={gate.gateId}>
                    <td className="px-4 py-3"><b>{gate.name}</b><div className="text-xs text-slate-400">{gate.route}</div></td>
                    <td className="px-4 py-3"><Badge tone={toneFor(gate.status)}>{gate.status}</Badge></td>
                    <td className="px-4 py-3">{gate.score}%</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{gate.evidence.slice(0, 3).join(', ') || 'missing'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Release Approval Panel">
            <div className="space-y-3 p-4 text-sm">
              <div className="flex items-center justify-between"><span>Approver</span><Badge tone={control.approvedBy ? 'green' : 'red'}>{control.approvedBy ?? 'missing'}</Badge></div>
              <div className="flex items-center justify-between"><span>Approval timestamp</span><span className="text-slate-500">{control.approvalTimestamp ?? '-'}</span></div>
              <div className="flex items-center justify-between"><span>Decision</span><Badge tone={toneFor(control.state)}>{control.state}</Badge></div>
            </div>
          </Panel>

          <Panel title="Release Window Panel">
            <div className="space-y-3 p-4 text-sm">
              <Button data-action="setReleaseWindow" variant="secondary" onClick={() => { setReleaseWindow(); reload(); }}>
                <TimerReset className="h-4 w-4" />Set release window
              </Button>
              <div>{control.releaseWindow ? `${control.releaseWindow.start} - ${control.releaseWindow.end}` : 'Release window missing.'}</div>
            </div>
          </Panel>

          <Panel title="Rollback Plan Panel">
            <div className="space-y-3 p-4 text-sm">
              <Button data-action="verifyRollbackPlan" variant="secondary" onClick={() => { verifyRollbackPlan(); reload(); }}>
                <ShieldCheck className="h-4 w-4" />Verify rollback plan
              </Button>
              <div className="flex items-center justify-between"><span>Status</span><Badge tone={toneFor(control.rollbackPlanStatus)}>{control.rollbackPlanStatus}</Badge></div>
            </div>
          </Panel>
        </div>

        <Panel title="Required Evidence Checklist">
          <div className="space-y-3 p-4 text-sm" data-go-live-checklist>
            <ProgressBar value={control.readinessScore} tone={toneFor(control.finalVerdict)} />
            {control.evidenceChecklist.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2">
                <span>{item.label}</span><Badge tone={toneFor(item.status)}>{item.status}</Badge>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Production Blockers">
          <div className="max-h-[300px] space-y-2 overflow-hidden p-4 text-sm">
            {control.blockers.map((entry) => <p key={entry.id} className="rounded-xl bg-red-50 p-3 text-red-700">{entry.reason}</p>)}
            {!control.blockers.length ? <p className="text-green-700">No production go-live blockers.</p> : null}
          </div>
        </Panel>

        <Panel title="Production Warnings">
          <div className="max-h-[300px] space-y-2 overflow-hidden p-4 text-sm">
            {control.warnings.map((entry) => <p key={entry.id} className="rounded-xl bg-amber-50 p-3 text-amber-700">{entry.reason}</p>)}
            {!control.warnings.length ? <p className="text-green-700">No production warnings.</p> : null}
          </div>
        </Panel>

        <Panel title="Final Go-Live Pack Export">
          <div className="space-y-2 p-4 text-sm">
            <div className="flex items-center justify-between"><span>Pack status</span><Badge tone={toneFor(control.evidencePackStatus)}>{control.evidencePackStatus}</Badge></div>
            <div className="text-slate-500">Latest export scope: {artifacts || 'not exported'}</div>
          </div>
        </Panel>

        <Panel title="Go / No-Go Decision Timeline">
          <div className="max-h-[320px] space-y-2 overflow-hidden p-4 text-sm" data-go-live-timeline>
            {control.timeline.map((event) => (
              <div key={event.id} className="rounded-xl border border-slate-100 px-3 py-2">
                <b>{event.type}</b>
                <p className="text-slate-500">{event.message}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
