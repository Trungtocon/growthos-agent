import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/api-contracts-smoke.json');

const requiredContracts = [
  'runtime.run.start',
  'runtime.run.cancel',
  'runtime.run.approve',
  'runtime.run.reject',
  'artifact.export',
  'approval.submit',
  'governance.evaluate',
  'worker.start',
  'worker.stop',
  'worker.pause',
  'worker.resume',
  'certifiedSandbox.run',
  'productionReadiness.check',
];

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

async function createProductionEvidence(page) {
  return page.evaluate(async () => {
    const { createCertificationProfile, runAllContractTests, startCertificationRun, certifyRuntime } = await import('/src/runtime/runtime-certification-store.ts');
    const { createCertifiedSandboxRun, startCertifiedSandboxRun, completeCertifiedSandboxRun } = await import('/src/runtime/certified-sandbox-run-store.ts');
    const { createProductionReadinessCheck, evaluateProductionReadiness } = await import('/src/runtime/production-readiness-store.ts');
    const { createDeploymentConfigCheck, validateDeploymentConfig, markDeploymentConfigReady } = await import('/src/runtime/deployment-config-store.ts');
    const profile = createCertificationProfile({
      name: 'API contract production profile',
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

function scanUiForDirectFetch() {
  const roots = ['src/pages', 'src/components'];
  const findings = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const filePath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(filePath);
      if (!entry.isFile() || !/\.(tsx?|jsx?)$/.test(entry.name)) continue;
      const text = fs.readFileSync(filePath, 'utf8');
      if (/\bfetch\s*\(/.test(text)) findings.push(`${path.relative(root, filePath)} uses fetch()`);
      if (/from ['"].*integrations\/(hermes|paperclip)/.test(text)) findings.push(`${path.relative(root, filePath)} imports integration client`);
    }
  };
  for (const dir of roots) walk(path.join(root, dir));
  return findings;
}

async function main() {
  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  const rows = [];
  try {
    await page.goto(`${baseUrl}/api-contracts`, { waitUntil: 'networkidle' });
    await reset(page);

    await expectStep(rows, 'build contract registry', async () => {
      const state = await page.evaluate(async () => {
        const { getApiContractState } = await import('/src/runtime/api-contract-store.ts');
        return getApiContractState();
      });
      const ids = state.contracts.map((contract) => contract.contractId);
      for (const id of requiredContracts) assert(ids.includes(id), `${id} missing`);
      return { contracts: ids.length };
    });

    await expectStep(rows, 'validate schemas', async () => {
      const result = await page.evaluate(async () => {
        const { validateApiContracts } = await import('/src/runtime/api-contract-store.ts');
        return validateApiContracts();
      });
      assert(result.invalid.length === 0, `invalid contracts: ${result.invalid.join(', ')}`);
      return { ready: result.ready.length, warnings: result.warnings.length };
    });

    await expectStep(rows, 'mock call success', async () => {
      const result = await page.evaluate(async () => {
        const { executeApiContract } = await import('/src/runtime/production-api-client.ts');
        return executeApiContract('runtime.run.start', { mode: 'mock', body: { ticketId: 'ticket-audit-module-3' } });
      });
      assert(result.ok === true, `mock call failed: ${result.error?.message ?? result.status}`);
      assert(result.mode === 'mock', `expected mock, got ${result.mode}`);
      return { status: result.status, mode: result.mode };
    });

    await expectStep(rows, 'sandbox missing env fallback', async () => {
      await reset(page);
      const result = await page.evaluate(async () => {
        const { executeApiContract } = await import('/src/runtime/production-api-client.ts');
        return executeApiContract('runtime.run.start', { mode: 'sandbox', body: { ticketId: 'ticket-audit-module-3' } });
      });
      assert(['missing_env', 'warning'].includes(result.contractStatus), `expected missing env/warning, got ${result.contractStatus}`);
      assert(result.fallbackUsed === true, 'sandbox missing env did not use fallback');
      return { status: result.status, contractStatus: result.contractStatus };
    });

    await expectStep(rows, 'production blocked when readiness missing', async () => {
      await reset(page);
      const result = await page.evaluate(async () => {
        const { executeApiContract } = await import('/src/runtime/production-api-client.ts');
        return executeApiContract('runtime.run.start', { mode: 'production', body: { ticketId: 'ticket-audit-module-3' } });
      });
      assert(result.ok === false, 'production call unexpectedly allowed');
      assert(['readiness_failed', 'governance_blocked', 'contract_invalid'].includes(result.error?.code), `unexpected error ${result.error?.code}`);
      return { status: result.status, error: result.error.code };
    });

    await expectStep(rows, 'production allowed when all gates pass', async () => {
      await createProductionEvidence(page);
      const result = await page.evaluate(async () => {
        const { executeApiContract } = await import('/src/runtime/production-api-client.ts');
        return executeApiContract('runtime.run.start', { mode: 'production', body: { ticketId: 'ticket-audit-module-3' } });
      });
      assert(result.ok === true, `production call failed: ${result.error?.message ?? result.status}`);
      assert(result.mode === 'production', `expected production, got ${result.mode}`);
      return { status: result.status, mode: result.mode };
    });

    await expectStep(rows, 'UI route /api-contracts exists', async () => {
      await page.goto(`${baseUrl}/api-contracts`, { waitUntil: 'networkidle' });
      const route = await page.locator('[data-api-contracts-route]').count();
      const matrix = await page.locator('[data-api-contract-row]').count();
      assert(route === 1, 'api contracts route missing');
      assert(matrix >= requiredContracts.length, `expected ${requiredContracts.length} rows, got ${matrix}`);
      return { route, matrix };
    });

    await expectStep(rows, 'no direct fetch from UI pages', async () => {
      const findings = scanUiForDirectFetch();
      assert(findings.length === 0, findings.join('; '));
      return { findings: findings.length };
    });

    await expectStep(rows, 'artifact export registered', async () => {
      const artifacts = await page.evaluate(async () => {
        const { exportApiContractArtifacts } = await import('/src/runtime/api-contract-store.ts');
        return exportApiContractArtifacts();
      });
      const names = artifacts.map((item) => item.name);
      for (const name of ['api-contracts.json', 'api-contract-status.md', 'endpoint-readiness-report.md', 'api-contract-test-results.json']) {
        assert(names.includes(name), `${name} missing`);
      }
      return { artifacts: artifacts.length };
    });

    await expectStep(rows, 'all contracts have status', async () => {
      const contracts = await page.evaluate(async () => {
        const { getApiContracts } = await import('/src/runtime/api-contract-store.ts');
        return getApiContracts();
      });
      const missing = contracts.filter((contract) => !contract.status).map((contract) => contract.contractId);
      assert(missing.length === 0, `missing status: ${missing.join(', ')}`);
      return { contracts: contracts.length };
    });

    await expectStep(rows, 'test call buttons are wired', async () => {
      await page.goto(`${baseUrl}/api-contracts`, { waitUntil: 'networkidle' });
      await page.locator('[data-api-contract-test-call]').first().click();
      const lastResult = await page.locator('[data-api-contract-last-result]').first().textContent();
      assert(lastResult && lastResult.trim().length > 0, 'test call produced no visible result');
      const silent = await page.evaluate(() => {
        const result = [];
        for (const button of Array.from(document.querySelectorAll('button'))) {
          const propsKey = Object.keys(button).find((key) => key.startsWith('__reactProps$'));
          const reactProps = propsKey ? button[propsKey] : undefined;
          if (!button.disabled && typeof reactProps?.onClick !== 'function' && button.dataset.actionState !== 'read-only') {
            result.push(button.textContent?.trim() || button.getAttribute('aria-label') || 'unlabeled');
          }
        }
        return result;
      });
      assert(silent.length === 0, `silent buttons: ${silent.join(', ')}`);
      return { lastResult: lastResult.trim(), silentButtons: silent.length };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  writeJson(reportPath, { rows, passed: rows.filter((row) => row.status === 'passed').length, total: rows.length });
  console.log('| API contracts smoke | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details ?? ''} |`);
  }
  const failed = rows.filter((row) => row.status === 'failed');
  console.log(`\nAPI contracts smoke summary: ${rows.length - failed.length}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
