import type { RunPlan, RunPlanStep } from '../integrations/growthos-runtime/run-planner';

const RUN_PLAN_STORAGE_KEY = 'uikigai-runtime-run-plans-v1';

interface RunPlanState {
  plans: Record<string, RunPlan>;
  currentPlanByTicket: Record<string, string>;
}

const emptyRunPlanState: RunPlanState = {
  plans: {},
  currentPlanByTicket: {},
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readRunPlanState(): RunPlanState {
  if (typeof window === 'undefined') return clone(emptyRunPlanState);
  try {
    const raw = window.sessionStorage.getItem(RUN_PLAN_STORAGE_KEY);
    if (!raw) return clone(emptyRunPlanState);
    const parsed = JSON.parse(raw) as Partial<RunPlanState>;
    return {
      plans: parsed.plans ?? {},
      currentPlanByTicket: parsed.currentPlanByTicket ?? {},
    };
  } catch {
    return clone(emptyRunPlanState);
  }
}

function writeRunPlanState(state: RunPlanState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(RUN_PLAN_STORAGE_KEY, JSON.stringify(state));
}

function updateRunPlanState(updater: (state: RunPlanState) => RunPlanState): RunPlanState {
  const next = updater(readRunPlanState());
  writeRunPlanState(next);
  return next;
}

export function upsertRunPlan(plan: RunPlan): RunPlan {
  updateRunPlanState((state) => ({
    plans: { ...state.plans, [plan.id]: plan },
    currentPlanByTicket: { ...state.currentPlanByTicket, [plan.ticketId]: plan.id },
  }));
  return plan;
}

export function getRunPlan(planId?: string): RunPlan | undefined {
  if (!planId) return undefined;
  return readRunPlanState().plans[planId];
}

export function getRunPlans(): RunPlan[] {
  return Object.values(readRunPlanState().plans);
}

export function getPlansByTicket(ticketId: string): RunPlan[] {
  return getRunPlans()
    .filter((plan) => plan.ticketId === ticketId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getCurrentPlanForTicket(ticketId: string): RunPlan | undefined {
  const state = readRunPlanState();
  const currentPlanId = state.currentPlanByTicket[ticketId];
  return currentPlanId ? state.plans[currentPlanId] : getPlansByTicket(ticketId)[0];
}

export function getPlanSteps(planId: string): RunPlanStep[] {
  return getRunPlan(planId)?.steps ?? [];
}

export function markRunPlanApproved(planId: string): RunPlan {
  const plan = getRunPlan(planId);
  if (!plan) throw new Error(`Cannot approve missing run plan ${planId}`);
  const nextPlan = { ...plan, approvedAt: new Date().toISOString() };
  return upsertRunPlan(nextPlan);
}

export function clearRunPlans() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(RUN_PLAN_STORAGE_KEY);
}
