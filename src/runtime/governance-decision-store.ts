import type { Artifact } from '../domain/types';
import {
  governanceDecisionArtifacts,
  type GovernanceDecision,
  type GovernanceDecisionReport,
  type GovernanceGateName,
  type GovernanceViolation,
} from './governance-decision-engine';

const GOVERNANCE_DECISION_KEY = 'uikigai-governance-decision-v1';

interface GovernanceDecisionState {
  decisionHistory: GovernanceDecisionReport[];
  evaluationReports: Record<string, GovernanceDecisionReport>;
  blockedExecutions: GovernanceDecisionReport[];
  warnings: string[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyState(): GovernanceDecisionState {
  return {
    decisionHistory: [],
    evaluationReports: {},
    blockedExecutions: [],
    warnings: [],
  };
}

function readState(): GovernanceDecisionState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(GOVERNANCE_DECISION_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<GovernanceDecisionState>;
    return {
      decisionHistory: parsed.decisionHistory ?? [],
      evaluationReports: parsed.evaluationReports ?? {},
      blockedExecutions: parsed.blockedExecutions ?? [],
      warnings: parsed.warnings ?? [],
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: GovernanceDecisionState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(GOVERNANCE_DECISION_KEY, JSON.stringify(state));
}

function isBlocked(decision: GovernanceDecision) {
  return decision !== 'ALLOW' && decision !== 'REQUIRE_APPROVAL';
}

function rebuild(report: GovernanceDecisionReport, state = readState()): GovernanceDecisionState {
  const decisionHistory = [report, ...state.decisionHistory.filter((item) => item.id !== report.id)].slice(0, 100);
  const evaluationReports = { ...state.evaluationReports, [report.id]: report, [report.targetId]: report };
  const blockedExecutions = decisionHistory.filter((item) => isBlocked(item.finalDecision)).slice(0, 100);
  const warnings = decisionHistory.flatMap((item) => item.warnings).slice(0, 100);
  return { decisionHistory, evaluationReports, blockedExecutions, warnings };
}

export function recordGovernanceDecision(report: GovernanceDecisionReport): GovernanceDecisionReport {
  writeState(rebuild(report));
  return report;
}

export function getGovernanceDecisionHistory(): GovernanceDecisionReport[] {
  return clone(readState().decisionHistory);
}

export function getBlockedExecutions(): GovernanceDecisionReport[] {
  return clone(readState().blockedExecutions);
}

export function getGovernanceWarnings(): string[] {
  return clone(readState().warnings);
}

export function getDecisionReport(reportIdOrTargetId?: string): GovernanceDecisionReport | undefined {
  if (!reportIdOrTargetId) return getGovernanceDecisionHistory()[0];
  return clone(readState().evaluationReports[reportIdOrTargetId]);
}

export function getGateFailures(reportIdOrTargetId?: string): GovernanceGateName[] {
  return getDecisionReport(reportIdOrTargetId)?.failedGates ?? [];
}

export function getGovernanceViolations(): GovernanceViolation[] {
  return getGovernanceDecisionHistory().flatMap((report) => report.violations);
}

export function getGovernanceSummary() {
  const history = getGovernanceDecisionHistory();
  const counts = history.reduce((acc, report) => {
    acc[report.finalDecision] = (acc[report.finalDecision] ?? 0) + 1;
    return acc;
  }, {} as Record<GovernanceDecision, number>);
  return {
    total: history.length,
    allowed: counts.ALLOW ?? 0,
    approvalRequired: counts.REQUIRE_APPROVAL ?? 0,
    denied: counts.DENY ?? 0,
    blockedByPolicy: counts.BLOCKED_BY_POLICY ?? 0,
    blockedByBudget: counts.BLOCKED_BY_BUDGET ?? 0,
    blockedByQuota: counts.BLOCKED_BY_QUOTA ?? 0,
    blockedByRbac: counts.BLOCKED_BY_RBAC ?? 0,
    warnings: getGovernanceWarnings().length,
    latestDecision: history[0]?.finalDecision ?? 'ALLOW',
  };
}

export function generateGovernanceDecisionArtifacts(runId: string, report = getDecisionReport()): Artifact[] {
  if (!report) return [];
  return governanceDecisionArtifacts(report, runId);
}

export function clearGovernanceDecisionStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(GOVERNANCE_DECISION_KEY);
}
