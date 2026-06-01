import { Clock3, FileText, History, Play, ShieldCheck, TimerReset } from 'lucide-react';
import { Badge, Button, PageHeader, Panel } from '../components/ui/DemoPrimitives';
import { DEMO_RUN_ID } from '../data/demo-fixtures';
import {
  selectExecutionTimelineByRun,
  selectReplayFramesByRun,
  selectReplayState,
  selectTimelineEventsBySeverity,
  selectTimelineEventsBySource,
  selectTimelineSummary,
} from '../domain/selectors';
import { registerExecutionTimelineExports } from '../runtime/execution-timeline-store';
import type { ExecutionTimelineEvent } from '../runtime/execution-timeline';

function eventTone(event: ExecutionTimelineEvent) {
  if (event.severity === 'danger') return 'red';
  if (event.severity === 'warning') return 'amber';
  if (event.severity === 'success') return 'green';
  return 'blue';
}

function EventRow({ event, index }: { event: ExecutionTimelineEvent; index: number }) {
  return (
    <div data-execution-timeline-event={event.type} className="grid grid-cols-[36px_1fr_112px_96px] gap-3 rounded-xl border border-slate-100 bg-white p-3 text-sm">
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
    </div>
  );
}

export function ExecutionTimelinePage() {
  const timeline = selectExecutionTimelineByRun(DEMO_RUN_ID);
  const frames = selectReplayFramesByRun(DEMO_RUN_ID);
  const replayState = selectReplayState(DEMO_RUN_ID);
  const summary = selectTimelineSummary(timeline.workspaceId);
  const warnings = selectTimelineEventsBySeverity('warning', DEMO_RUN_ID);
  const governanceEvents = selectTimelineEventsBySource('governance', DEMO_RUN_ID);

  return (
    <div data-route="/execution-timeline" data-execution-timeline-route>
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
      <div className="mt-5 grid grid-cols-[1fr_390px] gap-5">
        <Panel title="Vertical Event Timeline">
          <div className="max-h-[660px] space-y-3 overflow-hidden p-4">
            {timeline.events.map((event, index) => <EventRow key={event.id} event={event} index={index} />)}
          </div>
        </Panel>
        <div className="space-y-5">
          <Panel title="Replay State">
            <div className="space-y-3 p-4 text-sm">
              <div className="flex justify-between"><span>Run</span><b>{timeline.runId}</b></div>
              <div className="flex justify-between"><span>Final status</span><Badge tone={replayState?.runStatus === 'failed' ? 'red' : 'green'}>{replayState?.runStatus ?? 'unknown'}</Badge></div>
              <div className="flex justify-between"><span>Current step</span><b>{replayState?.currentStep ?? 'Ready'}</b></div>
              <div className="flex justify-between"><span>Tools complete</span><b>{replayState?.completedTools.length ?? 0}</b></div>
              <div className="flex justify-between"><span>Artifacts</span><b>{replayState?.producedArtifacts.length ?? 0}</b></div>
              <div className="flex justify-between"><span>Cost</span><b>${(replayState?.accumulatedCost ?? 0).toFixed(4)}</b></div>
            </div>
          </Panel>
          <Panel title="Replay Frames">
            <div className="max-h-[260px] space-y-2 overflow-hidden p-4 text-xs">
              {frames.map((frame) => (
                <div key={frame.id} data-execution-replay-frame={frame.frameIndex} className="rounded-lg border border-slate-100 px-3 py-2">
                  <b>Frame {frame.frameIndex}</b>
                  <div className="mt-1 truncate text-slate-500">{frame.title}</div>
                </div>
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
    </div>
  );
}
