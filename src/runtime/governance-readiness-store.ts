import { DEMO_RUN_ID } from '../data/demo-fixtures';
import type { Artifact } from '../domain/types';
import { getRuntimeReadiness } from '../integrations/growthos-runtime/runtime-orchestrator';
import { getExecutionBudget } from '../runtime-store/execution-budget-store';
import { getAllUsageRecords, getBillingLedgers } from '../runtime-store/usage-ledger-store';
import { getApprovalExecutionSummary } from './approval-execution-store';
import { getAuthorizationAuditSummary } from './authorization-audit-store';
import { getReconciliationReport } from './cost-reconciliation-store';
import { getGovernanceSummary } from './governance-decision-store';
import { getGovernanceEnforcementSummary } from './governance-enforcement-store';
import {
  createGovernanceReadinessReport,
  governanceReadinessArtifacts,
  type GovernanceExitGateResult,
  type GovernanceReadinessCheck,
  type GovernanceReadinessReport,
  type GovernanceReadinessStatus,
} from './governance-readiness';
import { getOrganizationGovernanceSummary } from './organization-store';
import { getPolicyInheritanceReport } from './policy-inheritance-store';
import { getRbacSummary } from './rbac-store';
import { getWorkspaceGovernanceSummary } from './workspace-governance-store';

const GOVERNANCE_READINESS_KEY = 'uikigai-governance-readiness-v1';

interface GovernanceReadinessState {
  exitGateReports: GovernanceReadinessReport[];
  readinessChecks: GovernanceReadinessCheck[];
  blockedReasons: string[];
  warnings: string[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyState(): GovernanceReadinessState {
  return {
    exitGateReports: [],
    readinessChecks: [],
    blockedReasons: [],
    warnings: [],
  };
}

function readState(): GovernanceReadinessState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(GOVERNANCE_READINESS_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<GovernanceReadinessState>;
    return {
      exitGateReports: parsed.exitGateReports ?? [],
      readinessChecks: parsed.readinessChecks ?? [],
      blockedReasons: parsed.blockedReasons ?? [],
      warnings: parsed.warnings ?? [],
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: GovernanceReadinessState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(GOVERNANCE_READINESS_KEY, JSON.stringify(state));
}

function check(
  id: GovernanceReadinessCheck['id'],
  label: string,
  status: GovernanceReadinessStatus,
  evidenceCount: number,
  message: string,
  nextAction?: string,
): GovernanceReadinessCheck {
  return {
    id,
    label,
    status,
    evidenceCount,
    message,
    nextAction,
    updatedAt: new Date().toISOString(),
  };
}

function statusFromEvidence(evidenceCount: number, warningMessage: string): Pick<GovernanceReadinessCheck, 'status' | 'message'> {
  return evidenceCount > 0
    ? { status: 'READY', message: `${evidenceCount} evidence item(s) recorded.` }
    : { status: 'WARNING', message: warningMessage };
}

export function buildGovernanceReadinessChecks(): GovernanceReadinessCheck[] {
  const policy = getPolicyInheritanceReport();
  const decisions = getGovernanceSummary();
  const enforcement = getGovernanceEnforcementSummary();
  const approvals = getApprovalExecutionSummary();
  const rbac = getRbacSummary();
  const authAudit = getAuthorizationAuditSummary();
  const budget = getExecutionBudget();
  const usageRecords = getAllUsageRecords();
  const ledgers = getBillingLedgers();
  const reconciliation = getReconciliationReport();
  const workspace = getWorkspaceGovernanceSummary();
  const organization = getOrganizationGovernanceSummary();
  const runtime = getRuntimeReadiness();

  const decisionState = statusFromEvidence(decisions.total, 'No governance decisions have been recorded in this workspace session.');
  const enforcementState = statusFromEvidence(enforcement.total, 'No governance enforcement event has been recorded yet.');
  const approvalEvidence = approvals.totalRequests + approvals.approved + approvals.rejected + approvals.resumed + approvals.cancelled;
  const approvalState = statusFromEvidence(
    approvalEvidence,
    'Approval execution has not processed a hold, approval, or rejection yet.',
  );
  const authState = statusFromEvidence(authAudit.totalEvents, 'Authorization audit has not recorded an authorization event yet.');
  const usageState = statusFromEvidence(usageRecords.length + ledgers.length, 'Usage ledger has no runtime usage records yet.');
  const costEvidence = reconciliation.records.length + reconciliation.varianceHistory.length;
  const costState = statusFromEvidence(costEvidence, 'Cost reconciliation has no provider/runtime variance evidence yet.');
  const artifactExportReady = decisions.allowed + enforcement.executed + approvals.totalRequests > 0;

  return [
    check(
      'policyInheritanceReady',
      'Policy Inheritance',
      policy.effectivePolicies.length ? 'READY' : 'BLOCKED',
      policy.effectivePolicies.length,
      policy.effectivePolicies.length ? `${policy.effectivePolicies.length} effective policies resolved.` : 'No effective policy inheritance output is available.',
      'Restore policy inheritance defaults before runtime integration.',
    ),
    check('decisionEngineReady', 'Governance Decision Engine', decisionState.status, decisions.total, decisionState.message),
    check('enforcementReady', 'Governance Enforcement', enforcementState.status, enforcement.total, enforcementState.message),
    check('approvalExecutionReady', 'Approval Execution', approvalState.status, approvalEvidence, approvalState.message),
    check(
      'rbacReady',
      'RBAC',
      rbac.roles.length && rbac.permissions.length && rbac.effectivePermissions.length ? 'READY' : 'BLOCKED',
      rbac.roles.length + rbac.permissions.length + rbac.effectivePermissions.length,
      rbac.roles.length && rbac.permissions.length ? `${rbac.roles.length} roles and ${rbac.permissions.length} permissions available.` : 'RBAC roles or permissions are unavailable.',
      'Restore RBAC role and permission defaults.',
    ),
    check('authorizationAuditReady', 'Authorization Audit', authState.status, authAudit.totalEvents, authState.message),
    check(
      'budgetReady',
      'Execution Budget',
      budget.maxCost > 0 && budget.maxDuration > 0 ? 'READY' : 'BLOCKED',
      budget.maxCost > 0 ? 1 : 0,
      budget.maxCost > 0 ? `Budget ${budget.name} allows $${budget.maxCost.toFixed(2)} max cost.` : 'Execution budget is missing or zero.',
      'Restore execution budget registry before runtime integration.',
    ),
    check('usageLedgerReady', 'Usage Ledger', usageState.status, usageRecords.length + ledgers.length, usageState.message),
    check('costReconciliationReady', 'Cost Reconciliation', costState.status, costEvidence, costState.message),
    check(
      'workspaceGovernanceReady',
      'Workspace Governance',
      workspace.workspace.id ? (workspace.health.overallStatus === 'CRITICAL' ? 'WARNING' : 'READY') : 'BLOCKED',
      workspace.members.length + workspace.teams.length,
      workspace.workspace.id ? `Workspace health is ${workspace.health.overallStatus}.` : 'Workspace governance summary is unavailable.',
    ),
    check(
      'organizationGovernanceReady',
      'Organization Governance',
      organization.organization.id ? (organization.organizationHealth.overallStatus === 'CRITICAL' ? 'WARNING' : 'READY') : 'BLOCKED',
      organization.tenants.length + organization.workspaceReferences.length,
      organization.organization.id ? `Organization health is ${organization.organizationHealth.overallStatus}.` : 'Organization governance summary is unavailable.',
    ),
    check(
      'runtimeIntegrationReady',
      'Runtime Integration',
      runtime.canStartMockRun ? (runtime.canStartRealRun ? 'READY' : 'WARNING') : 'BLOCKED',
      runtime.canStartMockRun ? 1 : 0,
      runtime.canStartRealRun ? 'Sandbox runtime reports real-run readiness.' : 'Mock runtime fallback is available; sandbox runtime is not yet online.',
    ),
    check(
      'artifactExportReady',
      'Artifact Export',
      artifactExportReady ? 'READY' : 'WARNING',
      artifactExportReady ? 4 : 0,
      artifactExportReady ? 'Governance artifact export can be generated.' : 'Generate governance decisions or approvals before final artifact export evidence.',
    ),
  ];
}

export function runGovernanceExitGate(runId = DEMO_RUN_ID): GovernanceExitGateResult {
  const report = createGovernanceReadinessReport(buildGovernanceReadinessChecks());
  const artifacts = governanceReadinessArtifacts(report, runId);
  const state = readState();
  writeState({
    exitGateReports: [report, ...state.exitGateReports.filter((item) => item.id !== report.id)].slice(0, 20),
    readinessChecks: report.checks,
    blockedReasons: report.blockedReasons,
    warnings: report.warnings,
  });
  return { report, artifacts };
}

export function getGovernanceReadinessReport(): GovernanceReadinessReport {
  const state = readState();
  return clone(state.exitGateReports[0] ?? createGovernanceReadinessReport(buildGovernanceReadinessChecks()));
}

export function getGovernanceExitGateStatus(): GovernanceReadinessStatus {
  return getGovernanceReadinessReport().status;
}

export function getGovernanceBlockedReasons(): string[] {
  return clone(getGovernanceReadinessReport().blockedReasons);
}

export function getGovernanceReadinessWarnings(): string[] {
  return clone(getGovernanceReadinessReport().warnings);
}

export function getGovernanceReadyModules(): string[] {
  return clone(getGovernanceReadinessReport().readyModules);
}

export function generateGovernanceReadinessArtifacts(runId = DEMO_RUN_ID): Artifact[] {
  const report = getGovernanceReadinessReport();
  return governanceReadinessArtifacts(report, runId);
}

export function clearGovernanceReadinessStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(GOVERNANCE_READINESS_KEY);
}
