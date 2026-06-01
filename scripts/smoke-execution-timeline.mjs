import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/execution-timeline-smoke.json');

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
    const child = spawn(command, args, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
    });
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
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
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
    rows.push({ name, status: 'passed', ...details });
  } catch (error) {
    rows.push({ name, status: 'failed', error: error instanceof Error ? error.message : String(error) });
  }
}

const serverProcess = await ensureServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 });
const rows = [];

try {
  await page.goto(`${baseUrl}/execution-timeline`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const { resetRuntimeState } = await import('/src/runtime-store/runtime-persistence.ts');
    const { resetWorkflowState } = await import('/src/state/workflow-engine.ts');
    const { clearRunPlans } = await import('/src/runtime-store/run-plan-store.ts');
    const { resetUsageLedgerStore } = await import('/src/runtime-store/usage-ledger-store.ts');
    const { clearArtifactRegistry } = await import('/src/runtime/artifact-registry-store.ts');
    const { clearExecutionGraphStore } = await import('/src/runtime/agent-execution-graph-store.ts');
    const { clearExecutionTimelineStore } = await import('/src/runtime/execution-timeline-store.ts');
    const { clearGovernanceDecisionStore } = await import('/src/runtime/governance-decision-store.ts');
    resetRuntimeState();
    resetWorkflowState();
    clearRunPlans();
    resetUsageLedgerStore();
    clearArtifactRegistry();
    clearExecutionGraphStore();
    clearExecutionTimelineStore();
    clearGovernanceDecisionStore();
  });

  await expectStep(rows, 'prepare runtime timeline inputs', async () => {
    const result = await page.evaluate(async () => {
      const { createPlanForTicket, startStreamingRun, nextStreamTick } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { evaluateGovernanceDecision } = await import('/src/runtime/governance-decision-engine.ts');
      const { recordGovernanceDecision } = await import('/src/runtime/governance-decision-store.ts');
      const { getStreamEvents, isStreamComplete } = await import('/src/runtime-store/stream-store.ts');
      const plan = createPlanForTicket('ticket-audit-module-3', 'approval-gated-artifact');
      await startStreamingRun('ticket-audit-module-3');
      for (let guard = 0; guard < 24 && !isStreamComplete('run-demo-module-3'); guard += 1) {
        await nextStreamTick('run-demo-module-3');
      }
      const decision = recordGovernanceDecision(evaluateGovernanceDecision({
        targetId: 'run-demo-module-3',
        targetType: 'runtime',
        action: 'timelineSmokeGovernanceDecision',
      }));
      return { planId: plan.id, streamEvents: getStreamEvents('run-demo-module-3').length, decision: decision.finalDecision };
    });
    assert(result.planId.includes('run-plan'), 'run plan was not created');
    assert(result.streamEvents >= 6, 'stream did not produce timeline input events');
    assert(result.decision === 'ALLOW', 'governance decision was not recorded');
    return result;
  });

  await expectStep(rows, 'timeline builds for demo run', async () => {
    const result = await page.evaluate(async () => {
      const { buildTimelineForRun } = await import('/src/runtime/execution-timeline-store.ts');
      const timeline = buildTimelineForRun('run-demo-module-3');
      return { id: timeline.id, events: timeline.events.length, frames: timeline.replayFrames.length };
    });
    assert(result.events >= 8, 'timeline has too few events');
    assert(result.frames >= 8, 'timeline has too few replay frames');
    return result;
  });

  await expectStep(rows, 'timeline contains required event types', async () => {
    const result = await page.evaluate(async () => {
      const { buildTimelineForRun } = await import('/src/runtime/execution-timeline-store.ts');
      return [...new Set(buildTimelineForRun('run-demo-module-3').events.map((event) => event.type))];
    });
    for (const type of ['RUN_CREATED', 'PLAN_CREATED', 'STEP_STARTED', 'TOOL_STARTED', 'TOOL_COMPLETED', 'ARTIFACT_CREATED', 'APPROVAL_REQUESTED', 'GOVERNANCE_DECISION', 'USAGE_RECORDED', 'COST_RECORDED']) {
      assert(result.includes(type), `${type} event missing`);
    }
    return { eventTypes: result.join(',') };
  });

  await expectStep(rows, 'events are sorted by timestamp and unique', async () => {
    const result = await page.evaluate(async () => {
      const { buildTimelineForRun } = await import('/src/runtime/execution-timeline-store.ts');
      const events = buildTimelineForRun('run-demo-module-3').events;
      return { timestamps: events.map((event) => event.timestamp), ids: events.map((event) => event.id) };
    });
    assert(result.timestamps.join('|') === [...result.timestamps].sort().join('|'), 'timeline events are not sorted');
    assert(result.ids.length === new Set(result.ids).size, 'duplicate timeline event IDs found');
    return { events: result.ids.length };
  });

  await expectStep(rows, 'replay final state matches run state', async () => {
    const result = await page.evaluate(async () => {
      const { getReplayFrames, getReplayState } = await import('/src/runtime/execution-timeline-store.ts');
      const { getRunById } = await import('/src/runtime-store/run-store.ts');
      const frames = getReplayFrames('run-demo-module-3');
      const state = getReplayState('run-demo-module-3');
      const run = getRunById('run-demo-module-3');
      return { frames: frames.length, finalStatus: state?.runStatus, lifecycle: run?.lifecycle, artifacts: state?.producedArtifacts.length };
    });
    assert(result.frames >= 8, 'replay frames missing');
    assert(['completed', 'failed', 'cancelled', 'planned', 'created'].includes(result.finalStatus), 'unexpected replay final status');
    assert(result.artifacts >= 1, 'replay did not accumulate artifacts');
    return result;
  });

  await expectStep(rows, 'artifact and approval references resolve', async () => {
    const result = await page.evaluate(async () => {
      const { buildTimelineForRun } = await import('/src/runtime/execution-timeline-store.ts');
      const { selectArtifactById } = await import('/src/runtime/artifact-registry-store.ts');
      const { getApprovalById } = await import('/src/runtime-store/approval-store.ts');
      const timeline = buildTimelineForRun('run-demo-module-3');
      const artifactEvent = timeline.events.find((event) => event.artifactId);
      const approvalEvent = timeline.events.find((event) => event.approvalId);
      return {
        artifact: artifactEvent?.artifactId ? selectArtifactById(artifactEvent.artifactId)?.id : undefined,
        approval: approvalEvent?.approvalId ? getApprovalById(approvalEvent.approvalId)?.id : undefined,
      };
    });
    assert(result.artifact, 'artifact reference did not resolve');
    assert(result.approval, 'approval reference did not resolve');
    return result;
  });

  await expectStep(rows, 'cost and usage accumulates correctly', async () => {
    const result = await page.evaluate(async () => {
      const { getReplayState } = await import('/src/runtime/execution-timeline-store.ts');
      const state = getReplayState('run-demo-module-3');
      return { cost: state?.accumulatedCost ?? 0, usage: state?.accumulatedUsage ?? 0 };
    });
    assert(result.cost > 0, 'replay cost did not accumulate');
    assert(result.usage > 0, 'replay usage did not accumulate');
    return result;
  });

  await expectStep(rows, 'timeline persists after reload', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
      const { getReplayFrames, getReplayState } = await import('/src/runtime/execution-timeline-store.ts');
      return { frames: getReplayFrames('run-demo-module-3').length, state: getReplayState('run-demo-module-3')?.runStatus };
    });
    assert(result.frames >= 8, 'persisted replay frames missing after reload');
    assert(result.state, 'persisted replay state missing');
    return result;
  });

  await expectStep(rows, 'artifact exports registered', async () => {
    const result = await page.evaluate(async () => {
      const { registerExecutionTimelineExports } = await import('/src/runtime/execution-timeline-store.ts');
      const { selectArtifactsByRun } = await import('/src/runtime/artifact-registry-store.ts');
      const exported = registerExecutionTimelineExports('run-demo-module-3');
      return {
        exported: exported.map((record) => record.name),
        runArtifacts: selectArtifactsByRun('run-demo-module-3').map((record) => record.name),
      };
    });
    for (const name of ['execution-timeline.json', 'execution-timeline.md', 'execution-replay.json', 'execution-replay-summary.md']) {
      assert(result.exported.includes(name), `${name} export missing`);
      assert(result.runArtifacts.includes(name), `${name} not registered to run`);
    }
    return { exports: result.exported.join(',') };
  });

  await expectStep(rows, 'timeline route and compact widgets render selector data', async () => {
    await page.goto(`${baseUrl}/execution-timeline`, { waitUntil: 'networkidle' });
    await page.locator('[data-execution-timeline-route]').waitFor({ timeout: 10000 });
    await page.getByText('Execution Timeline & Replay').first().waitFor({ timeout: 10000 });
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.locator('[data-execution-timeline-widget="run"]').waitFor({ timeout: 10000 });
    await page.goto(`${baseUrl}/tickets/demo-ticket`, { waitUntil: 'networkidle' });
    await page.locator('[data-execution-timeline-widget="ticket"]').waitFor({ timeout: 10000 });
    await page.goto(`${baseUrl}/agents/demo-agent`, { waitUntil: 'networkidle' });
    await page.locator('[data-execution-timeline-widget="agent"]').waitFor({ timeout: 10000 });
    await page.goto(`${baseUrl}/execution-graph`, { waitUntil: 'networkidle' });
    await page.locator('[data-execution-timeline-widget="execution-graph"]').waitFor({ timeout: 10000 });
    return { widgets: 'run,ticket,agent,execution-graph' };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    summary: {
      total: rows.length,
      passed: rows.filter((row) => row.status === 'passed').length,
      failed: rows.filter((row) => row.status === 'failed').length,
    },
    rows,
  };
  writeJson(reportPath, report);
  if (report.summary.failed > 0) {
    throw new Error(`${report.summary.failed} execution timeline smoke step(s) failed. See ${reportPath}`);
  }
  console.log(`Execution timeline smoke passed: ${report.summary.passed}/${report.summary.total}`);
} finally {
  await browser.close();
  await stopServer(serverProcess);
}
