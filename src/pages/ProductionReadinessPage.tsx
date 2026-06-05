import { CheckCircle2, FileText, Rocket, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { Badge, Button, PageHeader, Panel, ProgressBar } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import { selectDeploymentReadiness, selectProductionReadinessDashboard } from '../domain/selectors';
import {
  approveProductionGoLive,
  createProductionReadinessCheck,
  evaluateProductionReadiness,
  exportProductionReadinessArtifacts,
  rejectProductionGoLive,
} from '../runtime/production-readiness-store';
import { BackendAdapterCompactWidget } from './BackendAdapterPage';
import { ApiContractsCompactWidget } from './ApiContractsPage';
import { DeploymentConfigCompactWidget } from './DeploymentConfigPage';
import { E2EActionFlowCompactWidget } from './E2EActionFlowPage';
import { PreGoLiveValidationCompactWidget } from './PreGoLiveValidationPage';
import { DatabaseReadinessCompactWidget } from './DatabaseReadinessPage';
import { AuthReadinessCompactWidget } from './AuthReadinessPage';
import { EnvironmentReadinessCompactWidget } from './EnvironmentReadinessPage';
import { GoLiveControlCompactWidget } from './GoLiveControlPage';
import { ProductionConfigEvidenceCompactWidget } from './ProductionConfigEvidencePage';
import { ProductionIncidentCompactWidget } from './ProductionIncidentPage';
import { ProductionObservabilityCompactWidget } from './ProductionObservabilityPage';
import { ProductionRunbookCompactWidget } from './ProductionRunbookPage';
import { ProductionSupportCompactWidget } from './ProductionSupportPage';

type ProductionReadinessWidgetSurface =
  | 'certified-sandbox-run'
  | 'runtime-certification'
  | 'chaos'
  | 'worker-recovery'
  | 'evaluation'
  | 'run';

function toneFor(value: string): Tone {
  if (value.includes('BLOCKED') || value.includes('rejected')) return 'red';
  if (value.includes('WARNING') || value.includes('NEEDS_REVIEW') || value.includes('not_requested')) return 'amber';
  if (value.includes('READY') || value.includes('approved')) return 'green';
  return 'slate';
}

function reload() {
  window.location.reload();
}

function readinessScore() {
  const dashboard = selectProductionReadinessDashboard();
  if (!dashboard.checklist.length) return 0;
  const ready = dashboard.checklist.filter((item) => item.status === 'READY').length;
  return Math.round((ready / dashboard.checklist.length) * 100);
}

export function ProductionReadinessCompactWidget({ surface }: { surface: ProductionReadinessWidgetSurface }) {
  const dashboard = selectProductionReadinessDashboard();
  return (
    <span
      data-production-readiness-widget={surface}
      data-production-readiness-status={dashboard.status}
      data-production-readiness-blockers={dashboard.blockers.length}
      data-production-readiness-warnings={dashboard.warnings.length}
      className="sr-only"
    >
      Production readiness {surface}: {dashboard.status}, {dashboard.blockers.length} blockers, {dashboard.warnings.length} warnings.
    </span>
  );
}

export function ProductionReadinessPage() {
  const dashboard = selectProductionReadinessDashboard();
  const deploymentReadiness = selectDeploymentReadiness();
  const activeCheck = dashboard.activeCheck;
  const score = readinessScore();
  const canApprove = Boolean(activeCheck && dashboard.blockers.length === 0 && deploymentReadiness.productionReady && activeCheck.approvalStatus !== 'approved');

  return (
    <div data-route="/production-readiness" data-production-readiness-route>
      <ProductionSupportCompactWidget surface="production-readiness" />
      <ProductionIncidentCompactWidget surface="production-readiness" />
      <DeploymentConfigCompactWidget surface="production-readiness" />
      <BackendAdapterCompactWidget surface="production-readiness" />
      <ApiContractsCompactWidget surface="production-readiness" />
      <E2EActionFlowCompactWidget surface="production-readiness" />
      <PreGoLiveValidationCompactWidget surface="production-readiness" />
      <AuthReadinessCompactWidget surface="production-readiness" />
      <DatabaseReadinessCompactWidget surface="production-readiness" />
      <EnvironmentReadinessCompactWidget surface="production-readiness" />
      <ProductionConfigEvidenceCompactWidget surface="production-readiness" />
      <ProductionObservabilityCompactWidget surface="production-readiness" />
      <ProductionRunbookCompactWidget surface="production-readiness" />
      <GoLiveControlCompactWidget surface="production-readiness" />
      <PageHeader
        title="Production Go-Live Readiness"
        subtitle="Final gate for certified sandbox evidence, governance, recovery, chaos, cost, quota, and UI action wiring before production enablement."
        actions={(
          <>
            <Button variant="secondary" onClick={() => { createProductionReadinessCheck(); reload(); }}><Rocket className="h-4 w-4" />Create check</Button>
            <Button variant="secondary" disabled={!activeCheck} data-disabled-reason={!activeCheck ? 'Create a production readiness check before evaluation.' : undefined} title={!activeCheck ? 'Create a production readiness check before evaluation.' : undefined} onClick={() => { if (activeCheck) evaluateProductionReadiness(activeCheck.id); reload(); }}><ShieldCheck className="h-4 w-4" />Evaluate</Button>
            <Button variant="secondary" disabled={!activeCheck} data-disabled-reason={!activeCheck ? 'Create a production readiness check before exporting.' : undefined} title={!activeCheck ? 'Create a production readiness check before exporting.' : undefined} onClick={() => { if (activeCheck) exportProductionReadinessArtifacts(activeCheck.id); reload(); }}><FileText className="h-4 w-4" />Export</Button>
            <Button disabled={!canApprove} data-disabled-reason={!canApprove ? 'Go-live approval requires zero readiness blockers and deployment config READY.' : undefined} title={!canApprove ? 'Go-live approval requires zero readiness blockers and deployment config READY.' : undefined} onClick={() => { if (activeCheck) approveProductionGoLive(activeCheck.id); reload(); }}><CheckCircle2 className="h-4 w-4" />Approve Go-Live</Button>
            <Button variant="danger" disabled={!activeCheck} data-disabled-reason={!activeCheck ? 'Create a production readiness check before rejecting.' : undefined} title={!activeCheck ? 'Create a production readiness check before rejecting.' : undefined} onClick={() => { if (activeCheck) rejectProductionGoLive(activeCheck.id, 'Rejected from production readiness page.'); reload(); }}><XCircle className="h-4 w-4" />Reject Go-Live</Button>
          </>
        )}
      />

      <div className="grid grid-cols-5 gap-4" data-production-readiness-summary>
        {[
          { label: 'Go-Live status', value: dashboard.status, tone: toneFor(dashboard.status) },
          { label: 'Blockers', value: dashboard.blockers.length, tone: dashboard.blockers.length ? 'red' : 'green' },
          { label: 'Warnings', value: dashboard.warnings.length, tone: dashboard.warnings.length ? 'amber' : 'green' },
          { label: 'Checklist', value: `${dashboard.checklist.filter((item) => item.status === 'READY').length}/${dashboard.checklist.length}`, tone: score >= 90 ? 'green' : score >= 60 ? 'amber' : 'red' },
          { label: 'Approval', value: activeCheck?.approvalStatus ?? 'not_requested', tone: toneFor(activeCheck?.approvalStatus ?? 'not_requested') },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</div>
            <div className="mt-3 flex items-center justify-between gap-3"><b className="truncate text-2xl text-slate-950">{item.value}</b><Badge tone={item.tone as Tone}>{item.label}</Badge></div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[390px_1fr_420px] gap-5">
        <Panel title="Overall Go-Live Status">
          <div className="space-y-3 p-4 text-sm" data-production-overall-status>
            <div className="flex items-center justify-between"><span>Status</span><Badge tone={toneFor(dashboard.status)}>{dashboard.status}</Badge></div>
            <div className="flex items-center justify-between"><span>Check</span><b className="truncate">{activeCheck?.id ?? 'none'}</b></div>
            <div className="flex items-center justify-between"><span>Certified sandbox</span><b className="truncate">{dashboard.lastCertifiedSandboxRunId ?? 'missing'}</b></div>
            <div className="flex items-center justify-between"><span>Runtime certification</span><b className="truncate">{dashboard.lastRuntimeCertificationRunId ?? 'missing'}</b></div>
            <ProgressBar value={score} label="Production readiness checklist completion" />
            {dashboard.status === 'BLOCKED' ? <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-red-700"><ShieldAlert className="mr-2 inline h-4 w-4" />Production go-live is blocked until all blockers are resolved.</div> : null}
          </div>
        </Panel>

        <Panel title="Required Checklist">
          <div className="grid grid-cols-2 gap-3 p-4 text-sm" data-production-checklist>
            {dashboard.checklist.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-start justify-between gap-3"><b>{entry.label}</b><Badge tone={toneFor(entry.status)}>{entry.status}</Badge></div>
                <p className="mt-2 text-slate-500">{entry.reason}</p>
                <p className="mt-2 text-xs font-semibold text-slate-400">{entry.recommendedFix}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Blockers">
          <div className="max-h-[460px] space-y-3 overflow-hidden p-4 text-sm" data-production-blockers>
            {dashboard.blockers.map((blocker) => (
              <div key={blocker.id} className="rounded-xl border border-red-100 bg-red-50 p-3 text-red-700">
                <div className="flex items-start justify-between gap-3"><b>{blocker.code}</b><Badge tone="red">{blocker.category}</Badge></div>
                <p className="mt-2">{blocker.reason}</p>
                <p className="mt-2 text-xs font-semibold">{blocker.recommendedFix}</p>
              </div>
            ))}
            {!dashboard.blockers.length ? <p className="text-slate-500">No blocking go-live findings for the active check.</p> : null}
          </div>
        </Panel>

        <Panel title="Warnings">
          <div className="space-y-3 p-4 text-sm" data-production-warnings>
            {dashboard.warnings.slice(0, 8).map((warning) => (
              <div key={warning.id} className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-amber-700">
                <b>{warning.category}</b>
                <p className="mt-1">{warning.reason}</p>
                <p className="mt-2 text-xs font-semibold">{warning.recommendedFix}</p>
              </div>
            ))}
            {!dashboard.warnings.length ? <p className="text-slate-500">No review warnings for the active check.</p> : null}
          </div>
        </Panel>

        <Panel title="Chaos & Recovery Summary">
          <div className="space-y-3 p-4 text-sm" data-production-chaos-recovery>
            <div className="rounded-xl bg-slate-50 p-3"><b>Chaos</b><p className="mt-1 text-slate-600">{dashboard.chaosRecoverySummary}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><b>Worker recovery</b><p className="mt-1 text-slate-600">{dashboard.workerRecoverySummary}</p></div>
          </div>
        </Panel>

        <Panel title="Cost / Quota / Approval">
          <div className="space-y-3 p-4 text-sm" data-production-cost-quota-approval>
            <div className="rounded-xl bg-slate-50 p-3"><b>Cost & quota</b><p className="mt-1 text-slate-600">{dashboard.costQuotaSummary}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><b>Approval</b><p className="mt-1 text-slate-600">{dashboard.approvalSummary}</p></div>
          </div>
        </Panel>

        <Panel title="Exported Go-Live Artifacts">
          <div className="space-y-2 p-4 text-sm" data-production-artifacts>
            {dashboard.artifacts.map((artifact) => <div key={artifact.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><span>{artifact.name}</span><Badge tone="blue">{artifact.type}</Badge></div>)}
            {!dashboard.artifacts.length ? <p className="text-slate-500">Production readiness artifacts appear after export.</p> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
