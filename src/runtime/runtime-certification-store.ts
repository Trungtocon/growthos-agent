import { DEMO_RUN_ID } from '../data/demo-fixtures';
import type { Artifact } from '../domain/types';
import type { ArtifactRecord } from './artifact-registry';
import { registerArtifact } from './artifact-registry-store';
import {
  type RuntimeCertificationDashboard,
  type RuntimeCertificationProfile,
  type RuntimeCertificationRun,
  type RuntimeCertificationStatus,
  type RuntimeContractCategory,
  type RuntimeContractResult,
  type RuntimeContractTest,
  type RuntimeReadinessFinding,
  type SandboxSafetyStatus,
} from './runtime-certification';

const RUNTIME_CERTIFICATION_KEY = 'uikigai-runtime-certification-v1';

interface RuntimeCertificationState {
  profiles: Record<string, RuntimeCertificationProfile>;
  runs: Record<string, RuntimeCertificationRun>;
  results: Record<string, RuntimeContractResult>;
  findings: Record<string, RuntimeReadinessFinding>;
  artifacts: Record<string, string>;
  updatedAt: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyState(): RuntimeCertificationState {
  return { profiles: {}, runs: {}, results: {}, findings: {}, artifacts: {}, updatedAt: nowIso() };
}

function readState(): RuntimeCertificationState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(RUNTIME_CERTIFICATION_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<RuntimeCertificationState>;
    return {
      profiles: parsed.profiles ?? {},
      runs: parsed.runs ?? {},
      results: parsed.results ?? {},
      findings: parsed.findings ?? {},
      artifacts: parsed.artifacts ?? {},
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: RuntimeCertificationState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(RUNTIME_CERTIFICATION_KEY, JSON.stringify({ ...state, updatedAt: nowIso() }));
}

export function defaultContractTests(): RuntimeContractTest[] {
  return [
    { id: 'environment_config', category: 'environment_config', name: 'Environment config', required: true, description: 'Runtime mode, sandbox URL, credentials and workspace config resolve safely.' },
    { id: 'sandbox_health', category: 'sandbox_health', name: 'Sandbox health', required: true, description: 'Sandbox health can be normalized or safely mocked.' },
    { id: 'authentication', category: 'authentication', name: 'Authentication', required: true, description: 'Sandbox credentials are present for sandbox mode or safely warned.' },
    { id: 'workspace_access', category: 'workspace_access', name: 'Workspace access', required: true, description: 'Workspace ID is present for sandbox mode or safely warned.' },
    { id: 'tool_registry_sync', category: 'tool_registry_sync', name: 'Tool registry sync', required: false, description: 'Hermes tool registry can sync or use mock-safe defaults.' },
    { id: 'model_compatibility', category: 'model_compatibility', name: 'Model compatibility', required: false, description: 'Tools and selected models are compatible.' },
    { id: 'artifact_export', category: 'artifact_export', name: 'Artifact export', required: true, description: 'Paperclip artifact export contract is available through registry.' },
    { id: 'approval_hold', category: 'approval_hold', name: 'Approval hold', required: true, description: 'Approval holds block execution until approval.' },
    { id: 'governance_preflight', category: 'governance_preflight', name: 'Governance preflight', required: true, description: 'Governance enforcement runs before runtime start.' },
    { id: 'quota_guard', category: 'quota_guard', name: 'Quota guard', required: true, description: 'Quota and budget guard prevent unsafe execution.' },
    { id: 'cost_tracking', category: 'cost_tracking', name: 'Cost tracking', required: false, description: 'Estimated and actual usage costs can reconcile.' },
    { id: 'recovery_flow', category: 'recovery_flow', name: 'Recovery flow', required: true, description: 'Worker recovery can create plans and auto-healing decisions.' },
    { id: 'chaos_safety', category: 'chaos_safety', name: 'Chaos safety', required: true, description: 'Chaos simulation remains mock-only and auditable.' },
    { id: 'no_production_endpoint', category: 'no_production_endpoint', name: 'No production endpoint', required: true, description: 'Production-looking endpoints block certification.' },
  ];
}

function persistProfile(profile: RuntimeCertificationProfile): RuntimeCertificationProfile {
  const state = readState();
  writeState({ ...state, profiles: { ...state.profiles, [profile.id]: profile } });
  return clone(profile);
}

function persistRun(run: RuntimeCertificationRun): RuntimeCertificationRun {
  const state = readState();
  writeState({ ...state, runs: { ...state.runs, [run.id]: { ...run, updatedAt: nowIso() } } });
  return clone({ ...run, updatedAt: nowIso() });
}

function persistResult(result: RuntimeContractResult): RuntimeContractResult {
  const state = readState();
  writeState({ ...state, results: { ...state.results, [result.id]: result } });
  return clone(result);
}

function persistFinding(finding: RuntimeReadinessFinding): RuntimeReadinessFinding {
  const state = readState();
  writeState({ ...state, findings: { ...state.findings, [finding.id]: finding } });
  return clone(finding);
}

export function createCertificationProfile(input: {
  name: string;
  runtimeMode?: 'mock' | 'sandbox';
  sandboxBaseUrl?: string;
  apiKeyPresent?: boolean;
  workspaceIdPresent?: boolean;
  timeoutMs?: number;
}): RuntimeCertificationProfile {
  return persistProfile({
    id: unique('runtime-certification-profile'),
    name: input.name,
    runtimeMode: input.runtimeMode ?? 'mock',
    sandboxBaseUrl: input.sandboxBaseUrl ?? '',
    apiKeyPresent: input.apiKeyPresent ?? false,
    workspaceIdPresent: input.workspaceIdPresent ?? false,
    timeoutMs: input.timeoutMs ?? 15000,
    createdAt: nowIso(),
  });
}

export function startCertificationRun(profileId: string): RuntimeCertificationRun {
  const profile = readState().profiles[profileId];
  if (!profile) throw new Error(`Cannot start certification for missing profile: ${profileId}`);
  const run = persistRun({ id: unique('runtime-certification-run'), profileId, status: 'running', startedAt: nowIso(), updatedAt: nowIso(), blockers: [], warnings: [] });
  return run;
}

function isProductionUrl(url: string): boolean {
  return /(^|[./-])(prod|production)([./-]|$)/i.test(url) || /api\.hermes\./i.test(url) || /api\.paperclip\./i.test(url);
}

function resultFor(profile: RuntimeCertificationProfile, run: RuntimeCertificationRun, test: RuntimeContractTest): RuntimeContractResult {
  const missingSandboxConfig = profile.runtimeMode === 'sandbox' && (!profile.sandboxBaseUrl || !profile.apiKeyPresent || !profile.workspaceIdPresent);
  if (test.id === 'no_production_endpoint' && isProductionUrl(profile.sandboxBaseUrl)) {
    return result(run.id, test, 'blocked', 'Production-looking endpoint detected. Certification is blocked.');
  }
  if (test.id === 'environment_config' && missingSandboxConfig) {
    return result(run.id, test, 'warning', 'Sandbox config is incomplete. Runtime remains mock-safe and does not crash.');
  }
  if ((test.id === 'authentication' && profile.runtimeMode === 'sandbox' && !profile.apiKeyPresent) || (test.id === 'workspace_access' && profile.runtimeMode === 'sandbox' && !profile.workspaceIdPresent)) {
    return result(run.id, test, 'warning', `${test.name} is missing; sandbox cannot be enabled yet.`);
  }
  if (test.id === 'sandbox_health') {
    return result(run.id, test, 'passed', profile.runtimeMode === 'mock' || missingSandboxConfig ? 'Mock-safe sandbox health normalized.' : 'Sandbox health contract normalized.');
  }
  return result(run.id, test, 'passed', `${test.name} contract passed in mock-safe certification.`);
}

function result(runId: string, test: RuntimeContractTest, status: RuntimeCertificationStatus, message: string): RuntimeContractResult {
  return { id: `runtime-contract-result-${runId}-${test.id}`, runId, testId: test.id, required: test.required, status, message, createdAt: nowIso() };
}

function recomputeRunStatus(runId: string): RuntimeCertificationRun {
  const state = readState();
  const run = state.runs[runId];
  if (!run) throw new Error(`Missing certification run: ${runId}`);
  const results = Object.values(state.results).filter((item) => item.runId === runId);
  const blockers = results.filter((item) => item.status === 'blocked' || (item.required && item.status === 'failed')).map((item) => item.message);
  const warnings = results.filter((item) => item.status === 'warning').map((item) => item.message);
  const status: RuntimeCertificationStatus = blockers.length ? 'blocked' : warnings.length ? 'warning' : results.length ? 'passed' : 'running';
  return persistRun({ ...run, status, blockers, warnings });
}

export function runContractTest(runId: string, category: RuntimeContractCategory): RuntimeContractResult {
  const state = readState();
  const run = state.runs[runId];
  if (!run) throw new Error(`Cannot run contract test for missing certification run: ${runId}`);
  const profile = state.profiles[run.profileId];
  if (!profile) throw new Error(`Cannot run contract test for missing profile: ${run.profileId}`);
  const test = defaultContractTests().find((candidate) => candidate.id === category);
  if (!test) throw new Error(`Unknown runtime contract category: ${category}`);
  const saved = persistResult(resultFor(profile, run, test));
  recomputeRunStatus(runId);
  return saved;
}

export function runAllContractTests(runId: string): RuntimeContractResult[] {
  return defaultContractTests().map((test) => runContractTest(runId, test.id));
}

export function getContractTestResults(runId?: string): RuntimeContractResult[] {
  const state = readState();
  const existing = Object.values(state.results).filter((item) => !runId || item.runId === runId);
  const byTest = new Map(existing.map((item) => [item.testId, item]));
  const matrix = defaultContractTests().map((test) => byTest.get(test.id) ?? result(runId ?? 'not-started', test, 'not_started', 'Contract test has not run yet.'));
  return matrix.map(clone);
}

export function evaluateCertificationReadiness(runId: string): RuntimeReadinessFinding[] {
  const run = recomputeRunStatus(runId);
  const results = getContractTestResults(runId);
  const findings = results
    .filter((item) => item.status !== 'passed' && item.status !== 'not_started')
    .map((item) => persistFinding({ id: `runtime-readiness-${runId}-${item.testId}`, runId, category: item.testId, severity: item.status === 'blocked' || item.status === 'failed' ? 'blocking' : 'warning', message: item.message, createdAt: nowIso() }));
  if (!findings.length) {
    findings.push(persistFinding({ id: `runtime-readiness-${runId}-ready`, runId, category: 'sandbox_health', severity: 'info', message: run.status === 'certified' ? 'Runtime certified.' : 'Runtime certification is ready.', createdAt: nowIso() }));
  }
  return findings.map(clone);
}

export function blockCertification(runId: string, reason: string): RuntimeCertificationRun {
  const run = readState().runs[runId];
  if (!run) throw new Error(`Cannot block missing certification run: ${runId}`);
  persistFinding({ id: unique(`runtime-readiness-blocked-${runId}`), runId, category: 'governance_preflight', severity: 'blocking', message: reason, createdAt: nowIso() });
  return persistRun({ ...run, status: 'blocked', blockers: [...run.blockers, reason] });
}

export function certifyRuntime(runId: string): RuntimeCertificationRun {
  let run = recomputeRunStatus(runId);
  if (run.status === 'blocked') return clone(run);
  const results = getContractTestResults(runId);
  const requiredMissing = results.filter((item) => item.required && (item.status === 'not_started' || item.status === 'failed' || item.status === 'blocked'));
  if (requiredMissing.length) return blockCertification(runId, `Required contract tests not passing: ${requiredMissing.map((item) => item.testId).join(', ')}`);
  run = persistRun({ ...run, status: 'certified', completedAt: nowIso() });
  evaluateCertificationReadiness(runId);
  return run;
}

export function getCertificationProfiles(): RuntimeCertificationProfile[] {
  return Object.values(readState().profiles).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone);
}

export function getCertificationRuns(): RuntimeCertificationRun[] {
  return Object.values(readState().runs).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).map(clone);
}

export function getActiveCertificationRun(): RuntimeCertificationRun | undefined {
  return getCertificationRuns().find((run) => run.status === 'running' || run.status === 'warning' || run.status === 'blocked');
}

export function getRuntimeReadinessFindings(runId?: string): RuntimeReadinessFinding[] {
  return Object.values(readState().findings).filter((finding) => !runId || finding.runId === runId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone);
}

export function getCertificationStatus(runId?: string): RuntimeCertificationStatus {
  if (runId) return readState().runs[runId]?.status ?? 'not_started';
  const latest = getCertificationRuns()[0];
  return latest?.status ?? 'not_started';
}

export function getSandboxSafetyStatus(runId?: string): SandboxSafetyStatus {
  const state = readState();
  const run = runId ? state.runs[runId] : getCertificationRuns()[0];
  const profile = run ? state.profiles[run.profileId] : undefined;
  const productionEndpointDetected = Boolean(profile?.sandboxBaseUrl && isProductionUrl(profile.sandboxBaseUrl));
  return {
    safe: !productionEndpointDetected,
    productionEndpointDetected,
    runtimeMode: profile?.runtimeMode ?? 'mock',
    message: productionEndpointDetected ? 'Production endpoint detected. Certification is blocked.' : 'Sandbox safety guard is active.',
  };
}

export function getCertificationArtifacts(): string[] {
  return Object.values(readState().artifacts).map(clone);
}

export function getRuntimeCertificationDashboard(): RuntimeCertificationDashboard {
  const state = readState();
  return {
    profiles: getCertificationProfiles(),
    runs: getCertificationRuns(),
    activeRun: getActiveCertificationRun(),
    tests: defaultContractTests(),
    results: Object.values(state.results).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone),
    findings: getRuntimeReadinessFindings(),
    status: getCertificationStatus(),
    sandboxSafety: getSandboxSafetyStatus(),
    artifacts: getCertificationArtifacts(),
  };
}

function exportArtifact(id: string, name: string, contentText: string, type: Artifact['type'] = 'report'): Artifact {
  return { id, runId: DEMO_RUN_ID, type, name, source: 'mock', contentSummary: `Runtime certification export for ${DEMO_RUN_ID}`, contentText, createdAt: nowIso() };
}

export function exportCertificationReport(): ArtifactRecord[] {
  const dashboard = getRuntimeCertificationDashboard();
  const artifacts = [
    exportArtifact(`artifact-${DEMO_RUN_ID}-runtime-certification-report-md`, 'runtime-certification-report.md', ['# Runtime Certification Report', '', `Status: ${dashboard.status}`, `Profiles: ${dashboard.profiles.length}`, `Runs: ${dashboard.runs.length}`, `Findings: ${dashboard.findings.length}`, ''].join('\n'), 'markdown'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-runtime-contract-results-json`, 'runtime-contract-results.json', JSON.stringify(dashboard.results, null, 2), 'json'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-sandbox-safety-report-md`, 'sandbox-safety-report.md', ['# Sandbox Safety Report', '', `Safe: ${dashboard.sandboxSafety.safe}`, `Production endpoint detected: ${dashboard.sandboxSafety.productionEndpointDetected}`, dashboard.sandboxSafety.message, ''].join('\n'), 'markdown'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-certification-readiness-md`, 'certification-readiness.md', ['# Certification Readiness', '', ...dashboard.findings.map((finding) => `- ${finding.severity}: ${finding.message}`), ''].join('\n'), 'markdown'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-runtime-blockers-json`, 'runtime-blockers.json', JSON.stringify(dashboard.runs.flatMap((run) => run.blockers.map((blocker) => ({ runId: run.id, blocker }))), null, 2), 'json'),
  ];
  const records = artifacts.map((artifact) => registerArtifact(artifact, { type: 'AUDIT', metadata: { runId: DEMO_RUN_ID, tags: ['runtime-certification', 'sandbox-contract'] } }));
  const state = readState();
  writeState({ ...state, artifacts: { ...state.artifacts, ...Object.fromEntries(records.map((artifact) => [artifact.name, artifact.id])) } });
  return records;
}

export function clearRuntimeCertificationStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(RUNTIME_CERTIFICATION_KEY);
}
