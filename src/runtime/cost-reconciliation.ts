import type { Artifact } from '../domain/types';
import type { BillingLedger, UsageRecord } from '../integrations/growthos-runtime/usage-ledger';

export type CostVarianceSeverity = 'NORMAL' | 'WARNING' | 'CRITICAL';

export interface CostRecord {
  runId: string;
  estimatedCost: number;
  actualCost: number;
  providerCost: number;
  variance: number;
  variancePercent: number;
  severity: CostVarianceSeverity;
  generatedAt: string;
}

export interface CostVariance {
  runId: string;
  estimatedCost: number;
  actualCost: number;
  providerCost: number;
  variance: number;
  variancePercent: number;
  severity: CostVarianceSeverity;
  generatedAt: string;
}

export interface ProviderCostSnapshot {
  id: string;
  runId: string;
  provider: 'hermes-sandbox' | 'paperclip-sandbox' | 'mock-provider';
  providerCost: number;
  recordedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CostAlert {
  id: string;
  runId: string;
  title: string;
  message: string;
  severity: CostVarianceSeverity;
  createdAt: string;
}

export interface ReconciliationReport {
  id: string;
  workspaceId: string;
  estimatedCost: number;
  actualCost: number;
  providerCost: number;
  variance: number;
  variancePercent: number;
  severity: CostVarianceSeverity;
  generatedAt: string;
  records: CostRecord[];
  providerSnapshots: ProviderCostSnapshot[];
  varianceHistory: CostVariance[];
  alerts: CostAlert[];
  topCostRuns: CostRecord[];
}

const PROVIDER_MULTIPLIERS = [1.02, 1.06, 1.12, 0.98];

function round(value: number, precision = 4): number {
  return Number(value.toFixed(precision));
}

function providerCostForLedger(ledger: BillingLedger, index: number): number {
  const base = ledger.actualTotal || ledger.estimatedTotal;
  return round(base * PROVIDER_MULTIPLIERS[index % PROVIDER_MULTIPLIERS.length]);
}

export function calculateVariance(actualCost: number, providerCost: number): number {
  return round(providerCost - actualCost);
}

export function calculateVariancePercent(actualCost: number, providerCost: number): number {
  if (!actualCost) return providerCost ? 100 : 0;
  return round((Math.abs(providerCost - actualCost) / actualCost) * 100, 2);
}

export function evaluateVarianceSeverity(variancePercent: number): CostVarianceSeverity {
  if (variancePercent > 10) return 'CRITICAL';
  if (variancePercent > 5) return 'WARNING';
  return 'NORMAL';
}

export function buildProviderCostSnapshots(ledgers: BillingLedger[], generatedAt = new Date().toISOString()): ProviderCostSnapshot[] {
  return ledgers.map((ledger, index) => ({
    id: `provider-cost-${ledger.runId}`,
    runId: ledger.runId,
    provider: index % 3 === 0 ? 'hermes-sandbox' : index % 3 === 1 ? 'paperclip-sandbox' : 'mock-provider',
    providerCost: providerCostForLedger(ledger, index),
    recordedAt: generatedAt,
    metadata: {
      estimatedTotal: ledger.estimatedTotal,
      actualTotal: ledger.actualTotal,
      records: ledger.records.length,
    },
  }));
}

function alertForRecord(record: CostRecord): CostAlert | undefined {
  if (record.severity === 'NORMAL') return undefined;
  return {
    id: `cost-alert-${record.runId}`,
    runId: record.runId,
    title: record.severity === 'CRITICAL' ? 'Critical provider variance' : 'Provider variance warning',
    message: `Run ${record.runId} provider cost differs from actual usage by ${record.variancePercent}%.`,
    severity: record.severity,
    createdAt: record.generatedAt,
  };
}

export function createReconciliationReport(input: {
  workspaceId: string;
  ledgers: BillingLedger[];
  records: UsageRecord[];
  providerSnapshots?: ProviderCostSnapshot[];
  generatedAt?: string;
}): ReconciliationReport {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const providerSnapshots = input.providerSnapshots?.length ? input.providerSnapshots : buildProviderCostSnapshots(input.ledgers, generatedAt);
  const snapshotsByRun = new Map(providerSnapshots.map((snapshot) => [snapshot.runId, snapshot]));

  const records = input.ledgers.map((ledger): CostRecord => {
    const snapshot = snapshotsByRun.get(ledger.runId);
    const providerCost = snapshot?.providerCost ?? providerCostForLedger(ledger, 0);
    const variance = calculateVariance(ledger.actualTotal, providerCost);
    const variancePercent = calculateVariancePercent(ledger.actualTotal, providerCost);
    return {
      runId: ledger.runId,
      estimatedCost: round(ledger.estimatedTotal),
      actualCost: round(ledger.actualTotal),
      providerCost,
      variance,
      variancePercent,
      severity: evaluateVarianceSeverity(variancePercent),
      generatedAt,
    };
  });

  const estimatedCost = round(records.reduce((sum, record) => sum + record.estimatedCost, 0));
  const actualCost = round(records.reduce((sum, record) => sum + record.actualCost, 0));
  const providerCost = round(records.reduce((sum, record) => sum + record.providerCost, 0));
  const variance = calculateVariance(actualCost, providerCost);
  const variancePercent = calculateVariancePercent(actualCost, providerCost);
  const severity = evaluateVarianceSeverity(variancePercent);
  const alerts = records.map(alertForRecord).filter((alert): alert is CostAlert => Boolean(alert));

  return {
    id: `reconciliation-${input.workspaceId}`,
    workspaceId: input.workspaceId,
    estimatedCost,
    actualCost,
    providerCost,
    variance,
    variancePercent,
    severity,
    generatedAt,
    records,
    providerSnapshots,
    varianceHistory: records.map((record) => ({ ...record })),
    alerts,
    topCostRuns: records.slice().sort((a, b) => b.providerCost - a.providerCost).slice(0, 5),
  };
}

export function costReconciliationArtifacts(report: ReconciliationReport, runId: string): Artifact[] {
  const createdAt = new Date().toISOString();
  const markdown = [
    '# Cost Reconciliation Report',
    '',
    `- Estimated cost: $${report.estimatedCost.toFixed(4)}`,
    `- Actual usage cost: $${report.actualCost.toFixed(4)}`,
    `- Provider cost: $${report.providerCost.toFixed(4)}`,
    `- Variance: $${report.variance.toFixed(4)} (${report.variancePercent}%)`,
    `- Severity: ${report.severity}`,
    '',
    '## Top Cost Runs',
    ...report.topCostRuns.map((record) => `- ${record.runId}: provider $${record.providerCost.toFixed(4)}, actual $${record.actualCost.toFixed(4)}, variance ${record.variancePercent}%`),
    '',
    '## Alerts',
    ...(report.alerts.length ? report.alerts.map((alert) => `- ${alert.severity}: ${alert.message}`) : ['- No active cost variance alerts.']),
  ].join('\n');

  return [
    {
      id: `cost-report-json-${runId}`,
      runId,
      type: 'json',
      name: 'cost-report.json',
      source: 'mock',
      contentSummary: 'Cost reconciliation JSON report generated from usage ledger and simulated provider snapshots.',
      contentJson: report,
      createdAt,
      sizeBytes: JSON.stringify(report).length,
    },
    {
      id: `cost-report-md-${runId}`,
      runId,
      type: 'markdown',
      name: 'cost-report.md',
      source: 'mock',
      contentSummary: 'Markdown cost report with estimated, actual, provider, and variance metrics.',
      contentText: markdown,
      language: 'markdown',
      createdAt,
      sizeBytes: markdown.length,
    },
    {
      id: `reconciliation-report-md-${runId}`,
      runId,
      type: 'markdown',
      name: 'reconciliation-report.md',
      source: 'mock',
      contentSummary: 'Financial governance reconciliation summary for runtime provider variance.',
      contentText: markdown,
      language: 'markdown',
      createdAt,
      sizeBytes: markdown.length,
    },
  ];
}
