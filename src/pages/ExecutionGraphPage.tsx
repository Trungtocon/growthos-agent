import { GitBranch, Network, ShieldCheck, Workflow } from 'lucide-react';
import { Badge, Button, PageHeader, Panel } from '../components/ui/DemoPrimitives';
import {
  selectApprovalLineage,
  selectArtifactLineage,
  selectBlockedGraphNodes,
  selectExecutionGraphByRun,
  selectExecutionGraphSummary,
  selectExecutionTraceByRun,
  selectExecutionTimelineByRun,
  selectReplayControlState,
  selectCurrentReplayFrame,
} from '../domain/selectors';
import { DEMO_RUN_ID } from '../data/demo-fixtures';
import { registerExecutionGraphExports } from '../runtime/agent-execution-graph-store';
import type { ExecutionGraphNode } from '../runtime/agent-execution-graph';
import { RunEvaluationCompactWidget } from './EvaluationPage';

function GraphNodePill({ node, index }: { node: ExecutionGraphNode; index: number }) {
  const x = 36 + (index % 4) * 210;
  const y = 36 + Math.floor(index / 4) * 92;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="176" height="58" rx="14" fill={node.type === 'ERROR' ? '#fee2e2' : node.type === 'ARTIFACT' ? '#dcfce7' : node.type === 'APPROVAL' ? '#fef3c7' : '#eff6ff'} stroke={node.type === 'ERROR' ? '#fca5a5' : '#bfdbfe'} />
      <text x="14" y="24" fill="#0f172a" fontSize="12" fontWeight="700">{node.type}</text>
      <text x="14" y="42" fill="#64748b" fontSize="11">{node.label.slice(0, 22)}</text>
    </g>
  );
}

function GraphCanvas({ nodes }: { nodes: ExecutionGraphNode[] }) {
  return (
    <svg viewBox="0 0 900 330" className="h-[330px] w-full">
      <path d="M210 64 H246 M420 64 H456 M630 64 H666 M210 156 H246 M420 156 H456 M630 156 H666 M210 248 H246 M420 248 H456" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="5 5" />
      {nodes.slice(0, 12).map((node, index) => <GraphNodePill key={node.id} node={node} index={index} />)}
    </svg>
  );
}

export function ExecutionGraphPage() {
  const graph = selectExecutionGraphByRun(DEMO_RUN_ID);
  const trace = selectExecutionTraceByRun(DEMO_RUN_ID);
  const summary = selectExecutionGraphSummary(graph.workspaceId);
  const blocked = selectBlockedGraphNodes(DEMO_RUN_ID);
  const artifactLineage = selectArtifactLineage(DEMO_RUN_ID);
  const approvalLineage = selectApprovalLineage(DEMO_RUN_ID);
  const timeline = selectExecutionTimelineByRun(DEMO_RUN_ID);
  const replayControl = selectReplayControlState(DEMO_RUN_ID);
  const replayFrame = selectCurrentReplayFrame(DEMO_RUN_ID);

  return (
    <div data-route="/execution-graph" data-execution-graph-route>
      <RunEvaluationCompactWidget runId={DEMO_RUN_ID} surface="execution-graph" />
      <PageHeader
        title="Agent Execution Graph"
        subtitle="Trace agent runs across plans, steps, tools, artifacts, approvals, usage, cost, and governance decisions."
        actions={<><Button variant="secondary" onClick={() => registerExecutionGraphExports(DEMO_RUN_ID)}>Export graph</Button><Button><GitBranch className="h-4 w-4" />Open trace</Button></>}
      />
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Graphs', value: summary.graphCount, Icon: Network },
          { label: 'Nodes', value: graph.nodes.length, Icon: Workflow },
          { label: 'Edges', value: graph.edges.length, Icon: GitBranch },
          { label: 'Blocked', value: blocked.length, Icon: ShieldCheck },
        ].map(({ label, value, Icon }) => <Panel key={label}><div className="flex items-center gap-3 p-4"><div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-brand-600"><Icon className="h-5 w-5" /></div><div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="text-2xl font-extrabold text-slate-950">{String(value)}</div></div></div></Panel>)}
      </div>
      <div className="mt-5 grid grid-cols-[1.35fr_0.65fr] gap-5">
        <Panel title="Selected Run Graph"><GraphCanvas nodes={graph.nodes} /></Panel>
        <Panel title="Cost / Usage Summary">
          <div className="space-y-3 p-4 text-sm">
            <div className="flex justify-between"><span>Workspace</span><b>{graph.workspaceId}</b></div>
            <div className="flex justify-between"><span>Run</span><b>{graph.runId}</b></div>
            <div className="flex justify-between"><span>Usage records</span><b>{summary.usageRecordCount}</b></div>
            <div className="flex justify-between"><span>Actual cost</span><b>${summary.actualCost.toFixed(3)}</b></div>
            <div className="flex justify-between"><span>Generated</span><b>{graph.generatedAt.slice(0, 16).replace('T', ' ')}</b></div>
          </div>
        </Panel>
      </div>
      <span data-execution-timeline-widget="execution-graph" data-execution-timeline-events={timeline.events.length} data-execution-replay-frames={timeline.replayFrames.length} className="sr-only">
        Execution timeline for graph route: {timeline.events.length} events and {timeline.replayFrames.length} frames.
      </span>
      <span data-execution-replay-widget="execution-graph" data-replay-status={replayControl.status} data-replay-frame={replayControl.selectedFrameIndex} data-replay-event={replayControl.selectedEventId ?? ''} className="sr-only">
        Execution replay for graph route: frame {replayControl.selectedFrameIndex + 1}, status {replayControl.status}, event {replayFrame?.eventId ?? 'none'}.
      </span>
      <div className="mt-5 grid grid-cols-2 gap-5">
        <Panel title="Node List"><div className="max-h-[320px] space-y-2 overflow-hidden p-4 text-sm">{graph.nodes.map((node) => <div key={node.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><span className="font-semibold">{node.label}</span><Badge tone={node.type === 'ERROR' ? 'red' : node.type === 'ARTIFACT' ? 'green' : 'blue'}>{node.type}</Badge></div>)}</div></Panel>
        <Panel title="Edge List"><div className="max-h-[320px] space-y-2 overflow-hidden p-4 text-xs">{graph.edges.map((edge) => <div key={edge.id} className="rounded-lg border border-slate-100 px-3 py-2"><b>{edge.type}</b><div className="mt-1 truncate text-slate-500">{edge.source} {'->'} {edge.target}</div></div>)}</div></Panel>
        <Panel title="Artifact Lineage"><div className="space-y-2 p-4 text-sm">{artifactLineage.slice(0, 6).map((node) => <div key={node.id} className="flex justify-between"><span>{node.label}</span><Badge tone="green">{node.type}</Badge></div>)}</div></Panel>
        <Panel title="Approval Lineage"><div className="space-y-2 p-4 text-sm">{approvalLineage.slice(0, 6).map((node) => <div key={node.id} className="flex justify-between"><span>{node.label}</span><Badge tone="amber">{node.status ?? node.type}</Badge></div>)}</div></Panel>
        <Panel title="Blocked / Failed Nodes"><div className="space-y-2 p-4 text-sm">{blocked.length ? blocked.map((node) => <div key={node.id} className="flex justify-between"><span>{node.label}</span><Badge tone="red">{node.status ?? 'blocked'}</Badge></div>) : <span className="text-slate-500">No blocked nodes for this trace.</span>}</div></Panel>
        <Panel title="Execution Decisions"><div className="space-y-2 p-4 text-sm">{trace.orderedNodes.filter((node) => node.type === 'GOVERNANCE_DECISION').slice(0, 5).map((node) => <div key={node.id} className="flex justify-between"><span>{node.label}</span><Badge tone={node.status === 'ALLOW' ? 'green' : 'amber'}>{node.status ?? 'decision'}</Badge></div>)}</div></Panel>
      </div>
    </div>
  );
}
