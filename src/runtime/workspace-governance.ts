import type { Artifact } from '../domain/types';

export type WorkspaceStatus = 'active' | 'paused' | 'review';
export type WorkspaceRole = 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';
export type GovernanceStatus = 'OK' | 'WARNING' | 'CRITICAL' | 'BLOCKED';

export interface Workspace {
  id: string;
  name: string;
  description: string;
  status: WorkspaceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceTeam {
  id: string;
  workspaceId: string;
  name: string;
  memberCount: number;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  teamId: string;
  name: string;
  email: string;
  roleId: WorkspaceRole;
}

export interface WorkspaceBudget {
  workspaceId: string;
  monthlyLimit: number;
  currentSpend: number;
  remainingBudget: number;
}

export interface WorkspaceQuota {
  workspaceId: string;
  maxRuns: number;
  maxTokens: number;
  maxArtifacts: number;
  currentRuns: number;
  currentTokens: number;
  currentArtifacts: number;
}

export interface WorkspaceHealth {
  workspaceId: string;
  budgetStatus: GovernanceStatus;
  quotaStatus: GovernanceStatus;
  policyStatus: GovernanceStatus;
  overallStatus: GovernanceStatus;
  warnings: string[];
  generatedAt: string;
}

export interface WorkspaceGovernanceSummary {
  workspace: Workspace;
  budget: WorkspaceBudget;
  quota: WorkspaceQuota;
  health: WorkspaceHealth;
  teams: WorkspaceTeam[];
  members: WorkspaceMember[];
  roles: WorkspaceRole[];
}

function percent(used: number, limit: number): number {
  if (!limit) return used > 0 ? 101 : 0;
  return Number(((used / limit) * 100).toFixed(2));
}

function maxStatus(statuses: GovernanceStatus[]): GovernanceStatus {
  if (statuses.includes('BLOCKED')) return 'BLOCKED';
  if (statuses.includes('CRITICAL')) return 'CRITICAL';
  if (statuses.includes('WARNING')) return 'WARNING';
  return 'OK';
}

export function evaluateWorkspaceBudget(budget: WorkspaceBudget): GovernanceStatus {
  if (budget.currentSpend > budget.monthlyLimit) return 'CRITICAL';
  if (percent(budget.currentSpend, budget.monthlyLimit) > 90) return 'WARNING';
  return 'OK';
}

export function evaluateWorkspaceQuota(quota: WorkspaceQuota): GovernanceStatus {
  const runUsage = percent(quota.currentRuns, quota.maxRuns);
  const tokenUsage = percent(quota.currentTokens, quota.maxTokens);
  const artifactUsage = percent(quota.currentArtifacts, quota.maxArtifacts);
  if (runUsage > 100 || tokenUsage > 100 || artifactUsage > 100) return 'BLOCKED';
  if (runUsage > 90 || tokenUsage > 90 || artifactUsage > 90) return 'WARNING';
  return 'OK';
}

export function evaluateWorkspaceHealth(input: {
  workspaceId: string;
  budget: WorkspaceBudget;
  quota: WorkspaceQuota;
  policyStatus?: GovernanceStatus;
  generatedAt?: string;
}): WorkspaceHealth {
  const budgetStatus = evaluateWorkspaceBudget(input.budget);
  const quotaStatus = evaluateWorkspaceQuota(input.quota);
  const policyStatus = input.policyStatus ?? 'OK';
  const warnings: string[] = [];
  if (budgetStatus !== 'OK') warnings.push(`Workspace budget status is ${budgetStatus}.`);
  if (quotaStatus !== 'OK') warnings.push(`Workspace quota status is ${quotaStatus}.`);
  if (policyStatus !== 'OK') warnings.push(`Workspace policy status is ${policyStatus}.`);

  return {
    workspaceId: input.workspaceId,
    budgetStatus,
    quotaStatus,
    policyStatus,
    overallStatus: maxStatus([budgetStatus, quotaStatus, policyStatus]),
    warnings,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}

export function evaluateWorkspaceGovernance(summary: Omit<WorkspaceGovernanceSummary, 'health'>): WorkspaceGovernanceSummary {
  return {
    ...summary,
    health: evaluateWorkspaceHealth({
      workspaceId: summary.workspace.id,
      budget: summary.budget,
      quota: summary.quota,
      policyStatus: 'OK',
    }),
  };
}

export function workspaceGovernanceArtifacts(summary: WorkspaceGovernanceSummary, runId: string): Artifact[] {
  const createdAt = new Date().toISOString();
  const markdownSummary = [
    '# Workspace Governance Summary',
    '',
    `- Workspace: ${summary.workspace.name}`,
    `- Status: ${summary.workspace.status}`,
    `- Budget: $${summary.budget.currentSpend.toFixed(2)} / $${summary.budget.monthlyLimit.toFixed(2)}`,
    `- Remaining budget: $${summary.budget.remainingBudget.toFixed(2)}`,
    `- Runs quota: ${summary.quota.currentRuns}/${summary.quota.maxRuns}`,
    `- Token quota: ${summary.quota.currentTokens}/${summary.quota.maxTokens}`,
    `- Artifact quota: ${summary.quota.currentArtifacts}/${summary.quota.maxArtifacts}`,
    `- Overall health: ${summary.health.overallStatus}`,
    '',
    '## Warnings',
    ...(summary.health.warnings.length ? summary.health.warnings.map((warning) => `- ${warning}`) : ['- No active workspace governance warnings.']),
  ].join('\n');

  return [
    {
      id: `workspace-governance-json-${runId}`,
      runId,
      type: 'json',
      name: 'workspace-governance.json',
      source: 'mock',
      contentSummary: 'Workspace governance JSON export with budget, quota, members, teams, and health.',
      contentJson: summary,
      createdAt,
      sizeBytes: JSON.stringify(summary).length,
    },
    {
      id: `workspace-governance-summary-${runId}`,
      runId,
      type: 'markdown',
      name: 'workspace-summary.md',
      source: 'mock',
      contentSummary: 'Workspace governance summary generated from runtime governance store.',
      contentText: markdownSummary,
      language: 'markdown',
      createdAt,
      sizeBytes: markdownSummary.length,
    },
    {
      id: `workspace-health-report-${runId}`,
      runId,
      type: 'markdown',
      name: 'workspace-health-report.md',
      source: 'mock',
      contentSummary: 'Workspace health report with budget, quota, and policy status.',
      contentText: markdownSummary,
      language: 'markdown',
      createdAt,
      sizeBytes: markdownSummary.length,
    },
  ];
}
