import type { PlanExecutionPolicyReport } from '../integrations/growthos-runtime/plan-policy';

const PLAN_POLICY_STORAGE_KEY = 'uikigai-runtime-plan-policy-reports-v1';

interface PlanPolicyState {
  reports: Record<string, PlanExecutionPolicyReport>;
}

const emptyPlanPolicyState: PlanPolicyState = {
  reports: {},
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readPlanPolicyState(): PlanPolicyState {
  if (typeof window === 'undefined') return clone(emptyPlanPolicyState);
  try {
    const raw = window.sessionStorage.getItem(PLAN_POLICY_STORAGE_KEY);
    if (!raw) return clone(emptyPlanPolicyState);
    const parsed = JSON.parse(raw) as Partial<PlanPolicyState>;
    return {
      reports: parsed.reports ?? {},
    };
  } catch {
    return clone(emptyPlanPolicyState);
  }
}

function writePlanPolicyState(state: PlanPolicyState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PLAN_POLICY_STORAGE_KEY, JSON.stringify(state));
}

function updatePlanPolicyState(updater: (state: PlanPolicyState) => PlanPolicyState): PlanPolicyState {
  const next = updater(readPlanPolicyState());
  writePlanPolicyState(next);
  return next;
}

export function upsertPolicyReport(report: PlanExecutionPolicyReport): PlanExecutionPolicyReport {
  updatePlanPolicyState((state) => ({
    reports: {
      ...state.reports,
      [report.planId]: report,
    },
  }));
  return report;
}

export function getPolicyReport(planId?: string): PlanExecutionPolicyReport | undefined {
  if (!planId) return undefined;
  return readPlanPolicyState().reports[planId];
}

export function getBlockingReasons(planId?: string): string[] {
  return getPolicyReport(planId)?.blockingReasons ?? [];
}

export function getPlanWarnings(planId?: string): string[] {
  return getPolicyReport(planId)?.warnings ?? [];
}

export function getCanStartPlan(planId?: string): boolean {
  const report = getPolicyReport(planId);
  return report ? report.status !== 'blocked' : false;
}

export function clearPolicyReports() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PLAN_POLICY_STORAGE_KEY);
}
