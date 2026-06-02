import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/runtime-certification-smoke.json');

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
  await page.evaluate(async () => {
    const { clearRuntimeCertificationStore } = await import('/src/runtime/runtime-certification-store.ts');
    const { clearArtifactRegistry } = await import('/src/runtime/artifact-registry-store.ts');
    clearRuntimeCertificationStore();
    clearArtifactRegistry();
  });
}

async function main() {
  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  const rows = [];
  try {
    await page.goto(`${baseUrl}/runtime-certification`, { waitUntil: 'networkidle' });
    await reset(page);
    let profileId;
    let warningRunId;
    let blockedRunId;
    let passedRunId;

    await expectStep(rows, 'create certification profile', async () => {
      const profile = await page.evaluate(async () => {
        const { createCertificationProfile } = await import('/src/runtime/runtime-certification-store.ts');
        return createCertificationProfile({ name: 'Smoke sandbox profile', sandboxBaseUrl: '', runtimeMode: 'mock' });
      });
      profileId = profile.id;
      assert(profile.runtimeMode === 'mock', 'profile runtime mode mismatch');
      return { profileId };
    });

    await expectStep(rows, 'missing env returns warning, not crash', async () => {
      const run = await page.evaluate(async () => {
        const { createCertificationProfile, startCertificationRun, runContractTest } = await import('/src/runtime/runtime-certification-store.ts');
        const profile = createCertificationProfile({ name: 'Missing sandbox env profile', runtimeMode: 'sandbox', sandboxBaseUrl: '' });
        const active = startCertificationRun(profile.id);
        runContractTest(active.id, 'environment_config');
        return active;
      });
      warningRunId = run.id;
      const status = await page.evaluate(async (runId) => {
        const { selectCertificationStatus } = await import('/src/domain/selectors.ts');
        return selectCertificationStatus(runId);
      }, warningRunId);
      assert(status === 'warning', `expected warning, got ${status}`);
      return { runId: warningRunId, status };
    });

    await expectStep(rows, 'sandbox health test passes in mock-safe mode', async () => {
      const result = await page.evaluate(async (runId) => {
        const { runContractTest } = await import('/src/runtime/runtime-certification-store.ts');
        return runContractTest(runId, 'sandbox_health');
      }, warningRunId);
      assert(result.status === 'passed', `expected passed, got ${result.status}`);
      return { status: result.status };
    });

    await expectStep(rows, 'production URL detection blocks certification', async () => {
      const result = await page.evaluate(async () => {
        const { createCertificationProfile, startCertificationRun, runContractTest } = await import('/src/runtime/runtime-certification-store.ts');
        const profile = createCertificationProfile({ name: 'Unsafe production profile', sandboxBaseUrl: 'https://api.hermes.production.example.com', runtimeMode: 'sandbox' });
        const run = startCertificationRun(profile.id);
        const test = runContractTest(run.id, 'no_production_endpoint');
        return { run, test };
      });
      blockedRunId = result.run.id;
      assert(result.test.status === 'blocked', 'production URL was not blocked');
      return { runId: blockedRunId, status: result.test.status };
    });

    await expectStep(rows, 'contract test matrix returns required optional status', async () => {
      const matrix = await page.evaluate(async (runId) => {
        const { getContractTestResults } = await import('/src/runtime/runtime-certification-store.ts');
        return getContractTestResults(runId);
      }, warningRunId);
      assert(matrix.some((item) => item.required === true), 'required test missing');
      assert(matrix.some((item) => item.required === false), 'optional test missing');
      return { results: matrix.length };
    });

    await expectStep(rows, 'governance preflight is evaluated', async () => {
      const result = await page.evaluate(async (runId) => {
        const { runContractTest } = await import('/src/runtime/runtime-certification-store.ts');
        return runContractTest(runId, 'governance_preflight');
      }, warningRunId);
      assert(result.status === 'passed', 'governance preflight did not pass');
      return { status: result.status };
    });

    await expectStep(rows, 'quota guard is evaluated', async () => {
      const result = await page.evaluate(async (runId) => {
        const { runContractTest } = await import('/src/runtime/runtime-certification-store.ts');
        return runContractTest(runId, 'quota_guard');
      }, warningRunId);
      assert(result.status === 'passed', 'quota guard did not pass');
      return { status: result.status };
    });

    await expectStep(rows, 'artifact export is registered', async () => {
      const artifacts = await page.evaluate(async () => {
        const { exportCertificationReport } = await import('/src/runtime/runtime-certification-store.ts');
        return exportCertificationReport();
      });
      assert(artifacts.length >= 5, 'certification artifacts missing');
      return { artifacts: artifacts.length };
    });

    await expectStep(rows, 'recovery compatibility is checked', async () => {
      const result = await page.evaluate(async (runId) => {
        const { runContractTest } = await import('/src/runtime/runtime-certification-store.ts');
        return runContractTest(runId, 'recovery_flow');
      }, warningRunId);
      assert(result.status === 'passed', 'recovery flow did not pass');
      return { status: result.status };
    });

    await expectStep(rows, 'chaos safety compatibility is checked', async () => {
      const result = await page.evaluate(async (runId) => {
        const { runContractTest } = await import('/src/runtime/runtime-certification-store.ts');
        return runContractTest(runId, 'chaos_safety');
      }, warningRunId);
      assert(result.status === 'passed', 'chaos safety did not pass');
      return { status: result.status };
    });

    await expectStep(rows, 'readiness findings are generated', async () => {
      const findings = await page.evaluate(async (runId) => {
        const { evaluateCertificationReadiness } = await import('/src/runtime/runtime-certification-store.ts');
        return evaluateCertificationReadiness(runId);
      }, warningRunId);
      assert(findings.length > 0, 'readiness findings missing');
      return { findings: findings.length };
    });

    await expectStep(rows, 'blocked run cannot certify', async () => {
      const result = await page.evaluate(async (runId) => {
        const { certifyRuntime } = await import('/src/runtime/runtime-certification-store.ts');
        return certifyRuntime(runId);
      }, blockedRunId);
      assert(result.status === 'blocked', `expected blocked, got ${result.status}`);
      return { status: result.status };
    });

    await expectStep(rows, 'passed run can certify', async () => {
      const result = await page.evaluate(async () => {
        const { createCertificationProfile, startCertificationRun, runAllContractTests, certifyRuntime } = await import('/src/runtime/runtime-certification-store.ts');
        const profile = createCertificationProfile({ name: 'Safe sandbox profile', sandboxBaseUrl: 'https://sandbox.hermes.local', runtimeMode: 'sandbox', apiKeyPresent: true, workspaceIdPresent: true });
        const run = startCertificationRun(profile.id);
        runAllContractTests(run.id);
        return certifyRuntime(run.id);
      });
      passedRunId = result.id;
      assert(result.status === 'certified', `expected certified, got ${result.status}`);
      return { runId: passedRunId, status: result.status };
    });

    await expectStep(rows, 'selectors return dashboard data', async () => {
      const dashboard = await page.evaluate(async () => {
        const { selectRuntimeCertificationDashboard } = await import('/src/domain/selectors.ts');
        return selectRuntimeCertificationDashboard();
      });
      assert(dashboard.profiles.length >= 3, 'profiles missing from dashboard');
      assert(dashboard.runs.length >= 3, 'runs missing from dashboard');
      return { profiles: dashboard.profiles.length, runs: dashboard.runs.length };
    });

    await expectStep(rows, 'compact widgets render safely', async () => {
      await page.goto(`${baseUrl}/chaos`, { waitUntil: 'networkidle' });
      const chaos = await page.locator('[data-runtime-certification-widget="chaos"]').count();
      await page.goto(`${baseUrl}/worker-recovery`, { waitUntil: 'networkidle' });
      const recovery = await page.locator('[data-runtime-certification-widget="worker-recovery"]').count();
      await page.goto(`${baseUrl}/agents/demo-agent`, { waitUntil: 'networkidle' });
      const agent = await page.locator('[data-runtime-certification-widget="agent"]').count();
      assert(chaos > 0 && recovery > 0 && agent > 0, 'runtime certification compact widgets missing');
      return { chaos, recovery, agent };
    });

    await expectStep(rows, 'certification artifacts export successfully', async () => {
      const artifacts = await page.evaluate(async () => {
        const { exportCertificationReport, getCertificationArtifacts } = await import('/src/runtime/runtime-certification-store.ts');
        exportCertificationReport();
        return getCertificationArtifacts();
      });
      assert(artifacts.includes('artifact-run-demo-module-3-runtime-certification-report-md'), 'runtime certification report artifact missing');
      return { artifacts: artifacts.length };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  const failed = rows.filter((row) => row.status !== 'passed');
  const report = { generatedAt: new Date().toISOString(), baseUrl, rows, passed: rows.length - failed.length, failed: failed.length };
  writeJson(reportPath, report);
  if (failed.length) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  writeJson(reportPath, { generatedAt: new Date().toISOString(), status: 'failed', error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exit(1);
});
