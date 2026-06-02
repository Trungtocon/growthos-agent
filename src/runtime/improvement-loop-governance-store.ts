import { DEMO_RUN_ID, demoWorkspace } from '../data/demo-fixtures';
import type { Artifact } from '../domain/types';
import type { ArtifactRecord } from './artifact-registry';
import { registerArtifact } from './artifact-registry-store';
import type { ImprovementLoop, ImprovementLoopRun } from './improvement-loop';
import { getRecommendations } from './learning-memory-store';
import {
  defaultLoopGovernancePolicy,
  evaluateLoopGovernance,
  type ImprovementLoopGovernanceDecision,
  type ImprovementLoopGovernancePolicy,
  type ImprovementLoopKillSwitch,
  type LoopGovernanceAuditEvent,
  type LoopGovernanceBlockReason,
  type LoopGovernanceSummary,
  type LoopRollbackPlan,
} from './improvement-loop-governance';

const LOOP_STORAGE_KEY = 'uikigai-improvement-loop-v1';
const GOVERNANCE_STORAGE_KEY = 'uikigai-improvement-loop-governance-v1';

interface ImprovementLoopRawState {
  loops: Record<string, ImprovementLoop>;
  runs: Record<string, ImprovementLoopRun>;
  schedules: Record<string, unknown>;
  outcomes: Record<string, unknown>;
  updatedAt: string;
}

interface ImprovementLoopGovernanceStoreState {
  policies: Record<string, ImprovementLoopGovernancePolicy>;
  decisions: Record<string, ImprovementLoopGovernanceDecision>;
  killSwitch: ImprovementLoopKillSwitch;
  rollbackPlans: Record<string, LoopRollbackPlan>;
  auditEvents: Record<string, LoopGovernanceAuditEvent>;
  updatedAt: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function defaultKillSwitch(): ImprovementLoopKillSwitch {
  return { enabled: false, affectedLoopIds: [] };
}

function emptyState(): ImprovementLoopGovernanceStoreState {
  const policy = defaultLoopGovernancePolicy();
  return {
    policies: { [policy.id]: policy },
    decisions: {},
    killSwitch: defaultKillSwitch(),
    rollbackPlans: {},
    auditEvents: {},
    updatedAt: nowIso(),
  };
}

function readState(): ImprovementLoopGovernanceStoreState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(GOVERNANCE_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ImprovementLoopGovernanceStoreState>;
    const policy = defaultLoopGovernancePolicy();
    return {
      policies: { [policy.id]: policy, ...(parsed.policies ?? {}) },
      decisions: parsed.decisions ?? {},
      killSwitch: parsed.killSwitch ?? defaultKillSwitch(),
      rollbackPlans: parsed.rollbackPlans ?? {},
      auditEvents: parsed.auditEvents ?? {},
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: ImprovementLoopGovernanceStoreState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(GOVERNANCE_STORAGE_KEY, JSON.stringify(state));
}

function readLoopState(): ImprovementLoopRawState {
  if (typeof window === 'undefined') return { loops: {}, runs: {}, schedules: {}, outcomes: {}, updatedAt: nowIso() };
  try {
    const raw = window.sessionStorage.getItem(LOOP_STORAGE_KEY);
    if (!raw) return { loops: {}, runs: {}, schedules: {}, outcomes: {}, updatedAt: nowIso() };
    const parsed = JSON.parse(raw) as Partial<ImprovementLoopRawState>;
    return {
      loops: parsed.loops ?? {},
      runs: parsed.runs ?? {},
      schedules: parsed.schedules ?? {},
      outcomes: parsed.outcomes ?? {},
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return { loops: {}, runs: {}, schedules: {}, outcomes: {}, updatedAt: nowIso() };
  }
}

function writeLoopState(state: ImprovementLoopRawState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(LOOP_STORAGE_KEY, JSON.stringify({ ...state, updatedAt: nowIso() }));
}

function auditEvent(decision: ImprovementLoopGovernanceDecision): LoopGovernanceAuditEvent {
  return {
    id: `loop-governance-audit-${decision.id}`,
    loopId: decision.loopId,
    action: decision.action,
    decision: decision.decision,
    reasons: decision.reasons,
    message: decision.message,
    createdAt: nowIso(),
  };
}

function createRollbackPlan(loopId: string, reason: LoopGovernanceBlockReason = 'regression_detected'): LoopRollbackPlan {
  return {
    id: `loop-rollback-${loopId}`,
    loopId,
    reason,
    status: 'required',
    steps: [
      'Pause autonomous loop execution.',
      'Preserve latest recommendation execution evidence.',
      'Revert confidence and learning deltas if needed.',
      'Require manual review before next run.',
    ],
    createdAt: nowIso(),
  };
}

export function getLoopGovernancePolicy(): ImprovementLoopGovernancePolicy {
  const policy = Object.values(readState().policies)[0] ?? defaultLoopGovernancePolicy();
  return clone(policy);
}

export function getGlobalLoopKillSwitch(): ImprovementLoopKillSwitch {
  return clone(readState().killSwitch);
}

export function recordLoopGovernanceDecision(decision: ImprovementLoopGovernanceDecision): ImprovementLoopGovernanceDecision {
  const state = readState();
  const rollbackPlan = decision.decision === 'ROLLBACK_REQUIRED'
    ? createRollbackPlan(decision.loopId, decision.reasons[0] ?? 'regression_detected')
    : undefined;
  const event = auditEvent(decision);
  writeState({
    ...state,
    decisions: { ...state.decisions, [decision.id]: decision },
    rollbackPlans: rollbackPlan ? { ...state.rollbackPlans, [rollbackPlan.id]: rollbackPlan } : state.rollbackPlans,
    auditEvents: { ...state.auditEvents, [event.id]: event },
    updatedAt: nowIso(),
  });
  return clone(decision);
}

export function evaluateAndRecordLoopGovernance(
  loop: ImprovementLoop,
  runs: ImprovementLoopRun[],
  action: ImprovementLoopGovernanceDecision['action'],
): ImprovementLoopGovernanceDecision {
  const recommendation = getRecommendations().find((item) => item.id === loop.recommendationId);
  const decision = evaluateLoopGovernance(loop, runs, recommendation, getGlobalLoopKillSwitch(), getLoopGovernancePolicy(), action);
  return recordLoopGovernanceDecision(decision);
}

export function selectLoopGovernanceDecision(loopId: string): ImprovementLoopGovernanceDecision | undefined {
  return Object.values(readState().decisions).filter((decision) => decision.loopId === loopId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export function selectLoopBlockers(loopId: string): LoopGovernanceBlockReason[] {
  return selectLoopGovernanceDecision(loopId)?.reasons ?? [];
}

export function selectGlobalLoopKillSwitch(): ImprovementLoopKillSwitch {
  return getGlobalLoopKillSwitch();
}

export function selectPausedByGovernanceLoops(): ImprovementLoop[] {
  return Object.values(readLoopState().loops).filter((loop) => loop.status === 'paused' && (selectLoopGovernanceDecision(loop.id)?.decision === 'PAUSE' || getGlobalLoopKillSwitch().affectedLoopIds.includes(loop.id))).map(clone);
}

export function selectRollbackRequiredLoops(): ImprovementLoop[] {
  const rollbackLoopIds = new Set(Object.values(readState().rollbackPlans).filter((plan) => plan.status === 'required').map((plan) => plan.loopId));
  return Object.values(readLoopState().loops).filter((loop) => rollbackLoopIds.has(loop.id)).map(clone);
}

export function selectLoopGovernanceAuditTrail(loopId?: string): LoopGovernanceAuditEvent[] {
  return Object.values(readState().auditEvents)
    .filter((event) => !loopId || event.loopId === loopId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(clone);
}

export function selectWorkspaceLoopGovernanceSummary(): LoopGovernanceSummary {
  const decisions = Object.values(readState().decisions);
  return {
    totalDecisions: decisions.length,
    allowed: decisions.filter((decision) => decision.decision === 'ALLOW').length,
    paused: decisions.filter((decision) => decision.decision === 'PAUSE').length,
    blocked: decisions.filter((decision) => decision.decision === 'BLOCK' || decision.decision === 'REQUIRE_REVIEW').length,
    killed: decisions.filter((decision) => decision.decision === 'KILL').length,
    rollbackRequired: decisions.filter((decision) => decision.decision === 'ROLLBACK_REQUIRED').length,
    killSwitchEnabled: readState().killSwitch.enabled,
    generatedAt: nowIso(),
  };
}

export function enableGlobalLoopKillSwitch(reason = 'Manual kill switch enabled.'): ImprovementLoopKillSwitch {
  const loopState = readLoopState();
  const affectedLoopIds = Object.values(loopState.loops).filter((loop) => ['running', 'scheduled', 'waiting_review'].includes(loop.status)).map((loop) => loop.id);
  for (const loopId of affectedLoopIds) loopState.loops[loopId] = { ...loopState.loops[loopId], status: 'paused', updatedAt: nowIso() };
  for (const run of Object.values(loopState.runs)) {
    if (affectedLoopIds.includes(run.loopId) && run.status === 'running') loopState.runs[run.id] = { ...run, status: 'paused', updatedAt: nowIso() };
  }
  writeLoopState(loopState);
  const state = readState();
  const killSwitch = { enabled: true, reason, enabledAt: nowIso(), affectedLoopIds };
  const auditEvents = { ...state.auditEvents };
  for (const loopId of affectedLoopIds) {
    const event: LoopGovernanceAuditEvent = {
      id: `loop-governance-audit-kill-switch-${loopId}-${Date.now()}`,
      loopId,
      action: 'kill_switch',
      decision: 'KILL',
      reasons: ['manual_kill_switch'],
      message: reason,
      createdAt: nowIso(),
    };
    auditEvents[event.id] = event;
  }
  writeState({ ...state, killSwitch, auditEvents, updatedAt: nowIso() });
  return clone(killSwitch);
}

export function disableGlobalLoopKillSwitch(): ImprovementLoopKillSwitch {
  const state = readState();
  const killSwitch = { ...state.killSwitch, enabled: false, disabledAt: nowIso() };
  writeState({ ...state, killSwitch, updatedAt: nowIso() });
  return clone(killSwitch);
}

export function pauseAllLoops(reason = 'Paused by governance control.'): ImprovementLoop[] {
  const loopState = readLoopState();
  const paused: ImprovementLoop[] = [];
  for (const loop of Object.values(loopState.loops)) {
    if (!['completed', 'failed', 'cancelled'].includes(loop.status)) {
      const next = { ...loop, status: 'paused' as const, updatedAt: nowIso() };
      loopState.loops[loop.id] = next;
      paused.push(next);
      recordLoopGovernanceDecision({
        id: `loop-governance-decision-${loop.id}-pause-${Date.now()}`,
        loopId: loop.id,
        action: 'pause',
        decision: 'PAUSE',
        reasons: ['governance_blocker'],
        message: reason,
        createdAt: nowIso(),
      });
    }
  }
  writeLoopState(loopState);
  return paused.map(clone);
}

export function resumeAllowedLoops(): ImprovementLoop[] {
  const loopState = readLoopState();
  const resumed: ImprovementLoop[] = [];
  for (const loop of Object.values(loopState.loops)) {
    if (loop.status !== 'paused') continue;
    const runs = Object.values(loopState.runs).filter((run) => run.loopId === loop.id);
    const decision = evaluateAndRecordLoopGovernance(loop, runs, 'resume');
    if (decision.decision === 'ALLOW') {
      const next = { ...loop, status: 'running' as const, updatedAt: nowIso() };
      loopState.loops[loop.id] = next;
      resumed.push(next);
    }
  }
  writeLoopState(loopState);
  return resumed.map(clone);
}

export function killLoop(loopId: string, reason = 'Loop killed by governance operator.'): ImprovementLoop | undefined {
  const loopState = readLoopState();
  const loop = loopState.loops[loopId];
  if (!loop) return undefined;
  const next = { ...loop, status: 'cancelled' as const, updatedAt: nowIso() };
  loopState.loops[loopId] = next;
  for (const run of Object.values(loopState.runs)) {
    if (run.loopId === loopId && !['completed', 'failed', 'cancelled'].includes(run.status)) {
      loopState.runs[run.id] = { ...run, status: 'cancelled', updatedAt: nowIso() };
    }
  }
  writeLoopState(loopState);
  recordLoopGovernanceDecision({
    id: `loop-governance-decision-${loopId}-kill-${Date.now()}`,
    loopId,
    action: 'kill',
    decision: 'KILL',
    reasons: ['manual_kill_switch'],
    message: reason,
    createdAt: nowIso(),
  });
  return clone(next);
}

export function rollbackLoop(loopId: string): LoopRollbackPlan {
  const plan = createRollbackPlan(loopId);
  const state = readState();
  writeState({ ...state, rollbackPlans: { ...state.rollbackPlans, [plan.id]: plan }, updatedAt: nowIso() });
  return clone(plan);
}

export function exportLoopGovernanceJson(): string {
  const state = readState();
  return JSON.stringify({ policies: state.policies, decisions: state.decisions, killSwitch: state.killSwitch, rollbackPlans: state.rollbackPlans }, null, 2);
}

export function exportLoopGovernanceAuditMarkdown(): string {
  return ['# Loop Governance Audit', '', ...selectLoopGovernanceAuditTrail().map((event) => `- ${event.createdAt}: ${event.decision} ${event.loopId ?? 'workspace'} - ${event.message}`), ''].join('\n');
}

export function exportLoopKillSwitchReportMarkdown(): string {
  const killSwitch = getGlobalLoopKillSwitch();
  return ['# Loop Kill Switch Report', '', `Enabled: ${killSwitch.enabled}`, `Reason: ${killSwitch.reason ?? 'none'}`, `Affected loops: ${killSwitch.affectedLoopIds.length}`, ''].join('\n');
}

export function exportLoopRollbackPlanMarkdown(): string {
  const plans = Object.values(readState().rollbackPlans);
  return ['# Loop Rollback Plans', '', ...plans.flatMap((plan) => [`## ${plan.id}`, `Reason: ${plan.reason}`, ...plan.steps.map((step) => `- ${step}`), ''])].join('\n');
}

export function exportBlockedLoopsJson(): string {
  const loopState = readLoopState();
  const blockedIds = new Set(Object.values(readState().decisions).filter((decision) => decision.decision !== 'ALLOW').map((decision) => decision.loopId));
  return JSON.stringify(Object.values(loopState.loops).filter((loop) => blockedIds.has(loop.id)), null, 2);
}

function exportArtifact(id: string, name: string, contentText: string, type: Artifact['type'] = 'report'): Artifact {
  return { id, runId: DEMO_RUN_ID, type, name, source: 'mock', contentSummary: `Improvement loop governance export for ${demoWorkspace.id}`, contentText, createdAt: nowIso() };
}

export function exportLoopGovernanceArtifacts(): ArtifactRecord[] {
  const artifacts = [
    exportArtifact(`artifact-${DEMO_RUN_ID}-improvement-loop-governance-json`, 'improvement-loop-governance.json', exportLoopGovernanceJson(), 'json'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-loop-governance-audit-md`, 'loop-governance-audit.md', exportLoopGovernanceAuditMarkdown(), 'markdown'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-loop-kill-switch-report-md`, 'loop-kill-switch-report.md', exportLoopKillSwitchReportMarkdown(), 'markdown'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-loop-rollback-plan-md`, 'loop-rollback-plan.md', exportLoopRollbackPlanMarkdown(), 'markdown'),
    exportArtifact(`artifact-${DEMO_RUN_ID}-blocked-loops-json`, 'blocked-loops.json', exportBlockedLoopsJson(), 'json'),
  ];
  return artifacts.map((artifact) => registerArtifact(artifact, { type: 'AUDIT', metadata: { runId: DEMO_RUN_ID, tags: ['improvement-loop-governance', 'kill-switch'] } }));
}

export function clearImprovementLoopGovernanceStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(GOVERNANCE_STORAGE_KEY);
}
