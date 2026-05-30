import { createPaperclipHttpClient } from './paperclip-client';
import { createMockPaperclipClient } from './paperclip-mock';
import type { PaperclipArtifact, PaperclipClient } from './paperclip-types';

export interface PaperclipAdapter {
  createArtifact(input: Omit<PaperclipArtifact, 'id' | 'createdAt' | 'source'>): ReturnType<PaperclipClient['createArtifact']>;
}

export function createPaperclipAdapter(mode: 'mock' | 'remote' = 'mock'): PaperclipAdapter {
  const client = mode === 'mock' ? createMockPaperclipClient() : createPaperclipHttpClient({ mode });
  return {
    createArtifact: (input) => client.createArtifact(input),
  };
}
