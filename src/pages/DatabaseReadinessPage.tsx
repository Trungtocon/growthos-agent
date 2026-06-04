import { Database, FileText, RefreshCw, ScrollText } from 'lucide-react';
import { Badge, Button, PageHeader, Panel, ProgressBar } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import { appendAuditEvent, selectAuditLogSummary } from '../runtime/audit-log-store';
import { createDatabaseClient } from '../runtime/database-client-factory';
import {
  evaluateDatabaseReadiness,
  exportDatabaseReadinessArtifacts,
  getDatabaseReadinessArtifacts,
  getDatabaseReadinessReport,
} from '../runtime/database-readiness';
import { getDatabaseConfigs } from '../runtime/database-config';
import { getPersistenceDomains } from '../runtime/persistence-registry';
import { AuthReadinessCompactWidget } from './AuthReadinessPage';
import { EnvironmentReadinessCompactWidget } from './EnvironmentReadinessPage';
import { GoLiveControlCompactWidget } from './GoLiveControlPage';
import { ProductionConfigEvidenceCompactWidget } from './ProductionConfigEvidencePage';
import { ProductionObservabilityCompactWidget } from './ProductionObservabilityPage';
import { ProductionRunbookCompactWidget } from './ProductionRunbookPage';

type DatabaseWidgetSurface =
  | 'pre-golive-validation'
  | 'backend-readiness'
  | 'production-readiness'
  | 'deployment-config'
  | 'certified-sandbox-run'
  | 'run';

function toneFor(value: string): Tone {
  if (value.includes('BLOCKED') || value.includes('missing') || value.includes('offline') || value.includes('blocked')) return 'red';
  if (value.includes('WARNING') || value.includes('degraded') || value.includes('pending') || value.includes('mock')) return 'amber';
  if (value.includes('READY') || value.includes('connected') || value.includes('up_to_date')) return 'green';
  return 'blue';
}

function reload() {
  window.location.reload();
}

export function DatabaseReadinessCompactWidget({ surface }: { surface: DatabaseWidgetSurface }) {
  const report = getDatabaseReadinessReport('PRODUCTION');
  return (
    <span
      data-database-readiness-widget={surface}
      data-database-readiness-status={report.status}
      data-database-readiness-blockers={report.blockers.length}
      data-database-readiness-audit-writable={report.auditWritable}
      data-database-readiness-schema-version={report.schemaVersion}
      className="sr-only"
    >
      Database readiness {surface}: {report.config.mode}, {report.status}, {report.blockers.length} blockers, audit writable {String(report.auditWritable)}, schema {report.schemaVersion}.
    </span>
  );
}

export function DatabaseReadinessPage() {
  const report = getDatabaseReadinessReport('PRODUCTION');
  const configs = getDatabaseConfigs();
  const domains = report.persistenceDomains.length ? report.persistenceDomains : getPersistenceDomains();
  const audit = selectAuditLogSummary();
  const artifacts = getDatabaseReadinessArtifacts();
  const clients = (['LOCAL', 'SANDBOX', 'STAGING', 'PRODUCTION'] as const).map((environmentId) => createDatabaseClient(environmentId).describe());

  return (
    <div data-route="/database-readiness" data-database-readiness-route>
      <AuthReadinessCompactWidget surface="database-readiness" />
      <EnvironmentReadinessCompactWidget surface="database-readiness" />
      <ProductionConfigEvidenceCompactWidget surface="database-readiness" />
      <ProductionObservabilityCompactWidget surface="database-readiness" />
      <ProductionRunbookCompactWidget surface="database-readiness" />
      <GoLiveControlCompactWidget surface="database-readiness" />
      <PageHeader
        title="Database Readiness"
        subtitle="Production persistence registry, database client factory, audit writability, and schema readiness before real go-live."
        actions={(
          <>
            <Button data-action="check-database-readiness" onClick={() => { evaluateDatabaseReadiness('PRODUCTION'); reload(); }}>
              <RefreshCw className="h-4 w-4" />Check database
            </Button>
            <Button variant="secondary" data-action="export-database-readiness" onClick={() => { exportDatabaseReadinessArtifacts('PRODUCTION'); reload(); }}>
              <FileText className="h-4 w-4" />Export evidence
            </Button>
            <Button variant="secondary" data-action="write-database-audit-event" onClick={() => { appendAuditEvent({ actor: 'operator', action: 'database.readiness.audit_probe', targetType: 'database', targetId: 'db-production', environment: 'PRODUCTION', status: 'success', metadata: { route: '/database-readiness' } }); reload(); }}>
              <ScrollText className="h-4 w-4" />Audit probe
            </Button>
          </>
        )}
      />

      <div className="grid grid-cols-5 gap-4" data-database-readiness-summary>
        {[
          { label: 'DB mode', value: report.config.mode, tone: toneFor(report.config.mode) },
          { label: 'Health', value: report.connectionHealth, tone: toneFor(report.connectionHealth) },
          { label: 'Schema', value: report.schemaVersion, tone: toneFor(report.schemaVersion) },
          { label: 'Migration', value: report.migrationStatus, tone: toneFor(report.migrationStatus) },
          { label: 'Score', value: `${report.readinessScore}%`, tone: toneFor(report.status) },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</div>
            <div className="mt-3 flex items-center justify-between gap-3"><b className="truncate text-2xl text-slate-950">{item.value}</b><Badge tone={item.tone as Tone}>{item.label}</Badge></div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[1fr_390px] gap-5">
        <Panel title="Database Config Registry">
          <div className="grid grid-cols-5 gap-3 p-4 text-sm">
            {configs.map((config) => (
              <div key={config.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-start justify-between gap-3"><b>{config.name}</b><Badge tone={toneFor(config.readiness)}>{config.readiness}</Badge></div>
                <p className="mt-2 text-xs text-slate-500">{config.provider}</p>
                <p className="mt-1 truncate text-xs text-slate-400">{config.hostLabel}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Readiness Status">
          <div className="space-y-4 p-4 text-sm">
            <div className="flex items-center justify-between"><span>Production database</span><Badge tone={toneFor(report.status)}>{report.status}</Badge></div>
            <ProgressBar value={report.readinessScore} tone={toneFor(report.status)} />
            <div className="flex items-center justify-between"><span>Audit writable</span><Badge tone={report.auditWritable ? 'green' : 'red'}>{report.auditWritable ? 'yes' : 'no'}</Badge></div>
            <p className="rounded-xl bg-slate-50 p-3 text-slate-600">{report.blockers[0] ?? report.warnings[0] ?? 'Database readiness is clear.'}</p>
          </div>
        </Panel>

        <Panel title="Persistence Domain Matrix">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-400">
                <tr><th className="px-4 py-3">Domain</th><th className="px-4 py-3">Table</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Required</th><th className="px-4 py-3">Readiness</th></tr>
              </thead>
              <tbody>
                {domains.map((domain) => (
                  <tr key={domain.domainId} data-persistence-domain-row={domain.domainId} className="border-b border-slate-100">
                    <td className="px-4 py-3"><b>{domain.domainId}</b><p className="text-xs text-slate-500">{domain.recordCountEstimate} records estimated</p></td>
                    <td className="px-4 py-3">{domain.tableName}</td>
                    <td className="px-4 py-3">{domain.owner}</td>
                    <td className="px-4 py-3">{domain.requiredForProduction ? 'yes' : 'no'}</td>
                    <td className="px-4 py-3"><Badge tone={toneFor(domain.readiness)}>{domain.readiness}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Audit Log Status">
            <div className="space-y-3 p-4 text-sm">
              <div className="flex items-center justify-between"><span>Writable</span><Badge tone={audit.writable ? 'green' : 'red'}>{audit.writable ? 'yes' : 'no'}</Badge></div>
              <div className="flex items-center justify-between"><span>Events</span><b>{audit.total}</b></div>
              <p className="rounded-xl bg-slate-50 p-3 text-slate-600">{audit.lastEvent?.action ?? 'No audit event recorded yet.'}</p>
            </div>
          </Panel>

          <Panel title="Client Factory">
            <div className="space-y-2 p-4 text-sm">
              {clients.map((client) => (
                <div key={client.environmentId} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <span>{client.environmentId}</span><Badge tone={client.configured ? 'green' : 'amber'}>{client.mode}</Badge>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Blockers & Warnings">
            <div className="max-h-[280px] space-y-2 overflow-hidden p-4 text-sm">
              {report.blockers.slice(0, 6).map((blocker) => <p key={blocker} className="rounded-xl bg-red-50 p-3 text-red-700">{blocker}</p>)}
              {report.warnings.slice(0, 4).map((warning) => <p key={warning} className="rounded-xl bg-amber-50 p-3 text-amber-700">{warning}</p>)}
            </div>
          </Panel>

          <Panel title="Exports">
            <div className="space-y-2 p-4 text-sm">
              {artifacts.map((artifact) => <div key={artifact.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><span>{artifact.name}</span><Badge tone="blue">{artifact.type}</Badge></div>)}
              {!artifacts.length ? <p className="text-slate-500">Export database readiness to register evidence artifacts.</p> : null}
            </div>
          </Panel>
        </div>
      </div>

      <span className="sr-only" data-database-readiness-status={report.status} data-database-readiness-score={report.readinessScore}>
        Database readiness {report.status}, score {report.readinessScore}. <Database className="h-4 w-4" />
      </span>
    </div>
  );
}
