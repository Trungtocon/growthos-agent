import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/certified-sandbox-run-smoke.json');

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
    const { clearCertifiedSandboxRunStore } = await import('/src/runtime/certified-sandbox-run-store.ts');
    const { clearRuntimeCertificationStore } = await import('/src/runtime/runtime-certification-store.ts');
    const { clearArtifactRegistry } = await import('/src/runtime/artifact-registry-store.ts');
    const { resetUsageLedgerStore } = await import('/src/runtime-store/usage-ledger-store.ts');
    clearCertifiedSandboxRunStore();
    clearRuntimeCertificationStore();
    clearArtifactRegistry();
    resetUsageLedgerStore();
  });
}

async function createCertifiedProfile(page, input = {}) {
  return page.evaluate(async (profileInput) => {
    const { certifyRuntime, createCertificationProfile, runAllContractTests, startCertificationRun } = await import('/src/runtime/runtime-certification-store.ts');
    const profile = createCertificationProfile({
      name: 'Certified sandbox smoke profile',
      runtimeMode: 'sandbox',
      sandboxBaseUrl: 'https://sandbox.hermes.local',
      apiKeyPresent: true,
      workspaceIdPresent: true,
      ...profileInput,
    });
    const run = startCertificationRun(profile.id);
    runAllContractTests(run.id);
    return certifyRuntime(run.id);
  }, input);
}

async function main() {
  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  const rows = [];
  try {
    await page.goto(`${baseUrl}/certified-sandbox-run`, { waitUntil: 'networkidle' });
    await reset(page);
    let waitingRunId;
    let warningRunId;
    let approvedRunId;
    let completedRunId;

    await expectStep(rows, 'create certified sandbox run', async () => {
      const run = await page.evaluate(async () => {
        const { createCertifiedSandboxRun } = await import('/src/runtime/certified-sandbox-run-store.ts');
        return createCertifiedSandboxRun({ ticketId: 'ticket-demo-module-3' });
      });
      waitingRunId = run.id;
      assert(run.status === 'waiting_certification', `expected waiting_certification, got ${run.status}`);
      return { runId: run.id, status: run.status };
    });

    await expectStep(rows, 'block when certification missing', async () => {
      const preflight = await page.evaluate(async (runId) => {
        const { evaluateCertifiedSandboxPreflight } = await import('/src/runtime/certified-sandbox-run-store.ts');
        return evaluateCertifiedSandboxPreflight(runId);
      }, waitingRunId);
      assert(preflight.status === 'blocked', `expected blocked, got ${preflight.status}`);
      assert(preflight.blockers.some((item) => item.code === 'certification_missing'), 'missing certification blocker not recorded');
      return { blockers: preflight.blockers.length };
    });

    await expectStep(rows, 'block when production URL detected', async () => {
      const certification = await createCertifiedProfile(page);
      const preflight = await page.evaluate(async ({ certificationRunId }) => {
        const { createCertifiedSandboxRun, evaluateCertifiedSandboxPreflight } = await import('/src/runtime/certified-sandbox-run-store.ts');
        const run = createCertifiedSandboxRun({ certificationRunId, runtimeMode: 'sandbox', sandboxBaseUrl: 'https://api.hermes.production.example.com' });
        return evaluateCertifiedSandboxPreflight(run.id);
      }, { certificationRunId: certification.id });
      assert(preflight.status === 'blocked', 'production URL did not block preflight');
      assert(preflight.blockers.some((item) => item.code === 'production_endpoint_detected'), 'production blocker missing');
      return { blockers: preflight.blockers.length };
    });

    await expectStep(rows, 'warn when sandbox env missing but mock fallback active', async () => {
      const certification = await createCertifiedProfile(page, { sandboxBaseUrl: '', apiKeyPresent: false, workspaceIdPresent: false });
      const result = await page.evaluate(async ({ certificationRunId }) => {
        const { createCertifiedSandboxRun, evaluateCertifiedSandboxPreflight } = await import('/src/runtime/certified-sandbox-run-store.ts');
        const run = createCertifiedSandboxRun({ certificationRunId, runtimeMode: 'mock', sandboxBaseUrl: '' });
        return { run, preflight: evaluateCertifiedSandboxPreflight(run.id) };
      }, { certificationRunId: certification.id });
      warningRunId = result.run.id;
      assert(result.preflight.status === 'warning', `expected warning, got ${result.preflight.status}`);
      assert(result.preflight.approvalRequired, 'warning preflight must require approval');
      return { runId: warningRunId, warnings: result.preflight.warnings.length };
    });

    await expectStep(rows, 'pass preflight when certification is valid', async () => {
      const certification = await createCertifiedProfile(page);
      const result = await page.evaluate(async ({ certificationRunId }) => {
        const { createCertifiedSandboxRun, evaluateCertifiedSandboxPreflight } = await import('/src/runtime/certified-sandbox-run-store.ts');
        const run = createCertifiedSandboxRun({ certificationRunId, runtimeMode: 'sandbox', sandboxBaseUrl: 'https://sandbox.hermes.local', sandboxHealth: 'online' });
        return { run, preflight: evaluateCertifiedSandboxPreflight(run.id) };
      }, { certificationRunId: certification.id });
      approvedRunId = result.run.id;
      assert(result.preflight.status === 'ready', `expected ready, got ${result.preflight.status}`);
      return { runId: approvedRunId, status: result.preflight.status };
    });

    await expectStep(rows, 'require approval when certification has warnings', async () => {
      const run = await page.evaluate(async (runId) => {
        const { startCertifiedSandboxRun } = await import('/src/runtime/certified-sandbox-run-store.ts');
        return startCertifiedSandboxRun(runId);
      }, warningRunId);
      assert(run.status === 'waiting_approval', `expected waiting_approval, got ${run.status}`);
      return { status: run.status };
    });

    await expectStep(rows, 'approve and resume run', async () => {
      const run = await page.evaluate(async (runId) => {
        const { approveCertifiedSandboxRun } = await import('/src/runtime/certified-sandbox-run-store.ts');
        return approveCertifiedSandboxRun(runId);
      }, warningRunId);
      assert(run.status === 'running', `expected running, got ${run.status}`);
      return { status: run.status };
    });

    await expectStep(rows, 'execute mock or sandbox tool call', async () => {
      const result = await page.evaluate(async (runId) => {
        const { startCertifiedSandboxRun } = await import('/src/runtime/certified-sandbox-run-store.ts');
        const { getToolCallsByRun } = await import('/src/runtime-store/tool-call-store.ts');
        startCertifiedSandboxRun(runId);
        return getToolCallsByRun('run-demo-module-3');
      }, approvedRunId);
      assert(result.some((item) => item.status === 'completed'), 'completed tool call missing');
      return { tools: result.length };
    });

    await expectStep(rows, 'produce Paperclip artifact', async () => {
      const artifacts = await page.evaluate(async () => {
        const { getRunArtifacts } = await import('/src/runtime-store/artifact-store.ts');
        return getRunArtifacts('run-demo-module-3');
      });
      assert(artifacts.some((item) => item.name === 'certified-sandbox-output.md'), 'Paperclip artifact missing');
      return { artifacts: artifacts.length };
    });

    await expectStep(rows, 'register artifact into artifact registry', async () => {
      const artifacts = await page.evaluate(async () => {
        const { searchArtifacts } = await import('/src/runtime/artifact-registry-store.ts');
        return searchArtifacts({ runId: 'run-demo-module-3' });
      });
      assert(artifacts.some((item) => item.name === 'certified-sandbox-output.md'), 'registry artifact missing');
      return { artifacts: artifacts.length };
    });

    await expectStep(rows, 'update usage ledger', async () => {
      const records = await page.evaluate(async () => {
        const { getUsageByRun } = await import('/src/runtime-store/usage-ledger-store.ts');
        return getUsageByRun('run-demo-module-3');
      });
      assert(records.some((item) => item.type === 'tool_call'), 'tool-call usage missing');
      assert(records.some((item) => item.type === 'artifact'), 'artifact usage missing');
      return { records: records.length };
    });

    await expectStep(rows, 'update run evaluation', async () => {
      const evaluation = await page.evaluate(async () => {
        const { getRunEvaluation } = await import('/src/runtime/run-evaluation-store.ts');
        return getRunEvaluation('run-demo-module-3');
      });
      assert(typeof evaluation.overallScore === 'number', 'evaluation score missing');
      return { score: evaluation.overallScore };
    });

    await expectStep(rows, 'update learning memory', async () => {
      const audit = await page.evaluate(async (runId) => {
        const { getCertifiedSandboxAuditTrail } = await import('/src/runtime/certified-sandbox-run-store.ts');
        return getCertifiedSandboxAuditTrail(runId);
      }, approvedRunId);
      assert(audit.some((item) => item.type === 'learning_memory.updated'), 'learning memory update audit missing');
      return { events: audit.length };
    });

    await expectStep(rows, 'export audit trail', async () => {
      const artifacts = await page.evaluate(async (runId) => {
        const { exportCertifiedSandboxRunArtifacts } = await import('/src/runtime/certified-sandbox-run-store.ts');
        return exportCertifiedSandboxRunArtifacts(runId);
      }, approvedRunId);
      assert(artifacts.some((item) => item.name === 'certified-sandbox-audit.json'), 'audit export missing');
      return { artifacts: artifacts.length };
    });

    await expectStep(rows, 'complete run', async () => {
      const run = await page.evaluate(async (runId) => {
        const { completeCertifiedSandboxRun } = await import('/src/runtime/certified-sandbox-run-store.ts');
        return completeCertifiedSandboxRun(runId);
      }, approvedRunId);
      completedRunId = run.id;
      assert(run.status === 'completed', `expected completed, got ${run.status}`);
      return { runId: completedRunId, status: run.status };
    });

    await expectStep(rows, 'selectors return dashboard model', async () => {
      const dashboard = await page.evaluate(async () => {
        const { selectCertifiedSandboxRunDashboard } = await import('/src/domain/selectors.ts');
        return selectCertifiedSandboxRunDashboard();
      });
      assert(dashboard.runs.length >= 4, 'dashboard runs missing');
      assert(dashboard.completedRuns >= 1, 'dashboard completed run missing');
      return { runs: dashboard.runs.length, completed: dashboard.completedRuns };
    });

    await expectStep(rows, 'compact widgets render safely', async () => {
      await page.goto(`${baseUrl}/runtime-certification`, { waitUntil: 'networkidle' });
      const certification = await page.locator('[data-certified-sandbox-widget="runtime-certification"]').count();
      await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
      const run = await page.locator('[data-certified-sandbox-widget="run"]').count();
      await page.goto(`${baseUrl}/chaos`, { waitUntil: 'networkidle' });
      const chaos = await page.locator('[data-certified-sandbox-widget="chaos"]').count();
      assert(certification > 0 && run > 0 && chaos > 0, 'certified sandbox compact widgets missing');
      return { certification, run, chaos };
    });

    await expectStep(rows, 'final artifacts export successfully', async () => {
      const artifacts = await page.evaluate(async (runId) => {
        const { exportCertifiedSandboxRunArtifacts, getCertifiedSandboxArtifacts } = await import('/src/runtime/certified-sandbox-run-store.ts');
        exportCertifiedSandboxRunArtifacts(runId);
        return getCertifiedSandboxArtifacts(runId);
      }, completedRunId);
      assert(artifacts.length >= 6, 'certified sandbox exports missing');
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
