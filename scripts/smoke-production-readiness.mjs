import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/production-readiness-smoke.json');
const demoRunId = 'run-demo-module-3';

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
    window.sessionStorage.clear();
  });
}

async function createCertifiedProductionEvidence(page) {
  return page.evaluate(async () => {
    const { createCertificationProfile, runAllContractTests, startCertificationRun, certifyRuntime } = await import('/src/runtime/runtime-certification-store.ts');
    const { createCertifiedSandboxRun, startCertifiedSandboxRun, completeCertifiedSandboxRun } = await import('/src/runtime/certified-sandbox-run-store.ts');
    const profile = createCertificationProfile({
      name: 'Production readiness certified profile',
      runtimeMode: 'sandbox',
      sandboxBaseUrl: 'https://sandbox.hermes.local',
      apiKeyPresent: true,
      workspaceIdPresent: true,
    });
    const certification = startCertificationRun(profile.id);
    runAllContractTests(certification.id);
    const certified = certifyRuntime(certification.id);
    const sandbox = createCertifiedSandboxRun({
      certificationRunId: certified.id,
      runtimeMode: 'sandbox',
      sandboxBaseUrl: 'https://sandbox.hermes.local',
      sandboxHealth: 'online',
    });
    startCertifiedSandboxRun(sandbox.id);
    return { certification: certified, sandbox: completeCertifiedSandboxRun(sandbox.id) };
  });
}

async function main() {
  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  const rows = [];
  try {
    await page.goto(`${baseUrl}/production-readiness`, { waitUntil: 'networkidle' });
    await reset(page);
    let blockedCheckId;
    let readyCheckId;

    await expectStep(rows, 'route renders production readiness page', async () => {
      await page.goto(`${baseUrl}/production-readiness`, { waitUntil: 'networkidle' });
      const route = await page.locator('[data-production-readiness-route]').count();
      assert(route === 1, 'production readiness route did not render');
      return { route };
    });

    await expectStep(rows, 'missing certified sandbox blocks readiness', async () => {
      const check = await page.evaluate(async () => {
        const { createProductionReadinessCheck, evaluateProductionReadiness } = await import('/src/runtime/production-readiness-store.ts');
        return evaluateProductionReadiness(createProductionReadinessCheck().id);
      });
      blockedCheckId = check.id;
      assert(check.status === 'BLOCKED', `expected BLOCKED, got ${check.status}`);
      assert(check.blockers.some((item) => item.code === 'sandbox_not_certified'), 'sandbox_not_certified blocker missing');
      return { checkId: check.id, blockers: check.blockers.length };
    });

    await expectStep(rows, 'runtime certification blocker prevents READY', async () => {
      const check = await page.evaluate(async (checkId) => {
        const { evaluateProductionReadiness } = await import('/src/runtime/production-readiness-store.ts');
        return evaluateProductionReadiness(checkId);
      }, blockedCheckId);
      assert(check.status !== 'READY', 'readiness became READY without runtime certification');
      assert(check.blockers.some((item) => item.code === 'runtime_not_certified' || item.code === 'sandbox_not_certified'), 'runtime/sandbox blocker missing');
      return { status: check.status };
    });

    await expectStep(rows, 'certified evidence can reach READY or NEEDS_REVIEW without blockers', async () => {
      await createCertifiedProductionEvidence(page);
      const check = await page.evaluate(async () => {
        const { createProductionReadinessCheck, evaluateProductionReadiness } = await import('/src/runtime/production-readiness-store.ts');
        return evaluateProductionReadiness(createProductionReadinessCheck().id);
      });
      readyCheckId = check.id;
      assert(!check.blockers.length, `expected no blockers, got ${check.blockers.map((item) => item.code).join(',')}`);
      assert(['READY', 'NEEDS_REVIEW', 'WARNING'].includes(check.status), `unexpected status ${check.status}`);
      return { checkId: readyCheckId, status: check.status, warnings: check.warnings.length };
    });

    await expectStep(rows, 'all required categories are present', async () => {
      const categories = await page.evaluate(async (checkId) => {
        const { getProductionReadinessChecklist } = await import('/src/runtime/production-readiness-store.ts');
        return getProductionReadinessChecklist(checkId).map((item) => item.category);
      }, readyCheckId);
      const required = [
        'certified_sandbox_run',
        'runtime_certification',
        'governance_exit_gate',
        'approval_execution',
        'artifact_registry',
        'execution_graph',
        'execution_timeline',
        'replay_control',
        'run_evaluation',
        'feedback_loop',
        'learning_memory',
        'improvement_loop',
        'worker_observability',
        'worker_recovery',
        'chaos_simulation',
        'cost_reconciliation',
        'usage_ledger',
        'rbacs_and_authorization_audit',
        'environment_config',
        'ui_action_wiring',
      ];
      const missing = required.filter((item) => !categories.includes(item));
      assert(!missing.length, `missing categories: ${missing.join(', ')}`);
      return { categories: categories.length };
    });

    await expectStep(rows, 'approve and reject go-live decisions persist', async () => {
      const decisions = await page.evaluate(async (checkId) => {
        const { createDeploymentConfigCheck, markDeploymentConfigReady, validateDeploymentConfig } = await import('/src/runtime/deployment-config-store.ts');
        const { approveProductionGoLive, createProductionReadinessCheck, evaluateProductionReadiness, rejectProductionGoLive } = await import('/src/runtime/production-readiness-store.ts');
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
        markDeploymentConfigReady(deployment.id);
        const approved = approveProductionGoLive(checkId, 'Smoke approver');
        const rejectedCheck = evaluateProductionReadiness(createProductionReadinessCheck().id);
        const rejected = rejectProductionGoLive(rejectedCheck.id, 'Smoke rejection');
        return { approved, rejected };
      }, readyCheckId);
      assert(decisions.approved.approvalStatus === 'approved', 'approval not persisted');
      assert(decisions.rejected.approvalStatus === 'rejected', 'rejection not persisted');
      return { approved: decisions.approved.approvalStatus, rejected: decisions.rejected.approvalStatus };
    });

    await expectStep(rows, 'exports register artifact records', async () => {
      const artifacts = await page.evaluate(async (checkId) => {
        const { exportProductionReadinessArtifacts } = await import('/src/runtime/production-readiness-store.ts');
        return exportProductionReadinessArtifacts(checkId);
      }, readyCheckId);
      const names = artifacts.map((item) => item.name);
      for (const name of ['production-readiness-report.md', 'production-readiness.json', 'go-live-checklist.md', 'go-live-blockers.json', 'go-live-approval-summary.md']) {
        assert(names.includes(name), `${name} export missing`);
      }
      return { artifacts: artifacts.length };
    });

    await expectStep(rows, 'selectors expose dashboard and compact widget data', async () => {
      const dashboard = await page.evaluate(async () => {
        const { selectProductionReadinessDashboard } = await import('/src/domain/selectors.ts');
        return selectProductionReadinessDashboard();
      });
      assert(dashboard.checks.length > 0, 'dashboard checks missing');
      await page.goto(`${baseUrl}/certified-sandbox-run`, { waitUntil: 'networkidle' });
      assert(await page.locator('[data-production-readiness-widget="certified-sandbox-run"]').count() === 1, 'certified sandbox compact widget missing');
      await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
      assert(await page.locator('[data-production-readiness-widget="run"]').count() === 1, 'run compact widget missing');
      return { status: dashboard.status, checks: dashboard.checks.length };
    });

    await expectStep(rows, 'ui action wiring evidence is represented', async () => {
      const item = await page.evaluate(async (checkId) => {
        const { getProductionReadinessChecklist } = await import('/src/runtime/production-readiness-store.ts');
        return getProductionReadinessChecklist(checkId).find((entry) => entry.category === 'ui_action_wiring');
      }, readyCheckId);
      assert(item && item.status !== 'NOT_CHECKED', 'ui action wiring was not evaluated');
      return { status: item.status };
    });

    await expectStep(rows, 'route buttons are not silently dead', async () => {
      await page.goto(`${baseUrl}/production-readiness`, { waitUntil: 'networkidle' });
      const silentButtons = await page.evaluate(() => Array.from(document.querySelectorAll('button')).filter((button) => {
        const propsKey = Object.keys(button).find((key) => key.startsWith('__reactProps$'));
        const reactProps = propsKey ? button[propsKey] : undefined;
        return !button.disabled && typeof reactProps?.onClick !== 'function' && button.dataset.actionState !== 'read-only';
      }).map((button) => button.textContent?.trim() || button.getAttribute('aria-label') || 'unlabeled'));
      assert(silentButtons.length === 0, `silent buttons: ${silentButtons.join(', ')}`);
      return { silentButtons: silentButtons.length };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  writeJson(reportPath, { rows, passed: rows.filter((row) => row.status === 'passed').length, total: rows.length });
  console.log('| Production readiness smoke | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details ?? ''} |`);
  }
  const failed = rows.filter((row) => row.status === 'failed');
  console.log(`\nProduction readiness smoke summary: ${rows.length - failed.length}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
