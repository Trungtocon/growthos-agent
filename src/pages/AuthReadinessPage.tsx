import { FileText, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import { Badge, Button, PageHeader, Panel, ProgressBar } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import {
  createAuthReadinessSnapshot,
  evaluateAuthReadiness,
  exportAuthReadinessArtifacts,
  getAuthReadinessArtifacts,
  getAuthReadinessReport,
} from '../runtime/auth-readiness-store';
import { getAuthProviderRequiredEnvKeys } from '../runtime/auth-provider';
import { EnvironmentReadinessCompactWidget } from './EnvironmentReadinessPage';

type AuthReadinessWidgetSurface =
  | 'pre-golive-validation'
  | 'backend-readiness'
  | 'database-readiness'
  | 'production-readiness'
  | 'deployment-config'
  | 'certified-sandbox-run'
  | 'run';

function toneFor(value: string): Tone {
  if (value.includes('BLOCKED') || value.includes('blocked') || value.includes('missing')) return 'red';
  if (value.includes('WARNING') || value.includes('warning') || value.includes('local_mock')) return 'amber';
  if (value.includes('READY') || value.includes('ready') || value.includes('valid')) return 'green';
  return 'slate';
}

function reload() {
  window.location.reload();
}

export function AuthReadinessCompactWidget({ surface }: { surface: AuthReadinessWidgetSurface }) {
  const report = getAuthReadinessReport('PRODUCTION');
  return (
    <span
      data-auth-readiness-widget={surface}
      data-auth-readiness-widget-status={report.status}
      data-auth-readiness-widget-score={report.readinessScore}
      data-auth-readiness-widget-blockers={report.blockers.length}
      className="sr-only"
    >
      Auth readiness {surface}: {report.status}, score {report.readinessScore}, {report.blockers.length} blockers.
    </span>
  );
}

export function AuthReadinessPage() {
  const report = getAuthReadinessReport('PRODUCTION');
  const artifacts = getAuthReadinessArtifacts();
  const providerKeys = getAuthProviderRequiredEnvKeys('PRODUCTION');
  const checks = [
    report.sessionLifecycle,
    report.tokenValidation,
    report.rbacBinding,
    report.tenantWorkspaceBinding,
  ];

  return (
    <div data-route="/auth-readiness" data-auth-readiness-route>
      <EnvironmentReadinessCompactWidget surface="auth-readiness" />
      <PageHeader
        title="Auth & Session Readiness"
        subtitle="Production auth, token validation, RBAC, and tenant/workspace binding checks before go-live."
        actions={(
          <>
            <Button data-action="check-auth-readiness" onClick={() => { evaluateAuthReadiness('PRODUCTION'); reload(); }}>
              <RefreshCw className="h-4 w-4" />Check auth readiness
            </Button>
            <Button variant="secondary" data-action="create-auth-snapshot" onClick={() => { createAuthReadinessSnapshot('PRODUCTION'); reload(); }}>
              <ShieldCheck className="h-4 w-4" />Create snapshot
            </Button>
            <Button variant="secondary" data-action="export-auth-readiness" onClick={() => { exportAuthReadinessArtifacts('PRODUCTION'); reload(); }}>
              <FileText className="h-4 w-4" />Export auth pack
            </Button>
          </>
        )}
      />

      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Readiness', value: report.status, tone: toneFor(report.status) },
          { label: 'Score', value: `${report.readinessScore}%`, tone: toneFor(report.status) },
          { label: 'Provider', value: report.provider.label, tone: toneFor(report.provider.status) },
          { label: 'Session', value: report.sessionLifecycle.lifecycleStatus, tone: toneFor(report.sessionLifecycle.status) },
          { label: 'Blockers', value: report.blockers.length, tone: report.blockers.length ? 'red' : 'green' },
        ].map((item) => (
          <div key={item.label} data-auth-readiness-card={item.label.toLowerCase()} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <b className="truncate text-xl text-slate-950">{item.value}</b>
              <Badge tone={item.tone as Tone}>{item.label}</Badge>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[1fr_390px] gap-5">
        <Panel title="Readiness Matrix">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-400">
                <tr><th className="px-4 py-3">Check</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Required env</th></tr>
              </thead>
              <tbody>
                {checks.map((check) => (
                  <tr key={check.id} data-auth-check={check.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3"><b>{check.label}</b></td>
                    <td className="px-4 py-3"><Badge tone={toneFor(check.status)}>{check.status}</Badge></td>
                    <td className="max-w-[420px] px-4 py-3 text-slate-600">{check.reason}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{check.requiredEnv.join(', ') || 'none'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Provider">
            <div className="space-y-3 p-4 text-sm">
              <div className="flex items-center justify-between gap-3"><span>{report.provider.label}</span><Badge tone={toneFor(report.provider.status)}>{report.provider.status}</Badge></div>
              <p className="rounded-xl bg-slate-50 p-3 text-slate-600">{report.provider.reason}</p>
              <div className="rounded-xl border border-slate-100 p-3 text-xs text-slate-500">
                <KeyRound className="mr-2 inline h-4 w-4" />Required keys: {providerKeys.join(', ') || 'none'}
              </div>
            </div>
          </Panel>

          <Panel title="Readiness Score">
            <div className="space-y-4 p-4 text-sm">
              <div className="flex items-center justify-between"><span>Production auth gate</span><Badge tone={toneFor(report.status)}>{report.status}</Badge></div>
              <ProgressBar value={report.readinessScore} tone={toneFor(report.status)} />
              <p className="rounded-xl bg-slate-50 p-3 text-slate-600">{report.blockers[0] ?? report.warnings[0] ?? 'Production auth readiness is clear.'}</p>
            </div>
          </Panel>

          <Panel title="Exports">
            <div className="space-y-2 p-4 text-sm">
              {artifacts.map((artifact) => (
                <div key={artifact.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                  <span>{artifact.name}</span><Badge tone="blue">{artifact.type}</Badge>
                </div>
              ))}
              {!artifacts.length ? <p className="text-slate-500">Export the auth pack to register readiness artifacts.</p> : null}
            </div>
          </Panel>
        </div>

        <Panel title="Blockers">
          <div className="space-y-2 p-4 text-sm">
            {report.blockers.map((item) => <p key={item} className="rounded-xl bg-red-50 p-3 text-red-700">{item}</p>)}
            {!report.blockers.length ? <p className="text-green-700">No auth blockers.</p> : null}
          </div>
        </Panel>

        <Panel title="Warnings">
          <div className="space-y-2 p-4 text-sm">
            {report.warnings.map((item) => <p key={item} className="rounded-xl bg-amber-50 p-3 text-amber-700">{item}</p>)}
            {!report.warnings.length ? <p className="text-slate-500">No auth warnings.</p> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
