import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const reportPath = path.join(root, 'parity-reports', 'production-billing-smoke.json');
const baseUrl = 'http://127.0.0.1:5173';

const requiredFiles = [
  'src/runtime/production-billing.ts',
  'src/runtime/production-billing-store.ts',
  'src/pages/ProductionBillingPage.tsx',
];

const expectedArtifacts = [
  'billing-summary.md',
  'subscription-status.json',
  'license-entitlements.json',
  'usage-quota-report.md',
  'billing-blockers.json',
];

const widgetRoutes = [
  '/tenant-production-binding',
  '/go-live-control',
  '/production-operations',
  '/production-support',
  '/production-compliance',
  '/production-readiness',
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

  await expectStep(rows, 'required Sprint 9O source files exist', async () => {
    const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
    assert(missing.length === 0, `missing files: ${missing.join(', ')}`);
    return { files: requiredFiles.length };
  });

  if (rows.some((row) => row.status === 'failed')) {
    writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed: 0, failed: rows.length });
    console.table(rows);
    console.log(`Production billing smoke summary: 0/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
    process.exit(1);
  }

  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1040 } });

  try {
    await page.goto(`${baseUrl}/production-billing`, { waitUntil: 'networkidle' });

    await expectStep(rows, 'route exists and billing center renders', async () => {
      const route = await page.locator('[data-route="/production-billing"]').count();
      const matrix = await page.locator('[data-production-billing-entitlements]').count();
      const buttons = await page.locator('[data-action]').count();
      assert(route === 1, 'route marker missing');
      assert(matrix === 1, 'entitlement matrix marker missing');
      assert(buttons >= 6, `expected action buttons, got ${buttons}`);
      return { route, buttons };
    });

    await expectStep(rows, 'subscription lifecycle and license gates work', async () => {
      const result = await page.evaluate(async () => {
        const store = await import('/src/runtime/production-billing-store.ts');
        store.clearProductionBillingStore();
        const trial = store.createTenantSubscription({ tenantId: 'tenant-billing-smoke', planId: 'starter', status: 'trial' });
        const active = store.activateSubscription(trial.subscriptionId);
        const warning = store.recordBillingUsage(active.tenantId, { users: 8, workspaces: 1, agents: 3, runs: 70, storageGb: 8, artifacts: 80 });
        const blocked = store.recordBillingUsage(active.tenantId, { users: 11, workspaces: 1, agents: 3, runs: 120, storageGb: 8, artifacts: 80 });
        const pastDue = store.markSubscriptionPastDue(active.subscriptionId);
        const suspended = store.suspendSubscription(pastDue.subscriptionId, 'Payment failed.');
        return {
          activeStatus: active.status,
          warningCount: warning.usageGate.warnings.length,
          blockerCount: blocked.usageGate.blockers.length,
          suspendedStatus: suspended.status,
          licenseValid: warning.licenseGate.valid,
        };
      });
      assert(result.activeStatus === 'active', `expected active subscription, got ${result.activeStatus}`);
      assert(result.warningCount >= 1, '80 percent usage warning missing');
      assert(result.blockerCount >= 1, 'quota blocker missing');
      assert(result.suspendedStatus === 'suspended', `expected suspended, got ${result.suspendedStatus}`);
      assert(result.licenseValid === true, 'active license should be valid before suspension');
      return result;
    });

    await expectStep(rows, 'tenant activation and go-live are blocked without active license', async () => {
      const result = await page.evaluate(async () => {
        const billing = await import('/src/runtime/production-billing-store.ts');
        const tenantStore = await import('/src/runtime/tenant-production-binding-store.ts');
        const goLive = await import('/src/runtime/go-live-control-store.ts');
        billing.clearProductionBillingStore();
        const subscription = billing.createTenantSubscription({ tenantId: 'tenant-blocked-billing', planId: 'growth', status: 'expired' });
        const binding = tenantStore.createTenantBinding({ environment: 'production', tenantId: subscription.tenantId, workspaceId: 'workspace-billing' });
        tenantStore.updateTenantBinding(binding.bindingId, {
          backendProfileId: 'backend-prod',
          databaseProfileId: 'database-prod',
          authProfileId: 'auth-prod',
          observabilityProfileId: 'obs-prod',
          supportProfileId: 'support-prod',
          deploymentProfileId: 'deploy-prod',
          rollbackOwner: 'Rollback Commander',
        });
        tenantStore.assignBindingOwner(binding.bindingId, 'Platform Owner');
        tenantStore.assignBindingReviewer(binding.bindingId, 'Finance Reviewer');
        tenantStore.markTenantBindingEvidenceReady(binding.bindingId);
        tenantStore.submitTenantBindingForReview(binding.bindingId);
        tenantStore.approveTenantBinding(binding.bindingId, 'Finance Reviewer');
        const activated = tenantStore.activateTenantBinding(binding.bindingId);
        const release = goLive.createReleaseCandidate({ version: '9O.0.0', commitHash: 'billing-smoke' });
        const requested = goLive.requestGoLiveApproval(release.releaseId, 'Release Captain');
        return {
          activationStatus: activated.status,
          activationBlockers: activated.blockers,
          releaseState: requested.state,
          releaseBlockers: requested.blockers.map((blocker) => blocker.reason),
        };
      });
      assert(result.activationStatus === 'blocked', `tenant activation should be blocked, got ${result.activationStatus}`);
      assert(result.activationBlockers.some((entry) => /subscription|license|billing/i.test(entry)), `billing blocker missing from tenant activation: ${result.activationBlockers.join(' | ')}`);
      assert(result.releaseBlockers.some((entry) => /subscription|license|billing/i.test(entry)), `billing blocker missing from go-live: ${result.releaseBlockers.join(' | ')}`);
      return result;
    });

    await expectStep(rows, 'plan entitlements support SLA and artifact exports operate', async () => {
      const result = await page.evaluate(async () => {
        const store = await import('/src/runtime/production-billing-store.ts');
        store.clearProductionBillingStore();
        const subscription = store.activateSubscription(store.createTenantSubscription({ tenantId: 'tenant-enterprise', planId: 'enterprise', status: 'trial' }).subscriptionId);
        store.recordBillingUsage(subscription.tenantId, { users: 72, workspaces: 6, agents: 120, runs: 8500, storageGb: 650, artifacts: 1200 });
        const dashboard = store.selectProductionBillingDashboard(subscription.tenantId);
        const artifacts = store.exportBillingUsageReport(subscription.tenantId);
        return {
          plan: dashboard.subscription?.planId,
          sla: dashboard.entitlements.supportSlaLevel,
          complianceEnabled: dashboard.entitlements.complianceFeaturesEnabled,
          artifacts: artifacts.map((artifact) => artifact.name),
          blockers: dashboard.usageGate.blockers.length,
        };
      });
      assert(result.plan === 'enterprise', `expected enterprise plan, got ${result.plan}`);
      assert(result.sla === 'enterprise', `expected enterprise SLA, got ${result.sla}`);
      assert(result.complianceEnabled === true, 'enterprise compliance features should be enabled');
      expectedArtifacts.forEach((name) => assert(result.artifacts.includes(name), `${name} missing`));
      return { plan: result.plan, sla: result.sla, artifacts: result.artifacts.length, blockers: result.blockers };
    });

    await expectStep(rows, 'compact widgets render on required routes', async () => {
      const results = [];
      for (const route of widgetRoutes) {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        const surface = route.slice(1);
        const count = await page.locator(`[data-production-billing-widget][data-production-billing-surface="${surface}"]`).count();
        results.push({ route, count });
      }
      const missing = results.filter((entry) => entry.count === 0).map((entry) => entry.route);
      assert(missing.length === 0, `missing billing widgets: ${missing.join(', ')}`);
      return { routes: results.length };
    });

    await expectStep(rows, 'visible buttons are wired and no raw secrets render', async () => {
      await page.goto(`${baseUrl}/production-billing`, { waitUntil: 'networkidle' });
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
  console.log(`Production billing smoke summary: ${passed}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
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
