import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/real-ui-accessibility-smoke.json');

const routes = [
  '/command-center', '/today', '/inbox', '/notifications',
  '/company/overview', '/company/settings', '/goals', '/goals/demo-goal', '/goals/new',
  '/projects', '/projects/demo-project', '/projects/new',
  '/workforce', '/org-chart', '/agents', '/agents/demo-agent', '/agents/new', '/agents/templates',
  '/agents/performance', '/agents/memory', '/skills', '/tools/permissions',
  '/tickets', '/tickets/list', '/tickets/demo-ticket', '/tickets/new',
  '/runs/demo-run', '/artifacts', '/artifacts/demo-artifact',
  '/approvals', '/approvals/demo-approval', '/governance/policies', '/audit-log', '/risk-center',
  '/cost', '/budget/settings', '/reports', '/reports/new',
  '/integrations', '/integrations/demo-integration', '/mcp', '/workspaces',
  '/secrets', '/team', '/roles-permissions', '/settings', '/billing', '/help',
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

const serverProcess = await ensureServer();
const browser = await chromium.launch();
const rows = [];
let failed = false;

try {
  for (const route of routes) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 });
    const consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(Number(process.env.A11Y_WAIT_MS || '400'));

    const audit = await page.evaluate(() => {
      const visible = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      };
      const buttonIssues = Array.from(document.querySelectorAll('button')).filter(visible).filter((button) => {
        const name = button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent || '';
        return name.trim().length === 0;
      }).map((button) => button.outerHTML.slice(0, 120));
      const inputIssues = Array.from(document.querySelectorAll('input, select, textarea')).filter(visible).filter((field) => {
        const id = field.getAttribute('id');
        const hasLabel = id ? Boolean(document.querySelector(`label[for="${CSS.escape(id)}"]`)) : false;
        return !hasLabel && !field.getAttribute('aria-label') && !field.getAttribute('aria-labelledby');
      }).map((field) => field.outerHTML.slice(0, 120));
      const progressIssues = Array.from(document.querySelectorAll('[role="progressbar"]')).filter(visible).filter((bar) => {
        return !bar.hasAttribute('aria-valuemin') || !bar.hasAttribute('aria-valuemax') || !bar.hasAttribute('aria-valuenow');
      }).map((bar) => bar.outerHTML.slice(0, 120));
      return {
        appShellFound: Boolean(document.querySelector('[data-parity-id="app-shell.sidebar"]') && document.querySelector('[data-parity-id="app-shell.topbar"]') && document.querySelector('[data-parity-id="app-shell.main"]')),
        visibleH1Count: Array.from(document.querySelectorAll('h1')).filter(visible).length,
        buttonIssues,
        inputIssues,
        progressIssues,
      };
    });

    const passed = consoleErrors.length === 0
      && audit.appShellFound
      && audit.visibleH1Count === 1
      && audit.buttonIssues.length === 0
      && audit.inputIssues.length === 0
      && audit.progressIssues.length === 0;
    if (!passed) failed = true;
    rows.push({ route, consoleErrors, ...audit, status: passed ? 'passed' : 'failed' });
    await page.close();
  }
} finally {
  await browser.close();
  await stopServer(serverProcess);
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

console.log('| Route | h1 | Button names | Field labels | Progressbar ARIA | Console errors | Status |');
console.log('|---|---:|---:|---:|---:|---:|---|');
for (const row of rows) {
  console.log(`| ${row.route} | ${row.visibleH1Count} | ${row.buttonIssues.length} | ${row.inputIssues.length} | ${row.progressIssues.length} | ${row.consoleErrors.length} | ${row.status} |`);
}
console.log(`\nAccessibility smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);

process.exit(failed ? 1 : 0);
