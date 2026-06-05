import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const reportPath = path.join(root, 'parity-reports', 'tenant-production-binding-smoke.json');
const baseUrl = 'http://127.0.0.1:5173';

const requiredFiles = [
  'src/runtime/tenant-production-binding.ts',
  'src/runtime/tenant-production-binding-store.ts',
  'src/pages/TenantProductionBindingPage.tsx',
];

const requiredWidgetRoutes = [
  '/production-operations',
  '/go-live-control',
  '/production-readiness',
  '/deployment-config',
  '/backend-readiness',
  '/database-readiness',
  '/auth-readiness',
  '/environment-readiness',
  '/production-config-evidence',
  '/pre-golive-validation',
];

const expectedArtifacts = [
  'tenant-production-binding.json',
  'tenant-production-binding-report.md',
  'tenant-binding-readiness.md',
  'tenant-binding-blockers.json',
  'tenant-binding-approval-record.md',
  'tenant-go-live-binding-pack.md',
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

  await expectStep(rows, 'required Sprint 9M source files exist', async () => {
    const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
    assert(missing.length === 0, `missing files: ${missing.join(', ')}`);
    return { files: requiredFiles.length };
  });

  if (rows.some((row) => row.status === 'failed')) {
    writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed: 0, failed: rows.length });
    console.table(rows);
    console.log(`Tenant production binding smoke summary: 0/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
    process.exit(1);
  }

  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1040 } });

  try {
    await page.goto(`${baseUrl}/tenant-production-binding`, { waitUntil: 'networkidle' });

    await expectStep(rows, 'route exists and page renders actionable settings', async () => {
      const route = await page.locator('[data-route="/tenant-production-binding"]').count();
      const matrix = await page.locator('[data-tenant-profile-matrix]').count();
      const buttons = await page.locator('[data-action]').count();
      assert(route === 1, 'tenant production binding route marker missing');
      assert(matrix === 1, 'environment profile matrix missing');
      assert(buttons >= 8, `expected action buttons, got ${buttons}`);
      return { route, buttons };
    });

    await expectStep(rows, 'create update owner reviewer and review lifecycle work', async () => {
      const result = await page.evaluate(async () => {
        const store = await import('/src/runtime/tenant-production-binding-store.ts');
        store.clearTenantProductionBindingStore();
        const created = store.createTenantBinding({ environment: 'production', tenantId: 'tenant-acme', workspaceId: 'workspace-growthos' });
        store.updateTenantBinding(created.bindingId, {
          backendProfileId: 'backend-prod',
          databaseProfileId: 'database-prod',
          authProfileId: 'auth-prod',
        });
        store.assignBindingOwner(created.bindingId, 'Platform Owner');
        store.assignBindingReviewer(created.bindingId, 'Security Reviewer');
        const submitted = store.submitTenantBindingForReview(created.bindingId);
        const approved = store.approveTenantBinding(created.bindingId, 'Security Reviewer');
        const rejected = store.rejectTenantBinding(created.bindingId, 'negative lifecycle check');
        return {
          submitted: submitted.status,
          approved: approved.status,
          rejected: rejected.status,
          owner: rejected.owner,
          reviewer: rejected.reviewer,
          review: store.selectTenantBindingReviewState(created.bindingId),
        };
      });
      assert(result.submitted === 'ready_for_review', `expected ready_for_review, got ${result.submitted}`);
      assert(result.approved === 'approved', `expected approved, got ${result.approved}`);
      assert(result.rejected === 'blocked', `expected blocked after reject, got ${result.rejected}`);
      assert(result.owner === 'Platform Owner', 'owner assignment missing');
      assert(result.reviewer === 'Security Reviewer', 'reviewer assignment missing');
      assert(result.review.approvalStatus === 'rejected', `expected rejected review state, got ${result.review.approvalStatus}`);
      return result;
    });

    await expectStep(rows, 'activation blocks missing production evidence', async () => {
      const result = await page.evaluate(async () => {
        const store = await import('/src/runtime/tenant-production-binding-store.ts');
        store.clearTenantProductionBindingStore();
        const binding = store.createTenantBinding({ environment: 'production' });
        store.assignBindingOwner(binding.bindingId, 'Platform Owner');
        store.assignBindingReviewer(binding.bindingId, 'Security Reviewer');
        store.submitTenantBindingForReview(binding.bindingId);
        store.approveTenantBinding(binding.bindingId, 'Security Reviewer');
        const activation = store.activateTenantBinding(binding.bindingId);
        return {
          status: activation.status,
          active: store.selectActiveTenantProductionBinding(),
          blockers: store.selectTenantBindingBlockers(binding.bindingId),
          readiness: store.selectTenantBindingReadiness(binding.bindingId),
        };
      });
      assert(result.status === 'blocked', `expected blocked activation, got ${result.status}`);
      assert(!result.active, 'binding with missing evidence should not become active');
      assert(result.blockers.length >= 5, `expected multiple blockers, got ${result.blockers.length}`);
      assert(result.readiness.status === 'blocked', `expected blocked readiness, got ${result.readiness.status}`);
      return { blockers: result.blockers.length, score: result.readiness.score };
    });

    await expectStep(rows, 'activation succeeds only after profiles evidence and approval', async () => {
      const result = await page.evaluate(async () => {
        const store = await import('/src/runtime/tenant-production-binding-store.ts');
        store.clearTenantProductionBindingStore();
        const binding = store.createTenantBinding({ environment: 'production', tenantId: 'tenant-uikigai', workspaceId: 'workspace-production' });
        store.updateTenantBinding(binding.bindingId, {
          backendProfileId: 'backend-prod',
          databaseProfileId: 'database-prod',
          authProfileId: 'auth-prod',
          observabilityProfileId: 'obs-prod',
          supportProfileId: 'support-prod',
          deploymentProfileId: 'deploy-prod',
          rollbackOwner: 'Rollback Commander',
        });
        store.assignBindingOwner(binding.bindingId, 'Platform Owner');
        store.assignBindingReviewer(binding.bindingId, 'Security Reviewer');
        store.markTenantBindingEvidenceReady(binding.bindingId);
        store.submitTenantBindingForReview(binding.bindingId);
        store.approveTenantBinding(binding.bindingId, 'Security Reviewer');
        const activation = store.activateTenantBinding(binding.bindingId);
        return {
          activation,
          active: store.selectActiveTenantProductionBinding(),
          blockers: store.selectTenantBindingBlockers(binding.bindingId),
          warnings: store.selectTenantBindingWarnings(binding.bindingId),
          summary: store.selectTenantBindingCompactSummary(),
        };
      });
      assert(result.activation.status === 'active', `expected active binding, got ${result.activation.status}`);
      assert(result.active?.bindingId === result.activation.bindingId, 'active binding selector mismatch');
      assert(result.blockers.length === 0, `expected no blockers, got ${result.blockers.length}`);
      assert(result.summary.status === 'active', `expected compact active, got ${result.summary.status}`);
      return { bindingId: result.activation.bindingId, warnings: result.warnings.length };
    });

    await expectStep(rows, 'Pre-Go-Live validation reads tenant binding gate', async () => {
      const result = await page.evaluate(async () => {
        const pre = await import('/src/runtime/pre-golive-validation-store.ts');
        const run = pre.runFullPreGoLiveValidation();
        const gate = run.gates.find((entry) => entry.gateId === 'tenant-production-binding');
        return { verdict: run.verdict, gate };
      });
      assert(result.gate, 'tenant-production-binding gate missing from Pre-Go-Live validation');
      assert(result.gate.status === 'pass', `expected pass after active binding, got ${result.gate.status}`);
      assert(result.gate.evidence.some((entry) => entry.includes('active')), 'active binding evidence missing');
      return { gateStatus: result.gate.status, verdict: result.verdict };
    });

    await expectStep(rows, 'Go-Live Control reads tenant binding status', async () => {
      const result = await page.evaluate(async () => {
        const goLive = await import('/src/runtime/go-live-control-store.ts');
        const release = goLive.createReleaseCandidate('Tenant binding smoke release');
        const refreshed = goLive.refreshReadiness(release.id);
        const gate = refreshed.readinessMatrix.find((entry) => entry.gateId === 'tenant-production-binding');
        return { verdict: refreshed.finalVerdict, gate };
      });
      assert(result.gate, 'tenant-production-binding gate missing from Go-Live Control');
      assert(result.gate.status === 'verified', `expected verified gate, got ${result.gate.status}`);
      return { gateStatus: result.gate.status, verdict: result.verdict };
    });

    await expectStep(rows, 'tenant binding exports register artifacts', async () => {
      const result = await page.evaluate(async () => {
        const store = await import('/src/runtime/tenant-production-binding-store.ts');
        const artifacts = store.exportTenantBindingPack();
        return {
          exported: artifacts.map((artifact) => artifact.name),
          stored: store.selectTenantBindingArtifacts().map((artifact) => artifact.name),
        };
      });
      expectedArtifacts.forEach((name) => assert(result.exported.includes(name), `${name} export missing`));
      assert(result.stored.length >= expectedArtifacts.length, 'stored tenant binding artifacts missing');
      return { artifacts: result.exported.length };
    });

    await expectStep(rows, 'compact widgets render on required routes', async () => {
      const results = [];
      for (const route of requiredWidgetRoutes) {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        const surface = route.slice(1);
        const count = await page.locator(`[data-tenant-production-binding-widget][data-tenant-production-binding-surface="${surface}"]`).count();
        results.push({ route, count });
      }
      const missing = results.filter((entry) => entry.count === 0).map((entry) => entry.route);
      assert(missing.length === 0, `missing compact widgets: ${missing.join(', ')}`);
      return { routes: results.length };
    });

    await expectStep(rows, 'no silent buttons and no raw secrets on tenant binding page', async () => {
      await page.goto(`${baseUrl}/tenant-production-binding`, { waitUntil: 'networkidle' });
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
      return { buttons: buttons.length };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  const failed = rows.filter((row) => row.status === 'failed');
  const passed = rows.length - failed.length;
  writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed, failed: failed.length });
  console.table(rows);
  console.log(`Tenant production binding smoke summary: ${passed}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
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
