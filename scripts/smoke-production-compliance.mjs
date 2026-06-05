import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const reportPath = path.join(root, 'parity-reports', 'production-compliance-smoke.json');
const baseUrl = 'http://127.0.0.1:5173';

const requiredFiles = [
  'src/runtime/production-compliance.ts',
  'src/runtime/production-compliance-store.ts',
  'src/pages/ProductionCompliancePage.tsx',
];

const expectedArtifacts = [
  'audit-report.md',
  'approval-record.md',
  'change-history.json',
  'evidence-log.json',
  'compliance-summary.md',
];

const widgetRoutes = [
  '/production-readiness',
  '/go-live-control',
  '/production-operations',
  '/production-incidents',
  '/tenant-production-binding',
];

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectStep(rows, name, fn) {
  try {
    const details = await fn();
    rows.push({ name, status: 'passed', ...details });
  } catch (error) {
    rows.push({ name, status: 'failed', error: error instanceof Error ? error.message : String(error) });
  }
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
    child.stdout.pipe(fs.createWriteStream(path.join(root, 'parity-reports', 'vite-dev.out.log'), { flags: 'a' }));
    child.stderr.pipe(fs.createWriteStream(path.join(root, 'parity-reports', 'vite-dev.err.log'), { flags: 'a' }));
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

async function seedGoLivePrerequisites(page) {
  return page.evaluate(async () => {
    const { createCertificationProfile, runAllContractTests, startCertificationRun, certifyRuntime } = await import('/src/runtime/runtime-certification-store.ts');
    const { createCertifiedSandboxRun, startCertifiedSandboxRun, completeCertifiedSandboxRun } = await import('/src/runtime/certified-sandbox-run-store.ts');
    const { addMonitorEvidence, verifyMonitorEvidence, addAlertChannel, testAlertChannel, addIncidentOwner, verifyRunbook } = await import('/src/runtime/production-observability-store.ts');
    const { createProductionReadinessCheck, evaluateProductionReadiness, approveProductionGoLive } = await import('/src/runtime/production-readiness-store.ts');
    const { createDeploymentConfigCheck, validateDeploymentConfig, markDeploymentConfigReady } = await import('/src/runtime/deployment-config-store.ts');
    const { PRODUCTION_EVIDENCE_CATEGORIES } = await import('/src/runtime/production-config-evidence.ts');
    const { addEvidence, createDemoEvidenceInput, verifyEvidence } = await import('/src/runtime/production-config-evidence-store.ts');
    const {
      createTenantBinding,
      updateTenantBinding,
      assignBindingOwner,
      assignBindingReviewer,
      markTenantBindingEvidenceReady,
      submitTenantBindingForReview,
      approveTenantBinding,
      activateTenantBinding,
    } = await import('/src/runtime/tenant-production-binding-store.ts');

    const profile = createCertificationProfile({ runtimeMode: 'sandbox', sandboxBaseUrl: 'https://sandbox.hermes.local', apiKeyPresent: true, workspaceIdPresent: true });
    const certification = startCertificationRun(profile.id);
    runAllContractTests(certification.id);
    certifyRuntime(certification.id);
    const sandbox = createCertifiedSandboxRun({ certificationRunId: certification.id, runtimeMode: 'sandbox', sandboxBaseUrl: 'https://sandbox.hermes.local', sandboxHealth: 'online' });
    startCertifiedSandboxRun(sandbox.id);
    completeCertifiedSandboxRun(sandbox.id);
    const monitor = addMonitorEvidence({ name: 'Compliance monitor', endpoint: 'https://api.uikigai.example.com/health', uptimePercent: 99.95, latencyMs: 170, errorRatePercent: 0.01 });
    verifyMonitorEvidence(monitor.id, 'compliance_smoke');
    const alert = addAlertChannel({ name: 'Compliance PagerDuty', channelType: 'pagerduty', target: 'pd-prod-compliance' });
    testAlertChannel(alert.id);
    addIncidentOwner({ name: 'Incident Commander', team: 'SRE', escalationPolicy: 'sev1' });
    verifyRunbook();
    PRODUCTION_EVIDENCE_CATEGORIES.forEach((category) => verifyEvidence(addEvidence(createDemoEvidenceInput(category)).id, 'compliance_smoke'));
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
    approveProductionGoLive(readiness.id, 'Compliance Smoke');
    const binding = createTenantBinding({ environment: 'production', tenantId: 'tenant-uikigai', workspaceId: 'workspace-production' });
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
    activateTenantBinding(binding.bindingId);
    return { certificationId: certification.id, sandboxId: sandbox.id, readinessId: readiness.id, bindingId: binding.bindingId };
  });
}

async function main() {
  const rows = [];

  await expectStep(rows, 'required Sprint 9N source files exist', async () => {
    const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
    assert(missing.length === 0, `missing files: ${missing.join(', ')}`);
    return { files: requiredFiles.length };
  });

  if (rows.some((row) => row.status === 'failed')) {
    writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed: 0, failed: rows.length });
    console.table(rows);
    console.log(`Production compliance smoke summary: 0/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
    process.exit(1);
  }

  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1040 } });

  try {
    await page.goto(`${baseUrl}/production-compliance`, { waitUntil: 'networkidle' });

    await expectStep(rows, 'route exists and compliance center renders', async () => {
      const route = await page.locator('[data-route="/production-compliance"]').count();
      const trail = await page.locator('[data-compliance-audit-trail]').count();
      const buttons = await page.locator('[data-action]').count();
      assert(route === 1, 'route marker missing');
      assert(trail === 1, 'audit trail marker missing');
      assert(buttons >= 8, `expected action buttons, got ${buttons}`);
      return { route, buttons };
    });

    await expectStep(rows, 'approval lifecycle works', async () => {
      const result = await page.evaluate(async () => {
        const store = await import('/src/runtime/production-compliance-store.ts');
        store.clearProductionComplianceStore();
        const approval = store.createComplianceChangeApproval({ object: 'release-window', justification: 'Change window requires audit review.' });
        store.submitComplianceChange(approval.approvalId);
        store.reviewComplianceChange(approval.approvalId, 'Compliance Reviewer');
        store.approveComplianceChange(approval.approvalId, 'Compliance Reviewer');
        store.implementComplianceChange(approval.approvalId, 'Release Operator');
        store.verifyComplianceChange(approval.approvalId, 'Audit Reviewer');
        const closed = store.closeComplianceChange(approval.approvalId, 'Audit Reviewer');
        return { approvalStatus: closed.status, approvals: store.selectComplianceApprovalHistory().length, events: store.selectComplianceAuditTrail().length };
      });
      assert(result.approvalStatus === 'closed', `expected closed, got ${result.approvalStatus}`);
      assert(result.approvals >= 1, 'approval history missing');
      assert(result.events >= 6, `expected lifecycle audit events, got ${result.events}`);
      return result;
    });

    await expectStep(rows, 'go-live runbook incident and tenant actions generate audit records', async () => {
      await seedGoLivePrerequisites(page);
      const result = await page.evaluate(async () => {
        const goLive = await import('/src/runtime/go-live-control-store.ts');
        const runbookStore = await import('/src/runtime/production-runbook-store.ts');
        const incidentStore = await import('/src/runtime/production-incident-store.ts');
        const compliance = await import('/src/runtime/production-compliance-store.ts');
        const readinessStore = await import('/src/runtime/production-readiness-store.ts');
        const deploymentStore = await import('/src/runtime/deployment-config-store.ts');

        const runbook = runbookStore.createRunbook({
          operatorOwner: 'Release Operator',
          escalationOwner: 'SRE Lead',
          incidentOwner: 'Incident Commander',
          supportWindow: { start: '2026-06-06T02:00:00.000Z', end: '2026-06-06T08:00:00.000Z', timezone: 'Asia/Saigon' },
        });
        runbookStore.completeRunbookChecklist(runbook.runbookId);
        runbookStore.markRunbookReady(runbook.runbookId);
        runbookStore.approveRunbook(runbook.runbookId, 'VP Operations');
        runbookStore.acceptOperatorHandoff(runbook.runbookId, 'Release Operator');

        const incident = incidentStore.createIncident({ severity: 'SEV2', owner: 'SRE Primary', commander: 'Incident Commander' });
        incidentStore.markMitigating(incident.incidentId, 'Mitigation applied.');
        incidentStore.resolveIncident(incident.incidentId, { evidenceLinks: ['artifact://incident-evidence'], mitigationSteps: ['Mitigation applied.'] });
        incidentStore.closeIncident(incident.incidentId, { postmortemRequired: true, closedBy: 'Incident Commander' });

        const readiness = readinessStore.evaluateProductionReadiness(readinessStore.createProductionReadinessCheck().id);
        const deployment = deploymentStore.validateDeploymentConfig(deploymentStore.createDeploymentConfigCheck({
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
        deploymentStore.markDeploymentConfigReady(deployment.id);
        readinessStore.approveProductionGoLive(readiness.id, 'Compliance Smoke');

        const release = goLive.createReleaseCandidate({ version: '9N.0.0', commitHash: 'compliance-smoke' });
        goLive.setReleaseWindow(release.releaseId);
        goLive.verifyRollbackPlan(release.releaseId);
        goLive.refreshReadiness(release.releaseId);
        goLive.requestGoLiveApproval(release.releaseId, 'Release Captain');
        const approvedRelease = goLive.approveGoLive(release.releaseId, 'VP Engineering');

        const events = compliance.selectComplianceAuditTrail();
        return {
          total: events.length,
          goLive: events.filter((event) => event.action === 'go-live.approved').length,
          runbook: events.filter((event) => event.action === 'runbook.approved').length,
          incident: events.filter((event) => event.action === 'incident.closed').length,
          tenant: events.filter((event) => event.action === 'tenant-binding.activated').length,
          releaseState: approvedRelease.state,
          releaseBlockers: approvedRelease.blockers.map((blocker) => blocker.reason),
        };
      });
      assert(result.goLive >= 1, `go-live approval audit missing; release=${result.releaseState}; blockers=${result.releaseBlockers.join(' | ')}`);
      assert(result.runbook >= 1, 'runbook approval audit missing');
      assert(result.incident >= 1, 'incident closure audit missing');
      assert(result.tenant >= 1, 'tenant activation audit missing');
      return result;
    });

    await expectStep(rows, 'compliance controls and evidence vault operate', async () => {
      const result = await page.evaluate(async () => {
        const store = await import('/src/runtime/production-compliance-store.ts');
        const dashboard = store.selectProductionComplianceDashboard();
        const artifacts = store.exportComplianceEvidenceVault();
        return { controls: dashboard.controls.length, artifacts: artifacts.map((artifact) => artifact.name), summary: dashboard.summary };
      });
      assert(result.controls >= 6, `expected compliance controls, got ${result.controls}`);
      expectedArtifacts.forEach((name) => assert(result.artifacts.includes(name), `${name} missing`));
      assert(result.summary.auditEvents > 0, 'dashboard audit summary empty');
      return { controls: result.controls, artifacts: result.artifacts.length, events: result.summary.auditEvents };
    });

    await expectStep(rows, 'compact widgets render on required routes', async () => {
      const results = [];
      for (const route of widgetRoutes) {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        const surface = route.slice(1);
        const count = await page.locator(`[data-production-compliance-widget][data-production-compliance-surface="${surface}"]`).count();
        results.push({ route, count });
      }
      const missing = results.filter((entry) => entry.count === 0).map((entry) => entry.route);
      assert(missing.length === 0, `missing compliance widgets: ${missing.join(', ')}`);
      return { routes: results.length };
    });

    await expectStep(rows, 'visible buttons are wired and no raw secrets render', async () => {
      await page.goto(`${baseUrl}/production-compliance`, { waitUntil: 'networkidle' });
      const buttons = await page.locator('button').evaluateAll((items) => items.map((button) => ({
        text: button.textContent?.trim(),
        disabled: button.hasAttribute('disabled'),
        reason: button.getAttribute('data-disabled-reason') ?? button.getAttribute('title'),
        action: button.getAttribute('data-action'),
      })));
      const silent = buttons.filter((button) => !button.disabled && !button.action);
      const disabledWithoutReason = buttons.filter((button) => button.disabled && !button.reason);
      const text = await page.locator('body').innerText();
      assert(silent.length === 0, `silent buttons: ${silent.map((button) => button.text).join(', ')}`);
      assert(disabledWithoutReason.length === 0, `disabled buttons without reason: ${disabledWithoutReason.map((button) => button.text).join(', ')}`);
      assert(!/sk_live_|sk_test_|api[_-]?key\s*[:=]\s*[A-Za-z0-9]{12,}/i.test(text), 'raw secret-like value rendered');
      return { buttons: buttons.length, silentButtons: silent.length };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  const failed = rows.filter((row) => row.status === 'failed');
  const passed = rows.length - failed.length;
  writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed, failed: failed.length });
  console.table(rows);
  console.log(`Production compliance smoke summary: ${passed}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  writeJson(reportPath, {
    generatedAt: new Date().toISOString(),
    rows: [{ name: 'fatal', status: 'failed', error: error instanceof Error ? error.message : String(error) }],
    passed: 0,
    failed: 1,
  });
  console.error(error);
  process.exit(1);
});
