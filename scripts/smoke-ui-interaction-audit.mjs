import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/ui-interaction-audit.json');

const requiredFiles = [
  'src/runtime/ui-interaction-audit.ts',
  'src/runtime/ui-interaction-audit-store.ts',
  'src/runtime/ui-action-dispatcher.ts',
  'src/pages/UiInteractionAuditPage.tsx',
];

const requiredArtifacts = [
  'ui-interaction-audit.md',
  'ui-interaction-audit.json',
  'ui-unwired-elements-before-fix.json',
  'ui-wiring-fix-summary.md',
  'ui-action-map.json',
];

async function scanInteractiveRoute(page, route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(100);
  return page.evaluate((currentRoute) => {
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
    const controls = Array.from(document.querySelectorAll('button, a, input, select, textarea, [role="button"], [role="tab"], [role="menuitem"], [data-interaction], [data-action-id]'))
      .filter((element) => visible(element));
    return controls.map((element) => {
      const tag = element.tagName.toLowerCase();
      const role = element.getAttribute('role') || '';
      const propsKey = Object.keys(element).find((key) => key.startsWith('__reactProps$'));
      const reactProps = propsKey ? element[propsKey] : undefined;
      const label = element.getAttribute('aria-label') || element.textContent?.trim() || element.getAttribute('placeholder') || element.getAttribute('title') || `${tag}:${role || 'control'}`;
      const href = tag === 'a' ? element.getAttribute('href') || '' : '';
      const disabled = element.disabled || element.getAttribute('aria-disabled') === 'true';
      const reason = element.getAttribute('data-disabled-reason') || element.getAttribute('title') || element.getAttribute('aria-label') || '';
      const readOnly = element.getAttribute('data-action-state') === 'read-only';
      const hasHandler = typeof reactProps?.onClick === 'function'
        || typeof reactProps?.onChange === 'function'
        || typeof reactProps?.onInput === 'function'
        || Boolean(element.getAttribute('data-interaction') || element.getAttribute('data-action-id') || element.getAttribute('data-workflow'));
      let status = 'wired';
      let actualBehavior = 'Handler, navigation, metadata, input change, or selector-driven state is present.';
      if (tag === 'a' && (!href || href === '#')) {
        status = 'dead_link';
        actualBehavior = `Dead href ${href || '(empty)'}`;
      } else if (disabled && !reason) {
        status = 'unwired';
        actualBehavior = 'Disabled control has no visible reason.';
      } else if (disabled) {
        status = 'disabled_with_reason';
        actualBehavior = `Disabled with reason: ${reason}`;
      } else if (!hasHandler && !readOnly && tag !== 'input' && tag !== 'select' && tag !== 'textarea' && tag !== 'a') {
        status = 'unwired';
        actualBehavior = 'No click/change handler, action metadata, or read-only reason.';
      } else if (readOnly) {
        status = 'disabled_with_reason';
        actualBehavior = reason || 'Coming soon / read-only';
      }
      return {
        route: currentRoute,
        label,
        type: role || tag,
        status,
        href,
        actualBehavior,
      };
    });
  }, route);
}

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
    const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], shell: false, windowsHide: true });
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
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
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
    rows.push({ name, ...(await action()), status: 'passed' });
  } catch (error) {
    rows.push({ name, status: 'failed', error: error instanceof Error ? error.message : String(error) });
  }
}

async function main() {
  const rows = [];
  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  try {
    await expectStep(rows, 'required Sprint UI interaction audit files exist', async () => {
      const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
      assert(missing.length === 0, `missing files: ${missing.join(', ')}`);
      return { files: requiredFiles.length };
    });

    await expectStep(rows, 'route exists and audit page renders', async () => {
      await page.goto(`${baseUrl}/ui-interaction-audit`, { waitUntil: 'networkidle' });
      const route = await page.locator('[data-route="/ui-interaction-audit"]').count();
      const matrix = await page.locator('[data-ui-interaction-audit-matrix]').count();
      const buttons = await page.locator('[data-action-id]').count();
      assert(route === 1, 'route marker missing');
      assert(matrix === 1, 'audit matrix missing');
      assert(buttons >= 2, `expected action metadata buttons, got ${buttons}`);
      return { route, buttons };
    });

    await expectStep(rows, 'audit store builds 100 percent coverage report', async () => {
      const result = await page.evaluate(async () => {
        const store = await import('/src/runtime/ui-interaction-audit-store.ts');
        const report = store.runUiInteractionAudit();
        return {
          totalRoutes: report.totalRoutes,
          totalElements: report.totalElements,
          wired: report.wired,
          unwired: report.unwired,
          disabledWithReason: report.disabledWithReason,
          deadLinks: report.deadLinks,
          consoleErrors: report.consoleErrors,
          coveragePercent: report.coveragePercent,
          routeCount: report.routes.length,
          sections: report.routes.reduce((total, route) => total + route.sections.length, 0),
        };
      });
      assert(result.totalRoutes >= 70, `expected broad route coverage, got ${result.totalRoutes}`);
      assert(result.totalElements > 0, 'no interactive elements found');
      assert(result.wired > 0, 'no wired elements counted');
      assert(result.unwired === 0, `unwired elements remain: ${result.unwired}`);
      assert(result.deadLinks === 0, `dead links remain: ${result.deadLinks}`);
      assert(result.consoleErrors === 0, `console errors remain: ${result.consoleErrors}`);
      assert(result.coveragePercent === 100, `expected 100 coverage, got ${result.coveragePercent}`);
      assert(result.routeCount === result.totalRoutes, 'route count mismatch');
      assert(result.sections >= result.totalRoutes, 'section coverage missing');
      return result;
    });

    await expectStep(rows, 'browser scan exports required report schema', async () => {
      await page.goto(`${baseUrl}/ui-interaction-audit`, { waitUntil: 'networkidle' });
      await page.locator('[data-action-id="ui-interaction.run-full-audit"]').click();
      await page.waitForTimeout(300);
      const report = await page.evaluate(async () => {
        const store = await import('/src/runtime/ui-interaction-audit-store.ts');
        return store.exportUiInteractionAuditArtifacts();
      });
      const names = report.map((artifact) => artifact.name);
      requiredArtifacts.forEach((name) => assert(names.includes(name), `${name} missing`));
      const dashboard = await page.evaluate(async () => {
        const store = await import('/src/runtime/ui-interaction-audit-store.ts');
        return store.selectUiInteractionAuditDashboard();
      });
      assert(dashboard.report.coveragePercent === 100, 'dashboard coverage not 100');
      return { artifacts: names.length, coveragePercent: dashboard.report.coveragePercent };
    });

    await expectStep(rows, 'real route scan finds no dead links or silent controls', async () => {
      const routes = await page.evaluate(async () => {
        const store = await import('/src/runtime/ui-interaction-audit-store.ts');
        return store.getUiInteractionAuditRoutes();
      });
      const scanned = [];
      for (const route of routes) scanned.push(...await scanInteractiveRoute(page, route));
      const bad = scanned
        .filter((element) => ['unwired', 'dead_link', 'error'].includes(element.status))
        .map((element) => `${element.route}:${element.label}:${element.status}:${element.actualBehavior}`);
      assert(bad.length === 0, bad.slice(0, 8).join('; '));
      const disabledWithReason = scanned.filter((element) => element.status === 'disabled_with_reason').length;
      return {
        scannedRoutes: routes.length,
        totalElements: scanned.length,
        disabledWithReason,
        deadLinks: scanned.filter((element) => element.status === 'dead_link').length,
        unwired: scanned.filter((element) => element.status === 'unwired').length,
      };
    });

    await expectStep(rows, 'no console errors from audit route actions', async () => {
      assert(consoleErrors.length === 0, consoleErrors.slice(0, 5).join('\n'));
      return { consoleErrors: consoleErrors.length };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  let auditReport;
  if (rows.every((row) => row.status === 'passed')) {
    const serverForReport = await ensureServer();
    const reportBrowser = await chromium.launch();
    const reportPage = await reportBrowser.newPage({ viewport: { width: 1440, height: 1024 } });
    await reportPage.goto(`${baseUrl}/ui-interaction-audit`, { waitUntil: 'networkidle' });
    auditReport = await reportPage.evaluate(async () => {
      const store = await import('/src/runtime/ui-interaction-audit-store.ts');
      return store.runUiInteractionAudit();
    });
    await reportBrowser.close();
    await stopServer(serverForReport);
  }
  const failed = rows.filter((row) => row.status !== 'passed');
  if (auditReport) writeJson(reportPath, auditReport);
  else writeJson(reportPath, { totalRoutes: 0, totalElements: 0, wired: 0, unwired: 1, disabledWithReason: 0, deadLinks: 0, consoleErrors: failed.length, coveragePercent: 0, routes: [] });
  console.table(rows);
  console.log(`UI interaction audit smoke summary: ${rows.length - failed.length}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
