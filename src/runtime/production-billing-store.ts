import { demoWorkspace } from '../data/demo-fixtures';
import { registerArtifact } from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import type {
  BillingPlan,
  BillingPlanId,
  BillingUsageSnapshot,
  LicenseEntitlements,
  LicenseGateResult,
  ProductionBillingDashboard,
  ProductionBillingState,
  SubscriptionStatus,
  TenantSubscription,
  UsageGateResult,
  UsageQuotaFinding,
} from './production-billing';

const PRODUCTION_BILLING_KEY = 'uikigai-production-billing-v1';
const DEFAULT_TENANT_ID = 'tenant-uikigai-demo';

export const BILLING_PLANS: BillingPlan[] = [
  {
    planId: 'starter',
    name: 'Starter',
    monthlyPriceUsd: 49,
    entitlements: {
      allowedModules: ['runtime', 'artifacts', 'support'],
      userLimit: 10,
      workspaceLimit: 1,
      agentLimit: 5,
      runLimit: 100,
      storageGbLimit: 10,
      artifactLimit: 100,
      supportSlaLevel: 'community',
      complianceFeaturesEnabled: false,
    },
  },
  {
    planId: 'growth',
    name: 'Growth',
    monthlyPriceUsd: 199,
    entitlements: {
      allowedModules: ['runtime', 'artifacts', 'support', 'governance'],
      userLimit: 35,
      workspaceLimit: 3,
      agentLimit: 25,
      runLimit: 1000,
      storageGbLimit: 100,
      artifactLimit: 1000,
      supportSlaLevel: 'business',
      complianceFeaturesEnabled: true,
    },
  },
  {
    planId: 'scale',
    name: 'Scale',
    monthlyPriceUsd: 799,
    entitlements: {
      allowedModules: ['runtime', 'artifacts', 'support', 'governance', 'worker', 'operations'],
      userLimit: 120,
      workspaceLimit: 10,
      agentLimit: 100,
      runLimit: 10000,
      storageGbLimit: 1000,
      artifactLimit: 10000,
      supportSlaLevel: 'premium',
      complianceFeaturesEnabled: true,
    },
  },
  {
    planId: 'enterprise',
    name: 'Enterprise',
    monthlyPriceUsd: 2499,
    entitlements: {
      allowedModules: ['runtime', 'artifacts', 'support', 'governance', 'worker', 'operations', 'compliance', 'production'],
      userLimit: 500,
      workspaceLimit: 50,
      agentLimit: 500,
      runLimit: 100000,
      storageGbLimit: 10000,
      artifactLimit: 100000,
      supportSlaLevel: 'enterprise',
      complianceFeaturesEnabled: true,
    },
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyState(): ProductionBillingState {
  return { subscriptions: [], usage: [], artifacts: [], updatedAt: nowIso() };
}

function readState(): ProductionBillingState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(PRODUCTION_BILLING_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ProductionBillingState>;
    return {
      subscriptions: parsed.subscriptions ?? [],
      usage: parsed.usage ?? [],
      artifacts: parsed.artifacts ?? [],
      activeTenantId: parsed.activeTenantId,
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: ProductionBillingState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PRODUCTION_BILLING_KEY, JSON.stringify({ ...state, updatedAt: nowIso() }));
}

function planFor(planId?: BillingPlanId): BillingPlan {
  return BILLING_PLANS.find((plan) => plan.planId === planId) ?? BILLING_PLANS[0];
}

function defaultUsage(tenantId: string): BillingUsageSnapshot {
  return { tenantId, users: 0, workspaces: 0, agents: 0, runs: 0, storageGb: 0, artifacts: 0, measuredAt: nowIso() };
}

function activeSubscription(tenantId = DEFAULT_TENANT_ID): TenantSubscription | undefined {
  const subscriptions = readState().subscriptions.filter((entry) => entry.tenantId === tenantId);
  return subscriptions.find((entry) => ['trial', 'active', 'past_due', 'suspended'].includes(entry.status)) ?? subscriptions[0];
}

function latestUsage(tenantId = DEFAULT_TENANT_ID): BillingUsageSnapshot {
  return readState().usage.find((entry) => entry.tenantId === tenantId) ?? defaultUsage(tenantId);
}

function persistSubscription(subscription: TenantSubscription, active = true): TenantSubscription {
  const state = readState();
  writeState({
    ...state,
    subscriptions: [subscription, ...state.subscriptions.filter((entry) => entry.subscriptionId !== subscription.subscriptionId)],
    activeTenantId: active ? subscription.tenantId : state.activeTenantId,
  });
  return clone(subscription);
}

function persistUsage(usage: BillingUsageSnapshot): BillingUsageSnapshot {
  const state = readState();
  writeState({
    ...state,
    usage: [usage, ...state.usage.filter((entry) => entry.tenantId !== usage.tenantId)],
    activeTenantId: usage.tenantId,
  });
  return clone(usage);
}

function finding(tenantId: string, metric: UsageQuotaFinding['metric'], used: number, limit: number): UsageQuotaFinding {
  const percent = limit > 0 ? Math.round((used / limit) * 100) : 100;
  const blocked = used > limit;
  return {
    id: `billing-${tenantId}-${metric}`,
    metric,
    used,
    limit,
    percent,
    status: blocked ? 'blocked' : percent >= 80 ? 'warning' : 'ok',
    reason: blocked ? `${metric} usage exceeds licensed quota.` : `${metric} usage is at ${percent}% of quota.`,
    recommendedFix: blocked ? 'Upgrade plan, reduce usage, or request commercial override.' : 'Review plan capacity before additional production usage.',
  };
}

export function clearProductionBillingStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PRODUCTION_BILLING_KEY);
}

export function createTenantSubscription(input: {
  tenantId?: string;
  workspaceId?: string;
  planId?: BillingPlanId;
  status?: SubscriptionStatus;
} = {}): TenantSubscription {
  const timestamp = nowIso();
  const subscription: TenantSubscription = {
    subscriptionId: unique('subscription'),
    tenantId: input.tenantId ?? DEFAULT_TENANT_ID,
    workspaceId: input.workspaceId ?? demoWorkspace.id,
    planId: input.planId ?? 'growth',
    status: input.status ?? 'trial',
    startedAt: timestamp,
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: timestamp,
  };
  return persistSubscription(subscription);
}

export function activateSubscription(subscriptionId?: string): TenantSubscription {
  const current = subscriptionId
    ? readState().subscriptions.find((entry) => entry.subscriptionId === subscriptionId)
    : activeSubscription();
  const target = current ?? createTenantSubscription();
  return persistSubscription({ ...target, status: 'active', suspendedReason: undefined, updatedAt: nowIso() });
}

export function markSubscriptionPastDue(subscriptionId?: string): TenantSubscription {
  const target = subscriptionId ? readState().subscriptions.find((entry) => entry.subscriptionId === subscriptionId) : activeSubscription();
  const subscription = target ?? createTenantSubscription();
  return persistSubscription({ ...subscription, status: 'past_due', updatedAt: nowIso() });
}

export function suspendSubscription(subscriptionId?: string, reason = 'Subscription suspended by billing policy.'): TenantSubscription {
  const target = subscriptionId ? readState().subscriptions.find((entry) => entry.subscriptionId === subscriptionId) : activeSubscription();
  const subscription = target ?? createTenantSubscription();
  return persistSubscription({ ...subscription, status: 'suspended', suspendedReason: reason, updatedAt: nowIso() });
}

export function cancelSubscription(subscriptionId?: string): TenantSubscription {
  const target = subscriptionId ? readState().subscriptions.find((entry) => entry.subscriptionId === subscriptionId) : activeSubscription();
  const subscription = target ?? createTenantSubscription();
  return persistSubscription({ ...subscription, status: 'cancelled', cancelledAt: nowIso(), updatedAt: nowIso() });
}

export function expireSubscription(subscriptionId?: string): TenantSubscription {
  const target = subscriptionId ? readState().subscriptions.find((entry) => entry.subscriptionId === subscriptionId) : activeSubscription();
  const subscription = target ?? createTenantSubscription();
  return persistSubscription({ ...subscription, status: 'expired', updatedAt: nowIso() });
}

export function recordBillingUsage(
  tenantId = DEFAULT_TENANT_ID,
  input: Partial<Omit<BillingUsageSnapshot, 'tenantId' | 'measuredAt'>> = {},
): ProductionBillingDashboard {
  persistUsage({
    ...defaultUsage(tenantId),
    ...input,
    tenantId,
    measuredAt: nowIso(),
  });
  return selectProductionBillingDashboard(tenantId);
}

export function getLicenseEntitlements(planId?: BillingPlanId): LicenseEntitlements {
  return clone(planFor(planId).entitlements);
}

export function evaluateLicenseGate(tenantId = DEFAULT_TENANT_ID): LicenseGateResult {
  const subscription = activeSubscription(tenantId);
  const checkedAt = nowIso();
  if (!subscription) {
    return {
      tenantId,
      valid: false,
      status: 'blocked',
      blockers: ['No tenant subscription exists.'],
      warnings: [],
      checkedAt,
    };
  }
  const active = subscription.status === 'active' || subscription.status === 'trial';
  const warnings = subscription.status === 'trial' ? ['Tenant is in trial; confirm commercial conversion before final production go-live.'] : [];
  const blockers = active ? [] : [`Tenant subscription is ${subscription.status}. Active subscription is required.`];
  return {
    tenantId,
    valid: blockers.length === 0,
    status: blockers.length ? 'blocked' : warnings.length ? 'warning' : 'valid',
    planId: subscription.planId,
    subscriptionStatus: subscription.status,
    blockers,
    warnings,
    checkedAt,
  };
}

export function evaluateUsageGate(tenantId = DEFAULT_TENANT_ID): UsageGateResult {
  const subscription = activeSubscription(tenantId);
  const entitlements = getLicenseEntitlements(subscription?.planId);
  const usage = latestUsage(tenantId);
  const findings = [
    finding(tenantId, 'users', usage.users, entitlements.userLimit),
    finding(tenantId, 'workspaces', usage.workspaces, entitlements.workspaceLimit),
    finding(tenantId, 'agents', usage.agents, entitlements.agentLimit),
    finding(tenantId, 'runs', usage.runs, entitlements.runLimit),
    finding(tenantId, 'storageGb', usage.storageGb, entitlements.storageGbLimit),
    finding(tenantId, 'artifacts', usage.artifacts, entitlements.artifactLimit),
  ];
  const blockers = findings.filter((entry) => entry.status === 'blocked').map((entry) => entry.reason);
  const warnings = findings.filter((entry) => entry.status === 'warning').map((entry) => entry.reason);
  return {
    tenantId,
    status: blockers.length ? 'blocked' : warnings.length ? 'warning' : 'ok',
    findings,
    blockers,
    warnings,
    checkedAt: nowIso(),
  };
}

export function selectProductionBillingDashboard(tenantId?: string): ProductionBillingDashboard {
  const state = readState();
  const resolvedTenantId = tenantId ?? state.activeTenantId ?? DEFAULT_TENANT_ID;
  const subscription = activeSubscription(resolvedTenantId);
  const entitlements = getLicenseEntitlements(subscription?.planId);
  const usage = latestUsage(resolvedTenantId);
  const licenseGate = evaluateLicenseGate(resolvedTenantId);
  const usageGate = evaluateUsageGate(resolvedTenantId);
  return {
    tenantId: resolvedTenantId,
    plans: clone(BILLING_PLANS),
    subscription,
    entitlements,
    usage,
    licenseGate,
    usageGate,
    artifacts: clone(state.artifacts),
    summary: {
      tenantId: resolvedTenantId,
      subscriptionStatus: subscription?.status ?? 'missing',
      planId: subscription?.planId,
      licenseStatus: licenseGate.status,
      usageStatus: usageGate.status,
      supportSlaLevel: entitlements.supportSlaLevel,
      blockers: licenseGate.blockers.length + usageGate.blockers.length,
      warnings: licenseGate.warnings.length + usageGate.warnings.length,
      artifacts: state.artifacts.length,
    },
  };
}

function createArtifact(name: string, tenantId: string, summary: string, type: ArtifactRecord['type'] = 'REPORT'): ArtifactRecord {
  const timestamp = nowIso();
  return {
    id: `billing-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    name,
    type,
    lifecycle: 'AVAILABLE',
    workspaceId: demoWorkspace.id,
    version: 1,
    metadata: {
      workspaceId: demoWorkspace.id,
      source: 'mock',
      sourceType: 'production-billing',
      contentSummary: summary,
      tags: ['production-billing', tenantId, 'license-gate'],
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function exportBillingUsageReport(tenantId?: string): ArtifactRecord[] {
  const dashboard = selectProductionBillingDashboard(tenantId);
  const artifacts = [
    createArtifact('billing-summary.md', dashboard.tenantId, `Billing status ${dashboard.summary.subscriptionStatus} on ${dashboard.summary.planId ?? 'no plan'}.`, 'REPORT'),
    createArtifact('subscription-status.json', dashboard.tenantId, `Subscription status ${dashboard.summary.subscriptionStatus}.`, 'AUDIT'),
    createArtifact('license-entitlements.json', dashboard.tenantId, `License entitlements for ${dashboard.summary.planId ?? 'missing plan'}.`, 'AUDIT'),
    createArtifact('usage-quota-report.md', dashboard.tenantId, `Usage gate ${dashboard.usageGate.status} with ${dashboard.usageGate.findings.length} quota checks.`, 'REPORT'),
    createArtifact('billing-blockers.json', dashboard.tenantId, `${dashboard.summary.blockers} billing blocker(s).`, 'AUDIT'),
  ].map((artifact) => registerArtifact(artifact, { createdBy: 'production-billing' }));
  const state = readState();
  writeState({ ...state, artifacts: artifacts.concat(state.artifacts.filter((entry) => !artifacts.some((artifact) => artifact.id === entry.id))) });
  return clone(artifacts);
}

export function getBillingLicenseBlockers(tenantId?: string): string[] {
  const dashboard = selectProductionBillingDashboard(tenantId);
  return [...dashboard.licenseGate.blockers, ...dashboard.usageGate.blockers];
}

export function getBillingWarnings(tenantId?: string): string[] {
  const dashboard = selectProductionBillingDashboard(tenantId);
  return [...dashboard.licenseGate.warnings, ...dashboard.usageGate.warnings];
}

export function getSupportSlaForTenant(tenantId?: string): LicenseEntitlements['supportSlaLevel'] {
  return selectProductionBillingDashboard(tenantId).entitlements.supportSlaLevel;
}

export function selectProductionBillingArtifacts(): ArtifactRecord[] {
  return clone(readState().artifacts);
}
