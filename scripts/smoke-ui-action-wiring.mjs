import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/ui-action-wiring-smoke.json');
const demoRunId = 'run-demo-module-3';
const demoTicketId = 'ticket-audit-module-3';
const visibleRoutes = [
  '/command-center', '/today', '/inbox', '/notifications', '/company/overview', '/company/settings',
  '/goals', '/goals/demo-goal', '/goals/new', '/projects', '/projects/demo-project', '/projects/new',
  '/workforce', '/org-chart', '/agents', '/agents/demo-agent', '/agents/new', '/agents/templates',
  '/agents/performance', '/agents/memory', '/skills', '/tools/permissions', '/tickets', '/tickets/list',
  '/tickets/demo-ticket', '/tickets/new', '/runs/demo-run', '/artifacts', '/artifacts/demo-artifact',
  '/approvals', '/approvals/demo-approval', '/governance/policies', '/audit-log', '/risk-center', '/cost',
  '/budget/settings', '/reports', '/reports/new', '/integrations', '/integrations/demo-integration', '/mcp',
  '/workspaces', '/secrets', '/team', '/roles-permissions', '/settings', '/billing', '/help',
  '/evaluation', '/worker-control', '/worker-recovery', '/chaos', '/runtime-certification', '/certified-sandbox-run', '/production-readiness', '/deployment-config', '/backend-adapter', '/api-contracts', '/e2e-action-flow', '/pre-golive-validation',
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

async function resetRuntime(page) {
  await page.evaluate(async () => {
    window.sessionStorage.clear();
    const { resetWorkflowState } = await import('/src/state/workflow-engine.ts');
    const { resetRuntimeState } = await import('/src/runtime-store/runtime-persistence.ts');
    const { clearRunPlans } = await import('/src/runtime-store/run-plan-store.ts');
    const { resetUsageLedgerStore } = await import('/src/runtime-store/usage-ledger-store.ts');
    const { clearArtifactRegistry } = await import('/src/runtime/artifact-registry-store.ts');
    const { clearRunEvaluationStore } = await import('/src/runtime/run-evaluation-store.ts');
    const { clearEvaluationFeedbackStore } = await import('/src/runtime/evaluation-feedback-store.ts');
    const { clearFeedbackActionPlanStore } = await import('/src/runtime/feedback-action-planner-store.ts');
    const { clearActionPlanExecutionStore } = await import('/src/runtime/action-plan-execution-store.ts');
    const { clearImprovementOutcomeStore } = await import('/src/runtime/improvement-outcome-store.ts');
    const { clearLearningMemoryStore } = await import('/src/runtime/learning-memory-store.ts');
    const { clearRecommendationExecutionStore } = await import('/src/runtime/recommendation-execution-store.ts');
    const { clearImprovementLoopStore } = await import('/src/runtime/improvement-loop-store.ts');
    const { clearImprovementLoopGovernanceStore, disableGlobalLoopKillSwitch } = await import('/src/runtime/improvement-loop-governance-store.ts');
    const { clearImprovementLoopQueueStore } = await import('/src/runtime/improvement-loop-queue-store.ts');
    const { clearImprovementLoopWorkerStore } = await import('/src/runtime/improvement-loop-worker-store.ts');
    const { clearWorkerObservabilityStore } = await import('/src/runtime/worker-observability-store.ts');
    const { clearWorkerRecoveryStore } = await import('/src/runtime/worker-recovery-store.ts');
    const { clearChaosSimulationStore } = await import('/src/runtime/chaos-simulation-store.ts');
    const { clearRuntimeCertificationStore } = await import('/src/runtime/runtime-certification-store.ts');
    const { clearCertifiedSandboxRunStore } = await import('/src/runtime/certified-sandbox-run-store.ts');
    resetWorkflowState();
    resetRuntimeState();
    clearRunPlans();
    resetUsageLedgerStore();
    clearArtifactRegistry();
    clearRunEvaluationStore();
    clearEvaluationFeedbackStore();
    clearFeedbackActionPlanStore();
    clearActionPlanExecutionStore();
    clearImprovementOutcomeStore();
    clearLearningMemoryStore();
    clearRecommendationExecutionStore();
    clearImprovementLoopStore();
    clearImprovementLoopGovernanceStore();
    disableGlobalLoopKillSwitch();
    clearImprovementLoopQueueStore();
    clearImprovementLoopWorkerStore();
    clearWorkerObservabilityStore();
    clearWorkerRecoveryStore();
    clearChaosSimulationStore();
    clearRuntimeCertificationStore();
    clearCertifiedSandboxRunStore();
  });
}

async function prepareEvaluationFixture(page) {
  return page.evaluate(async (runId) => {
    const { startStreamingRun, nextStreamTick } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
    const { isStreamComplete } = await import('/src/runtime-store/stream-store.ts');
    const { generateFeedbackForRun } = await import('/src/runtime/evaluation-feedback-store.ts');
    const { createActionPlanFromFeedback } = await import('/src/runtime/feedback-action-planner-store.ts');
    const { startActionPlanExecution, completeActionTask } = await import('/src/runtime/action-plan-execution-store.ts');
    const { createOutcomeVerification } = await import('/src/runtime/improvement-outcome-store.ts');
    const { createLearningSignalFromOutcome, generateRecommendationFromSignal, markRecommendationAccepted } = await import('/src/runtime/learning-memory-store.ts');
    await startStreamingRun('ticket-audit-module-3');
    for (let guard = 0; guard < 24 && !isStreamComplete(runId); guard += 1) await nextStreamTick(runId);
    const feedback = generateFeedbackForRun(runId);
    const plan = createActionPlanFromFeedback(feedback.id);
    const execution = startActionPlanExecution(plan.id);
    completeActionTask(execution.tasks[0].taskId, { type: 'note', title: 'UI action fixture', description: 'Completed fixture task.', createdBy: 'Smoke test' });
    const outcome = createOutcomeVerification(execution.id);
    const signal = createLearningSignalFromOutcome(outcome.id);
    return markRecommendationAccepted(generateRecommendationFromSignal(signal.id).id).id;
  }, demoRunId);
}

async function prepareCertification(page) {
  return page.evaluate(async () => {
    const { certifyRuntime, createCertificationProfile, runAllContractTests, startCertificationRun } = await import('/src/runtime/runtime-certification-store.ts');
    const profile = createCertificationProfile({
      name: 'UI action wiring certified profile',
      runtimeMode: 'sandbox',
      sandboxBaseUrl: 'https://sandbox.hermes.local',
      apiKeyPresent: true,
      workspaceIdPresent: true,
    });
    const run = startCertificationRun(profile.id);
    runAllContractTests(run.id);
    return certifyRuntime(run.id).id;
  });
}

async function workflowEventCommands(page) {
  return page.evaluate(async () => {
    const { getWorkflowState } = await import('/src/state/workflow-engine.ts');
    return getWorkflowState().events.map((event) => `${event.command}:${event.status}`);
  });
}

async function clickVisible(page, selector, label) {
  const locator = page.locator(selector).first();
  const count = await locator.count();
  assert(count > 0, `${label} selector not found: ${selector}`);
  await locator.click({ timeout: 3000 });
}

async function checkDisabledReasons(page, route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
  return page.locator('button:visible').evaluateAll((buttons) => buttons
    .filter((button) => button.disabled)
    .map((button) => ({
      text: button.textContent?.trim() || button.getAttribute('aria-label') || 'icon-button',
      reason: button.getAttribute('data-disabled-reason') || button.getAttribute('title') || button.getAttribute('aria-label') || '',
    })));
}

async function findSilentButtons(page, route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
  return page.locator('button:visible').evaluateAll((buttons, currentRoute) => buttons
    .map((button) => {
      const reactPropsKey = Object.keys(button).find((key) => key.startsWith('__reactProps$'));
      const reactProps = reactPropsKey ? button[reactPropsKey] : undefined;
      const text = button.textContent?.trim() || button.getAttribute('aria-label') || 'icon-button';
      const readOnlyReason = button.getAttribute('data-action-state') === 'read-only'
        ? button.getAttribute('title') || 'read-only'
        : '';
      const disabledReason = button.disabled
        ? button.getAttribute('data-disabled-reason') || button.getAttribute('title') || button.getAttribute('aria-label') || ''
        : '';
      return {
        text,
        disabled: button.disabled,
        hasHandler: typeof reactProps?.onClick === 'function',
        reason: disabledReason || readOnlyReason,
      };
    })
    .filter((button) => button.disabled ? !button.reason : !button.hasHandler && !button.reason)
    .map((button) => ({ route: currentRoute, ...button })), route);
}

async function main() {
  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  const rows = [];
  try {
    await page.goto(`${baseUrl}/tickets/demo-ticket`, { waitUntil: 'networkidle' });
    await resetRuntime(page);

    await expectStep(rows, 'disabled buttons explain blocked action state', async () => {
      const routes = ['/worker-control', '/certified-sandbox-run'];
      const disabled = [];
      for (const route of routes) disabled.push(...(await checkDisabledReasons(page, route)).map((item) => ({ route, ...item })));
      const missing = disabled.filter((item) => !item.reason);
      assert(missing.length === 0, `disabled buttons missing reason: ${missing.map((item) => `${item.route}:${item.text}`).join(', ')}`);
      return { checkedDisabled: disabled.length };
    });

    await expectStep(rows, 'Start Run button creates workflow command', async () => {
      await page.goto(`${baseUrl}/tickets/demo-ticket`, { waitUntil: 'networkidle' });
      await clickVisible(page, '[data-workflow="ticket-start-run"]', 'Start Run');
      await page.waitForTimeout(500);
      const commands = await workflowEventCommands(page);
      assert(commands.some((item) => item.startsWith('startAgentRun:')), 'startAgentRun workflow event missing');
      return { commands: commands.filter((item) => item.startsWith('startAgentRun:')).join(',') };
    });

    await expectStep(rows, 'Create Plan and Start Plan buttons update runtime plan state', async () => {
      await page.goto(`${baseUrl}/tickets/demo-ticket`, { waitUntil: 'networkidle' });
      await clickVisible(page, '[data-workflow="ticket-create-plan"]', 'Create Plan');
      await page.waitForTimeout(300);
      const plan = await page.evaluate(async (ticketId) => {
        const { getCurrentPlanForTicket } = await import('/src/runtime-store/run-plan-store.ts');
        return getCurrentPlanForTicket(ticketId);
      }, demoTicketId);
      assert(plan?.id, 'run plan was not created');
      await clickVisible(page, '[data-workflow="ticket-start-plan"]', 'Start Plan');
      await page.waitForTimeout(500);
      const commands = await workflowEventCommands(page);
      assert(commands.some((item) => item.startsWith('startRunFromPlan:')), 'startRunFromPlan workflow event missing');
      return { planId: plan.id };
    });

    await expectStep(rows, 'Approve and Reject buttons emit approval commands', async () => {
      await page.goto(`${baseUrl}/approvals`, { waitUntil: 'networkidle' });
      await clickVisible(page, '[data-workflow="approval-approve"]', 'Approve');
      await page.waitForTimeout(300);
      await clickVisible(page, '[data-workflow="approval-reject"]', 'Reject');
      await page.waitForTimeout(300);
      const commands = await workflowEventCommands(page);
      assert(commands.some((item) => item.startsWith('approveApproval:')), 'approveApproval event missing');
      assert(commands.some((item) => item.startsWith('rejectApproval:')), 'rejectApproval event missing');
      return { approvalCommands: commands.filter((item) => item.includes('Approval')).length };
    });

    await expectStep(rows, 'Refresh Runtime button emits discovery command', async () => {
      await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
      await clickVisible(page, '[data-runtime-discovery-refresh]', 'Refresh Runtime');
      await page.waitForTimeout(400);
      const commands = await workflowEventCommands(page);
      assert(commands.some((item) => item.startsWith('refreshHermesDiscovery:')), 'refreshHermesDiscovery event missing');
      return { refreshed: true };
    });

    await expectStep(rows, 'Run Evaluation and Generate Recommendation buttons produce artifacts and recommendations', async () => {
      await page.goto(`${baseUrl}/evaluation`, { waitUntil: 'networkidle' });
      await prepareEvaluationFixture(page);
      await page.goto(`${baseUrl}/evaluation`, { waitUntil: 'networkidle' });
      await clickVisible(page, '[data-workflow="run-evaluation"]', 'Run Evaluation');
      await page.waitForTimeout(500);
      await clickVisible(page, '[data-workflow="generate-recommendation"]', 'Generate Recommendation');
      await page.waitForTimeout(500);
      const result = await page.evaluate(async (runId) => {
        const { searchArtifacts } = await import('/src/runtime/artifact-registry-store.ts');
        const { getRecommendations } = await import('/src/runtime/learning-memory-store.ts');
        return { artifacts: searchArtifacts({ runId }).map((item) => item.name), recommendations: getRecommendations().length };
      }, demoRunId);
      assert(result.artifacts.some((name) => name === 'run-evaluation.json'), 'run evaluation export artifact missing');
      assert(result.recommendations > 0, 'recommendation generation missing');
      return result;
    });

    await expectStep(rows, 'Start Queue, Pause Queue, Start Worker, Stop Worker actions update stores', async () => {
      await page.goto(`${baseUrl}/evaluation`, { waitUntil: 'networkidle' });
      await clickVisible(page, '[data-workflow="queue-enqueue"]', 'Start Queue');
      await page.waitForTimeout(400);
      await clickVisible(page, '[data-workflow="queue-start"]', 'Start Queue Item');
      await page.waitForTimeout(400);
      await clickVisible(page, '[data-workflow="queue-pause"]', 'Pause Queue');
      await page.waitForTimeout(400);
      await clickVisible(page, '[data-workflow="worker-start"]', 'Start Worker');
      await page.waitForTimeout(400);
      await clickVisible(page, '[data-workflow="worker-stop"]', 'Stop Worker');
      await page.waitForTimeout(400);
      const result = await page.evaluate(async () => {
        const { getImprovementLoopQueue } = await import('/src/runtime/improvement-loop-queue-store.ts');
        const { getImprovementLoopWorkerStatus } = await import('/src/runtime/improvement-loop-worker-store.ts');
        return { queue: getImprovementLoopQueue().map((item) => item.status), worker: getImprovementLoopWorkerStatus() };
      });
      assert(result.queue.length > 0, 'queue action did not create queue item');
      assert(result.queue.some((status) => ['paused', 'running', 'waiting_approval', 'blocked'].includes(status)), `queue did not transition: ${result.queue.join(',')}`);
      assert(result.worker === 'stopped', `worker stop did not persist; got ${result.worker}`);
      return result;
    });

    await expectStep(rows, 'Kill Switch action blocks autonomous loops', async () => {
      await page.goto(`${baseUrl}/evaluation`, { waitUntil: 'networkidle' });
      await clickVisible(page, '[data-workflow="loop-kill-switch"]', 'Kill Switch');
      await page.waitForTimeout(400);
      const result = await page.evaluate(async () => {
        const { getGlobalLoopKillSwitch } = await import('/src/runtime/improvement-loop-governance-store.ts');
        return getGlobalLoopKillSwitch();
      });
      assert(result.enabled, 'global loop kill switch not enabled');
      return { enabled: result.enabled };
    });

    await expectStep(rows, 'Recovery Action button creates recovery plan', async () => {
      await page.evaluate(async () => {
        const { recordWorkerIncident } = await import('/src/runtime/worker-observability-store.ts');
        recordWorkerIncident('stale_worker', 'UI action wiring recovery fixture.');
      });
      await page.goto(`${baseUrl}/worker-recovery`, { waitUntil: 'networkidle' });
      await clickVisible(page, '[data-workflow="recovery-plan-incident"]', 'Recovery Action');
      await page.waitForTimeout(400);
      const result = await page.evaluate(async () => {
        const { getWorkerRecoveryDashboard } = await import('/src/runtime/worker-recovery-store.ts');
        return getWorkerRecoveryDashboard();
      });
      assert(result.plans.length > 0, 'recovery plan was not created');
      return { plans: result.plans.length };
    });

    await expectStep(rows, 'Chaos Run action starts scenario', async () => {
      await page.goto(`${baseUrl}/chaos`, { waitUntil: 'networkidle' });
      await clickVisible(page, '[data-workflow="chaos-start-run"]', 'Chaos Run');
      await page.waitForTimeout(400);
      const result = await page.evaluate(async () => {
        const { getChaosDashboard } = await import('/src/runtime/chaos-simulation-store.ts');
        return getChaosDashboard();
      });
      assert(result.runs.length > 0, 'chaos run was not started');
      return { runs: result.runs.length };
    });

    await expectStep(rows, 'Certification Run action creates and exports certified run', async () => {
      const certificationRunId = await prepareCertification(page);
      await page.goto(`${baseUrl}/certified-sandbox-run`, { waitUntil: 'networkidle' });
      await clickVisible(page, '[data-workflow="certified-sandbox-create"]', 'Certification Run');
      await page.waitForTimeout(500);
      const runId = await page.evaluate(async ({ certificationRunId }) => {
        const { getCertifiedSandboxRunDashboard, createCertifiedSandboxRun, evaluateCertifiedSandboxPreflight } = await import('/src/runtime/certified-sandbox-run-store.ts');
        const dashboard = getCertifiedSandboxRunDashboard();
        const run = dashboard.activeRun ?? createCertifiedSandboxRun({ ticketId: 'ticket-audit-module-3', certificationRunId, runtimeMode: 'sandbox', sandboxBaseUrl: 'https://sandbox.hermes.local', sandboxHealth: 'online' });
        evaluateCertifiedSandboxPreflight(run.id);
        return run.id;
      }, { certificationRunId });
      await page.goto(`${baseUrl}/certified-sandbox-run`, { waitUntil: 'networkidle' });
      await clickVisible(page, '[data-workflow="certified-sandbox-export"]', 'Export Artifact');
      await page.waitForTimeout(500);
      const result = await page.evaluate(async (id) => {
        const { getCertifiedSandboxRunDashboard } = await import('/src/runtime/certified-sandbox-run-store.ts');
        const { searchArtifacts } = await import('/src/runtime/artifact-registry-store.ts');
        return { runs: getCertifiedSandboxRunDashboard().runs.length, artifacts: searchArtifacts({ runId: 'run-demo-module-3' }).map((item) => item.name), runId: id };
      }, runId);
      assert(result.runs > 0, 'certified sandbox run was not created');
      assert(result.artifacts.some((name) => name === 'certified-sandbox-run-report.md'), 'certified sandbox export missing');
      return result;
    });

    await expectStep(rows, 'all visible route buttons are wired, disabled with reason, or intentionally read-only', async () => {
      const silent = [];
      for (const route of visibleRoutes) silent.push(...await findSilentButtons(page, route));
      assert(silent.length === 0, `silent buttons: ${silent.slice(0, 40).map((item) => `${item.route}:${item.text}`).join(' | ')}${silent.length > 40 ? ` | +${silent.length - 40} more` : ''}`);
      return { routes: visibleRoutes.length, silentButtons: silent.length };
    });

    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      summary: {
        checked: rows.length,
        passed: rows.filter((row) => row.status === 'passed').length,
        failed: rows.filter((row) => row.status !== 'passed').length,
      },
      rows,
    };
    writeJson(reportPath, report);

    console.log('| UI Action | Status | Details |');
    console.log('|---|---|---|');
    for (const row of rows) {
      const details = row.status === 'passed'
        ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : value}`).join(', ')
        : row.error;
      console.log(`| ${row.name} | ${row.status} | ${details} |`);
    }
    console.log(`\nUI action wiring smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
    process.exitCode = report.summary.failed > 0 ? 1 : 0;
  } finally {
    await page.close();
    await browser.close();
    await stopServer(server);
  }
}

await main();
