import type { ExecutionBudgetRegistry, ExecutionBudgetReport, ExecutionRiskLevel } from '../integrations/growthos-runtime/execution-budget';
import { getToolRegistry } from './tool-registry-store';

const EXECUTION_BUDGET_STORAGE_KEY = 'uikigai-runtime-execution-budget-v1';
const EXECUTION_BUDGET_REPORT_STORAGE_KEY = 'uikigai-runtime-execution-budget-reports-v1';

interface ExecutionBudgetReportState {
  reports: Record<string, ExecutionBudgetReport>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function defaultRiskForToolText(text: string): ExecutionRiskLevel {
  const normalized = text.toLowerCase();
  if (normalized.includes('deployment') || normalized.includes('terminal') || normalized.includes('external')) return 'high';
  if (normalized.includes('approval') || normalized.includes('artifact')) return 'medium';
  return 'low';
}

function createDefaultExecutionBudgetRegistry(): ExecutionBudgetRegistry {
  const registry = getToolRegistry();
  const toolCosts = Object.fromEntries(registry.tools.map((tool, index) => [tool.id, {
    toolId: tool.id,
    modelId: tool.supportedModels[0],
    estimatedCost: Number((0.008 + index * 0.006 + (tool.supportsArtifacts ? 0.008 : 0)).toFixed(3)),
    estimatedTokens: 1100 + index * 500 + (tool.supportsArtifacts ? 700 : 0),
    estimatedDuration: 24 + index * 15 + (tool.supportsArtifacts ? 20 : 0),
    riskLevel: defaultRiskForToolText(`${tool.name} ${tool.category} ${tool.description}`),
  }]));
  const modelCosts = Object.fromEntries(registry.models.map((model, index) => [model.id, {
    modelId: model.id,
    estimatedCost: Number((0.004 + index * 0.003).toFixed(3)),
    estimatedTokens: 600 + index * 300,
    estimatedDuration: model.supportsStreaming ? 10 : 18,
      riskLevel: 'low' as ExecutionRiskLevel,
  }]));
  return {
    toolCosts,
    modelCosts,
    budget: {
      id: 'demo-runtime-budget',
      name: 'Demo runtime execution budget',
      maxCost: 0.12,
      warningCost: 0.08,
      approvalCost: 0.05,
      maxDuration: 220,
      maxRiskLevel: 'high',
      currency: 'USD',
    },
    updatedAt: new Date().toISOString(),
  };
}

export function setExecutionBudgetRegistry(registry: ExecutionBudgetRegistry): ExecutionBudgetRegistry {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(EXECUTION_BUDGET_STORAGE_KEY, JSON.stringify(registry));
  }
  return registry;
}

export function getExecutionBudgetRegistry(): ExecutionBudgetRegistry {
  if (typeof window === 'undefined') return createDefaultExecutionBudgetRegistry();
  try {
    const raw = window.sessionStorage.getItem(EXECUTION_BUDGET_STORAGE_KEY);
    if (!raw) return setExecutionBudgetRegistry(createDefaultExecutionBudgetRegistry());
    const parsed = JSON.parse(raw) as ExecutionBudgetRegistry;
    return parsed.budget ? parsed : setExecutionBudgetRegistry(createDefaultExecutionBudgetRegistry());
  } catch {
    return setExecutionBudgetRegistry(createDefaultExecutionBudgetRegistry());
  }
}

function emptyBudgetReportState(): ExecutionBudgetReportState {
  return { reports: {} };
}

function readBudgetReportState(): ExecutionBudgetReportState {
  if (typeof window === 'undefined') return emptyBudgetReportState();
  try {
    const raw = window.sessionStorage.getItem(EXECUTION_BUDGET_REPORT_STORAGE_KEY);
    if (!raw) return emptyBudgetReportState();
    const parsed = JSON.parse(raw) as Partial<ExecutionBudgetReportState>;
    return { reports: parsed.reports ?? {} };
  } catch {
    return emptyBudgetReportState();
  }
}

function writeBudgetReportState(state: ExecutionBudgetReportState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(EXECUTION_BUDGET_REPORT_STORAGE_KEY, JSON.stringify(state));
}

export function upsertBudgetReport(report: ExecutionBudgetReport): ExecutionBudgetReport {
  const state = readBudgetReportState();
  writeBudgetReportState({
    reports: {
      ...state.reports,
      [report.planId]: report,
    },
  });
  return report;
}

export function getBudgetReport(planId?: string): ExecutionBudgetReport | undefined {
  if (!planId) return undefined;
  return readBudgetReportState().reports[planId];
}

export function getExecutionBudget() {
  return getExecutionBudgetRegistry().budget;
}

export function clearExecutionBudgetRegistry() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(EXECUTION_BUDGET_STORAGE_KEY);
  window.sessionStorage.removeItem(EXECUTION_BUDGET_REPORT_STORAGE_KEY);
}

export function cloneExecutionBudgetRegistry(): ExecutionBudgetRegistry {
  return clone(getExecutionBudgetRegistry());
}
