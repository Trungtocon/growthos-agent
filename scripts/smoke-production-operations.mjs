import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const reportPath = path.join(root, 'parity-reports', 'production-operations-smoke.json');
const baseUrl = 'http://127.0.0.1:5173';

const requiredFiles = [
  'src/runtime/production-operations.ts',
  'src/runtime/production-operations-store.ts',
  'src/pages/ProductionOperationsPage.tsx',
];

const requiredRoutes = [
  '/go-live-control',
  '/production-readiness',
  '/production-incidents',
  '/production-support',
  '/production-runbook',
  '/production-observability',
  '/backend-readiness',
  '/database-readiness',
  '/auth-readiness',
  '/environment-readiness',
  '/pre-golive-validation',
];

const expectedArtifacts = [
  'production-operations-snapshot.json',
  'production-operations-report.md',
  'production-action-queue.json',
  'production-escalation-summary.md',
  'rollback-readiness-review.md',
  'go-live-ops-handoff.md',
];

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectStep(rows, name, fn) {
  try {
    const details = await fn();
    rows.push({ name, status: 'passed', ...details });
  } catch (error) {
    rows.push({ name, status: 'failed', error: error instanceof Error ? error.message : String(error) });
  }
}

function waitForServer(url, timeoutMs = 15000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const response = await fetch(url);
        if (response.ok || response.status < 500) return resolve();
      } catch {
        // keep polling
      }
      if (Date.now() - started > timeoutMs) return reject(new Error(`Timed out waiting for ${url}`));
      setTimeout(tick, 250);
    };
    tick();
  });
}

async function ensureServer() {
  try {
    await waitForServer(baseUrl, 1500);
    return undefined;
  } catch {
    const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      windowsHide: true,
    });
    const out = fs.createWriteStream(path.join(root, 'parity-reports', 'vite-dev.out.log'), { flags: 'a' });
    const err = fs.createWriteStream(path.join(root, 'parity-reports', 'vite-dev.err.log'), { flags: 'a' });
    child.stdout.pipe(out);
    child.stderr.pipe(err);
    await waitForServer(baseUrl, 30000);
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

async function main() {
  const rows = [];

  await expectStep(rows, 'required Sprint 9L source files exist', async () => {
    const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
    assert(missing.length === 0, `missing files: ${missing.join(', ')}`);
    return { files: requiredFiles.length };
  });

  if (rows.some((row) => row.status === 'failed')) {
    writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed: 0, failed: rows.length });
    console.table(rows);
    console.log(`Production operations smoke summary: 0/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
    process.exit(1);
  }

  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });

  try {
    await page.goto(`${baseUrl}/production-operations`, { waitUntil: 'networkidle' });

    await expectStep(rows, 'route exists and dashboard renders', async () => {
      const route = await page.locator('[data-route="/production-operations"]').count();
      const dashboard = await page.locator('[data-production-operations-dashboard]').count();
      const buttons = await page.locator('[data-action]').count();
      assert(route === 1, 'route marker missing');
      assert(dashboard === 1, 'dashboard marker missing');
      assert(buttons >= 8, `expected action buttons, got ${buttons}`);
      return { route, buttons };
    });

    await expectStep(rows, 'action queue generates items from incidents support readiness', async () => {
      const result = await page.evaluate(async () => {
        const { clearProductionIncidentStore, createIncident } = await import('/src/runtime/production-incident-store.ts');
        const { clearProductionSupportStore, createSupportTicket, markSupportSlaBreached } = await import('/src/runtime/production-support-store.ts');
        const { clearProductionOperationsStore, createOpsSnapshot, selectProductionOpsActionQueue } = await import('/src/runtime/production-operations-store.ts');
        clearProductionIncidentStore();
        clearProductionSupportStore();
        clearProductionOperationsStore();
        createIncident({ severity: 'SEV1', customerImpact: 'Runtime outage affects customers.' });
        const ticket = createSupportTicket({ severity: 'SEV1', priority: 'critical', impactLevel: 'critical', customerName: 'Acme Enterprise' });
        markSupportSlaBreached(ticket.ticketId);
        const snapshot = createOpsSnapshot();
        return { snapshot, queue: selectProductionOpsActionQueue() };
      });
      assert(result.queue.length >= 3, `expected queue items, got ${result.queue.length}`);
      assert(result.queue.some((item) => item.type === 'support_sla'), 'support SLA queue item missing');
      assert(result.queue.some((item) => item.type === 'incident'), 'incident queue item missing');
      return { queue: result.queue.length, opsStatus: result.snapshot.overallHealth };
    });

    await expectStep(rows, 'blocker aggregation works', async () => {
      const blockers = await page.evaluate(async () => {
        const { selectProductionOpsBlockers } = await import('/src/runtime/production-operations-store.ts');
        return selectProductionOpsBlockers();
      });
      assert(blockers.length > 0, 'expected operations blockers');
      return { blockers: blockers.length };
    });

    await expectStep(rows, 'warning aggregation works', async () => {
      const warnings = await page.evaluate(async () => {
        const { selectProductionOpsWarnings } = await import('/src/runtime/production-operations-store.ts');
        return selectProductionOpsWarnings();
      });
      assert(warnings.length > 0, 'expected operations warnings');
      return { warnings: warnings.length };
    });

    await expectStep(rows, 'owner assignment and escalation action work', async () => {
      const item = await page.evaluate(async () => {
        const { assignOpsOwner, escalateOpsItem, selectProductionOpsActionQueue } = await import('/src/runtime/production-operations-store.ts');
        const first = selectProductionOpsActionQueue()[0];
        assignOpsOwner(first.id, 'Live Ops Lead');
        return escalateOpsItem(first.id, 'VP Operations');
      });
      assert(item.owner === 'Live Ops Lead', 'owner missing');
      assert(item.escalationOwner === 'VP Operations', 'escalation owner missing');
      assert(item.status === 'escalated', `expected escalated, got ${item.status}`);
      return { itemId: item.id, owner: item.owner };
    });

    await expectStep(rows, 'rollback review request works', async () => {
      const item = await page.evaluate(async () => {
        const { requestRollbackReview, selectProductionOpsActionQueue } = await import('/src/runtime/production-operations-store.ts');
        return requestRollbackReview(selectProductionOpsActionQueue()[0]?.id);
      });
      assert(item.type === 'rollback_readiness', `expected rollback_readiness, got ${item.type}`);
      return { itemId: item.id, itemStatus: item.status };
    });

    await expectStep(rows, 'Go-Live review request does not bypass blockers', async () => {
      const result = await page.evaluate(async () => {
        const { requestGoLiveReview, selectProductionOperationsDashboard } = await import('/src/runtime/production-operations-store.ts');
        const item = requestGoLiveReview();
        const dashboard = selectProductionOperationsDashboard();
        return { item, health: dashboard.overallHealth, blockers: dashboard.blockers.length };
      });
      assert(result.item.type === 'go_live_review', 'go-live review queue item missing');
      assert(result.blockers > 0, 'go-live review should not clear blockers');
      assert(result.health !== 'healthy', `expected non-healthy health, got ${result.health}`);
      return { blockers: result.blockers, health: result.health };
    });

    await expectStep(rows, 'ops snapshot exports artifacts', async () => {
      const artifacts = await page.evaluate(async () => {
        const { exportOpsPack, selectProductionOpsArtifacts } = await import('/src/runtime/production-operations-store.ts');
        const exported = exportOpsPack();
        return { exported: exported.map((artifact) => artifact.name), stored: selectProductionOpsArtifacts().map((artifact) => artifact.name) };
      });
      expectedArtifacts.forEach((name) => assert(artifacts.exported.includes(name), `${name} missing`));
      return { artifacts: artifacts.exported.length, stored: artifacts.stored.length };
    });

    await expectStep(rows, 'compact widgets appear on required routes', async () => {
      const missing = [];
      for (const route of requiredRoutes) {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        const count = await page.locator(`[data-production-operations-widget][data-production-operations-surface="${route.slice(1)}"]`).count();
        if (count < 1) missing.push(route);
      }
      assert(missing.length === 0, `missing compact widgets: ${missing.join(', ')}`);
      return { routes: requiredRoutes.length };
    });

    await expectStep(rows, 'no silent buttons', async () => {
      await page.goto(`${baseUrl}/production-operations`, { waitUntil: 'networkidle' });
      const audit = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map((button) => ({
        text: button.textContent?.trim() ?? '',
        disabled: button.hasAttribute('disabled'),
        disabledReason: button.getAttribute('data-disabled-reason') || button.getAttribute('title') || '',
        action: button.getAttribute('data-action') || '',
        readOnly: button.getAttribute('aria-readonly') === 'true',
      })));
      const silent = audit.filter((button) => !button.disabled && !button.action && !button.readOnly);
      const disabledWithoutReason = audit.filter((button) => button.disabled && !button.disabledReason);
      assert(silent.length === 0, `silent buttons: ${silent.map((item) => item.text).join(', ')}`);
      assert(disabledWithoutReason.length === 0, `disabled without reason: ${disabledWithoutReason.map((item) => item.text).join(', ')}`);
      return { buttons: audit.length, silentButtons: silent.length };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  const passed = rows.filter((row) => row.status === 'passed').length;
  const failed = rows.length - passed;
  writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed, failed });
  console.table(rows);
  console.log(`Production operations smoke summary: ${passed}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
  if (failed) process.exit(1);
}

main().catch((error) => {
  writeJson(reportPath, { generatedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exit(1);
});
