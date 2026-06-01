import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/execution-replay-control-smoke.json');
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
    const { clearExecutionGraphStore } = await import('/src/runtime/agent-execution-graph-store.ts');
    const { clearExecutionTimelineStore, buildTimelineForRun } = await import('/src/runtime/execution-timeline-store.ts');
    const { clearExecutionReplayControlStore } = await import('/src/runtime/execution-replay-control-store.ts');
    const { clearGovernanceDecisionStore } = await import('/src/runtime/governance-decision-store.ts');
    const { createPlanForTicket, startStreamingRun, nextStreamTick } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
    const { evaluateGovernanceDecision } = await import('/src/runtime/governance-decision-engine.ts');
    const { recordGovernanceDecision } = await import('/src/runtime/governance-decision-store.ts');
    const { isStreamComplete } = await import('/src/runtime-store/stream-store.ts');
    resetRuntimeState();
    resetWorkflowState();
    clearRunPlans();
    resetUsageLedgerStore();
    clearArtifactRegistry();
    clearExecutionGraphStore();
    clearExecutionTimelineStore();
    clearExecutionReplayControlStore();
    clearGovernanceDecisionStore();
    createPlanForTicket('ticket-audit-module-3', 'approval-gated-artifact');
    await startStreamingRun('ticket-audit-module-3');
    for (let guard = 0; guard < 24 && !isStreamComplete(id); guard += 1) {
      await nextStreamTick(id);
    }
    recordGovernanceDecision(evaluateGovernanceDecision({
      targetId: id,
      targetType: 'runtime',
      action: 'replayControlSmokeGovernanceDecision',
    }));
    return buildTimelineForRun(id).replayFrames.length;
  }, runId);
}

const serverProcess = await ensureServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 });
const rows = [];

try {
  await page.goto(`${baseUrl}/execution-timeline`, { waitUntil: 'networkidle' });
  const frameCount = await prepareRuntime(page);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-replay-control-bar]').waitFor({ timeout: 10000 });

  await expectStep(rows, 'control state initializes', async () => {
    const result = await page.evaluate(async (id) => {
      const { getReplayControlState, getCurrentReplayFrame } = await import('/src/runtime/execution-replay-control-store.ts');
      const control = getReplayControlState(id);
      const frame = getCurrentReplayFrame(id);
      return { status: control.status, speed: control.playbackSpeed, frame: control.selectedFrameIndex, event: control.selectedEventId, frameEvent: frame?.eventId };
    }, runId);
    assert(result.status === 'paused', 'replay did not initialize paused');
    assert(result.speed === 1, 'default playback speed is not 1x');
    assert(result.frame === 0, 'initial frame is not zero');
    assert(result.event === result.frameEvent, 'selected event does not match initial frame');
    return result;
  });

  await expectStep(rows, 'play changes state to playing', async () => {
    await page.locator('[data-replay-control="play-pause"]').click();
    const result = await page.evaluate(async (id) => {
      const { getReplayControlState } = await import('/src/runtime/execution-replay-control-store.ts');
      return getReplayControlState(id).status;
    }, runId);
    assert(result === 'playing', 'play did not set playing state');
    return { status: result };
  });

  await expectStep(rows, 'pause changes state to paused', async () => {
    await page.locator('[data-replay-control="play-pause"]').click();
    const result = await page.evaluate(async (id) => {
      const { getReplayControlState } = await import('/src/runtime/execution-replay-control-store.ts');
      return getReplayControlState(id).status;
    }, runId);
    assert(result === 'paused', 'pause did not set paused state');
    return { status: result };
  });

  await expectStep(rows, 'step forward increments frame', async () => {
    await page.locator('[data-replay-control="step-forward"]').click();
    const result = await page.evaluate(async (id) => {
      const { getReplayControlState } = await import('/src/runtime/execution-replay-control-store.ts');
      return getReplayControlState(id).selectedFrameIndex;
    }, runId);
    assert(result === 1, 'step forward did not increment frame');
    return { frame: result };
  });

  await expectStep(rows, 'step backward decrements frame', async () => {
    await page.locator('[data-replay-control="step-backward"]').click();
    const result = await page.evaluate(async (id) => {
      const { getReplayControlState } = await import('/src/runtime/execution-replay-control-store.ts');
      return getReplayControlState(id).selectedFrameIndex;
    }, runId);
    assert(result === 0, 'step backward did not decrement frame');
    return { frame: result };
  });

  await expectStep(rows, 'jump to frame works', async () => {
    const target = Math.min(3, Math.max(frameCount - 1, 0));
    const result = await page.evaluate(async ({ id, targetFrame }) => {
      const { jumpToReplayFrame, getReplayControlState, getCurrentReplayFrame } = await import('/src/runtime/execution-replay-control-store.ts');
      jumpToReplayFrame(id, targetFrame);
      const control = getReplayControlState(id);
      return { frame: control.selectedFrameIndex, event: control.selectedEventId, frameEvent: getCurrentReplayFrame(id)?.eventId };
    }, { id: runId, targetFrame: target });
    assert(result.frame === target, 'jump did not set target frame');
    assert(result.event === result.frameEvent, 'jump did not sync selected event');
    return result;
  });

  await expectStep(rows, 'reset returns frame 0', async () => {
    await page.locator('[data-replay-control="reset"]').click();
    const result = await page.evaluate(async (id) => {
      const { getReplayControlState } = await import('/src/runtime/execution-replay-control-store.ts');
      return getReplayControlState(id).selectedFrameIndex;
    }, runId);
    assert(result === 0, 'reset did not return frame zero');
    return { frame: result };
  });

  await expectStep(rows, 'speed selector persists', async () => {
    await page.locator('[data-replay-control="speed"]').selectOption('2');
    const beforeReload = await page.evaluate(async (id) => {
      const { getReplayControlState } = await import('/src/runtime/execution-replay-control-store.ts');
      return getReplayControlState(id).playbackSpeed;
    }, runId);
    await page.reload({ waitUntil: 'networkidle' });
    const afterReload = await page.evaluate(async (id) => {
      const { getReplayControlState } = await import('/src/runtime/execution-replay-control-store.ts');
      return getReplayControlState(id).playbackSpeed;
    }, runId);
    assert(beforeReload === 2 && afterReload === 2, 'playback speed did not persist');
    return { beforeReload, afterReload };
  });

  await expectStep(rows, 'selected event updates inspector', async () => {
    const thirdEvent = page.locator('[data-execution-timeline-event-id]').nth(2);
    const eventId = await thirdEvent.getAttribute('data-execution-timeline-event-id');
    await thirdEvent.click();
    const result = await page.evaluate(async (id) => {
      const { getReplayControlState, getSelectedTimelineEvent } = await import('/src/runtime/execution-replay-control-store.ts');
      return { selectedEventId: getReplayControlState(id).selectedEventId, eventType: getSelectedTimelineEvent(id)?.type };
    }, runId);
    assert(result.selectedEventId === eventId, 'selected event id did not update');
    assert(Boolean(result.eventType), 'inspector selected event did not resolve');
    await page.locator('[data-replay-debug-inspector]').waitFor({ timeout: 10000 });
    return result;
  });

  await expectStep(rows, 'debug snapshot resolves artifact/tool/approval/cost links', async () => {
    const result = await page.evaluate(async (id) => {
      const { jumpToReplayFrame, getReplayDebugSnapshot } = await import('/src/runtime/execution-replay-control-store.ts');
      const { getReplayFrames } = await import('/src/runtime/execution-timeline-store.ts');
      const frames = getReplayFrames(id);
      jumpToReplayFrame(id, frames.length - 1);
      const snapshot = getReplayDebugSnapshot(id);
      return {
        frame: snapshot.frame?.frameIndex,
        artifacts: snapshot.references.artifacts.length,
        tools: snapshot.references.toolCalls.length,
        approvals: snapshot.references.approvals.length,
        cost: snapshot.references.cost,
        usage: snapshot.references.usage,
      };
    }, runId);
    assert(result.artifacts >= 1, 'debug snapshot did not resolve artifacts');
    assert(result.tools >= 1, 'debug snapshot did not resolve tools');
    assert(result.cost > 0, 'debug snapshot did not resolve cost');
    assert(result.usage > 0, 'debug snapshot did not resolve usage');
    return result;
  });

  await expectStep(rows, 'reload restores replay control state', async () => {
    const before = await page.evaluate(async (id) => {
      const { getReplayControlState } = await import('/src/runtime/execution-replay-control-store.ts');
      return getReplayControlState(id);
    }, runId);
    await page.reload({ waitUntil: 'networkidle' });
    const after = await page.evaluate(async (id) => {
      const { getReplayControlState } = await import('/src/runtime/execution-replay-control-store.ts');
      return getReplayControlState(id);
    }, runId);
    assert(after.selectedFrameIndex === before.selectedFrameIndex, 'selected frame was not restored');
    assert(after.playbackSpeed === before.playbackSpeed, 'speed was not restored');
    return { frame: after.selectedFrameIndex, speed: after.playbackSpeed };
  });

  await expectStep(rows, 'no duplicate control IDs', async () => {
    const result = await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('[data-replay-control-id]')).map((node) => node.getAttribute('data-replay-control-id'));
      return { count: ids.length, unique: new Set(ids).size, ids };
    });
    assert(result.count === result.unique, 'duplicate replay control IDs found');
    return result;
  });

  await expectStep(rows, 'compact replay widgets render', async () => {
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.locator('[data-execution-replay-widget="run"]').waitFor({ timeout: 10000 });
    await page.goto(`${baseUrl}/execution-graph`, { waitUntil: 'networkidle' });
    await page.locator('[data-execution-replay-widget="execution-graph"]').waitFor({ timeout: 10000 });
    return { widgets: 'run,execution-graph' };
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
    throw new Error(`${report.summary.failed} execution replay control smoke step(s) failed. See ${reportPath}`);
  }
  console.log(`Execution replay control smoke passed: ${report.summary.passed}/${report.summary.total}`);
} finally {
  await browser.close();
  await stopServer(serverProcess);
}
