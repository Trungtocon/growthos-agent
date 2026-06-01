import { useSyncExternalStore } from 'react';
import { ChevronLeft, ChevronRight, Clock3, FileText, History, Pause, Play, RotateCcw, ShieldCheck, TimerReset } from 'lucide-react';
import { Badge, Button, PageHeader, Panel } from '../components/ui/DemoPrimitives';
import { DEMO_RUN_ID } from '../data/demo-fixtures';
import {
  selectCurrentReplayFrame,
  selectExecutionTimelineByRun,
  selectReplayCanStepBackward,
  selectReplayCanStepForward,
  selectReplayControlState,
  selectReplayDebugSnapshot,
  selectReplayFramesByRun,
  selectReplayState,
  selectSelectedTimelineEvent,
  selectTimelineEventsBySeverity,
  selectTimelineEventsBySource,
  selectTimelineSummary,
} from '../domain/selectors';
import {
  jumpToReplayFrame,
  pauseReplay,
  playReplay,
  resetReplay,
  REPLAY_CONTROL_CHANGE_EVENT,
  selectReplayEvent,
  setReplayPlaybackSpeed,
  stepReplayBackward,
  stepReplayForward,
} from '../runtime/execution-replay-control-store';
import type { ReplayPlaybackSpeed } from '../runtime/execution-replay-control';
import { registerExecutionTimelineExports } from '../runtime/execution-timeline-store';
import type { ExecutionTimelineEvent } from '../runtime/execution-timeline';
import { EvaluationFeedbackCompactWidget, FeedbackActionPlanCompactWidget, RunEvaluationCompactWidget } from './EvaluationPage';

function eventTone(event: ExecutionTimelineEvent) {
  if (event.severity === 'danger') return 'red';
  if (event.severity === 'warning') return 'amber';
  if (event.severity === 'success') return 'green';
  return 'blue';
}

function subscribeReplayControl(callback: () => void) {
  window.addEventListener(REPLAY_CONTROL_CHANGE_EVENT, callback);
  return () => window.removeEventListener(REPLAY_CONTROL_CHANGE_EVENT, callback);
}

function replayControlSnapshot() {
  return window.sessionStorage.getItem('uikigai-execution-replay-control-v1') ?? '';
}

function EventRow({ event, index, selected }: { event: ExecutionTimelineEvent; index: number; selected: boolean }) {
  return (
    <button
      type="button"
      data-execution-timeline-event={event.type}
      data-execution-timeline-event-id={event.id}
      data-selected-event={selected ? 'true' : 'false'}
      onClick={() => selectReplayEvent(event.runId, event.id)}
      className={`grid w-full grid-cols-[36px_1fr_112px_96px] gap-3 rounded-xl border p-3 text-left text-sm ${selected ? 'border-brand-300 bg-blue-50/70' : 'border-slate-100 bg-white'}`}
    >
      <div className="grid h-8 w-8 place-items-center rounded-full bg-blue-50 text-xs font-extrabold text-brand-600">{index + 1}</div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <b>{event.title}</b>
          <Badge tone={eventTone(event)}>{event.type}</Badge>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-500">{event.description}</p>
      </div>
      <span className="text-xs font-semibold text-slate-500">{event.timestamp.slice(11, 19)}</span>
      <Badge tone={event.source === 'governance' ? 'purple' : event.source === 'approval' ? 'amber' : event.source === 'usage' ? 'green' : 'blue'}>{event.source}</Badge>
    </button>
  );
}

function ReplayControlBar({ runId, frameCount }: { runId: string; frameCount: number }) {
  const control = selectReplayControlState(runId);
  const canBack = selectReplayCanStepBackward(runId);
  const canForward = selectReplayCanStepForward(runId);
  const frameNumber = frameCount ? control.selectedFrameIndex + 1 : 0;
  return (
    <Panel title="Replay Controls">
      <div data-replay-control-bar data-replay-control-id={`control-${runId}`} className="flex flex-wrap items-center gap-3 p-4">
        <Button data-replay-control="play-pause" variant={control.status === 'playing' ? 'warning' : 'primary'} onClick={() => control.status === 'playing' ? pauseReplay(runId) : playReplay(runId)}>
          {control.status === 'playing' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {control.status === 'playing' ? 'Pause' : 'Play'}
        </Button>
        <Button data-replay-control="step-backward" variant="secondary" disabled={!canBack} onClick={() => stepReplayBackward(runId)}>
          <ChevronLeft className="h-4 w-4" />Prev
        </Button>
        <Button data-replay-control="step-forward" variant="secondary" disabled={!canForward} onClick={() => stepReplayForward(runId)}>
          Next<ChevronRight className="h-4 w-4" />
        </Button>
        <Button data-replay-control="reset" variant="secondary" onClick={() => resetReplay(runId)}>
          <RotateCcw className="h-4 w-4" />Reset
        </Button>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          Speed
          <select data-replay-control="speed" value={control.playbackSpeed} onChange={(event) => setReplayPlaybackSpeed(runId, Number(event.target.value) as ReplayPlaybackSpeed)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold">
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
          </select>
        </label>
        <label className="flex flex-1 items-center gap-3 text-sm font-semibold text-slate-600">
          Frame
          <input data-replay-control="frame-range" aria-label="Replay frame" type="range" min={0} max={Math.max(frameCount - 1, 0)} value={control.selectedFrameIndex} onChange={(event) => jumpToReplayFrame(runId, Number(event.target.value))} className="min-w-[220px] flex-1" />
        </label>
        <div data-replay-frame-progress className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
          {frameNumber}/{frameCount}
        </div>
      </div>
    </Panel>
  );
}

function ReplayDebugInspector({ runId }: { runId: string }) {
  const snapshot = selectReplayDebugSnapshot(runId);
  const event = selectSelectedTimelineEvent(runId);
  const frame = selectCurrentReplayFrame(runId);
  const state = snapshot.state;
  return (
    <Panel title="Debug Inspector">
      <div data-replay-debug-inspector className="grid grid-cols-[1fr_1fr] gap-4 p-4">
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span>Current frame</span><b data-debug-field="current-frame">{frame ? frame.frameIndex : 0}</b></div>
          <div className="flex justify-between"><span>Event</span><Badge tone={event ? eventTone(event) : 'blue'}>{event?.type ?? 'none'}</Badge></div>
          <div className="flex justify-between"><span>Source</span><b data-debug-field="event-source">{event?.source ?? 'none'}</b></div>
          <div className="flex justify-between"><span>Severity</span><b data-debug-field="event-severity">{event?.severity ?? 'none'}</b></div>
          <div className="flex justify-between"><span>Run state</span><b data-debug-field="run-state">{state?.runStatus ?? 'unknown'}</b></div>
          <div className="flex justify-between"><span>Active step</span><b data-debug-field="active-step" className="text-right">{state?.currentStep ?? 'none'}</b></div>
          <div className="flex justify-between"><span>Active tool</span><b data-debug-field="active-tool">{state?.activeTool ?? 'none'}</b></div>
          <div className="flex justify-between"><span>Approval</span><b data-debug-field="approval-state">{state?.approvalStatus ?? 'none'}</b></div>
          <div className="flex justify-between"><span>Governance</span><b data-debug-field="governance-decision">{state?.governanceDecision ?? event?.title ?? 'none'}</b></div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <div className="rounded-xl bg-green-50 p-3"><div className="text-xs text-slate-500">Artifacts</div><b>{snapshot.references.artifacts.length}</b></div>
            <div className="rounded-xl bg-blue-50 p-3"><div className="text-xs text-slate-500">Tools</div><b>{snapshot.references.toolCalls.length}</b></div>
            <div className="rounded-xl bg-amber-50 p-3"><div className="text-xs text-slate-500">Usage</div><b>{snapshot.references.usage.toFixed(1)}</b></div>
            <div className="rounded-xl bg-purple-50 p-3"><div className="text-xs text-slate-500">Cost</div><b>${snapshot.references.cost.toFixed(4)}</b></div>
          </div>
        </div>
        <pre data-replay-debug-json className="max-h-[360px] overflow-hidden rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
          {JSON.stringify(snapshot.raw, null, 2)}
        </pre>
      </div>
    </Panel>
  );
}

export function ExecutionTimelinePage() {
  useSyncExternalStore(subscribeReplayControl, replayControlSnapshot, () => '');
  const timeline = selectExecutionTimelineByRun(DEMO_RUN_ID);
  const frames = selectReplayFramesByRun(DEMO_RUN_ID);
  const replayState = selectReplayState(DEMO_RUN_ID);
  const replayControl = selectReplayControlState(DEMO_RUN_ID);
  const currentFrame = selectCurrentReplayFrame(DEMO_RUN_ID);
  const selectedEvent = selectSelectedTimelineEvent(DEMO_RUN_ID);
  const debugSnapshot = selectReplayDebugSnapshot(DEMO_RUN_ID);
  const summary = selectTimelineSummary(timeline.workspaceId);
  const warnings = selectTimelineEventsBySeverity('warning', DEMO_RUN_ID);
  const governanceEvents = selectTimelineEventsBySource('governance', DEMO_RUN_ID);

  return (
    <div data-route="/execution-timeline" data-execution-timeline-route>
      <RunEvaluationCompactWidget runId={DEMO_RUN_ID} surface="execution-timeline" />
      <EvaluationFeedbackCompactWidget runId={DEMO_RUN_ID} surface="execution-timeline" />
      <FeedbackActionPlanCompactWidget runId={DEMO_RUN_ID} surface="execution-timeline" />
      <PageHeader
        title="Execution Timeline & Replay"
        subtitle="Replay runtime execution across plan steps, tools, artifacts, approvals, usage, cost and governance decisions."
        actions={<><Button variant="secondary" onClick={() => registerExecutionTimelineExports(DEMO_RUN_ID)}>Export replay</Button><Button><Play className="h-4 w-4" />Replay run</Button></>}
      />
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Timeline events', value: timeline.events.length, Icon: History },
          { label: 'Replay frames', value: frames.length, Icon: TimerReset },
          { label: 'Warnings', value: warnings.length, Icon: ShieldCheck },
          { label: 'Governance', value: governanceEvents.length, Icon: Clock3 },
        ].map(({ label, value, Icon }) => (
          <Panel key={label}>
            <div className="flex items-center gap-3 p-4">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-brand-600"><Icon className="h-5 w-5" /></div>
              <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="text-2xl font-extrabold text-slate-950">{String(value)}</div></div>
            </div>
          </Panel>
        ))}
      </div>
      <div className="mt-5">
        <ReplayControlBar runId={DEMO_RUN_ID} frameCount={frames.length} />
      </div>
      <div className="mt-5 grid grid-cols-[1fr_390px] gap-5">
        <Panel title="Vertical Event Timeline">
          <div className="max-h-[660px] space-y-3 overflow-hidden p-4">
            {timeline.events.map((event, index) => <EventRow key={event.id} event={event} index={index} selected={event.id === replayControl.selectedEventId} />)}
          </div>
        </Panel>
        <div className="space-y-5">
          <Panel title="Replay State">
            <div data-replay-state-summary className="space-y-3 p-4 text-sm">
              <div className="flex justify-between"><span>Run</span><b>{timeline.runId}</b></div>
              <div className="flex justify-between"><span>Playback</span><Badge tone={replayControl.status === 'playing' ? 'green' : 'blue'}>{replayControl.status} @ {replayControl.playbackSpeed}x</Badge></div>
              <div className="flex justify-between"><span>Selected event</span><b className="text-right">{selectedEvent?.type ?? 'none'}</b></div>
              <div className="flex justify-between"><span>Current frame</span><b>{currentFrame ? `${currentFrame.frameIndex}/${frames.length}` : '0/0'}</b></div>
              <div className="flex justify-between"><span>Final status</span><Badge tone={replayState?.runStatus === 'failed' ? 'red' : 'green'}>{replayState?.runStatus ?? 'unknown'}</Badge></div>
              <div className="flex justify-between"><span>Current step</span><b>{currentFrame?.state.currentStep ?? replayState?.currentStep ?? 'Ready'}</b></div>
              <div className="flex justify-between"><span>Tools complete</span><b>{currentFrame?.state.completedTools.length ?? replayState?.completedTools.length ?? 0}</b></div>
              <div className="flex justify-between"><span>Artifacts</span><b>{debugSnapshot.references.artifacts.length}</b></div>
              <div className="flex justify-between"><span>Cost</span><b>${debugSnapshot.references.cost.toFixed(4)}</b></div>
            </div>
          </Panel>
          <Panel title="Replay Frames">
            <div className="max-h-[260px] space-y-2 overflow-hidden p-4 text-xs">
              {frames.map((frame) => (
                <button type="button" key={frame.id} data-execution-replay-frame={frame.frameIndex} data-selected-frame={frame.frameIndex === currentFrame?.frameIndex ? 'true' : 'false'} onClick={() => jumpToReplayFrame(frame.runId, frame.frameIndex - 1)} className={`w-full rounded-lg border px-3 py-2 text-left ${frame.frameIndex === currentFrame?.frameIndex ? 'border-brand-300 bg-blue-50' : 'border-slate-100'}`}>
                  <b>Frame {frame.frameIndex}</b>
                  <div className="mt-1 truncate text-slate-500">{frame.title}</div>
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Artifact / Approval / Cost References">
            <div className="grid grid-cols-3 gap-2 p-4 text-center text-xs">
              <div className="rounded-xl bg-green-50 p-3"><FileText className="mx-auto mb-2 h-4 w-4 text-green-600" /><b>{summary.artifactEvents}</b><div>Artifact events</div></div>
              <div className="rounded-xl bg-amber-50 p-3"><ShieldCheck className="mx-auto mb-2 h-4 w-4 text-amber-600" /><b>{summary.approvalEvents}</b><div>Approval events</div></div>
              <div className="rounded-xl bg-blue-50 p-3"><Clock3 className="mx-auto mb-2 h-4 w-4 text-brand-600" /><b>{summary.eventCount}</b><div>Total events</div></div>
            </div>
          </Panel>
        </div>
      </div>
      <div className="mt-5">
        <ReplayDebugInspector runId={DEMO_RUN_ID} />
      </div>
    </div>
  );
}
