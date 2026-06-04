import { CheckCircle2, FileText, RefreshCw, Rocket, RotateCcw, ServerCog, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { Badge, Button, PageHeader, Panel, ProgressBar } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import {
  selectDeploymentArtifacts,
  selectDeploymentBlockers,
  selectDeploymentConfigDashboard,
  selectDeploymentConfigStatus,
  selectDeploymentEnvGroups,
  selectDeploymentMissingEnv,
  selectDeploymentReadiness,
  selectDeploymentWarnings,
} from '../domain/selectors';
import type { DeploymentRuntimeMode } from '../runtime/deployment-config';
import {
  blockDeploymentConfig,
  createDeploymentConfigCheck,
  exportDeploymentConfigArtifacts,
  markDeploymentConfigReady,
  recheckDeploymentEndpointHealth,
  resetDeploymentConfigCheck,
  validateDeploymentConfig,
} from '../runtime/deployment-config-store';
import { ApiContractsCompactWidget } from './ApiContractsPage';
import { BackendAdapterCompactWidget } from './BackendAdapterPage';
import { DatabaseReadinessCompactWidget } from './DatabaseReadinessPage';
import { E2EActionFlowCompactWidget } from './E2EActionFlowPage';
import { PreGoLiveValidationCompactWidget } from './PreGoLiveValidationPage';

type DeploymentWidgetSurface =
  | 'production-readiness'
  | 'runtime-certification'
  | 'certified-sandbox-run'
  | 'worker-control'
  | 'chaos'
  | 'evaluation'
  | 'run';

function toneFor(value: string): Tone {
  if (value.includes('blocked') || value.includes('missing') || value.includes('invalid') || value.includes('offline')) return 'red';
  if (value.includes('warning') || value.includes('degraded') || value.includes('not_checked')) return 'amber';
  if (value.includes('valid') || value.includes('online') || value.includes('ready')) return 'green';
  if (value.includes('sandbox') || value.includes('production')) return 'blue';
  return 'slate';
}

function reload() {
  window.location.reload();
}

function statusScore(status: string) {
  if (status === 'valid') return 100;
  if (status === 'warning') return 72;
  if (status === 'blocked') return 28;
  return 10;
}

function modeEnv(mode: DeploymentRuntimeMode): Record<string, string> {
  if (mode === 'sandbox') {
    return {
      APP_ENV: 'staging',
      APP_BASE_URL: 'https://growthos.local',
      HERMES_RUNTIME_MODE: 'sandbox',
      HERMES_SANDBOX_BASE_URL: 'https://sandbox.hermes.local',
      HERMES_SANDBOX_API_KEY: 'present',
      HERMES_SANDBOX_WORKSPACE_ID: 'workspace-demo',
      PAPERCLIP_BASE_URL: 'https://paperclip.local',
      PAPERCLIP_API_KEY: 'present',
      GROWTHOS_WORKSPACE_ID: 'workspace-demo',
      STORAGE_DRIVER: 'session',
      LOG_LEVEL: 'info',
      DEPLOYMENT_TARGET: 'vercel-preview',
    };
  }
  if (mode === 'production') {
    return {
      APP_ENV: 'production',
      APP_BASE_URL: 'https://growthos.example.com',
      HERMES_RUNTIME_MODE: 'production',
      HERMES_PRODUCTION_BASE_URL: 'https://hermes.example.com',
      HERMES_PRODUCTION_API_KEY: 'present',
      PAPERCLIP_BASE_URL: 'https://paperclip.example.com',
      PAPERCLIP_API_KEY: 'present',
      GROWTHOS_WORKSPACE_ID: 'workspace-demo',
      AUTH_SECRET: 'present',
      STORAGE_DRIVER: 's3',
      LOG_LEVEL: 'info',
      BILLING_PROVIDER: 'stripe',
      DEPLOYMENT_TARGET: 'vercel-production',
    };
  }
  return { APP_ENV: 'development', HERMES_RUNTIME_MODE: 'mock', LOG_LEVEL: 'info' };
}

export function DeploymentConfigCompactWidget({ surface }: { surface: DeploymentWidgetSurface }) {
  const status = selectDeploymentConfigStatus();
  const readiness = selectDeploymentReadiness();
  const blockers = selectDeploymentBlockers();
  return (
    <span
      data-deployment-config-widget={surface}
      data-deployment-config-widget-status={status}
      data-deployment-config-widget-blockers={blockers.length}
      data-deployment-config-widget-production-ready={readiness.productionReady}
      className="sr-only"
    >
      Deployment config {surface}: {status}, {blockers.length} blockers, production ready {String(readiness.productionReady)}.
    </span>
  );
}

export function DeploymentConfigPage() {
  const dashboard = selectDeploymentConfigDashboard();
  const active = dashboard.activeConfig;
  const envGroups = selectDeploymentEnvGroups();
  const missing = selectDeploymentMissingEnv();
  const warnings = selectDeploymentWarnings();
  const blockers = selectDeploymentBlockers();
  const readiness = selectDeploymentReadiness();
  const artifacts = selectDeploymentArtifacts();
  const status = selectDeploymentConfigStatus();
  const score = statusScore(status);
  const canMarkReady = Boolean(active && !blockers.length);

  const createMode = (runtimeMode: DeploymentRuntimeMode) => {
    createDeploymentConfigCheck({ runtimeMode, env: modeEnv(runtimeMode) });
    reload();
  };

  return (
    <div data-route="/deployment-config" data-deployment-config-route>
      <BackendAdapterCompactWidget surface="deployment-config" />
      <ApiContractsCompactWidget surface="deployment-config" />
      <E2EActionFlowCompactWidget surface="deployment-config" />
      <PreGoLiveValidationCompactWidget surface="deployment-config" />
      <DatabaseReadinessCompactWidget surface="deployment-config" />
      <PageHeader
        title="Environment & Deployment Configuration"
        subtitle="Prepare runtime mode, environment variables, endpoint health, security checks, and production readiness dependencies before real go-live."
        actions={(
          <>
            <Button variant="secondary" onClick={() => { validateDeploymentConfig(active?.id); reload(); }}><ShieldCheck className="h-4 w-4" />Validate config</Button>
            <Button variant="secondary" onClick={() => { recheckDeploymentEndpointHealth(active?.id); reload(); }}><RefreshCw className="h-4 w-4" />Re-check endpoint health</Button>
            <Button variant="secondary" disabled={!active} data-disabled-reason={!active ? 'Create a deployment config before exporting.' : undefined} title={!active ? 'Create a deployment config before exporting.' : undefined} onClick={() => { if (active) exportDeploymentConfigArtifacts(active.id); reload(); }}><FileText className="h-4 w-4" />Export config report</Button>
            <Button disabled={!canMarkReady} data-disabled-reason={!canMarkReady ? 'Resolve deployment blockers before marking config ready.' : undefined} title={!canMarkReady ? 'Resolve deployment blockers before marking config ready.' : undefined} onClick={() => { if (active) markDeploymentConfigReady(active.id); reload(); }}><CheckCircle2 className="h-4 w-4" />Mark config ready</Button>
            <Button variant="danger" disabled={!active} data-disabled-reason={!active ? 'Create a deployment config before blocking it.' : undefined} title={!active ? 'Create a deployment config before blocking it.' : undefined} onClick={() => { if (active) blockDeploymentConfig(active.id); reload(); }}><XCircle className="h-4 w-4" />Block config</Button>
            <Button variant="secondary" onClick={() => { resetDeploymentConfigCheck('mock'); reload(); }}><RotateCcw className="h-4 w-4" />Reset check</Button>
          </>
        )}
      />

      <div className="grid grid-cols-5 gap-4" data-deployment-config-status>
        {[
          { label: 'Status', value: status, tone: toneFor(status) },
          { label: 'Runtime mode', value: active?.runtimeMode ?? 'none', tone: toneFor(active?.runtimeMode ?? 'not_checked') },
          { label: 'Missing env', value: missing.length, tone: missing.length ? 'red' : 'green' },
          { label: 'Blockers', value: blockers.length, tone: blockers.length ? 'red' : 'green' },
          { label: 'Artifacts', value: artifacts.length, tone: 'slate' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</div>
            <div className="mt-3 flex items-center justify-between gap-3"><b className="truncate text-2xl text-slate-950">{item.value}</b><Badge tone={item.tone as Tone}>{item.label}</Badge></div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[360px_1fr_420px] gap-5">
        <Panel title="Step 1: Runtime mode">
          <div className="space-y-3 p-4 text-sm" data-deployment-config-step="runtime-mode">
            {(['mock', 'sandbox', 'production'] as DeploymentRuntimeMode[]).map((mode) => (
              <button key={mode} type="button" onClick={() => createMode(mode)} className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-white p-3 text-left hover:border-blue-200">
                <span><b className="capitalize">{mode}</b><span className="block text-xs text-slate-500">{mode === 'production' ? 'Requires certification, readiness, production endpoint and secrets.' : mode === 'sandbox' ? 'Validates sandbox endpoint and keeps production in warning state.' : 'Local mock fallback only.'}</span></span>
                <Badge tone={active?.runtimeMode === mode ? 'blue' : 'slate'}>{active?.runtimeMode === mode ? 'selected' : 'choose'}</Badge>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Step 2: Environment variables">
          <div className="grid max-h-[520px] grid-cols-2 gap-3 overflow-hidden p-4 text-sm" data-deployment-config-step="environment-variables">
            {envGroups.map((group) => (
              <div key={group.group} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-start justify-between gap-3"><b>{group.label}</b><Badge tone={toneFor(group.status)}>{group.status}</Badge></div>
                <div className="mt-3 space-y-1">
                  {group.keys.map((entry) => (
                    <div key={entry.key} className="flex items-center justify-between gap-3 text-xs">
                      <span className={entry.required ? 'font-semibold text-slate-700' : 'text-slate-500'}>{entry.key}</span>
                      <Badge tone={toneFor(entry.status)}>{entry.status}</Badge>
                    </div>
                  ))}
                  {!group.keys.length ? <p className="text-xs text-slate-400">No explicit keys required for this group yet.</p> : null}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Step 3: Endpoint health">
          <div className="space-y-3 p-4 text-sm" data-deployment-config-step="endpoint-health">
            {active ? Object.entries(active.endpointHealth).filter(([key]) => key !== 'checkedAt').map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><span className="capitalize">{key}</span><Badge tone={toneFor(String(value))}>{String(value)}</Badge></div>
            )) : <p className="text-slate-500">Create a config before checking endpoint health.</p>}
            <p className="text-xs text-slate-400">Last check: {active?.endpointHealth.checkedAt ? new Date(active.endpointHealth.checkedAt).toLocaleString() : 'not checked'}</p>
          </div>
        </Panel>

        <Panel title="Step 4: Security checks">
          <div className="space-y-3 p-4 text-sm" data-deployment-config-step="security-checks">
            {[
              { label: 'APP_ENV production', ready: active?.env.APP_ENV === 'production' || active?.runtimeMode !== 'production' },
              { label: 'Production API key present', ready: active?.runtimeMode !== 'production' || Boolean(active?.env.HERMES_PRODUCTION_API_KEY) },
              { label: 'Auth secret present', ready: active?.runtimeMode !== 'production' || Boolean(active?.env.AUTH_SECRET) },
              { label: 'Billing provider present', ready: active?.runtimeMode !== 'production' || Boolean(active?.env.BILLING_PROVIDER) },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><span>{item.label}</span><Badge tone={item.ready ? 'green' : 'red'}>{item.ready ? 'pass' : 'blocked'}</Badge></div>
            ))}
          </div>
        </Panel>

        <Panel title="Step 5: Production readiness dependency">
          <div className="space-y-3 p-4 text-sm" data-deployment-config-step="production-readiness-dependency">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><span>Runtime certification</span><Badge tone={readiness.runtimeCertificationPassed ? 'green' : 'red'}>{readiness.runtimeCertificationPassed ? 'passed' : 'missing'}</Badge></div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><span>Production readiness</span><Badge tone={readiness.productionReadinessPassed ? 'green' : 'red'}>{readiness.productionReadinessPassed ? 'ready' : 'blocked'}</Badge></div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><span>Go-live eligible</span><Badge tone={readiness.goLiveEligible ? 'green' : 'amber'}>{readiness.goLiveEligible ? 'yes' : 'no'}</Badge></div>
            <p className="text-slate-500">{readiness.summary}</p>
          </div>
        </Panel>

        <Panel title="Step 6: Final deployment checklist">
          <div className="space-y-3 p-4 text-sm" data-deployment-config-step="final-checklist">
            <ProgressBar value={score} label="Deployment configuration completion" />
            {[
              { label: 'Sandbox ready', ready: readiness.sandboxReady },
              { label: 'Production ready', ready: readiness.productionReady },
              { label: 'Config marked ready', ready: Boolean(active?.readyMarkedAt) },
              { label: 'No blockers', ready: blockers.length === 0 },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><span>{item.label}</span><Badge tone={item.ready ? 'green' : 'amber'}>{item.ready ? 'ready' : 'pending'}</Badge></div>
            ))}
          </div>
        </Panel>

        <Panel title="Blockers">
          <div className="space-y-3 p-4 text-sm" data-deployment-blockers>
            {blockers.map((blocker) => (
              <div key={blocker.id} className="rounded-xl border border-red-100 bg-red-50 p-3 text-red-700">
                <div className="flex items-start justify-between gap-3"><b>{blocker.code}</b><Badge tone="red">{blocker.group}</Badge></div>
                <p className="mt-2">{blocker.reason}</p>
                <p className="mt-2 text-xs font-semibold">{blocker.recommendedFix}</p>
              </div>
            ))}
            {!blockers.length ? <p className="text-slate-500">No deployment blockers for the active config.</p> : null}
          </div>
        </Panel>

        <Panel title="Warnings & Artifacts">
          <div className="space-y-3 p-4 text-sm" data-deployment-warnings-artifacts>
            {warnings.slice(0, 4).map((warning) => (
              <div key={warning.id} className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-amber-700"><b>{warning.code}</b><p className="mt-1">{warning.reason}</p></div>
            ))}
            {artifacts.slice(0, 5).map((artifact) => (
              <div key={artifact.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><span>{artifact.name}</span><Badge tone="blue">{artifact.type}</Badge></div>
            ))}
            {!warnings.length && !artifacts.length ? <p className="text-slate-500">Warnings and exports appear after validation/export.</p> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
