import { AlertTriangle, CheckCircle2, Download, FileText, MessageSquare, PhoneCall, RefreshCw, UserCheck } from 'lucide-react';
import { Badge, Button, PageHeader, Panel } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import {
  acknowledgeSupportTicket,
  addCustomerImpactNote,
  addInternalSupportNote,
  assignSupportOwner,
  closeSupportTicket,
  createSupportTicket,
  escalateSupportTicket,
  exportSupportPack,
  linkTicketToIncident,
  markSupportSlaBreached,
  markSupportSlaNearingBreach,
  markWaitingCustomer,
  markWaitingInternal,
  resolveSupportTicket,
  selectProductionSupportDashboard,
} from '../runtime/production-support-store';
import { ProductionOperationsCompactWidget } from './ProductionOperationsPage';

type SupportWidgetSurface =
  | 'production-incidents'
  | 'go-live-control'
  | 'production-runbook'
  | 'production-observability'
  | 'production-readiness'
  | 'pre-golive-validation'
  | 'backend-readiness'
  | 'runtime-certification'
  | 'certified-sandbox-run'
  | 'deployment-config';

function toneFor(value: string): Tone {
  if (/ready|closed|resolved|within/i.test(value)) return 'green';
  if (/warning|waiting|nearing|acknowledged|investigating/i.test(value)) return 'amber';
  if (/critical|breached|SEV0|SEV1|blocked|escalated/i.test(value)) return 'red';
  return 'slate';
}

function reload() {
  window.location.reload();
}

export function ProductionSupportCompactWidget({ surface }: { surface: SupportWidgetSurface }) {
  const dashboard = selectProductionSupportDashboard();
  return (
    <span
      data-production-support-widget
      data-production-support-surface={surface}
      data-production-support-status={dashboard.status}
      data-production-support-open={dashboard.openCount}
      data-production-support-critical={dashboard.criticalCount}
      data-production-support-breached-sla={dashboard.breachedSlaCount}
      className="sr-only"
    >
      Production support {surface}: {dashboard.status}, {dashboard.openCount} open, {dashboard.criticalCount} critical.
    </span>
  );
}

export function ProductionSupportPage() {
  const dashboard = selectProductionSupportDashboard();
  const active = dashboard.openTickets[0] ?? dashboard.tickets[0];
  const canUseTicket = Boolean(active);
  const canResolve = Boolean(active && active.status !== 'resolved' && active.status !== 'closed');
  const canClose = Boolean(active && active.status === 'resolved' && active.resolutionSummary);

  return (
    <div data-route="/production-support" data-production-support-route>
      <ProductionOperationsCompactWidget surface="production-support" />
      <PageHeader
        title="Production Support Desk & Customer Impact Center"
        subtitle="Customer-impact support desk tied to production incidents, SLA state, escalation, communication drafts, and go-live readiness blockers."
        actions={(
          <>
            <Button data-action="createSupportTicket" onClick={() => { createSupportTicket({ severity: 'SEV1', priority: 'critical', customerName: 'Acme Enterprise', impactLevel: 'critical', customerMessage: 'Runtime automation is unavailable for customer workspace.' }); reload(); }}>
              <PhoneCall className="h-4 w-4" />Create support ticket
            </Button>
            <Button variant="secondary" data-action="acknowledgeSupportTicket" disabled={!canUseTicket} data-disabled-reason={!canUseTicket ? 'Create a support ticket before acknowledging.' : undefined} title={!canUseTicket ? 'Create a support ticket before acknowledging.' : undefined} onClick={() => { if (active) acknowledgeSupportTicket(active.ticketId, 'Support Lead'); reload(); }}>
              <CheckCircle2 className="h-4 w-4" />Acknowledge
            </Button>
            <Button variant="secondary" data-action="assignSupportOwner" disabled={!canUseTicket} data-disabled-reason={!canUseTicket ? 'Create a support ticket before assigning owner.' : undefined} title={!canUseTicket ? 'Create a support ticket before assigning owner.' : undefined} onClick={() => { if (active) assignSupportOwner(active.ticketId, { owner: 'Support Owner', supportAgent: 'Tier 2 Agent' }); reload(); }}>
              <UserCheck className="h-4 w-4" />Assign owner
            </Button>
            <Button variant="secondary" data-action="linkTicketToIncident" disabled={!canUseTicket} data-disabled-reason={!canUseTicket ? 'Create a support ticket before linking incident.' : undefined} title={!canUseTicket ? 'Create a support ticket before linking incident.' : undefined} onClick={() => { if (active) linkTicketToIncident(active.ticketId, active.incidentId ?? 'production-incident-linked-from-support'); reload(); }}>
              <AlertTriangle className="h-4 w-4" />Link incident
            </Button>
            <Button variant="danger" data-action="escalateSupportTicket" disabled={!canUseTicket} data-disabled-reason={!canUseTicket ? 'Create a support ticket before escalation.' : undefined} title={!canUseTicket ? 'Create a support ticket before escalation.' : undefined} onClick={() => { if (active) escalateSupportTicket(active.ticketId, 'Customer Success Director'); reload(); }}>
              <AlertTriangle className="h-4 w-4" />Escalate
            </Button>
            <Button variant="secondary" data-action="addCustomerImpactNote" disabled={!canUseTicket} data-disabled-reason={!canUseTicket ? 'Create a support ticket before customer updates.' : undefined} title={!canUseTicket ? 'Create a support ticket before customer updates.' : undefined} onClick={() => { if (active) addCustomerImpactNote(active.ticketId, 'Customer update drafted with mitigation ETA.'); reload(); }}>
              <MessageSquare className="h-4 w-4" />Customer note
            </Button>
            <Button variant="secondary" data-action="addInternalSupportNote" disabled={!canUseTicket} data-disabled-reason={!canUseTicket ? 'Create a support ticket before internal notes.' : undefined} title={!canUseTicket ? 'Create a support ticket before internal notes.' : undefined} onClick={() => { if (active) addInternalSupportNote(active.ticketId, 'Internal support note linked to runtime incident.'); reload(); }}>
              <FileText className="h-4 w-4" />Internal note
            </Button>
            <Button variant="secondary" data-action="markWaitingCustomer" disabled={!canUseTicket} data-disabled-reason={!canUseTicket ? 'Create a support ticket before waiting state.' : undefined} title={!canUseTicket ? 'Create a support ticket before waiting state.' : undefined} onClick={() => { if (active) markWaitingCustomer(active.ticketId); reload(); }}>
              <RefreshCw className="h-4 w-4" />Waiting customer
            </Button>
            <Button variant="secondary" data-action="markWaitingInternal" disabled={!canUseTicket} data-disabled-reason={!canUseTicket ? 'Create a support ticket before waiting state.' : undefined} title={!canUseTicket ? 'Create a support ticket before waiting state.' : undefined} onClick={() => { if (active) markWaitingInternal(active.ticketId); reload(); }}>
              <RefreshCw className="h-4 w-4" />Waiting internal
            </Button>
            <Button variant="secondary" data-action="markSupportSlaNearingBreach" disabled={!canUseTicket} data-disabled-reason={!canUseTicket ? 'Create a support ticket before SLA update.' : undefined} title={!canUseTicket ? 'Create a support ticket before SLA update.' : undefined} onClick={() => { if (active) markSupportSlaNearingBreach(active.ticketId); reload(); }}>
              <AlertTriangle className="h-4 w-4" />SLA warning
            </Button>
            <Button variant="danger" data-action="markSupportSlaBreached" disabled={!canUseTicket} data-disabled-reason={!canUseTicket ? 'Create a support ticket before SLA breach.' : undefined} title={!canUseTicket ? 'Create a support ticket before SLA breach.' : undefined} onClick={() => { if (active) markSupportSlaBreached(active.ticketId); reload(); }}>
              <AlertTriangle className="h-4 w-4" />Breach SLA
            </Button>
            <Button variant="success" data-action="resolveSupportTicket" disabled={!canResolve} data-disabled-reason={!canResolve ? 'Ticket must be open before resolution.' : undefined} title={!canResolve ? 'Ticket must be open before resolution.' : undefined} onClick={() => { if (active) resolveSupportTicket(active.ticketId, { resolutionSummary: 'Customer workflow recovered and runtime mitigation verified.', linkedArtifacts: ['production-support-report.md'] }); reload(); }}>
              <CheckCircle2 className="h-4 w-4" />Resolve
            </Button>
            <Button variant="success" data-action="closeSupportTicket" disabled={!canClose} data-disabled-reason={!canClose ? 'Ticket must be resolved with a resolution summary before close.' : undefined} title={!canClose ? 'Ticket must be resolved with a resolution summary before close.' : undefined} onClick={() => { if (active) closeSupportTicket(active.ticketId); reload(); }}>
              <CheckCircle2 className="h-4 w-4" />Close
            </Button>
            <Button variant="secondary" data-action="exportSupportPack" disabled={!dashboard.tickets.length} data-disabled-reason={!dashboard.tickets.length ? 'Create a support ticket before exporting support pack.' : undefined} title={!dashboard.tickets.length ? 'Create a support ticket before exporting support pack.' : undefined} onClick={() => { exportSupportPack(active?.ticketId); reload(); }}>
              <Download className="h-4 w-4" />Export support pack
            </Button>
          </>
        )}
      />

      <div className="grid grid-cols-5 gap-4" data-support-desk-dashboard>
        {[
          { label: 'Readiness', value: dashboard.status, tone: toneFor(dashboard.status) },
          { label: 'Open tickets', value: dashboard.openCount, tone: dashboard.openCount ? 'amber' : 'green' },
          { label: 'Critical impact', value: dashboard.criticalCount, tone: dashboard.criticalCount ? 'red' : 'green' },
          { label: 'SLA breached', value: dashboard.breachedSlaCount, tone: dashboard.breachedSlaCount ? 'red' : 'green' },
          { label: 'Affected customers', value: dashboard.customerImpact.affectedCustomers, tone: dashboard.customerImpact.affectedCustomers ? 'blue' : 'green' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <b className="truncate text-xl text-slate-950">{item.value}</b>
              <Badge tone={item.tone as Tone}>{item.label}</Badge>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[400px_1fr_360px] gap-5">
        <Panel title="Open Tickets">
          <div className="max-h-[500px] space-y-3 overflow-auto p-4 text-sm" data-support-open-tickets>
            {(dashboard.openTickets.length ? dashboard.openTickets : dashboard.tickets).map((ticket) => (
              <div key={ticket.ticketId} className="rounded-xl border border-slate-100 p-3" data-support-ticket-id={ticket.ticketId}>
                <div className="flex items-center justify-between gap-3">
                  <b>{ticket.customerName}</b>
                  <Badge tone={toneFor(`${ticket.severity} ${ticket.impactLevel}`)}>{ticket.severity}</Badge>
                </div>
                <p className="mt-2 text-slate-600">{ticket.customerMessage.split('\n').slice(-1)[0]}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>{ticket.status}</span>
                  <span>{ticket.slaStatus}</span>
                </div>
              </div>
            ))}
            {!dashboard.tickets.length ? <p className="rounded-xl bg-green-50 p-3 text-green-700">No customer-impact support tickets recorded.</p> : null}
          </div>
        </Panel>

        <Panel title="Linked Incident Panel / Timeline">
          <div className="max-h-[500px] space-y-3 overflow-auto p-4 text-sm" data-support-timeline>
            {(active?.timelineEvents ?? []).map((entry) => (
              <div key={entry.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <b>{entry.type}</b>
                  <span className="text-xs text-slate-400">{entry.timestamp.slice(0, 19)}</span>
                </div>
                <p className="mt-2 text-slate-600">{entry.message}</p>
              </div>
            ))}
            {!active ? <p className="rounded-xl bg-slate-50 p-3 text-slate-500">Create a support ticket to start customer-impact timeline.</p> : null}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="SLA Board">
            <div className="space-y-3 p-4 text-sm">
              <div className="flex justify-between"><span>Within SLA</span><b>{dashboard.tickets.filter((ticket) => ticket.slaStatus === 'within_sla').length}</b></div>
              <div className="flex justify-between"><span>Nearing breach</span><b>{dashboard.tickets.filter((ticket) => ticket.slaStatus === 'nearing_breach').length}</b></div>
              <div className="flex justify-between"><span>Breached</span><b>{dashboard.breachedSlaCount}</b></div>
            </div>
          </Panel>

          <Panel title="Customer Impact Matrix">
            <div className="space-y-3 p-4 text-sm">
              <div className="flex justify-between"><span>Critical</span><b>{dashboard.customerImpact.criticalImpact}</b></div>
              <div className="flex justify-between"><span>High</span><b>{dashboard.customerImpact.highImpact}</b></div>
              <div className="flex justify-between"><span>Workspaces</span><b>{dashboard.customerImpact.affectedWorkspaces}</b></div>
            </div>
          </Panel>

          <Panel title="Escalation Queue">
            <div className="space-y-2 p-4 text-sm">
              {dashboard.escalatedTickets.map((ticket) => <div key={ticket.ticketId} className="rounded-lg bg-red-50 p-3 text-red-700">{ticket.ticketId}: {ticket.escalationOwner ?? 'missing escalation owner'}</div>)}
              {!dashboard.escalatedTickets.length ? <p className="text-slate-500">No escalated support tickets.</p> : null}
            </div>
          </Panel>
        </div>

        <Panel title="Customer Communication Drafts">
          <div className="space-y-2 p-4 text-sm">
            {(dashboard.tickets.length ? dashboard.tickets : []).map((ticket) => <p key={ticket.ticketId} className="rounded-xl bg-slate-50 p-3 text-slate-600">{ticket.customerMessage.split('\n').slice(-1)[0]}</p>)}
            {!dashboard.tickets.length ? <p className="text-slate-500">Customer communication drafts appear after ticket creation.</p> : null}
          </div>
        </Panel>

        <Panel title="Internal Notes Panel">
          <div className="space-y-2 p-4 text-sm">
            {(dashboard.tickets.length ? dashboard.tickets : []).map((ticket) => <p key={ticket.ticketId} className="rounded-xl bg-slate-50 p-3 text-slate-600">{ticket.internalNote ?? `${ticket.ticketId}: no internal note yet.`}</p>)}
          </div>
        </Panel>

        <Panel title="Resolution Evidence Panel">
          <div className="space-y-2 p-4 text-sm">
            {(dashboard.tickets.length ? dashboard.tickets : []).map((ticket) => (
              <div key={ticket.ticketId} className="rounded-xl border border-slate-100 p-3">
                <b>{ticket.ticketId}</b>
                <p className="mt-2 text-slate-600">{ticket.resolutionSummary ?? 'Resolution summary required before close.'}</p>
                <p className="mt-2 text-xs text-slate-400">Artifacts: {ticket.linkedArtifacts.length}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Support Artifact Export Panel">
          <div className="space-y-2 p-4 text-sm" data-support-artifacts>
            {dashboard.artifacts.map((artifact) => <div key={artifact.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><span>{artifact.name}</span><Badge tone="blue">{artifact.type}</Badge></div>)}
            {!dashboard.artifacts.length ? <p className="text-slate-500">Support exports appear after support pack generation.</p> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
