import type { RuntimeServiceHealth } from '../growthos-runtime/runtime-types';
import type { PaperclipConnectorConfig } from './paperclip-config';
import { RuntimeConfigError, RuntimeIntegrationError, RuntimeTimeoutError } from './paperclip-errors';
import type { PaperclipArtifact, PaperclipClient } from './paperclip-types';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function arrayValue<T>(value: unknown, fallback: T[]) {
  return Array.isArray(value) ? value as T[] : fallback;
}

function normalizeHealth(payload: unknown, config: PaperclipConnectorConfig, startedAt: number): RuntimeServiceHealth {
  const record = isRecord(payload) ? payload : {};
  const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
  const rawStatus = record.status;
  const status = rawStatus === 'offline' || rawStatus === 'degraded' || rawStatus === 'online' ? rawStatus : 'online';

  return {
    service: 'paperclip',
    mode: config.mode,
    status,
    message: stringValue(record.message, 'Paperclip sandbox health endpoint responded'),
    checkedAt: new Date().toISOString(),
    latencyMs,
  };
}

function normalizeArtifact(payload: unknown, fallback: PaperclipArtifact): PaperclipArtifact {
  const record = isRecord(payload) ? payload : {};
  return {
    ...fallback,
    id: stringValue(record.id ?? record.artifactId, fallback.id),
    runId: stringValue(record.runId, fallback.runId),
    type: record.type === 'report' || record.type === 'log' || record.type === 'document' || record.type === 'archive' || record.type === 'screenshot'
      ? record.type
      : fallback.type,
    name: stringValue(record.name, fallback.name),
    url: typeof record.url === 'string' ? record.url : fallback.url,
    contentSummary: typeof record.contentSummary === 'string' ? record.contentSummary : fallback.contentSummary,
    createdAt: stringValue(record.createdAt, fallback.createdAt),
    source: record.source === 'hermes' || record.source === 'mock' ? record.source : 'paperclip',
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

export function createPaperclipHttpClient(config: PaperclipConnectorConfig): PaperclipClient {
  if (config.mode !== 'sandbox' || !config.baseUrl || !config.apiKey) {
    throw new RuntimeConfigError('paperclip', 'Paperclip sandbox config is missing; use mock fallback.');
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
        throw new RuntimeIntegrationError(`Paperclip sandbox request failed: ${response.status}`, {
          service: 'paperclip',
          code: 'PAPERCLIP_HTTP_ERROR',
          status: response.status,
          cause: payload,
        });
      }
      return payload;
    } catch (error) {
      if (error instanceof RuntimeIntegrationError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new RuntimeTimeoutError('paperclip', config.timeoutMs);
      }
      throw new RuntimeIntegrationError('Paperclip sandbox request failed', {
        service: 'paperclip',
        code: 'PAPERCLIP_REQUEST_FAILED',
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
    async createArtifact(input) {
      const fallback: PaperclipArtifact = {
        ...input,
        id: `paperclip-${input.runId}-${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        createdAt: new Date().toISOString(),
        source: 'paperclip',
      };
      const payload = await request('/artifacts', { method: 'POST', body: JSON.stringify(input) });
      return normalizeArtifact(payload, fallback);
    },
    async getArtifact(artifactId) {
      const fallback: PaperclipArtifact = {
        id: artifactId,
        runId: 'unknown-run',
        type: 'report',
        name: artifactId,
        createdAt: new Date().toISOString(),
        source: 'paperclip',
      };
      const payload = await request(`/artifacts/${encodeURIComponent(artifactId)}`);
      return normalizeArtifact(payload, fallback);
    },
    async listArtifacts(runId) {
      const payload = await request(`/runs/${encodeURIComponent(runId)}/artifacts`);
      const list = isRecord(payload) ? payload.artifacts : payload;
      return arrayValue<unknown>(list, []).map((item, index) => normalizeArtifact(item, {
        id: `paperclip-${runId}-${index + 1}`,
        runId,
        type: 'report',
        name: `Paperclip artifact ${index + 1}`,
        createdAt: new Date().toISOString(),
        source: 'paperclip',
      }));
    },
  };
}
