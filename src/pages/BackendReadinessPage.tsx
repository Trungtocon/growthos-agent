import { FileText, RefreshCw, ServerCog, ShieldCheck } from 'lucide-react';
import { Badge, Button, PageHeader, Panel, ProgressBar } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import { createApiClient } from '../runtime/api-client-factory';
import {
  checkBackendReadiness,
  exportBackendReadinessArtifacts,
  getBackendReadinessArtifacts,
  getBackendReadinessReport,
} from '../runtime/backend-health';
import { getEnvironmentRegistry, setActiveEnvironment, type RuntimeEnvironmentId } from '../runtime/environment-registry';
import { getEndpointRegistry } from '../runtime/endpoint-registry';
import { AuthReadinessCompactWidget } from './AuthReadinessPage';
import { DatabaseReadinessCompactWidget } from './DatabaseReadinessPage';
import { EnvironmentReadinessCompactWidget } from './EnvironmentReadinessPage';
import { ProductionConfigEvidenceCompactWidget } from './ProductionConfigEvidencePage';

function toneFor(value: string): Tone {
  if (value.includes('missing') || value.includes('offline') || value.includes('blocked')) return 'red';
  if (value.includes('degraded') || value.includes('warning')) return 'amber';
  if (value.includes('online') || value.includes('valid') || value.includes('ready')) return 'green';
  return 'blue';
}

function reload() {
  window.location.reload();
}

export function BackendReadinessPage() {
  const environments = getEnvironmentRegistry();
  const report = getBackendReadinessReport('PRODUCTION');
  const endpoints = report.endpointReachability.length ? report.endpointReachability : getEndpointRegistry().map((endpoint) => ({ ...endpoint, reachable: false, reason: 'Not checked.' }));
  const artifacts = getBackendReadinessArtifacts();
  const clientDescriptions = environments.map((environment) => createApiClient(environment.id).describe());

  return (
    <div data-route="/backend-readiness" data-backend-readiness-route>
      <AuthReadinessCompactWidget surface="backend-readiness" />
      <DatabaseReadinessCompactWidget surface="backend-readiness" />
      <EnvironmentReadinessCompactWidget surface="backend-readiness" />
      <ProductionConfigEvidenceCompactWidget surface="backend-readiness" />
      <PageHeader
        title="Backend Readiness"
        subtitle="Environment registry, auth provider, endpoint matrix, and health evidence for real backend capable execution."
        actions={(
          <>
            <Button data-action="check-backend-health" onClick={() => { checkBackendReadiness('PRODUCTION'); reload(); }}>
              <RefreshCw className="h-4 w-4" />Check production health
            </Button>
            <Button variant="secondary" data-action="export-backend-readiness" onClick={() => { exportBackendReadinessArtifacts('PRODUCTION'); reload(); }}>
              <FileText className="h-4 w-4" />Export readiness
            </Button>
          </>
        )}
      />

      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Environment', value: report.environment.id, tone: toneFor(report.environment.status) },
          { label: 'Health', value: report.status, tone: toneFor(report.status) },
          { label: 'Auth', value: report.auth.status, tone: toneFor(report.auth.status) },
          { label: 'Latency', value: `${report.latencyMs}ms`, tone: report.latencyMs ? 'green' : 'amber' },
          { label: 'Score', value: `${report.readinessScore}%`, tone: toneFor(report.status) },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</div>
            <div className="mt-3 flex items-center justify-between gap-3"><b className="text-xl text-slate-950">{item.value}</b><Badge tone={item.tone as Tone}>{item.label}</Badge></div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[1fr_380px] gap-5">
        <Panel title="Environment Registry">
          <div className="grid grid-cols-4 gap-3 p-4 text-sm">
            {environments.map((environment) => (
              <button
                key={environment.id}
                type="button"
                data-action="select-backend-environment"
                onClick={() => { setActiveEnvironment(environment.id); checkBackendReadiness(environment.id); reload(); }}
                className="rounded-xl border border-slate-100 p-4 text-left transition hover:border-brand-200"
              >
                <div className="flex items-center justify-between gap-3"><b>{environment.name}</b><Badge tone={toneFor(environment.status)}>{environment.status}</Badge></div>
                <p className="mt-2 text-xs text-slate-500">{environment.baseUrl || 'Base URL missing'}</p>
                <p className="mt-1 text-xs text-slate-400">{environment.authMode}</p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Readiness Score">
          <div className="space-y-4 p-4 text-sm">
            <div className="flex items-center justify-between"><span>Production backend</span><Badge tone={toneFor(report.status)}>{report.status}</Badge></div>
            <ProgressBar value={report.readinessScore} tone={toneFor(report.status)} />
            <p className="rounded-xl bg-slate-50 p-3 text-slate-600">{report.blockers[0] ?? report.warnings[0] ?? 'Backend integration layer is ready.'}</p>
          </div>
        </Panel>

        <Panel title="Endpoint Matrix">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-400">
                <tr><th className="px-4 py-3">Endpoint</th><th className="px-4 py-3">Method</th><th className="px-4 py-3">Version</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Status</th></tr>
              </thead>
              <tbody>
                {endpoints.map((endpoint) => (
                  <tr key={endpoint.id} data-backend-endpoint-row={endpoint.id} className="border-b border-slate-100">
                    <td className="px-4 py-3"><b>{endpoint.id}</b><p className="text-xs text-slate-500">{endpoint.path}</p></td>
                    <td className="px-4 py-3">{endpoint.method}</td>
                    <td className="px-4 py-3">{endpoint.version}</td>
                    <td className="px-4 py-3">{endpoint.owner}</td>
                    <td className="px-4 py-3"><Badge tone={endpoint.reachable ? 'green' : 'red'}>{endpoint.reachable ? 'reachable' : 'missing_config'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Auth Provider">
            <div className="space-y-3 p-4 text-sm">
              <div className="flex items-center justify-between"><span>{report.auth.label}</span><Badge tone={toneFor(report.auth.status)}>{report.auth.status}</Badge></div>
              <p className="rounded-xl bg-slate-50 p-3 text-slate-600">{report.auth.reason}</p>
            </div>
          </Panel>

          <Panel title="API Client Factory">
            <div className="space-y-2 p-4 text-sm">
              {clientDescriptions.map((client) => (
                <div key={client.environmentId} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <span>{client.environmentId}</span><Badge tone={client.baseUrlConfigured ? 'green' : 'amber'}>{client.mode}</Badge>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Exports">
            <div className="space-y-2 p-4 text-sm">
              {artifacts.map((artifact) => <div key={artifact.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><span>{artifact.name}</span><Badge tone="blue">{artifact.type}</Badge></div>)}
              {!artifacts.length ? <p className="text-slate-500">Export backend readiness to register report artifacts.</p> : null}
            </div>
          </Panel>
        </div>
      </div>

      <span className="sr-only" data-backend-readiness-summary data-backend-readiness-score={report.readinessScore}>
        Backend readiness {report.status}, score {report.readinessScore}. <ServerCog className="h-4 w-4" /> <ShieldCheck className="h-4 w-4" />
      </span>
    </div>
  );
}
