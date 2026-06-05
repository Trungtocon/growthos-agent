import { CheckCircle2, Download, FileCheck2, Link2, LockKeyhole, RefreshCw, Send, ShieldCheck, UserCheck, XCircle } from 'lucide-react';
import { Badge, Button, PageHeader, Panel, ProgressBar } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import {
  activateTenantBinding,
  approveTenantBinding,
  assignBindingOwner,
  assignBindingReviewer,
  createTenantBinding,
  exportTenantBindingPack,
  markTenantBindingEvidenceReady,
  rejectTenantBinding,
  selectTenantProductionBindingDashboard,
  submitTenantBindingForReview,
  updateTenantBinding,
} from '../runtime/tenant-production-binding-store';
import type { TenantBindingEnvironment } from '../runtime/tenant-production-binding';
import { ProductionComplianceCompactWidget } from './ProductionCompliancePage';
import { ProductionBillingCompactWidget } from './ProductionBillingPage';
import { ProductionAccessControlCompactWidget } from './ProductionAccessControlPage';

type TenantBindingWidgetSurface =
  | 'production-operations'
  | 'go-live-control'
  | 'production-readiness'
  | 'deployment-config'
  | 'backend-readiness'
  | 'database-readiness'
  | 'auth-readiness'
  | 'environment-readiness'
  | 'production-config-evidence'
  | 'pre-golive-validation';

function reload() {
  window.location.reload();
}

function toneFor(value: string | number): Tone {
  const text = String(value);
  if (/active|approved|ready|pass|verified|100/.test(text)) return 'green';
  if (/warning|review|draft|incomplete/.test(text)) return 'amber';
  if (/blocked|rejected|missing|fail/.test(text)) return 'red';
  return 'slate';
}

export function TenantProductionBindingCompactWidget({ surface }: { surface: TenantBindingWidgetSurface }) {
  const summary = selectTenantProductionBindingDashboard().compactSummary;
  return (
    <span
      data-tenant-production-binding-widget
      data-tenant-production-binding-surface={surface}
      data-tenant-production-binding-status={summary.status}
      data-tenant-production-binding-blockers={summary.blockers}
      data-tenant-production-binding-score={summary.readinessScore}
      className="sr-only"
    >
      Tenant production binding {surface}: {summary.status}, {summary.blockers} blocker(s).
    </span>
  );
}

function defaultProductionProfiles() {
  return {
    backendProfileId: 'backend-prod',
    databaseProfileId: 'database-prod',
    authProfileId: 'auth-prod',
    observabilityProfileId: 'obs-prod',
    supportProfileId: 'support-prod',
    deploymentProfileId: 'deploy-prod',
    rollbackOwner: 'Rollback Commander',
  };
}

function environmentOptions(active?: TenantBindingEnvironment) {
  return (['local', 'sandbox', 'staging', 'production'] as TenantBindingEnvironment[]).map((environment) => ({
    environment,
    status: active === environment ? 'selected' : environment === 'production' ? 'required' : 'available',
  }));
}

export function TenantProductionBindingPage() {
  const dashboard = selectTenantProductionBindingDashboard();
  const binding = dashboard.selectedBinding;
  const readiness = dashboard.readiness;
  const review = dashboard.review;
  const hasBinding = Boolean(binding);
  const canApprove = review.canApprove;
  const canActivate = review.canActivate;
  const canSubmit = review.canSubmit;
  const submitReason = !hasBinding ? 'Create a tenant binding first.' : !binding?.owner || !binding?.reviewer ? 'Owner and reviewer are required before review.' : undefined;
  const approveReason = !canApprove ? 'Binding must be submitted and have a reviewer before approval.' : undefined;
  const activateReason = !canActivate ? 'Activation requires approval plus zero readiness blockers.' : undefined;

  return (
    <div data-route="/tenant-production-binding" data-tenant-production-binding-route>
      <ProductionBillingCompactWidget surface="tenant-production-binding" />
      <ProductionAccessControlCompactWidget surface="tenant-production-binding" />
      <ProductionComplianceCompactWidget surface="tenant-production-binding" />
      <PageHeader
        title="Tenant / Workspace Production Binding"
        subtitle="Admin settings for binding one tenant and workspace to verified production profiles without storing raw secrets or bypassing Go-Live approval."
        actions={(
          <>
            <Button data-action="createTenantBinding" onClick={() => { createTenantBinding({ environment: 'production' }); reload(); }}>
              <Link2 className="h-4 w-4" />Create binding
            </Button>
            <Button variant="secondary" data-action="updateTenantBinding" disabled={!hasBinding} data-disabled-reason={!hasBinding ? 'Create a binding before attaching production profiles.' : undefined} onClick={() => { updateTenantBinding(binding?.bindingId, defaultProductionProfiles()); reload(); }}>
              <RefreshCw className="h-4 w-4" />Attach profiles
            </Button>
            <Button variant="secondary" data-action="assignBindingOwner" disabled={!hasBinding} data-disabled-reason={!hasBinding ? 'Create a binding before assigning owner.' : undefined} onClick={() => { assignBindingOwner(binding?.bindingId, 'Platform Owner'); reload(); }}>
              <UserCheck className="h-4 w-4" />Assign owner
            </Button>
            <Button variant="secondary" data-action="assignBindingReviewer" disabled={!hasBinding} data-disabled-reason={!hasBinding ? 'Create a binding before assigning reviewer.' : undefined} onClick={() => { assignBindingReviewer(binding?.bindingId, 'Security Reviewer'); reload(); }}>
              <ShieldCheck className="h-4 w-4" />Assign reviewer
            </Button>
            <Button variant="secondary" data-action="markTenantBindingEvidenceReady" disabled={!hasBinding} data-disabled-reason={!hasBinding ? 'Create a binding before attaching masked evidence.' : undefined} onClick={() => { markTenantBindingEvidenceReady(binding?.bindingId); reload(); }}>
              <FileCheck2 className="h-4 w-4" />Attach evidence
            </Button>
            <Button variant="warning" data-action="submitTenantBindingForReview" disabled={!canSubmit} data-disabled-reason={submitReason} onClick={() => { submitTenantBindingForReview(binding?.bindingId); reload(); }}>
              <Send className="h-4 w-4" />Submit review
            </Button>
            <Button variant="success" data-action="approveTenantBinding" disabled={!canApprove} data-disabled-reason={approveReason} onClick={() => { approveTenantBinding(binding?.bindingId, 'Security Reviewer'); reload(); }}>
              <CheckCircle2 className="h-4 w-4" />Approve
            </Button>
            <Button variant="danger" data-action="rejectTenantBinding" disabled={!hasBinding} data-disabled-reason={!hasBinding ? 'Create a binding before rejecting review.' : undefined} onClick={() => { rejectTenantBinding(binding?.bindingId, 'Reviewer requested profile evidence update.'); reload(); }}>
              <XCircle className="h-4 w-4" />Reject
            </Button>
            <Button variant="success" data-action="activateTenantBinding" disabled={!canActivate} data-disabled-reason={activateReason} onClick={() => { activateTenantBinding(binding?.bindingId); reload(); }}>
              <LockKeyhole className="h-4 w-4" />Activate
            </Button>
            <Button variant="secondary" data-action="exportTenantBindingPack" onClick={() => { exportTenantBindingPack(binding?.bindingId); reload(); }}>
              <Download className="h-4 w-4" />Export pack
            </Button>
          </>
        )}
      />

      <div className="grid grid-cols-5 gap-4" data-tenant-binding-summary>
        {[
          { label: 'Binding status', value: binding?.status ?? 'missing' },
          { label: 'Environment', value: binding?.environment ?? 'missing' },
          { label: 'Approval', value: binding?.approvalStatus ?? 'missing' },
          { label: 'Readiness score', value: `${readiness.score}/100` },
          { label: 'Blockers', value: readiness.blockers.length },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <b className="truncate text-xl text-slate-950">{item.value}</b>
              <Badge tone={toneFor(item.value)}>{item.label}</Badge>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[370px_1fr_380px] gap-5">
        <Panel title="Tenant / Workspace Selector">
          <div className="space-y-4 p-4 text-sm">
            <div className="rounded-xl border border-slate-100 p-3">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Tenant</div>
              <div className="mt-1 font-semibold text-slate-950">{binding?.tenantId ?? 'No tenant selected'}</div>
            </div>
            <div className="rounded-xl border border-slate-100 p-3">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Workspace</div>
              <div className="mt-1 font-semibold text-slate-950">{binding?.workspaceId ?? 'No workspace selected'}</div>
            </div>
            <div className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-center justify-between">
                <span>Owner</span>
                <Badge tone={binding?.owner ? 'green' : 'red'}>{binding?.owner ?? 'missing'}</Badge>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span>Reviewer</span>
                <Badge tone={binding?.reviewer ? 'green' : 'red'}>{binding?.reviewer ?? 'missing'}</Badge>
              </div>
            </div>
            <p className="rounded-xl bg-slate-50 p-3 text-slate-600">Secrets are represented only as masked metadata. Raw production credentials remain outside frontend state.</p>
          </div>
        </Panel>

        <Panel title="Environment Profile Matrix">
          <div className="space-y-4 p-4 text-sm" data-tenant-profile-matrix>
            <div className="grid grid-cols-4 gap-3">
              {environmentOptions(binding?.environment).map((item) => (
                <div key={item.environment} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <b className="capitalize">{item.environment}</b>
                    <Badge tone={toneFor(item.status)}>{item.status}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{item.environment === 'production' ? 'Required for production activation.' : 'Available for lower environments.'}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Backend', binding?.backendProfileId],
                ['Database', binding?.databaseProfileId],
                ['Auth', binding?.authProfileId],
                ['Observability', binding?.observabilityProfileId],
                ['Support', binding?.supportProfileId],
                ['Deployment', binding?.deploymentProfileId],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <span>{label}</span>
                    <Badge tone={value ? 'green' : 'red'}>{value ?? 'missing'}</Badge>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-slate-100 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span>Readiness score</span>
                <b>{readiness.score}/100</b>
              </div>
              <ProgressBar value={readiness.score} tone={readiness.blockers.length ? 'red' : readiness.warnings.length ? 'amber' : 'green'} />
            </div>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Binding Checklist">
            <div className="max-h-[310px] space-y-2 overflow-auto p-4 text-sm">
              {readiness.checks.map((check) => (
                <div key={check.checkId} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <b>{check.label}</b>
                    <Badge tone={toneFor(check.status)}>{check.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{check.reason}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Blockers / Warnings">
            <div className="space-y-3 p-4 text-sm">
              {readiness.blockers.map((item) => <p key={item} className="rounded-xl bg-red-50 p-3 text-red-700">{item}</p>)}
              {readiness.warnings.map((item) => <p key={item} className="rounded-xl bg-amber-50 p-3 text-amber-700">{item}</p>)}
              {!readiness.blockers.length && !readiness.warnings.length ? <p className="rounded-xl bg-green-50 p-3 text-green-700">Binding readiness is clear for activation.</p> : null}
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-5">
        <Panel title="Approval Record">
          <div className="grid grid-cols-4 gap-3 p-4 text-sm">
            {[
              ['Approval', review.approvalStatus],
              ['Can submit', String(review.canSubmit)],
              ['Can approve', String(review.canApprove)],
              ['Can activate', String(review.canActivate)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-100 p-3">
                <div className="text-xs text-slate-400">{label}</div>
                <b className="mt-1 block text-slate-950">{value}</b>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Export / Evidence Pack">
          <div className="grid grid-cols-3 gap-3 p-4 text-sm">
            {[
              'tenant-production-binding.json',
              'tenant-binding-readiness.md',
              'tenant-go-live-binding-pack.md',
            ].map((name) => (
              <div key={name} className="rounded-xl border border-slate-100 p-3">
                <b className="block truncate text-slate-950">{name}</b>
                <span className="text-xs text-slate-500">Artifact Registry export</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
