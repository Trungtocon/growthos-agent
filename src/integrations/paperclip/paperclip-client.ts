import type { PaperclipClient } from './paperclip-types';

export interface PaperclipClientConfig {
  mode: 'mock' | 'remote';
  baseUrl?: string;
}

export function createPaperclipHttpClient(_config: PaperclipClientConfig): PaperclipClient {
  return {
    async createArtifact() {
      throw new Error('Remote Paperclip client is not configured in Sprint 6A. Use mock mode.');
    },
  };
}
