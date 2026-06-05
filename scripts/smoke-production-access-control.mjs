import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const reportPath = path.join(root, 'parity-reports', 'production-access-control-smoke.json');
const baseUrl = 'http://127.0.0.1:5173';

const requiredFiles = [
  'src/runtime/production-access-control.ts',
  'src/runtime/production-access-control-store.ts',
  'src/pages/ProductionAccessControlPage.tsx',
];

const expectedArtifacts = [
  'access-control-matrix.json',
  'role-permission-report.md',
  'blocked-actions.json',
  'user-quota-report.md',
  'access-audit-log.json',
];

const widgetRoutes = [
  '/production-billing',
  '/tenant-production-binding',
  '/go-live-control',
  '/production-operations',
  '/production-support',
  '/production-compliance',
  '/production-incidents',
  '/production-readiness',
  '/production-runbook',
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
    child.stdout.pipe(fs.createWriteStream(path.join(root, 'parity-reports', 'vite-dev.out.log'), { flags: 'a' }));
    child.stderr.pipe(fs.createWriteStream(path.join(root, 'parity-reports', 'vite-dev.err.log'), { flags: 'a' }));
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

  await expectStep(rows, 'required Sprint 9P source files exist', async () => {
    const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
    assert(missing.length === 0, `missing files: ${missing.join(', ')}`);
    return { files: requiredFiles.length };
  });

  if (rows.some((row) => row.status === 'failed')) {
    writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed: 0, failed: rows.length });
    console.table(rows);
    console.log(`Production access control smoke summary: 0/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
    process.exit(1);
  }

  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1040 } });

  try {
    await page.goto(`${baseUrl}/production-access-control`, { waitUntil: 'networkidle' });

    await expectStep(rows, 'route exists and access center renders', async () => {
      const route = await page.locator('[data-route="/production-access-control"]').count();
      const roleMatrix = await page.locator('[data-production-access-role-matrix]').count();
      const permissionMatrix = await page.locator('[data-production-access-permission-matrix]').count();
      const buttons = await page.locator('[data-action]').count();
      assert(route === 1, 'route marker missing');
      assert(roleMatrix === 1, 'role matrix marker missing');
      assert(permissionMatrix === 1, 'permission matrix marker missing');
      assert(buttons >= 7, `expected access action buttons, got ${buttons}`);
      return { route, buttons };
    });

    await expectStep(rows, 'role matrix permission matrix and module access work', async () => {
      const result = await page.evaluate(async () => {
        const access = await import('/src/runtime/production-access-control-store.ts');
        const billing = await import('/src/runtime/production-billing-store.ts');
        access.clearProductionAccessControlStore();
        billing.clearProductionBillingStore();
        billing.activateSubscription(billing.createTenantSubscription({ tenantId: 'tenant-access', planId: 'growth', status: 'trial' }).subscriptionId);
        access.seedDefaultAccessUsers('tenant-access');
        const dashboard = access.selectProductionAccessControlDashboard('tenant-access');
        return {
          roles: dashboard.roles.length,
          permissions: dashboard.permissions.length,
          modules: dashboard.modules.length,
          lockedCompliance: dashboard.modules.find((entry) => entry.moduleId === 'production-compliance')?.locked,
          ownerAllowed: access.evaluateActionAccess({ actor: 'Tenant Owner', action: 'approve', moduleId: 'go-live-control', tenantId: 'tenant-access' }).allowed,
        };
      });
      assert(result.roles >= 8, `expected 8 roles, got ${result.roles}`);
      assert(result.permissions >= 11, `expected 11 permissions, got ${result.permissions}`);
      assert(result.modules >= 13, `expected 13 modules, got ${result.modules}`);
      assert(result.lockedCompliance === true, 'growth plan should lock enterprise-only compliance controls');
      assert(result.ownerAllowed === true, 'owner should approve Go-Live');
      return result;
    });

    await expectStep(rows, 'user quota warning and create-user block work', async () => {
      const result = await page.evaluate(async () => {
        const access = await import('/src/runtime/production-access-control-store.ts');
        const billing = await import('/src/runtime/production-billing-store.ts');
        access.clearProductionAccessControlStore();
        billing.clearProductionBillingStore();
        billing.activateSubscription(billing.createTenantSubscription({ tenantId: 'tenant-quota', planId: 'growth', status: 'trial' }).subscriptionId);
        access.seedDefaultAccessUsers('tenant-quota');
        for (let index = 0; index < 15; index += 1) access.inviteProductionUser({ tenantId: 'tenant-quota', name: `Quota User ${index}`, email: `quota-${index}@example.com`, role: 'viewer' });
        const warning = access.evaluateUserQuota('tenant-quota');
        for (let index = 15; index < 35; index += 1) access.inviteProductionUser({ tenantId: 'tenant-quota', name: `Quota User ${index}`, email: `quota-${index}@example.com`, role: 'viewer' });
        const blocked = access.inviteProductionUser({ tenantId: 'tenant-quota', name: 'Blocked User', email: 'blocked@example.com', role: 'viewer' });
        return {
          warningStatus: warning.status,
          warningCount: warning.warnings.length,
          blockedStatus: blocked.status,
          blockerCount: blocked.blockers.length,
        };
      });
      assert(result.warningStatus === 'warning', `expected warning quota, got ${result.warningStatus}`);
      assert(result.warningCount >= 1, 'quota warning missing');
      assert(result.blockedStatus === 'blocked', `expected blocked user invite, got ${result.blockedStatus}`);
      assert(result.blockerCount >= 1, 'blocked invite reason missing');
      return result;
    });

    await expectStep(rows, 'action guard blocks unauthorized production actions', async () => {
      const result = await page.evaluate(async () => {
        const access = await import('/src/runtime/production-access-control-store.ts');
        const billing = await import('/src/runtime/production-billing-store.ts');
        billing.activateSubscription(billing.createTenantSubscription({ tenantId: 'tenant-action', planId: 'enterprise', status: 'trial' }).subscriptionId);
        access.seedDefaultAccessUsers('tenant-action');
        const checks = [
          access.evaluateActionAccess({ actor: 'Support Agent', action: 'approve', moduleId: 'go-live-control', tenantId: 'tenant-action' }),
          access.evaluateActionAccess({ actor: 'Support Agent', action: 'configure', moduleId: 'production-billing', tenantId: 'tenant-action' }),
          access.evaluateActionAccess({ actor: 'Incident Operator', action: 'rollback', moduleId: 'production-incidents', tenantId: 'tenant-action' }),
          access.evaluateActionAccess({ actor: 'Compliance Reviewer', action: 'approve', moduleId: 'production-compliance', tenantId: 'tenant-action' }),
        ];
        return {
          blocked: checks.filter((entry) => !entry.allowed).length,
          allowed: checks.filter((entry) => entry.allowed).length,
          reasons: checks.flatMap((entry) => entry.reasons),
          auditEvents: access.selectAccessAuditLog().length,
        };
      });
      assert(result.blocked >= 2, `expected unauthorized blocks, got ${result.blocked}`);
      assert(result.allowed >= 2, `expected authorized role checks, got ${result.allowed}`);
      assert(result.reasons.some((entry) => /role|permission|module|license/i.test(entry)), 'clear blocked reason missing');
      assert(result.auditEvents >= 4, 'access audit log missing action evaluations');
      return result;
    });

    await expectStep(rows, 'access audit artifacts export', async () => {
      const result = await page.evaluate(async () => {
        const access = await import('/src/runtime/production-access-control-store.ts');
        const artifacts = access.exportAccessAuditReport();
        const dashboard = access.selectProductionAccessControlDashboard();
        return {
          artifacts: artifacts.map((artifact) => artifact.name),
          blockers: dashboard.blockedActions.length,
          users: dashboard.users.length,
        };
      });
      expectedArtifacts.forEach((name) => assert(result.artifacts.includes(name), `${name} missing`));
      return { artifacts: result.artifacts.length, blockers: result.blockers, users: result.users };
    });

    await expectStep(rows, 'compact widgets render on required routes', async () => {
      const results = [];
      for (const route of widgetRoutes) {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        const surface = route.slice(1);
        const count = await page.locator(`[data-production-access-widget][data-production-access-surface="${surface}"]`).count();
        results.push({ route, count });
      }
      const missing = results.filter((entry) => entry.count === 0).map((entry) => entry.route);
      assert(missing.length === 0, `missing access widgets: ${missing.join(', ')}`);
      return { routes: results.length };
    });

    await expectStep(rows, 'visible buttons are wired and no raw secrets render', async () => {
      await page.goto(`${baseUrl}/production-access-control`, { waitUntil: 'networkidle' });
      const buttons = await page.locator('button').evaluateAll((items) => items.map((button) => ({
        text: button.textContent?.trim(),
        disabled: button.hasAttribute('disabled'),
        reason: button.getAttribute('data-disabled-reason') ?? button.getAttribute('title'),
        action: button.getAttribute('data-action'),
      })));
      const silent = buttons.filter((button) => !button.disabled && !button.action);
      const disabledWithoutReason = buttons.filter((button) => button.disabled && !button.reason);
      const text = await page.locator('body').innerText();
      assert(silent.length === 0, `silent buttons: ${silent.map((button) => button.text).join(', ')}`);
      assert(disabledWithoutReason.length === 0, `disabled buttons without reason: ${disabledWithoutReason.map((button) => button.text).join(', ')}`);
      assert(!/sk_live_|sk_test_|api[_-]?key\s*[:=]\s*[A-Za-z0-9]{12,}/i.test(text), 'raw secret-like value rendered');
      return { buttons: buttons.length, silentButtons: silent.length };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  const failed = rows.filter((row) => row.status === 'failed');
  const passed = rows.length - failed.length;
  writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed, failed: failed.length });
  console.table(rows);
  console.log(`Production access control smoke summary: ${passed}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  writeJson(reportPath, {
    generatedAt: new Date().toISOString(),
    rows: [{ name: 'fatal', status: 'failed', error: error instanceof Error ? error.message : String(error) }],
    passed: 0,
    failed: 1,
  });
  console.error(error);
  process.exit(1);
});
