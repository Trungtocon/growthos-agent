import { resolveHermesConfig, type HermesEnv } from './hermes-config';
import { RuntimeIntegrationError, RuntimeTimeoutError } from './hermes-errors';
import type { HermesCapability, HermesDiscoveryResult, HermesModelInfo, HermesToolInfo } from './hermes-discovery-types';

type JsonRecord = Record<string, unknown>;

function now() {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function arrayValue(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.items)) return value.items;
  if (isRecord(value) && Array.isArray(value.data)) return value.data;
  if (isRecord(value) && Array.isArray(value.results)) return value.results;
  return [];
}

function mockCapabilities(): HermesCapability[] {
  return [
    { id: 'task-execution', name: 'Task Execution', description: 'Create and execute Hermes tasks through the runtime adapter.', category: 'runtime', enabled: true, source: 'mock' },
    { id: 'tool-calls', name: 'Tool Calls', description: 'Emit structured tool calls for run inspection.', category: 'tools', enabled: true, source: 'mock' },
    { id: 'streaming', name: 'Streaming Events', description: 'Produce deterministic streaming lifecycle events.', category: 'streaming', enabled: true, source: 'mock' },
    { id: 'approval-gates', name: 'Human Approval Gates', description: 'Request operator approval before risky actions.', category: 'governance', enabled: true, source: 'mock' },
  ];
}

function mockModels(): HermesModelInfo[] {
  return [
    { id: 'claude-sonnet-runtime', provider: 'OpenRouter', name: 'Claude Sonnet Runtime', contextWindow: 200000, supportsTools: true, supportsStreaming: true, supportsVision: true },
    { id: 'gpt-4.1-runtime', provider: 'OpenAI', name: 'GPT-4.1 Runtime', contextWindow: 1047576, supportsTools: true, supportsStreaming: true, supportsVision: true },
  ];
}

function mockTools(): HermesToolInfo[] {
  return [
    { id: 'search-knowledge-base', name: 'SearchKnowledgeBase', description: 'Search ticket, policy, and workspace context.', enabled: true, categories: ['knowledge', 'runtime'] },
    { id: 'generate-plan', name: 'GeneratePlan', description: 'Generate execution plans from ticket context.', enabled: true, categories: ['planning'] },
    { id: 'produce-artifact', name: 'ProduceArtifact', description: 'Produce Paperclip-compatible artifacts.', enabled: true, categories: ['artifact', 'paperclip'] },
  ];
}

export function mockHermesDiscovery(status: HermesDiscoveryResult['status'] = 'online', warnings: string[] = []): HermesDiscoveryResult {
  return {
    status,
    mode: status === 'missing_config' ? 'sandbox' : 'mock',
    version: 'mock-hermes-1.0.0',
    serverTime: now(),
    capabilities: mockCapabilities(),
    models: mockModels(),
    tools: mockTools(),
    warnings,
    checkedAt: now(),
  };
}

function normalizeCapability(value: unknown, index: number): HermesCapability {
  const record = isRecord(value) ? value : {};
  return {
    id: stringValue(record.id ?? record.key, `capability-${index + 1}`),
    name: stringValue(record.name ?? record.label, `Capability ${index + 1}`),
    description: stringValue(record.description, 'Hermes sandbox capability normalized by GrowthOS.'),
    category: stringValue(record.category ?? record.type, 'runtime'),
    enabled: booleanValue(record.enabled, true),
    source: 'normalized',
  };
}

function normalizeModel(value: unknown, index: number): HermesModelInfo {
  const record = isRecord(value) ? value : {};
  return {
    id: stringValue(record.id ?? record.modelId, `model-${index + 1}`),
    provider: stringValue(record.provider, 'Hermes'),
    name: stringValue(record.name ?? record.label, `Hermes Model ${index + 1}`),
    contextWindow: numberValue(record.contextWindow ?? record.context_window),
    supportsTools: booleanValue(record.supportsTools ?? record.supports_tools, true),
    supportsStreaming: booleanValue(record.supportsStreaming ?? record.supports_streaming, true),
    supportsVision: typeof (record.supportsVision ?? record.supports_vision) === 'boolean' ? Boolean(record.supportsVision ?? record.supports_vision) : undefined,
  };
}

function normalizeTool(value: unknown, index: number): HermesToolInfo {
  const record = isRecord(value) ? value : {};
  return {
    id: stringValue(record.id ?? record.toolId, `tool-${index + 1}`),
    name: stringValue(record.name ?? record.label, `Hermes Tool ${index + 1}`),
    description: stringValue(record.description, 'Hermes sandbox tool normalized by GrowthOS.'),
    inputSchema: record.inputSchema ?? record.input_schema,
    outputSchema: record.outputSchema ?? record.output_schema,
    enabled: booleanValue(record.enabled, true),
    categories: arrayValue(record.categories).map((item) => String(item)),
  };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

async function requestDiscoveryEndpoint(baseUrl: string, apiKey: string, timeoutMs: number, endpoint: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });
    const payload = await readJson(response);
    if (!response.ok) {
      throw new RuntimeIntegrationError(`Hermes discovery endpoint ${endpoint} failed: ${response.status}`, {
        service: 'hermes',
        code: 'HERMES_DISCOVERY_HTTP_ERROR',
        status: response.status,
        cause: payload,
      });
    }
    return payload;
  } catch (error) {
    if (error instanceof RuntimeIntegrationError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw new RuntimeTimeoutError('hermes', timeoutMs);
    throw new RuntimeIntegrationError(`Hermes discovery endpoint ${endpoint} failed`, {
      service: 'hermes',
      code: 'HERMES_DISCOVERY_REQUEST_FAILED',
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function safeEndpoint<T>(name: string, request: () => Promise<T>, warnings: string[]): Promise<T | undefined> {
  try {
    return await request();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`${name}: ${message}`);
    return undefined;
  }
}

export async function getHermesHealth(env?: HermesEnv): Promise<unknown> {
  const config = resolveHermesConfig(env);
  if (config.reason !== 'sandbox-configured' || !config.baseUrl || !config.apiKey) return { status: config.status, message: config.reason };
  return requestDiscoveryEndpoint(config.baseUrl, config.apiKey, config.timeoutMs, '/health');
}

export async function getHermesVersion(env?: HermesEnv): Promise<unknown> {
  const config = resolveHermesConfig(env);
  if (config.reason !== 'sandbox-configured' || !config.baseUrl || !config.apiKey) return { version: 'mock-hermes-1.0.0' };
  return requestDiscoveryEndpoint(config.baseUrl, config.apiKey, config.timeoutMs, '/version');
}

export async function getHermesCapabilities(env?: HermesEnv): Promise<HermesCapability[]> {
  const config = resolveHermesConfig(env);
  if (config.reason !== 'sandbox-configured' || !config.baseUrl || !config.apiKey) return mockCapabilities();
  const payload = await requestDiscoveryEndpoint(config.baseUrl, config.apiKey, config.timeoutMs, '/capabilities');
  return arrayValue(payload).map(normalizeCapability);
}

export async function getHermesModels(env?: HermesEnv): Promise<HermesModelInfo[]> {
  const config = resolveHermesConfig(env);
  if (config.reason !== 'sandbox-configured' || !config.baseUrl || !config.apiKey) return mockModels();
  const payload = await requestDiscoveryEndpoint(config.baseUrl, config.apiKey, config.timeoutMs, '/models');
  return arrayValue(payload).map(normalizeModel);
}

export async function getHermesTools(env?: HermesEnv): Promise<HermesToolInfo[]> {
  const config = resolveHermesConfig(env);
  if (config.reason !== 'sandbox-configured' || !config.baseUrl || !config.apiKey) return mockTools();
  const payload = await requestDiscoveryEndpoint(config.baseUrl, config.apiKey, config.timeoutMs, '/tools');
  return arrayValue(payload).map(normalizeTool);
}

export async function discoverHermes(env?: HermesEnv): Promise<HermesDiscoveryResult> {
  const config = resolveHermesConfig(env);
  if (config.requestedMode === 'mock') return mockHermesDiscovery('online');

  if (config.reason === 'missing-config') {
    return {
      ...mockHermesDiscovery('missing_config', ['Hermes sandbox config missing; mock fallback remains available.']),
      baseUrl: config.baseUrl,
    };
  }

  const warnings: string[] = [];
  const health = await safeEndpoint('health', () => getHermesHealth(env), warnings);
  const version = await safeEndpoint('version', () => getHermesVersion(env), warnings);
  const capabilities = await safeEndpoint('capabilities', () => getHermesCapabilities(env), warnings) ?? mockCapabilities();
  const models = await safeEndpoint('models', () => getHermesModels(env), warnings) ?? mockModels();
  const tools = await safeEndpoint('tools', () => getHermesTools(env), warnings) ?? mockTools();
  const healthRecord = isRecord(health) ? health : {};
  const versionRecord = isRecord(version) ? version : {};
  const status = warnings.length === 0 ? 'online' : health ? 'degraded' : 'offline';

  return {
    status,
    mode: 'sandbox',
    baseUrl: config.baseUrl,
    version: stringValue(versionRecord.version ?? versionRecord.build, 'unknown'),
    serverTime: typeof healthRecord.serverTime === 'string' ? healthRecord.serverTime : undefined,
    capabilities,
    models,
    tools,
    warnings,
    checkedAt: now(),
  };
}
