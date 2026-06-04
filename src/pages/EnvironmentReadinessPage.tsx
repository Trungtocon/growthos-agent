import { FileKey2, FileText, RefreshCw, ShieldCheck } from 'lucide-react';
import { Badge, Button, PageHeader, Panel, ProgressBar } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import {
  createEnvironmentReadinessSnapshot,
  evaluateEnvironmentReadiness,
  exportEnvironmentReadinessArtifacts,
  getEnvironmentReadinessArtifacts,
  getEnvironmentReadinessReport,
} from '../runtime/environment-readiness-store';

type EnvironmentReadinessWidgetSurface =
  | 'pre-golive-validation'
  | 'backend-readiness'
  | 'database-readiness'
  | 'auth-readiness'
  | 'production-readiness'
  | 'deployment-config'
  | 'certified-sandbox-run'
  | 'runtime-certification';

function toneFor(value: string): Tone {
  if (value.includes('BLOCKED') || value.includes('blocked') || value.includes('missing')) return 'red';
  if (value.includes('WARNING') || value.includes('warning') || value.includes('NOT_REQUIRED')) return 'amber';
  if (value.includes('READY') || value.includes('PASS')) return 'green';
  return 'slate';
}

function reload() {
  window.location.reload();
}

export function EnvironmentReadinessCompactWidget({ surface }: { surface: EnvironmentReadinessWidgetSurface }) {
  const report = getEnvironmentReadinessReport('PRODUCTION');
  return (
    <span
      data-environment-readiness-widget={surface}
      data-environment-readiness-environment={report.environmentId}
      data-environment-readiness-required={report.variables.filter((entry) => entry.required).length}
      data-environment-readiness-missing={report.missingRequired.length}
      data-environment-readiness-secret-status={report.secretStatus}
      data-environment-readiness-rotation-status={report.rotationStatus.status}
      data-environment-readiness-blockers={report.blockers.length}
      data-environment-readiness-score={report.readinessScore}
      className="sr-only"
    >
      Environment readiness {surface}: {report.status}, {report.missingRequired.length} missing variables, secret {report.secretStatus}, score {report.readinessScore}.
    </span>
  );
}

export function EnvironmentReadinessPage() {
  const report = getEnvironmentReadinessReport('PRODUCTION');
  const artifacts = getEnvironmentReadinessArtifacts();

  return (
    <div data-route="/environment-readiness" data-environment-readiness-route>
      <PageHeader
        title="Environment & Secrets Readiness"
        subtitle="Production environment configuration and secret safety evidence before deployment approval."
        actions={(
          <>
            <Button data-action="check-environment-readiness" onClick={() => { evaluateEnvironmentReadiness('PRODUCTION'); reload(); }}>
              <RefreshCw className="h-4 w-4" />Check readiness
            </Button>
            <Button variant="secondary" data-action="create-environment-snapshot" onClick={() => { createEnvironmentReadinessSnapshot('PRODUCTION'); reload(); }}>
              <ShieldCheck className="h-4 w-4" />Create snapshot
            </Button>
            <Button variant="secondary" data-action="export-environment-readiness" onClick={() => { exportEnvironmentReadinessArtifacts('PRODUCTION'); reload(); }}>
              <FileText className="h-4 w-4" />Export evidence
            </Button>
          </>
        )}
      />

      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Environment', value: report.environmentId, tone: toneFor(report.status) },
          { label: 'Readiness', value: report.status, tone: toneFor(report.status) },
          { label: 'Score', value: `${report.readinessScore}%`, tone: toneFor(report.status) },
          { label: 'Missing env', value: report.missingRequired.length, tone: report.missingRequired.length ? 'red' : 'green' },
          { label: 'Secret safety', value: report.secretStatus, tone: toneFor(report.secretStatus) },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</div>
            <div className="mt-3 flex items-center justify-between gap-3"><b className="truncate text-xl text-slate-950">{item.value}</b><Badge tone={item.tone as Tone}>{item.label}</Badge></div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[1fr_390px] gap-5">
        <Panel title="Production Required Variables">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-400">
                <tr><th className="px-4 py-3">Key</th><th className="px-4 py-3">Group</th><th className="px-4 py-3">Masked value</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Recommendation</th></tr>
              </thead>
              <tbody>
                {report.variables.map((entry) => (
                  <tr key={entry.key} data-environment-variable-row={entry.key} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3"><b>{entry.key}</b><p className="mt-1 text-xs text-slate-500">{entry.description}</p></td>
                    <td className="px-4 py-3 text-slate-600">{entry.group}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{entry.maskedValue}</td>
                    <td className="px-4 py-3"><Badge tone={toneFor(entry.status)}>{entry.status}</Badge></td>
                    <td className="max-w-[280px] px-4 py-3 text-xs text-slate-500">{entry.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Final Readiness Verdict">
            <div className="space-y-4 p-4 text-sm">
              <div className="flex items-center justify-between"><span>Production environment</span><Badge tone={toneFor(report.status)}>{report.status}</Badge></div>
              <ProgressBar value={report.readinessScore} tone={toneFor(report.status)} />
              <p className="rounded-xl bg-slate-50 p-3 text-slate-600">{report.blockers[0] ?? report.warnings[0] ?? 'Production environment and secrets are ready.'}</p>
            </div>
          </Panel>

          <Panel title="Rotation Evidence">
            <div className="space-y-3 p-4 text-sm">
              <div className="flex items-center justify-between"><span>Rotation status</span><Badge tone={toneFor(report.rotationStatus.status)}>{report.rotationStatus.status}</Badge></div>
              <p className="rounded-xl bg-slate-50 p-3 text-slate-600">{report.rotationStatus.reason}</p>
              <p className="text-xs text-slate-500">Last checked: {report.rotationStatus.lastCheckedAt ?? 'not configured'}</p>
            </div>
          </Panel>

          <Panel title="Exports">
            <div className="space-y-2 p-4 text-sm">
              {artifacts.map((artifact) => <div key={artifact.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"><span>{artifact.name}</span><Badge tone="blue">{artifact.type}</Badge></div>)}
              {!artifacts.length ? <p className="text-slate-500">Export evidence to register environment readiness artifacts.</p> : null}
            </div>
          </Panel>
        </div>

        <Panel title="Secret Safety">
          <div className="grid grid-cols-2 gap-3 p-4 text-sm">
            {report.secrets.map((secret) => (
              <div key={secret.key} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-start justify-between gap-3"><b>{secret.category}</b><Badge tone={toneFor(secret.status)}>{secret.status}</Badge></div>
                <p className="mt-2 font-mono text-xs text-slate-500">{secret.key}: {secret.maskedValue}</p>
                <p className="mt-2 text-xs text-slate-600">{secret.reason}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Missing Config & Blockers">
          <div className="space-y-2 p-4 text-sm">
            {report.blockers.slice(0, 14).map((item) => <p key={item} className="rounded-xl bg-red-50 p-3 text-red-700"><FileKey2 className="mr-2 inline h-4 w-4" />{item}</p>)}
            {!report.blockers.length ? <p className="text-green-700">No production environment blockers.</p> : null}
          </div>
        </Panel>

        <Panel title="Warnings">
          <div className="space-y-2 p-4 text-sm">
            {report.warnings.map((item) => <p key={item} className="rounded-xl bg-amber-50 p-3 text-amber-700">{item}</p>)}
            {!report.warnings.length ? <p className="text-slate-500">No environment warnings.</p> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
