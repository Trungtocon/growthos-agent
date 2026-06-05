import type { ArtifactRecord } from './artifact-registry';

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'expired';
export type BillingPlanId = 'starter' | 'growth' | 'scale' | 'enterprise';
export type SupportSlaLevel = 'community' | 'business' | 'premium' | 'enterprise';

export interface LicenseEntitlements {
  allowedModules: string[];
  userLimit: number;
  workspaceLimit: number;
  agentLimit: number;
  runLimit: number;
  storageGbLimit: number;
  artifactLimit: number;
  supportSlaLevel: SupportSlaLevel;
  complianceFeaturesEnabled: boolean;
}

export interface BillingPlan {
  planId: BillingPlanId;
  name: string;
  monthlyPriceUsd: number;
  entitlements: LicenseEntitlements;
}

export interface TenantSubscription {
  subscriptionId: string;
  tenantId: string;
  workspaceId: string;
  planId: BillingPlanId;
  status: SubscriptionStatus;
  startedAt: string;
  currentPeriodEnd: string;
  updatedAt: string;
  cancelledAt?: string;
  suspendedReason?: string;
}

export interface BillingUsageSnapshot {
  tenantId: string;
  users: number;
  workspaces: number;
  agents: number;
  runs: number;
  storageGb: number;
  artifacts: number;
  measuredAt: string;
}

export interface UsageQuotaFinding {
  id: string;
  metric: keyof Omit<BillingUsageSnapshot, 'tenantId' | 'measuredAt'>;
  used: number;
  limit: number;
  percent: number;
  status: 'ok' | 'warning' | 'blocked';
  reason: string;
  recommendedFix: string;
}

export interface LicenseGateResult {
  tenantId: string;
  valid: boolean;
  status: 'valid' | 'warning' | 'blocked';
  planId?: BillingPlanId;
  subscriptionStatus?: SubscriptionStatus;
  blockers: string[];
  warnings: string[];
  checkedAt: string;
}

export interface UsageGateResult {
  tenantId: string;
  status: 'ok' | 'warning' | 'blocked';
  findings: UsageQuotaFinding[];
  blockers: string[];
  warnings: string[];
  checkedAt: string;
}

export interface ProductionBillingSummary {
  tenantId: string;
  subscriptionStatus: SubscriptionStatus | 'missing';
  planId?: BillingPlanId;
  licenseStatus: LicenseGateResult['status'];
  usageStatus: UsageGateResult['status'];
  supportSlaLevel: SupportSlaLevel;
  blockers: number;
  warnings: number;
  artifacts: number;
}

export interface ProductionBillingDashboard {
  tenantId: string;
  plans: BillingPlan[];
  subscription?: TenantSubscription;
  entitlements: LicenseEntitlements;
  usage: BillingUsageSnapshot;
  licenseGate: LicenseGateResult;
  usageGate: UsageGateResult;
  summary: ProductionBillingSummary;
  artifacts: ArtifactRecord[];
}

export interface ProductionBillingState {
  subscriptions: TenantSubscription[];
  usage: BillingUsageSnapshot[];
  artifacts: ArtifactRecord[];
  activeTenantId?: string;
  updatedAt: string;
}
