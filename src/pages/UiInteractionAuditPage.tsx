import { Download, MousePointerClick, RefreshCw, ShieldCheck } from 'lucide-react';
import { Badge, Button, PageHeader, Panel, ProgressBar } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import {
  exportUiInteractionAuditArtifacts,
  runUiInteractionAudit,
  selectUiInteractionAuditDashboard,
} from '../runtime/ui-interaction-audit-store';

function reload() {
  window.location.reload();
}

function toneFor(value: string | number): Tone {
  const text = String(value);
  if (/pass|100|0$|wired/i.test(text)) return 'green';
  if (/warning|disabled/i.test(text)) return 'amber';
  if (/fail|dead|unwired|error/i.test(text)) return 'red';
  return 'blue';
}

export function UiInteractionAuditPage() {
  const dashboard = selectUiInteractionAuditDashboard();
  const report = dashboard.report;
  const topRoutes = report.routes.slice(0, 18);

  return (
    <div data-route="/ui-interaction-audit" data-ui-interaction-audit-route>
      <PageHeader
        title="UI Interaction Wiring Audit"
        subtitle="Full route and interaction audit for buttons, links, tabs, forms, exports, compact widgets, disabled blockers, and route transitions."
        icon={MousePointerClick}
        actions={(
          <>
            <Button
              data-action-id="ui-interaction.run-full-audit"
              data-action-type="audit"
              aria-label="Run full UI interaction audit"
              onClick={() => { runUiInteractionAudit(); reload(); }}
            >
              <RefreshCw className="h-4 w-4" />Run full audit
            </Button>
            <Button
              variant="secondary"
              data-action-id="ui-interaction.export-audit"
              data-action-type="export"
              aria-label="Export UI interaction audit artifacts"
              onClick={() => { exportUiInteractionAuditArtifacts(); reload(); }}
            >
              <Download className="h-4 w-4" />Export audit
            </Button>
          </>
        )}
      />

      <div className="grid grid-cols-6 gap-4">
        {[
          { label: 'Routes', value: report.totalRoutes },
          { label: 'Elements', value: report.totalElements },
          { label: 'Wired', value: report.wired },
          { label: 'Disabled with reason', value: report.disabledWithReason },
          { label: 'Dead links', value: report.deadLinks },
          { label: 'Coverage', value: `${report.coveragePercent}%` },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <b className="text-xl text-slate-950">{item.value}</b>
              <Badge tone={toneFor(item.value)}>{item.label}</Badge>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[1fr_360px] gap-5">
        <Panel title="Per-route Wiring Matrix">
          <div className="max-h-[670px] overflow-auto p-4" data-ui-interaction-audit-matrix>
            <div className="grid grid-cols-[220px_90px_90px_90px_90px_1fr] gap-2 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              <span>Route</span>
              <span>Score</span>
              <span>Sections</span>
              <span>Elements</span>
              <span>Dead</span>
              <span>Status</span>
            </div>
            {topRoutes.map((route) => {
              const elements = route.sections.flatMap((section) => section.elements);
              const dead = elements.filter((element) => element.status === 'dead_link' || element.status === 'unwired' || element.status === 'error').length;
              return (
                <div key={route.route} className="grid grid-cols-[220px_90px_90px_90px_90px_1fr] gap-2 border-b border-slate-50 py-3 text-sm">
                  <b className="truncate">{route.route}</b>
                  <span>{route.score}%</span>
                  <span>{route.sections.length}</span>
                  <span>{elements.length}</span>
                  <span>{dead}</span>
                  <span><Badge tone={dead ? 'red' : 'green'}>{dead ? 'needs fix' : 'wired'}</Badge></span>
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Final Wiring Percentage">
            <div className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Coverage</span>
                <b>{report.coveragePercent}%</b>
              </div>
              <ProgressBar value={report.coveragePercent} tone={report.coveragePercent === 100 ? 'green' : 'amber'} />
              <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                <ShieldCheck className="mr-2 inline h-4 w-4" />
                {dashboard.summary.finalStatus === 'pass'
                  ? 'All audited interactions are wired or intentionally disabled with a visible reason.'
                  : 'Some interactions still need wiring before production readiness.'}
              </div>
            </div>
          </Panel>

          <Panel title="Blocker Counters">
            <div className="space-y-3 p-4 text-sm">
              {[
                ['Unwired elements', report.unwired],
                ['Dead links', report.deadLinks],
                ['Console errors', report.consoleErrors],
                ['Sections checked', dashboard.summary.sectionCoverage],
                ['Action descriptors', dashboard.summary.actionMapSize],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                  <span>{label}</span>
                  <Badge tone={toneFor(value)}>{value}</Badge>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Audit Exports">
            <div className="space-y-2 p-4 text-sm">
              {(dashboard.artifacts.length ? dashboard.artifacts : [
                { id: 'pending-audit', name: 'ui-interaction-audit.md', type: 'REPORT', summary: 'Export audit artifacts to register evidence.' },
              ]).map((artifact) => (
                <div key={artifact.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <b>{artifact.name}</b>
                    <Badge tone="blue">{artifact.type}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{artifact.summary}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
