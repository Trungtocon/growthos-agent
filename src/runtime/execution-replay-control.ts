import type { ExecutionReplayFrame, ExecutionReplayState, ExecutionTimelineEvent } from './execution-timeline';

export type ReplayPlaybackSpeed = 0.5 | 1 | 2;

export interface ExecutionReplayControlState {
  runId: string;
  status: 'playing' | 'paused';
  playbackSpeed: ReplayPlaybackSpeed;
  selectedFrameIndex: number;
  selectedEventId?: string;
  updatedAt: string;
}

export interface ReplayLinkedReferences {
  artifacts: string[];
  toolCalls: string[];
  approvals: string[];
  cost: number;
  usage: number;
}

export interface ReplayDebugSnapshot {
  runId: string;
  control: ExecutionReplayControlState;
  frame?: ExecutionReplayFrame;
  event?: ExecutionTimelineEvent;
  state?: ExecutionReplayState;
  references: ReplayLinkedReferences;
  raw: {
    control: ExecutionReplayControlState;
    frame?: ExecutionReplayFrame;
    event?: ExecutionTimelineEvent;
    state?: ExecutionReplayState;
    references: ReplayLinkedReferences;
  };
}

export function replayControlId(runId: string): string {
  return `execution-replay-control-${runId}`;
}
