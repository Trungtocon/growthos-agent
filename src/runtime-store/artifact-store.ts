import type { Artifact } from '../domain/types';
import { readRuntimeState, updateRuntimeState } from './runtime-persistence';

export function upsertArtifact(artifact: Artifact): Artifact {
  updateRuntimeState((state) => ({
    ...state,
    artifacts: { ...state.artifacts, [artifact.id]: artifact },
  }));
  return artifact;
}

export function getRunArtifacts(runId: string): Artifact[] {
  return Object.values(readRuntimeState().artifacts).filter((artifact) => artifact.runId === runId);
}

export function getArtifactById(artifactId: string): Artifact | undefined {
  return readRuntimeState().artifacts[artifactId];
}

export function getRuntimeArtifacts(): Artifact[] {
  return Object.values(readRuntimeState().artifacts);
}

export function ensureRunArtifacts(artifacts: Artifact[]): Artifact[] {
  artifacts.forEach((artifact) => upsertArtifact(artifact));
  return artifacts;
}
