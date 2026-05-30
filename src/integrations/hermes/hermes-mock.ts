import type { HermesClient, HermesExecution, HermesTask } from './hermes-types';

function delay(ms = 140) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldFail(command: string) {
  if (typeof window === 'undefined') return false;
  const key = 'uikigai-runtime-fail-next-command';
  const value = window.sessionStorage.getItem(key);
  if (value !== command) return false;
  window.sessionStorage.removeItem(key);
  return true;
}

export function createMockHermesClient(): HermesClient {
  return {
    async startTask(task: HermesTask): Promise<HermesExecution> {
      await delay();
      if (shouldFail('startAgentRun')) throw new Error('Mock Hermes rejected startAgentRun');
      return {
        id: `run-${task.ticketId}-hermes`,
        taskId: task.id,
        ticketId: task.ticketId,
        agentId: task.agentId,
        status: 'running',
        currentStep: 'Waiting for human approval gate',
        elapsedSeconds: 18,
        cost: 0.038,
        riskLevel: task.riskLevel,
        steps: [
          { id: 'runtime-step-context', name: 'Mapped ticket into Hermes task', status: 'success', durationSeconds: 2, cost: 0.001 },
          { id: 'runtime-step-tools', name: 'Selected runtime tools', status: 'success', durationSeconds: 3, cost: 0.002 },
          { id: 'runtime-step-approval', name: 'Human approval required', status: 'warning', durationSeconds: 1, cost: 0 },
        ],
        toolCalls: [
          {
            id: 'runtime-tool-read-context',
            toolName: 'Read Context',
            status: 'success',
            inputSummary: task.title,
            outputSummary: 'Ticket context loaded into Hermes runtime',
            durationMs: 2400,
            cost: 0.002,
          },
          {
            id: 'runtime-tool-plan',
            toolName: 'Plan Execution',
            status: 'success',
            inputSummary: 'acceptance criteria',
            outputSummary: 'Execution checklist generated',
            durationMs: 3200,
            cost: 0.004,
          },
          {
            id: 'runtime-tool-approval',
            toolName: 'Request Approval',
            status: 'warning',
            inputSummary: 'terminal command approval',
            outputSummary: 'Human approval gate opened',
            durationMs: 900,
            cost: 0,
          },
        ],
        logs: [
          { id: 'runtime-log-started', level: 'info', message: `Hermes accepted task ${task.id}` },
          { id: 'runtime-log-context', level: 'info', message: 'Mapped ticket context and criteria' },
          { id: 'runtime-log-approval', level: 'warn', message: 'Approval required before external tool execution' },
        ],
      };
    },

    async sendRunCommand(runId, command): Promise<HermesExecution> {
      await delay();
      const commandKey = `${command}AgentRun`;
      if (shouldFail(commandKey)) throw new Error(`Mock Hermes rejected ${commandKey}`);
      const status = command === 'pause' ? 'paused' : command === 'cancel' ? 'failed' : 'running';
      return {
        id: runId,
        taskId: `task-${runId}`,
        ticketId: 'ticket-audit-module-3',
        agentId: 'agent-hermes-qa',
        status,
        currentStep: command === 'pause' ? 'Paused at Hermes checkpoint' : command === 'cancel' ? 'Cancelled by operator' : command === 'retry' ? 'Retrying Hermes execution' : 'Resumed Hermes execution',
        elapsedSeconds: 528,
        cost: 0.041,
        riskLevel: 'medium',
        steps: [],
        toolCalls: [],
        logs: [{ id: `runtime-log-${command}`, level: command === 'cancel' ? 'warn' : 'info', message: `Hermes command ${command} acknowledged` }],
      };
    },
  };
}
