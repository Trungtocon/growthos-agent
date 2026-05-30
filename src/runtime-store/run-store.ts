import type { Run } from '../domain/types';
import { lifecycleFromRun, readRuntimeState, toPersistentRun, updateRuntimeState } from './runtime-persistence';
import type { PersistentRuntimeRun, RuntimeLifecycle } from './runtime-persistence';

export function upsertRun(run: Run, lifecycle: RuntimeLifecycle = lifecycleFromRun(run)): PersistentRuntimeRun {
  const persistentRun = toPersistentRun(run, lifecycle);
  updateRuntimeState((state) => ({
    ...state,
    runs: { ...state.runs, [persistentRun.id]: persistentRun },
  }));
  return persistentRun;
}

export function getRunById(runId: string): PersistentRuntimeRun | undefined {
  return readRuntimeState().runs[runId];
}

export function getRuns(): PersistentRuntimeRun[] {
  return Object.values(readRuntimeState().runs);
}

export function setRunLifecycle(runId: string, lifecycle: RuntimeLifecycle): PersistentRuntimeRun | undefined {
  let nextRun: PersistentRuntimeRun | undefined;
  updateRuntimeState((state) => {
    const run = state.runs[runId];
    if (!run) return state;
    nextRun = { ...run, lifecycle, updatedAt: new Date().toISOString() };
    return { ...state, runs: { ...state.runs, [runId]: nextRun } };
  });
  return nextRun;
}

export function ensureRun(run: Run, lifecycle?: RuntimeLifecycle): PersistentRuntimeRun {
  return getRunById(run.id) ?? upsertRun(run, lifecycle);
}
