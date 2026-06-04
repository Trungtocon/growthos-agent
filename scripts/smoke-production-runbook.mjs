import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const reportPath = path.join(root, 'parity-reports', 'production-runbook-smoke.json');
const baseUrl = 'http://127.0.0.1:5173';

const requiredFiles = [
  'src/runtime/production-runbook.ts',
  'src/runtime/production-runbook-store.ts',
  'src/pages/ProductionRunbookPage.tsx',
];

const expectedArtifacts = [
  'production-runbook.md',
  'operator-handoff-pack.md',
  'incident-response-runbook.md',
  'rollback-procedure.md',
  'support-escalation-matrix.md',
  'post-release-monitoring-checklist.md',
  'go-live-operator-summary.md',
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

  await expectStep(rows, 'required Sprint 9I source files exist', async () => {
    const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
    assert(missing.length === 0, `missing files: ${missing.join(', ')}`);
    return { files: requiredFiles.length };
  });

  if (rows.some((row) => row.status === 'failed')) {
    writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed: 0, failed: rows.length });
    console.table(rows);
    console.log(`Production runbook smoke summary: 0/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
    process.exit(1);
  }

  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });

  try {
    await page.goto(`${baseUrl}/production-runbook`, { waitUntil: 'networkidle' });

    await expectStep(rows, 'default runbook is incomplete', async () => {
      const dashboard = await page.evaluate(async () => {
        const { clearProductionRunbookStore, createRunbook, selectProductionRunbook } = await import('/src/runtime/production-runbook-store.ts');
        clearProductionRunbookStore();
        createRunbook({ releaseId: 'release-smoke-default' });
        return selectProductionRunbook();
      });
      assert(dashboard.runbookStatus === 'incomplete', `expected incomplete, got ${dashboard.runbookStatus}`);
      assert(dashboard.handoffStatus === 'pending', `expected pending handoff, got ${dashboard.handoffStatus}`);
      return { runbookStatus: dashboard.runbookStatus, blockers: dashboard.blockers.length };
    });

    await expectStep(rows, 'missing operator owner blocks readiness', async () => {
      const blockers = await page.evaluate(async () => {
        const { selectRunbookBlockers } = await import('/src/domain/selectors.ts');
        return selectRunbookBlockers();
      });
      assert(blockers.some((entry) => /operator/i.test(entry.reason)), 'operator blocker missing');
      return { blockers: blockers.length };
    });

    await expectStep(rows, 'missing rollback procedure blocks readiness', async () => {
      const blockers = await page.evaluate(async () => {
        const { selectRunbookBlockers } = await import('/src/domain/selectors.ts');
        return selectRunbookBlockers();
      });
      assert(blockers.some((entry) => /rollback/i.test(entry.reason)), 'rollback blocker missing');
      return { blockers: blockers.length };
    });

    await expectStep(rows, 'missing monitoring checklist blocks readiness', async () => {
      const blockers = await page.evaluate(async () => {
        const { selectRunbookBlockers } = await import('/src/domain/selectors.ts');
        return selectRunbookBlockers();
      });
      assert(blockers.some((entry) => /monitoring/i.test(entry.reason)), 'monitoring blocker missing');
      return { blockers: blockers.length };
    });

    await expectStep(rows, 'missing escalation owner blocks readiness', async () => {
      const blockers = await page.evaluate(async () => {
        const { selectRunbookBlockers } = await import('/src/domain/selectors.ts');
        return selectRunbookBlockers();
      });
      assert(blockers.some((entry) => /escalation/i.test(entry.reason)), 'escalation blocker missing');
      return { blockers: blockers.length };
    });

    await expectStep(rows, 'completed checklist changes status to ready', async () => {
      const dashboard = await page.evaluate(async () => {
        const { createRunbook, completeRunbookChecklist, markRunbookReady, selectProductionRunbook } = await import('/src/runtime/production-runbook-store.ts');
        const runbook = createRunbook({
          releaseId: 'release-smoke-ready',
          operatorOwner: 'Release Operator',
          escalationOwner: 'SRE Lead',
          incidentOwner: 'Incident Commander',
          supportWindow: { start: '2026-06-06T02:00:00.000Z', end: '2026-06-06T08:00:00.000Z', timezone: 'Asia/Saigon' },
        });
        completeRunbookChecklist(runbook.runbookId);
        markRunbookReady(runbook.runbookId);
        return selectProductionRunbook(runbook.runbookId);
      });
      assert(dashboard.runbookStatus === 'ready', `expected ready, got ${dashboard.runbookStatus}`);
      assert(dashboard.blockers.length === 0, `expected no blockers, got ${dashboard.blockers.length}`);
      return { runbookStatus: dashboard.runbookStatus, completion: dashboard.checklistCompletion };
    });

    await expectStep(rows, 'approved runbook can be accepted by operator', async () => {
      const dashboard = await page.evaluate(async () => {
        const { approveRunbook, acceptOperatorHandoff, selectProductionRunbook } = await import('/src/runtime/production-runbook-store.ts');
        const approved = approveRunbook(undefined, 'VP Operations');
        acceptOperatorHandoff(approved.runbookId, 'Release Operator');
        return selectProductionRunbook(approved.runbookId);
      });
      assert(dashboard.runbookStatus === 'approved', `expected approved, got ${dashboard.runbookStatus}`);
      assert(dashboard.handoffStatus === 'accepted', `expected accepted, got ${dashboard.handoffStatus}`);
      return { runbookStatus: dashboard.runbookStatus, handoffStatus: dashboard.handoffStatus };
    });

    await expectStep(rows, 'accepted handoff feeds Go-Live Control', async () => {
      const control = await page.evaluate(async () => {
        const { createReleaseCandidate, refreshReadiness, selectGoLiveControl } = await import('/src/runtime/go-live-control-store.ts');
        createReleaseCandidate({ version: '9I.0.0', commitHash: 'runbook-smoke' });
        refreshReadiness();
        return selectGoLiveControl();
      });
      assert(control.readinessMatrix.some((gate) => gate.gateId === 'production-runbook'), 'production-runbook gate missing');
      assert(!control.blockers.some((entry) => entry.gateId === 'production-runbook'), 'production-runbook should not block after accepted handoff');
      return { gates: control.readinessMatrix.length, blockers: control.blockerCount };
    });

    await expectStep(rows, 'artifacts are registered', async () => {
      const artifacts = await page.evaluate(async () => {
        const { exportRunbookPack } = await import('/src/runtime/production-runbook-store.ts');
        return exportRunbookPack().map((artifact) => artifact.name);
      });
      expectedArtifacts.forEach((name) => assert(artifacts.includes(name), `${name} missing`));
      return { artifacts: artifacts.length };
    });

    await expectStep(rows, 'route /production-runbook exists', async () => {
      await page.goto(`${baseUrl}/production-runbook`, { waitUntil: 'networkidle' });
      const route = await page.locator('[data-route="/production-runbook"]').count();
      const buttons = await page.locator('[data-action]').count();
      assert(route === 1, 'route marker missing');
      assert(buttons >= 9, `expected action buttons, got ${buttons}`);
      return { route, buttons };
    });

    await expectStep(rows, 'all visible buttons are wired', async () => {
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

    await expectStep(rows, 'no silent buttons', async () => {
      const silentButtons = await page.locator('button:not([data-action]):not([aria-readonly="true"]):not(:disabled)').count();
      assert(silentButtons === 0, `silent buttons present: ${silentButtons}`);
      return { silentButtons };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  const passed = rows.filter((row) => row.status === 'passed').length;
  const failed = rows.length - passed;
  writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed, failed });
  console.table(rows);
  console.log(`Production runbook smoke summary: ${passed}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
  if (failed) process.exit(1);
}

main().catch((error) => {
  writeJson(reportPath, { generatedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exit(1);
});
