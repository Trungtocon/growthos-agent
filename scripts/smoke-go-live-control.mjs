import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const reportPath = path.join(root, 'parity-reports', 'go-live-control-smoke.json');
const baseUrl = 'http://127.0.0.1:5173';

const requiredFiles = [
  'src/runtime/go-live-control.ts',
  'src/runtime/go-live-control-store.ts',
  'src/pages/GoLiveControlPage.tsx',
];

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function expectStep(rows, name, fn) {
  try {
    const details = await fn();
    rows.push({ name, status: 'passed', ...details });
  } catch (error) {
    rows.push({ name, status: 'failed', error: error instanceof Error ? error.message : String(error) });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function waitForServer(url, timeoutMs = 15000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const response = await fetch(url);
        if (response.ok || response.status < 500) return resolve();
      } catch {
        // keep polling
      }
      if (Date.now() - started > timeoutMs) return reject(new Error(`Timed out waiting for ${url}`));
      setTimeout(tick, 250);
    };
    tick();
  });
}

async function ensureServer() {
  try {
    await waitForServer(baseUrl, 1500);
    return undefined;
  } catch {
    const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      windowsHide: true,
    });
    const out = fs.createWriteStream(path.join(root, 'parity-reports', 'vite-dev.out.log'), { flags: 'a' });
    const err = fs.createWriteStream(path.join(root, 'parity-reports', 'vite-dev.err.log'), { flags: 'a' });
    child.stdout.pipe(out);
    child.stderr.pipe(err);
    await waitForServer(baseUrl, 30000);
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

async function seedVerifiedProductionEvidence(page) {
  return page.evaluate(async () => {
    const { createCertificationProfile, runAllContractTests, startCertificationRun, certifyRuntime } = await import('/src/runtime/runtime-certification-store.ts');
    const { createCertifiedSandboxRun, startCertifiedSandboxRun, completeCertifiedSandboxRun } = await import('/src/runtime/certified-sandbox-run-store.ts');
    const { addMonitorEvidence, verifyMonitorEvidence, addAlertChannel, testAlertChannel, addIncidentOwner, verifyRunbook } = await import('/src/runtime/production-observability-store.ts');
    const { createProductionReadinessCheck, evaluateProductionReadiness, approveProductionGoLive } = await import('/src/runtime/production-readiness-store.ts');
    const { createDeploymentConfigCheck, validateDeploymentConfig, markDeploymentConfigReady } = await import('/src/runtime/deployment-config-store.ts');
    const { PRODUCTION_EVIDENCE_CATEGORIES } = await import('/src/runtime/production-config-evidence.ts');
    const { addEvidence, createDemoEvidenceInput, verifyEvidence } = await import('/src/runtime/production-config-evidence-store.ts');
    const { createRunbook, completeRunbookChecklist, markRunbookReady, approveRunbook, acceptOperatorHandoff } = await import('/src/runtime/production-runbook-store.ts');
    const {
      activateTenantBinding,
      approveTenantBinding,
      assignBindingOwner,
      assignBindingReviewer,
      createTenantBinding,
      markTenantBindingEvidenceReady,
      submitTenantBindingForReview,
      updateTenantBinding,
    } = await import('/src/runtime/tenant-production-binding-store.ts');
    const { createTenantSubscription, activateSubscription } = await import('/src/runtime/production-billing-store.ts');

    const profile = createCertificationProfile({
      name: 'Go-live control certified profile',
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
    const monitor = addMonitorEvidence({ name: 'Production API monitor', endpoint: 'https://api.uikigai.example.com/health', uptimePercent: 99.95, latencyMs: 180, errorRatePercent: 0.05 });
    verifyMonitorEvidence(monitor.id, 'go_live_control_smoke');
    const alert = addAlertChannel({ name: 'PagerDuty primary', channelType: 'pagerduty', target: 'pd-prod-escalation' });
    testAlertChannel(alert.id);
    addIncidentOwner({ name: 'Platform on-call', team: 'SRE', escalationPolicy: 'sev1-primary-secondary' });
    verifyRunbook();
    PRODUCTION_EVIDENCE_CATEGORIES.forEach((category) => {
      const evidence = addEvidence(createDemoEvidenceInput(category));
      verifyEvidence(evidence.id, 'go_live_control_smoke');
    });
    const readiness = evaluateProductionReadiness(createProductionReadinessCheck().id);
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
        GROWTHOS_WORKSPACE_ID: 'workspace-prod',
        AUTH_SECRET: 'present',
        STORAGE_DRIVER: 's3',
        LOG_LEVEL: 'info',
        BILLING_PROVIDER: 'stripe',
        DEPLOYMENT_TARGET: 'vercel-production',
      },
    }).id);
    markDeploymentConfigReady(deployment.id);
    approveProductionGoLive(readiness.id, 'Go-live Control Smoke');
    const runbook = createRunbook({
      releaseId: 'go-live-control-smoke',
      operatorOwner: 'Release Operator',
      escalationOwner: 'SRE Lead',
      incidentOwner: 'Incident Commander',
      supportWindow: { start: '2026-06-06T02:00:00.000Z', end: '2026-06-06T08:00:00.000Z', timezone: 'Asia/Saigon' },
    });
    completeRunbookChecklist(runbook.runbookId);
    markRunbookReady(runbook.runbookId);
    const approvedRunbook = approveRunbook(runbook.runbookId, 'VP Operations');
    acceptOperatorHandoff(approvedRunbook.runbookId, 'Release Operator');
    const binding = createTenantBinding({ environment: 'production', tenantId: 'tenant-uikigai', workspaceId: 'workspace-production' });
    activateSubscription(createTenantSubscription({ tenantId: binding.tenantId, workspaceId: binding.workspaceId, planId: 'enterprise', status: 'trial' }).subscriptionId);
    updateTenantBinding(binding.bindingId, {
      backendProfileId: 'backend-prod',
      databaseProfileId: 'database-prod',
      authProfileId: 'auth-prod',
      observabilityProfileId: 'obs-prod',
      supportProfileId: 'support-prod',
      deploymentProfileId: 'deploy-prod',
      rollbackOwner: 'Rollback Commander',
    });
    assignBindingOwner(binding.bindingId, 'Platform Owner');
    assignBindingReviewer(binding.bindingId, 'Security Reviewer');
    markTenantBindingEvidenceReady(binding.bindingId);
    submitTenantBindingForReview(binding.bindingId);
    approveTenantBinding(binding.bindingId, 'Security Reviewer');
    const activeBinding = activateTenantBinding(binding.bindingId);
    return { certificationId: certification.id, sandboxId: sandbox.id, readinessId: readiness.id, deploymentId: deployment.id, runbookId: runbook.runbookId, bindingId: activeBinding.bindingId };
  });
}

async function main() {
  const rows = [];

  await expectStep(rows, 'required Sprint 9H source files exist', async () => {
    const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
    assert(missing.length === 0, `missing files: ${missing.join(', ')}`);
    return { files: requiredFiles.length };
  });

  if (rows.some((row) => row.status === 'failed')) {
    writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed: 0, failed: rows.length });
    console.table(rows);
    console.log(`Go-live control smoke summary: 0/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
    process.exit(1);
  }

  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });

  try {
    await page.goto(`${baseUrl}/go-live-control`, { waitUntil: 'networkidle' });

    await expectStep(rows, 'store initializes', async () => {
      const state = await page.evaluate(async () => {
        const { getGoLiveControlState } = await import('/src/runtime/go-live-control-store.ts');
        return getGoLiveControlState();
      });
      assert(Array.isArray(state.releases), 'releases missing');
      return { releases: state.releases.length, artifacts: state.artifacts.length };
    });

    await expectStep(rows, 'default state is BLOCKED', async () => {
      const control = await page.evaluate(async () => {
        const { clearGoLiveControlStore, createReleaseCandidate, selectGoLiveControl } = await import('/src/runtime/go-live-control-store.ts');
        clearGoLiveControlStore();
        createReleaseCandidate({ version: '9H.0.0', commitHash: 'local-smoke' });
        return selectGoLiveControl();
      });
      assert(control.finalVerdict === 'BLOCKED', `expected BLOCKED, got ${control.finalVerdict}`);
      assert(control.blockerCount > 0, 'blockers missing');
      return { verdict: control.finalVerdict, blockers: control.blockerCount };
    });

    await expectStep(rows, 'missing production evidence keeps NO_GO/BLOCKED', async () => {
      const release = await page.evaluate(async () => {
        const { refreshReadiness, selectGoLiveControl } = await import('/src/runtime/go-live-control-store.ts');
        refreshReadiness();
        return selectGoLiveControl();
      });
      assert(['NO_GO', 'BLOCKED'].includes(release.finalVerdict), `unexpected verdict ${release.finalVerdict}`);
      return { verdict: release.finalVerdict, blockers: release.blockerCount };
    });

    await expectStep(rows, 'missing observability keeps BLOCKED', async () => {
      const release = await page.evaluate(async () => {
        const { selectGoLiveBlockers } = await import('/src/domain/selectors.ts');
        return selectGoLiveBlockers();
      });
      assert(release.some((item) => /observability/i.test(item.reason)), 'observability blocker missing');
      return { blockers: release.length };
    });

    await expectStep(rows, 'missing release approver keeps BLOCKED', async () => {
      await seedVerifiedProductionEvidence(page);
      const release = await page.evaluate(async () => {
        const { createReleaseCandidate, refreshReadiness, selectGoLiveBlockers } = await import('/src/runtime/go-live-control-store.ts');
        createReleaseCandidate({ version: '9H.1.0', commitHash: 'verified-smoke' });
        refreshReadiness();
        return selectGoLiveBlockers();
      });
      assert(release.some((item) => /approver/i.test(item.reason)), 'release approver blocker missing');
      return { blockers: release.length };
    });

    await expectStep(rows, 'missing rollback plan keeps BLOCKED', async () => {
      const release = await page.evaluate(async () => {
        const { requestGoLiveApproval, selectGoLiveBlockers } = await import('/src/runtime/go-live-control-store.ts');
        requestGoLiveApproval(undefined, 'Release Captain');
        return selectGoLiveBlockers();
      });
      assert(release.some((item) => /rollback/i.test(item.reason)), 'rollback blocker missing');
      return { blockers: release.length };
    });

    await expectStep(rows, 'complete verified gates allow waiting_approval', async () => {
      const release = await page.evaluate(async () => {
        const { createReleaseCandidate, verifyRollbackPlan, setReleaseWindow, requestGoLiveApproval, selectGoLiveControl } = await import('/src/runtime/go-live-control-store.ts');
        const candidate = createReleaseCandidate({ version: '9H.2.0', commitHash: 'verified-go-live' });
        setReleaseWindow(candidate.releaseId, { start: '2026-06-05T02:00:00.000Z', end: '2026-06-05T03:00:00.000Z' });
        verifyRollbackPlan(candidate.releaseId);
        requestGoLiveApproval(candidate.releaseId, 'Release Captain');
        return selectGoLiveControl();
      });
      assert(release.state === 'waiting_approval', `expected waiting_approval, got ${release.state}`);
      assert(release.blockerCount === 0, `expected no blockers, got ${release.blockerCount}`);
      return { state: release.state, score: release.readinessScore };
    });

    await expectStep(rows, 'approval changes status to approved', async () => {
      const release = await page.evaluate(async () => {
        const { approveGoLive, selectGoLiveControl } = await import('/src/runtime/go-live-control-store.ts');
        approveGoLive(undefined, 'VP Engineering');
        return selectGoLiveControl();
      });
      assert(release.state === 'approved', `expected approved, got ${release.state}`);
      return { state: release.state, approvedBy: release.approvedBy };
    });

    await expectStep(rows, 'approved release can be marked released', async () => {
      const release = await page.evaluate(async () => {
        const { markReleased, selectGoLiveControl } = await import('/src/runtime/go-live-control-store.ts');
        markReleased();
        return selectGoLiveControl();
      });
      assert(release.state === 'released', `expected released, got ${release.state}`);
      assert(release.finalVerdict === 'GO', `expected GO, got ${release.finalVerdict}`);
      return { state: release.state, verdict: release.finalVerdict };
    });

    await expectStep(rows, 'rollback can be triggered after release', async () => {
      const release = await page.evaluate(async () => {
        const { triggerRollback, selectGoLiveControl } = await import('/src/runtime/go-live-control-store.ts');
        triggerRollback();
        return selectGoLiveControl();
      });
      assert(release.state === 'rolled_back', `expected rolled_back, got ${release.state}`);
      return { state: release.state, rollback: release.rollbackPlanStatus };
    });

    await expectStep(rows, 'export artifacts registered', async () => {
      const artifacts = await page.evaluate(async () => {
        const { exportGoLivePack } = await import('/src/runtime/go-live-control-store.ts');
        return exportGoLivePack();
      });
      const names = artifacts.map((item) => item.name);
      for (const name of ['go-live-final-verdict.md', 'go-live-control-report.md', 'go-live-readiness-matrix.json', 'go-live-blockers.json', 'go-live-approval-record.md', 'go-live-release-checklist.md', 'go-live-rollback-plan.md', 'go-live-pack.zip.md']) {
        assert(names.includes(name), `${name} missing`);
      }
      return { artifacts: artifacts.length };
    });

    await expectStep(rows, 'route /go-live-control exists', async () => {
      await page.goto(`${baseUrl}/go-live-control`, { waitUntil: 'networkidle' });
      const route = await page.locator('[data-route="/go-live-control"]').count();
      const buttons = await page.locator('[data-action]').count();
      assert(route === 1, 'route marker missing');
      assert(buttons >= 9, `expected action buttons, got ${buttons}`);
      return { route, buttons };
    });

    await expectStep(rows, 'all visible buttons are wired', async () => {
      const audit = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map((button) => ({
        text: button.textContent?.trim() ?? '',
        disabled: button.hasAttribute('disabled'),
        disabledReason: button.getAttribute('data-disabled-reason') || button.getAttribute('title') || '',
        action: button.getAttribute('data-action') || '',
        readOnly: button.getAttribute('aria-readonly') === 'true',
      })));
      const silent = audit.filter((button) => !button.disabled && !button.action && !button.readOnly);
      const disabledWithoutReason = audit.filter((button) => button.disabled && !button.disabledReason);
      assert(silent.length === 0, `silent buttons: ${silent.map((item) => item.text).join(', ')}`);
      assert(disabledWithoutReason.length === 0, `disabled without reason: ${disabledWithoutReason.map((item) => item.text).join(', ')}`);
      return { buttons: audit.length, silentButtons: silent.length };
    });

    await expectStep(rows, 'no raw secret values displayed/logged', async () => {
      const body = await page.textContent('body');
      const leaked = /(HERMES_PRODUCTION_API_KEY|PAPERCLIP_API_KEY|AUTH_SECRET|sk-|secret=|api_key=)/i.test(body ?? '');
      assert(!leaked, 'raw secret marker leaked to UI');
      return { leaked };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  const failed = rows.filter((row) => row.status === 'failed');
  writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed: rows.length - failed.length, failed: failed.length });
  console.table(rows);
  console.log(`Go-live control smoke summary: ${rows.length - failed.length}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  writeJson(reportPath, { generatedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exit(1);
});
