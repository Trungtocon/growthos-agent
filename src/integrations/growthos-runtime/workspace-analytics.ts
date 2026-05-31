import type { Artifact } from '../../domain/types';
import type { BillingLedger, UsageRecord } from './usage-ledger';

export interface WorkspaceAnalytics {
  workspaceId: string;
  totalRuns: number;
  totalToolCalls: number;
  totalArtifacts: number;
  totalApprovals: number;
  estimatedCost: number;
  actualCost: number;
  varianceCost: number;
  totalTokens: number;
  totalRuntimeMinutes: number;
  generatedAt: string;
}

export interface ToolUsageAnalytics {
  toolId: string;
  executions: number;
  totalCost: number;
  totalTokens: number;
  totalDuration: number;
}

export interface ModelUsageAnalytics {
  modelId: string;
  executions: number;
  totalCost: number;
  totalTokens: number;
}

export interface WorkflowUsageAnalytics {
  workflowId: string;
  runs: number;
  totalCost: number;
  totalDuration: number;
}

export interface WorkspaceAnalyticsBundle {
  workspace: WorkspaceAnalytics;
  tools: ToolUsageAnalytics[];
  models: ModelUsageAnalytics[];
  workflows: WorkflowUsageAnalytics[];
}

function round(value: number, precision = 4): number {
  return Number(value.toFixed(precision));
}

function increment<T extends { totalCost: number }>(map: Map<string, T>, id: string, create: () => T, cost: number): T {
  const item = map.get(id) ?? create();
  item.totalCost = round(item.totalCost + cost);
  map.set(id, item);
  return item;
}

function workflowIdForRecord(record: UsageRecord, runWorkflowIds: Map<string, string>): string {
  const workflowId = record.metadata?.workflowId;
  if (typeof workflowId === 'string' && workflowId) return workflowId;
  return runWorkflowIds.get(record.runId) ?? 'ad-hoc-runtime';
}

export function buildWorkspaceAnalyticsFromUsage(input: {
  workspaceId: string;
  records: UsageRecord[];
  ledgers: BillingLedger[];
}): WorkspaceAnalyticsBundle {
  const runIds = new Set<string>();
  const toolMap = new Map<string, ToolUsageAnalytics>();
  const modelMap = new Map<string, ModelUsageAnalytics>();
  const workflowMap = new Map<string, WorkflowUsageAnalytics>();
  const workflowRunIds = new Map<string, Set<string>>();
  const runWorkflowIds = new Map<string, string>();

  for (const record of input.records) {
    const workflowId = record.metadata?.workflowId;
    if (typeof workflowId === 'string' && workflowId) runWorkflowIds.set(record.runId, workflowId);
  }

  for (const record of input.records) {
    runIds.add(record.runId);
    const workflowId = workflowIdForRecord(record, runWorkflowIds);
    const workflowRuns = workflowRunIds.get(workflowId) ?? new Set<string>();
    workflowRuns.add(record.runId);
    workflowRunIds.set(workflowId, workflowRuns);

    const workflow = increment(workflowMap, workflowId, () => ({
      workflowId,
      runs: 0,
      totalCost: 0,
      totalDuration: 0,
    }), record.actualCost);
    if (record.type === 'runtime_duration') workflow.totalDuration += record.quantity;

    if (record.toolId) {
      const tool = increment(toolMap, record.toolId, () => ({
        toolId: record.toolId!,
        executions: 0,
        totalCost: 0,
        totalTokens: 0,
        totalDuration: 0,
      }), record.actualCost);
      if (record.type === 'tool_call') tool.executions += record.quantity;
      if (record.type === 'token') tool.totalTokens += record.quantity;
      if (record.type === 'runtime_duration') tool.totalDuration += record.quantity;
    }

    if (record.modelId) {
      const model = increment(modelMap, record.modelId, () => ({
        modelId: record.modelId!,
        executions: 0,
        totalCost: 0,
        totalTokens: 0,
      }), record.actualCost);
      if (record.type === 'tool_call') model.executions += record.quantity;
      if (record.type === 'token') model.totalTokens += record.quantity;
    }
  }

  for (const [workflowId, runs] of workflowRunIds.entries()) {
    const workflow = workflowMap.get(workflowId);
    if (workflow) workflow.runs = runs.size;
  }

  const estimatedCost = round(input.ledgers.reduce((sum, ledger) => sum + ledger.estimatedTotal, 0));
  const actualCost = round(input.ledgers.reduce((sum, ledger) => sum + ledger.actualTotal, 0));
  const totalTokens = input.records.filter((record) => record.type === 'token').reduce((sum, record) => sum + record.quantity, 0);
  const totalRuntimeSeconds = input.records.filter((record) => record.type === 'runtime_duration').reduce((sum, record) => sum + record.quantity, 0);

  return {
    workspace: {
      workspaceId: input.workspaceId,
      totalRuns: runIds.size,
      totalToolCalls: input.records.filter((record) => record.type === 'tool_call').reduce((sum, record) => sum + record.quantity, 0),
      totalArtifacts: input.records.filter((record) => record.type === 'artifact').reduce((sum, record) => sum + record.quantity, 0),
      totalApprovals: input.records.filter((record) => record.type === 'approval').reduce((sum, record) => sum + record.quantity, 0),
      estimatedCost,
      actualCost,
      varianceCost: round(actualCost - estimatedCost),
      totalTokens,
      totalRuntimeMinutes: round(totalRuntimeSeconds / 60, 2),
      generatedAt: new Date().toISOString(),
    },
    tools: [...toolMap.values()].sort((a, b) => b.totalCost - a.totalCost),
    models: [...modelMap.values()].sort((a, b) => b.totalCost - a.totalCost),
    workflows: [...workflowMap.values()].sort((a, b) => b.totalCost - a.totalCost),
  };
}

export function workspaceAnalyticsArtifacts(bundle: WorkspaceAnalyticsBundle, runId: string): Artifact[] {
  const createdAt = new Date().toISOString();
  return [
    {
      id: `analytics-json-${runId}`,
      runId,
      type: 'json',
      name: 'analytics.json',
      source: 'mock',
      contentSummary: 'Workspace usage analytics export generated from runtime usage ledger.',
      contentJson: bundle,
      createdAt,
      sizeBytes: JSON.stringify(bundle).length,
    },
    {
      id: `workspace-summary-${runId}`,
      runId,
      type: 'markdown',
      name: 'workspace-summary.md',
      source: 'mock',
      contentSummary: 'Markdown summary of workspace cost, token, runtime, and top consumer analytics.',
      contentText: [
        '# Workspace Usage Summary',
        '',
        `- Total runs: ${bundle.workspace.totalRuns}`,
        `- Actual cost: $${bundle.workspace.actualCost.toFixed(4)}`,
        `- Estimated cost: $${bundle.workspace.estimatedCost.toFixed(4)}`,
        `- Variance: $${bundle.workspace.varianceCost.toFixed(4)}`,
        `- Total tokens: ${bundle.workspace.totalTokens}`,
        `- Runtime minutes: ${bundle.workspace.totalRuntimeMinutes}`,
        '',
        `Top tool: ${bundle.tools[0]?.toolId ?? 'none'}`,
        `Top model: ${bundle.models[0]?.modelId ?? 'none'}`,
        `Top workflow: ${bundle.workflows[0]?.workflowId ?? 'none'}`,
      ].join('\n'),
      language: 'markdown',
      createdAt,
      sizeBytes: 860,
    },
  ];
}
