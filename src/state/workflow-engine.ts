import { useSyncExternalStore } from 'react';
import {
  demoActivities,
  demoAgents,
  demoApprovals,
  demoCostBreakdown,
  demoCurrentUser,
  demoGoals,
  demoRuns,
  demoTickets,
  demoWorkspace,
} from '../data/demo-fixtures';
import type { Activity, Agent, Approval, CostBreakdown, Goal, Run, Ticket, User, Workspace } from '../domain/types';
import { createWorkflowEvent } from './event-log';
import type { WorkflowCommand, WorkflowEntityType, WorkflowEvent } from './event-log';

const WORKFLOW_DATA_STORAGE_KEY = 'uikigai-demo-workflow-data';

export interface WorkflowData {
  workspace: Workspace;
  currentUser: User;
  agents: Agent[];
  tickets: Ticket[];
  runs: Run[];
  approvals: Approval[];
  goals: Goal[];
  activities: Activity[];
  costBreakdown: CostBreakdown;
}

export interface WorkflowMutation {
  command: WorkflowCommand;
  entityType: WorkflowEntityType;
  entityId: string;
  status: 'pending' | 'success' | 'failed';
  updatedAt: string;
  error?: string;
}

export interface WorkflowState {
  data: WorkflowData;
  events: WorkflowEvent[];
  mutations: Record<string, WorkflowMutation>;
  errors: Record<string, string>;
}

export interface WorkflowCommandRequest {
  command: WorkflowCommand;
  entityType: WorkflowEntityType;
  entityId: string;
  actorId: string;
  title: string;
  optimistic: (data: WorkflowData) => WorkflowData;
  mutate: () => Promise<void>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function loadPersistedWorkflowData(fallback: WorkflowData): WorkflowData {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.sessionStorage.getItem(WORKFLOW_DATA_STORAGE_KEY);
    return raw ? JSON.parse(raw) as WorkflowData : fallback;
  } catch {
    return fallback;
  }
}

function persistWorkflowData(data: WorkflowData) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(WORKFLOW_DATA_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Demo persistence is best-effort only.
  }
}

function createInitialData(): WorkflowData {
  const baseline = clone({
    workspace: demoWorkspace,
    currentUser: demoCurrentUser,
    agents: demoAgents,
    tickets: demoTickets,
    runs: demoRuns,
    approvals: demoApprovals,
    goals: demoGoals,
    activities: demoActivities,
    costBreakdown: demoCostBreakdown,
  });
  return loadPersistedWorkflowData(baseline);
}

let state: WorkflowState = {
  data: createInitialData(),
  events: [],
  mutations: {},
  errors: {},
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function updateState(updater: (current: WorkflowState) => WorkflowState) {
  state = updater(state);
  persistWorkflowData(state.data);
  notify();
}

export function getWorkflowState(): WorkflowState {
  return state;
}

export function getWorkflowData(): WorkflowData {
  return state.data;
}

export function subscribeWorkflowState(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWorkflowStateSnapshot() {
  return useSyncExternalStore(subscribeWorkflowState, getWorkflowState, getWorkflowState);
}

export function resetWorkflowState() {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(WORKFLOW_DATA_STORAGE_KEY);
  }
  state = {
    data: createInitialData(),
    events: [],
    mutations: {},
    errors: {},
  };
  notify();
}

export async function runWorkflowCommand(request: WorkflowCommandRequest): Promise<boolean> {
  const rollbackData = clone(state.data);
  const now = new Date().toISOString();
  const pendingMutation: WorkflowMutation = {
    command: request.command,
    entityType: request.entityType,
    entityId: request.entityId,
    status: 'pending',
    updatedAt: now,
  };

  updateState((current) => ({
    ...current,
    data: request.optimistic(clone(current.data)),
    events: [
      createWorkflowEvent({
        command: request.command,
        entityType: request.entityType,
        entityId: request.entityId,
        actorId: request.actorId,
        title: request.title,
        status: 'pending',
      }),
      ...current.events,
    ],
    mutations: { ...current.mutations, [request.entityId]: pendingMutation },
    errors: Object.fromEntries(Object.entries(current.errors).filter(([entityId]) => entityId !== request.entityId)),
  }));

  try {
    await request.mutate();
    updateState((current) => ({
      ...current,
      events: [
        createWorkflowEvent({
          command: request.command,
          entityType: request.entityType,
          entityId: request.entityId,
          actorId: request.actorId,
          title: request.title,
          status: 'success',
        }),
        ...current.events,
      ],
      mutations: {
        ...current.mutations,
        [request.entityId]: { ...pendingMutation, status: 'success', updatedAt: new Date().toISOString() },
      },
    }));
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateState((current) => ({
      ...current,
      data: rollbackData,
      events: [
        createWorkflowEvent({
          command: request.command,
          entityType: request.entityType,
          entityId: request.entityId,
          actorId: request.actorId,
          title: request.title,
          status: 'failed',
          error: message,
        }),
        ...current.events,
      ],
      mutations: {
        ...current.mutations,
        [request.entityId]: { ...pendingMutation, status: 'failed', updatedAt: new Date().toISOString(), error: message },
      },
      errors: { ...current.errors, [request.entityId]: message },
    }));
    return false;
  }
}
