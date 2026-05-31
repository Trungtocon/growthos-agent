import type { Approval, Artifact, Run } from '../domain/types';
import type { RunStreamEvent } from '../integrations/growthos-runtime/runtime-types';
import type { WorkflowEvent } from '../state/event-log';

export type RuntimeLifecycle =
  | 'CREATED'
  | 'QUEUED'
  | 'RUNNING'
  | 'WAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'FAILED';

export interface PersistentRuntimeRun extends Run {
  lifecycle: RuntimeLifecycle;
  updatedAt: string;
}

export interface RuntimeState {
  runs: Record<string, PersistentRuntimeRun>;
  approvals: Record<string, Approval>;
  artifacts: Record<string, Artifact>;
  events: WorkflowEvent[];
  streamEvents: Record<string, RunStreamEvent[]>;
  completedStreams: Record<string, boolean>;
}

const RUNTIME_STORAGE_KEY = 'uikigai-runtime-store-v1';

const emptyRuntimeState: RuntimeState = {
  runs: {},
  approvals: {},
  artifacts: {},
  events: [],
  streamEvents: {},
  completedStreams: {},
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function lifecycleFromRun(run: Run): RuntimeLifecycle {
  if (run.status === 'queued') return 'QUEUED';
  if (run.status === 'running') return 'RUNNING';
  if (run.status === 'paused') return 'WAITING_APPROVAL';
  if (run.status === 'success') return 'COMPLETED';
  if (run.status === 'failed') return 'FAILED';
  if (run.status === 'warning') return 'WAITING_APPROVAL';
  return 'CREATED';
}

export function readRuntimeState(): RuntimeState {
  if (typeof window === 'undefined') return clone(emptyRuntimeState);
  try {
    const raw = window.sessionStorage.getItem(RUNTIME_STORAGE_KEY);
    if (!raw) return clone(emptyRuntimeState);
    const parsed = JSON.parse(raw) as Partial<RuntimeState>;
    return {
      runs: parsed.runs ?? {},
      approvals: parsed.approvals ?? {},
      artifacts: parsed.artifacts ?? {},
      events: parsed.events ?? [],
      streamEvents: parsed.streamEvents ?? {},
      completedStreams: parsed.completedStreams ?? {},
    };
  } catch {
    return clone(emptyRuntimeState);
  }
}

export function writeRuntimeState(state: RuntimeState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(RUNTIME_STORAGE_KEY, JSON.stringify(state));
}

export function updateRuntimeState(updater: (state: RuntimeState) => RuntimeState): RuntimeState {
  const next = updater(readRuntimeState());
  writeRuntimeState(next);
  return next;
}

export function resetRuntimeState() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(RUNTIME_STORAGE_KEY);
}

export function toPersistentRun(run: Run, lifecycle: RuntimeLifecycle = lifecycleFromRun(run)): PersistentRuntimeRun {
  return { ...run, lifecycle, updatedAt: new Date().toISOString() };
}
