import { AlertTriangle, Ban, CheckCircle2, Download, PauseCircle, PlayCircle, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { Badge, Button, PageHeader, Panel, ProgressBar } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import {
  activateSubscription,
  cancelSubscription,
  createTenantSubscription,
  evaluateLicenseGate,
  exportBillingUsageReport,
  expireSubscription,
  markSubscriptionPastDue,
  recordBillingUsage,
  selectProductionBillingDashboard,
  suspendSubscription,
} from '../runtime/production-billing-store';

type BillingWidgetSurface =
  | 'tenant-production-binding'
  | 'go-live-control'
  | 'production-operations'
  | 'production-support'
  | 'production-compliance'
  | 'production-readiness';

function reload() {
  window.location.reload();
}

function toneFor(value: string | number): Tone {
  const text = String(value);
  if (/active|valid|ok|enterprise|scale|ready/i.test(text)) return 'green';
  if (/trial|warning|past_due|80/i.test(text)) return 'amber';
  if (/suspended|cancelled|expired|blocked|missing|exceed/i.test(text)) return 'red';
  return 'slate';
}

export function ProductionBillingCompactWidget({ surface }: { surface: BillingWidgetSurface }) {
  const dashboard = selectProductionBillingDashboard();
  return (
    <span
      data-production-billing-widget
      data-production-billing-surface={surface}
      data-production-billing-status={dashboard.summary.licenseStatus}
      data-production-billing-plan={dashboard.summary.planId ?? 'missing'}
      data-production-billing-sla={dashboard.summary.supportSlaLevel}
      data-production-billing-blockers={dashboard.summary.blockers}
      className="sr-only"
    >
      Production billing {surface}: {dashboard.summary.licenseStatus}, {dashboard.summary.planId ?? 'no plan'}, SLA {dashboard.summary.supportSlaLevel}.
    </span>
  );
}

export function ProductionBillingPage() {
  const dashboard = selectProductionBillingDashboard();
  const activeSubscriptionId = dashboard.subscription?.subscriptionId;
  const canUseSubscription = Boolean(activeSubscriptionId);

  return (
    <div data-route="/production-billing" data-production-billing-route>
      <PageHeader
        title="Production Billing, Subscription & License Gate"
        subtitle="Commercial readiness gate for tenant subscription state, plan entitlements, feature access, usage quota, SLA, and billing evidence exports."
        actions={(
          <>
            <Button data-action="createTenantSubscription" onClick={() => { createTenantSubscription({ tenantId: 'tenant-uikigai-demo', planId: 'growth', status: 'trial' }); reload(); }}>
              <PlayCircle className="h-4 w-4" />Create trial
            </Button>
            <Button variant="success" data-action="activateSubscription" disabled={!canUseSubscription} data-disabled-reason={!canUseSubscription ? 'Create a subscription before activation.' : undefined} onClick={() => { activateSubscription(activeSubscriptionId); reload(); }}>
              <CheckCircle2 className="h-4 w-4" />Activate
            </Button>
            <Button variant="secondary" data-action="markSubscriptionPastDue" disabled={!canUseSubscription} data-disabled-reason={!canUseSubscription ? 'Create a subscription before marking past due.' : undefined} onClick={() => { markSubscriptionPastDue(activeSubscriptionId); reload(); }}>
              <AlertTriangle className="h-4 w-4" />Past due
            </Button>
            <Button variant="danger" data-action="suspendSubscription" disabled={!canUseSubscription} data-disabled-reason={!canUseSubscription ? 'Create a subscription before suspension.' : undefined} onClick={() => { suspendSubscription(activeSubscriptionId, 'Manual billing suspension from production billing center.'); reload(); }}>
              <PauseCircle className="h-4 w-4" />Suspend
            </Button>
            <Button variant="danger" data-action="cancelSubscription" disabled={!canUseSubscription} data-disabled-reason={!canUseSubscription ? 'Create a subscription before cancellation.' : undefined} onClick={() => { cancelSubscription(activeSubscriptionId); reload(); }}>
              <XCircle className="h-4 w-4" />Cancel
            </Button>
            <Button variant="danger" data-action="expireSubscription" disabled={!canUseSubscription} data-disabled-reason={!canUseSubscription ? 'Create a subscription before expiration.' : undefined} onClick={() => { expireSubscription(activeSubscriptionId); reload(); }}>
              <Ban className="h-4 w-4" />Expire
            </Button>
            <Button variant="secondary" data-action="recordBillingUsageWarning" onClick={() => { recordBillingUsage(dashboard.tenantId, { users: 28, workspaces: 2, agents: 20, runs: 820, storageGb: 80, artifacts: 840 }); reload(); }}>
              <RefreshCw className="h-4 w-4" />Usage 80%
            </Button>
            <Button variant="danger" data-action="recordBillingUsageBlocked" onClick={() => { recordBillingUsage(dashboard.tenantId, { users: 40, workspaces: 5, agents: 40, runs: 1400, storageGb: 120, artifacts: 1200 }); reload(); }}>
              <AlertTriangle className="h-4 w-4" />Exceed quota
            </Button>
            <Button variant="secondary" data-action="evaluateLicenseGate" onClick={() => { evaluateLicenseGate(dashboard.tenantId); reload(); }}>
              <ShieldCheck className="h-4 w-4" />Check license
            </Button>
            <Button variant="secondary" data-action="exportBillingUsageReport" onClick={() => { exportBillingUsageReport(dashboard.tenantId); reload(); }}>
              <Download className="h-4 w-4" />Export billing
            </Button>
          </>
        )}
      />

      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Subscription', value: dashboard.summary.subscriptionStatus },
          { label: 'Plan', value: dashboard.summary.planId ?? 'missing' },
          { label: 'License gate', value: dashboard.summary.licenseStatus },
          { label: 'Usage gate', value: dashboard.summary.usageStatus },
          { label: 'Support SLA', value: dashboard.summary.supportSlaLevel },
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

      <div className="mt-5 grid grid-cols-[390px_1fr_360px] gap-5">
        <Panel title="Plan Entitlements">
          <div className="space-y-3 p-4 text-sm" data-production-billing-entitlements>
            {dashboard.plans.map((plan) => (
              <div key={plan.planId} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between">
                  <b>{plan.name}</b>
                  <Badge tone={plan.planId === dashboard.summary.planId ? 'green' : 'slate'}>${plan.monthlyPriceUsd}/mo</Badge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <span>Users {plan.entitlements.userLimit}</span>
                  <span>Runs {plan.entitlements.runLimit}</span>
                  <span>Agents {plan.entitlements.agentLimit}</span>
                  <span>SLA {plan.entitlements.supportSlaLevel}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Usage Quota Gate">
          <div className="space-y-3 p-4 text-sm">
            {dashboard.usageGate.findings.map((finding) => (
              <div key={finding.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between">
                  <b>{finding.metric}</b>
                  <Badge tone={toneFor(finding.status)}>{finding.percent}%</Badge>
                </div>
                <ProgressBar value={Math.min(100, finding.percent)} tone={toneFor(finding.status)} />
                <div className="mt-2 text-xs text-slate-500">{finding.used} / {finding.limit} - {finding.reason}</div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="License Gate">
            <div className="space-y-3 p-4 text-sm">
              <div className="flex justify-between"><span>Status</span><Badge tone={toneFor(dashboard.licenseGate.status)}>{dashboard.licenseGate.status}</Badge></div>
              <div className="flex justify-between"><span>Compliance</span><b>{dashboard.entitlements.complianceFeaturesEnabled ? 'enabled' : 'disabled'}</b></div>
              <div className="flex justify-between"><span>Modules</span><b>{dashboard.entitlements.allowedModules.length}</b></div>
              {[...dashboard.licenseGate.blockers, ...dashboard.usageGate.blockers].map((blocker) => (
                <div key={blocker} className="rounded-xl bg-red-50 p-3 text-red-700">{blocker}</div>
              ))}
              {[...dashboard.licenseGate.warnings, ...dashboard.usageGate.warnings].map((warning) => (
                <div key={warning} className="rounded-xl bg-amber-50 p-3 text-amber-700">{warning}</div>
              ))}
            </div>
          </Panel>

          <Panel title="Billing Exports">
            <div className="space-y-3 p-4 text-sm">
              {['billing-summary.md', 'subscription-status.json', 'license-entitlements.json', 'usage-quota-report.md', 'billing-blockers.json'].map((name) => (
                <div key={name} className="rounded-xl border border-slate-100 p-3">
                  <b>{name}</b>
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
