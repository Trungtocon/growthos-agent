import type { Artifact } from '../domain/types';

export type OrganizationStatus = 'active' | 'paused' | 'review';
export type TenantStatus = 'active' | 'paused' | 'review';
export type OrganizationGovernanceStatus = 'OK' | 'WARNING' | 'CRITICAL';

export interface Organization {
  id: string;
  name: string;
  description: string;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  organizationId: string;
  name: string;
  status: TenantStatus;
  workspaceIds: string[];
  budgetId: string;
  quotaId: string;
}

export interface WorkspaceReference {
  workspaceId: string;
  tenantId: string;
  organizationId: string;
}

export interface TenantBudget {
  tenantId: string;
  monthlyLimit: number;
  currentSpend: number;
  remainingBudget: number;
}

export interface TenantQuota {
  tenantId: string;
  maxRuns: number;
  maxTokens: number;
  maxArtifacts: number;
  currentRuns: number;
  currentTokens: number;
  currentArtifacts: number;
}

export interface TenantHealth {
  tenantId: string;
  budgetStatus: OrganizationGovernanceStatus;
  quotaStatus: OrganizationGovernanceStatus;
  workspaceStatus: OrganizationGovernanceStatus;
  overallStatus: OrganizationGovernanceStatus;
  warnings: string[];
  generatedAt: string;
}

export interface OrganizationHealth {
  organizationId: string;
  tenantCount: number;
  workspaceCount: number;
  budgetHealth: OrganizationGovernanceStatus;
  quotaHealth: OrganizationGovernanceStatus;
  overallStatus: OrganizationGovernanceStatus;
  warnings: string[];
  generatedAt: string;
}

export interface OrganizationGovernanceSummary {
  organization: Organization;
  tenants: Tenant[];
  workspaceReferences: WorkspaceReference[];
  tenantBudgets: TenantBudget[];
  tenantQuotas: TenantQuota[];
  tenantHealth: TenantHealth[];
  organizationHealth: OrganizationHealth;
}

function percent(used: number, limit: number): number {
  if (!limit) return used > 0 ? 101 : 0;
  return Number(((used / limit) * 100).toFixed(2));
}

function maxStatus(statuses: OrganizationGovernanceStatus[]): OrganizationGovernanceStatus {
  if (statuses.includes('CRITICAL')) return 'CRITICAL';
  if (statuses.includes('WARNING')) return 'WARNING';
  return 'OK';
}

export function evaluateTenantBudget(budget: TenantBudget): OrganizationGovernanceStatus {
  if (budget.currentSpend > budget.monthlyLimit) return 'CRITICAL';
  if (percent(budget.currentSpend, budget.monthlyLimit) > 90) return 'WARNING';
  return 'OK';
}

export function evaluateTenantQuota(quota: TenantQuota): OrganizationGovernanceStatus {
  const runUsage = percent(quota.currentRuns, quota.maxRuns);
  const tokenUsage = percent(quota.currentTokens, quota.maxTokens);
  const artifactUsage = percent(quota.currentArtifacts, quota.maxArtifacts);
  if (runUsage > 100 || tokenUsage > 100 || artifactUsage > 100) return 'CRITICAL';
  if (runUsage > 90 || tokenUsage > 90 || artifactUsage > 90) return 'WARNING';
  return 'OK';
}

export function evaluateTenantHealth(input: {
  tenant: Tenant;
  budget: TenantBudget;
  quota: TenantQuota;
  workspaceStatus?: OrganizationGovernanceStatus;
  generatedAt?: string;
}): TenantHealth {
  const budgetStatus = evaluateTenantBudget(input.budget);
  const quotaStatus = evaluateTenantQuota(input.quota);
  const workspaceStatus = input.workspaceStatus ?? (input.tenant.workspaceIds.length ? 'OK' : 'WARNING');
  const warnings: string[] = [];
  if (budgetStatus !== 'OK') warnings.push(`${input.tenant.name} tenant budget status is ${budgetStatus}.`);
  if (quotaStatus !== 'OK') warnings.push(`${input.tenant.name} tenant quota status is ${quotaStatus}.`);
  if (workspaceStatus !== 'OK') warnings.push(`${input.tenant.name} tenant workspace status is ${workspaceStatus}.`);
  return {
    tenantId: input.tenant.id,
    budgetStatus,
    quotaStatus,
    workspaceStatus,
    overallStatus: maxStatus([budgetStatus, quotaStatus, workspaceStatus]),
    warnings,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}

export function evaluateOrganizationHealth(input: {
  organization: Organization;
  tenants: Tenant[];
  workspaceReferences: WorkspaceReference[];
  tenantHealth: TenantHealth[];
  generatedAt?: string;
}): OrganizationHealth {
  const budgetHealth = maxStatus(input.tenantHealth.map((health) => health.budgetStatus));
  const quotaHealth = maxStatus(input.tenantHealth.map((health) => health.quotaStatus));
  const overallStatus = maxStatus([budgetHealth, quotaHealth, ...input.tenantHealth.map((health) => health.overallStatus)]);
  const warnings = input.tenantHealth.flatMap((health) => health.warnings);
  return {
    organizationId: input.organization.id,
    tenantCount: input.tenants.length,
    workspaceCount: input.workspaceReferences.length,
    budgetHealth,
    quotaHealth,
    overallStatus,
    warnings,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}

export function organizationGovernanceArtifacts(summary: OrganizationGovernanceSummary, runId: string): Artifact[] {
  const createdAt = new Date().toISOString();
  const summaryMarkdown = [
    '# Organization Governance Summary',
    '',
    `- Organization: ${summary.organization.name}`,
    `- Status: ${summary.organization.status}`,
    `- Tenants: ${summary.organizationHealth.tenantCount}`,
    `- Workspaces: ${summary.organizationHealth.workspaceCount}`,
    `- Budget health: ${summary.organizationHealth.budgetHealth}`,
    `- Quota health: ${summary.organizationHealth.quotaHealth}`,
    `- Overall health: ${summary.organizationHealth.overallStatus}`,
    '',
    '## Tenant Health',
    ...summary.tenants.map((tenant) => {
      const health = summary.tenantHealth.find((item) => item.tenantId === tenant.id);
      return `- ${tenant.name}: ${health?.overallStatus ?? 'OK'} (${tenant.workspaceIds.length} workspaces)`;
    }),
  ].join('\n');
  const healthMarkdown = [
    '# Tenant Health Report',
    '',
    ...summary.tenantHealth.map((health) => {
      const tenant = summary.tenants.find((item) => item.id === health.tenantId);
      return [
        `## ${tenant?.name ?? health.tenantId}`,
        `- Budget: ${health.budgetStatus}`,
        `- Quota: ${health.quotaStatus}`,
        `- Workspace: ${health.workspaceStatus}`,
        `- Overall: ${health.overallStatus}`,
        ...(health.warnings.length ? health.warnings.map((warning) => `- ${warning}`) : ['- No active warnings.']),
      ].join('\n');
    }),
  ].join('\n\n');

  return [
    {
      id: `organization-governance-json-${runId}`,
      runId,
      type: 'json',
      name: 'organization-governance.json',
      source: 'mock',
      contentSummary: 'Organization governance JSON export with tenants, workspaces, budgets, quotas, and health.',
      contentJson: summary,
      createdAt,
      sizeBytes: JSON.stringify(summary).length,
    },
    {
      id: `organization-summary-${runId}`,
      runId,
      type: 'markdown',
      name: 'organization-summary.md',
      source: 'mock',
      contentSummary: 'Organization-level governance summary generated from the multi-tenant store.',
      contentText: summaryMarkdown,
      language: 'markdown',
      createdAt,
      sizeBytes: summaryMarkdown.length,
    },
    {
      id: `tenant-health-report-${runId}`,
      runId,
      type: 'markdown',
      name: 'tenant-health-report.md',
      source: 'mock',
      contentSummary: 'Tenant health report with budget, quota, workspace, and warning status.',
      contentText: healthMarkdown,
      language: 'markdown',
      createdAt,
      sizeBytes: healthMarkdown.length,
    },
  ];
}
