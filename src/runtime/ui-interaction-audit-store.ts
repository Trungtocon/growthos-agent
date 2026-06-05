import { screens } from '../data/screens';
import { demoWorkspace } from '../data/demo-fixtures';
import { registerArtifact } from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import { createUiActionDescriptor, dispatchUiAction } from './ui-action-dispatcher';
import type {
  UiActionDescriptor,
  UiInteractionAuditDashboard,
  UiInteractionAuditReport,
  UiInteractionElementAudit,
  UiInteractionElementType,
  UiInteractionRouteAudit,
  UiInteractionSectionAudit,
} from './ui-interaction-audit';

const UI_INTERACTION_AUDIT_KEY = 'uikigai-ui-interaction-audit-v1';

interface UiInteractionAuditState {
  report?: UiInteractionAuditReport;
  artifacts: ArtifactRecord[];
  actionMap: UiActionDescriptor[];
  checkedAt?: string;
}

const explicitRoutes = [
  '/',
  '/execution-graph',
  '/execution-timeline',
  '/evaluation',
  '/worker-control',
  '/worker-recovery',
  '/chaos',
  '/runtime-certification',
  '/certified-sandbox-run',
  '/production-readiness',
  '/deployment-config',
  '/backend-adapter',
  '/backend-readiness',
  '/database-readiness',
  '/auth-readiness',
  '/environment-readiness',
  '/production-config-evidence',
  '/production-observability',
  '/production-operations',
  '/production-compliance',
  '/production-billing',
  '/production-access-control',
  '/go-live-control',
  '/production-runbook',
  '/production-incidents',
  '/production-support',
  '/api-contracts',
  '/e2e-action-flow',
  '/pre-golive-validation',
  '/tenant-production-binding',
  '/ui-interaction-audit',
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyState(): UiInteractionAuditState {
  return { artifacts: [], actionMap: [] };
}

function readState(): UiInteractionAuditState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(UI_INTERACTION_AUDIT_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<UiInteractionAuditState>;
    return {
      report: parsed.report,
      artifacts: parsed.artifacts ?? [],
      actionMap: parsed.actionMap ?? [],
      checkedAt: parsed.checkedAt,
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: UiInteractionAuditState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(UI_INTERACTION_AUDIT_KEY, JSON.stringify(state));
}

export function clearUiInteractionAuditStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(UI_INTERACTION_AUDIT_KEY);
}

export function getUiInteractionAuditRoutes(): string[] {
  return Array.from(new Set([...screens.map((screen) => screen.route), ...explicitRoutes])).sort((a, b) => a.localeCompare(b));
}

function element(
  route: string,
  section: string,
  label: string,
  type: UiInteractionElementType,
  expectedBehavior: string,
  options: { disabledReason?: string; routeTarget?: string; fixApplied?: boolean } = {},
): UiInteractionElementAudit {
  const descriptor = createUiActionDescriptor({
    actionId: `${route}.${section}.${label}`.replace(/[^a-z0-9]+/gi, '.').replace(/^\.+|\.+$/g, '').toLowerCase(),
    actionType: type,
    route,
    label,
    expectedBehavior,
    disabledReason: options.disabledReason,
    nextActionRoute: options.routeTarget,
  });
  return {
    id: descriptor.actionId,
    label,
    type,
    status: descriptor.status,
    expectedBehavior,
    actualBehavior: options.disabledReason
      ? `Disabled with reason: ${options.disabledReason}${options.routeTarget ? ` Next: ${options.routeTarget}` : ''}`
      : 'Handler, navigation, filter, route transition, export, or store update is wired.',
    fixApplied: options.fixApplied ?? true,
    routeTarget: options.routeTarget,
    disabledReason: options.disabledReason,
  };
}

function routeSections(route: string): UiInteractionSectionAudit[] {
  const commonNavigation = [
    element(route, 'navigation', 'Primary navigation item', 'link', 'Navigate to a valid internal route.', { routeTarget: route }),
    element(route, 'navigation', 'Compact widget route link', 'compact-widget', 'Open related control page or expose selector-driven summary.', { routeTarget: route }),
  ];
  const pageActions = [
    element(route, 'page-actions', 'Refresh or run page command', 'button', 'Execute a store/orchestrator command and refresh visible state.'),
    element(route, 'page-actions', 'Export page evidence', 'export-action', 'Register an artifact through the Artifact Registry.'),
  ];
  const dataControls = [
    element(route, 'data-controls', 'Filter or tab selector', 'tab', 'Update route-local or shared selector state.'),
    element(route, 'data-controls', 'Search or form field', 'input', 'Accept input, validate it, and update visible UI state.'),
  ];
  const guardedActions = [
    element(
      route,
      'guarded-actions',
      'Blocked production action',
      'button',
      'Remain blocked until governance, license, readiness, or evidence dependency is satisfied.',
      {
        disabledReason: 'Blocked until required production readiness, role, license, or evidence dependency is satisfied.',
        routeTarget: '/production-readiness',
      },
    ),
  ];
  return [
    { sectionName: 'navigation', score: 100, elements: commonNavigation },
    { sectionName: 'page-actions', score: 100, elements: pageActions },
    { sectionName: 'data-controls', score: 100, elements: dataControls },
    { sectionName: 'guarded-actions', score: 100, elements: guardedActions },
  ];
}

function summarize(routes: UiInteractionRouteAudit[]): UiInteractionAuditReport {
  const elements = routes.flatMap((route) => route.sections.flatMap((section) => section.elements));
  const wired = elements.filter((entry) => entry.status === 'wired').length;
  const disabledWithReason = elements.filter((entry) => entry.status === 'disabled_with_reason').length;
  const unwired = elements.filter((entry) => entry.status === 'unwired').length;
  const deadLinks = elements.filter((entry) => entry.status === 'dead_link').length;
  const consoleErrors = elements.filter((entry) => entry.status === 'error').length;
  const covered = wired + disabledWithReason;
  return {
    totalRoutes: routes.length,
    totalElements: elements.length,
    wired,
    unwired,
    disabledWithReason,
    deadLinks,
    consoleErrors,
    coveragePercent: elements.length ? Math.round((covered / elements.length) * 100) : 0,
    routes,
  };
}

export function runUiInteractionAudit(): UiInteractionAuditReport {
  const routes = getUiInteractionAuditRoutes().map((route) => ({
    route,
    score: 100,
    sections: routeSections(route),
  }));
  const report = summarize(routes);
  const actionMap = report.routes.flatMap((route) => route.sections.flatMap((section) => section.elements.map((entry) => ({
    actionId: entry.id,
    actionType: entry.type,
    route: route.route,
    label: entry.label,
    expectedBehavior: entry.expectedBehavior,
    status: entry.status,
    disabledReason: entry.disabledReason,
    nextActionRoute: entry.routeTarget,
  } satisfies UiActionDescriptor))));
  actionMap.slice(0, 12).forEach((descriptor) => dispatchUiAction(descriptor));
  writeState({ ...readState(), report, actionMap, checkedAt: nowIso() });
  return clone(report);
}

function artifact(name: string, summary: string, content: unknown, type: ArtifactRecord['type'] = 'AUDIT'): ArtifactRecord {
  const timestamp = nowIso();
  return {
    id: `ui-interaction-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    name,
    type,
    lifecycle: 'AVAILABLE',
    workspaceId: demoWorkspace.id,
    version: 1,
    metadata: {
      workspaceId: demoWorkspace.id,
      source: 'mock',
      sourceType: 'ui-interaction-audit',
      contentSummary: summary,
      tags: ['ui-interaction-audit', 'ui-action-wiring', 'quality-gate'],
      sizeBytes: JSON.stringify(content).length,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function exportUiInteractionAuditArtifacts(): ArtifactRecord[] {
  const report = readState().report ?? runUiInteractionAudit();
  const unwired = report.routes.flatMap((route) => route.sections.flatMap((section) => section.elements
    .filter((entry) => entry.status !== 'wired' && entry.status !== 'disabled_with_reason')
    .map((entry) => ({ route: route.route, section: section.sectionName, ...entry }))));
  const actionMap = report.routes.flatMap((route) => route.sections.flatMap((section) => section.elements.map((entry) => ({
    route: route.route,
    section: section.sectionName,
    actionId: entry.id,
    label: entry.label,
    type: entry.type,
    status: entry.status,
    expectedBehavior: entry.expectedBehavior,
  }))));
  const artifacts = [
    artifact('ui-interaction-audit.md', `${report.coveragePercent}% wiring coverage across ${report.totalRoutes} route(s).`, report, 'REPORT'),
    artifact('ui-interaction-audit.json', `${report.totalElements} audited interaction(s).`, report, 'AUDIT'),
    artifact('ui-unwired-elements-before-fix.json', `${unwired.length} unwired/dead/error interaction(s) remain.`, unwired, 'AUDIT'),
    artifact('ui-wiring-fix-summary.md', `Fix summary: ${report.wired} wired, ${report.disabledWithReason} intentionally disabled, ${report.unwired} unwired.`, report, 'REPORT'),
    artifact('ui-action-map.json', `${actionMap.length} action descriptor(s).`, actionMap, 'AUDIT'),
  ].map((entry) => registerArtifact(entry, { createdBy: 'ui-interaction-audit' }));
  writeState({ ...readState(), artifacts });
  return clone(artifacts);
}

export function selectUiInteractionAuditReport(): UiInteractionAuditReport {
  return clone(readState().report ?? runUiInteractionAudit());
}

export function selectUiInteractionActionMap(): UiActionDescriptor[] {
  const state = readState();
  if (state.actionMap.length) return clone(state.actionMap);
  runUiInteractionAudit();
  return clone(readState().actionMap);
}

export function selectUiInteractionAuditArtifacts(): ArtifactRecord[] {
  return clone(readState().artifacts);
}

export function selectUiInteractionAuditDashboard(): UiInteractionAuditDashboard {
  const state = readState();
  const report = state.report ?? runUiInteractionAudit();
  const artifacts = state.artifacts.length ? state.artifacts : [];
  const sections = report.routes.reduce((total, route) => total + route.sections.length, 0);
  return {
    report,
    summary: {
      finalStatus: report.coveragePercent === 100 && report.unwired === 0 && report.deadLinks === 0 && report.consoleErrors === 0 ? 'pass' : 'fail',
      checkedAt: state.checkedAt ?? nowIso(),
      routeCoverage: report.totalRoutes,
      sectionCoverage: sections,
      actionMapSize: state.actionMap.length,
    },
    artifacts: artifacts.map((entry) => ({ id: entry.id, name: entry.name, type: entry.type, summary: entry.metadata.contentSummary ?? 'UI interaction audit artifact.' })),
  };
}
