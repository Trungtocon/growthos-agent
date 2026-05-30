import type { PaperclipArtifact, PaperclipClient } from './paperclip-types';

function delay(ms = 120) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createMockPaperclipClient(): PaperclipClient {
  const artifacts = new Map<string, PaperclipArtifact>();

  return {
    async healthCheck() {
      await delay(40);
      return {
        service: 'paperclip',
        mode: 'mock',
        status: 'online',
        message: 'Paperclip mock runtime is available',
        checkedAt: new Date().toISOString(),
        latencyMs: 40,
      };
    },

    async createArtifact(input): Promise<PaperclipArtifact> {
      await delay();
      const artifact: PaperclipArtifact = {
        ...input,
        id: `paperclip-${input.runId}-qa-packet`,
        createdAt: new Date().toISOString(),
        source: 'paperclip',
      };
      artifacts.set(artifact.id, artifact);
      return artifact;
    },

    async getArtifact(artifactId): Promise<PaperclipArtifact> {
      await delay(60);
      const artifact = artifacts.get(artifactId);
      if (artifact) return artifact;
      return {
        id: artifactId,
        runId: 'run-ticket-audit-module-3',
        type: 'report',
        name: 'Paperclip_QA_Runtime_Packet.md',
        createdAt: new Date().toISOString(),
        source: 'paperclip',
      };
    },

    async listArtifacts(runId): Promise<PaperclipArtifact[]> {
      await delay(60);
      const matching = [...artifacts.values()].filter((artifact) => artifact.runId === runId);
      if (matching.length > 0) return matching;
      return [
        {
          id: `paperclip-${runId}-qa-packet`,
          runId,
          type: 'report',
          name: 'Paperclip_QA_Runtime_Packet.md',
          createdAt: new Date().toISOString(),
          source: 'paperclip',
        },
      ];
    },
  };
}
