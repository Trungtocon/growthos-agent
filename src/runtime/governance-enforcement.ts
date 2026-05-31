import type { Artifact } from '../domain/types';
import type { GovernanceDecision, GovernanceDecisionReport, GovernanceViolation } from './governance-decision-engine';

export type EnforcementAction = 'EXECUTE' | 'PAUSE' | 'REQUIRE_APPROVAL' | 'REJECT' | 'TERMINATE';

export interface EnforcementViolation {
  id: string;
  reportId: string;
  targetId: string;
  targetType: GovernanceDecisionReport['targetType'];
  runtimeAction: string;
  decision: GovernanceDecision;
  reason: string;
  severity: 'warning' | 'blocking';
  createdAt: string;
}

export interface ExecutionBlock {
  id: string;
  reportId: string;
  targetId: string;
  targetType: GovernanceDecisionReport['targetType'];
  runtimeAction: string;
  decision: GovernanceDecision;
  reasons: string[];
  createdAt: string;
}

export interface ApprovalHold {
  id: string;
  reportId: string;
  targetId: string;
  targetType: GovernanceDecisionReport['targetType'];
  runtimeAction: string;
  reasons: string[];
  createdAt: string;
}

export interface EnforcementResult {
  id: string;
  reportId: string;
  targetId: string;
  targetType: GovernanceDecisionReport['targetType'];
  runtimeAction: string;
  decision: GovernanceDecision;
  enforcementAction: EnforcementAction;
  allowed: boolean;
  blocked: boolean;
  approvalRequired: boolean;
  decisionReasons: string[];
  gateFailures: string[];
  violations: EnforcementViolation[];
  executionBlock?: ExecutionBlock;
  approvalHold?: ApprovalHold;
  createdAt: string;
}

export interface GovernanceEnforcementInput {
  runtimeAction?: string;
  forceTerminate?: boolean;
}

function now() {
  return new Date().toISOString();
}

export function enforcementActionForDecision(decision: GovernanceDecision, forceTerminate = false): EnforcementAction {
  if (forceTerminate) return 'TERMINATE';
  if (decision === 'ALLOW') return 'EXECUTE';
  if (decision === 'REQUIRE_APPROVAL') return 'REQUIRE_APPROVAL';
  return 'REJECT';
}

function resultId(report: GovernanceDecisionReport, runtimeAction: string) {
  return `enforcement-${runtimeAction}-${report.targetId}-${Date.now()}`;
}

function reasons(report: GovernanceDecisionReport): string[] {
  return report.decisionReasons.length
    ? report.decisionReasons
    : report.failedGates.length
      ? report.failedGates.map((gate) => `${gate} failed.`)
      : ['Governance enforcement allowed execution.'];
}

function enforcementViolations(report: GovernanceDecisionReport, runtimeAction: string, createdAt: string): EnforcementViolation[] {
  const sourceViolations: GovernanceViolation[] = report.violations.length
    ? report.violations
    : report.finalDecision === 'ALLOW' ? [] : report.failedGates.map((gate) => ({
      id: `synthetic-${report.id}-${gate}`,
      gateId: String(gate),
      category: 'policy',
      targetId: report.targetId,
      reason: `${gate} failed.`,
      severity: 'blocking',
      createdAt,
    }));
  return sourceViolations.map((violation) => ({
    id: `enforcement-violation-${violation.id}`,
    reportId: report.id,
    targetId: report.targetId,
    targetType: report.targetType,
    runtimeAction,
    decision: report.finalDecision,
    reason: violation.reason,
    severity: violation.severity,
    createdAt,
  }));
}

export function enforceGovernanceDecision(report: GovernanceDecisionReport, input: GovernanceEnforcementInput = {}): EnforcementResult {
  const createdAt = now();
  const runtimeAction = input.runtimeAction ?? report.action;
  const enforcementAction = enforcementActionForDecision(report.finalDecision, input.forceTerminate);
  const decisionReasons = reasons(report);
  const id = resultId(report, runtimeAction);
  const block: ExecutionBlock | undefined = enforcementAction === 'REJECT' || enforcementAction === 'TERMINATE'
    ? {
      id: `block-${id}`,
      reportId: report.id,
      targetId: report.targetId,
      targetType: report.targetType,
      runtimeAction,
      decision: report.finalDecision,
      reasons: decisionReasons,
      createdAt,
    }
    : undefined;
  const hold: ApprovalHold | undefined = enforcementAction === 'REQUIRE_APPROVAL'
    ? {
      id: `hold-${id}`,
      reportId: report.id,
      targetId: report.targetId,
      targetType: report.targetType,
      runtimeAction,
      reasons: decisionReasons,
      createdAt,
    }
    : undefined;

  return {
    id,
    reportId: report.id,
    targetId: report.targetId,
    targetType: report.targetType,
    runtimeAction,
    decision: report.finalDecision,
    enforcementAction,
    allowed: enforcementAction === 'EXECUTE',
    blocked: enforcementAction === 'REJECT' || enforcementAction === 'TERMINATE',
    approvalRequired: enforcementAction === 'REQUIRE_APPROVAL',
    decisionReasons,
    gateFailures: report.failedGates,
    violations: enforcementViolations(report, runtimeAction, createdAt),
    executionBlock: block,
    approvalHold: hold,
    createdAt,
  };
}

export function governanceEnforcementArtifacts(result: EnforcementResult, runId: string): Artifact[] {
  const base = new Date(result.createdAt).getTime();
  const summary = [
    '# Governance Enforcement Report',
    '',
    `- Enforcement action: ${result.enforcementAction}`,
    `- Governance decision: ${result.decision}`,
    `- Runtime action: ${result.runtimeAction}`,
    `- Target: ${result.targetType}/${result.targetId}`,
    `- Reasons: ${result.decisionReasons.join('; ') || 'none'}`,
  ].join('\n');
  return [
    {
      id: `artifact-enforcement-report-${base}`,
      runId,
      type: 'markdown',
      name: 'enforcement-report.md',
      source: 'mock',
      contentSummary: `Governance enforcement ${result.enforcementAction} for ${result.runtimeAction}.`,
      contentText: summary,
      createdAt: result.createdAt,
    },
    {
      id: `artifact-blocked-runs-${base}`,
      runId,
      type: 'json',
      name: 'blocked-runs.json',
      source: 'mock',
      contentSummary: result.executionBlock ? 'Blocked runtime execution evidence.' : 'No blocked runtime execution.',
      contentJson: result.executionBlock ? [result.executionBlock] : [],
      createdAt: result.createdAt,
    },
    {
      id: `artifact-approval-holds-${base}`,
      runId,
      type: 'json',
      name: 'approval-holds.json',
      source: 'mock',
      contentSummary: result.approvalHold ? 'Approval hold evidence.' : 'No approval holds.',
      contentJson: result.approvalHold ? [result.approvalHold] : [],
      createdAt: result.createdAt,
    },
    {
      id: `artifact-terminated-runs-${base}`,
      runId,
      type: 'json',
      name: 'terminated-runs.json',
      source: 'mock',
      contentSummary: result.enforcementAction === 'TERMINATE' ? 'Terminated runtime execution evidence.' : 'No terminated runs.',
      contentJson: result.enforcementAction === 'TERMINATE' && result.executionBlock ? [result.executionBlock] : [],
      createdAt: result.createdAt,
    },
  ];
}
