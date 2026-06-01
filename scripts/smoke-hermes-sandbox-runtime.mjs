import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/hermes-sandbox-runtime-smoke.json');

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function waitForServer(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() > deadline) reject(new Error(`Timed out waiting for dev server at ${url}`));
        else setTimeout(attempt, 500);
      });
      req.setTimeout(1500, () => req.destroy());
    };
    attempt();
  });
}

async function ensureServer() {
  try {
    await waitForServer(baseUrl, 1500);
    return null;
  } catch {
    const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
    const args = process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npm run dev -- --host 127.0.0.1']
      : ['run', 'dev', '--', '--host', '127.0.0.1'];
    const child = spawn(command, args, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
    });
    child.stdout.on('data', (chunk) => fs.appendFileSync(path.join(root, 'parity-reports/vite-dev.out.log'), chunk));
    child.stderr.on('data', (chunk) => fs.appendFileSync(path.join(root, 'parity-reports/vite-dev.err.log'), chunk));
    await waitForServer(baseUrl, 20000);
    return child;
  }
}

async function stopServer(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.on('close', resolve);
      killer.on('error', resolve);
    });
    return;
  }
  child.kill();
}

function startHermesSandboxServer() {
  const calls = [];
  const execution = {
    id: 'run-sandbox-1',
    taskId: 'task-sandbox-1',
    ticketId: 'ticket-audit-module-3',
    agentId: 'agent-hermes-qa',
    status: 'running',
    currentStep: 'Executing sandbox tool chain',
    elapsedSeconds: 42,
    cost: 0.051,
    riskLevel: 'medium',
    steps: [{ id: 'step-1', name: 'Sandbox execution', status: 'running', durationSeconds: 42, cost: 0.051 }],
    toolCalls: [
      {
        id: 'tool-sandbox-search',
        toolName: 'SearchKnowledgeBase',
        status: 'completed',
        inputSummary: 'Module 3 audit context',
        outputSummary: 'Knowledge base context loaded',
        durationMs: 1200,
        cost: 0.004,
      },
    ],
    logs: [{ id: 'log-sandbox-1', level: 'info', message: 'Hermes sandbox execution normalized' }],
    artifacts: [
      {
        id: 'artifact-sandbox-report',
        runId: 'run-sandbox-1',
        type: 'report',
        name: 'sandbox-runtime-report.md',
        contentSummary: 'Hermes sandbox produced a runtime report.',
        contentText: '# Sandbox Runtime Report\n\nExecution normalized.',
      },
    ],
  };

  const server = http.createServer((req, res) => {
    calls.push({ method: req.method, url: req.url });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type,accept,x-workspace-id');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'online', message: 'Hermes sandbox online', serverTime: new Date().toISOString() }));
      return;
    }
    if (req.url === '/version') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ version: 'sandbox-test-1.0.0' }));
      return;
    }
    if (req.url === '/capabilities') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify([{ id: 'runtime-execution', name: 'Runtime Execution', category: 'runtime', enabled: true }]));
      return;
    }
    if (req.url === '/models') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify([{ id: 'sandbox-model', name: 'Sandbox Model', provider: 'Hermes', supportsTools: true, supportsStreaming: true }]));
      return;
    }
    if (req.url === '/tools') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify([{ id: 'sandbox-tool', name: 'SearchKnowledgeBase', enabled: true, categories: ['knowledge'] }]));
      return;
    }
    if (req.method === 'POST' && req.url === '/tasks') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'task-sandbox-1', ticketId: 'ticket-audit-module-3', title: 'Sandbox task' }));
      return;
    }
    if (req.method === 'POST' && req.url === '/tasks/task-sandbox-1/runs') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(execution));
      return;
    }
    if (req.method === 'GET' && req.url === '/runs/run-sandbox-1') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ...execution, status: 'completed', currentStep: 'Sandbox execution completed' }));
      return;
    }
    if (req.method === 'POST' && req.url === '/runs/run-sandbox-1/cancel') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ...execution, status: 'cancelled', currentStep: 'Sandbox execution cancelled' }));
      return;
    }
    if (req.method === 'GET' && req.url === '/runs/run-sandbox-1/events') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify([
        { id: 'event-1', runId: 'run-sandbox-1', sequence: 1, type: 'run.started', message: 'Sandbox run started', timestamp: new Date().toISOString() },
        { id: 'event-2', runId: 'run-sandbox-1', sequence: 2, type: 'tool.completed', message: 'Sandbox tool completed', timestamp: new Date().toISOString() },
      ]));
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: `Not found: ${req.url}` }));
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not allocate Hermes sandbox server port'));
        return;
      }
      resolve({ server, calls, url: `http://127.0.0.1:${address.port}` });
    });
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectStep(rows, name, action) {
  try {
    const details = await action();
    rows.push({ name, ...details, status: 'passed' });
  } catch (error) {
    rows.push({ name, status: 'failed', error: error instanceof Error ? error.message : String(error) });
  }
}

const serverProcess = await ensureServer();
const sandboxServer = await startHermesSandboxServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 });
const rows = [];

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  await expectStep(rows, 'missing env falls back to mock', async () => {
    const result = await page.evaluate(async () => {
      const { checkHermesHealth, startHermesSandboxRun } = await import('/src/integrations/hermes/hermes-sandbox-client.ts');
      const health = await checkHermesHealth({ HERMES_RUNTIME_MODE: 'sandbox' });
      const execution = await startHermesSandboxRun({
        id: 'task-missing-env',
        ticketId: 'ticket-audit-module-3',
        title: 'Missing env task',
        prompt: 'Run missing env fallback',
        agentId: 'agent-hermes-qa',
        priority: 'high',
        riskLevel: 'medium',
        acceptanceCriteria: ['fallback'],
        tags: ['smoke'],
      }, { HERMES_RUNTIME_MODE: 'sandbox' });
      return { health, execution };
    });
    assert(result.health.status === 'degraded', `Expected degraded missing config, got ${result.health.status}`);
    assert(result.execution.id.includes('hermes') || result.execution.status === 'running', 'Expected mock Hermes execution fallback');
    return { health: result.health.status, run: result.execution.id };
  });

  await expectStep(rows, 'invalid health returns degraded', async () => {
    const result = await page.evaluate(async () => {
      const { checkHermesHealth } = await import('/src/integrations/hermes/hermes-sandbox-client.ts');
      return checkHermesHealth({
        HERMES_RUNTIME_MODE: 'sandbox',
        HERMES_SANDBOX_BASE_URL: 'http://127.0.0.1:9',
        HERMES_SANDBOX_API_KEY: 'bad-key',
        HERMES_SANDBOX_WORKSPACE_ID: 'workspace-smoke',
        HERMES_SANDBOX_TIMEOUT_MS: '500',
      });
    });
    assert(result.status === 'degraded', `Expected degraded invalid health, got ${result.status}`);
    return { health: result.status };
  });

  await expectStep(rows, 'sandbox health success', async () => {
    const result = await page.evaluate(async (url) => {
      const { checkHermesHealth } = await import('/src/integrations/hermes/hermes-sandbox-client.ts');
      return checkHermesHealth({
        HERMES_RUNTIME_MODE: 'sandbox',
        HERMES_SANDBOX_BASE_URL: url,
        HERMES_SANDBOX_API_KEY: 'sandbox-key',
        HERMES_SANDBOX_WORKSPACE_ID: 'workspace-smoke',
      });
    }, sandboxServer.url);
    assert(result.status === 'online', `Expected online sandbox health, got ${result.status}`);
    return { health: result.status, latencyMs: result.latencyMs };
  });

  await expectStep(rows, 'sandbox run start normalized', async () => {
    const result = await page.evaluate(async (url) => {
      const { startHermesSandboxRun } = await import('/src/integrations/hermes/hermes-sandbox-client.ts');
      return startHermesSandboxRun({
        id: 'task-sandbox-source',
        ticketId: 'ticket-audit-module-3',
        title: 'Sandbox source task',
        prompt: 'Run sandbox task',
        agentId: 'agent-hermes-qa',
        priority: 'high',
        riskLevel: 'medium',
        acceptanceCriteria: ['normalizes run'],
        tags: ['smoke'],
      }, {
        HERMES_RUNTIME_MODE: 'sandbox',
        HERMES_SANDBOX_BASE_URL: url,
        HERMES_SANDBOX_API_KEY: 'sandbox-key',
        HERMES_SANDBOX_WORKSPACE_ID: 'workspace-smoke',
      });
    }, sandboxServer.url);
    assert(result.id === 'run-sandbox-1', `Expected normalized run id, got ${result.id}`);
    assert(result.toolCalls.length === 1, 'Expected normalized tool calls');
    assert(result.artifacts.length === 1, 'Expected normalized artifacts');
    return { run: result.id, tools: result.toolCalls.length, artifacts: result.artifacts.length };
  });

  await expectStep(rows, 'sandbox poll normalized', async () => {
    const result = await page.evaluate(async (url) => {
      const { pollHermesSandboxRun } = await import('/src/integrations/hermes/hermes-sandbox-client.ts');
      return pollHermesSandboxRun('run-sandbox-1', {
        HERMES_RUNTIME_MODE: 'sandbox',
        HERMES_SANDBOX_BASE_URL: url,
        HERMES_SANDBOX_API_KEY: 'sandbox-key',
        HERMES_SANDBOX_WORKSPACE_ID: 'workspace-smoke',
      });
    }, sandboxServer.url);
    assert(result.status === 'completed', `Expected completed poll, got ${result.status}`);
    return { run: result.id, status: result.status };
  });

  await expectStep(rows, 'sandbox cancel normalized', async () => {
    const result = await page.evaluate(async (url) => {
      const { cancelHermesSandboxRun } = await import('/src/integrations/hermes/hermes-sandbox-client.ts');
      return cancelHermesSandboxRun('run-sandbox-1', {
        HERMES_RUNTIME_MODE: 'sandbox',
        HERMES_SANDBOX_BASE_URL: url,
        HERMES_SANDBOX_API_KEY: 'sandbox-key',
        HERMES_SANDBOX_WORKSPACE_ID: 'workspace-smoke',
      });
    }, sandboxServer.url);
    assert(result.status === 'cancelled', `Expected cancelled run, got ${result.status}`);
    return { run: result.id, status: result.status };
  });

  await expectStep(rows, 'sandbox tool calls and artifacts mapped', async () => {
    const result = await page.evaluate(async (url) => {
      const { startHermesSandboxRun } = await import('/src/integrations/hermes/hermes-sandbox-client.ts');
      const { mapHermesExecutionToRun } = await import('/src/integrations/growthos-runtime/run-event-mapper.ts');
      const execution = await startHermesSandboxRun({
        id: 'task-sandbox-map',
        ticketId: 'ticket-audit-module-3',
        title: 'Sandbox map task',
        prompt: 'Map sandbox output',
        agentId: 'agent-hermes-qa',
        priority: 'high',
        riskLevel: 'medium',
        acceptanceCriteria: ['map output'],
        tags: ['smoke'],
      }, {
        HERMES_RUNTIME_MODE: 'sandbox',
        HERMES_SANDBOX_BASE_URL: url,
        HERMES_SANDBOX_API_KEY: 'sandbox-key',
        HERMES_SANDBOX_WORKSPACE_ID: 'workspace-smoke',
      });
      const run = mapHermesExecutionToRun(execution, {
        id: 'run-sandbox-1',
        ticketId: 'ticket-audit-module-3',
        agentId: 'agent-hermes-qa',
        status: 'running',
        startedAt: new Date().toISOString(),
        elapsedSeconds: 0,
        currentStep: 'mapping',
        steps: [],
        toolCalls: [],
        logs: [],
        artifacts: [],
        cost: 0,
        riskLevel: 'medium',
      });
      return { toolCalls: run.toolCalls.length, artifacts: run.artifacts.length, source: run.artifacts[0]?.source };
    }, sandboxServer.url);
    assert(result.toolCalls === 1, 'Expected mapped tool calls');
    assert(result.artifacts === 1, 'Expected mapped artifacts');
    assert(result.source === 'hermes', `Expected Hermes artifact source, got ${result.source}`);
    return result;
  });

  await expectStep(rows, 'governance blocker prevents sandbox call', async () => {
    const before = sandboxServer.calls.length;
    const result = await page.evaluate(async () => {
      const { assertEnterpriseGovernancePreflight } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      try {
        assertEnterpriseGovernancePreflight('startHermesSandboxRun', 'run-blocked-smoke', {
          status: 'BLOCKED',
          blockedReasons: ['Smoke governance blocker'],
          warnings: [],
        });
        return { blocked: false };
      } catch (error) {
        return { blocked: true, message: error instanceof Error ? error.message : String(error) };
      }
    });
    assert(result.blocked, 'Expected governance preflight to block');
    assert(sandboxServer.calls.length === before, 'Expected no Hermes sandbox call after governance block');
    return { blocked: result.blocked, calls: sandboxServer.calls.length - before };
  });

  await expectStep(rows, 'approval hold prevents sandbox call until approved', async () => {
    const before = sandboxServer.calls.length;
    const result = await page.evaluate(async () => {
      const { createPlanForTicket, startRunFromPlan } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { getPendingApprovals } = await import('/src/runtime-store/approval-store.ts');
      const plan = createPlanForTicket('ticket-audit-module-3', 'approval-gated-artifact');
      await startRunFromPlan(plan.id);
      const approvals = getPendingApprovals();
      return { planId: plan.id, approvals: approvals.length };
    });
    assert(result.approvals > 0, 'Expected pending approval hold before execution can continue');
    assert(sandboxServer.calls.length === before, 'Expected approval hold path not to call Hermes sandbox');
    return { planId: result.planId, approvals: result.approvals, sandboxCalls: sandboxServer.calls.length - before };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    sandboxUrl: sandboxServer.url,
    summary: {
      checked: rows.length,
      passed: rows.filter((row) => row.status === 'passed').length,
      failed: rows.filter((row) => row.status !== 'passed').length,
    },
    rows,
  };
  writeJson(reportPath, report);

  console.log('| Hermes sandbox runtime smoke | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nHermes sandbox runtime smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  sandboxServer.server.close();
  await stopServer(serverProcess);
}
