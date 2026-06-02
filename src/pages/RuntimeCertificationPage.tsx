import { AlertTriangle, CheckCircle2, FileText, Play, ShieldCheck, TestTube2, XCircle } from 'lucide-react';
import { Badge, Button, PageHeader, Panel } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import {
  selectActiveCertificationRun,
  selectCertificationArtifacts,
  selectCertificationProfiles,
  selectContractTestResults,
  selectRuntimeCertificationDashboard,
  selectRuntimeReadinessFindings,
  selectSandboxSafetyStatus,
} from '../domain/selectors';
import {
  certifyRuntime,
  createCertificationProfile,
  exportCertificationReport,
  runAllContractTests,
  runContractTest,
  startCertificationRun,
} from '../runtime/runtime-certification-store';
import { BackendAdapterCompactWidget } from './BackendAdapterPage';
import { CertifiedSandboxRunCompactWidget } from './CertifiedSandboxRunPage';
import { DeploymentConfigCompactWidget } from './DeploymentConfigPage';
import { ProductionReadinessCompactWidget } from './ProductionReadinessPage';

function toneFor(value: string): Tone {
  if (value.includes('blocked') || value.includes('failed') || value.includes('production')) return 'red';
  if (value.includes('warning') || value.includes('not_started') || value.includes('running')) return 'amber';
  if (value.includes('certified') || value.includes('passed') || value.includes('safe')) return 'green';
  return 'blue';
}

function reload() {
  window.location.reload();
}

export function RuntimeCertificationCompactWidget({ surface }: { surface: 'chaos' | 'worker-recovery' | 'worker-control' | 'evaluation' | 'run' | 'agent' }) {
  const dashboard = selectRuntimeCertificationDashboard();
  return (
    <span data-runtime-certification-widget={surface} data-runtime-certification-status={dashboard.status} data-runtime-certification-runs={dashboard.runs.length} data-runtime-certification-findings={dashboard.findings.length} className="sr-only">
      Runtime certification {surface}: {dashboard.status}, {dashboard.runs.length} runs, {dashboard.findings.length} findings.
    </span>
  );
}

export function RuntimeCertificationPage() {
  const dashboard = selectRuntimeCertificationDashboard();
  const profiles = selectCertificationProfiles();
  const activeRun = selectActiveCertificationRun();
  const results = selectContractTestResults(activeRun?.id);
  const findings = selectRuntimeReadinessFindings(activeRun?.id);
  const safety = selectSandboxSafetyStatus(activeRun?.id);
  const artifacts = selectCertificationArtifacts();

  return (
    <div data-route="/runtime-certification" data-runtime-certification-route>
      <CertifiedSandboxRunCompactWidget surface="runtime-certification" />
      <ProductionReadinessCompactWidget surface="runtime-certification" />
      <DeploymentConfigCompactWidget surface="runtime-certification" />
      <BackendAdapterCompactWidget surface="runtime-certification" />
      <PageHeader
        title="Sandbox Contract Test & Runtime Certification"
        subtitle="Verify Hermes/Paperclip sandbox contracts before production enablement while preserving mock fallback and governance gates."
        actions={<><Button variant="secondary" onClick={() => { exportCertificationReport(); reload(); }}><FileText className="h-4 w-4" />Export report</Button><Button onClick={() => { const profile = createCertificationProfile({ name: 'Mock-safe certification', runtimeMode: 'mock' }); startCertificationRun(profile.id); reload(); }}><TestTube2 className="h-4 w-4" />Start certification</Button></>}
      />
      <div className="grid grid-cols-5 gap-4" data-runtime-certification-status>
        {[
          { label: 'Status', value: dashboard.status, tone: toneFor(dashboard.status) },
          { label: 'Profiles', value: profiles.length, tone: 'blue' },
          { label: 'Runs', value: dashboard.runs.length, tone: 'blue' },
          { label: 'Findings', value: dashboard.findings.length, tone: dashboard.findings.length ? 'amber' : 'green' },
          { label: 'Artifacts', value: artifacts.length, tone: 'slate' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</div>
            <div className="mt-3 flex items-center justify-between gap-3"><b className="truncate text-2xl text-slate-950">{item.value}</b><Badge tone={item.tone as Tone}>{item.label}</Badge></div>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-[380px_1fr_420px] gap-5">
        <Panel title="Sandbox Config Check">
          <div className="space-y-3 p-4 text-sm" data-certification-config>
            {profiles.slice(0, 5).map((profile) => (
              <div key={profile.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-3"><b>{profile.name}</b><Badge tone={toneFor(profile.runtimeMode)}>{profile.runtimeMode}</Badge></div>
                <p className="mt-2 text-slate-500">{profile.sandboxBaseUrl || 'No sandbox URL configured; mock fallback active.'}</p>
                <Button className="mt-3 w-full" variant="secondary" onClick={() => { startCertificationRun(profile.id); reload(); }}><Play className="h-4 w-4" />Run profile</Button>
              </div>
            ))}
            {!profiles.length ? <p className="text-slate-500">Create a certification profile to begin contract testing.</p> : null}
          </div>
        </Panel>
        <Panel title="Contract Test Matrix">
          <div className="grid grid-cols-2 gap-3 p-4" data-contract-test-matrix>
            {results.map((result) => (
              <div key={result.testId} className="rounded-xl border border-slate-100 p-3 text-sm">
                <div className="flex items-start justify-between gap-2"><b>{result.testId}</b><Badge tone={toneFor(result.status)}>{result.status}</Badge></div>
                <p className="mt-2 text-slate-500">{result.message}</p>
                {activeRun ? <Button className="mt-3" variant="secondary" onClick={() => { runContractTest(activeRun.id, result.testId); reload(); }}>Run</Button> : null}
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Safety Guard: No Production Endpoint">
          <div className="space-y-3 p-4 text-sm" data-sandbox-safety-status>
            <div className="rounded-xl bg-slate-50 p-3"><ShieldCheck className="mr-2 inline h-4 w-4" />{safety.message}</div>
            <div className="flex items-center justify-between"><span>Safe</span><Badge tone={safety.safe ? 'green' : 'red'}>{String(safety.safe)}</Badge></div>
            <div className="flex items-center justify-between"><span>Production endpoint</span><Badge tone={safety.productionEndpointDetected ? 'red' : 'green'}>{String(safety.productionEndpointDetected)}</Badge></div>
          </div>
        </Panel>
        <Panel title="Governance Preflight / Artifact / Recovery Compatibility">
          <div className="grid grid-cols-3 gap-3 p-4" data-certification-compatibility>
            {['governance_preflight', 'artifact_export', 'recovery_flow', 'chaos_safety', 'quota_guard', 'cost_tracking'].map((testId) => {
              const result = dashboard.results.find((item) => item.testId === testId);
              return <div key={testId} className="rounded-xl border border-slate-100 p-3 text-sm"><b>{testId}</b><p className="mt-2"><Badge tone={toneFor(result?.status ?? 'not_started')}>{result?.status ?? 'not_started'}</Badge></p></div>;
            })}
          </div>
        </Panel>
        <Panel title="Warnings & Blockers">
          <div className="grid grid-cols-2 gap-3 p-4" data-certification-findings>
            {findings.map((finding) => (
              <div key={finding.id} className="rounded-xl border border-slate-100 p-3 text-sm">
                <div className="flex items-start justify-between gap-2"><b>{finding.category}</b><Badge tone={toneFor(finding.severity)}>{finding.severity}</Badge></div>
                <p className="mt-2 text-slate-500">{finding.message}</p>
              </div>
            ))}
            {!findings.length ? <p className="text-sm text-slate-500">No findings for the current run.</p> : null}
          </div>
        </Panel>
        <Panel title="Certification Report">
          <div className="space-y-3 p-4 text-sm" data-certification-report>
            {activeRun ? <div className="flex flex-wrap gap-2"><Button onClick={() => { runAllContractTests(activeRun.id); reload(); }}><TestTube2 className="h-4 w-4" />Run all</Button><Button variant="secondary" onClick={() => { certifyRuntime(activeRun.id); reload(); }}><CheckCircle2 className="h-4 w-4" />Certify</Button></div> : null}
            {artifacts.map((artifact) => <div key={artifact} className="rounded-lg bg-slate-50 p-2 font-semibold text-slate-600">{artifact}</div>)}
            {!artifacts.length ? <p className="text-slate-500">Exported certification reports appear after export.</p> : null}
            {dashboard.status === 'blocked' ? <p className="rounded-xl bg-red-50 p-3 text-red-700"><XCircle className="mr-2 inline h-4 w-4" />Certification is blocked.</p> : null}
            {dashboard.status === 'warning' ? <p className="rounded-xl bg-amber-50 p-3 text-amber-700"><AlertTriangle className="mr-2 inline h-4 w-4" />Warnings must be reviewed before production enablement.</p> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
