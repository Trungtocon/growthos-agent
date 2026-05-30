import type { HermesClient } from './hermes-types';

export interface HermesClientConfig {
  mode: 'mock' | 'remote';
  baseUrl?: string;
}

export function createHermesHttpClient(_config: HermesClientConfig): HermesClient {
  return {
    async startTask() {
      throw new Error('Remote Hermes client is not configured in Sprint 6A. Use mock mode.');
    },
    async sendRunCommand() {
      throw new Error('Remote Hermes client is not configured in Sprint 6A. Use mock mode.');
    },
  };
}
