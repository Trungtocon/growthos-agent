import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/auth-readiness-smoke.json');

const requiredFiles = [
  'src/runtime/auth-readiness.ts',
  'src/runtime/auth-readiness-store.ts',
  'src/pages/AuthReadinessPage.tsx',
];

const requiredArtifactNames = [
  'auth-readiness-report.md',
  'auth-readiness.json',
  'session-lifecycle-report.md',
  'token-validation-report.md',
  'rbac-binding-report.md',
  'tenant-workspace-binding-report.md',
  'auth-blockers.json',
];

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
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

async function main() {
  const rows = [];

  await expectStep(rows, 'required Sprint 9D source files exist', async () => {
    const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
    assert(missing.length === 0, `missing files: ${missing.join(', ')}`);
    return { files: requiredFiles.length };
  });

  if (rows.some((row) => row.status === 'failed')) {
    const report = { generatedAt: new Date().toISOString(), rows, passed: 0, failed: rows.length };
    writeJson(reportPath, report);
    console.table(rows);
    console.log(`Auth readiness smoke summary: 0/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
    process.exit(1);
  }

  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  try {
    await page.goto(`${baseUrl}/auth-readiness`, { waitUntil: 'networkidle' });

    await expectStep(rows, 'auth readiness store exists', async () => {
      const state = await page.evaluate(async () => {
        const { getAuthReadinessState } = await import('/src/runtime/auth-readiness-store.ts');
        return getAuthReadinessState();
      });
      assert(Array.isArray(state.snapshots), 'snapshots state missing');
      assert(Array.isArray(state.artifacts), 'artifacts state missing');
      return { snapshots: state.snapshots.length, artifacts: state.artifacts.length };
    });

    await expectStep(rows, 'auth readiness evaluator exists', async () => {
      const report = await page.evaluate(async () => {
        const { evaluateAuthReadiness } = await import('/src/runtime/auth-readiness-store.ts');
        return evaluateAuthReadiness('PRODUCTION');
      });
      assert(['READY', 'WARNING', 'BLOCKED'].includes(report.status), `unexpected status ${report.status}`);
      assert(typeof report.readinessScore === 'number', 'readiness score missing');
      return { status: report.status, score: report.readinessScore };
    });

    await expectStep(rows, 'mock/local auth does not crash UI', async () => {
      const local = await page.evaluate(async () => {
        const { evaluateAuthReadiness } = await import('/src/runtime/auth-readiness-store.ts');
        return evaluateAuthReadiness('LOCAL');
      });
      assert(['READY', 'WARNING'].includes(local.status), `local auth should not block UI, got ${local.status}`);
      return { status: local.status, warnings: local.warnings.length };
    });

    await expectStep(rows, 'production auth without config returns BLOCKED', async () => {
      const report = await page.evaluate(async () => {
        const { evaluateAuthReadiness } = await import('/src/runtime/auth-readiness-store.ts');
        return evaluateAuthReadiness('PRODUCTION');
      });
      assert(report.status === 'BLOCKED', `expected BLOCKED, got ${report.status}`);
      assert(report.blockers.some((item) => item.toLowerCase().includes('auth')), 'auth config blocker missing');
      return { blockers: report.blockers.length };
    });

    await expectStep(rows, 'missing RBAC binding returns BLOCKED', async () => {
      const report = await page.evaluate(async () => {
        const { evaluateAuthReadiness } = await import('/src/runtime/auth-readiness-store.ts');
        return evaluateAuthReadiness('PRODUCTION');
      });
      assert(report.rbacBinding.status === 'blocked', `expected blocked RBAC binding, got ${report.rbacBinding.status}`);
      return { status: report.rbacBinding.status, reason: report.rbacBinding.reason };
    });

    await expectStep(rows, 'missing tenant/workspace binding returns BLOCKED', async () => {
      const report = await page.evaluate(async () => {
        const { evaluateAuthReadiness } = await import('/src/runtime/auth-readiness-store.ts');
        return evaluateAuthReadiness('PRODUCTION');
      });
      assert(report.tenantWorkspaceBinding.status === 'blocked', `expected blocked tenant/workspace binding, got ${report.tenantWorkspaceBinding.status}`);
      return { status: report.tenantWorkspaceBinding.status, reason: report.tenantWorkspaceBinding.reason };
    });

    await expectStep(rows, 'session lifecycle and token status evaluated', async () => {
      const report = await page.evaluate(async () => {
        const { evaluateAuthReadiness } = await import('/src/runtime/auth-readiness-store.ts');
        return evaluateAuthReadiness('PRODUCTION');
      });
      assert(report.sessionLifecycle.status, 'session lifecycle status missing');
      assert(report.tokenValidation.status, 'token validation status missing');
      return { session: report.sessionLifecycle.status, token: report.tokenValidation.status };
    });

    await expectStep(rows, 'pre go-live has Auth and Session Readiness gate', async () => {
      const run = await page.evaluate(async () => {
        const { runFullPreGoLiveValidation } = await import('/src/runtime/pre-golive-validation-store.ts');
        return runFullPreGoLiveValidation();
      });
      assert(run.gates.some((gate) => gate.gateId === 'auth-readiness'), 'Auth and Session Readiness gate missing');
      assert(run.finalVerdict === 'BLOCKED', `expected BLOCKED final verdict, got ${run.finalVerdict}`);
      return { gates: run.gates.length, verdict: run.finalVerdict };
    });

    await expectStep(rows, 'route /auth-readiness exists', async () => {
      await page.goto(`${baseUrl}/auth-readiness`, { waitUntil: 'networkidle' });
      const route = await page.locator('[data-route="/auth-readiness"]').count();
      const cards = await page.locator('[data-auth-readiness-card]').count();
      const buttons = await page.locator('[data-route="/auth-readiness"] button[data-action]').count();
      assert(route === 1, 'auth readiness route marker missing');
      assert(cards >= 4, `expected auth readiness cards, got ${cards}`);
      assert(buttons >= 3, `expected wired action buttons, got ${buttons}`);
      return { route, cards, buttons };
    });

    await expectStep(rows, 'selectors work', async () => {
      const selectors = await page.evaluate(async () => {
        const selectorsModule = await import('/src/domain/selectors.ts');
        return {
          readiness: selectorsModule.selectAuthReadiness(),
          status: selectorsModule.selectAuthReadinessStatus(),
          score: selectorsModule.selectAuthReadinessScore(),
          blockers: selectorsModule.selectAuthBlockers(),
          warnings: selectorsModule.selectAuthWarnings(),
          session: selectorsModule.selectSessionLifecycleStatus(),
          token: selectorsModule.selectTokenValidationStatus(),
          rbac: selectorsModule.selectRbacBindingStatus(),
          tenant: selectorsModule.selectTenantWorkspaceBindingStatus(),
          gate: selectorsModule.selectPreGoLiveAuthGate(),
        };
      });
      assert(selectors.status === 'BLOCKED', `expected BLOCKED status, got ${selectors.status}`);
      assert(selectors.blockers.length >= 1, 'auth blockers selector missing');
      assert(selectors.session.status, 'session selector missing');
      assert(selectors.token.status, 'token selector missing');
      assert(selectors.rbac.status === 'blocked', 'rbac selector should be blocked');
      assert(selectors.tenant.status === 'blocked', 'tenant/workspace selector should be blocked');
      assert(selectors.gate?.gateId === 'auth-readiness', 'pre go-live auth gate selector missing');
      return { score: selectors.score, blockers: selectors.blockers.length, warnings: selectors.warnings.length };
    });

    await expectStep(rows, 'artifact exports registered', async () => {
      const artifacts = await page.evaluate(async () => {
        const { exportAuthReadinessArtifacts } = await import('/src/runtime/auth-readiness-store.ts');
        return exportAuthReadinessArtifacts('PRODUCTION');
      });
      const names = artifacts.map((artifact) => artifact.name);
      for (const name of requiredArtifactNames) assert(names.includes(name), `${name} missing`);
      return { artifacts: artifacts.length };
    });

    await expectStep(rows, 'visible buttons wired', async () => {
      await page.goto(`${baseUrl}/auth-readiness`, { waitUntil: 'networkidle' });
      const silentButtons = await page.locator('[data-route="/auth-readiness"] button:visible').evaluateAll((buttons) => buttons.filter((button) => {
        const text = button.textContent?.trim();
        const hasHandlerHint = button.hasAttribute('data-action');
        const reason = button.disabled ? button.getAttribute('data-disabled-reason') || button.getAttribute('title') : '';
        return button.disabled ? !reason : !text || !hasHandlerHint;
      }).length);
      assert(silentButtons === 0, `silent buttons=${silentButtons}`);
      return { silentButtons };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  const passed = rows.filter((row) => row.status === 'passed').length;
  const failed = rows.filter((row) => row.status === 'failed').length;
  writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed, failed });
  console.table(rows);
  console.log(`Auth readiness smoke summary: ${passed}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  writeJson(reportPath, { generatedAt: new Date().toISOString(), failed: 1, error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exit(1);
});
