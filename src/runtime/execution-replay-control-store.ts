import { DEMO_RUN_ID } from '../data/demo-fixtures';
import { getApprovalById } from '../runtime-store/approval-store';
import { getToolCallsByRun } from '../runtime-store/tool-call-store';
import { getUsageByRun } from '../runtime-store/usage-ledger-store';
import { selectArtifactById } from './artifact-registry-store';
import type { ExecutionReplayFrame, ExecutionTimelineEvent } from './execution-timeline';
import { buildTimelineForRun, getReplayFrames } from './execution-timeline-store';
import {
  replayControlId,
  type ExecutionReplayControlState,
  type ReplayDebugSnapshot,
  type ReplayPlaybackSpeed,
} from './execution-replay-control';

const REPLAY_CONTROL_STORAGE_KEY = 'uikigai-execution-replay-control-v1';
export const REPLAY_CONTROL_CHANGE_EVENT = 'uikigai-execution-replay-control-change';

interface ReplayControlStoreState {
  controls: Record<string, ExecutionReplayControlState>;
  updatedAt: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyStore(): ReplayControlStoreState {
  return { controls: {}, updatedAt: new Date().toISOString() };
}

function readStore(): ReplayControlStoreState {
  if (typeof window === 'undefined') return emptyStore();
  try {
    const raw = window.sessionStorage.getItem(REPLAY_CONTROL_STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<ReplayControlStoreState>;
    return {
      controls: parsed.controls ?? {},
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: ReplayControlStoreState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(REPLAY_CONTROL_STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent(REPLAY_CONTROL_CHANGE_EVENT, { detail: store.updatedAt }));
}

function clampFrameIndex(runId: string, frameIndex: number): number {
  const frames = getReplayFrames(runId);
  if (!frames.length) return 0;
  return Math.min(Math.max(frameIndex, 0), frames.length - 1);
}

function frameAt(runId: string, frameIndex: number): ExecutionReplayFrame | undefined {
  return getReplayFrames(runId)[clampFrameIndex(runId, frameIndex)];
}

function defaultControl(runId = DEMO_RUN_ID): ExecutionReplayControlState {
  const frame = frameAt(runId, 0);
  return {
    runId,
    status: 'paused',
    playbackSpeed: 1,
    selectedFrameIndex: 0,
    selectedEventId: frame?.eventId,
    updatedAt: new Date().toISOString(),
  };
}

function persistControl(control: ExecutionReplayControlState): ExecutionReplayControlState {
  const store = readStore();
  const now = new Date().toISOString();
  const next = { ...control, updatedAt: now };
  writeStore({
    controls: { ...store.controls, [control.runId]: next },
    updatedAt: now,
  });
  return clone(next);
}

function patchControl(runId: string, patch: Partial<ExecutionReplayControlState>): ExecutionReplayControlState {
  const current = getReplayControlState(runId);
  const selectedFrameIndex = clampFrameIndex(runId, patch.selectedFrameIndex ?? current.selectedFrameIndex);
  const frame = frameAt(runId, selectedFrameIndex);
  return persistControl({
    ...current,
    ...patch,
    runId,
    selectedFrameIndex,
    selectedEventId: patch.selectedEventId ?? frame?.eventId,
  });
}

export function getReplayControlState(runId = DEMO_RUN_ID): ExecutionReplayControlState {
  const existing = readStore().controls[runId];
  if (!existing) return defaultControl(runId);
  const selectedFrameIndex = clampFrameIndex(runId, existing.selectedFrameIndex);
  const frame = frameAt(runId, selectedFrameIndex);
  return clone({
    ...existing,
    selectedFrameIndex,
    selectedEventId: existing.selectedEventId ?? frame?.eventId,
  });
}

export function playReplay(runId = DEMO_RUN_ID): ExecutionReplayControlState {
  return patchControl(runId, { status: 'playing' });
}

export function pauseReplay(runId = DEMO_RUN_ID): ExecutionReplayControlState {
  return patchControl(runId, { status: 'paused' });
}

export function stepReplayForward(runId = DEMO_RUN_ID): ExecutionReplayControlState {
  const current = getReplayControlState(runId);
  return patchControl(runId, { status: 'paused', selectedFrameIndex: current.selectedFrameIndex + 1 });
}

export function stepReplayBackward(runId = DEMO_RUN_ID): ExecutionReplayControlState {
  const current = getReplayControlState(runId);
  return patchControl(runId, { status: 'paused', selectedFrameIndex: current.selectedFrameIndex - 1 });
}

export function jumpToReplayFrame(runId = DEMO_RUN_ID, frameIndex = 0): ExecutionReplayControlState {
  return patchControl(runId, { status: 'paused', selectedFrameIndex: frameIndex });
}

export function resetReplay(runId = DEMO_RUN_ID): ExecutionReplayControlState {
  return patchControl(runId, { status: 'paused', selectedFrameIndex: 0 });
}

export function setReplayPlaybackSpeed(runId = DEMO_RUN_ID, playbackSpeed: ReplayPlaybackSpeed = 1): ExecutionReplayControlState {
  return patchControl(runId, { playbackSpeed });
}

export function selectReplayEvent(runId = DEMO_RUN_ID, eventId: string): ExecutionReplayControlState {
  const frameIndex = getReplayFrames(runId).findIndex((frame) => frame.eventId === eventId);
  return patchControl(runId, {
    status: 'paused',
    selectedFrameIndex: frameIndex >= 0 ? frameIndex : getReplayControlState(runId).selectedFrameIndex,
    selectedEventId: eventId,
  });
}

export function getCurrentReplayFrame(runId = DEMO_RUN_ID): ExecutionReplayFrame | undefined {
  const control = getReplayControlState(runId);
  const frame = frameAt(runId, control.selectedFrameIndex);
  return frame ? clone(frame) : undefined;
}

export function getNextReplayFrame(runId = DEMO_RUN_ID): ExecutionReplayFrame | undefined {
  const control = getReplayControlState(runId);
  const frame = frameAt(runId, control.selectedFrameIndex + 1);
  return frame ? clone(frame) : undefined;
}

export function getPreviousReplayFrame(runId = DEMO_RUN_ID): ExecutionReplayFrame | undefined {
  const control = getReplayControlState(runId);
  const frame = frameAt(runId, control.selectedFrameIndex - 1);
  return frame ? clone(frame) : undefined;
}

export function getSelectedTimelineEvent(runId = DEMO_RUN_ID): ExecutionTimelineEvent | undefined {
  const control = getReplayControlState(runId);
  const timeline = buildTimelineForRun(runId);
  const event = timeline.events.find((item) => item.id === control.selectedEventId) ?? timeline.events[control.selectedFrameIndex];
  return event ? clone(event) : undefined;
}

export function canStepReplayForward(runId = DEMO_RUN_ID): boolean {
  return getReplayControlState(runId).selectedFrameIndex < getReplayFrames(runId).length - 1;
}

export function canStepReplayBackward(runId = DEMO_RUN_ID): boolean {
  return getReplayControlState(runId).selectedFrameIndex > 0;
}

export function getReplayDebugSnapshot(runId = DEMO_RUN_ID): ReplayDebugSnapshot {
  const control = getReplayControlState(runId);
  const frame = getCurrentReplayFrame(runId);
  const event = getSelectedTimelineEvent(runId);
  const state = frame?.state;
  const usage = getUsageByRun(runId);
  const artifacts = (state?.producedArtifacts ?? [])
    .map((artifactId) => selectArtifactById(artifactId)?.name ?? artifactId);
  const approvals = event?.approvalId
    ? [getApprovalById(event.approvalId)?.title ?? event.approvalId]
    : state?.approvalStatus ? [state.approvalStatus] : [];
  const toolCalls = getToolCallsByRun(runId)
    .filter((tool) => (state?.completedTools ?? []).includes(tool.id) || tool.id === event?.toolCallId)
    .map((tool) => `${tool.toolName}:${tool.status}`);
  const references = {
    artifacts,
    toolCalls,
    approvals,
    cost: Number((state?.accumulatedCost ?? usage.reduce((total, record) => total + record.actualCost, 0)).toFixed(4)),
    usage: Number((state?.accumulatedUsage ?? usage.reduce((total, record) => total + record.quantity, 0)).toFixed(4)),
  };
  return clone({
    runId,
    control,
    frame,
    event,
    state,
    references,
    raw: { control, frame, event, state, references },
  });
}

export function clearExecutionReplayControlStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(REPLAY_CONTROL_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(REPLAY_CONTROL_CHANGE_EVENT, { detail: 'cleared' }));
}
