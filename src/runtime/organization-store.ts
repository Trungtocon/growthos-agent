import { demoWorkspace } from '../data/demo-fixtures';
import { getWorkspaceGovernanceSummary } from './workspace-governance-store';
import {
  evaluateOrganizationHealth,
  evaluateTenantHealth,
  type Organization,
  type OrganizationGovernanceSummary,
  type OrganizationHealth,
  type Tenant,
  type TenantBudget,
  type TenantHealth,
  type TenantQuota,
  type WorkspaceReference,
} from './organization-governance';

interface OrganizationState {
  organizations: Organization[];
  tenants: Tenant[];
  workspaceReferences: WorkspaceReference[];
  tenantBudgets: Record<string, TenantBudget>;
  tenantQuotas: Record<string, TenantQuota>;
  tenantHealth: Record<string, TenantHealth>;
  organizationHealth: Record<string, OrganizationHealth>;
}

const ORGANIZATION_KEY = 'uikigai-organization-governance-v1';
const ORGANIZATION_ID = 'org-growthos-enterprise';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function defaultOrganization(): Organization {
  return {
    id: ORGANIZATION_ID,
    name: 'GrowthOS Enterprise',
    description: 'Enterprise multi-tenant control plane for GrowthOS AI workforce operations.',
    status: 'active',
    createdAt: demoWorkspace.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

function defaultTenants(): Tenant[] {
  return [
    {
      id: 'tenant-marketing',
      organizationId: ORGANIZATION_ID,
      name: 'Marketing',
      status: 'active',
      workspaceIds: ['workspace-marketing-content'],
      budgetId: 'tenant-budget-marketing',
      quotaId: 'tenant-quota-marketing',
    },
    {
      id: 'tenant-operations',
      organizationId: ORGANIZATION_ID,
      name: 'Operations',
      status: 'active',
      workspaceIds: [demoWorkspace.id],
      budgetId: 'tenant-budget-operations',
      quotaId: 'tenant-quota-operations',
    },
    {
      id: 'tenant-sales',
      organizationId: ORGANIZATION_ID,
      name: 'Sales',
      status: 'review',
      workspaceIds: ['workspace-sales-pipeline'],
      budgetId: 'tenant-budget-sales',
      quotaId: 'tenant-quota-sales',
    },
  ];
}

function defaultWorkspaceReferences(tenants: Tenant[]): WorkspaceReference[] {
  return tenants.flatMap((tenant) => tenant.workspaceIds.map((workspaceId) => ({
    workspaceId,
    tenantId: tenant.id,
    organizationId: tenant.organizationId,
  })));
}

function defaultBudgetForTenant(tenant: Tenant): TenantBudget {
  const workspaceGovernance = getWorkspaceGovernanceSummary();
  const staticBudgets: Record<string, TenantBudget> = {
    'tenant-marketing': {
      tenantId: tenant.id,
      monthlyLimit: 2200,
      currentSpend: 1420,
      remainingBudget: 780,
    },
    'tenant-sales': {
      tenantId: tenant.id,
      monthlyLimit: 1800,
      currentSpend: 1650,
      remainingBudget: 150,
    },
  };
  if (tenant.id === 'tenant-operations') {
    const currentSpend = workspaceGovernance.budget.currentSpend;
    const monthlyLimit = workspaceGovernance.budget.monthlyLimit;
    return {
      tenantId: tenant.id,
      monthlyLimit,
      currentSpend,
      remainingBudget: Number(Math.max(0, monthlyLimit - currentSpend).toFixed(4)),
    };
  }
  return staticBudgets[tenant.id] ?? {
    tenantId: tenant.id,
    monthlyLimit: 1000,
    currentSpend: 0,
    remainingBudget: 1000,
  };
}

function defaultQuotaForTenant(tenant: Tenant): TenantQuota {
  const workspaceGovernance = getWorkspaceGovernanceSummary();
  const staticQuotas: Record<string, TenantQuota> = {
    'tenant-marketing': {
      tenantId: tenant.id,
      maxRuns: 80,
      maxTokens: 420000,
      maxArtifacts: 180,
      currentRuns: 38,
      currentTokens: 210000,
      currentArtifacts: 72,
    },
    'tenant-sales': {
      tenantId: tenant.id,
      maxRuns: 60,
      maxTokens: 300000,
      maxArtifacts: 120,
      currentRuns: 56,
      currentTokens: 268000,
      currentArtifacts: 96,
    },
  };
  if (tenant.id === 'tenant-operations') {
    const quota = workspaceGovernance.quota;
    return {
      tenantId: tenant.id,
      maxRuns: quota.maxRuns,
      maxTokens: quota.maxTokens,
      maxArtifacts: quota.maxArtifacts,
      currentRuns: quota.currentRuns,
      currentTokens: quota.currentTokens,
      currentArtifacts: quota.currentArtifacts,
    };
  }
  return staticQuotas[tenant.id] ?? {
    tenantId: tenant.id,
    maxRuns: 25,
    maxTokens: 100000,
    maxArtifacts: 50,
    currentRuns: 0,
    currentTokens: 0,
    currentArtifacts: 0,
  };
}

function emptyState(): OrganizationState {
  const organization = defaultOrganization();
  const tenants = defaultTenants();
  const workspaceReferences = defaultWorkspaceReferences(tenants);
  const tenantBudgets = Object.fromEntries(tenants.map((tenant) => [tenant.id, defaultBudgetForTenant(tenant)]));
  const tenantQuotas = Object.fromEntries(tenants.map((tenant) => [tenant.id, defaultQuotaForTenant(tenant)]));
  const tenantHealth = Object.fromEntries(tenants.map((tenant) => [tenant.id, evaluateTenantHealth({
    tenant,
    budget: tenantBudgets[tenant.id],
    quota: tenantQuotas[tenant.id],
  })]));
  const organizationHealth = evaluateOrganizationHealth({
    organization,
    tenants,
    workspaceReferences,
    tenantHealth: Object.values(tenantHealth),
  });

  return {
    organizations: [organization],
    tenants,
    workspaceReferences,
    tenantBudgets,
    tenantQuotas,
    tenantHealth,
    organizationHealth: { [organization.id]: organizationHealth },
  };
}

function readState(): OrganizationState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(ORGANIZATION_KEY);
    return raw ? { ...emptyState(), ...JSON.parse(raw) as OrganizationState } : emptyState();
  } catch {
    return emptyState();
  }
}

function writeState(state: OrganizationState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(ORGANIZATION_KEY, JSON.stringify(state));
}

function mergeTenantBudget(tenant: Tenant, stored?: TenantBudget): TenantBudget {
  const budget = defaultBudgetForTenant(tenant);
  const monthlyLimit = stored?.monthlyLimit ?? budget.monthlyLimit;
  const currentSpend = tenant.id === 'tenant-operations' ? budget.currentSpend : stored?.currentSpend ?? budget.currentSpend;
  return {
    tenantId: tenant.id,
    monthlyLimit,
    currentSpend,
    remainingBudget: Number(Math.max(0, monthlyLimit - currentSpend).toFixed(4)),
  };
}

function mergeTenantQuota(tenant: Tenant, stored?: TenantQuota): TenantQuota {
  const quota = defaultQuotaForTenant(tenant);
  const useRuntimeUsage = tenant.id === 'tenant-operations';
  return {
    tenantId: tenant.id,
    maxRuns: stored?.maxRuns ?? quota.maxRuns,
    maxTokens: stored?.maxTokens ?? quota.maxTokens,
    maxArtifacts: stored?.maxArtifacts ?? quota.maxArtifacts,
    currentRuns: useRuntimeUsage ? quota.currentRuns : stored?.currentRuns ?? quota.currentRuns,
    currentTokens: useRuntimeUsage ? quota.currentTokens : stored?.currentTokens ?? quota.currentTokens,
    currentArtifacts: useRuntimeUsage ? quota.currentArtifacts : stored?.currentArtifacts ?? quota.currentArtifacts,
  };
}

function buildOrganizationSummary(state: OrganizationState): OrganizationGovernanceSummary {
  const organization = state.organizations[0] ?? defaultOrganization();
  const tenants = state.tenants.length ? state.tenants : defaultTenants();
  const workspaceReferences = state.workspaceReferences.length ? state.workspaceReferences : defaultWorkspaceReferences(tenants);
  const tenantBudgets = tenants.map((tenant) => mergeTenantBudget(tenant, state.tenantBudgets[tenant.id]));
  const tenantQuotas = tenants.map((tenant) => mergeTenantQuota(tenant, state.tenantQuotas[tenant.id]));
  const tenantHealth = tenants.map((tenant) => evaluateTenantHealth({
    tenant,
    budget: tenantBudgets.find((budget) => budget.tenantId === tenant.id) ?? defaultBudgetForTenant(tenant),
    quota: tenantQuotas.find((quota) => quota.tenantId === tenant.id) ?? defaultQuotaForTenant(tenant),
    workspaceStatus: tenant.workspaceIds.length ? 'OK' : 'WARNING',
  }));
  const organizationHealth = evaluateOrganizationHealth({
    organization,
    tenants,
    workspaceReferences,
    tenantHealth,
  });
  return {
    organization,
    tenants,
    workspaceReferences,
    tenantBudgets,
    tenantQuotas,
    tenantHealth,
    organizationHealth,
  };
}

export function generateOrganizationGovernance(): OrganizationGovernanceSummary {
  const state = readState();
  const summary = buildOrganizationSummary(state);
  writeState({
    ...state,
    organizations: [summary.organization],
    tenants: summary.tenants,
    workspaceReferences: summary.workspaceReferences,
    tenantBudgets: Object.fromEntries(summary.tenantBudgets.map((budget) => [budget.tenantId, budget])),
    tenantQuotas: Object.fromEntries(summary.tenantQuotas.map((quota) => [quota.tenantId, quota])),
    tenantHealth: Object.fromEntries(summary.tenantHealth.map((health) => [health.tenantId, health])),
    organizationHealth: { [summary.organization.id]: summary.organizationHealth },
  });
  return clone(summary);
}

export function getOrganizationGovernanceSummary(): OrganizationGovernanceSummary {
  return clone(buildOrganizationSummary(readState()));
}

export function getOrganizations(): Organization[] {
  return getOrganizationGovernanceSummary().organization ? [getOrganizationGovernanceSummary().organization] : [];
}

export function getOrganization(organizationId = ORGANIZATION_ID): Organization | undefined {
  return getOrganizations().find((organization) => organization.id === organizationId);
}

export function getTenants(): Tenant[] {
  return getOrganizationGovernanceSummary().tenants;
}

export function getTenant(tenantId: string): Tenant | undefined {
  return getTenants().find((tenant) => tenant.id === tenantId);
}

export function getTenantBudget(tenantId: string): TenantBudget | undefined {
  return getOrganizationGovernanceSummary().tenantBudgets.find((budget) => budget.tenantId === tenantId);
}

export function getTenantQuota(tenantId: string): TenantQuota | undefined {
  return getOrganizationGovernanceSummary().tenantQuotas.find((quota) => quota.tenantId === tenantId);
}

export function getTenantHealth(tenantId: string): TenantHealth | undefined {
  return getOrganizationGovernanceSummary().tenantHealth.find((health) => health.tenantId === tenantId);
}

export function getOrganizationHealth(organizationId = ORGANIZATION_ID): OrganizationHealth | undefined {
  const summary = getOrganizationGovernanceSummary();
  return summary.organization.id === organizationId ? summary.organizationHealth : undefined;
}

export function getWorkspaceReferences(): WorkspaceReference[] {
  return getOrganizationGovernanceSummary().workspaceReferences;
}

export function setTenantGovernanceLimits(tenantId: string, input: {
  monthlyLimit?: number;
  currentSpend?: number;
  maxRuns?: number;
  currentRuns?: number;
  maxTokens?: number;
  currentTokens?: number;
  maxArtifacts?: number;
  currentArtifacts?: number;
}) {
  const state = readState();
  const tenant = state.tenants.find((item) => item.id === tenantId);
  if (!tenant) return undefined;
  const budget = mergeTenantBudget(tenant, state.tenantBudgets[tenant.id]);
  const quota = mergeTenantQuota(tenant, state.tenantQuotas[tenant.id]);
  const nextState: OrganizationState = {
    ...state,
    tenantBudgets: {
      ...state.tenantBudgets,
      [tenant.id]: {
        ...budget,
        monthlyLimit: input.monthlyLimit ?? budget.monthlyLimit,
        currentSpend: input.currentSpend ?? budget.currentSpend,
        remainingBudget: Number(Math.max(0, (input.monthlyLimit ?? budget.monthlyLimit) - (input.currentSpend ?? budget.currentSpend)).toFixed(4)),
      },
    },
    tenantQuotas: {
      ...state.tenantQuotas,
      [tenant.id]: {
        ...quota,
        maxRuns: input.maxRuns ?? quota.maxRuns,
        currentRuns: input.currentRuns ?? quota.currentRuns,
        maxTokens: input.maxTokens ?? quota.maxTokens,
        currentTokens: input.currentTokens ?? quota.currentTokens,
        maxArtifacts: input.maxArtifacts ?? quota.maxArtifacts,
        currentArtifacts: input.currentArtifacts ?? quota.currentArtifacts,
      },
    },
  };
  const summary = buildOrganizationSummary(nextState);
  writeState({
    ...nextState,
    tenantBudgets: Object.fromEntries(summary.tenantBudgets.map((item) => [item.tenantId, item])),
    tenantQuotas: Object.fromEntries(summary.tenantQuotas.map((item) => [item.tenantId, item])),
    tenantHealth: Object.fromEntries(summary.tenantHealth.map((item) => [item.tenantId, item])),
    organizationHealth: { [summary.organization.id]: summary.organizationHealth },
  });
  return clone(summary);
}

export function clearOrganizationGovernance() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(ORGANIZATION_KEY);
}
