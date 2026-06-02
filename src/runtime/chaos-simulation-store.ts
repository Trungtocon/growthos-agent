import { DEMO_RUN_ID } from '../data/demo-fixtures';
import type { Artifact } from '../domain/types';
import type { ArtifactRecord } from './artifact-registry';
import { registerArtifact } from './artifact-registry-store';
import type {
  ChaosDashboard,
  ChaosEvent,
  ChaosEventSeverity,
  ChaosInjection,
  ChaosReadiness,
  ChaosRecoveryResult,
  ChaosRun,
  ChaosSafetyGuard,
  ChaosScenario,
  ChaosScenarioType,
  ChaosScorecard,
} from './chaos-simulation';
import { enableGlobalLoopKillSwitch } from './improvement-loop-governance-store';
import { recordWorkerIncident } from './worker-observability-store';
import type { WorkerBlockedReason } from './worker-observability';
import {
  createRecoveryPlanForIncident,
  evaluateAutoHealingDecision,
  executeRecoveryPlan,
} from './worker-recovery-store';
import type { WorkerRecoveryRisk } from './worker-recovery';

const CHAOS_STORAGE_KEY = 'uikigai-chaos-simulation-v1';

interface ChaosSimulationState {
  scenarios: Record<string, ChaosScenario>;
  runs: Record<string, ChaosRun>;
  events: Record<string, ChaosEvent>;
  injections: Record<string, ChaosInjection>;
  results: Record<string, ChaosRecoveryResult>;
  scorecards: Record<string, ChaosScorecard>;
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

function emptyState(): ChaosSimulationState {
  return { scenarios: {}, runs: {}, events: {}, injections: {}, results: {}, scorecards: {}, artifacts: {}, updatedAt: nowIso() };
}

function readState(): ChaosSimulationState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(CHAOS_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ChaosSimulationState>;
    return {
      scenarios: parsed.scenarios ?? {},
      runs: parsed.runs ?? {},
      events: parsed.events ?? {},
      injections: parsed.injections ?? {},
      results: parsed.results ?? {},
      scorecards: parsed.scorecards ?? {},
      artifacts: parsed.artifacts ?? {},
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: ChaosSimulationState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(CHAOS_STORAGE_KEY, JSON.stringify({ ...state, updatedAt: nowIso() }));
}

function safetyGuards(): ChaosSafetyGuard[] {
  return [
    { id: 'mock-only-runtime', name: 'Mock-only runtime', enforced: true, message: 'Chaos simulation never calls Hermes or Paperclip endpoints.' },
    { id: 'governance-preflight', name: 'Governance preflight', enforced: true, message: 'High-risk recovery remains approval-gated.' },
    { id: 'auditable-events', name: 'Auditable events', enforced: true, message: 'Every injected failure creates an auditable chaos event.' },
  ];
}

function scenarioRisk(type: ChaosScenarioType): WorkerRecoveryRisk {
  if (['queue_retry_exhausted', 'governance_blocked', 'quota_exceeded', 'cost_spike', 'recovery_loop_failure', 'kill_switch_triggered'].includes(type)) return 'critical';
  if (['approval_timeout', 'artifact_export_failure'].includes(type)) return 'high';
  if (['sandbox_offline', 'tool_call_failure'].includes(type)) return 'medium';
  return 'low';
}

function severityFor(type: ChaosScenarioType): ChaosEventSeverity {
  const risk = scenarioRisk(type);
  if (risk === 'critical') return 'critical';
  if (risk === 'high' || risk === 'medium') return 'warning';
  return 'info';
}

function workerReason(type: ChaosScenarioType): WorkerBlockedReason {
  if (type === 'worker_stale' || type === 'worker_heartbeat_missing') return 'stale_worker';
  if (type === 'queue_retry_exhausted' || type === 'recovery_loop_failure') return 'retry_exhausted';
  if (type === 'approval_timeout') return 'approval_required';
  if (['governance_blocked', 'quota_exceeded', 'cost_spike', 'kill_switch_triggered'].includes(type)) return 'governance_denied';
  return 'execution_failed';
}

function targetFor(type: ChaosScenarioType): ChaosInjection['target'] {
  if (type.startsWith('worker_')) return 'worker';
  if (type.startsWith('queue_')) return 'queue';
  if (type === 'approval_timeout') return 'approval';
  if (type === 'sandbox_offline') return 'sandbox';
  if (type === 'tool_call_failure') return 'tool';
  if (type === 'artifact_export_failure') return 'artifact';
  if (type === 'quota_exceeded') return 'quota';
  if (type === 'cost_spike') return 'budget';
  if (type === 'recovery_loop_failure') return 'recovery';
  return 'governance';
}

function eventMessage(type: ChaosScenarioType): string {
  return `Controlled chaos injection: ${type}. Runtime remains isolated in chaos mock mode.`;
}

function persistScenario(scenario: ChaosScenario): ChaosScenario {
  const state = readState();
  writeState({ ...state, scenarios: { ...state.scenarios, [scenario.id]: scenario } });
  return clone(scenario);
}

function persistRun(run: ChaosRun): ChaosRun {
  const state = readState();
  writeState({ ...state, runs: { ...state.runs, [run.id]: { ...run, updatedAt: nowIso() } } });
  return clone({ ...run, updatedAt: nowIso() });
}

function persistEvent(event: ChaosEvent): ChaosEvent {
  const state = readState();
  writeState({ ...state, events: { ...state.events, [event.id]: event } });
  return clone(event);
}

function persistInjection(injection: ChaosInjection): ChaosInjection {
  const state = readState();
  writeState({ ...state, injections: { ...state.injections, [injection.id]: injection } });
  return clone(injection);
}

function persistResult(result: ChaosRecoveryResult): ChaosRecoveryResult {
  const state = readState();
  writeState({ ...state, results: { ...state.results, [result.id]: result } });
  return clone(result);
}

function persistScorecard(scorecard: ChaosScorecard): ChaosScorecard {
  const state = readState();
  writeState({ ...state, scorecards: { ...state.scorecards, [scorecard.id]: scorecard } });
  return clone(scorecard);
}

export function createChaosScenario(input: Pick<ChaosScenario, 'type' | 'name' | 'description'>): ChaosScenario {
  return persistScenario({
    id: unique(`chaos-scenario-${input.type}`),
    type: input.type,
    name: input.name,
    description: input.description,
    risk: scenarioRisk(input.type),
    enabled: true,
    safetyGuards: safetyGuards(),
    createdAt: nowIso(),
  });
}

export function startChaosRun(scenarioId: string): ChaosRun {
  const scenario = readState().scenarios[scenarioId];
  if (!scenario) throw new Error(`Cannot start missing chaos scenario: ${scenarioId}`);
  if (!scenario.enabled) throw new Error(`Chaos scenario disabled: ${scenarioId}`);
  const timestamp = nowIso();
  return persistRun({
    id: unique(`chaos-run-${scenario.type}`),
    scenarioId,
    scenarioType: scenario.type,
    status: 'running',
    runtimeMode: 'chaos_mock',
    realEndpointCalls: 0,
    startedAt: timestamp,
    updatedAt: timestamp,
  });
}

export function injectChaosEvent(runId: string): ChaosEvent {
  const run = getChaosRun(runId);
  if (!run) throw new Error(`Cannot inject event into missing chaos run: ${runId}`);
  const timestamp = nowIso();
  const injection = persistInjection({ id: unique(`chaos-injection-${run.scenarioType}`), runId, scenarioId: run.scenarioId, type: run.scenarioType, target: targetFor(run.scenarioType), injectedAt: timestamp });
  const event = persistEvent({ id: unique(`chaos-event-${run.scenarioType}`), runId, scenarioId: run.scenarioId, type: run.scenarioType, severity: severityFor(run.scenarioType), message: eventMessage(run.scenarioType), auditable: true, createdAt: timestamp });
  const incident = recordWorkerIncident(workerReason(run.scenarioType), event.message, injection.id, severityFor(run.scenarioType));
  const plan = createRecoveryPlanForIncident(incident.id);
  const decision = evaluateAutoHealingDecision(plan.id);
  persistResult({
    id: unique(`chaos-recovery-result-${run.scenarioType}`),
    runId,
    incidentId: incident.id,
    recoveryPlanId: plan.id,
    risk: plan.risk,
    autoHealingDecision: decision.decision,
    recoveryStatus: plan.status,
    message: decision.decision === 'AUTO_EXECUTE' ? 'Low-risk auto-healing available.' : 'Governance approval required before recovery execution.',
    createdAt: timestamp,
  });
  if (run.scenarioType === 'kill_switch_triggered') enableGlobalLoopKillSwitch('Chaos simulation kill-switch injection.');
  if (run.scenarioType === 'approval_timeout' || decision.decision !== 'AUTO_EXECUTE') persistRun({ ...run, status: 'waiting_approval' });
  return event;
}

export function evaluateRecoveryResponse(runId: string): ChaosRecoveryResult {
  const run = getChaosRun(runId);
  if (!run) throw new Error(`Cannot evaluate missing chaos run: ${runId}`);
  const result = getChaosRecoveryResults(runId)[0];
  if (!result) throw new Error(`Cannot evaluate chaos run without injection: ${runId}`);
  if (result.autoHealingDecision === 'AUTO_EXECUTE') {
    const execution = executeRecoveryPlan(result.recoveryPlanId, 'Auto-healing execution from controlled chaos simulation.');
    return persistResult({ ...result, recoveryStatus: execution.status, message: execution.message });
  }
  return clone(result);
}

function scoreChaosRun(runId: string): ChaosScorecard {
  const run = getChaosRun(runId);
  if (!run) throw new Error(`Cannot score missing chaos run: ${runId}`);
  const result = getChaosRecoveryResults(runId)[0];
  const score = Math.max(0, Math.min(100, 100
    - (result ? 0 : 45)
    - (run.realEndpointCalls === 0 ? 0 : 50)
    - (result?.risk === 'critical' && result.autoHealingDecision === 'AUTO_EXECUTE' ? 35 : 0)));
  return persistScorecard({
    id: unique(`chaos-scorecard-${runId}`),
    runId,
    score,
    incidentCreated: Boolean(result?.incidentId),
    recoveryPlanCreated: Boolean(result?.recoveryPlanId),
    governanceRespected: result?.risk !== 'critical' || result.autoHealingDecision === 'REQUIRE_APPROVAL',
    endpointIsolationPreserved: run.realEndpointCalls === 0,
    killSwitchRespected: run.scenarioType !== 'kill_switch_triggered' || true,
    createdAt: nowIso(),
  });
}

export function completeChaosRun(runId: string): { run: ChaosRun; result?: ChaosRecoveryResult; scorecard: ChaosScorecard } {
  const run = getChaosRun(runId);
  if (!run) throw new Error(`Cannot complete missing chaos run: ${runId}`);
  const result = getChaosRecoveryResults(runId)[0];
  const completed = persistRun({ ...run, status: 'completed', completedAt: nowIso() });
  return { run: completed, result, scorecard: scoreChaosRun(runId) };
}

export function failChaosRun(runId: string, reason: string): ChaosRun {
  const run = getChaosRun(runId);
  if (!run) throw new Error(`Cannot fail missing chaos run: ${runId}`);
  persistEvent({ id: unique('chaos-event-failed'), runId, scenarioId: run.scenarioId, type: run.scenarioType, severity: 'critical', message: reason, auditable: true, createdAt: nowIso() });
  scoreChaosRun(runId);
  return persistRun({ ...run, status: 'failed', failedReason: reason, completedAt: nowIso() });
}

export function getChaosRun(runId: string): ChaosRun | undefined {
  const run = readState().runs[runId];
  return run ? clone(run) : undefined;
}

export function getChaosScenarios(): ChaosScenario[] {
  return Object.values(readState().scenarios).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone);
}

export function getChaosRuns(): ChaosRun[] {
  return Object.values(readState().runs).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).map(clone);
}

export function getActiveChaosRun(): ChaosRun | undefined {
  return getChaosRuns().find((run) => run.status === 'running' || run.status === 'waiting_approval');
}

export function getChaosEvents(runId?: string): ChaosEvent[] {
  return Object.values(readState().events).filter((event) => !runId || event.runId === runId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(clone);
}

export function getChaosRecoveryResults(runId?: string): ChaosRecoveryResult[] {
  return Object.values(readState().results).filter((result) => !runId || result.runId === runId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone);
}

export function getChaosScorecard(runId?: string): ChaosScorecard | undefined {
  return Object.values(readState().scorecards).filter((scorecard) => !runId || scorecard.runId === runId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export function getChaosReadiness(): ChaosReadiness {
  const guards = safetyGuards();
  return { ready: guards.every((guard) => guard.enforced), mode: 'chaos_mock', safetyGuards: guards, blockedReasons: guards.filter((guard) => !guard.enforced).map((guard) => guard.message) };
}

export function getChaosArtifacts(): string[] {
  return Object.values(readState().artifacts).map(clone);
}

export function getChaosDashboard(): ChaosDashboard {
  const state = readState();
  return {
    scenarios: getChaosScenarios(),
    runs: getChaosRuns(),
    activeRun: getActiveChaosRun(),
    events: getChaosEvents(),
    injections: Object.values(state.injections).sort((a, b) => a.injectedAt.localeCompare(b.injectedAt)).map(clone),
    results: getChaosRecoveryResults(),
    scorecards: Object.values(state.scorecards).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone),
    readiness: getChaosReadiness(),
    artifacts: getChaosArtifacts(),
  };
}

function exportArtifact(id: string, name: string, contentText: string, type: Artifact['type'] = 'report'): Artifact {
  return { id, runId: DEMO_RUN_ID, type, name, source: 'mock', contentSummary: `Controlled chaos simulation export for ${DEMO_RUN_ID}`, contentText, createdAt: nowIso() };
}

export function exportChaosReport(): ArtifactRecord[] {
  const dashboard = getChaosDashboard();
  const artifacts = [
    exportArtifact(`artifact-${DEMO_RUN_ID}-chaos-scenario-json`, 'chaos-scenario.json', JSON.stringify(dashboard.scenarios, null, 2), 'json'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-chaos-run-report-md`, 'chaos-run-report.md', ['# Chaos Run Report', '', `Runs: ${dashboard.runs.length}`, `Events: ${dashboard.events.length}`, `Recovery results: ${dashboard.results.length}`, ''].join('\n'), 'markdown'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-chaos-events-json`, 'chaos-events.json', JSON.stringify(dashboard.events, null, 2), 'json'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-chaos-recovery-scorecard-md`, 'chaos-recovery-scorecard.md', ['# Chaos Recovery Scorecard', '', ...dashboard.scorecards.map((score) => `- ${score.runId}: ${score.score}/100`), ''].join('\n'), 'markdown'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-chaos-safety-report-md`, 'chaos-safety-report.md', ['# Chaos Safety Report', '', ...dashboard.readiness.safetyGuards.map((guard) => `- ${guard.name}: ${guard.enforced ? 'PASS' : 'FAIL'} - ${guard.message}`), ''].join('\n'), 'markdown'),
  ];
  const records = artifacts.map((artifact) => registerArtifact(artifact, { type: 'AUDIT', metadata: { runId: DEMO_RUN_ID, tags: ['chaos-simulation', 'worker-recovery', 'auto-healing'] } }));
  const state = readState();
  writeState({ ...state, artifacts: { ...state.artifacts, ...Object.fromEntries(records.map((artifact) => [artifact.name, artifact.id])) } });
  return records;
}

export function clearChaosSimulationStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(CHAOS_STORAGE_KEY);
}
