import { Ban, Download, LockKeyhole, ShieldCheck, UserPlus, UserRoundCog, UsersRound } from 'lucide-react';
import { Badge, Button, PageHeader, Panel, ProgressBar } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';
import {
  evaluateActionAccess,
  exportAccessAuditReport,
  inviteProductionUser,
  seedDefaultAccessUsers,
  selectProductionAccessControlDashboard,
  suspendProductionUser,
} from '../runtime/production-access-control-store';

type AccessWidgetSurface =
  | 'production-billing'
  | 'tenant-production-binding'
  | 'go-live-control'
  | 'production-operations'
  | 'production-support'
  | 'production-compliance'
  | 'production-incidents'
  | 'production-readiness'
  | 'production-runbook';

function reload() {
  window.location.reload();
}

function toneFor(value: string | number | boolean): Tone {
  const text = String(value);
  if (/allowed|active|ok|owner|admin|ready|false/i.test(text)) return 'green';
  if (/warning|invited|reviewer|finance|operator|support/i.test(text)) return 'amber';
  if (/blocked|locked|suspended|true|deny|viewer/i.test(text)) return 'red';
  return 'slate';
}

export function ProductionAccessControlCompactWidget({ surface }: { surface: AccessWidgetSurface }) {
  const dashboard = selectProductionAccessControlDashboard();
  return (
    <span
      data-production-access-widget
      data-production-access-surface={surface}
      data-production-access-users={dashboard.summary.users}
      data-production-access-locked={dashboard.summary.lockedModules}
      data-production-access-blocked={dashboard.summary.blockedActions}
      className="sr-only"
    >
      Production access {surface}: {dashboard.summary.users} users, {dashboard.summary.lockedModules} locked module(s).
    </span>
  );
}

export function ProductionAccessControlPage() {
  const dashboard = selectProductionAccessControlDashboard();
  const activeUser = dashboard.users[0];

  return (
    <div data-route="/production-access-control" data-production-access-control-route>
      <PageHeader
        title="Production User, Role & Access Control Center"
        subtitle="Tenant-level role, permission, module entitlement, action guard, user quota, and access audit center for production SaaS readiness."
        actions={(
          <>
            <Button data-action="seedDefaultAccessUsers" onClick={() => { seedDefaultAccessUsers(dashboard.tenantId); reload(); }}>
              <UsersRound className="h-4 w-4" />Seed roles
            </Button>
            <Button variant="secondary" data-action="inviteProductionUser" onClick={() => { inviteProductionUser({ tenantId: dashboard.tenantId, name: 'New Production Reviewer', email: `reviewer-${Date.now()}@example.com`, role: 'reviewer' }); reload(); }}>
              <UserPlus className="h-4 w-4" />Invite reviewer
            </Button>
            <Button variant="danger" data-action="suspendProductionUser" disabled={!activeUser} data-disabled-reason={!activeUser ? 'Seed or invite a user before suspension.' : undefined} onClick={() => { suspendProductionUser(activeUser?.userId, 'Access Admin'); reload(); }}>
              <Ban className="h-4 w-4" />Suspend user
            </Button>
            <Button variant="secondary" data-action="checkGoLiveApprovalAccess" onClick={() => { evaluateActionAccess({ actor: 'Support Agent', action: 'approve', moduleId: 'go-live-control', tenantId: dashboard.tenantId }); reload(); }}>
              <LockKeyhole className="h-4 w-4" />Check Go-Live
            </Button>
            <Button variant="secondary" data-action="checkBillingConfigureAccess" onClick={() => { evaluateActionAccess({ actor: 'Finance Reviewer', action: 'configure', moduleId: 'production-billing', tenantId: dashboard.tenantId }); reload(); }}>
              <ShieldCheck className="h-4 w-4" />Check billing
            </Button>
            <Button variant="secondary" data-action="checkComplianceApprovalAccess" onClick={() => { evaluateActionAccess({ actor: 'Compliance Reviewer', action: 'approve', moduleId: 'production-compliance', tenantId: dashboard.tenantId }); reload(); }}>
              <UserRoundCog className="h-4 w-4" />Check compliance
            </Button>
            <Button variant="secondary" data-action="exportAccessAuditReport" onClick={() => { exportAccessAuditReport(dashboard.tenantId); reload(); }}>
              <Download className="h-4 w-4" />Export access
            </Button>
          </>
        )}
      />

      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Users', value: dashboard.summary.users },
          { label: 'Roles', value: dashboard.summary.roles },
          { label: 'Modules', value: dashboard.summary.modules },
          { label: 'Locked modules', value: dashboard.summary.lockedModules },
          { label: 'Blocked actions', value: dashboard.summary.blockedActions },
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

      <div className="mt-5 grid grid-cols-[390px_1fr_360px] gap-5">
        <Panel title="Role Matrix">
          <div className="max-h-[620px] space-y-3 overflow-auto p-4 text-sm" data-production-access-role-matrix>
            {dashboard.roles.map((role) => (
              <div key={role.role} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between">
                  <b>{role.role}</b>
                  <Badge tone={toneFor(role.role)}>{role.permissions.length} permissions</Badge>
                </div>
                <p className="mt-2 text-xs text-slate-500">{role.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {role.permissions.map((permission) => <Badge key={permission} tone="slate">{permission}</Badge>)}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Module Permission Matrix">
          <div className="max-h-[620px] space-y-3 overflow-auto p-4 text-sm" data-production-access-permission-matrix>
            {dashboard.modules.map((module) => (
              <div key={module.moduleId} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <b>{module.label}</b>
                  <Badge tone={module.locked ? 'red' : 'green'}>{module.locked ? 'locked' : 'available'}</Badge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <span>Entitlement: {module.requiredPlanModule}</span>
                  <span>Roles: {module.allowedRoles.join(', ')}</span>
                </div>
                {module.lockReason ? <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{module.lockReason}</p> : null}
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="User Quota">
            <div className="space-y-3 p-4 text-sm">
              <div className="flex justify-between"><span>Seats</span><b>{dashboard.userQuota.used}/{dashboard.userQuota.limit}</b></div>
              <ProgressBar value={Math.min(100, dashboard.userQuota.percent)} tone={toneFor(dashboard.userQuota.status)} />
              {[...dashboard.userQuota.warnings, ...dashboard.userQuota.blockers].map((message) => (
                <div key={message} className={`rounded-xl p-3 ${dashboard.userQuota.status === 'blocked' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{message}</div>
              ))}
            </div>
          </Panel>

          <Panel title="Access Audit">
            <div className="max-h-[330px] space-y-3 overflow-auto p-4 text-sm">
              {dashboard.auditLog.map((event) => (
                <div key={event.eventId} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <b>{event.actor}</b>
                    <Badge tone={event.allowed ? 'green' : 'red'}>{event.allowed ? 'allowed' : 'blocked'}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{event.reason}</p>
                </div>
              ))}
              {!dashboard.auditLog.length ? <p className="rounded-xl bg-slate-50 p-3 text-slate-600">No access audit events yet.</p> : null}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
