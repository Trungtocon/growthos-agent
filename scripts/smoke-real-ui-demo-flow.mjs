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
  { screen: 9, route: '/today', mainSelector: '[data-parity-id="today.header"]', heading: 'Today' },
  { screen: 10, route: '/inbox', mainSelector: '[data-parity-id="inbox.header"]', heading: 'AI Inbox' },
  { screen: 11, route: '/notifications', mainSelector: '[data-parity-id="notifications.header"]', heading: 'Notification Center' },
  { screen: 12, route: '/company/overview', mainSelector: '[data-parity-id="company.header"]', heading: 'Company Overview' },
  { screen: 13, route: '/company/settings', mainSelector: '[data-parity-id="company-settings.header"]', heading: 'Company Settings' },
  { screen: 14, route: '/goals', mainSelector: '[data-parity-id="goals.header"]', heading: 'Goals Dashboard' },
  { screen: 15, route: '/goals/demo-goal', mainSelector: '[data-parity-id="goal.header"]', heading: 'Tang lead marketing' },
  { screen: 16, route: '/goals/new', mainSelector: '[data-parity-id="create-goal.header"]', heading: 'Create Goal Wizard' },
  { screen: 17, route: '/projects', mainSelector: '[data-parity-id="projects.header"]', heading: 'Projects' },
  { screen: 18, route: '/projects/demo-project', mainSelector: '[data-parity-id="project.header"]', heading: 'GrowthOS V2 Launch' },
  { screen: 19, route: '/projects/new', mainSelector: '[data-parity-id="create-project.header"]', heading: 'Create Project Wizard' },
  { screen: 20, route: '/workforce', mainSelector: '[data-parity-id="workforce.header"]', heading: 'AI Workforce' },
  { screen: 21, route: '/org-chart', mainSelector: '[data-parity-id="org.main-grid"]', heading: 'Org Chart' },
  { screen: 22, route: '/agents', mainSelector: '[data-parity-id="agents.header"]', heading: 'Agents' },
  { screen: 23, route: '/agents/demo-agent', mainSelector: '[data-parity-id="agent.main-grid"]', heading: 'Agent Detail' },
  { screen: 24, route: '/agents/new', mainSelector: '[data-parity-id="agent-builder.header"]', heading: 'Create Agent Wizard' },
  { screen: 25, route: '/agents/templates', mainSelector: '[data-parity-id="agent-templates.header"]', heading: 'Agent Template Gallery' },
  { screen: 26, route: '/agents/performance', mainSelector: '[data-parity-id="agent-performance.header"]', heading: 'Agent Performance' },
  { screen: 27, route: '/agents/memory', mainSelector: '[data-parity-id="agent-memory.header"]', heading: 'Agent Memory' },
  { screen: 28, route: '/skills', mainSelector: '[data-parity-id="skills.header"]', heading: 'Skill Registry' },
  { screen: 29, route: '/tools/permissions', mainSelector: '[data-parity-id="tools.header"]', heading: 'Toolsets & Permissions' },
  { screen: 30, route: '/tickets', mainSelector: '[data-parity-id="tickets.header"]', heading: 'Tickets Board' },
  { screen: 31, route: '/tickets/list', mainSelector: '[data-parity-id="tickets-list.header"]', heading: 'Tickets List' },
  { screen: 32, route: '/tickets/demo-ticket', mainSelector: '[data-parity-id="ticket.header"]', heading: 'Ticket Detail' },
  { screen: 33, route: '/tickets/new', mainSelector: '[data-parity-id="ticket-create.header"]', heading: 'Create Ticket Wizard' },
  { screen: 34, route: '/runs/demo-run', mainSelector: '[data-parity-id="run.header"]', heading: 'Run Console' },
  { screen: 35, route: '/artifacts', mainSelector: '[data-parity-id="artifacts.header"]', heading: 'Artifacts Library' },
  { screen: 36, route: '/artifacts/demo-artifact', mainSelector: '[data-parity-id="artifact.header"]', heading: 'Artifact Detail' },
  { screen: 37, route: '/approvals', mainSelector: '[data-parity-id="approval.header"]', heading: 'Approval Center' },
  { screen: 38, route: '/approvals/demo-approval', mainSelector: '[data-parity-id="approval-detail.header"]', heading: 'Approval Detail' },
  { screen: 39, route: '/governance/policies', mainSelector: '[data-parity-id="governance.header"]', heading: 'Governance Policy' },
  { screen: 40, route: '/audit-log', mainSelector: '[data-parity-id="audit.header"]', heading: 'Audit Log' },
  { screen: 41, route: '/risk-center', mainSelector: '[data-parity-id="risk.header"]', heading: 'Risk Center' },
  { screen: 42, route: '/cost', mainSelector: '[data-parity-id="cost.header"]', heading: 'Cost Dashboard' },
  { screen: 43, route: '/budget/settings', mainSelector: '[data-parity-id="budget.header"]', heading: 'Budget Settings' },
  { screen: 44, route: '/reports', mainSelector: '[data-parity-id="reports.header"]', heading: 'Reports Dashboard' },
  { screen: 45, route: '/reports/new', mainSelector: '[data-parity-id="report-builder.header"]', heading: 'Report Builder' },
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
