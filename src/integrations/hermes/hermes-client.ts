import type { RuntimeServiceHealth } from '../growthos-runtime/runtime-types';
import type { HermesConnectorConfig } from './hermes-config';
import { RuntimeConfigError, RuntimeIntegrationError, RuntimeTimeoutError } from './hermes-errors';
import type { HermesClient, HermesExecution, HermesTask } from './hermes-types';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function arrayValue<T>(value: unknown, fallback: T[]) {
  return Array.isArray(value) ? value as T[] : fallback;
}

function normalizeHealth(payload: unknown, config: HermesConnectorConfig, startedAt: number): RuntimeServiceHealth {
  const record = isRecord(payload) ? payload : {};
  const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
  const rawStatus = record.status;
  const status = rawStatus === 'offline' || rawStatus === 'degraded' || rawStatus === 'online' ? rawStatus : 'online';

  return {
    service: 'hermes',
    mode: config.mode,
    status,
    message: stringValue(record.message, 'Hermes sandbox health endpoint responded'),
    checkedAt: new Date().toISOString(),
    latencyMs,
  };
}

function normalizeTask(payload: unknown, fallback: HermesTask): HermesTask {
  const record = isRecord(payload) ? payload : {};
  return {
    ...fallback,
    id: stringValue(record.id ?? record.taskId, fallback.id),
    ticketId: stringValue(record.ticketId, fallback.ticketId),
    title: stringValue(record.title, fallback.title),
    prompt: stringValue(record.prompt, fallback.prompt),
    agentId: stringValue(record.agentId, fallback.agentId),
    priority: record.priority === 'low' || record.priority === 'medium' || record.priority === 'high' || record.priority === 'critical'
      ? record.priority
      : fallback.priority,
    riskLevel: record.riskLevel === 'low' || record.riskLevel === 'medium' || record.riskLevel === 'high' || record.riskLevel === 'critical'
      ? record.riskLevel
      : fallback.riskLevel,
    acceptanceCriteria: arrayValue<string>(record.acceptanceCriteria, fallback.acceptanceCriteria),
    tags: arrayValue<string>(record.tags, fallback.tags),
  };
}

function fallbackExecution(taskId: string): HermesExecution {
  return {
    id: `sandbox-run-${taskId}`,
    taskId,
    ticketId: 'ticket-audit-module-3',
    agentId: 'agent-hermes-qa',
    status: 'running',
    currentStep: 'Hermes sandbox execution accepted',
    elapsedSeconds: 0,
    cost: 0,
    riskLevel: 'medium',
    steps: [],
    toolCalls: [],
    logs: [{ id: `log-${taskId}-accepted`, level: 'info', message: 'Sandbox run normalized by UIKIGAI runtime adapter' }],
  };
}

function normalizeExecution(payload: unknown, fallback: HermesExecution): HermesExecution {
  const record = isRecord(payload) ? payload : {};
  return {
    ...fallback,
    id: stringValue(record.id ?? record.runId, fallback.id),
    taskId: stringValue(record.taskId, fallback.taskId),
    ticketId: stringValue(record.ticketId, fallback.ticketId),
    agentId: stringValue(record.agentId, fallback.agentId),
    status: record.status === 'created' || record.status === 'queued' || record.status === 'running' || record.status === 'waiting_for_approval' || record.status === 'completed' || record.status === 'failed' || record.status === 'cancelled' || record.status === 'paused' || record.status === 'success' || record.status === 'warning'
      ? record.status
      : fallback.status,
    currentStep: stringValue(record.currentStep, fallback.currentStep),
    elapsedSeconds: numberValue(record.elapsedSeconds, fallback.elapsedSeconds),
    cost: numberValue(record.cost, fallback.cost),
    riskLevel: record.riskLevel === 'low' || record.riskLevel === 'medium' || record.riskLevel === 'high' || record.riskLevel === 'critical'
      ? record.riskLevel
      : fallback.riskLevel,
    steps: arrayValue(record.steps, fallback.steps),
    toolCalls: arrayValue(record.toolCalls, fallback.toolCalls),
    logs: arrayValue(record.logs, fallback.logs),
    artifacts: arrayValue(record.artifacts, fallback.artifacts ?? []),
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

export function createHermesHttpClient(config: HermesConnectorConfig): HermesClient {
  if (config.mode !== 'sandbox' || !config.baseUrl || !config.apiKey) {
    throw new RuntimeConfigError('hermes', 'Hermes sandbox config is missing; use mock fallback.');
  }

  async function request(path: string, init: RequestInit = {}) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(`${config.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
          ...init.headers,
        },
      });
      const payload = await readJson(response);
      if (!response.ok) {
        throw new RuntimeIntegrationError(`Hermes sandbox request failed: ${response.status}`, {
          service: 'hermes',
          code: 'HERMES_HTTP_ERROR',
          status: response.status,
          cause: payload,
        });
      }
      return payload;
    } catch (error) {
      if (error instanceof RuntimeIntegrationError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new RuntimeTimeoutError('hermes', config.timeoutMs);
      }
      throw new RuntimeIntegrationError('Hermes sandbox request failed', {
        service: 'hermes',
        code: 'HERMES_REQUEST_FAILED',
        cause: error,
      });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  return {
    async healthCheck() {
      const startedAt = performance.now();
      const payload = await request('/health');
      return normalizeHealth(payload, config, startedAt);
    },
    async createTask(task) {
      const payload = await request('/tasks', { method: 'POST', body: JSON.stringify(task) });
      return normalizeTask(payload, task);
    },
    async startRun(taskId) {
      const fallback = fallbackExecution(taskId);
      const payload = await request(`/tasks/${encodeURIComponent(taskId)}/runs`, { method: 'POST' });
      return normalizeExecution(payload, fallback);
    },
    async getRun(runId) {
      const fallback = fallbackExecution(runId);
      const payload = await request(`/runs/${encodeURIComponent(runId)}`);
      return normalizeExecution(payload, fallback);
    },
    async cancelRun(runId) {
      const fallback = { ...fallbackExecution(runId), id: runId, status: 'failed' as const, currentStep: 'Cancelled by operator' };
      const payload = await request(`/runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST' });
      return normalizeExecution(payload, fallback);
    },
    async startTask(task) {
      const createdTask = await this.createTask(task);
      return this.startRun(createdTask.id);
    },
    async sendRunCommand(runId, command) {
      if (command === 'cancel') return this.cancelRun(runId);
      const fallback = {
        ...fallbackExecution(runId),
        id: runId,
        status: command === 'pause' ? 'paused' as const : 'running' as const,
        currentStep: `Hermes sandbox ${command} command accepted`,
      };
      const payload = await request(`/runs/${encodeURIComponent(runId)}/commands`, {
        method: 'POST',
        body: JSON.stringify({ command }),
      });
      return normalizeExecution(payload, fallback);
    },
  };
}
