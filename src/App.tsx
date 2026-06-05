import { AppShell } from './components/layout/AppShell';
import { ReadOnlyActionGuard } from './components/ui/ReadOnlyActionGuard';
import { screens } from './data/screens';
import { ApiContractsPage } from './pages/ApiContractsPage';
import { AuthReadinessPage } from './pages/AuthReadinessPage';
import { BackendAdapterPage } from './pages/BackendAdapterPage';
import { BackendReadinessPage } from './pages/BackendReadinessPage';
import { CertifiedSandboxRunPage } from './pages/CertifiedSandboxRunPage';
import { ChaosSimulationPage } from './pages/ChaosSimulationPage';
import { DatabaseReadinessPage } from './pages/DatabaseReadinessPage';
import { DeploymentConfigPage } from './pages/DeploymentConfigPage';
import { E2EActionFlowPage } from './pages/E2EActionFlowPage';
import { EnvironmentReadinessPage } from './pages/EnvironmentReadinessPage';
import { GoLiveControlPage } from './pages/GoLiveControlPage';
import { PreGoLiveValidationPage } from './pages/PreGoLiveValidationPage';
import { ProductionConfigEvidencePage } from './pages/ProductionConfigEvidencePage';
import { ProductionObservabilityPage } from './pages/ProductionObservabilityPage';
import { ProductionOperationsPage } from './pages/ProductionOperationsPage';
import { ProductionCompliancePage } from './pages/ProductionCompliancePage';
import { ProductionReadinessPage } from './pages/ProductionReadinessPage';
import { ProductionIncidentPage } from './pages/ProductionIncidentPage';
import { ProductionRunbookPage } from './pages/ProductionRunbookPage';
import { ProductionSupportPage } from './pages/ProductionSupportPage';
import { RuntimeCertificationPage } from './pages/RuntimeCertificationPage';
import { TenantProductionBindingPage } from './pages/TenantProductionBindingPage';
import { EvaluationPage } from './pages/EvaluationPage';
import { ExecutionGraphPage } from './pages/ExecutionGraphPage';
import { ExecutionTimelinePage } from './pages/ExecutionTimelinePage';
import { ScreenPage } from './pages/ScreenPage';
import { WorkerControlPage } from './pages/WorkerControlPage';
import { WorkerRecoveryPage } from './pages/WorkerRecoveryPage';

function getCurrentPath() {
  const path = window.location.pathname;
  return path === '/' ? '/command-center' : path;
}

function GuardedAppShell({ currentPath, children }: { currentPath: string; children: React.ReactNode }) {
  return (
    <ReadOnlyActionGuard>
      <AppShell currentPath={currentPath}>{children}</AppShell>
    </ReadOnlyActionGuard>
  );
}

export function App() {
  const currentPath = getCurrentPath();
  if (currentPath === '/execution-graph') {
    return (
      <GuardedAppShell currentPath="/execution-graph">
        <ExecutionGraphPage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/execution-timeline') {
    return (
      <GuardedAppShell currentPath="/execution-timeline">
        <ExecutionTimelinePage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/evaluation') {
    return (
      <GuardedAppShell currentPath="/evaluation">
        <EvaluationPage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/worker-control') {
    return (
      <GuardedAppShell currentPath="/worker-control">
        <WorkerControlPage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/worker-recovery') {
    return (
      <GuardedAppShell currentPath="/worker-recovery">
        <WorkerRecoveryPage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/chaos') {
    return (
      <GuardedAppShell currentPath="/chaos">
        <ChaosSimulationPage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/runtime-certification') {
    return (
      <GuardedAppShell currentPath="/runtime-certification">
        <RuntimeCertificationPage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/certified-sandbox-run') {
    return (
      <GuardedAppShell currentPath="/certified-sandbox-run">
        <CertifiedSandboxRunPage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/production-readiness') {
    return (
      <GuardedAppShell currentPath="/production-readiness">
        <ProductionReadinessPage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/deployment-config') {
    return (
      <GuardedAppShell currentPath="/deployment-config">
        <DeploymentConfigPage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/backend-adapter') {
    return (
      <GuardedAppShell currentPath="/backend-adapter">
        <BackendAdapterPage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/backend-readiness') {
    return (
      <GuardedAppShell currentPath="/backend-readiness">
        <BackendReadinessPage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/database-readiness') {
    return (
      <GuardedAppShell currentPath="/database-readiness">
        <DatabaseReadinessPage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/auth-readiness') {
    return (
      <GuardedAppShell currentPath="/auth-readiness">
        <AuthReadinessPage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/environment-readiness') {
    return (
      <GuardedAppShell currentPath="/environment-readiness">
        <EnvironmentReadinessPage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/production-config-evidence') {
    return (
      <GuardedAppShell currentPath="/production-config-evidence">
        <ProductionConfigEvidencePage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/production-observability') {
    return (
      <GuardedAppShell currentPath="/production-observability">
        <ProductionObservabilityPage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/production-operations') {
    return (
      <GuardedAppShell currentPath="/production-operations">
        <ProductionOperationsPage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/production-compliance') {
    return (
      <GuardedAppShell currentPath="/production-compliance">
        <ProductionCompliancePage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/go-live-control') {
    return (
      <GuardedAppShell currentPath="/go-live-control">
        <GoLiveControlPage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/production-runbook') {
    return (
      <GuardedAppShell currentPath="/production-runbook">
        <ProductionRunbookPage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/production-incidents') {
    return (
      <GuardedAppShell currentPath="/production-incidents">
        <ProductionIncidentPage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/production-support') {
    return (
      <GuardedAppShell currentPath="/production-support">
        <ProductionSupportPage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/api-contracts') {
    return (
      <GuardedAppShell currentPath="/api-contracts">
        <ApiContractsPage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/e2e-action-flow') {
    return (
      <GuardedAppShell currentPath="/e2e-action-flow">
        <E2EActionFlowPage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/pre-golive-validation') {
    return (
      <GuardedAppShell currentPath="/pre-golive-validation">
        <PreGoLiveValidationPage />
      </GuardedAppShell>
    );
  }
  if (currentPath === '/tenant-production-binding') {
    return (
      <GuardedAppShell currentPath="/tenant-production-binding">
        <TenantProductionBindingPage />
      </GuardedAppShell>
    );
  }

  const screen = screens.find((item) => item.route === currentPath) ?? screens.find((item) => item.route === '/command-center')!;
  const useAppShell = screen.id > 7;

  if (!useAppShell) {
    return <ScreenPage screen={screen} />;
  }

  return (
    <GuardedAppShell currentPath={screen.route}>
      <ScreenPage screen={screen} />
    </GuardedAppShell>
  );
}
