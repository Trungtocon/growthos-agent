import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/improvement-loop-governance-smoke.json');
const runId = 'run-demo-module-3';

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
    const details = await action();
    rows.push({ name, ...details, status: 'passed' });
  } catch (error) {
    rows.push({ name, status: 'failed', error: error instanceof Error ? error.message : String(error) });
  }
}

async function prepareRuntime(page) {
  return page.evaluate(async (id) => {
    const { resetRuntimeState } = await import('/src/runtime-store/runtime-persistence.ts');
    const { resetWorkflowState } = await import('/src/state/workflow-engine.ts');
    const { clearRunPlans } = await import('/src/runtime-store/run-plan-store.ts');
    const { resetUsageLedgerStore } = await import('/src/runtime-store/usage-ledger-store.ts');
    const { clearArtifactRegistry } = await import('/src/runtime/artifact-registry-store.ts');
    const { clearExecutionTimelineStore, buildTimelineForRun } = await import('/src/runtime/execution-timeline-store.ts');
    const { clearRunEvaluationStore } = await import('/src/runtime/run-evaluation-store.ts');
    const { clearEvaluationFeedbackStore, generateFeedbackForRun } = await import('/src/runtime/evaluation-feedback-store.ts');
    const { clearFeedbackActionPlanStore, createActionPlanFromFeedback } = await import('/src/runtime/feedback-action-planner-store.ts');
    const { clearActionPlanExecutionStore, startActionPlanExecution, completeActionTask } = await import('/src/runtime/action-plan-execution-store.ts');
    const { clearImprovementOutcomeStore, createOutcomeVerification } = await import('/src/runtime/improvement-outcome-store.ts');
    const { clearLearningMemoryStore, createLearningSignalFromOutcome, generateRecommendationFromSignal, markRecommendationAccepted, updateRecommendationConfidence } = await import('/src/runtime/learning-memory-store.ts');
    const { clearRecommendationExecutionStore } = await import('/src/runtime/recommendation-execution-store.ts');
    const { clearImprovementLoopStore } = await import('/src/runtime/improvement-loop-store.ts');
    const { clearImprovementLoopGovernanceStore } = await import('/src/runtime/improvement-loop-governance-store.ts');
    const { createPlanForTicket, startStreamingRun, nextStreamTick } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
    const { isStreamComplete } = await import('/src/runtime-store/stream-store.ts');

    resetRuntimeState();
    resetWorkflowState();
    clearRunPlans();
    resetUsageLedgerStore();
    clearArtifactRegistry();
    clearExecutionTimelineStore();
    clearRunEvaluationStore();
    clearEvaluationFeedbackStore();
    clearFeedbackActionPlanStore();
    clearActionPlanExecutionStore();
    clearImprovementOutcomeStore();
    clearLearningMemoryStore();
    clearRecommendationExecutionStore();
    clearImprovementLoopStore();
    clearImprovementLoopGovernanceStore();

    createPlanForTicket('ticket-audit-module-3', 'approval-gated-artifact');
    await startStreamingRun('ticket-audit-module-3');
    for (let guard = 0; guard < 24 && !isStreamComplete(id); guard += 1) await nextStreamTick(id);
    buildTimelineForRun(id);
    const feedback = generateFeedbackForRun(id);
    const plan = createActionPlanFromFeedback(feedback.id);
    const execution = startActionPlanExecution(plan.id);
    completeActionTask(execution.tasks[0].taskId, { type: 'note', title: 'Loop governance fixture', description: 'Completed task for loop governance.', createdBy: 'Smoke test' });
    const baseOutcome = createOutcomeVerification(execution.id);

    const syntheticOutcome = (suffix, dimensions, status = 'improved') => ({
      ...baseOutcome,
      id: `improvement-outcome-governance-${suffix}`,
      actionExecutionId: `governance-${suffix}-action`,
      status,
      targetDimensions: dimensions,
      comparison: {
        beforeRunId: id,
        afterRunId: `${id}-${suffix}`,
        beforeEvaluationId: `before-${suffix}`,
        afterEvaluationId: `after-${suffix}`,
        overallDelta: status === 'improved' ? 8 : -10,
        metricDeltas: dimensions.map((dimension) => ({ dimension, before: 80, after: status === 'improved' ? 90 : 55, delta: status === 'improved' ? 10 : -25, improved: status === 'improved' })),
        comparedAt: new Date().toISOString(),
      },
      evidence: [{ id: `outcome-evidence-governance-${suffix}`, outcomeId: `improvement-outcome-governance-${suffix}`, type: 'metric_delta', title: 'Governance smoke evidence', description: suffix, createdAt: new Date().toISOString() }],
      regressions: [],
      updatedAt: new Date().toISOString(),
    });
    const raw = window.sessionStorage.getItem('uikigai-improvement-outcome-v1');
    const state = raw ? JSON.parse(raw) : { outcomes: {}, updatedAt: new Date().toISOString() };
    const specs = {
      allowed: syntheticOutcome('allowed', ['tool_success'], 'improved'),
      low: syntheticOutcome('low', ['replay_integrity'], 'regressed'),
      repeated: syntheticOutcome('repeated', ['artifact_quality'], 'regressed'),
      attempts: syntheticOutcome('attempts', ['cost_efficiency'], 'regressed'),
      budget: syntheticOutcome('budget', ['tool_success'], 'regressed'),
      approval: syntheticOutcome('approval', ['approval_compliance'], 'regressed'),
      kill: syntheticOutcome('kill', ['approval_compliance'], 'improved'),
      afterKill: syntheticOutcome('after-kill', ['replay_integrity'], 'improved'),
      rollback: syntheticOutcome('rollback', ['governance_compliance'], 'regressed'),
    };
    Object.values(specs).forEach((outcome) => { state.outcomes[outcome.id] = outcome; });
    window.sessionStorage.setItem('uikigai-improvement-outcome-v1', JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));

    const makeRecommendation = (outcome, confidenceDelta = 0) => {
      const recommendation = markRecommendationAccepted(generateRecommendationFromSignal(createLearningSignalFromOutcome(outcome.id).id).id);
      return confidenceDelta ? updateRecommendationConfidence(recommendation.id, confidenceDelta).id : recommendation.id;
    };

    return {
      allowed: makeRecommendation(specs.allowed),
      low: makeRecommendation(specs.low, -90),
      repeated: makeRecommendation(specs.repeated),
      attempts: makeRecommendation(specs.attempts),
      budget: makeRecommendation(specs.budget),
      approval: makeRecommendation(specs.approval),
      kill: makeRecommendation(specs.kill),
      afterKill: makeRecommendation(specs.afterKill),
      rollback: makeRecommendation(specs.rollback),
    };
  }, runId);
}

async function main() {
  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  const rows = [];
  try {
    await page.goto(`${baseUrl}/evaluation`, { waitUntil: 'networkidle' });
    const ids = await prepareRuntime(page);
    await page.goto(`${baseUrl}/evaluation`, { waitUntil: 'networkidle' });
    await page.locator('[data-run-evaluation-route]').waitFor({ timeout: 10000 });

    let allowedLoopId;
    let killLoopId;

    await expectStep(rows, 'allowed loop starts normally', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { createImprovementLoop, startImprovementLoop } = await import('/src/runtime/improvement-loop-store.ts');
        const loop = createImprovementLoop(recommendationId);
        const run = startImprovementLoop(loop.id);
        return { loopId: loop.id, runStatus: run.status };
      }, ids.allowed);
      allowedLoopId = result.loopId;
      assert(result.runStatus === 'running', 'allowed loop did not start');
      return result;
    });

    await expectStep(rows, 'low confidence loop is blocked', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { createImprovementLoop, startImprovementLoop } = await import('/src/runtime/improvement-loop-store.ts');
        const { selectLoopBlockers } = await import('/src/runtime/improvement-loop-governance-store.ts');
        const loop = createImprovementLoop(recommendationId);
        try { startImprovementLoop(loop.id); } catch {}
        return { blockers: selectLoopBlockers(loop.id) };
      }, ids.low);
      assert(result.blockers.includes('confidence_too_low'), 'low confidence blocker missing');
      return result;
    });

    await expectStep(rows, 'repeated failure loop is paused', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { createImprovementLoop, startImprovementLoop, failImprovementLoopRun } = await import('/src/runtime/improvement-loop-store.ts');
        const { selectLoopGovernanceDecision } = await import('/src/runtime/improvement-loop-governance-store.ts');
        const loop = createImprovementLoop(recommendationId);
        const first = startImprovementLoop(loop.id);
        failImprovementLoopRun(first.id, 'first failure');
        const second = startImprovementLoop(loop.id);
        failImprovementLoopRun(second.id, 'second failure');
        try { startImprovementLoop(loop.id); } catch {}
        return selectLoopGovernanceDecision(loop.id);
      }, ids.repeated);
      assert(result.decision === 'PAUSE' && result.reasons.includes('repeated_failure'), 'repeated failure did not pause');
      return { decision: result.decision, reasons: result.reasons };
    });

    await expectStep(rows, 'max attempts exceeded blocks retry', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { createImprovementLoop, startImprovementLoop, failImprovementLoopRun, retryImprovementLoopRun } = await import('/src/runtime/improvement-loop-store.ts');
        const { selectLoopGovernanceDecision } = await import('/src/runtime/improvement-loop-governance-store.ts');
        const loop = createImprovementLoop(recommendationId);
        const r1 = startImprovementLoop(loop.id); failImprovementLoopRun(r1.id, '1');
        const r2 = retryImprovementLoopRun(r1.id); failImprovementLoopRun(r2.id, '2');
        try { retryImprovementLoopRun(r2.id); } catch {}
        return selectLoopGovernanceDecision(loop.id);
      }, ids.attempts);
      assert(result.reasons.includes('max_attempts_exceeded'), 'max attempts reason missing');
      return { decision: result.decision, reasons: result.reasons };
    });

    await expectStep(rows, 'budget exceeded blocks start', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { createImprovementLoop, startImprovementLoop } = await import('/src/runtime/improvement-loop-store.ts');
        const { selectLoopGovernanceDecision } = await import('/src/runtime/improvement-loop-governance-store.ts');
        const loop = createImprovementLoop(recommendationId, 'budget_variance');
        try { startImprovementLoop(loop.id); } catch {}
        return selectLoopGovernanceDecision(loop.id);
      }, ids.budget);
      assert(result.reasons.includes('cost_limit_exceeded'), 'budget block reason missing');
      return { decision: result.decision, reasons: result.reasons };
    });

    await expectStep(rows, 'approval-required loop cannot start before approval', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { createImprovementLoop, startImprovementLoop } = await import('/src/runtime/improvement-loop-store.ts');
        const { selectLoopGovernanceDecision } = await import('/src/runtime/improvement-loop-governance-store.ts');
        const loop = createImprovementLoop(recommendationId);
        try { startImprovementLoop(loop.id); } catch {}
        return selectLoopGovernanceDecision(loop.id);
      }, ids.approval);
      assert(result.decision === 'REQUIRE_REVIEW' && result.reasons.includes('approval_required'), 'approval review missing');
      return { decision: result.decision, reasons: result.reasons };
    });

    await expectStep(rows, 'global kill switch blocks all starts', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { enableGlobalLoopKillSwitch, selectGlobalLoopKillSwitch, selectLoopGovernanceDecision } = await import('/src/runtime/improvement-loop-governance-store.ts');
        const { createImprovementLoop, startImprovementLoop } = await import('/src/runtime/improvement-loop-store.ts');
        enableGlobalLoopKillSwitch('Smoke kill switch.');
        const loop = createImprovementLoop(recommendationId);
        try { startImprovementLoop(loop.id); } catch {}
        return { kill: selectGlobalLoopKillSwitch(), decision: selectLoopGovernanceDecision(loop.id) };
      }, ids.kill);
      killLoopId = result.decision.loopId;
      assert(result.kill.enabled && result.decision.decision === 'KILL', 'kill switch did not block start');
      return { decision: result.decision.decision };
    });

    await expectStep(rows, 'kill switch pauses running loops', async () => {
      const result = await page.evaluate(async () => {
        const { selectPausedByGovernanceLoops } = await import('/src/runtime/improvement-loop-governance-store.ts');
        return selectPausedByGovernanceLoops().map((loop) => loop.id);
      });
      assert(result.length > 0, 'kill switch did not pause loops');
      return { paused: result.length };
    });

    await expectStep(rows, 'disabled kill switch allows eligible loops', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { disableGlobalLoopKillSwitch } = await import('/src/runtime/improvement-loop-governance-store.ts');
        const { createImprovementLoop, startImprovementLoop } = await import('/src/runtime/improvement-loop-store.ts');
        disableGlobalLoopKillSwitch();
        const loop = createImprovementLoop(recommendationId);
        const run = startImprovementLoop(loop.id);
        return { loopId: loop.id, status: run.status };
      }, ids.afterKill);
      assert(result.status === 'running', 'eligible loop did not start after kill switch disabled');
      return result;
    });

    await expectStep(rows, 'rollback required loop exports rollback plan', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { createImprovementLoop, startImprovementLoop } = await import('/src/runtime/improvement-loop-store.ts');
        const { selectRollbackRequiredLoops, exportLoopGovernanceArtifacts } = await import('/src/runtime/improvement-loop-governance-store.ts');
        const loop = createImprovementLoop(recommendationId, 'regression_detected');
        try { startImprovementLoop(loop.id); } catch {}
        const exports = exportLoopGovernanceArtifacts().map((artifact) => artifact.name);
        return { rollback: selectRollbackRequiredLoops().map((item) => item.id), exports };
      }, ids.rollback);
      assert(result.rollback.length > 0 && result.exports.includes('loop-rollback-plan.md'), 'rollback plan export missing');
      return { rollback: result.rollback.length, exports: result.exports.length };
    });

    await expectStep(rows, 'governance audit events persist after reload', async () => {
      await page.reload({ waitUntil: 'networkidle' });
      const result = await page.evaluate(async () => {
        const { selectLoopGovernanceAuditTrail } = await import('/src/runtime/improvement-loop-governance-store.ts');
        return selectLoopGovernanceAuditTrail().length;
      });
      assert(result > 0, 'audit trail did not persist');
      return { auditEvents: result };
    });

    await expectStep(rows, 'blocked loops export artifact reports', async () => {
      const result = await page.evaluate(async () => {
        const { exportLoopGovernanceArtifacts } = await import('/src/runtime/improvement-loop-governance-store.ts');
        return exportLoopGovernanceArtifacts().map((artifact) => artifact.name);
      });
      const required = ['improvement-loop-governance.json', 'loop-governance-audit.md', 'loop-kill-switch-report.md', 'loop-rollback-plan.md', 'blocked-loops.json'];
      assert(required.every((name) => result.includes(name)), 'missing governance export');
      return { exports: result.length };
    });

    await expectStep(rows, 'UI selectors return correct governance summaries', async () => {
      const result = await page.evaluate(async () => {
        const { selectWorkspaceLoopGovernanceSummary, selectGlobalLoopKillSwitch } = await import('/src/domain/selectors.ts');
        return { summary: selectWorkspaceLoopGovernanceSummary(), kill: selectGlobalLoopKillSwitch() };
      });
      assert(result.summary.totalDecisions > 0 && typeof result.kill.enabled === 'boolean', 'selector summary invalid');
      return { decisions: result.summary.totalDecisions, killed: result.summary.killed };
    });

    const failed = rows.filter((row) => row.status !== 'passed');
    writeJson(reportPath, { generatedAt: new Date().toISOString(), route: '/evaluation', rows, passed: rows.length - failed.length, total: rows.length, killLoopId, allowedLoopId });
    if (failed.length) throw new Error(`Improvement loop governance smoke failed ${failed.length}/${rows.length}`);
  } finally {
    await browser.close();
    await stopServer(server);
  }
}

main().catch((error) => {
  let previous = {};
  try { previous = JSON.parse(fs.readFileSync(reportPath, 'utf8')); } catch {}
  writeJson(reportPath, { ...previous, generatedAt: new Date().toISOString(), status: 'failed', error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exit(1);
});
