import { createHermesHttpClient } from './hermes-client';
import { createMockHermesClient } from './hermes-mock';
import type { HermesClient, HermesTask } from './hermes-types';

export interface HermesAdapter {
  startTask(task: HermesTask): ReturnType<HermesClient['startTask']>;
  sendRunCommand(runId: string, command: 'pause' | 'resume' | 'retry' | 'cancel'): ReturnType<HermesClient['sendRunCommand']>;
}

export function createHermesAdapter(mode: 'mock' | 'remote' = 'mock'): HermesAdapter {
  const client = mode === 'mock' ? createMockHermesClient() : createHermesHttpClient({ mode });
  return {
    startTask: (task) => client.startTask(task),
    sendRunCommand: (runId, command) => client.sendRunCommand(runId, command),
  };
}
