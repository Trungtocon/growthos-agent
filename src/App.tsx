import { AppShell } from './components/layout/AppShell';
import { screens } from './data/screens';
import { EvaluationPage } from './pages/EvaluationPage';
import { ExecutionGraphPage } from './pages/ExecutionGraphPage';
import { ExecutionTimelinePage } from './pages/ExecutionTimelinePage';
import { ScreenPage } from './pages/ScreenPage';
import { WorkerControlPage } from './pages/WorkerControlPage';

function getCurrentPath() {
  const path = window.location.pathname;
  return path === '/' ? '/command-center' : path;
}

export function App() {
  const currentPath = getCurrentPath();
  if (currentPath === '/execution-graph') {
    return (
      <AppShell currentPath="/execution-graph">
        <ExecutionGraphPage />
      </AppShell>
    );
  }
  if (currentPath === '/execution-timeline') {
    return (
      <AppShell currentPath="/execution-timeline">
        <ExecutionTimelinePage />
      </AppShell>
    );
  }
  if (currentPath === '/evaluation') {
    return (
      <AppShell currentPath="/evaluation">
        <EvaluationPage />
      </AppShell>
    );
  }
  if (currentPath === '/worker-control') {
    return (
      <AppShell currentPath="/worker-control">
        <WorkerControlPage />
      </AppShell>
    );
  }

  const screen = screens.find((item) => item.route === currentPath) ?? screens.find((item) => item.route === '/command-center')!;
  const useAppShell = screen.id > 7;

  if (!useAppShell) {
    return <ScreenPage screen={screen} />;
  }

  return (
    <AppShell currentPath={screen.route}>
      <ScreenPage screen={screen} />
    </AppShell>
  );
}
