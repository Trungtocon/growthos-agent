import type { Artifact } from '../domain/types';
import type { AuthorizationDecision } from './rbac';
import { getAuthorizationAuditSummary } from './authorization-audit-store';
import type { ExecutionBudgetReport } from '../integrations/growthos-runtime/execution-budget';
import { evaluateBudget } from '../integrations/growthos-runtime/execution-budget';
import type { PlanExecutionPolicyReport } from '../integrations/growthos-runtime/plan-policy';
import { evaluatePlanPolicy } from '../integrations/growthos-runtime/plan-policy';
import type { QuotaEvaluationReport } from '../integrations/growthos-runtime/usage-ledger';
import { evaluateQuotaBeforeRun } from '../integrations/growthos-runtime/usage-ledger';
import { canApproveDeployment, canApprovePlan, canExportArtifact, canOverrideBudget, canStartRun } from './rbac-store';

export type GovernanceDecision =
  | 'ALLOW'
  | 'DENY'
  | 'REQUIRE_APPROVAL'
  | 'BLOCKED_BY_POLICY'
  | 'BLOCKED_BY_BUDGET'
  | 'BLOCKED_BY_QUOTA'
  | 'BLOCKED_BY_RBAC';

export type GovernanceGateName =
  | 'Policy Gate'
  | 'Budget Gate'
  | 'Quota Gate'
  | 'RBAC Gate'
  | 'Approval Gate'
  | 'Authorization Audit Gate';

export type GovernanceGateStatus = 'passed' | 'failed' | 'warning';

export interface GovernanceGate {
  id: string;
  name: GovernanceGateName;
  status: GovernanceGateStatus;
  passed: boolean;
  failed: boolean;
  warning: boolean;
  reason: string;
}

export interface GovernanceViolation {
  id: string;
  gateId: string;
  category: 'policy' | 'budget' | 'quota' | 'rbac' | 'approval' | 'authorization-audit';
  targetId: string;
  reason: string;
  severity: 'warning' | 'blocking';
  createdAt: string;
}

export interface GovernanceEvaluation {
  id: string;
  targetId: string;
  targetType: 'run' | 'plan' | 'artifact' | 'deployment' | 'budget' | 'runtime';
  action: string;
  gates: GovernanceGate[];
  violations: GovernanceViolation[];
  warnings: string[];
  decisionReasons: string[];
  failedGates: GovernanceGateName[];
  finalDecision: GovernanceDecision;
  evaluatedAt: string;
}

export interface GovernanceDecisionReport extends GovernanceEvaluation {
  policyReport?: PlanExecutionPolicyReport;
  budgetReport?: ExecutionBudgetReport;
  quotaReport?: QuotaEvaluationReport;
  authorizationDecision?: AuthorizationDecision;
}

export interface GovernanceDecisionInput {
  targetId: string;
  targetType: GovernanceEvaluation['targetType'];
  action: string;
  policyReport?: PlanExecutionPolicyReport;
  budgetReport?: ExecutionBudgetReport;
  quotaReport?: QuotaEvaluationReport;
  authorizationDecision?: AuthorizationDecision;
  approvalRequired?: boolean;
  approvalReason?: string;
  deniedReason?: string;
}

function now() {
  return new Date().toISOString();
}

function gate(id: string, name: GovernanceGateName, status: GovernanceGateStatus, reason: string): GovernanceGate {
  return {
    id,
    name,
    status,
    passed: status === 'passed',
    failed: status === 'failed',
    warning: status === 'warning',
    reason,
  };
}

function violation(gateItem: GovernanceGate, category: GovernanceViolation['category'], targetId: string): GovernanceViolation {
  return {
    id: `governance-violation-${targetId}-${gateItem.id}-${Date.now()}`,
    gateId: gateItem.id,
    category,
    targetId,
    reason: gateItem.reason,
    severity: gateItem.failed ? 'blocking' : 'warning',
    createdAt: now(),
  };
}

function policyGate(report?: PlanExecutionPolicyReport): GovernanceGate {
  if (!report) return gate('policy', 'Policy Gate', 'warning', 'No plan policy report was available for this evaluation.');
  if (report.status === 'blocked') return gate('policy', 'Policy Gate', 'failed', report.blockingReasons.join(', ') || 'Plan policy blocked execution.');
  if (report.status === 'warning') return gate('policy', 'Policy Gate', 'warning', report.warnings.join(', ') || 'Plan policy returned warnings.');
  return gate('policy', 'Policy Gate', 'passed', 'Plan policy allowed execution.');
}

function budgetGate(report?: ExecutionBudgetReport): GovernanceGate {
  if (!report) return gate('budget', 'Budget Gate', 'warning', 'No execution budget report was available for this evaluation.');
  if (report.status === 'blocked') return gate('budget', 'Budget Gate', 'failed', report.blockingReasons.join(', ') || 'Budget governance blocked execution.');
  if (report.status === 'warning' || report.approvalRequired) return gate('budget', 'Budget Gate', 'warning', report.warnings.join(', ') || 'Budget governance requires review.');
  return gate('budget', 'Budget Gate', 'passed', 'Budget governance allowed execution.');
}

function quotaGate(report?: QuotaEvaluationReport): GovernanceGate {
  if (!report) return gate('quota', 'Quota Gate', 'warning', 'No quota report was available for this evaluation.');
  if (report.status === 'exceeded') return gate('quota', 'Quota Gate', 'failed', report.blockingReasons.join(', ') || 'Usage quota blocked execution.');
  if (report.status === 'warning') return gate('quota', 'Quota Gate', 'warning', report.warnings.join(', ') || 'Usage quota returned warnings.');
  return gate('quota', 'Quota Gate', 'passed', 'Usage quota allowed execution.');
}

function rbacGate(decision?: AuthorizationDecision): GovernanceGate {
  if (!decision) return gate('rbac', 'RBAC Gate', 'warning', 'No RBAC authorization decision was available.');
  if (!decision.allowed) return gate('rbac', 'RBAC Gate', 'failed', decision.reason);
  return gate('rbac', 'RBAC Gate', 'passed', decision.reason);
}

function approvalGate(input: GovernanceDecisionInput): GovernanceGate {
  if (input.approvalRequired) return gate('approval', 'Approval Gate', 'warning', input.approvalReason ?? 'Human approval is required before completion.');
  return gate('approval', 'Approval Gate', 'passed', 'No approval gate is required.');
}

function authorizationAuditGate(): GovernanceGate {
  const summary = getAuthorizationAuditSummary();
  if (summary.criticalEvents > 0) return gate('authorization-audit', 'Authorization Audit Gate', 'warning', `${summary.criticalEvents} critical authorization audit events are open.`);
  if (summary.highRiskEvents > 0) return gate('authorization-audit', 'Authorization Audit Gate', 'warning', `${summary.highRiskEvents} high-risk authorization audit events are open.`);
  return gate('authorization-audit', 'Authorization Audit Gate', 'passed', 'Authorization audit has no high-risk findings.');
}

function finalDecisionFromGates(gates: GovernanceGate[], approvalRequired: boolean): GovernanceDecision {
  const failed = new Set(gates.filter((item) => item.failed).map((item) => item.name));
  if (failed.has('RBAC Gate')) return 'BLOCKED_BY_RBAC';
  if (failed.has('Quota Gate')) return 'BLOCKED_BY_QUOTA';
  if (failed.has('Budget Gate')) return 'BLOCKED_BY_BUDGET';
  if (failed.has('Policy Gate')) return 'BLOCKED_BY_POLICY';
  if (approvalRequired || gates.some((item) => item.name === 'Approval Gate' && item.warning)) return 'REQUIRE_APPROVAL';
  return 'ALLOW';
}

export function evaluateGovernanceDecision(input: GovernanceDecisionInput): GovernanceDecisionReport {
  const gates = [
    policyGate(input.policyReport),
    budgetGate(input.budgetReport),
    quotaGate(input.quotaReport),
    rbacGate(input.authorizationDecision),
    approvalGate(input),
    authorizationAuditGate(),
  ];
  const violations = gates
    .filter((item) => item.failed || item.warning)
    .map((item) => violation(item, item.id as GovernanceViolation['category'], input.targetId));
  const failedGates = gates.filter((item) => item.failed).map((item) => item.name);
  const warnings = gates.filter((item) => item.warning).map((item) => item.reason);
  const decisionReasons = [
    ...(input.deniedReason ? [input.deniedReason] : []),
    ...gates.filter((item) => item.failed || item.warning).map((item) => item.reason),
  ];
  return {
    id: `governance-${input.action}-${input.targetId}-${Date.now()}`,
    targetId: input.targetId,
    targetType: input.targetType,
    action: input.action,
    gates,
    violations,
    warnings,
    decisionReasons,
    failedGates,
    finalDecision: input.deniedReason ? 'DENY' : finalDecisionFromGates(gates, Boolean(input.approvalRequired)),
    evaluatedAt: now(),
    policyReport: input.policyReport,
    budgetReport: input.budgetReport,
    quotaReport: input.quotaReport,
    authorizationDecision: input.authorizationDecision,
  };
}

export function evaluatePlanExecution(planId: string, input: Partial<GovernanceDecisionInput> = {}): GovernanceDecisionReport {
  const policyReport = input.policyReport ?? evaluatePlanPolicy(planId);
  const budgetReport = input.budgetReport ?? evaluateBudget(planId);
  const quotaReport = input.quotaReport ?? evaluateQuotaBeforeRun(planId);
  const authorizationDecision = input.authorizationDecision ?? canStartRun(planId);
  return evaluateGovernanceDecision({
    targetId: planId,
    targetType: 'plan',
    action: 'startRunFromPlan',
    policyReport,
    budgetReport,
    quotaReport,
    authorizationDecision,
    approvalRequired: policyReport.approvalRequiredSteps.length > 0 || budgetReport.approvalRequired,
    approvalReason: policyReport.approvalRequiredSteps.length > 0
      ? `${policyReport.approvalRequiredSteps.length} plan steps require approval.`
      : budgetReport.approvalRequired ? 'Budget governance requires approval.' : undefined,
    ...input,
  });
}

export function evaluateRunRequest(ticketId: string, planId?: string): GovernanceDecisionReport {
  if (planId) return evaluatePlanExecution(planId);
  return evaluateGovernanceDecision({
    targetId: ticketId,
    targetType: 'runtime',
    action: 'startAgentRun',
    authorizationDecision: canStartRun(ticketId),
    approvalRequired: false,
  });
}

export function evaluateArtifactExport(runId: string, input: Partial<GovernanceDecisionInput> = {}): GovernanceDecisionReport {
  return evaluateGovernanceDecision({
    targetId: runId,
    targetType: 'artifact',
    action: 'artifact.created',
    authorizationDecision: input.authorizationDecision ?? canExportArtifact(runId),
    approvalRequired: false,
    ...input,
  });
}

export function evaluateDeploymentRequest(targetId: string, input: Partial<GovernanceDecisionInput> = {}): GovernanceDecisionReport {
  return evaluateGovernanceDecision({
    targetId,
    targetType: 'deployment',
    action: 'approveDeployment',
    authorizationDecision: input.authorizationDecision ?? canApproveDeployment(targetId),
    approvalRequired: true,
    approvalReason: 'Deployment requests require explicit governance approval.',
    ...input,
  });
}

export function evaluateBudgetOverride(targetId: string, input: Partial<GovernanceDecisionInput> = {}): GovernanceDecisionReport {
  return evaluateGovernanceDecision({
    targetId,
    targetType: 'budget',
    action: 'overrideBudget',
    authorizationDecision: input.authorizationDecision ?? canOverrideBudget(targetId),
    approvalRequired: true,
    approvalReason: 'Budget override requires governance approval.',
    ...input,
  });
}

export function evaluatePlanApproval(planId: string, input: Partial<GovernanceDecisionInput> = {}): GovernanceDecisionReport {
  return evaluateGovernanceDecision({
    targetId: planId,
    targetType: 'plan',
    action: 'approveRunPlan',
    authorizationDecision: input.authorizationDecision ?? canApprovePlan(planId),
    approvalRequired: false,
    ...input,
  });
}

export function governanceDecisionArtifacts(report: GovernanceDecisionReport, runId: string): Artifact[] {
  const base = new Date(report.evaluatedAt).getTime();
  const md = [
    '# Governance Decision Report',
    '',
    `- Decision: ${report.finalDecision}`,
    `- Action: ${report.action}`,
    `- Target: ${report.targetId}`,
    `- Failed gates: ${report.failedGates.join(', ') || 'none'}`,
    `- Warnings: ${report.warnings.join('; ') || 'none'}`,
  ].join('\n');
  return [
    {
      id: `artifact-governance-decision-report-${base}`,
      runId,
      type: 'markdown',
      name: 'governance-decision-report.md',
      source: 'mock',
      contentSummary: `Governance decision ${report.finalDecision} for ${report.action}.`,
      contentText: md,
      createdAt: report.evaluatedAt,
    },
    {
      id: `artifact-governance-violations-${base}`,
      runId,
      type: 'json',
      name: 'governance-violations.json',
      source: 'mock',
      contentSummary: `${report.violations.length} governance violations or warnings.`,
      contentJson: report.violations,
      createdAt: report.evaluatedAt,
    },
    {
      id: `artifact-blocked-executions-${base}`,
      runId,
      type: 'json',
      name: 'blocked-executions.json',
      source: 'mock',
      contentSummary: report.failedGates.length ? 'Blocked governance execution evidence.' : 'No blocked executions in this report.',
      contentJson: report.failedGates.length ? [report] : [],
      createdAt: report.evaluatedAt,
    },
    {
      id: `artifact-approval-required-report-${base}`,
      runId,
      type: 'markdown',
      name: 'approval-required-report.md',
      source: 'mock',
      contentSummary: report.finalDecision === 'REQUIRE_APPROVAL' ? 'Approval-required governance decision.' : 'No approval required.',
      contentText: report.finalDecision === 'REQUIRE_APPROVAL'
        ? `# Approval Required\n\n${report.decisionReasons.join('\n')}`
        : '# Approval Required\n\nNo approval required for this governance decision.',
      createdAt: report.evaluatedAt,
    },
  ];
}
