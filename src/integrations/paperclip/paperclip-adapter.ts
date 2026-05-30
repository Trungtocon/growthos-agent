import { createPaperclipHttpClient } from './paperclip-client';
import { resolvePaperclipConfig, type PaperclipConnectorConfig } from './paperclip-config';
import { createMockPaperclipClient } from './paperclip-mock';
import type { PaperclipArtifact, PaperclipClient } from './paperclip-types';
import type { RuntimeMode } from '../growthos-runtime/runtime-types';

export interface PaperclipAdapter {
  healthCheck: PaperclipClient['healthCheck'];
  createArtifact(input: Omit<PaperclipArtifact, 'id' | 'createdAt' | 'source'>): ReturnType<PaperclipClient['createArtifact']>;
  getArtifact: PaperclipClient['getArtifact'];
  listArtifacts: PaperclipClient['listArtifacts'];
}

export function createPaperclipAdapter(mode: RuntimeMode = 'mock', config: PaperclipConnectorConfig = resolvePaperclipConfig(undefined, mode)): PaperclipAdapter {
  const client = config.mode === 'mock' ? createMockPaperclipClient() : createPaperclipHttpClient(config);
  const fallbackHealth = async () => ({
    service: 'paperclip' as const,
    mode: config.mode,
    status: config.status,
    message: config.reason === 'missing-config' ? 'Paperclip sandbox config missing; using mock fallback' : 'Paperclip mock runtime is available',
    checkedAt: new Date().toISOString(),
  });

  return {
    healthCheck: config.reason === 'missing-config' ? fallbackHealth : () => client.healthCheck(),
    createArtifact: (input) => client.createArtifact(input),
    getArtifact: (artifactId) => client.getArtifact(artifactId),
    listArtifacts: (runId) => client.listArtifacts(runId),
  };
}
