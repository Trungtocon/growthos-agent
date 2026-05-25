import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/real-ui-demo-flow-smoke.json');

const routes = [
  { screen: 8, route: '/command-center', mainSelector: '[data-parity-id="command.header"]', heading: 'Command Center' },
  { screen: 20, route: '/workforce', mainSelector: '[data-parity-id="workforce.header"]', heading: 'AI Workforce' },
  { screen: 21, route: '/org-chart', mainSelector: '[data-parity-id="org.main-grid"]', heading: 'Org Chart' },
  { screen: 23, route: '/agents/demo-agent', mainSelector: '[data-parity-id="agent.main-grid"]', heading: 'Agent Detail' },
  { screen: 30, route: '/tickets', mainSelector: '[data-parity-id="tickets.header"]', heading: 'Tickets Board' },
  { screen: 32, route: '/tickets/demo-ticket', mainSelector: '[data-parity-id="ticket.header"]', heading: 'Ticket Detail' },
  { screen: 34, route: '/runs/demo-run', mainSelector: '[data-parity-id="run.header"]', heading: 'Run Console' },
  { screen: 37, route: '/approvals', mainSelector: '[data-parity-id="approval.header"]', heading: 'Approval Center' },
];

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
  if (!child || child.killed) return;
  if (process.platform === 'win32' && child.pid) {
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

const serverProcess = await ensureServer();
const browser = await chromium.launch();
const rows = [];
let failed = false;

try {
  for (const routeSpec of routes) {
    const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, deviceScaleFactor: 1 });
    const consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    let row;
    try {
      const response = await page.goto(`${baseUrl}${routeSpec.route}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(Number(process.env.SMOKE_WAIT_MS || '500'));
      const status = response?.status() ?? 0;
      const appShellFound = await page.locator('[data-parity-id="app-shell.sidebar"]').count() > 0
        && await page.locator('[data-parity-id="app-shell.topbar"]').count() > 0
        && await page.locator('[data-parity-id="app-shell.main"]').count() > 0;
      const mainSelectorFound = await page.locator(routeSpec.mainSelector).count() > 0;
      const headingFound = await page.getByText(routeSpec.heading, { exact: false }).count() > 0;
      const bodyTextLength = await page.locator('body').innerText().then((text) => text.trim().length);
      const loaded = status >= 200 && status < 400 && bodyTextLength > 0;
      const passed = loaded && appShellFound && mainSelectorFound && headingFound && consoleErrors.length === 0;
      if (!passed) failed = true;
      row = {
        screen: routeSpec.screen,
        route: routeSpec.route,
        url: `${baseUrl}${routeSpec.route}`,
        httpStatus: status,
        loaded,
        appShellFound,
        mainSelector: routeSpec.mainSelector,
        mainSelectorFound,
        heading: routeSpec.heading,
        headingFound,
        consoleErrors,
        status: passed ? 'passed' : 'failed',
      };
    } catch (error) {
      failed = true;
      row = {
        screen: routeSpec.screen,
        route: routeSpec.route,
        url: `${baseUrl}${routeSpec.route}`,
        loaded: false,
        appShellFound: false,
        mainSelector: routeSpec.mainSelector,
        mainSelectorFound: false,
        heading: routeSpec.heading,
        headingFound: false,
        consoleErrors,
        error: error instanceof Error ? error.message : String(error),
        status: 'failed',
      };
    } finally {
      await page.close();
    }
    rows.push(row);
  }

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

  console.log('| Route | Loaded | AppShell | Main selector found | Console errors | Status |');
  console.log('|---|---|---|---|---:|---|');
  for (const row of rows) {
    console.log(`| ${row.route} | ${row.loaded ? 'yes' : 'no'} | ${row.appShellFound ? 'yes' : 'no'} | ${row.mainSelectorFound ? 'yes' : 'no'} | ${row.consoleErrors.length} | ${row.status} |`);
  }
  console.log(`\nSmoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
} finally {
  await browser.close();
  await stopServer(serverProcess);
}

process.exit(failed ? 1 : 0);
