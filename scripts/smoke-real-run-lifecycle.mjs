import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/real-run-lifecycle-smoke.json');

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
  await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const { resetRuntimeState } = await import('/src/runtime-store/runtime-persistence.ts');
    window.sessionStorage.removeItem('uikigai-demo-ui-state');
    window.sessionStorage.removeItem('uikigai-demo-workflow-data');
    resetRuntimeState();
  });

  await expectStep(rows, 'mock lifecycle still works', async () => {
    const result = await page.evaluate(async () => {
      const { startSandboxRun } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      return startSandboxRun('ticket-audit-module-3');
    });
    assert(result.runId === 'run-demo-module-3', `expected demo run id, got ${result.runId}`);
    return { runId: result.runId, runStatus: result.status };
  });

  await expectStep(rows, 'sandbox missing env falls back to mock lifecycle', async () => {
    const result = await page.evaluate(async () => {
      const { createRuntimeAdapters } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const adapters = createRuntimeAdapters('sandbox');
      return Promise.all([adapters.hermes.healthCheck(), adapters.paperclip.healthCheck()]);
    });
    const [hermes, paperclip] = result;
    assert(hermes.status === 'degraded', `expected Hermes degraded, got ${hermes.status}`);
    assert(paperclip.status === 'degraded', `expected Paperclip degraded, got ${paperclip.status}`);
    return { hermes: hermes.status, paperclip: paperclip.status };
  });

  await expectStep(rows, 'start run creates runtime run', async () => {
    const state = await page.evaluate(async () => {
      const { readRuntimeState } = await import('/src/runtime-store/runtime-persistence.ts');
      return readRuntimeState();
    });
    const run = state.runs['run-demo-module-3'];
    assert(run, 'runtime run missing');
    assert(run.lifecycle === 'WAITING_APPROVAL', `expected WAITING_APPROVAL, got ${run.lifecycle}`);
    return { lifecycle: run.lifecycle, runStatus: run.status, currentStep: run.currentStep };
  });

  await expectStep(rows, 'lifecycle creates events', async () => {
    const events = await page.evaluate(async () => {
      const { getRuntimeEvents } = await import('/src/runtime-store/event-store.ts');
      return getRuntimeEvents();
    });
    const commands = events.map((event) => event.command);
    for (const command of ['run.created', 'run.queued', 'run.started', 'tool.completed', 'artifact.created', 'approval.requested']) {
      assert(commands.includes(command), `missing lifecycle event ${command}`);
    }
    return { events: events.length };
  });

  await expectStep(rows, 'artifact appears', async () => {
    const artifacts = await page.evaluate(async () => {
      const { getRunArtifacts } = await import('/src/runtime-store/artifact-store.ts');
      return getRunArtifacts('run-demo-module-3');
    });
    assert(artifacts.some((artifact) => artifact.name === 'Paperclip_QA_Runtime_Packet.md'), 'Paperclip artifact missing');
    return { artifacts: artifacts.length };
  });

  await expectStep(rows, 'approval can be generated', async () => {
    const approvals = await page.evaluate(async () => {
      const { getPendingApprovals } = await import('/src/runtime-store/approval-store.ts');
      return getPendingApprovals();
    });
    assert(approvals.some((approval) => approval.id === 'approval-hermes-terminal'), 'runtime approval missing');
    return { approvals: approvals.length };
  });

  await expectStep(rows, 'cancel run updates status', async () => {
    const result = await page.evaluate(async () => {
      const { cancelSandboxRun } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { readRuntimeState } = await import('/src/runtime-store/runtime-persistence.ts');
      const commandResult = await cancelSandboxRun('run-demo-module-3');
      return { commandResult, state: readRuntimeState() };
    });
    const run = result.state.runs['run-demo-module-3'];
    assert(result.commandResult.status === 'failed', `expected failed command result, got ${result.commandResult.status}`);
    assert(run.lifecycle === 'REJECTED', `expected REJECTED lifecycle, got ${run.lifecycle}`);
    return { commandStatus: result.commandResult.status, lifecycle: run.lifecycle };
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

  console.log('| Real run lifecycle | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nReal run lifecycle smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  await stopServer(serverProcess);
}
