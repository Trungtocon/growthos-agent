import { AlertTriangle, FileText, KeyRound, RefreshCw, RotateCcw, ServerCog, ShieldCheck, TestTube2 } from 'lucide-react';
import { Badge, Button, PageHeader, Panel } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import {
  selectBackendAdapterState,
  selectBackendArtifacts,
  selectBackendAuthStatus,
  selectBackendBlockers,
  selectBackendEndpointMatrix,
  selectBackendHealth,
  selectBackendLastRequest,
  selectBackendMode,
  selectBackendWarnings,
} from '../domain/selectors';
import {
  callRuntimeEndpoint,
  checkBackendHealth,
  exportBackendAdapterReport,
  resetBackendAdapterState,
  validateBackendAuth,
} from '../runtime/backend-adapter-store';
import { ApiContractsCompactWidget } from './ApiContractsPage';
import { E2EActionFlowCompactWidget } from './E2EActionFlowPage';
import { PreGoLiveValidationCompactWidget } from './PreGoLiveValidationPage';

type BackendAdapterWidgetSurface =
  | 'deployment-config'
  | 'production-readiness'
  | 'runtime-certification'
  | 'certified-sandbox-run'
  | 'run'
  | 'worker-control'
  | 'chaos'
  | 'evaluation';

function toneFor(value: string): Tone {
  if (value.includes('blocked') || value.includes('offline') || value.includes('failed')) return 'red';
  if (value.includes('degraded') || value.includes('missing') || value.includes('mock')) return 'amber';
  if (value.includes('online') || value.includes('production')) return 'green';
  if (value.includes('sandbox')) return 'blue';
  return 'slate';
}

function reload() {
  window.location.reload();
}

export function BackendAdapterCompactWidget({ surface }: { surface: BackendAdapterWidgetSurface }) {
  const state = selectBackendAdapterState();
  return (
    <span
      data-backend-adapter-widget={surface}
      data-backend-adapter-widget-mode={state.mode}
      data-backend-adapter-widget-health={state.health.status}
      data-backend-adapter-widget-blockers={state.blockers.length}
      className="sr-only"
    >
      Backend adapter {surface}: {state.mode}, {state.health.status}, {state.blockers.length} blockers.
    </span>
  );
}

export function BackendAdapterPage() {
  const state = selectBackendAdapterState();
  const mode = selectBackendMode();
  const health = selectBackendHealth();
  const authStatus = selectBackendAuthStatus();
  const matrix = selectBackendEndpointMatrix();
  const blockers = selectBackendBlockers();
  const warnings = selectBackendWarnings();
  const lastRequest = selectBackendLastRequest();
  const artifacts = selectBackendArtifacts();

  return (
    <div data-route="/backend-adapter" data-backend-adapter-route>
      <ApiContractsCompactWidget surface="backend-adapter" />
      <E2EActionFlowCompactWidget surface="backend-adapter" />
      <PreGoLiveValidationCompactWidget surface="backend-adapter" />
      <PageHeader
        title="Production Backend Adapter & API Gateway"
        subtitle="Safely test backend health, auth, endpoint capabilities, retry/fallback behavior, and production gate blockers without UI-to-Hermes/Paperclip imports."
        actions={(
          <>
            <Button variant="secondary" onClick={async () => { await checkBackendHealth({ mode }); reload(); }}><RefreshCw className="h-4 w-4" />Check health</Button>
            <Button variant="secondary" onClick={async () => { await validateBackendAuth({ mode }); reload(); }}><KeyRound className="h-4 w-4" />Validate auth</Button>
            <Button variant="secondary" onClick={async () => { await callRuntimeEndpoint({ mode: 'sandbox', path: '/runtime/test-sandbox', payload: { ping: true } }); reload(); }}><TestTube2 className="h-4 w-4" />Test sandbox request</Button>
            <Button variant="secondary" onClick={async () => { await callRuntimeEndpoint({ mode: 'production', path: '/runtime/test-production', payload: { ping: true } }); reload(); }}><ShieldCheck className="h-4 w-4" />Test production request</Button>
            <Button variant="secondary" onClick={() => { exportBackendAdapterReport(); reload(); }}><FileText className="h-4 w-4" />Export backend report</Button>
            <Button variant="secondary" onClick={() => { resetBackendAdapterState(); reload(); }}><RotateCcw className="h-4 w-4" />Reset adapter state</Button>
          </>
        )}
      />

      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Current mode', value: mode, tone: toneFor(mode) },
          { label: 'Backend health', value: health.status, tone: toneFor(health.status) },
          { label: 'Auth status', value: authStatus, tone: toneFor(authStatus) },
          { label: 'Blockers', value: blockers.length, tone: blockers.length ? 'red' : 'green' },
          { label: 'Requests', value: state.requestLog.length, tone: 'blue' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</div>
            <div className="mt-3 flex items-center justify-between gap-3"><b className="truncate text-2xl text-slate-950">{item.value}</b><Badge tone={item.tone as Tone}>{item.label}</Badge></div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[380px_1fr_420px] gap-5">
        <Panel title="Backend Health">
          <div className="space-y-3 p-4 text-sm" data-backend-health-status>
            <div className="flex items-center justify-between"><span>Mode</span><Badge tone={toneFor(mode)}>{mode}</Badge></div>
            <div className="flex items-center justify-between"><span>Status</span><Badge tone={toneFor(health.status)}>{health.status}</Badge></div>
            <p className="rounded-xl bg-slate-50 p-3 text-slate-600">{health.summary}</p>
            <p className="text-xs text-slate-400">Checked: {health.checkedAt ? new Date(health.checkedAt).toLocaleString() : 'not checked'}</p>
          </div>
        </Panel>

        <Panel title="Endpoint Matrix">
          <div className="grid grid-cols-2 gap-3 p-4 text-sm">
            {matrix.map((endpoint) => (
              <div key={endpoint.kind} data-backend-endpoint-row={endpoint.kind} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-start justify-between gap-3"><b>{endpoint.label}</b><Badge tone={toneFor(endpoint.status)}>{endpoint.status}</Badge></div>
                <p className="mt-2 text-slate-500">{endpoint.path}</p>
                <p className="mt-2 text-xs text-slate-400">{endpoint.reason}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Last Request Log">
          <div className="space-y-3 p-4 text-sm" data-backend-last-request>
            {lastRequest ? (
              <>
                <div className="flex items-center justify-between"><span>Endpoint</span><b>{lastRequest.endpoint}</b></div>
                <div className="flex items-center justify-between"><span>Status</span><Badge tone={toneFor(lastRequest.status)}>{lastRequest.status}</Badge></div>
                <div className="flex items-center justify-between"><span>Fallback</span><Badge tone={lastRequest.fallbackUsed ? 'amber' : 'green'}>{lastRequest.fallbackUsed ? 'yes' : 'no'}</Badge></div>
                <p className="rounded-xl bg-slate-50 p-3 text-slate-600">{lastRequest.error?.message ?? lastRequest.path}</p>
              </>
            ) : <p className="text-slate-500">No backend request has been recorded yet.</p>}
          </div>
        </Panel>

        <Panel title="Error Normalization">
          <div className="space-y-3 p-4 text-sm" data-backend-error-panel>
            {state.requestLog.filter((entry) => entry.error).slice(0, 5).map((entry) => (
              <div key={entry.id} className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-amber-700">
                <div className="flex items-start justify-between gap-3"><b>{entry.error?.code}</b><Badge tone="amber">{entry.endpoint}</Badge></div>
                <p className="mt-2">{entry.error?.message}</p>
              </div>
            ))}
            {!state.requestLog.some((entry) => entry.error) ? <p className="text-slate-500">Normalized backend errors appear after a failed/degraded request.</p> : null}
          </div>
        </Panel>

        <Panel title="Retry / Fallback Status">
          <div className="space-y-3 p-4 text-sm" data-backend-fallback-status>
            <div className="flex items-center justify-between"><span>Fallback requests</span><b>{state.requestLog.filter((entry) => entry.fallbackUsed).length}</b></div>
            <div className="flex items-center justify-between"><span>Warnings</span><b>{warnings.length}</b></div>
            {warnings.map((warning) => <p key={warning.id} className="rounded-xl bg-amber-50 p-3 text-amber-700">{warning.reason}</p>)}
          </div>
        </Panel>

        <Panel title="Governance / Deployment Blockers">
          <div className="space-y-3 p-4 text-sm" data-backend-blockers>
            {blockers.map((blocker) => (
              <div key={blocker.id} className="rounded-xl border border-red-100 bg-red-50 p-3 text-red-700">
                <div className="flex items-start justify-between gap-3"><b>{blocker.code}</b><AlertTriangle className="h-4 w-4" /></div>
                <p className="mt-2">{blocker.reason}</p>
                <p className="mt-2 text-xs font-semibold">{blocker.recommendedFix}</p>
              </div>
            ))}
            {!blockers.length ? <p className="text-slate-500">No backend adapter blockers for the active mode.</p> : null}
          </div>
        </Panel>

        <Panel title="Backend Report Artifacts">
          <div className="space-y-2 p-4 text-sm" data-backend-artifacts>
            {artifacts.map((artifact) => <div key={artifact.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><span>{artifact.name}</span><Badge tone="blue">{artifact.type}</Badge></div>)}
            {!artifacts.length ? <p className="text-slate-500">Backend adapter artifacts appear after export.</p> : null}
          </div>
        </Panel>

        <Panel title="Gateway Summary">
          <div className="space-y-3 p-4 text-sm" data-backend-gateway-summary>
            <div className="flex items-center justify-between"><span>Endpoint capabilities</span><b>{matrix.length}</b></div>
            <div className="flex items-center justify-between"><span>Auth status</span><Badge tone={toneFor(authStatus)}>{authStatus}</Badge></div>
            <div className="flex items-center justify-between"><span>Adapter updated</span><b>{new Date(state.updatedAt).toLocaleTimeString()}</b></div>
            <p className="rounded-xl bg-slate-50 p-3 text-slate-600"><ServerCog className="mr-2 inline h-4 w-4" />All production calls are guarded by deployment config, production readiness, runtime certification, certified sandbox, and governance gates.</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
