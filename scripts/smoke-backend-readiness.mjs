import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/backend-readiness-smoke.json');

const requiredFiles = [
  'src/runtime/environment-registry.ts',
  'src/runtime/api-client-factory.ts',
  'src/runtime/auth-provider.ts',
  'src/runtime/backend-health.ts',
  'src/runtime/endpoint-registry.ts',
  'src/pages/BackendReadinessPage.tsx',
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

  await expectStep(rows, 'required Sprint 9B source files exist', async () => {
    const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
    assert(missing.length === 0, `missing files: ${missing.join(', ')}`);
    return { files: requiredFiles.length };
  });

  if (rows.some((row) => row.status === 'failed')) {
    const report = { generatedAt: new Date().toISOString(), rows, passed: 0, failed: rows.length };
    writeJson(reportPath, report);
    console.table(rows);
    console.log(`Backend readiness smoke summary: 0/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
    process.exit(1);
  }

  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  try {
    await expectStep(rows, 'environment exists', async () => {
      await page.goto(`${baseUrl}/backend-readiness`, { waitUntil: 'networkidle' });
      const environments = await page.evaluate(async () => {
        const { getEnvironmentRegistry } = await import('/src/runtime/environment-registry.ts');
        return getEnvironmentRegistry();
      });
      const ids = environments.map((environment) => environment.id);
      for (const id of ['LOCAL', 'SANDBOX', 'STAGING', 'PRODUCTION']) assert(ids.includes(id), `${id} missing`);
      return { environments: environments.length };
    });

    await expectStep(rows, 'endpoint registry exists', async () => {
      const endpoints = await page.evaluate(async () => {
        const { getEndpointRegistry } = await import('/src/runtime/endpoint-registry.ts');
        return getEndpointRegistry();
      });
      const ids = endpoints.map((endpoint) => endpoint.id);
      for (const id of ['runtime', 'worker', 'approval', 'governance', 'artifact', 'evaluation']) assert(ids.includes(id), `${id} endpoint missing`);
      return { endpoints: endpoints.length };
    });

    await expectStep(rows, 'health engine exists', async () => {
      const health = await page.evaluate(async () => {
        const { checkBackendReadiness } = await import('/src/runtime/backend-health.ts');
        return checkBackendReadiness('PRODUCTION');
      });
      assert(health.environment.id === 'PRODUCTION', 'production health report missing');
      assert(['missing_config', 'offline', 'degraded', 'online'].includes(health.status), `unexpected status ${health.status}`);
      return { status: health.status, score: health.readinessScore };
    });

    await expectStep(rows, 'auth provider exists', async () => {
      const auth = await page.evaluate(async () => {
        const { validateAuthProvider } = await import('/src/runtime/auth-provider.ts');
        return validateAuthProvider('PRODUCTION');
      });
      assert(['valid', 'missing_config', 'not_required'].includes(auth.status), `unexpected auth status ${auth.status}`);
      return { authMode: auth.mode, status: auth.status };
    });

    await expectStep(rows, 'backend readiness page exists', async () => {
      await page.goto(`${baseUrl}/backend-readiness`, { waitUntil: 'networkidle' });
      const route = await page.locator('[data-route="/backend-readiness"]').count();
      const rowsCount = await page.locator('[data-backend-endpoint-row]').count();
      assert(route === 1, 'backend readiness route marker missing');
      assert(rowsCount >= 6, `expected endpoint rows, got ${rowsCount}`);
      return { route, endpoints: rowsCount };
    });

    await expectStep(rows, 'api client factory selects clients', async () => {
      const clients = await page.evaluate(async () => {
        const { createApiClient } = await import('/src/runtime/api-client-factory.ts');
        return Promise.all([
          createApiClient('LOCAL').describe(),
          createApiClient('SANDBOX').describe(),
          createApiClient('STAGING').describe(),
          createApiClient('PRODUCTION').describe(),
        ]);
      });
      assert(clients.every((client) => client.environmentId), 'client description missing environment');
      return { clients: clients.length };
    });

    await expectStep(rows, 'exports registered', async () => {
      const artifacts = await page.evaluate(async () => {
        const { exportBackendReadinessArtifacts } = await import('/src/runtime/backend-health.ts');
        return exportBackendReadinessArtifacts('PRODUCTION');
      });
      const names = artifacts.map((artifact) => artifact.name);
      for (const name of ['backend-readiness-report.md', 'environment-registry.json', 'endpoint-matrix.json', 'backend-health-report.md', 'auth-status.json']) {
        assert(names.includes(name), `${name} missing`);
      }
      return { artifacts: artifacts.length };
    });

    await expectStep(rows, 'pre go-live reads backend readiness blockers', async () => {
      const summary = await page.evaluate(async () => {
        const { runFullPreGoLiveValidation } = await import('/src/runtime/pre-golive-validation-store.ts');
        return runFullPreGoLiveValidation();
      });
      assert(summary.blockers.some((blocker) => blocker.includes('Backend Readiness') || blocker.includes('production backend')), 'backend readiness blocker missing');
      return { verdict: summary.finalVerdict, blockers: summary.blockers.length };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  const passed = rows.filter((row) => row.status === 'passed').length;
  const failed = rows.filter((row) => row.status === 'failed').length;
  writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed, failed });
  console.table(rows);
  console.log(`Backend readiness smoke summary: ${passed}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  writeJson(reportPath, { generatedAt: new Date().toISOString(), failed: 1, error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exit(1);
});

