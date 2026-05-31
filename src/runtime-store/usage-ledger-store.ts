import type { BillingLedger, QuotaEvaluationReport, UsageQuota, UsageRecord } from '../integrations/growthos-runtime/usage-ledger';

interface UsageLedgerState {
  records: Record<string, UsageRecord>;
  ledgers: Record<string, BillingLedger>;
  quotas: Record<string, UsageQuota>;
  quotaReports: Record<string, QuotaEvaluationReport>;
}

const USAGE_LEDGER_KEY = 'uikigai-runtime-usage-ledger-v1';

const defaultQuotas: UsageQuota[] = [
  {
    id: 'workspace-cost-demo',
    scope: 'workspace',
    limitType: 'cost',
    limit: 0.5,
    used: 0,
    remaining: 0.5,
    status: 'ok',
  },
  {
    id: 'run-token-demo',
    scope: 'run',
    limitType: 'token',
    limit: 10000,
    used: 0,
    remaining: 10000,
    status: 'ok',
  },
  {
    id: 'run-tool-calls-demo',
    scope: 'run',
    limitType: 'tool_calls',
    limit: 8,
    used: 0,
    remaining: 8,
    status: 'ok',
  },
  {
    id: 'run-duration-demo',
    scope: 'run',
    limitType: 'duration',
    limit: 260,
    used: 0,
    remaining: 260,
    status: 'ok',
  },
];

const emptyUsageState: UsageLedgerState = {
  records: {},
  ledgers: {},
  quotas: Object.fromEntries(defaultQuotas.map((quota) => [quota.id, quota])),
  quotaReports: {},
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readUsageState(): UsageLedgerState {
  if (typeof window === 'undefined') return clone(emptyUsageState);
  try {
    const raw = window.sessionStorage.getItem(USAGE_LEDGER_KEY);
    if (!raw) return clone(emptyUsageState);
    const parsed = JSON.parse(raw) as Partial<UsageLedgerState>;
    return {
      records: parsed.records ?? {},
      ledgers: parsed.ledgers ?? {},
      quotas: parsed.quotas ?? clone(emptyUsageState.quotas),
      quotaReports: parsed.quotaReports ?? {},
    };
  } catch {
    return clone(emptyUsageState);
  }
}

function writeUsageState(state: UsageLedgerState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(USAGE_LEDGER_KEY, JSON.stringify(state));
}

function updateUsageState(updater: (state: UsageLedgerState) => UsageLedgerState): UsageLedgerState {
  const next = updater(readUsageState());
  writeUsageState(next);
  return next;
}

function ledgerFor(runId: string, records = getUsageByRun(runId), status: BillingLedger['status'] = 'open', estimatedTotal?: number): BillingLedger {
  const actualTotal = Number(records.reduce((sum, record) => sum + record.actualCost, 0).toFixed(4));
  const estimate = estimatedTotal ?? Number(records.reduce((sum, record) => sum + record.estimatedCost, 0).toFixed(4));
  return {
    runId,
    estimatedTotal: estimate,
    actualTotal,
    records,
    variance: Number((actualTotal - estimate).toFixed(4)),
    status,
  };
}

export function addUsageRecord(record: UsageRecord): UsageRecord {
  updateUsageState((state) => {
    const records = { ...state.records, [record.id]: record };
    const runRecords = Object.values(records).filter((item) => item.runId === record.runId);
    return {
      ...state,
      records,
      ledgers: {
        ...state.ledgers,
        [record.runId]: ledgerFor(record.runId, runRecords, state.ledgers[record.runId]?.status ?? 'open'),
      },
    };
  });
  return record;
}

export function getUsageByRun(runId: string): UsageRecord[] {
  return Object.values(readUsageState().records)
    .filter((record) => record.runId === runId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getUsageByTool(toolId: string): UsageRecord[] {
  return Object.values(readUsageState().records)
    .filter((record) => record.toolId === toolId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getBillingLedger(runId: string): BillingLedger {
  const state = readUsageState();
  return state.ledgers[runId] ?? ledgerFor(runId);
}

export function finalizeBillingLedger(runId: string, estimatedTotal?: number): BillingLedger {
  const records = getUsageByRun(runId);
  const ledger = ledgerFor(runId, records, 'finalized', estimatedTotal);
  updateUsageState((state) => ({
    ...state,
    ledgers: { ...state.ledgers, [runId]: ledger },
  }));
  return ledger;
}

export function clearUsageLedger(runId: string) {
  updateUsageState((state) => ({
    ...state,
    records: Object.fromEntries(Object.entries(state.records).filter(([, record]) => record.runId !== runId)),
    ledgers: Object.fromEntries(Object.entries(state.ledgers).filter(([id]) => id !== runId)),
    quotaReports: Object.fromEntries(Object.entries(state.quotaReports).filter(([id]) => id !== runId)),
  }));
}

export function getUsageQuotas(): UsageQuota[] {
  return Object.values(readUsageState().quotas);
}

export function setUsageQuotas(quotas: UsageQuota[]): UsageQuota[] {
  updateUsageState((state) => ({
    ...state,
    quotas: Object.fromEntries(quotas.map((quota) => [quota.id, quota])),
  }));
  return quotas;
}

export function upsertQuotaReport(report: QuotaEvaluationReport): QuotaEvaluationReport {
  updateUsageState((state) => ({
    ...state,
    quotaReports: { ...state.quotaReports, [report.targetId]: report },
  }));
  return report;
}

export function getQuotaReport(targetId?: string): QuotaEvaluationReport | undefined {
  if (!targetId) return undefined;
  return readUsageState().quotaReports[targetId];
}

export function getQuotaReports(): QuotaEvaluationReport[] {
  return Object.values(readUsageState().quotaReports);
}

export function resetUsageLedgerStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(USAGE_LEDGER_KEY);
}
