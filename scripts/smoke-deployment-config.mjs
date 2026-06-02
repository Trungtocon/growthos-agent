import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/deployment-config-smoke.json');

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

async function createCertifiedProductionEvidence(page) {
  return page.evaluate(async () => {
    const { createCertificationProfile, runAllContractTests, startCertificationRun, certifyRuntime } = await import('/src/runtime/runtime-certification-store.ts');
    const { createCertifiedSandboxRun, startCertifiedSandboxRun, completeCertifiedSandboxRun } = await import('/src/runtime/certified-sandbox-run-store.ts');
    const { createProductionReadinessCheck, evaluateProductionReadiness } = await import('/src/runtime/production-readiness-store.ts');
    const profile = createCertificationProfile({
      name: 'Deployment config certified profile',
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
    return evaluateProductionReadiness(createProductionReadinessCheck().id);
  });
}

async function main() {
  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  const rows = [];
  try {
    await page.goto(`${baseUrl}/deployment-config`, { waitUntil: 'networkidle' });
    await reset(page);

    await expectStep(rows, 'route renders deployment config wizard', async () => {
      await page.goto(`${baseUrl}/deployment-config`, { waitUntil: 'networkidle' });
      const route = await page.locator('[data-deployment-config-route]').count();
      const steps = await page.locator('[data-deployment-config-step]').count();
      assert(route === 1, 'deployment config route did not render');
      assert(steps >= 6, `expected at least 6 wizard steps, got ${steps}`);
      return { route, steps };
    });

    await expectStep(rows, 'missing production env creates blockers', async () => {
      const config = await page.evaluate(async () => {
        const { createDeploymentConfigCheck, validateDeploymentConfig } = await import('/src/runtime/deployment-config-store.ts');
        return validateDeploymentConfig(createDeploymentConfigCheck({ runtimeMode: 'production' }).id);
      });
      const blockerCodes = config.blockers.map((item) => item.code);
      assert(config.status === 'blocked', `expected blocked, got ${config.status}`);
      for (const code of ['missing_production_endpoint', 'missing_production_api_key', 'app_env_not_production']) {
        assert(blockerCodes.includes(code), `${code} blocker missing`);
      }
      return { status: config.status, blockers: config.blockers.length };
    });

    await expectStep(rows, 'sandbox env can pass sandbox readiness but not production readiness', async () => {
      const config = await page.evaluate(async () => {
        const { createDeploymentConfigCheck, validateDeploymentConfig } = await import('/src/runtime/deployment-config-store.ts');
        return validateDeploymentConfig(createDeploymentConfigCheck({
          runtimeMode: 'sandbox',
          env: {
            APP_ENV: 'staging',
            APP_BASE_URL: 'https://growthos.local',
            HERMES_RUNTIME_MODE: 'sandbox',
            HERMES_SANDBOX_BASE_URL: 'https://sandbox.hermes.local',
            HERMES_SANDBOX_API_KEY: 'present',
            HERMES_SANDBOX_WORKSPACE_ID: 'workspace-demo',
            PAPERCLIP_BASE_URL: 'https://paperclip.local',
            PAPERCLIP_API_KEY: 'present',
            GROWTHOS_WORKSPACE_ID: 'workspace-demo',
            STORAGE_DRIVER: 'session',
            LOG_LEVEL: 'info',
            DEPLOYMENT_TARGET: 'vercel-preview',
          },
        }).id);
      });
      assert(['warning', 'valid'].includes(config.status), `unexpected sandbox status ${config.status}`);
      assert(config.warnings.some((item) => item.code === 'production_env_missing'), 'production_env_missing warning absent');
      assert(config.readiness.sandboxReady === true, 'sandbox readiness did not pass');
      assert(config.readiness.productionReady === false, 'sandbox config should not be production ready');
      return { status: config.status, warnings: config.warnings.length };
    });

    await expectStep(rows, 'production readiness dependency blocks go-live until READY', async () => {
      const config = await page.evaluate(async () => {
        const { createDeploymentConfigCheck, validateDeploymentConfig } = await import('/src/runtime/deployment-config-store.ts');
        return validateDeploymentConfig(createDeploymentConfigCheck({
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
      });
      assert(config.blockers.some((item) => item.code === 'production_readiness_not_ready'), 'production readiness blocker missing');
      return { status: config.status, blockers: config.blockers.length };
    });

    await expectStep(rows, 'valid production evidence can mark config ready', async () => {
      await createCertifiedProductionEvidence(page);
      const config = await page.evaluate(async () => {
        const { createDeploymentConfigCheck, validateDeploymentConfig, markDeploymentConfigReady } = await import('/src/runtime/deployment-config-store.ts');
        const checked = validateDeploymentConfig(createDeploymentConfigCheck({
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
        return markDeploymentConfigReady(checked.id);
      });
      assert(config.status === 'valid', `expected valid, got ${config.status}`);
      assert(config.readyMarkedAt, 'ready timestamp missing');
      return { status: config.status, ready: Boolean(config.readyMarkedAt) };
    });

    await expectStep(rows, 'endpoint health and reset actions change visible state', async () => {
      await page.goto(`${baseUrl}/deployment-config`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Validate config/i }).click();
      await page.getByRole('button', { name: /Re-check endpoint health/i }).click();
      await page.getByRole('button', { name: /Reset check/i }).click();
      const status = await page.locator('[data-deployment-config-status]').first().textContent();
      assert(status && status.length > 0, 'status text missing after actions');
      return { status: status.trim() };
    });

    await expectStep(rows, 'exports register deployment artifacts', async () => {
      const artifacts = await page.evaluate(async () => {
        const { createDeploymentConfigCheck, exportDeploymentConfigArtifacts, validateDeploymentConfig } = await import('/src/runtime/deployment-config-store.ts');
        const config = validateDeploymentConfig(createDeploymentConfigCheck({ runtimeMode: 'production' }).id);
        return exportDeploymentConfigArtifacts(config.id);
      });
      const names = artifacts.map((item) => item.name);
      for (const name of ['deployment-config.json', 'deployment-config-report.md', 'deployment-env-checklist.md', 'deployment-blockers.json', 'production-env-readiness.md']) {
        assert(names.includes(name), `${name} export missing`);
      }
      return { artifacts: artifacts.length };
    });

    await expectStep(rows, 'selectors and compact widgets resolve dashboard state', async () => {
      const dashboard = await page.evaluate(async () => {
        const {
          selectDeploymentConfig,
          selectDeploymentConfigStatus,
          selectDeploymentEnvGroups,
          selectDeploymentMissingEnv,
          selectDeploymentWarnings,
          selectDeploymentBlockers,
          selectDeploymentReadiness,
          selectDeploymentArtifacts,
        } = await import('/src/domain/selectors.ts');
        return {
          active: selectDeploymentConfig(),
          status: selectDeploymentConfigStatus(),
          groups: selectDeploymentEnvGroups(),
          missing: selectDeploymentMissingEnv(),
          warnings: selectDeploymentWarnings(),
          blockers: selectDeploymentBlockers(),
          readiness: selectDeploymentReadiness(),
          artifacts: selectDeploymentArtifacts(),
        };
      });
      assert(dashboard.active, 'active deployment config missing');
      assert(dashboard.groups.length >= 10, 'env groups missing');
      assert(dashboard.readiness, 'readiness selector missing');
      await page.goto(`${baseUrl}/production-readiness`, { waitUntil: 'networkidle' });
      assert(await page.locator('[data-deployment-config-widget="production-readiness"]').count() === 1, 'production readiness compact widget missing');
      await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
      assert(await page.locator('[data-deployment-config-widget="run"]').count() === 1, 'run compact widget missing');
      return { status: dashboard.status, groups: dashboard.groups.length, blockers: dashboard.blockers.length, artifacts: dashboard.artifacts.length };
    });

    await expectStep(rows, 'route buttons are wired or disabled with reason', async () => {
      await page.goto(`${baseUrl}/deployment-config`, { waitUntil: 'networkidle' });
      const result = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const silent = [];
        const disabledWithoutReason = [];
        for (const button of buttons) {
          const propsKey = Object.keys(button).find((key) => key.startsWith('__reactProps$'));
          const reactProps = propsKey ? button[propsKey] : undefined;
          if (button.disabled && !button.dataset.disabledReason && !button.title) disabledWithoutReason.push(button.textContent?.trim() || button.getAttribute('aria-label') || 'unlabeled');
          if (!button.disabled && typeof reactProps?.onClick !== 'function' && button.dataset.actionState !== 'read-only') silent.push(button.textContent?.trim() || button.getAttribute('aria-label') || 'unlabeled');
        }
        return { silent, disabledWithoutReason };
      });
      assert(result.silent.length === 0, `silent buttons: ${result.silent.join(', ')}`);
      assert(result.disabledWithoutReason.length === 0, `disabled without reason: ${result.disabledWithoutReason.join(', ')}`);
      return { silentButtons: result.silent.length, disabledWithoutReason: result.disabledWithoutReason.length };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  writeJson(reportPath, { rows, passed: rows.filter((row) => row.status === 'passed').length, total: rows.length });
  console.log('| Deployment config smoke | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details ?? ''} |`);
  }
  const failed = rows.filter((row) => row.status === 'failed');
  console.log(`\nDeployment config smoke summary: ${rows.length - failed.length}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
