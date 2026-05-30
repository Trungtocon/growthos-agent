import type { Ticket } from '../../domain/types';
import type { HermesTask } from '../hermes/hermes-types';

export function mapTicketToHermesTask(ticket: Ticket, agentId = ticket.ownerAgentId): HermesTask {
  return {
    id: `hermes-task-${ticket.id}`,
    ticketId: ticket.id,
    agentId,
    title: ticket.title,
    prompt: ticket.description,
    acceptanceCriteria: ticket.acceptanceCriteria,
    priority: ticket.priority,
    riskLevel: ticket.riskLevel,
    tags: ticket.tags,
  };
}
