import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/tool-runtime-smoke.json');

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

async function advanceUntil(page, eventType, maxTicks = 24) {
  return page.evaluate(async ({ eventType, maxTicks }) => {
    const { nextStreamTick } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
    const { getStreamEvents } = await import('/src/runtime-store/stream-store.ts');
    for (let guard = 0; guard < maxTicks; guard += 1) {
      if (getStreamEvents('run-demo-module-3').some((event) => event.type === eventType)) break;
      await nextStreamTick('run-demo-module-3');
    }
    return getStreamEvents('run-demo-module-3');
  }, { eventType, maxTicks });
}

const serverProcess = await ensureServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 });
const rows = [];

try {
  await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const { resetRuntimeState } = await import('/src/runtime-store/runtime-persistence.ts');
    const { resetWorkflowState } = await import('/src/state/workflow-engine.ts');
    window.sessionStorage.removeItem('uikigai-demo-ui-state');
    resetRuntimeState();
    resetWorkflowState();
    const { startStreamingRun } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
    await startStreamingRun('ticket-audit-module-3');
  });

  await expectStep(rows, 'tool created and started', async () => {
    await advanceUntil(page, 'tool.started');
    const result = await page.evaluate(async () => {
      const { getToolCallsByRun, getActiveToolCall } = await import('/src/runtime-store/tool-call-store.ts');
      return {
        tools: getToolCallsByRun('run-demo-module-3'),
        active: getActiveToolCall('run-demo-module-3'),
      };
    });
    assert(result.tools.length >= 1, 'no runtime tools created');
    assert(result.active?.toolName === 'SearchKnowledgeBase', `unexpected active tool ${result.active?.toolName}`);
    return { activeTool: result.active.toolName, toolCount: result.tools.length };
  });

  await expectStep(rows, 'tool completed and output persisted', async () => {
    await advanceUntil(page, 'tool.completed');
    const result = await page.evaluate(async () => {
      const { getCompletedToolCalls } = await import('/src/runtime-store/tool-call-store.ts');
      return getCompletedToolCalls('run-demo-module-3');
    });
    assert(result.some((tool) => tool.toolName === 'SearchKnowledgeBase'), 'SearchKnowledgeBase completion missing');
    assert(result.every((tool) => typeof tool.output === 'string' && tool.output.length > 0), 'completed tool output missing');
    return { completed: result.map((tool) => tool.toolName).join(',') };
  });

  await expectStep(rows, 'artifact linked to originating tool', async () => {
    await advanceUntil(page, 'artifact.created');
    const result = await page.evaluate(async () => {
      const { getRunArtifacts } = await import('/src/runtime-store/artifact-store.ts');
      const { getToolCallById } = await import('/src/runtime-store/tool-call-store.ts');
      const artifacts = getRunArtifacts('run-demo-module-3');
      const linkedArtifact = artifacts.find((artifact) => artifact.toolId);
      return { linkedArtifact, tool: getToolCallById(linkedArtifact?.toolId) };
    });
    assert(result.linkedArtifact, 'linked artifact missing');
    assert(result.tool?.toolName === 'ProduceArtifact', `unexpected artifact tool ${result.tool?.toolName}`);
    return { artifact: result.linkedArtifact.name, generatedBy: result.tool.toolName };
  });

  await expectStep(rows, 'approval linked to originating tool', async () => {
    await advanceUntil(page, 'approval.requested');
    const result = await page.evaluate(async () => {
      const { getPendingApprovals } = await import('/src/runtime-store/approval-store.ts');
      const { getToolCallById } = await import('/src/runtime-store/tool-call-store.ts');
      const approval = getPendingApprovals().find((item) => item.runId === 'run-demo-module-3');
      return { approval, tool: getToolCallById(approval?.toolId) };
    });
    assert(result.approval?.toolId, 'approval toolId missing');
    assert(result.tool?.toolName === 'ProduceArtifact', `unexpected approval tool ${result.tool?.toolName}`);
    return { approval: result.approval.title, originatingTool: result.tool.toolName };
  });

  await expectStep(rows, 'run console renders tool call panel', async () => {
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.locator('[data-parity-id="run.tool-calls-card"]').getByText('SearchKnowledgeBase').waitFor({ timeout: 10000 });
    await page.locator('[data-parity-id="run.tool-calls-card"]').getByText('Output:').first().waitFor({ timeout: 10000 });
    return { route: '/runs/demo-run' };
  });

  await expectStep(rows, 'ticket detail renders tool summary', async () => {
    await page.goto(`${baseUrl}/tickets/demo-ticket`, { waitUntil: 'networkidle' });
    await page.getByText('Current Tool').waitFor({ timeout: 10000 });
    await page.getByText('Tools').first().waitFor({ timeout: 10000 });
    return { route: '/tickets/demo-ticket' };
  });

  await expectStep(rows, 'approval center renders originating tool', async () => {
    await page.goto(`${baseUrl}/approvals`, { waitUntil: 'networkidle' });
    await page.getByText('Tool · ProduceArtifact').first().waitFor({ timeout: 10000 });
    return { route: '/approvals' };
  });

  await expectStep(rows, 'runtime tools survive reload and navigation', async () => {
    await page.goto(`${baseUrl}/command-center`, { waitUntil: 'networkidle' });
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.reload({ waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
      const { getToolCallsByRun, getCompletedToolCalls } = await import('/src/runtime-store/tool-call-store.ts');
      return {
        toolCount: getToolCallsByRun('run-demo-module-3').length,
        completed: getCompletedToolCalls('run-demo-module-3').length,
      };
    });
    assert(result.toolCount >= 3, `expected persisted tools, got ${result.toolCount}`);
    assert(result.completed >= 1, 'expected completed persisted tool');
    return result;
  });

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    summary: {
      checked: rows.length,
      passed: rows.filter((row) => row.status === 'passed').length,
      failed: rows.filter((row) => row.status !== 'passed').length,
    },
    rows,
  };
  writeJson(reportPath, report);

  console.log('| Tool runtime | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nTool runtime smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  await stopServer(serverProcess);
}
