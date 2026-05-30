import type { ArtifactType } from '../../domain/types';

export interface PaperclipArtifact {
  id: string;
  runId: string;
  type: ArtifactType;
  name: string;
  url?: string;
  createdAt: string;
  source: 'paperclip';
}

export interface PaperclipClient {
  createArtifact(input: Omit<PaperclipArtifact, 'id' | 'createdAt' | 'source'>): Promise<PaperclipArtifact>;
}
