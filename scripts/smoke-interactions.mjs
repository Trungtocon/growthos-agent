import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/real-ui-interactions-smoke.json');

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

async function readUiState(page) {
  return page.evaluate(() => JSON.parse(window.sessionStorage.getItem('uikigai-demo-ui-state') ?? '{}'));
}

async function expectStep(rows, name, action) {
  try {
    const details = await action();
    rows.push({ name, status: 'passed', ...details });
  } catch (error) {
    rows.push({ name, status: 'failed', error: error instanceof Error ? error.message : String(error) });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const serverProcess = await ensureServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, deviceScaleFactor: 1 });
const rows = [];

try {
  await page.goto(`${baseUrl}/command-center`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.sessionStorage.removeItem('uikigai-demo-ui-state'));

  await expectStep(rows, 'ticket filter updates shared store', async () => {
    await page.goto(`${baseUrl}/tickets`, { waitUntil: 'networkidle' });
    await page.locator('[data-interaction="ticket-filter-Status"]').click();
    const state = await readUiState(page);
    assert(state.routeFilters?.['/tickets']?.status === 'Running', 'ticket status filter was not stored');
    return { route: '/tickets', storedFilter: state.routeFilters['/tickets'].status };
  });

  await expectStep(rows, 'ticket card navigates to ticket detail with selected ticket', async () => {
    await page.locator('[data-interaction="select-ticket"]').first().click();
    await page.waitForURL('**/tickets/demo-ticket', { timeout: 10000 });
    const state = await readUiState(page);
    assert(typeof state.selectedTicketId === 'string' && state.selectedTicketId.length > 0, 'selectedTicketId missing');
    assert(await page.locator('[data-parity-id="ticket.header"]').count() > 0, 'ticket detail header missing');
    return { route: '/tickets/demo-ticket', selectedTicketId: state.selectedTicketId };
  });

  await expectStep(rows, 'ticket detail tab switching persists', async () => {
    await page.locator('[data-interaction="ticket-tab-Artifacts"]').click();
    const state = await readUiState(page);
    assert(state.activeTabs?.['/tickets/demo-ticket'] === 'Artifacts', 'ticket tab was not stored');
    return { activeTab: state.activeTabs['/tickets/demo-ticket'] };
  });

  await expectStep(rows, 'agent list navigates to agent detail with selected agent', async () => {
    await page.goto(`${baseUrl}/workforce`, { waitUntil: 'networkidle' });
    await page.locator('[data-interaction="select-agent"]').nth(1).click();
    await page.waitForURL('**/agents/demo-agent', { timeout: 10000 });
    const state = await readUiState(page);
    assert(state.selectedAgentId === 'agent-research', `unexpected selectedAgentId: ${state.selectedAgentId}`);
    assert(await page.getByText('Research Agent').count() > 0, 'selected agent did not render on detail page');
    return { route: '/agents/demo-agent', selectedAgentId: state.selectedAgentId };
  });

  await expectStep(rows, 'agent detail tab switching persists', async () => {
    await page.locator('[data-interaction="agent-tab-Runs"]').click();
    const state = await readUiState(page);
    assert(state.activeTabs?.['/agents/demo-agent'] === 'Runs', 'agent tab was not stored');
    return { activeTab: state.activeTabs['/agents/demo-agent'] };
  });

  await expectStep(rows, 'org chart node selection updates shared store', async () => {
    await page.goto(`${baseUrl}/org-chart`, { waitUntil: 'networkidle' });
    await page.locator('[data-interaction="select-org-agent"]').nth(2).click();
    const state = await readUiState(page);
    assert(state.selectedAgentId === 'agent-research', `unexpected org selectedAgentId: ${state.selectedAgentId}`);
    assert(await page.locator('[data-parity-id="org.agent-card"]').getByText('Research Agent').count() > 0, 'org detail selector did not rerender selected agent');
    return { selectedAgentId: state.selectedAgentId };
  });

  await expectStep(rows, 'approval filter and queue selection update shared store', async () => {
    await page.goto(`${baseUrl}/approvals`, { waitUntil: 'networkidle' });
    await page.locator('[data-interaction="approval-filter-High Risk 5"]').click();
    await page.locator('[data-interaction="select-approval"]').first().click();
    const state = await readUiState(page);
    assert(state.routeFilters?.['/approvals']?.risk === 'High', 'approval risk filter was not stored');
    assert(typeof state.selectedApprovalId === 'string' && state.selectedApprovalId.length > 0, 'selectedApprovalId missing');
    return { route: '/approvals', storedFilter: state.routeFilters['/approvals'].risk, selectedApprovalId: state.selectedApprovalId };
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

  console.log('| Interaction | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed' ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ') : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nInteraction smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);

  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  if (serverProcess) serverProcess.kill();
}
