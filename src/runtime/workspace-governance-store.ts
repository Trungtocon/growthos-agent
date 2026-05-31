import { demoWorkspace } from '../data/demo-fixtures';
import { getApprovals } from '../runtime-store/approval-store';
import { getRuntimeArtifacts } from '../runtime-store/artifact-store';
import { getBillingLedgers } from '../runtime-store/usage-ledger-store';
import { getWorkspaceAnalytics } from '../runtime-store/workspace-analytics-store';
import {
  evaluateWorkspaceGovernance,
  evaluateWorkspaceHealth,
  type GovernanceStatus,
  type Workspace,
  type WorkspaceBudget,
  type WorkspaceGovernanceSummary,
  type WorkspaceHealth,
  type WorkspaceMember,
  type WorkspaceQuota,
  type WorkspaceRole,
  type WorkspaceTeam,
} from './workspace-governance';

interface WorkspaceGovernanceState {
  workspaces: Workspace[];
  teams: WorkspaceTeam[];
  members: WorkspaceMember[];
  roles: WorkspaceRole[];
  budgets: Record<string, WorkspaceBudget>;
  quotas: Record<string, WorkspaceQuota>;
  healthReports: Record<string, WorkspaceHealth>;
}

const WORKSPACE_GOVERNANCE_KEY = 'uikigai-workspace-governance-v1';
const DEFAULT_ROLES: WorkspaceRole[] = ['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function defaultWorkspace(): Workspace {
  return {
    id: demoWorkspace.id,
    name: demoWorkspace.name,
    description: 'Primary GrowthOS workspace for AI workforce runtime governance.',
    status: 'active',
    createdAt: demoWorkspace.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

function defaultTeams(workspaceId: string): WorkspaceTeam[] {
  return [
    { id: 'team-ops', workspaceId, name: 'Operations', memberCount: 2 },
    { id: 'team-growth', workspaceId, name: 'Growth', memberCount: 2 },
    { id: 'team-governance', workspaceId, name: 'Governance', memberCount: 1 },
  ];
}

function defaultMembers(workspaceId: string): WorkspaceMember[] {
  return [
    { id: 'member-admin', workspaceId, teamId: 'team-governance', name: 'Linh Nguyen', email: 'linh@uikigai.test', roleId: 'ADMIN' },
    { id: 'member-manager', workspaceId, teamId: 'team-ops', name: 'Minh Tran', email: 'minh@uikigai.test', roleId: 'MANAGER' },
    { id: 'member-operator', workspaceId, teamId: 'team-ops', name: 'An Pham', email: 'an@uikigai.test', roleId: 'OPERATOR' },
    { id: 'member-growth', workspaceId, teamId: 'team-growth', name: 'Hoa Le', email: 'hoa@uikigai.test', roleId: 'OPERATOR' },
    { id: 'member-viewer', workspaceId, teamId: 'team-growth', name: 'Tuan Vo', email: 'tuan@uikigai.test', roleId: 'VIEWER' },
  ];
}

function usageBudget(workspaceId: string): WorkspaceBudget {
  const analytics = getWorkspaceAnalytics();
  const currentSpend = analytics.actualCost || getBillingLedgers().reduce((sum, ledger) => sum + ledger.actualTotal, 0);
  const monthlyLimit = demoWorkspace.aiBudgetMonthly;
  return {
    workspaceId,
    monthlyLimit,
    currentSpend: Number(currentSpend.toFixed(4)),
    remainingBudget: Number(Math.max(0, monthlyLimit - currentSpend).toFixed(4)),
  };
}

function usageQuota(workspaceId: string): WorkspaceQuota {
  const analytics = getWorkspaceAnalytics();
  return {
    workspaceId,
    maxRuns: 50,
    maxTokens: 250000,
    maxArtifacts: 120,
    currentRuns: analytics.totalRuns,
    currentTokens: analytics.totalTokens,
    currentArtifacts: analytics.totalArtifacts || getRuntimeArtifacts().length,
  };
}

function emptyState(): WorkspaceGovernanceState {
  const workspace = defaultWorkspace();
  const budget = usageBudget(workspace.id);
  const quota = usageQuota(workspace.id);
  const summary = evaluateWorkspaceGovernance({
    workspace,
    budget,
    quota,
    teams: defaultTeams(workspace.id),
    members: defaultMembers(workspace.id),
    roles: DEFAULT_ROLES,
  });
  return {
    workspaces: [workspace],
    teams: summary.teams,
    members: summary.members,
    roles: summary.roles,
    budgets: { [workspace.id]: summary.budget },
    quotas: { [workspace.id]: summary.quota },
    healthReports: { [workspace.id]: summary.health },
  };
}

function readState(): WorkspaceGovernanceState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(WORKSPACE_GOVERNANCE_KEY);
    return raw ? { ...emptyState(), ...JSON.parse(raw) as WorkspaceGovernanceState } : emptyState();
  } catch {
    return emptyState();
  }
}

function writeState(state: WorkspaceGovernanceState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(WORKSPACE_GOVERNANCE_KEY, JSON.stringify(state));
}

function mergeBudgetLimit(workspaceId: string, stored?: WorkspaceBudget): WorkspaceBudget {
  const budget = usageBudget(workspaceId);
  const monthlyLimit = stored?.monthlyLimit ?? budget.monthlyLimit;
  return {
    ...budget,
    monthlyLimit,
    remainingBudget: Number(Math.max(0, monthlyLimit - budget.currentSpend).toFixed(4)),
  };
}

function mergeQuotaLimits(workspaceId: string, stored?: WorkspaceQuota): WorkspaceQuota {
  const quota = usageQuota(workspaceId);
  return {
    ...quota,
    maxRuns: stored?.maxRuns ?? quota.maxRuns,
    maxTokens: stored?.maxTokens ?? quota.maxTokens,
    maxArtifacts: stored?.maxArtifacts ?? quota.maxArtifacts,
  };
}

function buildWorkspaceGovernanceSummary(state: WorkspaceGovernanceState): WorkspaceGovernanceSummary {
  const workspace = state.workspaces[0] ?? defaultWorkspace();
  const budget = mergeBudgetLimit(workspace.id, state.budgets[workspace.id]);
  const quota = mergeQuotaLimits(workspace.id, state.quotas[workspace.id]);
  const policyStatus = state.healthReports[workspace.id]?.policyStatus ?? 'OK';
  const summary = evaluateWorkspaceGovernance({
    workspace,
    budget,
    quota,
    teams: state.teams,
    members: state.members,
    roles: state.roles,
  });
  return {
    ...summary,
    health: evaluateWorkspaceHealth({
      workspaceId: workspace.id,
      budget,
      quota,
      policyStatus,
      generatedAt: summary.health.generatedAt,
    }),
  };
}

export function generateWorkspaceGovernance(): WorkspaceGovernanceSummary {
  const state = readState();
  const workspace = state.workspaces[0] ?? defaultWorkspace();
  const summary = buildWorkspaceGovernanceSummary(state);
  const persistedState = {
    ...state,
    workspaces: [summary.workspace],
    budgets: { ...state.budgets, [workspace.id]: summary.budget },
    quotas: { ...state.quotas, [workspace.id]: summary.quota },
    healthReports: { ...state.healthReports, [workspace.id]: summary.health },
  };
  writeState(persistedState);
  return clone(summary);
}

export function getWorkspaceGovernanceSummary(): WorkspaceGovernanceSummary {
  return clone(buildWorkspaceGovernanceSummary(readState()));
}

export function getCurrentWorkspace(): Workspace {
  return getWorkspaceGovernanceSummary().workspace;
}

export function getWorkspaceBudget(): WorkspaceBudget {
  return getWorkspaceGovernanceSummary().budget;
}

export function getWorkspaceQuota(): WorkspaceQuota {
  return getWorkspaceGovernanceSummary().quota;
}

export function getWorkspaceTeams(): WorkspaceTeam[] {
  return getWorkspaceGovernanceSummary().teams;
}

export function getWorkspaceMembers(): WorkspaceMember[] {
  return getWorkspaceGovernanceSummary().members;
}

export function getWorkspaceRoles(): WorkspaceRole[] {
  return getWorkspaceGovernanceSummary().roles;
}

export function getWorkspaceHealth(): WorkspaceHealth {
  return getWorkspaceGovernanceSummary().health;
}

export function getWorkspaceWarnings(): string[] {
  const health = getWorkspaceHealth();
  const approvalWarnings = getApprovals().filter((approval) => approval.status === 'pending').length;
  return [
    ...health.warnings,
    ...(approvalWarnings ? [`${approvalWarnings} approvals pending workspace review.`] : []),
  ];
}

export function setWorkspaceGovernanceLimits(input: {
  budgetLimit?: number;
  maxRuns?: number;
  maxTokens?: number;
  maxArtifacts?: number;
  policyStatus?: GovernanceStatus;
}) {
  const state = readState();
  const workspace = state.workspaces[0] ?? defaultWorkspace();
  const currentBudget = mergeBudgetLimit(workspace.id, state.budgets[workspace.id]);
  const currentQuota = mergeQuotaLimits(workspace.id, state.quotas[workspace.id]);
  const budget: WorkspaceBudget = {
    ...currentBudget,
    monthlyLimit: input.budgetLimit ?? currentBudget.monthlyLimit,
    remainingBudget: Number(Math.max(0, (input.budgetLimit ?? currentBudget.monthlyLimit) - currentBudget.currentSpend).toFixed(4)),
  };
  const quota: WorkspaceQuota = {
    ...currentQuota,
    maxRuns: input.maxRuns ?? currentQuota.maxRuns,
    maxTokens: input.maxTokens ?? currentQuota.maxTokens,
    maxArtifacts: input.maxArtifacts ?? currentQuota.maxArtifacts,
  };
  const summary = evaluateWorkspaceGovernance({
    workspace,
    budget,
    quota,
    teams: state.teams,
    members: state.members,
    roles: state.roles,
  });
  const health = evaluateWorkspaceHealth({
    workspaceId: workspace.id,
    budget,
    quota,
    policyStatus: input.policyStatus ?? state.healthReports[workspace.id]?.policyStatus ?? 'OK',
  });
  const nextSummary = { ...summary, health };
  writeState({
    ...state,
    budgets: { ...state.budgets, [workspace.id]: nextSummary.budget },
    quotas: { ...state.quotas, [workspace.id]: nextSummary.quota },
    healthReports: { ...state.healthReports, [workspace.id]: nextSummary.health },
  });
  return clone(nextSummary);
}

export function clearWorkspaceGovernance() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(WORKSPACE_GOVERNANCE_KEY);
}
