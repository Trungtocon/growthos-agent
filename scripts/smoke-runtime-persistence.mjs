import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/runtime-persistence-smoke.json');
const runtimeStorageKey = 'uikigai-runtime-store-v1';

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

async function runtimeState(page) {
  return page.evaluate((key) => {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, runtimeStorageKey);
}

async function resetDemoRuntime(page) {
  await page.evaluate((key) => {
    window.sessionStorage.removeItem('uikigai-demo-ui-state');
    window.sessionStorage.removeItem('uikigai-demo-workflow-data');
    window.sessionStorage.removeItem('uikigai-runtime-fail-next-command');
    window.sessionStorage.removeItem(key);
  }, runtimeStorageKey);
}

async function waitForWorkflowState(page, entityId, expectedStatus) {
  await page.waitForFunction(({ id, status }) => {
    const value = document.querySelector(`[data-workflow-status="${id}"]`)?.textContent ?? '';
    return value.includes(status) && !value.includes('Pending mutation');
  }, { id: entityId, status: expectedStatus }, { timeout: 10000 });
  return page.locator(`[data-workflow-status="${entityId}"]`).textContent();
}

const serverProcess = await ensureServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, deviceScaleFactor: 1 });
const rows = [];

try {
  await page.goto(`${baseUrl}/tickets/demo-ticket`, { waitUntil: 'networkidle' });
  await resetDemoRuntime(page);
  await page.reload({ waitUntil: 'networkidle' });

  await expectStep(rows, 'runtime state persists started run, artifact, approval, event', async () => {
    await page.locator('[data-workflow="ticket-start-run"]').click();
    await waitForWorkflowState(page, 'ticket-audit-module-3', 'Running');
    await page.getByText('Paperclip_QA_Runtime_Packet.md').waitFor({ timeout: 10000 });
    const state = await runtimeState(page);
    assert(state, 'runtime store missing from sessionStorage');
    assert(state.runs?.['run-demo-module-3']?.lifecycle === 'WAITING_APPROVAL', 'runtime run was not persisted as WAITING_APPROVAL');
    assert(state.artifacts?.['paperclip-run-demo-module-3-qa-packet'], 'Paperclip runtime artifact was not persisted');
    assert(state.approvals?.['approval-hermes-terminal']?.status === 'pending', 'runtime approval gate was not persisted as pending');
    assert(Array.isArray(state.events) && state.events.length > 0, 'runtime event log is empty');
    return {
      route: '/tickets/demo-ticket',
      lifecycle: state.runs['run-demo-module-3'].lifecycle,
      artifacts: Object.keys(state.artifacts).length,
      approvals: Object.keys(state.approvals).length,
      events: state.events.length,
    };
  });

  await expectStep(rows, 'runtime run and artifact survive route navigation', async () => {
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.locator('[data-parity-id="run.artifacts-card"]').getByText('Paperclip_QA_Runtime_Packet.md').waitFor({ timeout: 10000 });
    const state = await runtimeState(page);
    assert(state.runs?.['run-demo-module-3'], 'runtime run missing after navigation to run console');
    assert(state.artifacts?.['paperclip-run-demo-module-3-qa-packet'], 'runtime artifact missing after navigation to run console');
    return { route: '/runs/demo-run', lifecycle: state.runs['run-demo-module-3'].lifecycle };
  });

  await expectStep(rows, 'runtime approval survives navigation and decision updates store', async () => {
    await page.goto(`${baseUrl}/approvals`, { waitUntil: 'networkidle' });
    await page.locator('[data-parity-id="approval.queue-panel"]').getByText('Hermes runtime approval required').first().waitFor({ timeout: 10000 });
    await page.locator('[data-workflow="approval-approve"]').click();
    await waitForWorkflowState(page, 'approval-hermes-terminal', 'Approved');
    const state = await runtimeState(page);
    assert(state.approvals?.['approval-hermes-terminal']?.status === 'approved', 'runtime approval decision was not persisted');
    assert(state.runs?.['run-demo-module-3']?.lifecycle === 'APPROVED', 'runtime run lifecycle was not reconciled to APPROVED');
    return { route: '/approvals', approval: state.approvals['approval-hermes-terminal'].status, lifecycle: state.runs['run-demo-module-3'].lifecycle };
  });

  await expectStep(rows, 'runtime state survives full page reload', async () => {
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.reload({ waitUntil: 'networkidle' });
    const state = await runtimeState(page);
    assert(state.runs?.['run-demo-module-3']?.lifecycle === 'APPROVED', 'runtime run lifecycle did not survive reload');
    assert(state.artifacts?.['paperclip-run-demo-module-3-qa-packet'], 'runtime artifact did not survive reload');
    return { route: '/runs/demo-run', lifecycle: state.runs['run-demo-module-3'].lifecycle };
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

  console.log('| Runtime persistence | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nRuntime persistence smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  await stopServer(serverProcess);
}
