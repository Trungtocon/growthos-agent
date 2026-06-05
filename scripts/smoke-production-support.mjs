import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const reportPath = path.join(root, 'parity-reports', 'production-support-smoke.json');
const baseUrl = 'http://127.0.0.1:5173';

const requiredFiles = [
  'src/runtime/production-support.ts',
  'src/runtime/production-support-store.ts',
  'src/pages/ProductionSupportPage.tsx',
];

const requiredRoutes = [
  '/production-incidents',
  '/go-live-control',
  '/production-runbook',
  '/production-observability',
  '/production-readiness',
  '/pre-golive-validation',
  '/backend-readiness',
  '/runtime-certification',
  '/certified-sandbox-run',
  '/deployment-config',
];

const expectedArtifacts = [
  'production-support-report.md',
  'support-ticket-log.json',
  'customer-impact-summary.md',
  'sla-breach-report.md',
  'support-escalation-log.json',
  'customer-communication-drafts.md',
  'support-resolution-evidence.md',
  'support-handoff-summary.md',
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

  await expectStep(rows, 'required Sprint 9K source files exist', async () => {
    const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
    assert(missing.length === 0, `missing files: ${missing.join(', ')}`);
    return { files: requiredFiles.length };
  });

  if (rows.some((row) => row.status === 'failed')) {
    writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed: 0, failed: rows.length });
    console.table(rows);
    console.log(`Production support smoke summary: 0/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
    process.exit(1);
  }

  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });

  try {
    await page.goto(`${baseUrl}/production-support`, { waitUntil: 'networkidle' });

    await expectStep(rows, 'create support ticket', async () => {
      const ticket = await page.evaluate(async () => {
        const { clearProductionSupportStore, createSupportTicket, selectOpenSupportTickets } = await import('/src/runtime/production-support-store.ts');
        clearProductionSupportStore();
        const created = createSupportTicket({
          severity: 'SEV1',
          priority: 'critical',
          customerName: 'Acme Enterprise',
          impactLevel: 'critical',
          customerMessage: 'Runtime automation is unavailable.',
        });
        return { created, open: selectOpenSupportTickets().length };
      });
      assert(ticket.created.severity === 'SEV1', `expected SEV1, got ${ticket.created.severity}`);
      assert(ticket.open === 1, `expected 1 open ticket, got ${ticket.open}`);
      return { ticketId: ticket.created.ticketId };
    });

    await expectStep(rows, 'link ticket to incident', async () => {
      const linked = await page.evaluate(async () => {
        const { createIncident } = await import('/src/runtime/production-incident-store.ts');
        const { linkTicketToIncident, selectOpenSupportTickets } = await import('/src/runtime/production-support-store.ts');
        const incident = createIncident({ severity: 'SEV1', customerImpact: 'Customer-impacting runtime incident.' });
        const ticket = selectOpenSupportTickets()[0];
        return linkTicketToIncident(ticket.ticketId, incident.incidentId);
      });
      assert(Boolean(linked.incidentId), 'incident link missing');
      return { incidentId: linked.incidentId };
    });

    await expectStep(rows, 'acknowledge ticket', async () => {
      const ticket = await page.evaluate(async () => {
        const { acknowledgeSupportTicket, selectOpenSupportTickets } = await import('/src/runtime/production-support-store.ts');
        return acknowledgeSupportTicket(selectOpenSupportTickets()[0].ticketId, 'Support Lead');
      });
      assert(ticket.status === 'acknowledged', `expected acknowledged, got ${ticket.status}`);
      return { ticketStatus: ticket.status };
    });

    await expectStep(rows, 'assign owner', async () => {
      const ticket = await page.evaluate(async () => {
        const { assignSupportOwner, selectOpenSupportTickets } = await import('/src/runtime/production-support-store.ts');
        return assignSupportOwner(selectOpenSupportTickets()[0].ticketId, { owner: 'Support Owner', supportAgent: 'Tier 2 Agent' });
      });
      assert(ticket.owner === 'Support Owner', 'owner missing');
      return { owner: ticket.owner };
    });

    await expectStep(rows, 'escalate ticket', async () => {
      const ticket = await page.evaluate(async () => {
        const { escalateSupportTicket, selectOpenSupportTickets } = await import('/src/runtime/production-support-store.ts');
        return escalateSupportTicket(selectOpenSupportTickets()[0].ticketId, 'Customer Success Director');
      });
      assert(ticket.status === 'escalated', `expected escalated, got ${ticket.status}`);
      assert(ticket.escalationOwner === 'Customer Success Director', 'escalation owner missing');
      return { ticketStatus: ticket.status };
    });

    await expectStep(rows, 'SLA nearing breach', async () => {
      const ticket = await page.evaluate(async () => {
        const { markSupportSlaNearingBreach, selectOpenSupportTickets } = await import('/src/runtime/production-support-store.ts');
        return markSupportSlaNearingBreach(selectOpenSupportTickets()[0].ticketId);
      });
      assert(ticket.slaStatus === 'nearing_breach', `expected nearing_breach, got ${ticket.slaStatus}`);
      return { slaStatus: ticket.slaStatus };
    });

    await expectStep(rows, 'SLA breached', async () => {
      const ticket = await page.evaluate(async () => {
        const { markSupportSlaBreached, selectOpenSupportTickets } = await import('/src/runtime/production-support-store.ts');
        return markSupportSlaBreached(selectOpenSupportTickets()[0].ticketId);
      });
      assert(ticket.slaStatus === 'breached', `expected breached, got ${ticket.slaStatus}`);
      return { slaStatus: ticket.slaStatus };
    });

    await expectStep(rows, 'customer impact warning/blocker', async () => {
      const readiness = await page.evaluate(async () => {
        const { selectSupportReadiness } = await import('/src/runtime/production-support-store.ts');
        return selectSupportReadiness();
      });
      assert(readiness.blockers.some((entry) => /critical/i.test(entry.reason)), 'critical support blocker missing');
      assert(readiness.warnings.some((entry) => /SLA/i.test(entry.reason)), 'SLA warning missing');
      return { blockers: readiness.blockers.length, warnings: readiness.warnings.length };
    });

    await expectStep(rows, 'unresolved critical ticket blocks Go-Live', async () => {
      const control = await page.evaluate(async () => {
        const { createReleaseCandidate, refreshReadiness, selectGoLiveControl } = await import('/src/runtime/go-live-control-store.ts');
        createReleaseCandidate({ version: '9K.0.0', commitHash: 'support-smoke' });
        refreshReadiness();
        return selectGoLiveControl();
      });
      assert(control.blockers.some((entry) => entry.gateId === 'production-support'), 'production support blocker missing');
      return { blockers: control.blockerCount };
    });

    await expectStep(rows, 'resolve ticket with evidence', async () => {
      const ticket = await page.evaluate(async () => {
        const { addCustomerImpactNote, addInternalSupportNote, resolveSupportTicket, selectOpenSupportTickets } = await import('/src/runtime/production-support-store.ts');
        const current = selectOpenSupportTickets()[0];
        addCustomerImpactNote(current.ticketId, 'Customer notified of mitigation status.');
        addInternalSupportNote(current.ticketId, 'Linked runtime fix deployed.');
        return resolveSupportTicket(current.ticketId, {
          resolutionSummary: 'Runtime fix deployed and customer workflow recovered.',
          linkedArtifacts: ['production-incident-report.md'],
        });
      });
      assert(ticket.status === 'resolved', `expected resolved, got ${ticket.status}`);
      assert(ticket.resolutionSummary, 'resolution summary missing');
      return { ticketStatus: ticket.status };
    });

    await expectStep(rows, 'close ticket with resolution summary', async () => {
      const ticket = await page.evaluate(async () => {
        const { closeSupportTicket, selectProductionSupportDashboard } = await import('/src/runtime/production-support-store.ts');
        const resolved = selectProductionSupportDashboard().tickets[0];
        return closeSupportTicket(resolved.ticketId);
      });
      assert(ticket.status === 'closed', `expected closed, got ${ticket.status}`);
      return { ticketStatus: ticket.status };
    });

    await expectStep(rows, 'artifacts registered', async () => {
      const artifacts = await page.evaluate(async () => {
        const { exportSupportPack, selectSupportArtifacts } = await import('/src/runtime/production-support-store.ts');
        const exported = exportSupportPack();
        return { exported: exported.map((artifact) => artifact.name), stored: selectSupportArtifacts().map((artifact) => artifact.name) };
      });
      expectedArtifacts.forEach((name) => assert(artifacts.exported.includes(name), `${name} missing`));
      return { artifacts: artifacts.exported.length, stored: artifacts.stored.length };
    });

    await expectStep(rows, 'route /production-support exists', async () => {
      await page.goto(`${baseUrl}/production-support`, { waitUntil: 'networkidle' });
      const route = await page.locator('[data-route="/production-support"]').count();
      const buttons = await page.locator('[data-action]').count();
      assert(route === 1, 'route marker missing');
      assert(buttons >= 10, `expected action buttons, got ${buttons}`);
      return { route, buttons };
    });

    await expectStep(rows, 'compact widgets appear on required routes', async () => {
      const missing = [];
      for (const route of requiredRoutes) {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        const count = await page.locator(`[data-production-support-widget][data-production-support-surface="${route.slice(1)}"]`).count();
        if (count < 1) missing.push(route);
      }
      assert(missing.length === 0, `missing compact widgets: ${missing.join(', ')}`);
      return { routes: requiredRoutes.length };
    });

    await expectStep(rows, 'all visible buttons wired', async () => {
      await page.goto(`${baseUrl}/production-support`, { waitUntil: 'networkidle' });
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
  console.log(`Production support smoke summary: ${passed}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
  if (failed) process.exit(1);
}

main().catch((error) => {
  writeJson(reportPath, { generatedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exit(1);
});
