import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const fixturesPath = path.join(root, 'src', 'data', 'demo-fixtures.ts');

function loadFixtures() {
  const source = fs.readFileSync(fixturesPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  const requireShim = (specifier) => {
    throw new Error(`Unexpected runtime import in demo fixtures: ${specifier}`);
  };
  const run = new Function('exports', 'require', 'module', '__filename', '__dirname', transpiled);
  run(module.exports, requireShim, module, fixturesPath, path.dirname(fixturesPath));
  return module.exports;
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function uniqueById(name, items, failures) {
  const ids = new Set();
  for (const item of items) {
    assert(item.id, `${name} item missing id`, failures);
    assert(!ids.has(item.id), `${name} duplicate id: ${item.id}`, failures);
    ids.add(item.id);
  }
  return ids;
}

const data = loadFixtures();
const failures = [];

const agentIds = uniqueById('agents', data.demoAgents, failures);
const ticketIds = uniqueById('tickets', data.demoTickets, failures);
const runIds = uniqueById('runs', data.demoRuns, failures);
const approvalIds = uniqueById('approvals', data.demoApprovals, failures);
const goalIds = uniqueById('goals', data.demoGoals, failures);

for (const ticket of data.demoTickets) {
  assert(agentIds.has(ticket.ownerAgentId), `Ticket ${ticket.id} ownerAgentId missing: ${ticket.ownerAgentId}`, failures);
  assert(ticket.relatedGoalId ? goalIds.has(ticket.relatedGoalId) : true, `Ticket ${ticket.id} relatedGoalId missing: ${ticket.relatedGoalId}`, failures);
  assert(ticket.runId ? runIds.has(ticket.runId) : true, `Ticket ${ticket.id} runId missing: ${ticket.runId}`, failures);
  assert(ticket.approvalId ? approvalIds.has(ticket.approvalId) : true, `Ticket ${ticket.id} approvalId missing: ${ticket.approvalId}`, failures);
}

for (const run of data.demoRuns) {
  assert(ticketIds.has(run.ticketId), `Run ${run.id} ticketId missing: ${run.ticketId}`, failures);
  assert(agentIds.has(run.agentId), `Run ${run.id} agentId missing: ${run.agentId}`, failures);
  for (const artifact of run.artifacts ?? []) {
    assert(artifact.runId === run.id, `Artifact ${artifact.id} has wrong runId: ${artifact.runId}`, failures);
  }
}

for (const approval of data.demoApprovals) {
  assert(ticketIds.has(approval.ticketId), `Approval ${approval.id} ticketId missing: ${approval.ticketId}`, failures);
  assert(agentIds.has(approval.agentId), `Approval ${approval.id} agentId missing: ${approval.agentId}`, failures);
  assert(approval.runId ? runIds.has(approval.runId) : true, `Approval ${approval.id} runId missing: ${approval.runId}`, failures);
}

for (const activity of data.demoActivities) {
  assert(activity.actorAgentId ? agentIds.has(activity.actorAgentId) : true, `Activity ${activity.id} actorAgentId missing: ${activity.actorAgentId}`, failures);
  assert(activity.relatedTicketId ? ticketIds.has(activity.relatedTicketId) : true, `Activity ${activity.id} relatedTicketId missing: ${activity.relatedTicketId}`, failures);
  assert(activity.relatedRunId ? runIds.has(activity.relatedRunId) : true, `Activity ${activity.id} relatedRunId missing: ${activity.relatedRunId}`, failures);
}

assert(agentIds.has(data.DEMO_AGENT_ID), `Demo agent missing: ${data.DEMO_AGENT_ID}`, failures);
assert(ticketIds.has(data.DEMO_TICKET_ID), `Demo ticket missing: ${data.DEMO_TICKET_ID}`, failures);
assert(runIds.has(data.DEMO_RUN_ID), `Demo run missing: ${data.DEMO_RUN_ID}`, failures);
assert(data.demoApprovals.length > 0, 'Approvals must not be empty', failures);
assert(data.demoCostBreakdown.total > 0, 'Cost breakdown total must be positive', failures);

const summary = {
  agents: data.demoAgents.length,
  tickets: data.demoTickets.length,
  runs: data.demoRuns.length,
  approvals: data.demoApprovals.length,
  goals: data.demoGoals.length,
  activities: data.demoActivities.length,
  failures,
};

if (failures.length > 0) {
  console.error('Demo data validation failed');
  console.error(JSON.stringify(summary, null, 2));
  process.exit(1);
}

console.log('Demo data validation passed');
console.log(JSON.stringify(summary, null, 2));
