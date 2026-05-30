import type { PaperclipArtifact, PaperclipClient } from './paperclip-types';

function delay(ms = 120) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createMockPaperclipClient(): PaperclipClient {
  return {
    async createArtifact(input): Promise<PaperclipArtifact> {
      await delay();
      return {
        ...input,
        id: `paperclip-${input.runId}-qa-packet`,
        createdAt: new Date().toISOString(),
        source: 'paperclip',
      };
    },
  };
}
