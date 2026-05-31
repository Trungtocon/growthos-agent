import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/live-run-streaming-smoke.json');

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
  await page.goto(`${baseUrl}/tickets/demo-ticket`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const { resetRuntimeState } = await import('/src/runtime-store/runtime-persistence.ts');
    const { resetWorkflowState } = await import('/src/state/workflow-engine.ts');
    window.sessionStorage.removeItem('uikigai-demo-ui-state');
    resetRuntimeState();
    resetWorkflowState();
  });

  await expectStep(rows, 'startStreamingRun creates run', async () => {
    const result = await page.evaluate(async () => {
      const { startStreamingRun } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { readRuntimeState } = await import('/src/runtime-store/runtime-persistence.ts');
      const commandResult = await startStreamingRun('ticket-audit-module-3');
      return { commandResult, state: readRuntimeState() };
    });
    const run = result.state.runs['run-demo-module-3'];
    assert(run, 'runtime run missing');
    assert(result.commandResult.event.type === 'run.queued', `expected run.queued, got ${result.commandResult.event.type}`);
    return { runId: result.commandResult.runId, lifecycle: run.lifecycle };
  });

  await expectStep(rows, 'stream tick advances status', async () => {
    const result = await page.evaluate(async () => {
      const { nextStreamTick } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const commandResult = await nextStreamTick('run-demo-module-3');
      const { getStreamEvents } = await import('/src/runtime-store/stream-store.ts');
      return { commandResult, events: getStreamEvents('run-demo-module-3') };
    });
    assert(result.commandResult.event.type === 'run.started', `expected run.started, got ${result.commandResult.event.type}`);
    assert(result.events.length === 2, `expected 2 events, got ${result.events.length}`);
    return { latest: result.commandResult.event.type };
  });

  await expectStep(rows, 'tool.started appears', async () => {
    const result = await page.evaluate(async () => {
      const { nextStreamTick } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      await nextStreamTick('run-demo-module-3');
      const { getStreamEvents } = await import('/src/runtime-store/stream-store.ts');
      return getStreamEvents('run-demo-module-3').map((event) => event.type);
    });
    assert(result.includes('tool.started'), 'tool.started event missing');
    return { events: result.join(',') };
  });

  await expectStep(rows, 'tool.completed appears', async () => {
    const result = await page.evaluate(async () => {
      const { nextStreamTick } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      await nextStreamTick('run-demo-module-3');
      await nextStreamTick('run-demo-module-3');
      const { getStreamEvents } = await import('/src/runtime-store/stream-store.ts');
      return getStreamEvents('run-demo-module-3').map((event) => event.type);
    });
    assert(result.includes('tool.progress'), 'tool.progress event missing');
    assert(result.includes('tool.completed'), 'tool.completed event missing');
    return { events: result.join(',') };
  });

  await expectStep(rows, 'artifact.created creates artifact', async () => {
    const result = await page.evaluate(async () => {
      const { nextStreamTick } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      await nextStreamTick('run-demo-module-3');
      const { getRunArtifacts } = await import('/src/runtime-store/artifact-store.ts');
      const { getStreamEvents } = await import('/src/runtime-store/stream-store.ts');
      return {
        events: getStreamEvents('run-demo-module-3').map((event) => event.type),
        artifacts: getRunArtifacts('run-demo-module-3'),
      };
    });
    assert(result.events.includes('artifact.created'), 'artifact.created event missing');
    assert(result.artifacts.some((artifact) => artifact.name === 'Paperclip_QA_Runtime_Packet.md'), 'stream artifact missing');
    return { artifacts: result.artifacts.length };
  });

  await expectStep(rows, 'approval.requested creates approval', async () => {
    const result = await page.evaluate(async () => {
      const { nextStreamTick } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      await nextStreamTick('run-demo-module-3');
      const { getPendingApprovals } = await import('/src/runtime-store/approval-store.ts');
      const { getStreamEvents } = await import('/src/runtime-store/stream-store.ts');
      return {
        events: getStreamEvents('run-demo-module-3').map((event) => event.type),
        approvals: getPendingApprovals(),
      };
    });
    assert(result.events.includes('approval.requested'), 'approval.requested event missing');
    assert(result.approvals.some((approval) => approval.id === 'approval-hermes-terminal'), 'runtime approval missing');
    await page.goto(`${baseUrl}/approvals`, { waitUntil: 'networkidle' });
    await page.locator('[data-interaction="select-approval"]').filter({ hasText: 'Hermes runtime approval required' }).first().waitFor({ timeout: 10000 });
    return { approvals: result.approvals.length };
  });

  await expectStep(rows, 'run.completed finalizes stream', async () => {
    const result = await page.evaluate(async () => {
      const { nextStreamTick } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const commandResult = await nextStreamTick('run-demo-module-3');
      const { readRuntimeState } = await import('/src/runtime-store/runtime-persistence.ts');
      const { isStreamComplete, getStreamEvents } = await import('/src/runtime-store/stream-store.ts');
      return {
        commandResult,
        state: readRuntimeState(),
        complete: isStreamComplete('run-demo-module-3'),
        events: getStreamEvents('run-demo-module-3'),
      };
    });
    const run = result.state.runs['run-demo-module-3'];
    assert(result.commandResult.event.type === 'run.completed', `expected run.completed, got ${result.commandResult.event.type}`);
    assert(result.complete, 'stream not marked complete');
    assert(run.lifecycle === 'COMPLETED', `expected COMPLETED lifecycle, got ${run.lifecycle}`);
    return { events: result.events.length, lifecycle: run.lifecycle };
  });

  await expectStep(rows, 'stream survives route navigation and reload', async () => {
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.locator('[data-parity-id="run.timeline-card"]').getByText('Streaming run completed').waitFor({ timeout: 10000 });
    await page.reload({ waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
      const { getStreamEvents, isStreamComplete } = await import('/src/runtime-store/stream-store.ts');
      return {
        events: getStreamEvents('run-demo-module-3').length,
        complete: isStreamComplete('run-demo-module-3'),
      };
    });
    assert(result.events >= 8, `expected persisted stream events, got ${result.events}`);
    assert(result.complete, 'persisted stream complete flag missing');
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

  console.log('| Live run streaming | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nLive run streaming smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  await stopServer(serverProcess);
}
