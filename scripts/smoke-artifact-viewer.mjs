import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/artifact-viewer-smoke.json');

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
    const { startSandboxRun } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
    await startSandboxRun('ticket-audit-module-3');
  });

  await expectStep(rows, 'start/sync run creates artifacts', async () => {
    const artifacts = await page.evaluate(async () => {
      const { getRunArtifacts } = await import('/src/runtime-store/artifact-store.ts');
      return getRunArtifacts('run-demo-module-3');
    });
    assert(artifacts.some((artifact) => artifact.type === 'markdown'), 'markdown artifact missing');
    assert(artifacts.some((artifact) => artifact.type === 'json'), 'json artifact missing');
    assert(artifacts.some((artifact) => artifact.type === 'patch'), 'patch artifact missing');
    return { artifacts: artifacts.length };
  });

  await expectStep(rows, 'artifact list renders in run console', async () => {
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.locator('[data-artifact-viewer]').waitFor({ timeout: 10000 });
    await page.locator('[data-artifact-id="paperclip-run-demo-module-3-qa-packet"]').waitFor({ timeout: 10000 });
    const count = await page.locator('[data-artifact-id]').count();
    assert(count >= 3, `expected at least 3 artifact list rows, got ${count}`);
    return { route: '/runs/demo-run', visibleArtifacts: count };
  });

  await expectStep(rows, 'selecting artifact changes preview', async () => {
    await page.locator('[data-artifact-id="hermes-run-demo-module-3-tool-output-json"]').click();
    await page.locator('[data-artifact-preview-id="hermes-run-demo-module-3-tool-output-json"]').waitFor({ timeout: 10000 });
    await page.locator('[data-artifact-json]').waitFor({ timeout: 10000 });
    await page.locator('[data-artifact-id="paperclip-run-demo-module-3-follow-up-patch"]').click();
    await page.locator('[data-artifact-preview-id="paperclip-run-demo-module-3-follow-up-patch"]').waitFor({ timeout: 10000 });
    const previewText = await page.locator('[data-artifact-preview]').last().innerText();
    assert(previewText.includes('diff --git'), 'patch preview did not render');
    return { selected: 'json,patch' };
  });

  await expectStep(rows, 'ticket detail shows artifact summary', async () => {
    await page.evaluate(async () => {
      const { selectArtifact } = await import('/src/state/ui-actions.ts');
      selectArtifact('paperclip-run-demo-module-3-qa-packet');
    });
    await page.goto(`${baseUrl}/tickets/demo-ticket`, { waitUntil: 'networkidle' });
    await page.locator('[data-parity-id="ticket.artifacts-card"]').getByText('Paperclip_QA_Runtime_Packet.md').waitFor({ timeout: 10000 });
    await page.locator('[data-parity-id="ticket.artifacts-card"]').getByText('Open run').waitFor({ timeout: 10000 });
    return { route: '/tickets/demo-ticket' };
  });

  await expectStep(rows, 'approval detail displays related artifact', async () => {
    await page.goto(`${baseUrl}/approvals`, { waitUntil: 'networkidle' });
    const runtimeApproval = page.locator('[data-interaction="select-approval"]').filter({ hasText: 'Hermes runtime approval required' }).first();
    if (await runtimeApproval.count()) await runtimeApproval.click();
    await page.locator('[data-parity-id="approval.detail-card"]').getByText('Artifact', { exact: true }).waitFor({ timeout: 10000 });
    await page.locator('[data-parity-id="approval.detail-card"]').getByText('Paperclip_QA_Runtime_Packet.md').waitFor({ timeout: 10000 });
    return { route: '/approvals' };
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

  console.log('| Artifact viewer | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nArtifact viewer smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  await stopServer(serverProcess);
}
