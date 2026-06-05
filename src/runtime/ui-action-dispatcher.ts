import type { UiActionDescriptor, UiInteractionElementType } from './ui-interaction-audit';

export interface UiActionDispatchResult {
  actionId: string;
  status: 'handled' | 'blocked' | 'read_only';
  message: string;
  timestamp: string;
}

const dispatchLog: UiActionDispatchResult[] = [];

export function createUiActionDescriptor(input: {
  actionId: string;
  actionType: UiInteractionElementType;
  route: string;
  label: string;
  expectedBehavior: string;
  disabledReason?: string;
  nextActionRoute?: string;
}): UiActionDescriptor {
  return {
    ...input,
    status: input.disabledReason ? 'disabled_with_reason' : 'wired',
  };
}

export function dispatchUiAction(descriptor: UiActionDescriptor): UiActionDispatchResult {
  const result: UiActionDispatchResult = {
    actionId: descriptor.actionId,
    status: descriptor.status === 'disabled_with_reason' ? 'blocked' : descriptor.status === 'wired' ? 'handled' : 'read_only',
    message: descriptor.disabledReason
      ? `Blocked: ${descriptor.disabledReason}${descriptor.nextActionRoute ? ` Go to ${descriptor.nextActionRoute}.` : ''}`
      : `${descriptor.label} handled on ${descriptor.route}.`,
    timestamp: new Date().toISOString(),
  };
  dispatchLog.unshift(result);
  return result;
}

export function getUiActionDispatchLog(): UiActionDispatchResult[] {
  return JSON.parse(JSON.stringify(dispatchLog)) as UiActionDispatchResult[];
}

export function clearUiActionDispatchLog() {
  dispatchLog.splice(0, dispatchLog.length);
}
