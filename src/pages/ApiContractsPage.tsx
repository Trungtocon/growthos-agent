import { FileJson, FlaskConical, RefreshCw, ShieldAlert } from 'lucide-react';
import { Badge, Button, PageHeader, Panel } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import {
  selectApiContractArtifacts,
  selectApiContractMatrix,
  selectApiContractMissingEnv,
  selectApiContractStatus,
  selectApiContractTestResults,
} from '../domain/selectors';
import type { ApiContractId } from '../runtime/api-contract';
import { exportApiContractArtifacts, validateApiContracts } from '../runtime/api-contract-store';
import { executeApiContract } from '../runtime/production-api-client';

type ApiContractWidgetSurface =
  | 'backend-adapter'
  | 'production-readiness'
  | 'deployment-config'
  | 'certified-sandbox-run'
  | 'run';

function toneFor(value: string): Tone {
  if (value.includes('blocked') || value.includes('invalid')) return 'red';
  if (value.includes('missing') || value.includes('warning') || value.includes('mock')) return 'amber';
  if (value.includes('ready') || value.includes('online') || value.includes('production')) return 'green';
  if (value.includes('sandbox')) return 'blue';
  return 'slate';
}

function reload() {
  window.location.reload();
}

function sampleBody(contractId: ApiContractId): Record<string, unknown> {
  if (contractId === 'runtime.run.start') return { ticketId: 'ticket-audit-module-3' };
  if (contractId === 'runtime.run.cancel') return { runId: 'run-demo-001' };
  if (contractId === 'runtime.run.approve') return { approvalId: 'approval-crm-write', runId: 'run-demo-001' };
  if (contractId === 'runtime.run.reject') return { approvalId: 'approval-crm-write', runId: 'run-demo-001', reason: 'Contract test rejection' };
  if (contractId === 'artifact.export') return { artifactId: 'artifact-runtime-report', format: 'markdown' };
  if (contractId === 'approval.submit') return { approvalId: 'approval-crm-write', decision: 'approved', note: 'Contract smoke approval' };
  if (contractId === 'governance.evaluate') return { action: 'runtime.run.start', actorId: 'user-demo-admin', scope: 'workspace' };
  if (contractId.startsWith('worker.')) return { workerId: 'worker-autonomous-loop-1', reason: 'Contract smoke' };
  if (contractId === 'certifiedSandbox.run') return { certificationRunId: 'runtime-certification-run-demo', runtimeMode: 'sandbox' };
  return { workspaceId: 'workspace-uikigai-demo' };
}

export function ApiContractsCompactWidget({ surface }: { surface: ApiContractWidgetSurface }) {
  const status = selectApiContractStatus();
  return (
    <span
      data-api-contract-widget={surface}
      data-api-contract-widget-total={status.total}
      data-api-contract-widget-ready={status.ready}
      data-api-contract-widget-blocked={status.blocked}
      className="sr-only"
    >
      API contracts {surface}: {status.total} contracts, {status.ready} ready, {status.blocked} blocked.
    </span>
  );
}

export function ApiContractsPage() {
  const contracts = selectApiContractMatrix();
  const status = selectApiContractStatus();
  const missingEnv = selectApiContractMissingEnv();
  const testResults = selectApiContractTestResults();
  const artifacts = selectApiContractArtifacts();

  return (
    <div data-route="/api-contracts" data-api-contracts-route>
      <PageHeader
        title="Production API Contract & Endpoint Binding"
        subtitle="Contract registry for runtime, artifact, approval, governance, worker, certification, and production readiness endpoints."
        actions={(
          <>
            <Button variant="secondary" onClick={() => { validateApiContracts(); reload(); }}><RefreshCw className="h-4 w-4" />Validate contracts</Button>
            <Button variant="secondary" onClick={() => { exportApiContractArtifacts(); reload(); }}><FileJson className="h-4 w-4" />Export contract report</Button>
          </>
        )}
      />

      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Contracts', value: status.total, tone: 'blue' },
          { label: 'Ready', value: status.ready, tone: 'green' },
          { label: 'Warning', value: status.warning, tone: 'amber' },
          { label: 'Blocked', value: status.blocked, tone: status.blocked ? 'red' : 'green' },
          { label: 'Missing Env', value: status.missingEnv, tone: status.missingEnv ? 'amber' : 'green' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</div>
            <div className="mt-3 flex items-center justify-between gap-3"><b className="text-2xl text-slate-950">{item.value}</b><Badge tone={item.tone as Tone}>{item.label}</Badge></div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[1fr_380px] gap-5">
        <Panel title="Contract Matrix">
          <div className="grid gap-3 p-4 text-sm">
            {contracts.map((contract) => {
              const lastResult = testResults.find((result) => result.contractId === contract.contractId);
              return (
                <div key={contract.contractId} data-api-contract-row={contract.contractId} className="grid grid-cols-[220px_80px_1fr_110px_120px] items-center gap-3 rounded-xl border border-slate-100 p-3">
                  <div>
                    <b className="block text-slate-950">{contract.contractId}</b>
                    <span className="text-xs text-slate-400">{contract.label}</span>
                  </div>
                  <Badge tone="slate">{contract.method}</Badge>
                  <div>
                    <div className="font-medium text-slate-700">{contract.path}</div>
                    <div className="text-xs text-slate-400">Auth: {contract.authMode} | Mode: {contract.runtimeMode}</div>
                  </div>
                  <Badge tone={toneFor(contract.status)}>{contract.status}</Badge>
                  <Button
                    variant="secondary"
                    data-api-contract-test-call
                    onClick={async () => {
                      await executeApiContract(contract.contractId, { mode: contract.runtimeMode, body: sampleBody(contract.contractId) });
                      reload();
                    }}
                  >
                    <FlaskConical className="h-4 w-4" />Test call
                  </Button>
                  <div className="col-span-5 grid grid-cols-[1fr_1fr_1fr] gap-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                    <div><b>Required env:</b> {contract.requiredEnv.join(', ') || 'none'}</div>
                    <div><b>Readiness:</b> {contract.readinessDependency.join(', ') || 'none'}</div>
                    <div data-api-contract-last-result><b>Last result:</b> {lastResult ? `${lastResult.status} (${lastResult.mode})` : 'not tested'}</div>
                    <div className="col-span-3"><b>Blocked reason:</b> {contract.blockedReason ?? 'None'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Endpoint Status">
            <div className="space-y-3 p-4 text-sm">
              <div className="flex items-center justify-between"><span>Total contracts</span><b>{status.total}</b></div>
              <div className="flex items-center justify-between"><span>Invalid schemas</span><Badge tone={status.invalidSchema ? 'red' : 'green'}>{status.invalidSchema}</Badge></div>
              <div className="flex items-center justify-between"><span>Test results</span><b>{testResults.length}</b></div>
            </div>
          </Panel>

          <Panel title="Missing Env">
            <div className="space-y-3 p-4 text-sm">
              {missingEnv.map((contract) => (
                <div key={contract.contractId} className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-amber-700">
                  <b>{contract.contractId}</b>
                  <p className="mt-1 text-xs">{contract.blockedReason}</p>
                </div>
              ))}
              {!missingEnv.length ? <p className="text-slate-500">No missing env in the active contract mode.</p> : null}
            </div>
          </Panel>

          <Panel title="Readiness Dependencies">
            <div className="space-y-2 p-4 text-sm">
              {contracts.slice(0, 6).map((contract) => (
                <div key={contract.contractId} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-3"><span>{contract.contractId}</span><Badge tone={toneFor(contract.status)}>{contract.status}</Badge></div>
                  <p className="mt-2 text-xs text-slate-500">{contract.readinessDependency.join(', ')}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Contract Artifacts">
            <div className="space-y-2 p-4 text-sm">
              {artifacts.map((artifact) => <div key={artifact.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><span>{artifact.name}</span><Badge tone="blue">{artifact.type}</Badge></div>)}
              {!artifacts.length ? <p className="text-slate-500">Export contract report to register artifacts.</p> : null}
            </div>
          </Panel>

          <Panel title="Binding Guardrails">
            <div className="space-y-3 p-4 text-sm text-slate-600">
              <p className="rounded-xl bg-slate-50 p-3"><ShieldAlert className="mr-2 inline h-4 w-4" />Production calls require deployment config, production readiness, runtime certification, certified sandbox, and governance gates.</p>
              <p className="rounded-xl bg-slate-50 p-3">UI pages do not call fetch directly; contract execution goes through `production-api-client` and `backend-api-gateway`.</p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
