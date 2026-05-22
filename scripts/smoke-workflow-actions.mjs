import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/real-ui-workflow-actions-smoke.json');

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
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for dev server at ${url}`));
        } else {
          setTimeout(attempt, 500);
        }
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
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npmCommand, ['run', 'dev', '--', '--host', '127.0.0.1'], {
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

async function waitForWorkflowState(page, entityId, expectedStatus) {
  const locator = page.locator(`[data-workflow-status="${entityId}"]`);
  await locator.waitFor({ timeout: 10000 });
  await locator.filter({ hasText: expectedStatus }).waitFor({ timeout: 10000 });
  return locator.textContent();
}

async function waitForReconciledWorkflowState(page, entityId, expectedStatus) {
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
  await page.goto(`${baseUrl}/approvals`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.sessionStorage.removeItem('uikigai-demo-ui-state');
    window.sessionStorage.removeItem('uikigai-demo-fail-next-command');
  });

  await expectStep(rows, 'approval approve reconciles optimistic state', async () => {
    await page.goto(`${baseUrl}/approvals`, { waitUntil: 'networkidle' });
    await page.locator('[data-workflow="approval-approve"]').click();
    const pending = await waitForWorkflowState(page, 'approval-hermes-terminal', 'Pending');
    const success = await waitForReconciledWorkflowState(page, 'approval-hermes-terminal', 'Approved');
    assert(await page.locator('[data-workflow-timeline]').getByText(/approved/i).count() > 0, 'approval event timeline missing success row');
    return { pending, success };
  });

  await expectStep(rows, 'approval reject updates queue detail', async () => {
    await page.locator('[data-interaction="select-approval"]').nth(1).click();
    await page.locator('[data-workflow="approval-reject"]').click();
    const success = await waitForReconciledWorkflowState(page, 'approval-crm-write', 'Rejected');
    return { success };
  });

  await expectStep(rows, 'run retry pause and resume reconcile metrics', async () => {
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.locator('[data-workflow="run-retry"]').click();
    await waitForReconciledWorkflowState(page, 'run-demo-module-3', 'Running');
    await page.locator('[data-workflow="run-pause"]').click();
    const paused = await waitForReconciledWorkflowState(page, 'run-demo-module-3', 'Paused');
    await page.locator('[data-workflow="run-resume"]').click();
    const resumed = await waitForReconciledWorkflowState(page, 'run-demo-module-3', 'Running');
    return { paused, resumed };
  });

  await expectStep(rows, 'ticket assignment escalation and resolve update selectors', async () => {
    await page.goto(`${baseUrl}/tickets/demo-ticket`, { waitUntil: 'networkidle' });
    await page.locator('[data-workflow="ticket-assign"]').click();
    await page.locator('[data-workflow="ticket-escalate"]').click();
    await page.locator('[data-workflow="ticket-resolve"]').click();
    const resolved = await waitForReconciledWorkflowState(page, 'ticket-audit-module-3', 'Done');
    assert(await page.locator('[data-workflow-timeline]').getByText(/ticket/i).count() > 0, 'ticket timeline missing workflow rows');
    return { resolved };
  });

  await expectStep(rows, 'failed mutation rolls back and surfaces inline error', async () => {
    await page.goto(`${baseUrl}/approvals`, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.sessionStorage.setItem('uikigai-demo-fail-next-command', 'rejectApproval'));
    await page.locator('[data-interaction="select-approval"]').nth(2).click();
    await page.locator('[data-workflow="approval-reject"]').click();
    const rolledBack = await waitForReconciledWorkflowState(page, 'approval-email-send', 'Pending');
    await page.locator('[data-workflow-error="approval-email-send"]').waitFor({ timeout: 10000 });
    assert(await page.locator('[data-workflow-error="approval-email-send"]').count() > 0, 'rollback inline error missing');
    return { rolledBack };
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

  console.log('| Workflow interaction | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nWorkflow smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  if (serverProcess) serverProcess.kill();
}
