import type { RuntimeToolCall } from '../integrations/growthos-runtime/runtime-types';
import { readRuntimeState, updateRuntimeState } from './runtime-persistence';

function byStartTime(a: RuntimeToolCall, b: RuntimeToolCall): number {
  return (a.startedAt ?? '').localeCompare(b.startedAt ?? '');
}

export function upsertRuntimeToolCall(toolCall: RuntimeToolCall): RuntimeToolCall {
  updateRuntimeState((state) => ({
    ...state,
    toolCalls: { ...state.toolCalls, [toolCall.id]: toolCall },
  }));
  return toolCall;
}

export function getToolCallById(toolCallId?: string): RuntimeToolCall | undefined {
  if (!toolCallId) return undefined;
  return readRuntimeState().toolCalls[toolCallId];
}

export function getToolCallsByRun(runId: string): RuntimeToolCall[] {
  return Object.values(readRuntimeState().toolCalls)
    .filter((toolCall) => toolCall.runId === runId)
    .sort(byStartTime);
}

export function getActiveToolCall(runId: string): RuntimeToolCall | undefined {
  return getToolCallsByRun(runId).find((toolCall) => toolCall.status === 'running' || toolCall.status === 'queued');
}

export function getCompletedToolCalls(runId: string): RuntimeToolCall[] {
  return getToolCallsByRun(runId).filter((toolCall) => toolCall.status === 'completed');
}

export function clearToolCalls(runId: string) {
  updateRuntimeState((state) => {
    const nextToolCalls = Object.fromEntries(
      Object.entries(state.toolCalls).filter(([, toolCall]) => toolCall.runId !== runId),
    );
    return { ...state, toolCalls: nextToolCalls };
  });
}
