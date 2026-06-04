import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/environment-readiness-smoke.json');
const requiredFiles = [
  'src/runtime/environment-readiness.ts',
  'src/runtime/environment-readiness-store.ts',
  'src/pages/EnvironmentReadinessPage.tsx',
];
const requiredArtifacts = [
  'environment-readiness-report.md',
  'environment-readiness.json',
  'secret-readiness-report.md',
  'missing-production-env.json',
  'secret-rotation-evidence.md',
  'production-config-blockers.json',
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
  await expectStep(rows, 'required Sprint 9E source files exist', async () => {
    const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
    assert(missing.length === 0, `missing files: ${missing.join(', ')}`);
    return { files: requiredFiles.length };
  });

  if (rows.some((row) => row.status === 'failed')) {
    writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed: 0, failed: rows.length });
    console.table(rows);
    console.log(`Environment readiness smoke summary: 0/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
    process.exit(1);
  }

  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  try {
    await page.goto(`${baseUrl}/environment-readiness`, { waitUntil: 'networkidle' });

    await expectStep(rows, 'environment readiness store exists', async () => {
      const state = await page.evaluate(async () => {
        const { getEnvironmentReadinessState } = await import('/src/runtime/environment-readiness-store.ts');
        return getEnvironmentReadinessState();
      });
      assert(Array.isArray(state.reports), 'reports missing');
      assert(Array.isArray(state.artifacts), 'artifacts missing');
      return { reports: state.reports.length, artifacts: state.artifacts.length };
    });

    await expectStep(rows, 'required production env matrix exists', async () => {
      const matrix = await page.evaluate(async () => {
        const { getRequiredProductionEnvMatrix } = await import('/src/runtime/environment-readiness.ts');
        return getRequiredProductionEnvMatrix();
      });
      for (const key of ['PRODUCTION_API_BASE_URL', 'PRODUCTION_AUTH_MODE', 'PRODUCTION_DATABASE_URL', 'HERMES_RUNTIME_MODE', 'SECRET_ROTATION_LAST_CHECKED_AT', 'SECRET_OWNER', 'SECRET_SCOPE']) {
        assert(matrix.some((entry) => entry.key === key), `${key} missing`);
      }
      return { variables: matrix.length };
    });

    await expectStep(rows, 'missing production variables return BLOCKED', async () => {
      const report = await page.evaluate(async () => {
        const { evaluateEnvironmentReadiness } = await import('/src/runtime/environment-readiness-store.ts');
        return evaluateEnvironmentReadiness('PRODUCTION');
      });
      assert(report.status === 'BLOCKED', `expected BLOCKED, got ${report.status}`);
      assert(report.missingRequired.length > 0, 'missing required env not detected');
      return { blockers: report.blockers.length, missing: report.missingRequired.length };
    });

    await expectStep(rows, 'local and sandbox missing production env do not crash UI', async () => {
      const reports = await page.evaluate(async () => {
        const { evaluateEnvironmentReadiness } = await import('/src/runtime/environment-readiness-store.ts');
        return [evaluateEnvironmentReadiness('LOCAL'), evaluateEnvironmentReadiness('SANDBOX')];
      });
      assert(reports.every((report) => ['READY', 'WARNING'].includes(report.status)), `fallback environments blocked: ${reports.map((report) => report.status).join(',')}`);
      return { statuses: reports.map((report) => report.status).join(',') };
    });

    await expectStep(rows, 'secrets are masked', async () => {
      const report = await page.evaluate(async () => {
        const { evaluateEnvironmentReadiness } = await import('/src/runtime/environment-readiness-store.ts');
        return evaluateEnvironmentReadiness('PRODUCTION', {
          PRODUCTION_AUTH_TOKEN_ISSUER: 'https://issuer.example.com',
          PRODUCTION_AUTH_JWKS_URL: 'https://issuer.example.com/.well-known/jwks.json',
          SECRET_OWNER: 'security-team',
        });
      });
      assert(report.variables.filter((entry) => entry.present).every((entry) => entry.maskedValue && !entry.maskedValue.includes('security-team')), 'secret/config value exposed');
      return { checked: report.variables.filter((entry) => entry.present).length };
    });

    await expectStep(rows, 'mock demo localhost production values are blocked', async () => {
      const report = await page.evaluate(async () => {
        const { evaluateEnvironmentReadiness } = await import('/src/runtime/environment-readiness-store.ts');
        return evaluateEnvironmentReadiness('PRODUCTION', {
          PRODUCTION_API_BASE_URL: 'http://localhost:3000',
          PRODUCTION_API_TIMEOUT_MS: '15000',
          PRODUCTION_AUTH_MODE: 'mock',
          PRODUCTION_AUTH_PROVIDER: 'demo-provider',
          PRODUCTION_AUTH_TOKEN_ISSUER: 'http://localhost:3000/issuer',
          PRODUCTION_AUTH_AUDIENCE: 'demo',
          PRODUCTION_AUTH_JWKS_URL: 'http://localhost:3000/jwks',
          PRODUCTION_DATABASE_URL: 'postgres://demo:demo@localhost/demo',
          PRODUCTION_DATABASE_PROVIDER: 'postgres',
          PRODUCTION_SCHEMA_VERSION: '1',
          PRODUCTION_MIGRATION_STATUS: 'up_to_date',
          HERMES_RUNTIME_MODE: 'mock',
          HERMES_SANDBOX_BASE_URL: 'http://localhost:4000',
          HERMES_SANDBOX_WORKSPACE_ID: 'demo-workspace',
          SECRET_ROTATION_LAST_CHECKED_AT: '2026-06-01T00:00:00.000Z',
          SECRET_OWNER: 'demo-owner',
          SECRET_SCOPE: 'mock',
        });
      });
      assert(report.status === 'BLOCKED', `unsafe production values should block, got ${report.status}`);
      assert(report.blockers.some((entry) => /localhost|mock|demo/i.test(entry)), 'unsafe production blocker missing');
      return { blockers: report.blockers.length };
    });

    await expectStep(rows, 'secret rotation evidence is checked', async () => {
      const report = await page.evaluate(async () => {
        const { evaluateEnvironmentReadiness } = await import('/src/runtime/environment-readiness-store.ts');
        return evaluateEnvironmentReadiness('PRODUCTION');
      });
      assert(report.rotationStatus.status === 'BLOCKED', `expected blocked rotation status, got ${report.rotationStatus.status}`);
      return { rotation: report.rotationStatus.status };
    });

    await expectStep(rows, 'pre go-live includes Environment and Secrets Readiness gate', async () => {
      const run = await page.evaluate(async () => {
        const { runFullPreGoLiveValidation } = await import('/src/runtime/pre-golive-validation-store.ts');
        return runFullPreGoLiveValidation();
      });
      assert(run.gates.some((gate) => gate.gateId === 'environment-readiness'), 'environment readiness gate missing');
      return { gates: run.gates.length, verdict: run.finalVerdict };
    });

    await expectStep(rows, 'route /environment-readiness exists', async () => {
      await page.goto(`${baseUrl}/environment-readiness`, { waitUntil: 'networkidle' });
      const route = await page.locator('[data-route="/environment-readiness"]').count();
      const rowsCount = await page.locator('[data-environment-variable-row]').count();
      const buttons = await page.locator('[data-route="/environment-readiness"] button[data-action]').count();
      assert(route === 1, 'route marker missing');
      assert(rowsCount >= 10, `expected variable rows, got ${rowsCount}`);
      assert(buttons >= 3, `expected wired buttons, got ${buttons}`);
      return { route, rows: rowsCount, buttons };
    });

    await expectStep(rows, 'selectors return stable values', async () => {
      const result = await page.evaluate(async () => {
        const selectors = await import('/src/domain/selectors.ts');
        return {
          readiness: selectors.selectEnvironmentReadiness(),
          status: selectors.selectEnvironmentReadinessStatus(),
          score: selectors.selectEnvironmentReadinessScore(),
          blockers: selectors.selectEnvironmentReadinessBlockers(),
          warnings: selectors.selectEnvironmentReadinessWarnings(),
          secrets: selectors.selectSecretReadiness(),
          secretStatus: selectors.selectSecretReadinessStatus(),
          matrix: selectors.selectRequiredProductionEnvMatrix(),
          masked: selectors.selectMaskedEnvironmentVariables(),
          gate: selectors.selectPreGoLiveEnvironmentGate(),
        };
      });
      assert(result.status === 'BLOCKED', `expected BLOCKED, got ${result.status}`);
      assert(result.secretStatus === 'BLOCKED', `expected secret BLOCKED, got ${result.secretStatus}`);
      assert(result.matrix.length >= 10, 'required matrix selector missing');
      assert(result.masked.every((entry) => entry.maskedValue !== undefined), 'masked selector missing values');
      assert(result.gate?.gateId === 'environment-readiness', 'pre go-live environment gate missing');
      return { score: result.score, blockers: result.blockers.length, warnings: result.warnings.length };
    });

    await expectStep(rows, 'compact widgets render on readiness surfaces', async () => {
      const routes = ['/pre-golive-validation', '/backend-readiness', '/database-readiness', '/auth-readiness', '/production-readiness', '/deployment-config', '/certified-sandbox-run', '/runtime-certification'];
      let widgets = 0;
      for (const route of routes) {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        widgets += await page.locator('[data-environment-readiness-widget]').count();
      }
      assert(widgets >= routes.length, `expected ${routes.length} widgets, got ${widgets}`);
      return { widgets };
    });

    await expectStep(rows, 'artifacts registered', async () => {
      const artifacts = await page.evaluate(async () => {
        const { exportEnvironmentReadinessArtifacts } = await import('/src/runtime/environment-readiness-store.ts');
        return exportEnvironmentReadinessArtifacts('PRODUCTION');
      });
      const names = artifacts.map((artifact) => artifact.name);
      for (const name of requiredArtifacts) assert(names.includes(name), `${name} missing`);
      return { artifacts: artifacts.length };
    });

    await expectStep(rows, 'all visible buttons are wired', async () => {
      await page.goto(`${baseUrl}/environment-readiness`, { waitUntil: 'networkidle' });
      const silent = await page.locator('[data-route="/environment-readiness"] button:visible').evaluateAll((buttons) => buttons.filter((button) => {
        const hasAction = button.hasAttribute('data-action');
        const reason = button.disabled ? button.getAttribute('data-disabled-reason') || button.getAttribute('title') : '';
        return button.disabled ? !reason : !hasAction;
      }).length);
      assert(silent === 0, `silent buttons=${silent}`);
      return { silentButtons: silent };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  const passed = rows.filter((row) => row.status === 'passed').length;
  const failed = rows.filter((row) => row.status === 'failed').length;
  writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed, failed });
  console.table(rows);
  console.log(`Environment readiness smoke summary: ${passed}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  writeJson(reportPath, { generatedAt: new Date().toISOString(), failed: 1, error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exit(1);
});
