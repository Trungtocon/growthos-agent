import { getRunArtifacts } from '../../runtime-store/artifact-store';
import { getRunPlan } from '../../runtime-store/run-plan-store';
import { getToolCallsByRun } from '../../runtime-store/tool-call-store';
import {
  addUsageRecord,
  finalizeBillingLedger,
  getBillingLedger,
  getUsageByRun,
  getUsageQuotas,
  upsertQuotaReport,
} from '../../runtime-store/usage-ledger-store';
import { estimateRunPlanBudget } from './execution-budget';

export type UsageRecordType = 'token' | 'tool_call' | 'artifact' | 'approval' | 'runtime_duration' | 'external_api';
export type UsageQuotaScope = 'workspace' | 'user' | 'run' | 'tool' | 'model';
export type UsageQuotaLimitType = 'cost' | 'token' | 'tool_calls' | 'duration';
export type UsageQuotaStatus = 'ok' | 'warning' | 'exceeded';

export interface UsageRecord {
  id: string;
  runId: string;
  toolId?: string;
  modelId?: string;
  artifactId?: string;
  type: UsageRecordType;
  quantity: number;
  unit: string;
  estimatedCost: number;
  actualCost: number;
  currency: 'USD';
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface BillingLedger {
  runId: string;
  estimatedTotal: number;
  actualTotal: number;
  records: UsageRecord[];
  variance: number;
  status: 'open' | 'finalized';
}

export interface UsageQuota {
  id: string;
  scope: UsageQuotaScope;
  limitType: UsageQuotaLimitType;
  limit: number;
  used: number;
  remaining: number;
  resetAt?: string;
  status: UsageQuotaStatus;
}

export interface QuotaEvaluationReport {
  targetId: string;
  status: UsageQuotaStatus;
  quotas: UsageQuota[];
  warnings: string[];
  blockingReasons: string[];
  evaluatedAt: string;
}

function now() {
  return new Date().toISOString();
}

function usageId(runId: string, type: UsageRecordType, target = 'runtime') {
  return `usage-${runId}-${type}-${target}-${Date.now()}`;
}

function toMoney(value: number) {
  return Number(value.toFixed(4));
}

export function createUsageRecord(input: Omit<UsageRecord, 'id' | 'currency' | 'createdAt'> & { id?: string; createdAt?: string; currency?: 'USD' }): UsageRecord {
  return {
    ...input,
    id: input.id ?? usageId(input.runId, input.type, input.toolId ?? input.artifactId),
    currency: input.currency ?? 'USD',
    estimatedCost: toMoney(input.estimatedCost),
    actualCost: toMoney(input.actualCost),
    createdAt: input.createdAt ?? now(),
  };
}

export function recordRunStartUsage(runId: string, estimatedCost = 0, metadata: Record<string, unknown> = {}): UsageRecord {
  return addUsageRecord(createUsageRecord({
    id: `usage-${runId}-runtime-start`,
    runId,
    type: 'runtime_duration',
    quantity: 0,
    unit: 'seconds',
    estimatedCost,
    actualCost: 0,
    metadata: { lifecycle: 'started', ...metadata },
  }));
}

export function recordToolStartUsage(runId: string, toolId: string, toolName: string, estimatedCost: number): UsageRecord {
  return addUsageRecord(createUsageRecord({
    id: `usage-${runId}-${toolId}-call`,
    runId,
    toolId,
    type: 'tool_call',
    quantity: 1,
    unit: 'call',
    estimatedCost,
    actualCost: Math.max(0.0005, estimatedCost * 0.4),
    metadata: { toolName, phase: 'started' },
  }));
}

export function recordToolCompletionUsage(input: {
  runId: string;
  toolId: string;
  toolName: string;
  modelId?: string;
  durationMs?: number;
  estimatedCost: number;
  actualCost?: number;
}): UsageRecord[] {
  const durationSeconds = Math.max(1, Math.round((input.durationMs ?? 1000) / 1000));
  const tokenQuantity = Math.max(250, Math.round(durationSeconds * 110));
  const actualCost = input.actualCost ?? input.estimatedCost * 1.08;
  return [
    addUsageRecord(createUsageRecord({
      id: `usage-${input.runId}-${input.toolId}-tokens`,
      runId: input.runId,
      toolId: input.toolId,
      modelId: input.modelId,
      type: 'token',
      quantity: tokenQuantity,
      unit: 'tokens',
      estimatedCost: input.estimatedCost * 0.58,
      actualCost: actualCost * 0.58,
      metadata: { toolName: input.toolName },
    })),
    addUsageRecord(createUsageRecord({
      id: `usage-${input.runId}-${input.toolId}-duration`,
      runId: input.runId,
      toolId: input.toolId,
      type: 'runtime_duration',
      quantity: durationSeconds,
      unit: 'seconds',
      estimatedCost: input.estimatedCost * 0.42,
      actualCost: actualCost * 0.42,
      metadata: { toolName: input.toolName },
    })),
  ];
}

export function recordArtifactUsage(runId: string, artifactId: string, toolId?: string): UsageRecord {
  return addUsageRecord(createUsageRecord({
    id: `usage-${runId}-${artifactId}-artifact`,
    runId,
    toolId,
    artifactId,
    type: 'artifact',
    quantity: 1,
    unit: 'artifact',
    estimatedCost: 0.003,
    actualCost: 0.0035,
    metadata: { source: 'paperclip' },
  }));
}

export function recordApprovalUsage(runId: string, approvalId: string, toolId?: string): UsageRecord {
  return addUsageRecord(createUsageRecord({
    id: `usage-${runId}-${approvalId}-approval`,
    runId,
    toolId,
    type: 'approval',
    quantity: 1,
    unit: 'approval',
    estimatedCost: 0,
    actualCost: 0,
    metadata: { approvalId },
  }));
}

function quotaStatus(used: number, limit: number): UsageQuotaStatus {
  if (used > limit) return 'exceeded';
  if (used >= limit * 0.8) return 'warning';
  return 'ok';
}

function normalizeQuota(quota: UsageQuota, used: number): UsageQuota {
  return {
    ...quota,
    used,
    remaining: Math.max(0, Number((quota.limit - used).toFixed(4))),
    status: quotaStatus(used, quota.limit),
  };
}

function reportFor(targetId: string, quotas: UsageQuota[]): QuotaEvaluationReport {
  const warnings = quotas
    .filter((quota) => quota.status === 'warning')
    .map((quota) => `${quota.limitType} quota is near limit: ${quota.used}/${quota.limit}.`);
  const blockingReasons = quotas
    .filter((quota) => quota.status === 'exceeded')
    .map((quota) => `${quota.limitType} quota exceeded: ${quota.used}/${quota.limit}.`);
  const status: UsageQuotaStatus = blockingReasons.length ? 'exceeded' : warnings.length ? 'warning' : 'ok';
  return upsertQuotaReport({ targetId, status, quotas, warnings, blockingReasons, evaluatedAt: now() });
}

export function evaluateQuotaBeforeRun(planId: string): QuotaEvaluationReport {
  const plan = getRunPlan(planId);
  const estimate = plan ? estimateRunPlanBudget(plan) : { estimatedCost: 0, estimatedTokens: 0, estimatedDuration: 0, toolCosts: [] };
  const quotas = getUsageQuotas();
  const evaluated = quotas
    .filter((quota) => ['workspace', 'run', 'tool', 'model'].includes(quota.scope))
    .map((quota) => {
      if (quota.limitType === 'cost') return normalizeQuota(quota, estimate.estimatedCost);
      if (quota.limitType === 'token') return normalizeQuota(quota, estimate.estimatedTokens);
      if (quota.limitType === 'duration') return normalizeQuota(quota, estimate.estimatedDuration);
      if (quota.limitType === 'tool_calls') return normalizeQuota(quota, estimate.toolCosts.length);
      return quota;
    });
  return reportFor(planId, evaluated);
}

export function evaluateQuotaDuringRun(runId: string): QuotaEvaluationReport {
  const ledger = getBillingLedger(runId);
  const tools = getToolCallsByRun(runId).length;
  const duration = getUsageByRun(runId)
    .filter((record) => record.type === 'runtime_duration')
    .reduce((sum, record) => sum + record.quantity, 0);
  const tokens = getUsageByRun(runId)
    .filter((record) => record.type === 'token')
    .reduce((sum, record) => sum + record.quantity, 0);
  const evaluated = getUsageQuotas().map((quota) => {
    if (quota.limitType === 'cost') return normalizeQuota(quota, ledger.actualTotal);
    if (quota.limitType === 'token') return normalizeQuota(quota, tokens);
    if (quota.limitType === 'duration') return normalizeQuota(quota, duration);
    if (quota.limitType === 'tool_calls') return normalizeQuota(quota, tools);
    return quota;
  });
  return reportFor(runId, evaluated);
}

export function evaluateQuotaAfterRun(runId: string): QuotaEvaluationReport {
  finalizeBillingLedger(runId);
  return evaluateQuotaDuringRun(runId);
}

export function summarizeEstimatedVsActual(runId: string) {
  const ledger = getBillingLedger(runId);
  return {
    estimatedTotal: ledger.estimatedTotal,
    actualTotal: ledger.actualTotal,
    variance: ledger.variance,
    status: ledger.status,
    artifactCount: getRunArtifacts(runId).length,
  };
}
