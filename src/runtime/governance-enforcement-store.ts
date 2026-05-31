import type { Artifact } from '../domain/types';
import { governanceEnforcementArtifacts, type ApprovalHold, type EnforcementResult, type ExecutionBlock } from './governance-enforcement';

const GOVERNANCE_ENFORCEMENT_KEY = 'uikigai-governance-enforcement-v1';

interface GovernanceEnforcementState {
  blockedExecutions: ExecutionBlock[];
  approvalHolds: ApprovalHold[];
  terminatedRuns: ExecutionBlock[];
  enforcementEvents: EnforcementResult[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyState(): GovernanceEnforcementState {
  return {
    blockedExecutions: [],
    approvalHolds: [],
    terminatedRuns: [],
    enforcementEvents: [],
  };
}

function readState(): GovernanceEnforcementState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(GOVERNANCE_ENFORCEMENT_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<GovernanceEnforcementState>;
    return {
      blockedExecutions: parsed.blockedExecutions ?? [],
      approvalHolds: parsed.approvalHolds ?? [],
      terminatedRuns: parsed.terminatedRuns ?? [],
      enforcementEvents: parsed.enforcementEvents ?? [],
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: GovernanceEnforcementState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(GOVERNANCE_ENFORCEMENT_KEY, JSON.stringify(state));
}

export function recordGovernanceEnforcement(result: EnforcementResult): EnforcementResult {
  const state = readState();
  const enforcementEvents = [result, ...state.enforcementEvents.filter((event) => event.id !== result.id)].slice(0, 150);
  const blockedExecutions = [
    ...(result.executionBlock && result.enforcementAction !== 'TERMINATE' ? [result.executionBlock] : []),
    ...state.blockedExecutions,
  ].slice(0, 100);
  const approvalHolds = [
    ...(result.approvalHold ? [result.approvalHold] : []),
    ...state.approvalHolds,
  ].slice(0, 100);
  const terminatedRuns = [
    ...(result.executionBlock && result.enforcementAction === 'TERMINATE' ? [result.executionBlock] : []),
    ...state.terminatedRuns,
  ].slice(0, 100);
  writeState({ blockedExecutions, approvalHolds, terminatedRuns, enforcementEvents });
  return result;
}

export function getBlockedRuns(): ExecutionBlock[] {
  return clone(readState().blockedExecutions);
}

export function getApprovalHolds(): ApprovalHold[] {
  return clone(readState().approvalHolds);
}

export function getEnforcementEvents(): EnforcementResult[] {
  return clone(readState().enforcementEvents);
}

export function getRejectedExecutions(): EnforcementResult[] {
  return getEnforcementEvents().filter((event) => event.enforcementAction === 'REJECT');
}

export function getTerminatedRuns(): ExecutionBlock[] {
  return clone(readState().terminatedRuns);
}

export function getGovernanceEnforcementSummary() {
  const events = getEnforcementEvents();
  const blocked = getBlockedRuns();
  const holds = getApprovalHolds();
  const terminated = getTerminatedRuns();
  return {
    total: events.length,
    executed: events.filter((event) => event.enforcementAction === 'EXECUTE').length,
    approvalHolds: holds.length,
    rejected: events.filter((event) => event.enforcementAction === 'REJECT').length,
    terminated: terminated.length,
    blockedRuns: blocked.length,
    latestAction: events[0]?.enforcementAction ?? 'EXECUTE',
  };
}

export function generateGovernanceEnforcementArtifacts(runId: string, result = getEnforcementEvents()[0]): Artifact[] {
  if (!result) return [];
  return governanceEnforcementArtifacts(result, runId);
}

export function clearGovernanceEnforcementStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(GOVERNANCE_ENFORCEMENT_KEY);
}
