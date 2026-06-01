import type { RunStreamEvent, RuntimeIntegrationStatus } from '../growthos-runtime/runtime-types';
import type { HermesConnectorConfig, HermesEnv } from './hermes-config';
import { resolveHermesConfig } from './hermes-config';
import { discoverHermes, mockHermesDiscovery } from './hermes-discovery-client';
import type { HermesDiscoveryResult } from './hermes-discovery-types';
import { RuntimeIntegrationError, RuntimeTimeoutError } from './hermes-errors';
import type { HermesArtifactLike, HermesExecution, HermesExecutionLog, HermesExecutionStep, HermesTask, HermesToolCall } from './hermes-types';
import { createMockHermesClient } from './hermes-mock';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function arrayValue<T>(value: unknown, fallback: T[]): T[] {
  if (Array.isArray(value)) return value as T[];
  if (isRecord(value) && Array.isArray(value.items)) return value.items as T[];
  if (isRecord(value) && Array.isArray(value.data)) return value.data as T[];
  if (isRecord(value) && Array.isArray(value.results)) return value.results as T[];
  return fallback;
}

function configFrom(input?: HermesEnv | HermesConnectorConfig): HermesConnectorConfig {
  if (input && 'service' in input) return input;
  return resolveHermesConfig(input as HermesEnv | undefined);
}

function now() {
  return new Date().toISOString();
}

function fallbackExecution(taskId: string, task?: HermesTask): HermesExecution {
  return {
    id: `sandbox-run-${task?.ticketId ?? taskId}`,
    taskId,
    ticketId: task?.ticketId ?? 'ticket-audit-module-3',
    agentId: task?.agentId ?? 'agent-hermes-qa',
    status: 'running',
    currentStep: 'Hermes sandbox execution accepted',
    elapsedSeconds: 0,
    cost: 0,
    riskLevel: task?.riskLevel ?? 'medium',
    steps: [],
    toolCalls: [],
    logs: [{ id: `sandbox-log-${taskId}-accepted`, level: 'info', message: 'Sandbox run normalized by GrowthOS runtime adapter' }],
    artifacts: [],
  };
}

function normalizeToolCall(value: unknown, index: number): HermesToolCall {
  const record = isRecord(value) ? value : {};
  const rawStatus = record.status;
  const status = rawStatus === 'completed' ? 'success' : rawStatus === 'queued' ? 'running' : rawStatus === 'running' || rawStatus === 'failed' || rawStatus === 'success' || rawStatus === 'warning' ? rawStatus : 'running';
  return {
    id: stringValue(record.id ?? record.toolId, `hermes-tool-${index + 1}`),
    toolName: stringValue(record.toolName ?? record.name ?? record.tool, `Hermes Tool ${index + 1}`),
    status,
    inputSummary: stringValue(record.inputSummary ?? record.input ?? record.prompt, 'Sandbox input normalized'),
    outputSummary: stringValue(record.outputSummary ?? record.output ?? record.result, 'Sandbox output pending'),
    durationMs: numberValue(record.durationMs ?? record.duration_ms, 0),
    cost: numberValue(record.cost, 0),
    startedAt: typeof record.startedAt === 'string' ? record.startedAt : typeof record.started_at === 'string' ? record.started_at : undefined,
    finishedAt: typeof record.finishedAt === 'string' ? record.finishedAt : typeof record.finished_at === 'string' ? record.finished_at : undefined,
  };
}

function normalizeArtifact(value: unknown, index: number, runId: string): HermesArtifactLike {
  const record = isRecord(value) ? value : {};
  return {
    id: stringValue(record.id ?? record.artifactId, `hermes-artifact-${runId}-${index + 1}`),
    runId: stringValue(record.runId ?? record.run_id, runId),
    type: typeof record.type === 'string' ? record.type as HermesArtifactLike['type'] : 'report',
    name: stringValue(record.name ?? record.title, `Hermes Artifact ${index + 1}`),
    url: typeof record.url === 'string' ? record.url : undefined,
    contentSummary: stringValue(record.contentSummary ?? record.summary, 'Hermes sandbox artifact normalized by GrowthOS.'),
    contentText: typeof record.contentText === 'string' ? record.contentText : typeof record.content === 'string' ? record.content : undefined,
    contentJson: record.contentJson ?? record.json,
    language: typeof record.language === 'string' ? record.language : undefined,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : typeof record.created_at === 'string' ? record.created_at : now(),
    sizeBytes: typeof record.sizeBytes === 'number' ? record.sizeBytes : typeof record.size_bytes === 'number' ? record.size_bytes : undefined,
    source: 'hermes',
  };
}

function normalizeStep(value: unknown, index: number): HermesExecutionStep {
  const record = isRecord(value) ? value : {};
  return {
    id: stringValue(record.id, `hermes-step-${index + 1}`),
    name: stringValue(record.name ?? record.title, `Hermes Step ${index + 1}`),
    status: record.status === 'success' || record.status === 'failed' || record.status === 'running' || record.status === 'warning' || record.status === 'queued'
      ? record.status
      : 'running',
    durationSeconds: numberValue(record.durationSeconds ?? record.duration_seconds, 0),
    cost: numberValue(record.cost, 0),
  };
}

function normalizeLog(value: unknown, index: number): HermesExecutionLog {
  const record = isRecord(value) ? value : {};
  return {
    id: stringValue(record.id, `hermes-log-${index + 1}`),
    level: record.level === 'warn' || record.level === 'error' || record.level === 'info' ? record.level : 'info',
    message: stringValue(record.message, 'Hermes sandbox log normalized by GrowthOS.'),
  };
}

export function normalizeHermesSandboxExecution(payload: unknown, fallback: HermesExecution): HermesExecution {
  const record = isRecord(payload) ? payload : {};
  const runId = stringValue(record.id ?? record.runId ?? record.executionId, fallback.id);
  const status = record.status === 'created' || record.status === 'queued' || record.status === 'running' || record.status === 'waiting_for_approval' || record.status === 'completed' || record.status === 'failed' || record.status === 'cancelled' || record.status === 'paused' || record.status === 'success' || record.status === 'warning'
    ? record.status
    : fallback.status;
  return {
    ...fallback,
    id: runId,
    taskId: stringValue(record.taskId ?? record.task_id, fallback.taskId),
    ticketId: stringValue(record.ticketId ?? record.ticket_id, fallback.ticketId),
    agentId: stringValue(record.agentId ?? record.agent_id, fallback.agentId),
    status,
    currentStep: stringValue(record.currentStep ?? record.current_step ?? record.message, fallback.currentStep),
    elapsedSeconds: numberValue(record.elapsedSeconds ?? record.elapsed_seconds, fallback.elapsedSeconds),
    cost: numberValue(record.cost, fallback.cost),
    riskLevel: record.riskLevel === 'low' || record.riskLevel === 'medium' || record.riskLevel === 'high' || record.riskLevel === 'critical'
      ? record.riskLevel
      : fallback.riskLevel,
    steps: arrayValue(record.steps, fallback.steps).map(normalizeStep),
    toolCalls: arrayValue(record.toolCalls ?? record.tool_calls, fallback.toolCalls).map(normalizeToolCall),
    logs: arrayValue(record.logs, fallback.logs).map(normalizeLog),
    artifacts: arrayValue(record.artifacts, fallback.artifacts ?? []).map((artifact, index) => normalizeArtifact(artifact, index, runId)),
  };
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

async function sandboxRequest(config: HermesConnectorConfig, path: string, init: RequestInit = {}) {
  if (config.reason !== 'sandbox-configured' || !config.baseUrl || !config.apiKey) {
    throw new RuntimeIntegrationError('Hermes sandbox config missing; mock fallback is required.', {
      service: 'hermes',
      code: 'HERMES_SANDBOX_MISSING_CONFIG',
    });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        ...(config.workspaceId ? { 'X-Workspace-Id': config.workspaceId } : {}),
        ...init.headers,
      },
    });
    const payload = await readJson(response);
    if (!response.ok) {
      throw new RuntimeIntegrationError(`Hermes sandbox request failed: ${response.status}`, {
        service: 'hermes',
        code: 'HERMES_SANDBOX_HTTP_ERROR',
        status: response.status,
        cause: payload,
      });
    }
    return payload;
  } catch (error) {
    if (error instanceof RuntimeIntegrationError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw new RuntimeTimeoutError('hermes', config.timeoutMs);
    throw new RuntimeIntegrationError('Hermes sandbox request failed', {
      service: 'hermes',
      code: 'HERMES_SANDBOX_REQUEST_FAILED',
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkHermesHealth(input?: HermesEnv | HermesConnectorConfig) {
  const config = configFrom(input);
  const startedAt = Date.now();
  if (config.reason !== 'sandbox-configured') {
    return {
      service: 'hermes' as const,
      mode: 'mock' as const,
      status: config.status,
      message: config.reason === 'missing-config' ? 'Hermes sandbox config missing; using mock fallback' : 'Hermes mock runtime is available',
      checkedAt: now(),
      latencyMs: Math.max(0, Date.now() - startedAt),
    };
  }
  try {
    const payload = await sandboxRequest(config, '/health');
    const record = isRecord(payload) ? payload : {};
    const status: RuntimeIntegrationStatus = record.status === 'offline' || record.status === 'degraded' || record.status === 'online' ? record.status : 'online';
    return {
      service: 'hermes' as const,
      mode: 'sandbox' as const,
      status,
      message: stringValue(record.message, 'Hermes sandbox health endpoint responded'),
      checkedAt: now(),
      latencyMs: Math.max(0, Date.now() - startedAt),
    };
  } catch (error) {
    return {
      service: 'hermes' as const,
      mode: 'sandbox' as const,
      status: 'degraded' as const,
      message: error instanceof Error ? error.message : 'Hermes sandbox health check failed',
      checkedAt: now(),
      latencyMs: Math.max(0, Date.now() - startedAt),
    };
  }
}

export async function discoverHermesRuntime(input?: HermesEnv | HermesConnectorConfig): Promise<HermesDiscoveryResult> {
  const config = configFrom(input);
  if (config.reason !== 'sandbox-configured') {
    return mockHermesDiscovery(config.reason === 'missing-config' ? 'missing_config' : 'online', config.reason === 'missing-config' ? ['Hermes sandbox config missing; mock fallback remains available.'] : []);
  }
  return discoverHermes(input && !('service' in input) ? input : {
    HERMES_RUNTIME_MODE: 'sandbox',
    HERMES_SANDBOX_BASE_URL: config.baseUrl,
    HERMES_SANDBOX_API_KEY: config.apiKey,
    HERMES_SANDBOX_WORKSPACE_ID: config.workspaceId,
    HERMES_SANDBOX_TIMEOUT_MS: String(config.timeoutMs),
  });
}

export async function startHermesSandboxRun(task: HermesTask, input?: HermesEnv | HermesConnectorConfig): Promise<HermesExecution> {
  const config = configFrom(input);
  if (config.reason !== 'sandbox-configured') {
    return createMockHermesClient().startTask(task);
  }
  const createdTask = await sandboxRequest(config, '/tasks', { method: 'POST', body: JSON.stringify(task) });
  const taskRecord = isRecord(createdTask) ? createdTask : {};
  const taskId = stringValue(taskRecord.id ?? taskRecord.taskId, task.id);
  const payload = await sandboxRequest(config, `/tasks/${encodeURIComponent(taskId)}/runs`, { method: 'POST' });
  return normalizeHermesSandboxExecution(payload, fallbackExecution(taskId, task));
}

export async function pollHermesSandboxRun(runId: string, input?: HermesEnv | HermesConnectorConfig): Promise<HermesExecution> {
  const config = configFrom(input);
  if (config.reason !== 'sandbox-configured') {
    return createMockHermesClient().getRun(runId);
  }
  const payload = await sandboxRequest(config, `/runs/${encodeURIComponent(runId)}`);
  return normalizeHermesSandboxExecution(payload, { ...fallbackExecution(runId), id: runId });
}

export async function cancelHermesSandboxRun(runId: string, input?: HermesEnv | HermesConnectorConfig): Promise<HermesExecution> {
  const config = configFrom(input);
  if (config.reason !== 'sandbox-configured') {
    return createMockHermesClient().cancelRun(runId);
  }
  const payload = await sandboxRequest(config, `/runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST' });
  return normalizeHermesSandboxExecution(payload, { ...fallbackExecution(runId), id: runId, status: 'cancelled', currentStep: 'Cancelled by operator' });
}

function normalizeStreamEvents(payload: unknown, runId: string): RunStreamEvent[] {
  return arrayValue<unknown>(payload, []).map((item, index) => {
    const record = isRecord(item) ? item : {};
    const type = record.type === 'run.queued' || record.type === 'run.started' || record.type === 'tool.started' || record.type === 'tool.progress' || record.type === 'tool.completed' || record.type === 'artifact.created' || record.type === 'approval.requested' || record.type === 'run.completed' || record.type === 'run.failed'
      ? record.type
      : 'tool.progress';
    return {
      id: stringValue(record.id, `hermes-stream-${runId}-${index + 1}`),
      runId: stringValue(record.runId ?? record.run_id, runId),
      sequence: numberValue(record.sequence, index + 1),
      type,
      message: stringValue(record.message, `Hermes stream event ${index + 1}`),
      timestamp: stringValue(record.timestamp, now()),
      payload: isRecord(record.payload) ? record.payload : undefined,
    };
  });
}

export async function streamHermesSandboxEvents(runId: string, input?: HermesEnv | HermesConnectorConfig): Promise<RunStreamEvent[]> {
  const config = configFrom(input);
  if (config.reason !== 'sandbox-configured') {
    return [{
      id: `mock-stream-${runId}-progress`,
      runId,
      sequence: 1,
      type: 'tool.progress',
      message: 'Mock stream fallback is active',
      timestamp: now(),
      payload: { source: 'mock' },
    }];
  }
  const payload = await sandboxRequest(config, `/runs/${encodeURIComponent(runId)}/events`);
  return normalizeStreamEvents(payload, runId);
}
