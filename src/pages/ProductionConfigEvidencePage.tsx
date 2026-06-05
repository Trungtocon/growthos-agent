import { FileCheck2, FileText, KeyRound, RotateCcw, ShieldAlert, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { Badge, Button, PageHeader, Panel, ProgressBar } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import {
  addNextMissingDemoEvidence,
  clearProductionConfigEvidence,
  expireFirstVerifiedEvidence,
  exportProductionConfigEvidencePack,
  getProductionConfigEvidenceArtifacts,
  getProductionEvidenceStatusForCategory,
  rejectFirstReviewableEvidence,
  selectProductionConfigEvidenceDashboard,
  verifyFirstProvidedEvidence,
} from '../runtime/production-config-evidence-store';
import type { ProductionEvidenceCategory } from '../runtime/production-config-evidence';
import { GoLiveControlCompactWidget } from './GoLiveControlPage';
import { ProductionObservabilityCompactWidget } from './ProductionObservabilityPage';
import { TenantProductionBindingCompactWidget } from './TenantProductionBindingPage';

type ProductionEvidenceWidgetSurface =
  | 'pre-golive-validation'
  | 'environment-readiness'
  | 'backend-readiness'
  | 'database-readiness'
  | 'auth-readiness'
  | 'production-readiness'
  | 'deployment-config'
  | 'runtime-certification';

const sectionGroups: Array<{ title: string; categories: ProductionEvidenceCategory[] }> = [
  { title: 'Production endpoint evidence', categories: ['backend_endpoint', 'production_endpoint_reachability'] },
  { title: 'Auth/session evidence', categories: ['auth_config'] },
  { title: 'Database/schema/migration evidence', categories: ['database_config', 'schema_version', 'migration_status'] },
  { title: 'Secret owner/scope/rotation evidence', categories: ['secret_presence', 'secret_owner', 'secret_scope', 'secret_rotation'] },
  { title: 'RBAC and tenant/workspace binding evidence', categories: ['rbac_binding', 'tenant_workspace_binding'] },
];

function toneFor(value: string): Tone {
  if (value.includes('critical') || value.includes('rejected') || value.includes('missing') || value.includes('BLOCKED')) return 'red';
  if (value.includes('expired') || value.includes('provided') || value.includes('WARNING')) return 'amber';
  if (value.includes('verified') || value.includes('READY')) return 'green';
  return 'slate';
}

function reload() {
  window.location.reload();
}

export function ProductionConfigEvidenceCompactWidget({ surface }: { surface: ProductionEvidenceWidgetSurface }) {
  const dashboard = selectProductionConfigEvidenceDashboard();
  return (
    <span
      data-production-config-evidence-widget={surface}
      data-production-config-evidence-verified={dashboard.verified.length}
      data-production-config-evidence-missing={dashboard.missing.length}
      data-production-config-evidence-expired={dashboard.expired.length}
      data-production-config-evidence-resolved={dashboard.resolvedBlockers.length}
      data-production-config-evidence-remaining={dashboard.remainingBlockers.length}
      data-production-config-evidence-score={dashboard.readinessScore}
      data-production-config-evidence-verdict={dashboard.verdict}
      className="sr-only"
    >
      Production evidence {surface}: {dashboard.verified.length} verified, {dashboard.missing.length} missing, {dashboard.expired.length} expired, score {dashboard.readinessScore}, verdict {dashboard.verdict}.
    </span>
  );
}
export function ProductionConfigEvidencePage() {
  const dashboard = selectProductionConfigEvidenceDashboard();
  const artifacts = getProductionConfigEvidenceArtifacts();
  const firstProvided = dashboard.provided[0];
  const firstVerified = dashboard.verified[0];
  const firstReviewable = dashboard.provided[0] ?? dashboard.verified[0];

  return (
    <div data-route="/production-config-evidence" data-production-config-evidence-route>
      <ProductionObservabilityCompactWidget surface="production-config-evidence" />
      <GoLiveControlCompactWidget surface="production-config-evidence" />
      <TenantProductionBindingCompactWidget surface="production-config-evidence" />
      <PageHeader
        title="Production Config Evidence Binder"
        subtitle="Collect, mask, verify, and export production readiness evidence without storing raw secrets."
        actions={(
          <>
            <Button data-action="addEvidence" onClick={() => { addNextMissingDemoEvidence(); reload(); }}>
              <FileCheck2 className="h-4 w-4" />Add evidence
            </Button>
            <Button
              variant="success"
              data-action="verifyEvidence"
              disabled={!firstProvided}
              data-disabled-reason={!firstProvided ? 'No provided evidence is waiting for verification.' : undefined}
              onClick={() => { verifyFirstProvidedEvidence(); reload(); }}
            >
              <ShieldCheck className="h-4 w-4" />Verify evidence
            </Button>
            <Button
              variant="danger"
              data-action="rejectEvidence"
              disabled={!firstReviewable}
              data-disabled-reason={!firstReviewable ? 'No evidence is available for rejection.' : undefined}
              onClick={() => { rejectFirstReviewableEvidence(); reload(); }}
            >
              <XCircle className="h-4 w-4" />Reject evidence
            </Button>
            <Button
              variant="warning"
              data-action="expireEvidence"
              disabled={!firstVerified}
              data-disabled-reason={!firstVerified ? 'No verified evidence can be expired.' : undefined}
              onClick={() => { expireFirstVerifiedEvidence(); reload(); }}
            >
              <RotateCcw className="h-4 w-4" />Expire evidence
            </Button>
            <Button variant="secondary" data-action="clearEvidence" onClick={() => { clearProductionConfigEvidence(); reload(); }}>
              <Trash2 className="h-4 w-4" />Clear evidence
            </Button>
            <Button variant="secondary" data-action="exportEvidencePack" onClick={() => { exportProductionConfigEvidencePack(); reload(); }}>
              <FileText className="h-4 w-4" />Export evidence pack
            </Button>
          </>
        )}
      />

      <div className="grid grid-cols-5 gap-4" data-production-config-evidence-dashboard>
        {[
          { label: 'Verdict', value: dashboard.verdict, tone: toneFor(dashboard.verdict) },
          { label: 'Score', value: `${dashboard.readinessScore}%`, tone: toneFor(dashboard.verdict) },
          { label: 'Verified', value: dashboard.verified.length, tone: dashboard.verified.length ? 'green' : 'amber' },
          { label: 'Missing', value: dashboard.missing.length, tone: dashboard.missing.length ? 'red' : 'green' },
          { label: 'Expired', value: dashboard.expired.length, tone: dashboard.expired.length ? 'amber' : 'green' },
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
        <Panel title="Evidence Dashboard">
          <div className="space-y-4 p-4 text-sm">
            <div className="flex items-center justify-between"><span>Production config evidence readiness</span><Badge tone={toneFor(dashboard.verdict)}>{dashboard.verdict}</Badge></div>
            <ProgressBar value={dashboard.readinessScore} tone={toneFor(dashboard.verdict)} />
            <p className="rounded-xl bg-slate-50 p-3 text-slate-600">Only verified, non-expired evidence can resolve blockers. Raw secrets are masked at ingestion and are not included in exports.</p>
          </div>
        </Panel>

        <Panel title="Missing Evidence">
          <div className="max-h-[260px] space-y-2 overflow-hidden p-4 text-sm">
            {dashboard.missing.map((item) => (
              <div key={item.category} className="flex items-center justify-between rounded-xl bg-red-50 px-3 py-2 text-red-700">
                <span>{item.label}</span>
                <Badge tone="red">{item.severity}</Badge>
              </div>
            ))}
            {!dashboard.missing.length ? <p className="text-green-700">No missing production evidence.</p> : null}
          </div>
        </Panel>

        <Panel title="Evidence Categories">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-400">
                <tr><th className="px-4 py-3">Category</th><th className="px-4 py-3">Related gate</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Masked evidence</th><th className="px-4 py-3">Warnings</th></tr>
              </thead>
              <tbody>
                {dashboard.requirements.map((requirement) => {
                  const records = dashboard.evidence.filter((entry) => entry.category === requirement.category);
                  const record = records[0];
                  const status = getProductionEvidenceStatusForCategory(requirement.category);
                  return (
                    <tr key={requirement.category} data-production-evidence-row={requirement.category} className="border-b border-slate-100 align-top">
                      <td className="px-4 py-3"><b>{requirement.label}</b><p className="mt-1 text-xs text-slate-500">{requirement.category}</p></td>
                      <td className="px-4 py-3 text-slate-600">{requirement.relatedGate}</td>
                      <td className="px-4 py-3"><Badge tone={toneFor(status)}>{status}</Badge></td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{record?.maskedValue ?? 'not provided'}</td>
                      <td className="max-w-[280px] px-4 py-3 text-xs text-slate-500">{record?.warnings.join('; ') || requirement.blockerResolved}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Resolved Blockers">
            <div className="space-y-2 p-4 text-sm">
              {dashboard.resolvedBlockers.map((item) => <p key={item} className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><ShieldCheck className="mr-2 inline h-4 w-4" />{item}</p>)}
              {!dashboard.resolvedBlockers.length ? <p className="text-slate-500">No blockers resolved by verified evidence yet.</p> : null}
            </div>
          </Panel>

          <Panel title="Remaining Blockers">
            <div className="space-y-2 p-4 text-sm">
              {dashboard.remainingBlockers.slice(0, 8).map((item) => <p key={item} className="rounded-xl bg-red-50 p-3 text-red-700"><ShieldAlert className="mr-2 inline h-4 w-4" />{item}</p>)}
              {!dashboard.remainingBlockers.length ? <p className="text-green-700">No evidence blockers remain.</p> : null}
            </div>
          </Panel>

          <Panel title="Expiry Warnings">
            <div className="space-y-2 p-4 text-sm">
              {dashboard.expiryWarnings.map((item) => <p key={item} className="rounded-xl bg-amber-50 p-3 text-amber-700">{item}</p>)}
              {!dashboard.expiryWarnings.length ? <p className="text-slate-500">No expired evidence.</p> : null}
            </div>
          </Panel>
        </div>

        {sectionGroups.map((group) => (
          <Panel key={group.title} title={group.title}>
            <div className="grid grid-cols-2 gap-3 p-4 text-sm">
              {group.categories.map((category) => {
                const status = getProductionEvidenceStatusForCategory(category);
                const record = dashboard.evidence.find((entry) => entry.category === category);
                return (
                  <div key={category} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-start justify-between gap-3"><b>{category}</b><Badge tone={toneFor(status)}>{status}</Badge></div>
                    <p className="mt-2 font-mono text-xs text-slate-500">{record?.maskedValue ?? 'not provided'}</p>
                    <p className="mt-2 text-xs text-slate-600">{record?.description ?? 'Evidence has not been provided.'}</p>
                  </div>
                );
              })}
            </div>
          </Panel>
        ))}

        <Panel title="Export Evidence Pack">
          <div className="space-y-2 p-4 text-sm">
            {artifacts.map((artifact) => <div key={artifact.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"><span>{artifact.name}</span><Badge tone="blue">{artifact.type}</Badge></div>)}
            {!artifacts.length ? <p className="text-slate-500">Export the evidence pack after collecting or verifying evidence.</p> : null}
          </div>
        </Panel>
      </div>

      <span className="sr-only" data-production-config-evidence-summary data-production-config-evidence-score={dashboard.readinessScore}>
        <KeyRound className="h-4 w-4" /> Production config evidence {dashboard.verdict}, score {dashboard.readinessScore}.
      </span>
    </div>
  );
}
