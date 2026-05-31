import { demoWorkspace } from '../data/demo-fixtures';
import {
  buildProviderCostSnapshots,
  createReconciliationReport,
  type CostAlert,
  type CostVariance,
  type ProviderCostSnapshot,
  type ReconciliationReport,
} from './cost-reconciliation';
import { getAllUsageRecords, getBillingLedgers } from '../runtime-store/usage-ledger-store';

interface CostReconciliationState {
  providerSnapshots: ProviderCostSnapshot[];
  reports: Record<string, ReconciliationReport>;
  varianceHistory: CostVariance[];
  alerts: CostAlert[];
}

const COST_RECONCILIATION_KEY = 'uikigai-cost-reconciliation-v1';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyState(): CostReconciliationState {
  return {
    providerSnapshots: [],
    reports: {},
    varianceHistory: [],
    alerts: [],
  };
}

function readState(): CostReconciliationState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(COST_RECONCILIATION_KEY);
    return raw ? { ...emptyState(), ...JSON.parse(raw) as CostReconciliationState } : emptyState();
  } catch {
    return emptyState();
  }
}

function writeState(state: CostReconciliationState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(COST_RECONCILIATION_KEY, JSON.stringify(state));
}

export function generateProviderCostSnapshots(): ProviderCostSnapshot[] {
  const snapshots = buildProviderCostSnapshots(getBillingLedgers());
  const state = readState();
  writeState({ ...state, providerSnapshots: snapshots });
  return clone(snapshots);
}

export function generateCostReconciliationReport(): ReconciliationReport {
  const state = readState();
  const snapshots = state.providerSnapshots.length ? state.providerSnapshots : buildProviderCostSnapshots(getBillingLedgers());
  const report = createReconciliationReport({
    workspaceId: demoWorkspace.id,
    ledgers: getBillingLedgers(),
    records: getAllUsageRecords(),
    providerSnapshots: snapshots,
  });
  writeState({
    providerSnapshots: report.providerSnapshots,
    reports: { ...state.reports, [report.id]: report },
    varianceHistory: report.varianceHistory,
    alerts: report.alerts,
  });
  return clone(report);
}

export function getReconciliationReport(): ReconciliationReport {
  const state = readState();
  const report = state.reports[`reconciliation-${demoWorkspace.id}`];
  if (report) return clone(report);
  return createReconciliationReport({
    workspaceId: demoWorkspace.id,
    ledgers: getBillingLedgers(),
    records: getAllUsageRecords(),
    providerSnapshots: state.providerSnapshots,
  });
}

export function getVarianceHistory(): CostVariance[] {
  const state = readState();
  return clone(state.varianceHistory.length ? state.varianceHistory : getReconciliationReport().varianceHistory);
}

export function getProviderCost(runId?: string): number {
  const report = getReconciliationReport();
  if (!runId) return report.providerCost;
  return report.records.find((record) => record.runId === runId)?.providerCost ?? 0;
}

export function getCostAlerts(): CostAlert[] {
  const state = readState();
  return clone(state.alerts.length ? state.alerts : getReconciliationReport().alerts);
}

export function clearCostReconciliation() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(COST_RECONCILIATION_KEY);
}
