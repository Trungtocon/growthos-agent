import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/pre-golive-validation-smoke.json');

const requiredFiles = [
  'src/runtime/pre-golive-validation.ts',
  'src/runtime/pre-golive-validation-store.ts',
  'src/pages/PreGoLiveValidationPage.tsx',
];

const requiredGates = [
  'deployment-config',
  'production-readiness',
  'runtime-certification',
  'certified-sandbox-run',
  'backend-adapter',
  'backend-readiness',
  'database-readiness',
  'auth-readiness',
  'environment-readiness',
  'production-config-evidence',
  'api-contracts',
  'e2e-action-flow',
  'ui-action-wiring',
  'real-ui-flow',
  'interactions',
  'workflow-actions',
  'artifact-registry',
  'governance-rbac-approval',
  'worker-control-recovery',
  'evaluation-feedback-improvement-loop',
  'static-assets',
  'bbox-35',
  'core-bbox',
  'onboarding-parity',
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

function scanUiForDirectBackendCalls() {
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
  const rows = [];

  await expectStep(rows, 'required source files exist', async () => {
    const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
    assert(missing.length === 0, `missing files: ${missing.join(', ')}`);
    return { files: requiredFiles.length };
  });

  if (rows.some((row) => row.status === 'failed')) {
    const report = { generatedAt: new Date().toISOString(), rows, passed: 0, failed: rows.length };
    writeJson(reportPath, report);
    console.table(rows);
    console.log(`Pre go-live validation smoke summary: 0/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
    process.exit(1);
  }

  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  try {
    await page.goto(`${baseUrl}/pre-golive-validation`, { waitUntil: 'networkidle' });

    await expectStep(rows, 'route /pre-golive-validation exists', async () => {
      const route = await page.locator('[data-route="/pre-golive-validation"]').count();
      assert(route === 1, 'pre go-live route marker missing');
      return { route };
    });

    await expectStep(rows, 'build validation matrix', async () => {
      const gates = await page.evaluate(async () => {
        const { getPreGoLiveValidationGates } = await import('/src/runtime/pre-golive-validation-store.ts');
        return getPreGoLiveValidationGates();
      });
      assert(gates.length >= requiredGates.length, `expected at least ${requiredGates.length} gates, got ${gates.length}`);
      return { gates: gates.length };
    });

    await expectStep(rows, 'all required gates present', async () => {
      const gateIds = await page.evaluate(async () => {
        const { getPreGoLiveValidationGates } = await import('/src/runtime/pre-golive-validation-store.ts');
        return getPreGoLiveValidationGates().map((gate) => gate.gateId);
      });
      const missing = requiredGates.filter((gateId) => !gateIds.includes(gateId));
      assert(missing.length === 0, `missing gates: ${missing.join(', ')}`);
      return { required: requiredGates.length };
    });

    await expectStep(rows, 'final verdict calculation', async () => {
      const result = await page.evaluate(async () => {
        const { runFullPreGoLiveValidation } = await import('/src/runtime/pre-golive-validation-store.ts');
        return runFullPreGoLiveValidation();
      });
      assert(['READY', 'READY_WITH_WARNINGS', 'BLOCKED', 'FAILED'].includes(result.finalVerdict), `bad verdict ${result.finalVerdict}`);
      return { verdict: result.finalVerdict, score: result.readinessScore };
    });

    await expectStep(rows, 'blocker detection', async () => {
      const summary = await page.evaluate(async () => {
        const { selectPreGoLiveValidationSummary } = await import('/src/runtime/pre-golive-validation-store.ts');
        return selectPreGoLiveValidationSummary();
      });
      assert(summary.blockers.length >= 1, 'expected at least one production blocker in mock-safe environment');
      return { blockers: summary.blockers.length };
    });

    await expectStep(rows, 'warning detection', async () => {
      const summary = await page.evaluate(async () => {
        const { selectPreGoLiveValidationSummary } = await import('/src/runtime/pre-golive-validation-store.ts');
        return selectPreGoLiveValidationSummary();
      });
      assert(summary.warnings.length >= 1, 'expected mock/sandbox warnings');
      return { warnings: summary.warnings.length };
    });

    await expectStep(rows, 'evidence export registers artifacts', async () => {
      const artifacts = await page.evaluate(async () => {
        const { exportPreGoLiveValidationArtifacts } = await import('/src/runtime/pre-golive-validation-store.ts');
        return exportPreGoLiveValidationArtifacts();
      });
      const names = artifacts.map((artifact) => artifact.name);
      for (const name of ['pre-golive-validation-report.md', 'pre-golive-validation.json', 'production-blockers.json', 'go-live-checklist.md', 'go-live-final-verdict.md']) {
        assert(names.includes(name), `${name} artifact missing`);
      }
      return { artifacts: artifacts.length };
    });

    await expectStep(rows, 'compact widgets render', async () => {
      const routes = ['/production-readiness', '/deployment-config', '/runtime-certification', '/certified-sandbox-run', '/backend-adapter', '/api-contracts', '/e2e-action-flow', '/runs/demo-run'];
      let widgets = 0;
      for (const route of routes) {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        widgets += await page.locator('[data-pre-golive-widget]').count();
      }
      assert(widgets >= routes.length, `expected ${routes.length} compact widgets, got ${widgets}`);
      return { widgets };
    });

    await expectStep(rows, 'no silent buttons', async () => {
      await page.goto(`${baseUrl}/pre-golive-validation`, { waitUntil: 'networkidle' });
      const silentButtons = await page.locator('[data-route="/pre-golive-validation"] button:not([disabled])').evaluateAll((buttons) => buttons.filter((button) => {
        const text = button.textContent?.trim();
        const hasHandlerHint = button.hasAttribute('data-action') || button.hasAttribute('data-pre-golive-action');
        return !text || !hasHandlerHint;
      }).length);
      assert(silentButtons === 0, `silent buttons=${silentButtons}`);
      return { silentButtons };
    });

    await expectStep(rows, 'no direct backend call from UI', async () => {
      const findings = scanUiForDirectBackendCalls();
      assert(findings.length === 0, findings.join('; '));
      return { findings: 0 };
    });

    await expectStep(rows, 'artifact exports registered in registry', async () => {
      const count = await page.evaluate(async () => {
        const { selectPreGoLiveValidationArtifacts } = await import('/src/runtime/pre-golive-validation-store.ts');
        return selectPreGoLiveValidationArtifacts().length;
      });
      assert(count >= 5, `expected exported artifacts, got ${count}`);
      return { artifacts: count };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  const passed = rows.filter((row) => row.status === 'passed').length;
  const failed = rows.filter((row) => row.status === 'failed').length;
  const report = { generatedAt: new Date().toISOString(), rows, passed, failed };
  writeJson(reportPath, report);
  console.table(rows);
  console.log(`Pre go-live validation smoke summary: ${passed}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  writeJson(reportPath, { generatedAt: new Date().toISOString(), failed: 1, error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exit(1);
});
