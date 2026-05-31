import type { ArtifactType } from '../../domain/types';
import type { RuntimeServiceHealth } from '../growthos-runtime/runtime-types';

export interface PaperclipArtifact {
  id: string;
  runId: string;
  type: ArtifactType;
  name: string;
  url?: string;
  contentSummary?: string;
  contentText?: string;
  contentJson?: unknown;
  language?: string;
  sizeBytes?: number;
  createdAt: string;
  source: 'paperclip' | 'hermes' | 'mock';
}

export interface PaperclipClient {
  healthCheck(): Promise<RuntimeServiceHealth>;
  createArtifact(input: Omit<PaperclipArtifact, 'id' | 'createdAt' | 'source'>): Promise<PaperclipArtifact>;
  getArtifact(artifactId: string): Promise<PaperclipArtifact>;
  listArtifacts(runId: string): Promise<PaperclipArtifact[]>;
}
