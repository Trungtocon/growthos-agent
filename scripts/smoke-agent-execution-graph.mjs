import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/agent-execution-graph-smoke.json');

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectStep(rows, name, action) {
  try {
    const details = await action();
    rows.push({ name, status: 'passed', ...details });
  } catch (error) {
    rows.push({ name, status: 'failed', error: error instanceof Error ? error.message : String(error) });
  }
}

const serverProcess = await ensureServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 });
const rows = [];

try {
  await page.goto(`${baseUrl}/execution-graph`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const { resetRuntimeState } = await import('/src/runtime-store/runtime-persistence.ts');
    const { resetWorkflowState } = await import('/src/state/workflow-engine.ts');
    const { clearRunPlans } = await import('/src/runtime-store/run-plan-store.ts');
    const { resetUsageLedgerStore } = await import('/src/runtime-store/usage-ledger-store.ts');
    const { clearArtifactRegistry } = await import('/src/runtime/artifact-registry-store.ts');
    const { clearExecutionGraphStore } = await import('/src/runtime/agent-execution-graph-store.ts');
    const { clearGovernanceDecisionStore } = await import('/src/runtime/governance-decision-store.ts');
    resetRuntimeState();
    resetWorkflowState();
    clearRunPlans();
    resetUsageLedgerStore();
    clearArtifactRegistry();
    clearExecutionGraphStore();
    clearGovernanceDecisionStore();
  });

  await expectStep(rows, 'prepare runtime graph inputs', async () => {
    const result = await page.evaluate(async () => {
      const { createPlanForTicket, startStreamingRun, nextStreamTick } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { evaluateGovernanceDecision } = await import('/src/runtime/governance-decision-engine.ts');
      const { recordGovernanceDecision } = await import('/src/runtime/governance-decision-store.ts');
      const { getStreamEvents, isStreamComplete } = await import('/src/runtime-store/stream-store.ts');
      const plan = createPlanForTicket('ticket-audit-module-3', 'approval-gated-artifact');
      await startStreamingRun('ticket-audit-module-3');
      for (let guard = 0; guard < 24 && !isStreamComplete('run-demo-module-3'); guard += 1) {
        await nextStreamTick('run-demo-module-3');
      }
      const denied = recordGovernanceDecision(evaluateGovernanceDecision({
        targetId: 'run-demo-module-3',
        targetType: 'runtime',
        action: 'smokeBlockedExecution',
        deniedReason: 'Smoke governance blocker for graph lineage.',
      }));
      return { planId: plan.id, events: getStreamEvents('run-demo-module-3').length, decision: denied.finalDecision };
    });
    assert(result.planId.includes('run-plan'), 'run plan was not created');
    assert(result.events >= 6, 'stream did not create enough runtime events');
    assert(result.decision === 'DENY', 'governance blocker was not recorded');
    return result;
  });

  await expectStep(rows, 'graph builds for demo run', async () => {
    const result = await page.evaluate(async () => {
      const { buildExecutionGraphForRun } = await import('/src/runtime/agent-execution-graph-store.ts');
      const graph = buildExecutionGraphForRun('run-demo-module-3');
      return { id: graph.id, nodes: graph.nodes.length, edges: graph.edges.length };
    });
    assert(result.nodes >= 8, 'graph has too few nodes');
    assert(result.edges >= 7, 'graph has too few edges');
    return result;
  });

  await expectStep(rows, 'graph contains agent run plan step tool artifact nodes', async () => {
    const result = await page.evaluate(async () => {
      const { buildExecutionGraphForRun } = await import('/src/runtime/agent-execution-graph-store.ts');
      const graph = buildExecutionGraphForRun('run-demo-module-3');
      return graph.nodes.map((node) => node.type);
    });
    for (const type of ['AGENT', 'RUN', 'PLAN', 'STEP', 'TOOL_CALL', 'ARTIFACT']) {
      assert(result.includes(type), `${type} node missing`);
    }
    return { nodeTypes: [...new Set(result)].join(',') };
  });

  await expectStep(rows, 'artifact lineage works', async () => {
    const result = await page.evaluate(async () => {
      const { getArtifactLineage } = await import('/src/runtime/agent-execution-graph-store.ts');
      return getArtifactLineage('run-demo-module-3').map((node) => node.type);
    });
    assert(result.includes('ARTIFACT'), 'artifact lineage missing artifact node');
    return { lineageNodes: result.length };
  });

  await expectStep(rows, 'approval lineage works', async () => {
    const result = await page.evaluate(async () => {
      const { getApprovalLineage } = await import('/src/runtime/agent-execution-graph-store.ts');
      return getApprovalLineage('run-demo-module-3').map((node) => node.type);
    });
    assert(result.includes('APPROVAL'), 'approval lineage missing approval node');
    return { lineageNodes: result.length };
  });

  await expectStep(rows, 'governance blocked node appears', async () => {
    const result = await page.evaluate(async () => {
      const { getBlockedGraphNodes } = await import('/src/runtime/agent-execution-graph-store.ts');
      return getBlockedGraphNodes('run-demo-module-3').map((node) => ({ type: node.type, status: node.status, label: node.label }));
    });
    assert(result.some((node) => node.type === 'GOVERNANCE_DECISION' || node.type === 'ERROR'), 'blocked governance node missing');
    return { blockedNodes: result.length };
  });

  await expectStep(rows, 'cost and usage nodes attach correctly', async () => {
    const result = await page.evaluate(async () => {
      const { buildExecutionGraphForRun } = await import('/src/runtime/agent-execution-graph-store.ts');
      const graph = buildExecutionGraphForRun('run-demo-module-3');
      return {
        usage: graph.nodes.filter((node) => node.type === 'USAGE').length,
        cost: graph.nodes.filter((node) => node.type === 'COST').length,
        billedEdges: graph.edges.filter((edge) => edge.type === 'BILLED_AS').length,
      };
    });
    assert(result.usage >= 1, 'usage nodes missing');
    assert(result.cost >= 1, 'cost node missing');
    assert(result.billedEdges >= 1, 'billing edges missing');
    return result;
  });

  await expectStep(rows, 'no duplicate node IDs', async () => {
    const result = await page.evaluate(async () => {
      const { buildExecutionGraphForRun } = await import('/src/runtime/agent-execution-graph-store.ts');
      const graph = buildExecutionGraphForRun('run-demo-module-3');
      return graph.nodes.map((node) => node.id);
    });
    assert(result.length === new Set(result).size, 'duplicate graph node IDs found');
    return { nodes: result.length };
  });

  await expectStep(rows, 'no duplicate edges', async () => {
    const result = await page.evaluate(async () => {
      const { buildExecutionGraphForRun } = await import('/src/runtime/agent-execution-graph-store.ts');
      const graph = buildExecutionGraphForRun('run-demo-module-3');
      return graph.edges.map((edge) => edge.id);
    });
    assert(result.length === new Set(result).size, 'duplicate graph edge IDs found');
    return { edges: result.length };
  });

  await expectStep(rows, 'graph persists after reload', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
      const { getExecutionTrace } = await import('/src/runtime/agent-execution-graph-store.ts');
      return getExecutionTrace('run-demo-module-3');
    });
    assert(result.graphId === 'execution-graph-run-run-demo-module-3', 'persisted graph trace missing');
    assert(result.orderedNodes.length >= 8, 'persisted graph has too few nodes');
    return { nodes: result.orderedNodes.length };
  });

  await expectStep(rows, 'graph exports register into Artifact Registry', async () => {
    const result = await page.evaluate(async () => {
      const { registerExecutionGraphExports } = await import('/src/runtime/agent-execution-graph-store.ts');
      const { selectArtifactsByRun } = await import('/src/runtime/artifact-registry-store.ts');
      const exported = registerExecutionGraphExports('run-demo-module-3');
      return {
        exported: exported.map((record) => record.name),
        runArtifacts: selectArtifactsByRun('run-demo-module-3').map((record) => ({ id: record.id, name: record.name, runId: record.runId, type: record.type })),
      };
    });
    for (const name of ['execution-graph.json', 'execution-trace.md', 'artifact-lineage.md', 'approval-lineage.md']) {
      assert(result.exported.includes(name), `${name} export missing`);
    }
    assert(result.runArtifacts.every((record) => record.runId === 'run-demo-module-3'), 'registered graph exports should be run-linked');
    return { exports: result.exported.join(',') };
  });

  await expectStep(rows, 'UI renders execution graph route', async () => {
    await page.goto(`${baseUrl}/execution-graph`, { waitUntil: 'networkidle' });
    await page.locator('[data-execution-graph-route]').waitFor({ timeout: 10000 });
    await page.getByText('Agent Execution Graph').first().waitFor({ timeout: 10000 });
    const nodeRows = await page.getByText('ARTIFACT').count();
    assert(nodeRows >= 1, 'execution graph UI did not render artifact node');
    return { artifactLabels: nodeRows };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    summary: {
      total: rows.length,
      passed: rows.filter((row) => row.status === 'passed').length,
      failed: rows.filter((row) => row.status === 'failed').length,
    },
    rows,
  };
  writeJson(reportPath, report);
  if (report.summary.failed > 0) {
    throw new Error(`${report.summary.failed} agent execution graph smoke step(s) failed. See ${reportPath}`);
  }
  console.log(`Agent execution graph smoke passed: ${report.summary.passed}/${report.summary.total}`);
} finally {
  await browser.close();
  await stopServer(serverProcess);
}
