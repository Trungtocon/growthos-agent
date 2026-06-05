import { CheckCircle2, Download, Eye, FileCheck2, Gavel, PlayCircle, Send, ShieldCheck, XCircle } from 'lucide-react';
import { Badge, Button, PageHeader, Panel, ProgressBar } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import {
  approveComplianceChange,
  closeComplianceChange,
  createComplianceChangeApproval,
  exportComplianceEvidenceVault,
  implementComplianceChange,
  recordComplianceAuditEvent,
  rejectComplianceChange,
  reviewComplianceChange,
  selectProductionComplianceDashboard,
  submitComplianceChange,
  verifyComplianceChange,
} from '../runtime/production-compliance-store';

type ComplianceWidgetSurface =
  | 'production-readiness'
  | 'go-live-control'
  | 'production-operations'
  | 'production-incidents'
  | 'tenant-production-binding';

function reload() {
  window.location.reload();
}

function toneFor(value: string | number): Tone {
  const text = String(value);
  if (/closed|approved|implemented|verified|covered|pass|ready/i.test(text)) return 'green';
  if (/submitted|reviewed|draft|warning/i.test(text)) return 'amber';
  if (/rejected|missing|blocked|fail/i.test(text)) return 'red';
  return 'slate';
}

export function ProductionComplianceCompactWidget({ surface }: { surface: ComplianceWidgetSurface }) {
  const dashboard = selectProductionComplianceDashboard();
  return (
    <span
      data-production-compliance-widget
      data-production-compliance-surface={surface}
      data-production-compliance-events={dashboard.summary.auditEvents}
      data-production-compliance-approvals={dashboard.summary.approvals}
      data-production-compliance-blockers={dashboard.blockers.length}
      className="sr-only"
    >
      Production compliance {surface}: {dashboard.summary.auditEvents} audit event(s), {dashboard.summary.approvals} approval(s).
    </span>
  );
}

function activeApprovalId() {
  return selectProductionComplianceDashboard().approvals[0]?.approvalId;
}

export function ProductionCompliancePage() {
  const dashboard = selectProductionComplianceDashboard();
  const activeApproval = dashboard.approvals[0];
  const canTransition = Boolean(activeApproval);

  return (
    <div data-route="/production-compliance" data-production-compliance-route>
      <PageHeader
        title="Production Compliance & Audit Center"
        subtitle="Audit trail, change approvals, compliance controls, and evidence vault for production go-live operations."
        actions={(
          <>
            <Button data-action="recordComplianceAuditEvent" onClick={() => { recordComplianceAuditEvent({ actor: 'Compliance Operator', action: 'manual.audit.logged', object: 'production-compliance', justification: 'Manual audit event recorded from compliance center.', evidence: ['manual://audit-note'], controls: ['InternalPolicy'] }); reload(); }}>
              <Gavel className="h-4 w-4" />Record audit
            </Button>
            <Button variant="secondary" data-action="createComplianceChangeApproval" onClick={() => { createComplianceChangeApproval({ object: 'production-release-change', justification: 'Release change requires compliance review.', evidence: ['artifact://change-request'] }); reload(); }}>
              <PlayCircle className="h-4 w-4" />Create change
            </Button>
            <Button variant="secondary" data-action="submitComplianceChange" disabled={!canTransition} data-disabled-reason={!canTransition ? 'Create a compliance change before submitting.' : undefined} onClick={() => { submitComplianceChange(activeApprovalId()); reload(); }}>
              <Send className="h-4 w-4" />Submit
            </Button>
            <Button variant="secondary" data-action="reviewComplianceChange" disabled={!canTransition} data-disabled-reason={!canTransition ? 'Create a compliance change before review.' : undefined} onClick={() => { reviewComplianceChange(activeApprovalId(), 'Compliance Reviewer'); reload(); }}>
              <Eye className="h-4 w-4" />Review
            </Button>
            <Button variant="success" data-action="approveComplianceChange" disabled={!canTransition} data-disabled-reason={!canTransition ? 'Create a compliance change before approval.' : undefined} onClick={() => { approveComplianceChange(activeApprovalId(), 'Compliance Reviewer'); reload(); }}>
              <CheckCircle2 className="h-4 w-4" />Approve
            </Button>
            <Button variant="danger" data-action="rejectComplianceChange" disabled={!canTransition} data-disabled-reason={!canTransition ? 'Create a compliance change before rejection.' : undefined} onClick={() => { rejectComplianceChange(activeApprovalId(), 'Compliance Reviewer'); reload(); }}>
              <XCircle className="h-4 w-4" />Reject
            </Button>
            <Button variant="secondary" data-action="implementComplianceChange" disabled={!canTransition} data-disabled-reason={!canTransition ? 'Create a compliance change before implementation.' : undefined} onClick={() => { implementComplianceChange(activeApprovalId(), 'Release Operator'); reload(); }}>
              <FileCheck2 className="h-4 w-4" />Implement
            </Button>
            <Button variant="secondary" data-action="verifyComplianceChange" disabled={!canTransition} data-disabled-reason={!canTransition ? 'Create a compliance change before verification.' : undefined} onClick={() => { verifyComplianceChange(activeApprovalId(), 'Audit Reviewer'); reload(); }}>
              <ShieldCheck className="h-4 w-4" />Verify
            </Button>
            <Button variant="success" data-action="closeComplianceChange" disabled={!canTransition} data-disabled-reason={!canTransition ? 'Create a compliance change before closure.' : undefined} onClick={() => { closeComplianceChange(activeApprovalId(), 'Audit Reviewer'); reload(); }}>
              <CheckCircle2 className="h-4 w-4" />Close
            </Button>
            <Button variant="secondary" data-action="exportComplianceEvidenceVault" onClick={() => { exportComplianceEvidenceVault(); reload(); }}>
              <Download className="h-4 w-4" />Export vault
            </Button>
          </>
        )}
      />

      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Audit events', value: dashboard.summary.auditEvents },
          { label: 'Approvals', value: dashboard.summary.approvals },
          { label: 'Controls covered', value: `${dashboard.summary.controlsCovered}/6` },
          { label: 'Evidence artifacts', value: dashboard.summary.evidenceArtifacts },
          { label: 'Blockers', value: dashboard.blockers.length },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <b className="text-xl text-slate-950">{item.value}</b>
              <Badge tone={toneFor(item.value)}>{item.label}</Badge>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[420px_1fr_360px] gap-5">
        <Panel title="Compliance Controls">
          <div className="space-y-3 p-4 text-sm">
            {dashboard.controls.map((control) => (
              <div key={control.control} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between">
                  <b>{control.control}</b>
                  <Badge tone={toneFor(control.status)}>{control.status}</Badge>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Evidence {control.evidenceCount}</span>
                  <span>{control.lastAuditAt ?? 'no audit yet'}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Audit Trail">
          <div className="max-h-[620px] space-y-3 overflow-auto p-4 text-sm" data-compliance-audit-trail>
            {dashboard.auditTrail.map((event) => (
              <div key={event.auditId} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <b>{event.action}</b>
                  <Badge tone={toneFor(event.action)}>{event.actor}</Badge>
                </div>
                <p className="mt-2 text-slate-600">{event.justification}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                  <span>{event.object}</span>
                  <span>{event.timestamp}</span>
                  <span>{event.controls.join(', ')}</span>
                </div>
              </div>
            ))}
            {!dashboard.auditTrail.length ? <p className="rounded-xl bg-amber-50 p-3 text-amber-700">No audit events recorded yet.</p> : null}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Approval History">
            <div className="max-h-[290px] space-y-3 overflow-auto p-4 text-sm">
              {dashboard.approvals.map((approval) => (
                <div key={approval.approvalId} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <b>{approval.object}</b>
                    <Badge tone={toneFor(approval.status)}>{approval.status}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{approval.justification}</p>
                </div>
              ))}
              {!dashboard.approvals.length ? <p className="rounded-xl bg-slate-50 p-3 text-slate-600">No compliance approvals yet.</p> : null}
            </div>
          </Panel>

          <Panel title="Evidence Vault">
            <div className="space-y-3 p-4 text-sm">
              <div className="flex justify-between"><span>Artifacts</span><b>{dashboard.artifacts.length}</b></div>
              <ProgressBar value={Math.min(100, dashboard.summary.auditEvents * 12)} tone={dashboard.summary.auditEvents ? 'green' : 'amber'} />
              {['audit-report.md', 'approval-record.md', 'change-history.json', 'evidence-log.json', 'compliance-summary.md'].map((name) => (
                <div key={name} className="rounded-xl border border-slate-100 p-3">
                  <b className="text-slate-950">{name}</b>
                  <div className="text-xs text-slate-500">Artifact Registry export</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
