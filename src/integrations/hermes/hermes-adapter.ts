import { createHermesHttpClient } from './hermes-client';
import { resolveHermesConfig, type HermesConnectorConfig } from './hermes-config';
import { createMockHermesClient } from './hermes-mock';
import {
  cancelHermesSandboxRun,
  checkHermesHealth,
  discoverHermesRuntime,
  pollHermesSandboxRun,
  startHermesSandboxRun,
  streamHermesSandboxEvents,
} from './hermes-sandbox-client';
import type { HermesClient, HermesTask } from './hermes-types';
import type { RuntimeMode } from '../growthos-runtime/runtime-types';

export interface HermesAdapter {
  healthCheck: HermesClient['healthCheck'];
  createTask: HermesClient['createTask'];
  startRun: HermesClient['startRun'];
  getRun: HermesClient['getRun'];
  cancelRun: HermesClient['cancelRun'];
  startTask(task: HermesTask): ReturnType<HermesClient['startTask']>;
  sendRunCommand(runId: string, command: 'pause' | 'resume' | 'retry' | 'cancel'): ReturnType<HermesClient['sendRunCommand']>;
  discoverRuntime: typeof discoverHermesRuntime;
  streamRunEvents: typeof streamHermesSandboxEvents;
}

export function createHermesAdapter(mode: RuntimeMode = 'mock', config: HermesConnectorConfig = resolveHermesConfig(undefined, mode)): HermesAdapter {
  const client = config.mode === 'mock' ? createMockHermesClient() : createHermesHttpClient(config);
  const fallbackHealth = async () => ({
    service: 'hermes' as const,
    mode: config.mode,
    status: config.status,
    message: config.reason === 'missing-config' ? 'Hermes sandbox config missing; using mock fallback' : 'Hermes mock runtime is available',
    checkedAt: new Date().toISOString(),
  });

  return {
    healthCheck: config.reason === 'missing-config' ? fallbackHealth : () => checkHermesHealth(config),
    createTask: (task) => client.createTask(task),
    startRun: (taskId) => client.startRun(taskId),
    getRun: (runId) => config.reason === 'sandbox-configured' ? pollHermesSandboxRun(runId, config) : client.getRun(runId),
    cancelRun: (runId) => config.reason === 'sandbox-configured' ? cancelHermesSandboxRun(runId, config) : client.cancelRun(runId),
    startTask: (task) => config.reason === 'sandbox-configured' ? startHermesSandboxRun(task, config) : client.startTask(task),
    sendRunCommand: (runId, command) => client.sendRunCommand(runId, command),
    discoverRuntime: () => discoverHermesRuntime(config),
    streamRunEvents: (runId) => streamHermesSandboxEvents(runId, config),
  };
}
