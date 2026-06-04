import { KpiCard, SectionCard } from '../components/ui/MockCards';
import type { ScreenSpec } from '../data/screens';
import { commercialRoutes } from '../data/demoScreens';
import { DatabaseReadinessCompactWidget } from './DatabaseReadinessPage';
import { DemoScreen } from './DemoScreens';
import { Sprint2Screen, sprint2Routes } from './Sprint2Screens';

const defaultKpis = [
  ['Agent đang hoạt động', '18'],
  ['Phiếu việc mở', '36'],
  ['Chờ phê duyệt', '14'],
  ['Chi phi AI', '$2,840'],
  ['Tỷ lệ thành công', '93.6%'],
  ['Cảnh báo rủi ro', '7'],
];

function useShell(screen: ScreenSpec) {
  return screen.id > 7;
}

export function ScreenPage({ screen }: { screen: ScreenSpec }) {
  const shell = useShell(screen);
  const imagePath = screen.assetPath;

  if (commercialRoutes.has(screen.route)) {
    return (
      <>
        {screen.route === '/runs/demo-run' ? <DatabaseReadinessCompactWidget surface="run" /> : null}
        <DemoScreen route={screen.route} />
      </>
    );
  }

  if (sprint2Routes.has(screen.route)) {
    return <Sprint2Screen route={screen.route} />;
  }

  return (
    <div className={shell ? '' : 'mx-auto max-w-7xl py-8'}>
      {!shell ? (
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-aqua-500 text-xl font-bold text-white">U</div>
            <div>
              <div className="text-xl font-bold text-slate-950">UIKIGAI</div>
              <div className="text-sm text-slate-500">AI Workforce OS</div>
            </div>
          </div>
          <div className="rounded-full bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700">Khởi tạo</div>
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">{screen.title}</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Route scaffold để triển khai giao diện React theo ảnh thiết kế: <span className="font-semibold text-slate-900">{screen.file}</span>.
          </p>
        </div>
        <div className="flex gap-2">
          <a href={imagePath} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Mở ảnh mẫu</a>
          <button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft">Hành động chính</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        {defaultKpis.map(([label, value]) => <KpiCard key={label} label={label} value={value} hint="Dữ liệu mẫu" />)}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
        <SectionCard title="Mục tiêu triển khai">
          <div className="space-y-3 text-sm text-slate-600">
            <p>Codex cần thay phần scaffold này bằng layout React thật bám sát ảnh PNG.</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Giữ đúng route: <code className="rounded bg-slate-100 px-1.5 py-0.5">{screen.route}</code></li>
              <li>Giữ AppShell thống nhất nếu là màn sau onboarding.</li>
              <li>Dùng component tái sử dụng, mock data, loading/empty/error state.</li>
              <li>Không hardcode secrets, không gọi backend thật.</li>
            </ul>
          </div>
        </SectionCard>

        <SectionCard title="Trạng thái triển khai">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Ảnh PNG chỉ dùng làm nguồn đối chiếu, không render trực tiếp trong app.</p>
            <p className="mt-2">Nguồn tham chiếu: <span className="font-medium">{screen.file}</span></p>
            <p className="mt-2">Route này sẽ được thay bằng UI React trong các wave tiếp theo.</p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
