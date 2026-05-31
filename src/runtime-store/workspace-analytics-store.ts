import { demoWorkspace } from '../data/demo-fixtures';
import {
  buildWorkspaceAnalyticsFromUsage,
  type ModelUsageAnalytics,
  type ToolUsageAnalytics,
  type WorkflowUsageAnalytics,
  type WorkspaceAnalytics,
  type WorkspaceAnalyticsBundle,
} from '../integrations/growthos-runtime/workspace-analytics';
import { getAllUsageRecords, getBillingLedgers } from './usage-ledger-store';

interface WorkspaceAnalyticsState {
  bundle?: WorkspaceAnalyticsBundle;
}

const WORKSPACE_ANALYTICS_KEY = 'uikigai-workspace-analytics-v1';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readAnalyticsState(): WorkspaceAnalyticsState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(WORKSPACE_ANALYTICS_KEY);
    return raw ? JSON.parse(raw) as WorkspaceAnalyticsState : {};
  } catch {
    return {};
  }
}

function writeAnalyticsState(state: WorkspaceAnalyticsState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(WORKSPACE_ANALYTICS_KEY, JSON.stringify(state));
}

export function generateWorkspaceAnalytics(): WorkspaceAnalyticsBundle {
  const bundle = buildWorkspaceAnalyticsFromUsage({
    workspaceId: demoWorkspace.id,
    records: getAllUsageRecords(),
    ledgers: getBillingLedgers(),
  });
  writeAnalyticsState({ bundle });
  return clone(bundle);
}

export function getWorkspaceAnalyticsBundle(): WorkspaceAnalyticsBundle {
  return clone(readAnalyticsState().bundle ?? generateWorkspaceAnalytics());
}

export function getWorkspaceAnalytics(): WorkspaceAnalytics {
  return getWorkspaceAnalyticsBundle().workspace;
}

export function getToolAnalytics(): ToolUsageAnalytics[] {
  return getWorkspaceAnalyticsBundle().tools;
}

export function getModelAnalytics(): ModelUsageAnalytics[] {
  return getWorkspaceAnalyticsBundle().models;
}

export function getWorkflowAnalytics(): WorkflowUsageAnalytics[] {
  return getWorkspaceAnalyticsBundle().workflows;
}

export function clearAnalytics() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(WORKSPACE_ANALYTICS_KEY);
}
