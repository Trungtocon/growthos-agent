export type PreGoLiveGateStatus = 'pending' | 'running' | 'pass' | 'warning' | 'fail' | 'blocked';
export type PreGoLiveVerdict = 'READY' | 'READY_WITH_WARNINGS' | 'BLOCKED' | 'FAILED';

export interface PreGoLiveValidationGate {
  gateId: string;
  name: string;
  category: string;
  status: PreGoLiveGateStatus;
  score: number;
  blockers: string[];
  warnings: string[];
  evidence: string[];
  relatedRoutes: string[];
  relatedSmokeCommand: string;
  lastRunTimestamp?: string;
  finalVerdict: string;
}

export interface PreGoLiveValidationRun {
  id: string;
  status: 'pending' | 'running' | 'completed';
  gates: PreGoLiveValidationGate[];
  readinessScore: number;
  blockers: string[];
  warnings: string[];
  remainingChecklist: string[];
  finalVerdict: PreGoLiveVerdict;
  createdAt: string;
  completedAt?: string;
}

export interface PreGoLiveValidationState {
  runs: PreGoLiveValidationRun[];
  activeRunId?: string;
  artifacts: ArtifactRecord[];
  updatedAt: string;
}
import type { ArtifactRecord } from './artifact-registry';

