import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const reportPath = path.join(root, 'parity-reports', 'production-incidents-smoke.json');
const baseUrl = 'http://127.0.0.1:5173';

const requiredFiles = [
  'src/runtime/production-incident.ts',
  'src/runtime/production-incident-store.ts',
  'src/pages/ProductionIncidentPage.tsx',
];

const requiredRoutes = [
  '/go-live-control',
  '/production-runbook',
  '/production-observability',
  '/production-readiness',
  '/pre-golive-validation',
  '/deployment-config',
  '/backend-readiness',
  '/database-readiness',
  '/auth-readiness',
  '/environment-readiness',
  '/runtime-certification',
  '/certified-sandbox-run',
];

const expectedArtifacts = [
  'production-incident-report.md',
  'production-incident-timeline.json',
  'incident-command-summary.md',
  'rollback-decision-record.md',
  'incident-postmortem-template.md',
  'incident-escalation-log.json',
  'incident-resolution-evidence.md',
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

async function main() {
  const rows = [];

  await expectStep(rows, 'required Sprint 9J source files exist', async () => {
    const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
    assert(missing.length === 0, `missing files: ${missing.join(', ')}`);
    return { files: requiredFiles.length };
  });

  if (rows.some((row) => row.status === 'failed')) {
    writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed: 0, failed: rows.length });
    console.table(rows);
    console.log(`Production incidents smoke summary: 0/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
    process.exit(1);
  }

  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });

  try {
    await page.goto(`${baseUrl}/production-incidents`, { waitUntil: 'networkidle' });

    await expectStep(rows, 'create incident', async () => {
      const incident = await page.evaluate(async () => {
        const { clearProductionIncidentStore, createIncident, selectProductionIncidents } = await import('/src/runtime/production-incident-store.ts');
        clearProductionIncidentStore();
        const created = createIncident({
          releaseId: 'release-incident-smoke',
          severity: 'SEV0',
          environment: 'PRODUCTION',
          customerImpact: 'Runtime API unavailable for premium tenants.',
          affectedServices: ['runtime', 'worker'],
        });
        return { created, total: selectProductionIncidents().length };
      });
      assert(incident.created.severity === 'SEV0', `expected SEV0, got ${incident.created.severity}`);
      assert(incident.total === 1, `expected 1 incident, got ${incident.total}`);
      return { incidentId: incident.created.incidentId, total: incident.total };
    });

    await expectStep(rows, 'SEV0/SEV1 blocks GO', async () => {
      const blocked = await page.evaluate(async () => {
        const { createReleaseCandidate, refreshReadiness, selectGoLiveControl } = await import('/src/runtime/go-live-control-store.ts');
        createReleaseCandidate({ version: '9J.0.0', commitHash: 'incident-smoke' });
        refreshReadiness();
        return selectGoLiveControl();
      });
      assert(blocked.blockers.some((entry) => entry.gateId === 'production-incidents'), 'production incident blocker missing');
      return { blockers: blocked.blockerCount, verdict: blocked.finalVerdict };
    });

    await expectStep(rows, 'acknowledge incident', async () => {
      const incident = await page.evaluate(async () => {
        const { acknowledgeIncident, selectActiveProductionIncidents } = await import('/src/runtime/production-incident-store.ts');
        const active = selectActiveProductionIncidents()[0];
        return acknowledgeIncident(active.incidentId, 'Incident Commander');
      });
      assert(incident.status === 'triaging', `expected triaging, got ${incident.status}`);
      assert(Boolean(incident.acknowledgedAt), 'acknowledgedAt missing');
      return { incidentStatus: incident.status };
    });

    await expectStep(rows, 'assign owner', async () => {
      const readiness = await page.evaluate(async () => {
        const { assignIncidentOwner, selectActiveProductionIncidents, selectIncidentCommandReadiness } = await import('/src/runtime/production-incident-store.ts');
        const active = selectActiveProductionIncidents()[0];
        assignIncidentOwner(active.incidentId, { owner: 'SRE Primary', commander: 'Incident Commander' });
        return selectIncidentCommandReadiness();
      });
      assert(!readiness.blockers.some((entry) => /owner/i.test(entry.reason)), 'owner blocker should be cleared');
      return { readinessStatus: readiness.status, blockers: readiness.blockers.length };
    });

    await expectStep(rows, 'escalate incident', async () => {
      const incident = await page.evaluate(async () => {
        const { escalateIncident, selectActiveProductionIncidents } = await import('/src/runtime/production-incident-store.ts');
        const active = selectActiveProductionIncidents()[0];
        return escalateIncident(active.incidentId, 'VP Engineering');
      });
      assert(incident.status === 'escalated', `expected escalated, got ${incident.status}`);
      assert(incident.escalationOwner === 'VP Engineering', 'escalation owner missing');
      return { incidentStatus: incident.status, escalationOwner: incident.escalationOwner };
    });

    await expectStep(rows, 'add timeline event', async () => {
      const timeline = await page.evaluate(async () => {
        const { addIncidentTimelineEvent, selectActiveProductionIncidents, selectIncidentTimeline } = await import('/src/runtime/production-incident-store.ts');
        const active = selectActiveProductionIncidents()[0];
        addIncidentTimelineEvent(active.incidentId, 'manual.note', 'Primary runtime shard isolated.');
        return selectIncidentTimeline(active.incidentId);
      });
      assert(timeline.some((entry) => /runtime shard/i.test(entry.message)), 'timeline event missing');
      return { events: timeline.length };
    });

    await expectStep(rows, 'request rollback', async () => {
      const incident = await page.evaluate(async () => {
        const { requestRollback, selectActiveProductionIncidents } = await import('/src/runtime/production-incident-store.ts');
        const active = selectActiveProductionIncidents()[0];
        return requestRollback(active.incidentId, 'Rollback required to restore runtime API.');
      });
      assert(incident.status === 'rollback_required', `expected rollback_required, got ${incident.status}`);
      assert(incident.rollbackDecision?.required === true, 'rollback decision not required');
      return { incidentStatus: incident.status };
    });

    await expectStep(rows, 'trigger rollback procedure', async () => {
      const incident = await page.evaluate(async () => {
        const { triggerRollbackProcedure, selectIncidentRollbackRequests } = await import('/src/runtime/production-incident-store.ts');
        const request = selectIncidentRollbackRequests()[0];
        return triggerRollbackProcedure(request.incidentId, 'Release Operator');
      });
      assert(incident.rollbackDecision?.triggeredAt, 'rollback trigger timestamp missing');
      return { triggeredBy: incident.rollbackDecision?.triggeredBy };
    });

    await expectStep(rows, 'resolve with evidence', async () => {
      const incident = await page.evaluate(async () => {
        const { markMitigating, markMonitoring, resolveIncident, selectActiveProductionIncidents } = await import('/src/runtime/production-incident-store.ts');
        const active = selectActiveProductionIncidents()[0];
        markMitigating(active.incidentId, 'Traffic drained from failed shard.');
        markMonitoring(active.incidentId, 'Error rate returned below threshold.');
        return resolveIncident(active.incidentId, {
          rootCause: 'Bad runtime rollout flag.',
          evidenceLinks: ['https://status.example.com/incidents/9j-smoke'],
          mitigationSteps: ['Disabled rollout flag', 'Replayed failed jobs'],
        });
      });
      assert(incident.status === 'resolved', `expected resolved, got ${incident.status}`);
      assert(incident.evidenceLinks.length > 0, 'resolution evidence missing');
      return { incidentStatus: incident.status, evidence: incident.evidenceLinks.length };
    });

    await expectStep(rows, 'close with postmortem decision', async () => {
      const incident = await page.evaluate(async () => {
        const { closeIncident, selectProductionIncidents } = await import('/src/runtime/production-incident-store.ts');
        const resolved = selectProductionIncidents()[0];
        return closeIncident(resolved.incidentId, { postmortemRequired: true, closedBy: 'Incident Commander' });
      });
      assert(incident.status === 'closed', `expected closed, got ${incident.status}`);
      assert(incident.postmortemRequired === true, 'postmortem decision missing');
      return { incidentStatus: incident.status, postmortemRequired: incident.postmortemRequired };
    });

    await expectStep(rows, 'artifacts registered', async () => {
      const artifacts = await page.evaluate(async () => {
        const { exportIncidentPack, selectIncidentArtifacts } = await import('/src/runtime/production-incident-store.ts');
        const exported = exportIncidentPack();
        return { exported: exported.map((artifact) => artifact.name), stored: selectIncidentArtifacts().map((artifact) => artifact.name) };
      });
      expectedArtifacts.forEach((name) => assert(artifacts.exported.includes(name), `${name} missing`));
      return { artifacts: artifacts.exported.length, stored: artifacts.stored.length };
    });

    await expectStep(rows, 'route /production-incidents exists', async () => {
      await page.goto(`${baseUrl}/production-incidents`, { waitUntil: 'networkidle' });
      const route = await page.locator('[data-route="/production-incidents"]').count();
      const buttons = await page.locator('[data-action]').count();
      assert(route === 1, 'route marker missing');
      assert(buttons >= 10, `expected action buttons, got ${buttons}`);
      return { route, buttons };
    });

    await expectStep(rows, 'compact widgets appear on required routes', async () => {
      const missing = [];
      for (const route of requiredRoutes) {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        const count = await page.locator(`[data-production-incident-widget][data-production-incident-surface="${route.slice(1)}"]`).count();
        if (count < 1) missing.push(route);
      }
      assert(missing.length === 0, `missing compact widgets: ${missing.join(', ')}`);
      return { routes: requiredRoutes.length };
    });

    await expectStep(rows, 'all visible buttons wired', async () => {
      await page.goto(`${baseUrl}/production-incidents`, { waitUntil: 'networkidle' });
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

    await expectStep(rows, 'no silent buttons', async () => {
      const silentButtons = await page.locator('button:not([data-action]):not([aria-readonly="true"]):not(:disabled)').count();
      assert(silentButtons === 0, `silent buttons present: ${silentButtons}`);
      return { silentButtons };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  const passed = rows.filter((row) => row.status === 'passed').length;
  const failed = rows.length - passed;
  writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed, failed });
  console.table(rows);
  console.log(`Production incidents smoke summary: ${passed}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
  if (failed) process.exit(1);
}

main().catch((error) => {
  writeJson(reportPath, { generatedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exit(1);
});
