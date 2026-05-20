import { AppShell } from './components/layout/AppShell';
import { screens } from './data/screens';
import { ScreenPage } from './pages/ScreenPage';

function getCurrentPath() {
  const path = window.location.pathname;
  return path === '/' ? '/command-center' : path;
}

export function App() {
  const currentPath = getCurrentPath();
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
