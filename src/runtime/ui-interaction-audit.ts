export type UiInteractionElementType =
  | 'button'
  | 'link'
  | 'input'
  | 'select'
  | 'tab'
  | 'menuitem'
  | 'clickable-card'
  | 'chart-control'
  | 'export-action'
  | 'compact-widget';

export type UiInteractionStatus = 'wired' | 'unwired' | 'disabled_with_reason' | 'dead_link' | 'error';

export interface UiInteractionElementAudit {
  id: string;
  label: string;
  type: UiInteractionElementType;
  status: UiInteractionStatus;
  expectedBehavior: string;
  actualBehavior: string;
  fixApplied: boolean;
  routeTarget?: string;
  disabledReason?: string;
}

export interface UiInteractionSectionAudit {
  sectionName: string;
  score: number;
  elements: UiInteractionElementAudit[];
}

export interface UiInteractionRouteAudit {
  route: string;
  score: number;
  sections: UiInteractionSectionAudit[];
}

export interface UiInteractionAuditReport {
  totalRoutes: number;
  totalElements: number;
  wired: number;
  unwired: number;
  disabledWithReason: number;
  deadLinks: number;
  consoleErrors: number;
  coveragePercent: number;
  routes: UiInteractionRouteAudit[];
}

export interface UiInteractionAuditDashboard {
  report: UiInteractionAuditReport;
  summary: {
    finalStatus: 'pass' | 'fail';
    checkedAt: string;
    routeCoverage: number;
    sectionCoverage: number;
    actionMapSize: number;
  };
  artifacts: Array<{ id: string; name: string; type: string; summary: string }>;
}

export interface UiActionDescriptor {
  actionId: string;
  actionType: UiInteractionElementType;
  route: string;
  label: string;
  expectedBehavior: string;
  status: UiInteractionStatus;
  disabledReason?: string;
  nextActionRoute?: string;
}
