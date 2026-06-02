import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/backend-adapter-smoke.json');

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

async function reset(page) {
  await page.evaluate(() => window.sessionStorage.clear());
}

async function createProductionBackendEvidence(page) {
  return page.evaluate(async () => {
    const { createCertificationProfile, runAllContractTests, startCertificationRun, certifyRuntime } = await import('/src/runtime/runtime-certification-store.ts');
    const { createCertifiedSandboxRun, startCertifiedSandboxRun, completeCertifiedSandboxRun } = await import('/src/runtime/certified-sandbox-run-store.ts');
    const { createProductionReadinessCheck, evaluateProductionReadiness } = await import('/src/runtime/production-readiness-store.ts');
    const { createDeploymentConfigCheck, validateDeploymentConfig, markDeploymentConfigReady } = await import('/src/runtime/deployment-config-store.ts');
    const profile = createCertificationProfile({
      name: 'Backend adapter certified profile',
      runtimeMode: 'sandbox',
      sandboxBaseUrl: 'https://sandbox.hermes.local',
      apiKeyPresent: true,
      workspaceIdPresent: true,
    });
    const certification = startCertificationRun(profile.id);
    runAllContractTests(certification.id);
    certifyRuntime(certification.id);
    const sandbox = createCertifiedSandboxRun({
      certificationRunId: certification.id,
      runtimeMode: 'sandbox',
      sandboxBaseUrl: 'https://sandbox.hermes.local',
      sandboxHealth: 'online',
    });
    startCertifiedSandboxRun(sandbox.id);
    completeCertifiedSandboxRun(sandbox.id);
    evaluateProductionReadiness(createProductionReadinessCheck().id);
    const deployment = validateDeploymentConfig(createDeploymentConfigCheck({
      runtimeMode: 'production',
      env: {
        APP_ENV: 'production',
        APP_BASE_URL: 'https://growthos.example.com',
        HERMES_RUNTIME_MODE: 'production',
        HERMES_PRODUCTION_BASE_URL: 'https://hermes.example.com',
        HERMES_PRODUCTION_API_KEY: 'present',
        PAPERCLIP_BASE_URL: 'https://paperclip.example.com',
        PAPERCLIP_API_KEY: 'present',
        GROWTHOS_WORKSPACE_ID: 'workspace-demo',
        AUTH_SECRET: 'present',
        STORAGE_DRIVER: 's3',
        LOG_LEVEL: 'info',
        BILLING_PROVIDER: 'stripe',
        DEPLOYMENT_TARGET: 'vercel-production',
      },
    }).id);
    return markDeploymentConfigReady(deployment.id);
  });
}

async function main() {
  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  const rows = [];
  try {
    await page.goto(`${baseUrl}/backend-adapter`, { waitUntil: 'networkidle' });
    await reset(page);

    await expectStep(rows, 'route renders backend adapter control page', async () => {
      await page.goto(`${baseUrl}/backend-adapter`, { waitUntil: 'networkidle' });
      const route = await page.locator('[data-backend-adapter-route]').count();
      const matrix = await page.locator('[data-backend-endpoint-row]').count();
      assert(route === 1, 'backend adapter route did not render');
      assert(matrix >= 7, `expected endpoint matrix, got ${matrix}`);
      return { route, matrix };
    });

    await expectStep(rows, 'default mode remains mock', async () => {
      const state = await page.evaluate(async () => {
        const { getBackendAdapterState } = await import('/src/runtime/backend-adapter-store.ts');
        return getBackendAdapterState();
      });
      assert(state.mode === 'mock', `expected mock, got ${state.mode}`);
      assert(state.health.status === 'missing_config' || state.health.status === 'degraded', `unexpected health ${state.health.status}`);
      return { mode: state.mode, health: state.health.status };
    });

    await expectStep(rows, 'missing config blocks production backend calls', async () => {
      const result = await page.evaluate(async () => {
        const { callRuntimeEndpoint } = await import('/src/runtime/backend-adapter-store.ts');
        return callRuntimeEndpoint({ mode: 'production', path: '/runtime/start', payload: { id: 'demo' } });
      });
      assert(result.status === 'blocked_by_deployment_config', `expected deployment block, got ${result.status}`);
      assert(result.error?.message.includes('Deployment Config'), 'deployment block reason missing');
      return { status: result.status };
    });

    await expectStep(rows, 'sandbox mode can test sandbox endpoints', async () => {
      const result = await page.evaluate(async () => {
        const { checkBackendHealth, callHermesEndpoint } = await import('/src/runtime/backend-adapter-store.ts');
        const health = await checkBackendHealth({ mode: 'sandbox' });
        const hermes = await callHermesEndpoint({ mode: 'sandbox', path: '/health', payload: { ping: true } });
        return { health, hermes };
      });
      assert(['online', 'degraded'].includes(result.health.status), `unexpected sandbox health ${result.health.status}`);
      assert(['online', 'degraded'].includes(result.hermes.status), `unexpected hermes result ${result.hermes.status}`);
      return { health: result.health.status, request: result.hermes.status };
    });

    await expectStep(rows, 'production mode requires all readiness gates', async () => {
      await createProductionBackendEvidence(page);
      const result = await page.evaluate(async () => {
        const { checkBackendHealth, callRuntimeEndpoint } = await import('/src/runtime/backend-adapter-store.ts');
        const health = await checkBackendHealth({ mode: 'production' });
        const runtime = await callRuntimeEndpoint({ mode: 'production', path: '/runtime/start', payload: { id: 'demo' } });
        return { health, runtime };
      });
      assert(result.health.status === 'online', `expected production online, got ${result.health.status}`);
      assert(result.runtime.status === 'online', `expected runtime online, got ${result.runtime.status}`);
      return { health: result.health.status, request: result.runtime.status };
    });

    await expectStep(rows, 'auth failure is normalized and does not crash', async () => {
      const result = await page.evaluate(async () => {
        const { validateBackendAuth } = await import('/src/runtime/backend-adapter-store.ts');
        return validateBackendAuth({ mode: 'production', authToken: 'fail-auth' });
      });
      assert(result.status === 'auth_failed', `expected auth_failed, got ${result.status}`);
      assert(result.error?.message.includes('Authentication'), 'readable auth error missing');
      return { status: result.status, message: result.error.message };
    });

    await expectStep(rows, 'backend errors normalize into readable messages', async () => {
      const result = await page.evaluate(async () => {
        const { callArtifactEndpoint } = await import('/src/runtime/backend-adapter-store.ts');
        return callArtifactEndpoint({ mode: 'sandbox', path: '/artifact/fail', payload: { fail: true } });
      });
      assert(result.status === 'degraded', `expected degraded error normalization, got ${result.status}`);
      assert(result.error?.normalized === true, 'error was not normalized');
      return { status: result.status, error: result.error.message };
    });

    await expectStep(rows, 'exports register backend adapter artifacts', async () => {
      const artifacts = await page.evaluate(async () => {
        const { exportBackendAdapterReport } = await import('/src/runtime/backend-adapter-store.ts');
        return exportBackendAdapterReport();
      });
      const names = artifacts.map((item) => item.name);
      for (const name of ['backend-adapter-report.md', 'backend-health.json', 'backend-endpoint-matrix.json', 'backend-error-report.md', 'backend-auth-check.json']) {
        assert(names.includes(name), `${name} export missing`);
      }
      return { artifacts: artifacts.length };
    });

    await expectStep(rows, 'selectors and compact widgets expose backend state', async () => {
      const selectorState = await page.evaluate(async () => {
        const {
          selectBackendAdapterState,
          selectBackendHealth,
          selectBackendAuthStatus,
          selectBackendMode,
          selectBackendEndpointMatrix,
          selectBackendBlockers,
          selectBackendWarnings,
          selectBackendLastRequest,
          selectBackendArtifacts,
        } = await import('/src/domain/selectors.ts');
        return {
          state: selectBackendAdapterState(),
          health: selectBackendHealth(),
          auth: selectBackendAuthStatus(),
          mode: selectBackendMode(),
          matrix: selectBackendEndpointMatrix(),
          blockers: selectBackendBlockers(),
          warnings: selectBackendWarnings(),
          lastRequest: selectBackendLastRequest(),
          artifacts: selectBackendArtifacts(),
        };
      });
      assert(selectorState.state, 'state selector missing');
      assert(selectorState.matrix.length >= 7, 'endpoint matrix selector missing');
      assert(selectorState.lastRequest, 'last request selector missing');
      await page.goto(`${baseUrl}/deployment-config`, { waitUntil: 'networkidle' });
      assert(await page.locator('[data-backend-adapter-widget="deployment-config"]').count() === 1, 'deployment config widget missing');
      await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
      assert(await page.locator('[data-backend-adapter-widget="run"]').count() === 1, 'run widget missing');
      return { mode: selectorState.mode, matrix: selectorState.matrix.length, artifacts: selectorState.artifacts.length };
    });

    await expectStep(rows, 'route buttons create visible state and no silent buttons', async () => {
      await page.goto(`${baseUrl}/backend-adapter`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Check health/i }).click();
      await page.getByRole('button', { name: /Validate auth/i }).click();
      await page.getByRole('button', { name: /Test sandbox request/i }).click();
      await page.getByRole('button', { name: /Export backend report/i }).click();
      const status = await page.locator('[data-backend-health-status]').first().textContent();
      assert(status && status.length > 0, 'health status not visible after actions');
      const result = await page.evaluate(() => {
        const silent = [];
        const disabledWithoutReason = [];
        for (const button of Array.from(document.querySelectorAll('button'))) {
          const propsKey = Object.keys(button).find((key) => key.startsWith('__reactProps$'));
          const reactProps = propsKey ? button[propsKey] : undefined;
          if (button.disabled && !button.dataset.disabledReason && !button.title) disabledWithoutReason.push(button.textContent?.trim() || button.getAttribute('aria-label') || 'unlabeled');
          if (!button.disabled && typeof reactProps?.onClick !== 'function' && button.dataset.actionState !== 'read-only') silent.push(button.textContent?.trim() || button.getAttribute('aria-label') || 'unlabeled');
        }
        return { silent, disabledWithoutReason };
      });
      assert(result.silent.length === 0, `silent buttons: ${result.silent.join(', ')}`);
      assert(result.disabledWithoutReason.length === 0, `disabled without reason: ${result.disabledWithoutReason.join(', ')}`);
      return { status: status.trim(), silentButtons: result.silent.length };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  writeJson(reportPath, { rows, passed: rows.filter((row) => row.status === 'passed').length, total: rows.length });
  console.log('| Backend adapter smoke | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details ?? ''} |`);
  }
  const failed = rows.filter((row) => row.status === 'failed');
  console.log(`\nBackend adapter smoke summary: ${rows.length - failed.length}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
