import { DEMO_AGENT_ID, DEMO_RUN_ID, DEMO_TICKET_ID, demoWorkspace } from '../data/demo-fixtures';
import type { Artifact } from '../domain/types';
import { recordArtifactUsage, recordRunStartUsage, recordToolCompletionUsage, recordToolStartUsage } from '../integrations/growthos-runtime/usage-ledger';
import type { RuntimeToolCall } from '../integrations/growthos-runtime/runtime-types';
import { upsertArtifact } from '../runtime-store/artifact-store';
import { getToolCallsByRun, upsertRuntimeToolCall } from '../runtime-store/tool-call-store';
import { getUsageByRun } from '../runtime-store/usage-ledger-store';
import { registerArtifact } from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import { getGovernanceReadinessReport } from './governance-readiness-store';
import { registerLearningMemoryExports } from './learning-memory-store';
import { evaluateRun } from './run-evaluation-store';
import { getCertificationStatus, getSandboxSafetyStatus, getRuntimeReadinessFindings } from './runtime-certification-store';
import type {
  CertifiedSandboxArtifact,
  CertifiedSandboxAuditEvent,
  CertifiedSandboxBlocker,
  CertifiedSandboxDashboard,
  CertifiedSandboxHealth,
  CertifiedSandboxPreflight,
  CertifiedSandboxResult,
  CertifiedSandboxRun,
  CertifiedSandboxRunStatus,
  CertifiedSandboxRuntimeMode,
  CertifiedSandboxStep,
} from './certified-sandbox-run';

const CERTIFIED_SANDBOX_KEY = 'uikigai-certified-sandbox-run-v1';

interface CertifiedSandboxRunState {
  runs: Record<string, CertifiedSandboxRun>;
  steps: Record<string, CertifiedSandboxStep>;
  preflights: Record<string, CertifiedSandboxPreflight>;
  blockers: Record<string, CertifiedSandboxBlocker>;
  artifacts: Record<string, CertifiedSandboxArtifact>;
  results: Record<string, CertifiedSandboxResult>;
  auditEvents: Record<string, CertifiedSandboxAuditEvent>;
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

function emptyState(): CertifiedSandboxRunState {
  return { runs: {}, steps: {}, preflights: {}, blockers: {}, artifacts: {}, results: {}, auditEvents: {}, updatedAt: nowIso() };
}

function readState(): CertifiedSandboxRunState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(CERTIFIED_SANDBOX_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<CertifiedSandboxRunState>;
    return {
      runs: parsed.runs ?? {},
      steps: parsed.steps ?? {},
      preflights: parsed.preflights ?? {},
      blockers: parsed.blockers ?? {},
      artifacts: parsed.artifacts ?? {},
      results: parsed.results ?? {},
      auditEvents: parsed.auditEvents ?? {},
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: CertifiedSandboxRunState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(CERTIFIED_SANDBOX_KEY, JSON.stringify({ ...state, updatedAt: nowIso() }));
}

function updateState(updater: (state: CertifiedSandboxRunState) => CertifiedSandboxRunState): CertifiedSandboxRunState {
  const next = updater(readState());
  writeState(next);
  return next;
}

function persistRun(run: CertifiedSandboxRun): CertifiedSandboxRun {
  const updated = { ...run, updatedAt: nowIso() };
  updateState((state) => ({ ...state, runs: { ...state.runs, [updated.id]: updated } }));
  return clone(updated);
}

function persistSteps(steps: CertifiedSandboxStep[]): CertifiedSandboxStep[] {
  updateState((state) => ({ ...state, steps: { ...state.steps, ...Object.fromEntries(steps.map((step) => [step.id, step])) } }));
  return steps.map(clone);
}

function persistPreflight(preflight: CertifiedSandboxPreflight): CertifiedSandboxPreflight {
  updateState((state) => ({
    ...state,
    preflights: { ...state.preflights, [preflight.runId]: preflight },
    blockers: { ...state.blockers, ...Object.fromEntries(preflight.blockers.map((blocker) => [blocker.id, blocker])) },
  }));
  return clone(preflight);
}

function persistResult(result: CertifiedSandboxResult): CertifiedSandboxResult {
  updateState((state) => ({ ...state, results: { ...state.results, [result.id]: result } }));
  return clone(result);
}

function persistCertifiedArtifact(artifact: CertifiedSandboxArtifact): CertifiedSandboxArtifact {
  updateState((state) => ({ ...state, artifacts: { ...state.artifacts, [artifact.id]: artifact } }));
  return clone(artifact);
}

function audit(runId: string, type: CertifiedSandboxAuditEvent['type'], message: string, metadata: Record<string, unknown> = {}): CertifiedSandboxAuditEvent {
  const event: CertifiedSandboxAuditEvent = { id: unique(`certified-sandbox-audit-${runId}`), runId, type, message, timestamp: nowIso(), metadata };
  updateState((state) => ({ ...state, auditEvents: { ...state.auditEvents, [event.id]: event } }));
  return clone(event);
}

function defaultSteps(runId: string): CertifiedSandboxStep[] {
  return [
    ['create-ticket', 'Create ticket', 'Create a demo ticket request for the certified sandbox run.'],
    ['create-run-plan', 'Create run plan', 'Resolve a run plan from capability readiness and workflow requirements.'],
    ['capability-readiness', 'Check capability readiness', 'Verify tool registry and capability readiness before execution.'],
    ['governance-decision', 'Evaluate governance decision', 'Run enterprise governance preflight before runtime execution.'],
    ['approval-requirement', 'Evaluate approval requirement', 'Hold execution when certification warnings require review.'],
    ['start-run', 'Start certified sandbox run', 'Start the mock-safe Hermes/Paperclip execution flow.'],
    ['execute-tool', 'Execute tool call', 'Run a deterministic Hermes-style tool call.'],
    ['produce-artifact', 'Produce Paperclip artifact', 'Create and register a Paperclip-compatible runtime artifact.'],
    ['usage-ledger', 'Update usage ledger', 'Record runtime, tool, token, duration and artifact usage.'],
    ['evaluation-score', 'Update evaluation score', 'Refresh run evaluation from registered runtime evidence.'],
    ['learning-memory', 'Update learning memory', 'Record a learning-memory sync event and export learning evidence.'],
    ['final-export', 'Export final report', 'Generate certified sandbox final report artifacts.'],
  ].map(([id, name, description], index) => ({
    id: `${runId}-${id}`,
    runId,
    order: index + 1,
    name,
    description,
    status: 'pending',
  }));
}

function isProductionUrl(url = ''): boolean {
  return /(^|[./-])(prod|production)([./-]|$)/i.test(url) || /api\.hermes\./i.test(url) || /api\.paperclip\./i.test(url);
}

function blocker(runId: string, code: CertifiedSandboxBlocker['code'], message: string): CertifiedSandboxBlocker {
  return { id: `certified-sandbox-blocker-${runId}-${code}`, runId, code, message, severity: 'blocking', createdAt: nowIso() };
}

function getRunOrThrow(runId: string): CertifiedSandboxRun {
  const run = readState().runs[runId];
  if (!run) throw new Error(`Cannot find certified sandbox run: ${runId}`);
  return run;
}

function setRunStatus(runId: string, status: CertifiedSandboxRunStatus, extra: Partial<CertifiedSandboxRun> = {}): CertifiedSandboxRun {
  const existing = getRunOrThrow(runId);
  return persistRun({ ...existing, ...extra, status });
}

function completeSteps(runId: string, throughOrder: number): CertifiedSandboxStep[] {
  const timestamp = nowIso();
  const existing = getCertifiedSandboxSteps(runId);
  const next = existing.map((step) => step.order <= throughOrder ? { ...step, status: 'completed' as const, startedAt: step.startedAt ?? timestamp, completedAt: timestamp } : step);
  return persistSteps(next);
}

function runtimeToolCall(runId: string): RuntimeToolCall {
  const timestamp = nowIso();
  return {
    id: `certified-sandbox-tool-${runId}`,
    runId: DEMO_RUN_ID,
    toolName: 'CertifiedSandboxWorkflow',
    status: 'completed',
    startedAt: timestamp,
    finishedAt: timestamp,
    input: 'Certified Hermes/Paperclip sandbox workflow request',
    output: 'Sandbox workflow completed and produced Paperclip artifact.',
    durationMs: 1800,
    metadata: { certifiedRunId: runId, source: 'certified-sandbox-run' },
  };
}

function runtimeArtifact(runId: string, toolId: string): Artifact {
  return {
    id: `artifact-${DEMO_RUN_ID}-certified-sandbox-output`,
    runId: DEMO_RUN_ID,
    toolId,
    type: 'markdown',
    name: 'certified-sandbox-output.md',
    source: 'paperclip',
    contentSummary: 'Certified sandbox Hermes/Paperclip run output.',
    contentText: ['# Certified Sandbox Output', '', `Certified run: ${runId}`, `Workflow run: ${DEMO_RUN_ID}`, 'Status: completed', ''].join('\n'),
    createdAt: nowIso(),
    sizeBytes: 1240,
  };
}

function exportArtifact(id: string, name: string, contentText: string, type: Artifact['type'] = 'report'): Artifact {
  return { id, runId: DEMO_RUN_ID, type, name, source: 'mock', contentSummary: `Certified sandbox export for ${DEMO_RUN_ID}`, contentText, createdAt: nowIso() };
}

function storeExportRecords(runId: string, records: ArtifactRecord[]): CertifiedSandboxArtifact[] {
  return records.map((record) => persistCertifiedArtifact({
    id: `certified-sandbox-artifact-${runId}-${record.id}`,
    runId,
    artifactRecordId: record.id,
    name: record.name,
    type: record.type,
    createdAt: nowIso(),
  }));
}

export function createCertifiedSandboxRun(input: {
  ticketId?: string;
  certificationRunId?: string;
  runtimeMode?: CertifiedSandboxRuntimeMode;
  sandboxBaseUrl?: string;
  sandboxHealth?: CertifiedSandboxHealth;
  governanceBlockers?: string[];
} = {}): CertifiedSandboxRun {
  const id = unique('certified-sandbox-run');
  const certificationStatus = input.certificationRunId ? getCertificationStatus(input.certificationRunId) : 'not_started';
  const status: CertifiedSandboxRunStatus = certificationStatus === 'passed' || certificationStatus === 'certified' ? 'draft' : 'waiting_certification';
  const run = persistRun({
    id,
    ticketId: input.ticketId ?? DEMO_TICKET_ID,
    workflowRunId: DEMO_RUN_ID,
    certificationRunId: input.certificationRunId,
    runtimeMode: input.runtimeMode ?? 'mock',
    sandboxBaseUrl: input.sandboxBaseUrl,
    sandboxHealth: input.sandboxHealth ?? (input.runtimeMode === 'sandbox' ? 'online' : 'missing_config'),
    governanceBlockers: input.governanceBlockers ?? [],
    approvalRequired: false,
    approvalApproved: false,
    status,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  persistSteps(defaultSteps(run.id));
  audit(run.id, 'run.created', `Certified sandbox run created for ${run.ticketId}.`, { certificationStatus });
  return run;
}

export function evaluateCertifiedSandboxPreflight(runId: string): CertifiedSandboxPreflight {
  const run = getRunOrThrow(runId);
  const certificationStatus = run.certificationRunId ? getCertificationStatus(run.certificationRunId) : 'not_started';
  const safety = getSandboxSafetyStatus(run.certificationRunId);
  const governance = getGovernanceReadinessReport();
  const certificationFindings = run.certificationRunId ? getRuntimeReadinessFindings(run.certificationRunId) : [];
  const blockers: CertifiedSandboxBlocker[] = [];
  const warnings: string[] = [];

  if (!run.certificationRunId) blockers.push(blocker(run.id, 'certification_missing', 'Runtime certification must exist before certified sandbox execution.'));
  if (run.certificationRunId && !['passed', 'certified', 'warning'].includes(certificationStatus)) blockers.push(blocker(run.id, 'certification_not_passed', `Runtime certification status is ${certificationStatus}.`));
  if (run.runtimeMode === 'production') blockers.push(blocker(run.id, 'production_runtime_mode', 'Production runtime mode is not allowed in certified sandbox execution.'));
  if (isProductionUrl(run.sandboxBaseUrl) || safety.productionEndpointDetected) blockers.push(blocker(run.id, 'production_endpoint_detected', 'Production-looking Hermes/Paperclip endpoint detected.'));
  if (run.sandboxHealth === 'offline') blockers.push(blocker(run.id, 'sandbox_offline', 'Sandbox health is offline.'));
  const governanceBlockers = [...run.governanceBlockers, ...governance.blockedReasons];
  governanceBlockers.forEach((reason, index) => blockers.push(blocker(run.id, 'governance_blocker', `${index + 1}. ${reason}`)));

  if (run.runtimeMode === 'mock' && !run.sandboxBaseUrl) warnings.push('Sandbox env is missing; mock fallback remains active.');
  if (certificationStatus === 'warning') warnings.push('Runtime certification has warnings and requires approval before execution.');
  if (run.sandboxHealth === 'degraded' || run.sandboxHealth === 'missing_config') warnings.push(`Sandbox health is ${run.sandboxHealth}.`);
  const certificationWarnings = certificationFindings.filter((finding) => finding.severity === 'warning').map((finding) => finding.message);
  warnings.push(...certificationWarnings);
  const approvalRequired = warnings.length > 0;
  const status: CertifiedSandboxPreflight['status'] = blockers.length ? 'blocked' : warnings.length ? 'warning' : 'ready';
  const preflight = persistPreflight({
    runId,
    status,
    certificationStatus,
    sandboxHealth: run.sandboxHealth,
    runtimeMode: run.runtimeMode,
    blockers,
    warnings,
    approvalRequired,
    evaluatedAt: nowIso(),
  });
  const nextStatus: CertifiedSandboxRunStatus = status === 'blocked' ? 'blocked' : status === 'warning' ? 'waiting_approval' : 'ready';
  persistRun({ ...run, approvalRequired, status: nextStatus });
  audit(runId, status === 'blocked' ? 'preflight.blocked' : 'preflight.evaluated', `Certified sandbox preflight ${status}.`, { blockers: blockers.length, warnings: warnings.length });
  if (approvalRequired) audit(runId, 'approval.required', 'Certification warnings require approval before execution.', { warnings });
  return preflight;
}

function executeCertifiedSandboxFlow(runId: string): CertifiedSandboxRun {
  const run = setRunStatus(runId, 'running', { startedAt: nowIso() });
  completeSteps(runId, 8);
  audit(runId, 'run.started', 'Certified sandbox execution started.', { workflowRunId: DEMO_RUN_ID });
  recordRunStartUsage(DEMO_RUN_ID, 0.012, { certifiedSandboxRunId: runId });
  const toolCall = upsertRuntimeToolCall(runtimeToolCall(runId));
  recordToolStartUsage(DEMO_RUN_ID, toolCall.id, toolCall.toolName, 0.018);
  const usage = recordToolCompletionUsage({ runId: DEMO_RUN_ID, toolId: toolCall.id, toolName: toolCall.toolName, durationMs: toolCall.durationMs, estimatedCost: 0.024, actualCost: 0.026 });
  audit(runId, 'tool.completed', `${toolCall.toolName} completed.`, { toolCallId: toolCall.id });
  const artifact = upsertArtifact(runtimeArtifact(runId, toolCall.id));
  recordArtifactUsage(DEMO_RUN_ID, artifact.id, toolCall.id);
  const record = registerArtifact(artifact, { type: 'RUNTIME_OUTPUT', metadata: { runId: DEMO_RUN_ID, ticketId: DEMO_TICKET_ID, agentId: DEMO_AGENT_ID, tags: ['certified-sandbox', 'paperclip', 'runtime-output'] } });
  persistCertifiedArtifact({ id: `certified-sandbox-artifact-${runId}-${record.id}`, runId, artifactRecordId: record.id, name: record.name, type: record.type, createdAt: nowIso() });
  audit(runId, 'artifact.created', 'Paperclip artifact produced and registered.', { artifactId: artifact.id, recordId: record.id });
  audit(runId, 'usage.updated', 'Usage ledger updated for certified sandbox execution.', { usageRecords: getUsageByRun(DEMO_RUN_ID).length });
  const evaluation = evaluateRun(DEMO_RUN_ID);
  completeSteps(runId, 11);
  audit(runId, 'evaluation.updated', `Run evaluation refreshed with score ${evaluation.overallScore}.`, { evaluationId: evaluation.id });
  const learningExports = registerLearningMemoryExports(DEMO_RUN_ID);
  audit(runId, 'learning_memory.updated', 'Learning memory export snapshot registered after certified sandbox run.', { artifacts: learningExports.length });
  persistResult({
    id: `certified-sandbox-result-${runId}`,
    runId,
    workflowRunId: DEMO_RUN_ID,
    toolCallId: toolCall.id,
    artifactIds: [record.id, ...learningExports.map((item) => item.id)],
    usageRecordIds: usage.map((item) => item.id),
    evaluationScore: evaluation.overallScore,
    learningMemoryUpdated: true,
  });
  return run;
}

export function startCertifiedSandboxRun(runId: string): CertifiedSandboxRun {
  const existing = getRunOrThrow(runId);
  const preflight = evaluateCertifiedSandboxPreflight(runId);
  if (preflight.status === 'blocked') return setRunStatus(runId, 'blocked');
  if (preflight.approvalRequired && !existing.approvalApproved) return setRunStatus(runId, 'waiting_approval');
  return executeCertifiedSandboxFlow(runId);
}

export function approveCertifiedSandboxRun(runId: string): CertifiedSandboxRun {
  const run = getRunOrThrow(runId);
  audit(runId, 'approval.approved', 'Certified sandbox warning approval granted.');
  persistRun({ ...run, approvalApproved: true });
  return executeCertifiedSandboxFlow(runId);
}

export function rejectCertifiedSandboxRun(runId: string): CertifiedSandboxRun {
  const run = setRunStatus(runId, 'blocked', { approvalApproved: false });
  audit(runId, 'approval.rejected', 'Certified sandbox approval rejected.');
  return run;
}

export function completeCertifiedSandboxRun(runId: string): CertifiedSandboxRun {
  const result = readState().results[`certified-sandbox-result-${runId}`];
  if (!result) executeCertifiedSandboxFlow(runId);
  completeSteps(runId, 12);
  const records = exportCertifiedSandboxRunArtifacts(runId);
  const run = setRunStatus(runId, 'completed', { completedAt: nowIso() });
  const existingResult = readState().results[`certified-sandbox-result-${runId}`];
  if (existingResult) persistResult({ ...existingResult, completedAt: run.completedAt, artifactIds: [...new Set([...existingResult.artifactIds, ...records.map((item) => item.id)])] });
  audit(runId, 'run.completed', 'Certified sandbox run completed.', { artifacts: records.length });
  return run;
}

export function failCertifiedSandboxRun(runId: string, reason = 'Certified sandbox run failed.'): CertifiedSandboxRun {
  const run = setRunStatus(runId, 'failed', { failedAt: nowIso(), failureReason: reason });
  audit(runId, 'run.failed', reason);
  return run;
}

export function cancelCertifiedSandboxRun(runId: string, reason = 'Certified sandbox run cancelled.'): CertifiedSandboxRun {
  const run = setRunStatus(runId, 'cancelled', { failureReason: reason });
  audit(runId, 'run.cancelled', reason);
  return run;
}

export function exportCertifiedSandboxRunArtifacts(runId: string): ArtifactRecord[] {
  const run = getRunOrThrow(runId);
  const preflight = getCertifiedSandboxPreflight(runId) ?? evaluateCertifiedSandboxPreflight(runId);
  const result = readState().results[`certified-sandbox-result-${runId}`];
  const auditTrail = getCertifiedSandboxAuditTrail(runId);
  const artifacts = [
    exportArtifact(`artifact-${DEMO_RUN_ID}-certified-sandbox-run-report-md`, 'certified-sandbox-run-report.md', ['# Certified Sandbox Run Report', '', `Run: ${run.id}`, `Status: ${run.status}`, `Runtime mode: ${run.runtimeMode}`, `Workflow run: ${run.workflowRunId}`, ''].join('\n'), 'markdown'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-certified-sandbox-run-json`, 'certified-sandbox-run.json', JSON.stringify(run, null, 2), 'json'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-certified-sandbox-preflight-md`, 'certified-sandbox-preflight.md', ['# Certified Sandbox Preflight', '', `Status: ${preflight.status}`, `Certification: ${preflight.certificationStatus}`, ...preflight.blockers.map((item) => `- BLOCKER: ${item.message}`), ...preflight.warnings.map((item) => `- WARNING: ${item}`), ''].join('\n'), 'markdown'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-certified-sandbox-audit-json`, 'certified-sandbox-audit.json', JSON.stringify(auditTrail, null, 2), 'json'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-certified-sandbox-artifacts-md`, 'certified-sandbox-artifacts.md', ['# Certified Sandbox Artifacts', '', ...getCertifiedSandboxArtifacts(runId).map((item) => `- ${item.name}: ${item.artifactRecordId}`), ''].join('\n'), 'markdown'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-certified-sandbox-final-summary-md`, 'certified-sandbox-final-summary.md', ['# Certified Sandbox Final Summary', '', `Result: ${result?.id ?? 'pending'}`, `Evaluation score: ${result?.evaluationScore ?? 'pending'}`, `Learning memory updated: ${Boolean(result?.learningMemoryUpdated)}`, ''].join('\n'), 'markdown'),
  ];
  const records = artifacts.map((artifact) => registerArtifact(artifact, { type: artifact.name.endsWith('.json') ? 'RUNTIME_OUTPUT' : 'REPORT', metadata: { runId: DEMO_RUN_ID, ticketId: DEMO_TICKET_ID, agentId: DEMO_AGENT_ID, tags: ['certified-sandbox', 'export'] } }));
  storeExportRecords(runId, records);
  audit(runId, 'artifacts.exported', 'Certified sandbox run artifacts exported.', { artifacts: records.length });
  return records;
}

export function getCertifiedSandboxRuns(): CertifiedSandboxRun[] {
  return Object.values(readState().runs).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone);
}

export function getActiveCertifiedSandboxRun(): CertifiedSandboxRun | undefined {
  return getCertifiedSandboxRuns().find((run) => ['draft', 'waiting_certification', 'blocked', 'ready', 'running', 'waiting_approval'].includes(run.status));
}

export function getCertifiedSandboxSteps(runId?: string): CertifiedSandboxStep[] {
  return Object.values(readState().steps).filter((step) => !runId || step.runId === runId).sort((a, b) => a.order - b.order).map(clone);
}

export function getCertifiedSandboxPreflight(runId?: string): CertifiedSandboxPreflight | undefined {
  const id = runId ?? getActiveCertifiedSandboxRun()?.id;
  if (!id) return undefined;
  const preflight = readState().preflights[id];
  return preflight ? clone(preflight) : undefined;
}

export function getCertifiedSandboxBlockers(runId?: string): CertifiedSandboxBlocker[] {
  return Object.values(readState().blockers).filter((blocker) => !runId || blocker.runId === runId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone);
}

export function getCertifiedSandboxArtifacts(runId?: string): CertifiedSandboxArtifact[] {
  return Object.values(readState().artifacts).filter((artifact) => !runId || artifact.runId === runId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone);
}

export function getCertifiedSandboxAuditTrail(runId?: string): CertifiedSandboxAuditEvent[] {
  return Object.values(readState().auditEvents).filter((event) => !runId || event.runId === runId).sort((a, b) => a.timestamp.localeCompare(b.timestamp)).map(clone);
}

export function getCertifiedSandboxResults(runId?: string): CertifiedSandboxResult[] {
  return Object.values(readState().results).filter((result) => !runId || result.runId === runId).map(clone);
}

export function getCertifiedSandboxReadinessStatus(runId?: string): CertifiedSandboxRunStatus | 'not_started' {
  const run = runId ? readState().runs[runId] : getActiveCertifiedSandboxRun();
  return run?.status ?? 'not_started';
}

export function getCertifiedSandboxRunDashboard(): CertifiedSandboxDashboard {
  const runs = getCertifiedSandboxRuns();
  const activeRun = getActiveCertifiedSandboxRun();
  return {
    runs,
    activeRun,
    steps: getCertifiedSandboxSteps(activeRun?.id),
    preflight: getCertifiedSandboxPreflight(activeRun?.id),
    blockers: getCertifiedSandboxBlockers(activeRun?.id),
    artifacts: getCertifiedSandboxArtifacts(activeRun?.id),
    auditTrail: getCertifiedSandboxAuditTrail(activeRun?.id),
    results: getCertifiedSandboxResults(activeRun?.id),
    status: activeRun?.status ?? 'not_started',
    readyRuns: runs.filter((run) => run.status === 'ready').length,
    runningRuns: runs.filter((run) => run.status === 'running').length,
    completedRuns: runs.filter((run) => run.status === 'completed').length,
    blockedRuns: runs.filter((run) => run.status === 'blocked').length,
  };
}

export function clearCertifiedSandboxRunStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(CERTIFIED_SANDBOX_KEY);
}
