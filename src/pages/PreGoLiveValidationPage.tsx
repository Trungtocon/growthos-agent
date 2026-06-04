import { AlertTriangle, CheckCircle2, FileText, PlayCircle, ShieldAlert } from 'lucide-react';
import { Badge, Button, PageHeader, Panel, ProgressBar } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import {
  selectPreGoLiveValidationArtifacts,
  selectPreGoLiveValidationGates,
  selectPreGoLiveValidationSummary,
} from '../domain/selectors';
import {
  exportPreGoLiveValidationArtifacts,
  runFullPreGoLiveValidation,
} from '../runtime/pre-golive-validation-store';
import { AuthReadinessCompactWidget } from './AuthReadinessPage';
import { DatabaseReadinessCompactWidget } from './DatabaseReadinessPage';

type PreGoLiveWidgetSurface =
  | 'production-readiness'
  | 'deployment-config'
  | 'runtime-certification'
  | 'certified-sandbox-run'
  | 'backend-adapter'
  | 'api-contracts'
  | 'e2e-action-flow'
  | 'run';

function toneFor(value: string): Tone {
  if (value.includes('FAILED') || value.includes('fail') || value.includes('BLOCKED') || value.includes('blocked')) return 'red';
  if (value.includes('WARNING') || value.includes('warning') || value.includes('pending')) return 'amber';
  if (value.includes('READY') || value.includes('pass')) return 'green';
  if (value.includes('running')) return 'blue';
  return 'slate';
}

function reload() {
  window.location.reload();
}

export function PreGoLiveValidationCompactWidget({ surface }: { surface: PreGoLiveWidgetSurface }) {
  const summary = selectPreGoLiveValidationSummary();
  return (
    <span
      data-pre-golive-widget={surface}
      data-pre-golive-widget-verdict={summary.finalVerdict}
      data-pre-golive-widget-score={summary.readinessScore}
      data-pre-golive-widget-blockers={summary.blockers.length}
      className="sr-only"
    >
      Pre go-live {surface}: {summary.finalVerdict}, score {summary.readinessScore}, {summary.blockers.length} blockers.
    </span>
  );
}

export function PreGoLiveValidationPage() {
  const summary = selectPreGoLiveValidationSummary();
  const gates = selectPreGoLiveValidationGates();
  const artifacts = selectPreGoLiveValidationArtifacts();

  return (
    <div data-route="/pre-golive-validation" data-pre-golive-validation-route>
      <AuthReadinessCompactWidget surface="pre-golive-validation" />
      <DatabaseReadinessCompactWidget surface="pre-golive-validation" />
      <PageHeader
        title="Pre-Go-Live Validation Suite"
        subtitle="Run the final cross-system gate matrix before any production deployment decision."
        actions={(
          <>
            <Button data-pre-golive-action="run-full-validation" onClick={() => { runFullPreGoLiveValidation(); reload(); }}>
              <PlayCircle className="h-4 w-4" />Run Full Validation
            </Button>
            <Button variant="secondary" data-pre-golive-action="export-go-live-pack" onClick={() => { exportPreGoLiveValidationArtifacts(); reload(); }}>
              <FileText className="h-4 w-4" />Export Go-Live Pack
            </Button>
          </>
        )}
      />

      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Readiness score', value: `${summary.readinessScore}%`, tone: toneFor(summary.finalVerdict) },
          { label: 'Passed', value: summary.passed, tone: 'green' },
          { label: 'Warnings', value: summary.warning, tone: summary.warning ? 'amber' : 'green' },
          { label: 'Blocked', value: summary.blocked, tone: summary.blocked ? 'red' : 'green' },
          { label: 'Failed', value: summary.failed, tone: summary.failed ? 'red' : 'green' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</div>
            <div className="mt-3 flex items-center justify-between gap-3"><b className="text-2xl text-slate-950">{item.value}</b><Badge tone={item.tone as Tone}>{item.label}</Badge></div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[1fr_390px] gap-5">
        <Panel title="Gate Matrix">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-400">
                <tr><th className="px-4 py-3">Gate</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Evidence command</th></tr>
              </thead>
              <tbody>
                {gates.map((gate) => (
                  <tr key={gate.gateId} data-pre-golive-gate={gate.gateId} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3"><b className="block text-slate-950">{gate.name}</b><span className="mt-1 block text-xs text-slate-500">{gate.finalVerdict}</span></td>
                    <td className="px-4 py-3 text-slate-600">{gate.category}</td>
                    <td className="px-4 py-3"><Badge tone={toneFor(gate.status)}>{gate.status}</Badge></td>
                    <td className="px-4 py-3"><b>{gate.score}%</b></td>
                    <td className="max-w-[260px] px-4 py-3 text-xs text-slate-500">{gate.relatedSmokeCommand}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Final Verdict">
            <div className="space-y-4 p-4 text-sm">
              <div className="flex items-center justify-between gap-3"><span>Production decision</span><Badge tone={toneFor(summary.finalVerdict)}>{summary.finalVerdict}</Badge></div>
              <ProgressBar value={summary.readinessScore} tone={toneFor(summary.finalVerdict)} />
              <p className="rounded-xl bg-slate-50 p-3 text-slate-600">This verdict remains blocked until all critical production gates pass. Mock and sandbox evidence stays visible as a warning rather than silently upgrading readiness.</p>
            </div>
          </Panel>

          <Panel title="Blockers">
            <div className="space-y-2 p-4 text-sm">
              {summary.blockers.slice(0, 8).map((item) => <p key={item} className="flex gap-2 rounded-xl bg-red-50 p-3 text-red-700"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />{item}</p>)}
              {!summary.blockers.length ? <p className="flex gap-2 text-green-700"><CheckCircle2 className="h-4 w-4" />No critical blockers.</p> : null}
            </div>
          </Panel>

          <Panel title="Warnings">
            <div className="space-y-2 p-4 text-sm">
              {summary.warnings.slice(0, 8).map((item) => <p key={item} className="flex gap-2 rounded-xl bg-amber-50 p-3 text-amber-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{item}</p>)}
              {!summary.warnings.length ? <p className="text-slate-500">No warnings.</p> : null}
            </div>
          </Panel>
        </div>

        <Panel title="What Remains Before Production">
          <div className="space-y-2 p-4 text-sm">
            {(summary.run?.remainingChecklist ?? ['Run Full Validation to build the production checklist.']).map((item) => <p key={item} className="rounded-xl border border-slate-100 px-3 py-2 text-slate-600">{item}</p>)}
          </div>
        </Panel>

        <Panel title="Evidence & Exported Go-Live Pack">
          <div className="space-y-2 p-4 text-sm">
            {artifacts.map((artifact) => <div key={artifact.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2"><span>{artifact.name}</span><Badge tone="blue">{artifact.type}</Badge></div>)}
            {!artifacts.length ? <p className="text-slate-500">Export the go-live pack after running validation.</p> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
