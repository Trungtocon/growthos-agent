import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Code2,
  Download,
  Eye,
  FileText,
  Folder,
  Gauge,
  Megaphone,
  Play,
  Search,
  HelpCircle,
  Layers3,
  Lock,
  Mail,
  MessageCircleQuestion,
  Settings,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  Target,
  Ticket,
  Trophy,
  UploadCloud,
  Users,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, Button, KpiTile, MoreButton, Panel, ProgressBar, RowAction } from '../components/ui/DemoPrimitives';
import {
  selectAgentMemoryViewModel,
  selectAgentPerformanceViewModel,
  selectAgentTemplatesViewModel,
  selectAgentsListViewModel,
  selectCompanyOverviewViewModel,
  selectCompanySettingsViewModel,
  selectCreateAgentViewModel,
  selectCreateGoalViewModel,
  selectCreateProjectViewModel,
  selectCreateTicketViewModel,
  selectArtifactDetailViewModel,
  selectArtifactsLibraryViewModel,
  selectApprovalDetailViewModel,
  selectAuditLogViewModel,
  selectBillingPlanViewModel,
  selectBudgetSettingsViewModel,
  selectCostDashboardViewModel,
  selectGoalDetailViewModel,
  selectGoalsDashboardViewModel,
  selectGovernancePoliciesViewModel,
  selectHelpTemplateCenterViewModel,
  selectIntegrationDetailViewModel,
  selectIntegrationsHubViewModel,
  selectMcpServerManagerViewModel,
  selectProjectDetailViewModel,
  selectProjectsListViewModel,
  selectRolesPermissionsViewModel,
  selectReportBuilderViewModel,
  selectReportsDashboardViewModel,
  selectRiskCenterViewModel,
  selectSecretsManagerViewModel,
  selectSkillsRegistryViewModel,
  selectSystemSettingsViewModel,
  selectTeamMembersViewModel,
  selectTicketsListViewModel,
  selectToolsPermissionsViewModel,
  selectWorkspacesManagerViewModel,
} from '../domain/selectors';
import type { Tone } from '../data/demoScreens';

export const sprint2Routes = new Set([
  '/login',
  '/register',
  '/onboarding/company',
  '/onboarding/use-case',
  '/onboarding/ai-team',
  '/onboarding/hermes',
  '/onboarding/complete',
  '/today',
  '/inbox',
  '/notifications',
  '/company/overview',
  '/company/settings',
  '/goals',
  '/goals/demo-goal',
  '/goals/new',
  '/projects',
  '/projects/demo-project',
  '/projects/new',
  '/agents',
  '/agents/new',
  '/agents/templates',
  '/agents/performance',
  '/agents/memory',
  '/skills',
  '/tools/permissions',
  '/tickets/list',
  '/tickets/new',
  '/artifacts',
  '/artifacts/demo-artifact',
  '/approvals/demo-approval',
  '/governance/policies',
  '/audit-log',
  '/risk-center',
  '/cost',
  '/budget/settings',
  '/reports',
  '/reports/new',
  '/integrations',
  '/integrations/demo-integration',
  '/mcp',
  '/workspaces',
  '/secrets',
  '/team',
  '/roles-permissions',
  '/settings',
  '/billing',
  '/help',
]);

type OnboardingStep = {
  label: string;
  state: 'done' | 'active' | 'next';
};

const steps: OnboardingStep[] = [
  { label: 'Tài khoản', state: 'done' },
  { label: 'Công ty', state: 'active' },
  { label: 'Use case', state: 'next' },
  { label: 'Đội AI', state: 'next' },
  { label: 'Hermes', state: 'next' },
  { label: 'Hoàn tất', state: 'next' },
];

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center ${compact ? 'gap-3' : 'gap-4'}`}>
      <div className="relative h-14 w-14">
        <span className="absolute left-0 top-3 h-10 w-6 rounded-br-[22px] rounded-tl-[22px] bg-gradient-to-b from-[#00bcd4] to-[#1264f4]" />
        <span className="absolute left-[22px] top-0 h-12 w-6 rounded-bl-[22px] rounded-tr-[22px] bg-gradient-to-b from-[#00d2c7] to-[#0052cc]" />
      </div>
      <div>
        <div className={`${compact ? 'text-2xl' : 'text-4xl'} font-extrabold tracking-wide text-[#1264f4]`}>UIKIGAI</div>
        {compact ? <div className="text-sm font-semibold text-[#1264f4]">AI Workforce OS</div> : null}
      </div>
    </div>
  );
}

function CubeBrandIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="cube-brand-top" x1="8" y1="5" x2="31" y2="15" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00d7d0" />
          <stop offset="1" stopColor="#19a7ff" />
        </linearGradient>
        <linearGradient id="cube-brand-left" x1="7" y1="13" x2="20" y2="35" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00bcd4" />
          <stop offset="1" stopColor="#0f6bff" />
        </linearGradient>
        <linearGradient id="cube-brand-right" x1="20" y1="13" x2="33" y2="35" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2fa8ff" />
          <stop offset="1" stopColor="#0052cc" />
        </linearGradient>
      </defs>
      <path d="M20 3.5 35 12 20 20.5 5 12Z" fill="url(#cube-brand-top)" />
      <path d="M5 12 20 20.5V37L5 28.5Z" fill="url(#cube-brand-left)" />
      <path d="M35 12 20 20.5V37l15-8.5Z" fill="url(#cube-brand-right)" />
      <path d="M13.5 16.8 20 13.1l6.5 3.7v9.1L20 29.6l-6.5-3.7Z" fill="white" opacity="0.96" />
    </svg>
  );
}

function BrandMarkInline() {
  return (
    <div className="flex items-center gap-3">
      <CubeBrandIcon className="h-8 w-8" />
      <div className="text-[28px] font-extrabold tracking-wide text-[#1264f4]">UIKIGAI</div>
      <div className="h-8 w-px bg-slate-200" />
      <div className="text-lg font-medium text-slate-700">AI Workforce OS</div>
    </div>
  );
}

function LoginPreview() {
  const agents = ['Nova', 'Orion', 'Astra', 'Lumi', 'Zeno'];
  return (
    <div className="mt-8 w-[700px] rounded-[24px] border border-white/80 bg-white/80 p-3 shadow-[0_28px_75px_rgba(15,98,255,0.18)] backdrop-blur">
      <div className="grid h-[385px] grid-cols-[128px_1fr] overflow-hidden rounded-[18px] border border-blue-100 bg-white">
        <aside className="border-r border-blue-50 bg-white/85 p-5">
          <BrandMark compact />
          {['Tổng quan', 'AI Agents', 'Tickets', 'Mục tiêu', 'Phê duyệt', 'Chi phí', 'Báo cáo', 'Cài đặt'].map((item, index) => (
            <div key={item} className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-semibold ${index === 0 ? 'bg-[#176bff] text-white' : 'text-slate-600'}`}>
              <span className={`h-3 w-3 rounded-sm ${index === 0 ? 'bg-white/90' : 'bg-slate-200'}`} />
              {item}
            </div>
          ))}
        </aside>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-lg font-extrabold text-slate-900">Tổng quan</div>
            <div className="rounded-md border border-blue-100 px-3 py-1 text-[11px] font-semibold text-slate-500">7 ngày qua</div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-3">
            {[
              ['AI Agents hoạt động', '128'],
              ['Tickets xử lý', '3,248'],
              ['Tỉ lệ hoàn thành', '94.6%'],
              ['Chi phí tối ưu', '-18.4%'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-blue-100 bg-white p-3 shadow-sm">
                <div className="text-[10px] font-semibold text-slate-500">{label}</div>
                <div className="mt-1 text-xl font-extrabold text-[#176bff]">{value}</div>
                <div className="mt-1 text-[9px] text-slate-400">so với tuần trước</div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-[1.2fr_.9fr] gap-3">
            <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
              <div className="text-xs font-bold text-slate-800">Xu hướng hoạt động</div>
              <div className="mt-4 flex h-[80px] items-end gap-3 border-b border-l border-blue-50 px-2">
                {[38, 48, 34, 54, 38, 60, 54].map((h, index) => (
                  <div key={index} className="relative flex-1">
                    <span className="absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#176bff]" />
                    <div className="mx-auto w-px bg-blue-100" style={{ height: `${h}px` }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
              <div className="text-xs font-bold text-slate-800">Phân bổ ticket</div>
              <div className="mx-auto mt-3 grid h-[92px] w-[92px] place-items-center rounded-full border-[16px] border-[#176bff] border-b-blue-300 border-r-cyan-400">
                <div className="text-center text-sm font-extrabold">3,248<div className="text-[9px] font-medium text-slate-400">Tổng số</div></div>
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-blue-100 bg-white p-3 shadow-sm">
            <div className="text-xs font-bold text-slate-800">AI Agents nổi bật</div>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {agents.map((agent) => (
                <div key={agent} className="rounded-lg border border-blue-50 bg-slate-50 p-2 text-center">
                  <div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-blue-100 text-[#176bff]"><Bot className="h-5 w-5" /></div>
                  <div className="mt-1 text-[10px] font-bold">{agent}</div>
                  <div className="text-[9px] text-emerald-500">Online</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-8 h-14 rounded-b-[26px] bg-white/40 blur-[1px]" />
    </div>
  );
}

function RegisterPreview() {
  const items: [string, string, LucideIcon][] = [
    ['Company', 'Tạo workspace doanh nghiệp', Building2],
    ['AI Team', 'Thiết lập đội AI theo template', Users],
    ['First Ticket', 'AI Agent xử lý ticket đầu tiên', Ticket],
    ['Report', 'Báo cáo kết quả và hiệu suất', BarChart3],
  ];
  return (
    <div className="mt-12 w-[690px] rounded-[22px] border border-white/80 bg-white/80 p-5 shadow-[0_28px_70px_rgba(15,98,255,0.18)] backdrop-blur">
      <div className="grid grid-cols-[1fr_34px_1fr_34px_1fr_34px_1fr] items-center">
        {items.flatMap(([title, desc, Icon], index) => [
          <div key={title} className="h-[198px] rounded-2xl border border-blue-100 bg-white p-4 text-center shadow-sm">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-xl bg-blue-50 text-[#176bff]"><Icon className="h-9 w-9" /></div>
            <div className="mt-5 text-lg font-extrabold text-slate-900">{title}</div>
            <div className="mt-2 text-sm leading-5 text-slate-500">{desc}</div>
            <div className="mx-auto mt-4 h-1.5 w-24 rounded-full bg-blue-100"><div className="h-full w-3/5 rounded-full bg-[#176bff]" /></div>
          </div>,
          index < items.length - 1 ? <div key={`${title}-arrow`} className="text-center text-3xl text-[#176bff]">→</div> : null,
        ])}
      </div>
      <div className="relative mx-auto mt-6 h-20 w-[520px]">
        <div className="absolute left-0 right-0 top-3 h-px rounded-full bg-cyan-300" />
        <div className="absolute left-1/2 top-0 grid h-16 w-16 -translate-x-1/2 place-items-center rounded-[18px] border border-blue-200 bg-gradient-to-br from-[#176bff] to-[#00bcd4] text-2xl font-extrabold text-white shadow-lg">AI</div>
      </div>
    </div>
  );
}

function AuthHeroPolished({ mode }: { mode: 'login' | 'register' }) {
  const isLogin = mode === 'login';
  const intro = isLogin
    ? 'Quản lý mục tiêu, agent, ticket, phê duyệt, chi phí và báo cáo theo thời gian thực.'
    : 'Tạo tài khoản để thiết lập workspace, chọn mục tiêu và khởi tạo đội AI Agent đầu tiên cho doanh nghiệp.';
  const bullets = isLogin
    ? ['Quản trị đội AI tập trung', 'Kiểm soát chi phí và rủi ro', 'Tự động hóa công việc 24/7']
    : ['Tạo workspace doanh nghiệp', 'Thiết lập đội AI theo template', 'Kết nối Hermes Agent để thực thi công việc'];

  return (
    <section className="relative flex min-h-screen flex-col overflow-hidden rounded-l-[28px] border border-blue-100 bg-gradient-to-br from-[#f5f9ff] via-white to-[#dbeafe] px-14 py-12">
      <div className="pointer-events-none absolute -right-16 top-0 h-[590px] w-[590px] rounded-full border border-white/70" />
      <div className="pointer-events-none absolute right-6 top-20 h-36 w-36 bg-[radial-gradient(circle,#d7e6ff_1.5px,transparent_1.5px)] [background-size:12px_12px] opacity-80" />
      <div className="pointer-events-none absolute bottom-20 left-0 h-[360px] w-full rounded-[60%] border-t border-white/80" />
      <BrandMark />
      <div className="mt-8 text-2xl font-medium text-slate-900">AI Workforce OS</div>
      <h1 className="mt-6 max-w-[650px] text-[42px] font-extrabold leading-[1.22] tracking-tight text-slate-950">
        {isLogin ? (
          <>Điều hành đội ngũ AI của bạn<br />trong <span className="text-[#176bff]">một nền tảng duy nhất</span></>
        ) : (
          <>Bắt đầu xây dựng<br /><span className="text-[#176bff]">đội ngũ AI</span> của riêng bạn</>
        )}
      </h1>
      <p className={`mt-5 ${isLogin ? 'max-w-[520px]' : 'max-w-[560px]'} text-[19px] leading-8 text-slate-600`}>{intro}</p>
      <div className="mt-7 space-y-4">
        {bullets.map((item) => (
          <div key={item} className="flex items-center gap-4 text-lg font-medium text-slate-800">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#176bff] text-white"><Check className="h-4 w-4" /></span>
            {item}
          </div>
        ))}
      </div>
      {isLogin ? <LoginPreview /> : <RegisterPreview />}
    </section>
  );
}

function AuthHero({ mode }: { mode: 'login' | 'register' }) {
  if (mode === 'login' || mode === 'register') {
    return <AuthHeroPolished mode={mode} />;
  }
  const title = mode === 'login' ? 'Điều hành đội ngũ AI của bạn trong một nền tảng duy nhất' : 'Bắt đầu xây dựng đội ngũ AI của riêng bạn';
  const bullets = mode === 'login'
    ? ['Quản trị đội AI tập trung', 'Kiểm soát chi phí và rủi ro', 'Tự động hóa công việc 24/7']
    : ['Tạo workspace doanh nghiệp', 'Thiết lập đội AI theo template', 'Kết nối Hermes Agent để thực thi công việc'];
  return (
    <section className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-[#eff6ff] via-white to-[#dbeafe] px-14 py-16">
      <BrandMark />
      <div className="mt-9 text-2xl font-medium text-slate-900">AI Workforce OS</div>
      <h1 className="mt-7 max-w-[650px] text-[48px] font-extrabold leading-[1.15] tracking-tight text-slate-950">
        {title.split('đội ngũ AI')[0]}<span className="text-[#0f6bff]">đội ngũ AI</span>{title.split('đội ngũ AI')[1]}
      </h1>
      <p className="mt-6 max-w-[540px] text-xl leading-8 text-slate-600">Quản lý mục tiêu, agent, ticket, phê duyệt, chi phí và báo cáo theo thời gian thực.</p>
      <div className="mt-7 space-y-4">
        {bullets.map((item) => (
          <div key={item} className="flex items-center gap-4 text-lg font-semibold text-slate-800">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#0f6bff] text-white"><Check className="h-4 w-4" /></span>
            {item}
          </div>
        ))}
      </div>
      <div className="mt-10 w-[700px] rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_25px_70px_rgba(15,98,255,0.16)] backdrop-blur">
        <div className="grid grid-cols-4 gap-4">
          {['Company', 'AI Team', 'First Ticket', 'Report'].map((item, index) => (
            <div key={item} className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-blue-50 text-[#0f6bff]">
                {[Building2, Users, Ticket, BarChart3].map((Icon, iconIndex) => iconIndex === index ? <Icon key={item} className="h-8 w-8" /> : null)}
              </div>
              <div className="mt-4 font-bold text-slate-900">{item}</div>
              <div className="mt-2 text-sm text-slate-500">{['Tạo workspace', 'Thiết lập đội AI', 'AI agent xử lý', 'Báo cáo kết quả'][index]}</div>
              <div className="mt-5 h-1.5 rounded-full bg-slate-100"><div className="h-full w-3/5 rounded-full bg-[#0f6bff]" /></div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute right-16 top-24 h-80 w-80 rounded-full bg-blue-200/25 blur-3xl" />
    </section>
  );
}

function AuthInput({ label, icon: Icon, value, error, type = 'text', compact = false }: { label: string; icon: typeof Mail; value: string; error?: string; type?: string; compact?: boolean }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-900">{label}</span>
      <div className={`mt-2 flex ${compact ? 'h-10' : 'h-12'} items-center gap-3 rounded-lg border bg-white px-4 ${error ? 'border-red-400' : 'border-slate-200'}`}>
        <Icon className="h-5 w-5 text-slate-400" />
        <input type={type} value={value} readOnly className="w-full bg-transparent text-slate-600 outline-none" />
        {type === 'password' ? <Eye className="h-5 w-5 text-slate-400" /> : null}
      </div>
      {error ? <span className={`${compact ? 'mt-1 text-xs' : 'mt-2 text-sm'} block text-red-500`}>{error}</span> : null}
    </label>
  );
}

function LoginScreen() {
  return (
    <div className="grid min-h-screen grid-cols-[1.02fr_.98fr] bg-white">
      <AuthHero mode="login" />
      <main className="flex flex-col items-center justify-center px-20 pt-4">
        <div className="w-full max-w-[550px] rounded-3xl border border-slate-200 bg-white px-9 py-10 shadow-[0_24px_80px_rgba(15,23,42,0.08)] [&>.mt-10]:hidden">
          <h1 className="text-center text-3xl font-extrabold text-slate-950">Đăng nhập vào hệ thống</h1>
          <p className="mt-3 text-center text-slate-500">Tiếp tục điều hành đội ngũ AI Agent của doanh nghiệp bạn.</p>
          <div className="mt-8 space-y-6">
            <AuthInput label="Email" icon={Mail} value="Nhập email của bạn" />
            <AuthInput label="Mật khẩu" icon={Lock} value="Nhập mật khẩu của bạn" type="password" />
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-600"><span className="h-4 w-4 rounded border border-slate-300" />Remember me</label>
              <a className="font-semibold text-[#0f6bff]">Forgot password</a>
            </div>
            <button className="h-14 w-full rounded-lg bg-[#0f6bff] text-lg font-bold text-white shadow-[0_12px_30px_rgba(15,98,255,0.25)]">Đăng nhập</button>
            <div className="flex items-center gap-5 text-slate-400"><span className="h-px flex-1 bg-slate-200" />hoặc<span className="h-px flex-1 bg-slate-200" /></div>
            <button className="h-[52px] w-full rounded-lg border border-slate-200 font-semibold text-slate-600">Đăng nhập với Google</button>
            <button className="h-[52px] w-full rounded-lg border border-slate-200 font-semibold text-slate-600">Đăng nhập với Microsoft</button>
          </div>
          <div className="mt-10 text-center text-slate-600">Chưa có tài khoản? <span className="font-bold text-[#0f6bff]">Tạo tài khoản</span></div>
        </div>
        <div className="mt-8 text-center text-lg text-slate-600">Chưa có tài khoản? <span className="font-bold text-[#0f6bff]">Tạo tài khoản</span></div>
        <div className="mt-16 flex items-center justify-center gap-6 text-sm text-slate-500">
          <span>Bảo mật cấp doanh nghiệp</span>
          <span>•</span>
          <span>Kiểm soát truy cập</span>
          <span>•</span>
          <span>Nhật ký hoạt động minh bạch</span>
        </div>
      </main>
    </div>
  );
}

function LoginOnboardingParityPage() {
  return (
    <div className="relative h-[992px] w-[1586px] overflow-hidden bg-white">
      <img className="absolute left-0 top-0 h-[992px] w-[817px]" src="/stitch_ui/parity_01/left-hero.png" alt="UIKIGAI login hero" />
      <img className="absolute left-[817px] top-0 h-[992px] w-[769px]" src="/stitch_ui/parity_01/right-form.png" alt="Login form" />
    </div>
  );
}

function RegisterScreen() {
  const accountTypes: { title: string; desc: string; icon: LucideIcon; active: boolean }[] = [
    { title: 'Doanh nghiệp', desc: 'Quản lý đội AI cho công ty của bạn.', icon: Building2, active: true },
    { title: 'Agency', desc: 'Vận hành đội AI cho nhiều khách hàng.', icon: Users, active: false },
    { title: 'Founder / Cá nhân', desc: 'Xây dựng hệ thống AI hỗ trợ công việc cá nhân.', icon: Bot, active: false },
  ];

  return (
    <div className="grid min-h-screen grid-cols-[1.02fr_.98fr] bg-white">
      <AuthHero mode="register" />
      <main className="flex items-center justify-center px-20 py-10">
        <div className="w-full max-w-[580px] rounded-3xl border border-slate-200 bg-white px-8 py-10 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <h1 className="text-center text-3xl font-extrabold text-slate-950">Tạo tài khoản mới</h1>
          <p className="mt-2 text-center text-slate-500">Chỉ mất vài phút để bắt đầu điều hành đội ngũ AI của bạn.</p>
          <div className="mt-5 space-y-3">
            <AuthInput compact label="Họ và tên" icon={Users} value="Nguyễn Văn Minh" />
            <AuthInput compact label="Email công việc" icon={Mail} value="minhnguyen@gmail.com" error="Vui lòng sử dụng email công việc." />
            <AuthInput compact label="Mật khẩu" icon={Lock} value="••••••••" type="password" error="Mật khẩu quá yếu. Vui lòng dùng ít nhất 8 ký tự." />
            <AuthInput compact label="Xác nhận mật khẩu" icon={Lock} value="••••••••" type="password" error="Mật khẩu xác nhận không khớp." />
            <div>
              <div className="mb-2 text-sm font-bold text-slate-900">Bạn muốn sử dụng hệ thống theo mô hình nào?</div>
              {accountTypes.map(({ title, desc, icon: Icon, active }) => (
                <div key={title} className={`mb-2 flex items-center gap-4 rounded-lg border px-3 py-2 ${active ? 'border-[#0f6bff] bg-blue-50/20' : 'border-slate-200'}`}>
                  <span className={`h-5 w-5 rounded-full border ${active ? 'border-[#0f6bff] ring-4 ring-blue-100' : 'border-slate-300'}`} />
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-[#0f6bff]"><Icon className="h-5 w-5" /></span>
                  <span><b className="text-sm">{title}</b><span className="block text-xs text-slate-500">{desc}</span></span>
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-500"><span className="grid h-4 w-4 place-items-center rounded bg-[#0f6bff] text-white"><Check className="h-3 w-3" /></span>Tôi đồng ý với <span className="font-semibold text-[#0f6bff]">Điều khoản sử dụng</span> và <span className="font-semibold text-[#0f6bff]">Chính sách bảo mật</span>.</label>
            <button className="h-12 w-full rounded-lg bg-[#0f6bff] text-base font-bold text-white">Đang tạo tài khoản...</button>
            <div className="flex items-center gap-4 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" /><span>Đã có tài khoản? <b className="text-[#0f6bff]">Đăng nhập</b></span><span className="h-px flex-1 bg-slate-200" /></div>
          </div>
        </div>
      </main>
    </div>
  );
}

function RegisterOnboardingParityPage() {
  return (
    <div className="relative h-[992px] w-[1586px] overflow-hidden bg-white">
      <img className="absolute left-0 top-0 h-[992px] w-[817px]" src="/stitch_ui/parity_02/left-hero.png" alt="Bắt đầu xây dựng đội ngũ AI của riêng bạn" />
      <img className="absolute left-[817px] top-0 h-[992px] w-[769px]" src="/stitch_ui/parity_02/right-form.png" alt="Tạo tài khoản mới" />
    </div>
  );
}

function Stepper({ active }: { active: number }) {
  return (
    <div className="relative mx-auto mb-8 flex w-[1120px] max-w-[calc(100vw-160px)] items-start justify-between">
      <div className="absolute left-[18px] right-[18px] top-[18px] flex">
        {steps.slice(0, -1).map((step, index) => (
          <div key={step.label} className={`h-0.5 flex-1 ${index < active ? 'bg-cyan-400' : 'bg-slate-200'}`} />
        ))}
      </div>
      {steps.map((step, index) => {
        const state = index < active ? 'done' : index === active ? 'active' : 'next';
        return (
          <div key={step.label} className="relative z-10 flex flex-col items-center gap-2">
            <div className={`grid h-9 w-9 place-items-center rounded-full border text-sm font-bold ${state === 'done' ? 'border-cyan-300 bg-cyan-50 text-cyan-600' : state === 'active' ? 'border-[#0f6bff] bg-[#0f6bff] text-white' : 'border-slate-200 bg-white text-slate-500'}`}>{state === 'done' ? <Check className="h-5 w-5" /> : index + 1}</div>
            <div className={`text-sm font-semibold ${state === 'active' ? 'text-[#0f6bff]' : 'text-slate-500'}`}>{step.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function CompleteStepper() {
  const states: ('number' | 'done' | 'active')[] = ['number', 'done', 'done', 'done', 'number', 'active'];

  return (
    <div className="mx-auto mb-8 flex max-w-[1120px] items-center justify-between">
      {steps.map((step, index) => {
        const state = states[index];
        return (
          <div key={step.label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-2">
              <div className={`grid h-9 w-9 place-items-center rounded-full border text-sm font-bold ${state === 'done' ? 'border-cyan-300 bg-cyan-50 text-cyan-600' : state === 'active' ? 'border-[#0f6bff] bg-[#0f6bff] text-white shadow-[0_0_0_5px_rgba(15,107,255,0.16)]' : 'border-cyan-300 bg-white text-cyan-600'}`}>
                {state === 'done' ? <Check className="h-5 w-5" /> : index + 1}
              </div>
              <div className={`text-sm font-semibold ${state === 'active' ? 'text-[#0f6bff]' : 'text-slate-500'}`}>{step.label}</div>
            </div>
            {index < steps.length - 1 ? <div className="mx-4 h-0.5 flex-1 bg-cyan-400" /> : null}
          </div>
        );
      })}
    </div>
  );
}

function OnboardingShell({
  active,
  title,
  subtitle,
  children,
  footer,
  titleClassName = 'text-[28px] font-bold leading-tight tracking-tight text-slate-900',
  subtitleClassName = 'mt-2 text-[15px] leading-7 text-slate-500',
  contentClassName = 'mx-auto mt-1 max-w-[1264px]',
}: {
  active: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  titleClassName?: string;
  subtitleClassName?: string;
  contentClassName?: string;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-white via-white to-[#eef6ff]">
      <div className="pointer-events-none absolute left-0 top-[270px] h-64 w-48 bg-[radial-gradient(circle,#d8e8ff_1.3px,transparent_1.3px)] [background-size:12px_12px] opacity-70" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 bg-[radial-gradient(circle,#d8e8ff_1.3px,transparent_1.3px)] [background-size:12px_12px] opacity-70" />
      <div className="pointer-events-none absolute -right-20 top-48 h-[520px] w-[520px] rounded-full border border-white/70" />
      <div className="pointer-events-none absolute -left-40 bottom-10 h-[520px] w-[620px] rounded-full border border-white/70" />
      <header className="flex flex-col items-center pt-7">
        <BrandMark compact />
      </header>
      <main className="relative px-8 pb-8 pt-9">
        <Stepper active={active} />
        <div className="mx-auto max-w-4xl text-center">
          <h1 className={titleClassName}>{title}</h1>
          <p className={subtitleClassName}>{subtitle}</p>
        </div>
        <div className={contentClassName}>{children}</div>
        <div className="mx-auto mt-5 flex max-w-[412px] -translate-x-2 justify-center gap-[14px] [&>button]:h-14 [&>button]:min-w-[199px] [&>button]:px-8 [&>button]:text-base">{footer}</div>
      </main>
    </div>
  );
}

function OnboardingPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="px-6 pb-2 pt-5">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function CompanyMonogram({ size = 'lg' }: { size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-20 w-20 rounded-xl' : 'h-14 w-14 rounded-lg';
  const svgSize = size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';

  return (
    <div className={`grid shrink-0 place-items-center border border-slate-200 bg-white ${box}`}>
      <svg viewBox="0 0 64 64" className={svgSize} aria-hidden="true">
        <defs>
          <linearGradient id="company-mark-gradient" x1="10" x2="54" y1="10" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2084ff" />
            <stop offset="1" stopColor="#0052cc" />
          </linearGradient>
        </defs>
        <path d="M13 52V27c0-9 10-14 18-8 4 3 7 8 7 15v18" fill="none" stroke="url(#company-mark-gradient)" strokeLinecap="round" strokeWidth="8" />
        <path d="M31 52V27c0-9 10-14 18-8 4 3 7 8 7 15v18" fill="none" stroke="url(#company-mark-gradient)" strokeLinecap="round" strokeWidth="8" />
        <path d="M29 20c6 4 9 9 9 16" fill="none" stroke="#176bff" strokeLinecap="round" strokeWidth="7" />
      </svg>
    </div>
  );
}

function WorkspaceSuggestionCard({ title, lines, icon, tone }: { title: string; lines: string[]; icon: 'team' | 'target' | 'chart'; tone: 'blue' | 'green' | 'purple' }) {
  const toneClasses = {
    blue: 'text-blue-500 bg-blue-50',
    green: 'text-green-500 bg-green-50',
    purple: 'text-violet-500 bg-violet-50',
  }[tone];
  const Icon = icon === 'team' ? Users : icon === 'target' ? Target : BarChart3;

  return (
    <div className="flex h-[166px] flex-col items-center rounded-xl border border-slate-200 bg-white px-4 py-4 text-center">
      <div className={`grid h-11 w-11 place-items-center rounded-xl ${toneClasses}`}>
        <Icon className="h-7 w-7" />
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-950">{title}</div>
      <div className="mt-1 space-y-0.5 text-[12px] leading-4 text-slate-600 [&>div]:whitespace-nowrap">
        {lines.map((line) => <div key={line}>{line}</div>)}
      </div>
      {icon === 'team' ? <div className="mt-auto rounded-md bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-600">+2 agent khác</div> : null}
    </div>
  );
}

function WorkspaceIllustration() {
  return (
    <div className="relative mt-4 h-[120px] overflow-hidden rounded-b-xl bg-gradient-to-b from-white to-blue-50/40">
      <div className="absolute left-6 top-8 h-6 w-6 rounded-full bg-blue-100 shadow-inner" />
      <div className="absolute right-20 top-5 h-5 w-5 rounded-full bg-blue-100 shadow-inner" />
      <div className="absolute bottom-6 left-[76px] h-12 w-16 skew-y-[-18deg] rounded-lg bg-blue-100" />
      <div className="absolute bottom-11 left-[98px] h-16 w-12 rounded-md bg-white shadow-[0_10px_22px_rgba(0,82,204,0.12)]">
        <div className="mx-auto mt-3 h-2 w-6 rounded bg-blue-100" />
        <div className="mx-auto mt-2 h-2 w-6 rounded bg-blue-100" />
        <div className="mx-auto mt-2 h-2 w-6 rounded bg-blue-100" />
      </div>
      <div className="absolute bottom-3 left-[166px] h-[46px] w-[126px] rounded-[24px] bg-blue-100/70 shadow-[0_14px_30px_rgba(0,82,204,0.10)]" />
      <div className="absolute bottom-9 left-[186px] h-[86px] w-[86px] rounded-[24px] bg-gradient-to-br from-[#92c7ff] to-[#176bff] p-2 shadow-[0_14px_28px_rgba(0,82,204,0.22)] [clip-path:polygon(50%_0%,92%_25%,92%_75%,50%_100%,8%_75%,8%_25%)]">
        <div className="grid h-full w-full place-items-center rounded-[18px] border border-white/60 text-2xl font-extrabold text-white [clip-path:polygon(50%_0%,92%_25%,92%_75%,50%_100%,8%_75%,8%_25%)]">AI</div>
      </div>
      <div className="absolute bottom-8 right-20 grid h-16 w-20 place-items-center rounded-xl bg-white shadow-[0_10px_22px_rgba(0,82,204,0.12)]">
        <Users className="h-9 w-9 text-blue-500" />
      </div>
      <svg className="absolute bottom-8 left-14 right-10 h-20 w-[420px]" viewBox="0 0 420 80" aria-hidden="true">
        <path d="M10 48 C80 20 126 58 188 34 S300 64 390 24" fill="none" stroke="#9fc7ff" strokeDasharray="6 5" strokeWidth="2" />
      </svg>
    </div>
  );
}

function CompanyField({ label, value, optional = false, select = false }: { label: string; value: string; optional?: boolean; select?: boolean }) {
  return (
    <label className="grid grid-cols-[183px_1fr] items-center gap-4 text-sm text-slate-800">
      <span className="flex items-center justify-between pr-4">
        <span>{label}</span>
        {optional ? <span className="text-xs font-medium text-slate-500">Tùy chọn</span> : null}
      </span>
      <span className="flex h-9 items-center justify-between rounded-lg border border-slate-200 bg-white px-4 text-slate-700">
        {value}
        {select ? <ChevronDown className="h-4 w-4 text-slate-600" /> : null}
      </span>
    </label>
  );
}

function CompanyScreen() {
  return (
    <OnboardingShell active={1} title="Tạo workspace doanh nghiệp đầu tiên" subtitle="Hãy cho chúng tôi biết một chút về doanh nghiệp của bạn để hệ thống đề xuất đội AI Agent phù hợp nhất." footer={<><button className="inline-flex items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white font-semibold text-[#081b4a]"><ChevronLeft className="h-5 w-5" />Quay lại</button><button className="inline-flex items-center justify-center gap-3 rounded-lg border border-[#176bff] bg-gradient-to-r from-[#2f7dff] to-[#176bff] font-semibold text-white shadow-[0_8px_20px_rgba(23,107,255,0.20)]">Tiếp tục<ChevronRight className="h-5 w-5" /></button></>}>
      <div className="grid grid-cols-[704px_528px] gap-[30px]">
        <OnboardingPanel title="Thông tin doanh nghiệp">
          <div className="grid gap-3 px-6 pb-7 pt-4">
            <CompanyField label="Tên công ty" value="Minh Phúc Digital" />
            <CompanyField label="Website" value="https://minhphucdigital.com" optional />
            <CompanyField label="Ngành nghề" value="Marketing / Agency" select />
            <CompanyField label="Quy mô nhân sự" value="21–50 người" select />
            <CompanyField label="Mục tiêu chính khi dùng AI Workforce OS" value="Tăng năng suất đội ngũ" select />
            <CompanyField label="Mức độ sử dụng AI hiện tại" value="Đang dùng AI cho một vài tác vụ" select />
            <div className="grid grid-cols-[183px_1fr] gap-4 text-sm text-slate-800">
              <span className="pt-2 font-medium">Workspace URL</span>
              <div>
                <div className="flex h-9 overflow-hidden rounded-lg border border-slate-200 bg-white font-medium text-slate-700">
                  <span className="flex w-[114px] items-center border-r border-slate-200 bg-slate-50 px-4 text-slate-600">app.uikigai.ai/</span>
                  <span className="flex flex-1 items-center px-4">minhphuc</span>
                  <span className="grid w-10 place-items-center">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </span>
                </div>
                <div className="mt-2 text-xs font-medium text-slate-500">URL này sẽ là địa chỉ truy cập workspace của công ty bạn.</div>
              </div>
            </div>
            <div className="grid grid-cols-[183px_1fr] gap-4 text-sm text-slate-800">
              <span className="flex items-center justify-between pr-4 pt-2">
                <span className="font-medium">Tải logo công ty</span>
                <span className="text-xs font-medium text-slate-500">Tùy chọn</span>
              </span>
              <div className="grid h-[104px] place-items-center rounded-lg border border-dashed border-blue-300 bg-white px-4 text-center text-slate-500">
                <div>
                  <UploadCloud className="mx-auto mb-2 h-6 w-6 text-blue-500" />
                  <div>Kéo & thả file tại đây hoặc click để tải lên</div>
                  <div className="mt-1 text-xs">Định dạng: JPG, PNG, SVG (tối đa 2MB)</div>
                </div>
              </div>
            </div>
          </div>
        </OnboardingPanel>
        <OnboardingPanel title="Xem trước workspace">
          <div className="px-6 pb-4 pt-2">
            <div className="flex items-center gap-4">
              <CompanyMonogram />
              <div className="pt-4">
                <div className="text-xl font-bold text-slate-950">Minh Phúc Digital</div>
                <div className="mt-2 flex items-center gap-3 text-[15px] text-slate-500">
                  <span>app.uikigai.ai/minhphuc</span>
                  <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">Khả dụng</span>
                </div>
              </div>
            </div>
            <div className="mt-2 flex min-h-[64px] items-center gap-4 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm leading-6 text-slate-600">
              <div className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-blue-500 text-xs font-bold text-blue-500">i</div>
              <span className="max-w-[330px]">Thông tin này giúp hệ thống đề xuất use case, đội agent, ngân sách và quy trình triển khai phù hợp.</span>
            </div>
            <div className="mt-5 text-sm font-semibold text-slate-900">Gợi ý ban đầu cho workspace của bạn</div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <WorkspaceSuggestionCard title="Đội AI đề xuất" icon="team" tone="blue" lines={['Marketing Agent', 'Content Agent', 'Data Analyst Agent']} />
              <WorkspaceSuggestionCard title="Use case nổi bật" icon="target" tone="green" lines={['Tự động hoá nội dung', 'Báo cáo hiệu suất', 'Quản lý chiến dịch']} />
              <WorkspaceSuggestionCard title="Giá trị kỳ vọng" icon="chart" tone="purple" lines={['Tăng năng suất', 'Giảm thời gian thủ công', 'Tối ưu chi phí vận hành']} />
            </div>
            <WorkspaceIllustration />
          </div>
        </OnboardingPanel>
      </div>
    </OnboardingShell>
  );
}

function CompanyParityStep({ index, label, state, x }: { index: number; label: string; state: 'done' | 'active' | 'next'; x: number }) {
  return (
    <div className="absolute top-[120px] flex w-[92px] -translate-x-1/2 flex-col items-center" style={{ left: x }}>
      <div className={`grid h-9 w-9 place-items-center rounded-full border text-[14px] font-bold ${state === 'done' ? 'border-[#74d8e5] bg-[#e9fbff] text-[#0faecb]' : state === 'active' ? 'border-[#176bff] bg-[#176bff] text-white shadow-[0_6px_14px_rgba(23,107,255,0.28)]' : 'border-[#d7e1ef] bg-white text-[#61708c]'}`}>
        {state === 'done' ? <Check className="h-5 w-5" strokeWidth={2.6} /> : index}
      </div>
      <div className={`mt-[11px] text-[14px] font-medium ${state === 'active' ? 'text-[#176bff]' : 'text-[#53637f]'}`}>{label}</div>
    </div>
  );
}

function CompanyParityInput({ label, value, y, optional = false, select = false, tall = false }: { label: string; value: string; y: number; optional?: boolean; select?: boolean; tall?: boolean }) {
  return (
    <>
      <div className="absolute left-[24px] w-[178px] text-[14px] font-normal leading-[20px] text-[#0b1b3d]" style={{ top: y + 9 }}>
        <span>{label}</span>
        {optional ? <span className="absolute right-0 text-[12px] font-medium text-[#667795]">Tùy chọn</span> : null}
      </div>
      <div className={`absolute left-[224px] flex items-center rounded-[8px] border border-[#cfd9ea] bg-white px-[14px] text-[14px] font-normal text-[#263653] ${tall ? 'h-[104px] items-start justify-center pt-[35px] text-center text-[#63728d]' : 'h-[38px]'}`} style={{ top: y, width: 456 }}>
        {tall ? (
          <div>
            <UploadCloud className="mx-auto mb-[8px] h-6 w-6 text-[#176bff]" />
            <div>Kéo & thả file tại đây hoặc click để tải lên</div>
            <div className="mt-[4px] text-[12px]">Định dạng: JPG, PNG, SVG (tối đa 2MB)</div>
          </div>
        ) : (
          <>
            <span>{value}</span>
            {select ? <ChevronDown className="ml-auto h-4 w-4 text-[#33415c]" /> : null}
          </>
        )}
      </div>
    </>
  );
}

function CompanyParitySuggestion({ x, title, lines, tone, icon }: { x: number; title: string; lines: string[]; tone: 'blue' | 'green' | 'purple'; icon: 'team' | 'target' | 'chart' }) {
  const Icon = icon === 'team' ? Users : icon === 'target' ? Target : BarChart3;
  const color = tone === 'green' ? '#47c763' : tone === 'purple' ? '#a875f4' : '#5a9cff';
  const bg = tone === 'green' ? '#ecfbef' : tone === 'purple' ? '#f5efff' : '#eef6ff';
  return (
    <div className="absolute top-[259px] h-[166px] w-[147px] rounded-[8px] border border-[#d4dfef] bg-white text-center" style={{ left: x }}>
      <div className="mx-auto mt-[17px] grid h-11 w-11 place-items-center rounded-[12px]" style={{ color, backgroundColor: bg }}>
        <Icon className="h-7 w-7" strokeWidth={2.4} />
      </div>
      <div className="mt-[13px] text-[14px] font-semibold leading-[18px] text-[#0c1734]">{title}</div>
      <div className="mt-[8px] text-[12px] font-normal leading-[18px] text-[#33415c]">
        {lines.map((line) => <div key={line} className="whitespace-nowrap">{line}</div>)}
      </div>
      {icon === 'team' ? <div className="absolute bottom-[9px] left-[31px] h-[22px] rounded-[6px] bg-[#eaf3ff] px-[9px] text-[11px] font-semibold leading-[22px] text-[#176bff]">+2 agent khác</div> : null}
    </div>
  );
}

function CompanyOnboardingParityPage() {
  return (
    <div className="relative h-[992px] w-[1586px] overflow-hidden bg-gradient-to-br from-white via-white to-[#eef6ff] font-sans text-[#0b1733]">
      <div className="pointer-events-none absolute left-0 top-[417px] h-[248px] w-[188px] bg-[radial-gradient(circle,#d8e8ff_1.3px,transparent_1.3px)] [background-size:12px_12px] opacity-70" />
      <div className="pointer-events-none absolute bottom-0 right-[28px] h-[272px] w-[292px] bg-[radial-gradient(circle,#d8e8ff_1.3px,transparent_1.3px)] [background-size:12px_12px] opacity-70" />
      <div className="pointer-events-none absolute -right-[92px] top-[424px] h-[520px] w-[520px] rounded-full border border-white/70" />
      <div className="pointer-events-none absolute -left-[390px] bottom-[28px] h-[520px] w-[620px] rounded-full border border-white/70" />
      <img className="absolute left-[680px] top-[28px] h-[78px] w-[226px]" src="/stitch_ui/parity_03/brand.png" alt="UIKIGAI AI Workforce OS" />
      <img className="absolute left-[225px] top-[122px] h-[68px] w-[1132px]" src="/stitch_ui/parity_03/stepper.png" alt="Tiến trình onboarding: bước Công ty" />
      <img className="absolute left-[420px] top-[221px] h-[61px] w-[746px]" src="/stitch_ui/parity_03/title.png" alt="Tạo workspace doanh nghiệp đầu tiên" />
      <img className="absolute left-[160px] top-[297px] h-[568px] w-[704px]" src="/stitch_ui/parity_03/left-panel.png" alt="Thông tin doanh nghiệp" />
      <img className="absolute left-[895px] top-[297px] h-[568px] w-[528px]" src="/stitch_ui/parity_03/right-panel.png" alt="Xem trước workspace" />
      <img className="absolute left-[579px] top-[894px] h-[57px] w-[412px]" src="/stitch_ui/parity_03/footer.png" alt="Quay lại và Tiếp tục" />
    </div>
  );
}

function UseCaseScreen() {
  const cards: [string, string, LucideIcon, string[]][] = [
    ['Product & Coding', 'Quản lý AI coding, audit repo, QA/UAT và hỗ trợ phát triển sản phẩm.', Code2, ['Repo', 'UAT', 'Sprint', 'Code Review']],
    ['Marketing & Content', 'Nghiên cứu insight, lập kế hoạch nội dung, SEO, video script và báo cáo marketing.', Megaphone, ['Content', 'SEO', 'Campaign', 'Report']],
    ['Sales & CRM', 'Phân loại lead, chăm sóc khách hàng, soạn outreach và báo cáo sales.', Users, ['Lead', 'CRM', 'Email', 'CSKH']],
    ['Business Operations', 'Tự động hóa quy trình nội bộ, theo dõi tiến độ và tạo báo cáo điều hành.', Settings, ['Workflow', 'Report', 'CEO', 'Automation']],
    ['Research & Strategy', 'Nghiên cứu thị trường, đối thủ, xu hướng và đề xuất chiến lược.', Search, ['Market', 'Competitor', 'Insight', 'Strategy']],
    ['Agency Client Delivery', 'Vận hành nhiều khách hàng bằng đội AI riêng cho từng dự án hoặc từng client.', Users, ['Client', 'Delivery', 'Agency', 'QA']],
  ];
  const cardTones = [
    'from-violet-300 to-violet-500 text-white',
    'from-sky-100 to-blue-100 text-[#176bff]',
    'from-emerald-100 to-teal-100 text-emerald-600',
    'from-emerald-100 to-teal-100 text-teal-600',
    'from-violet-100 to-purple-100 text-violet-600',
    'from-orange-100 to-orange-50 text-orange-500',
  ];
  return (
    <OnboardingShell active={2} title="Bạn muốn đội AI giúp doanh nghiệp làm gì trước tiên?" subtitle="Chọn một hoặc nhiều use case để hệ thống đề xuất đội AI Agent, kỹ năng và quy trình triển khai phù hợp." titleClassName="text-[30px] font-bold leading-tight tracking-tight text-slate-900" footer={<><Button variant="secondary">Quay lại</Button><Button>Tiếp tục thiết lập đội AI</Button></>}>
      <div className="mx-auto max-w-[1210px]">
        <div className="mx-auto mb-4 max-w-[840px] rounded-lg bg-blue-50 px-5 py-2 text-center text-sm text-slate-600">
          Dựa trên thông tin doanh nghiệp của bạn, chúng tôi đề xuất bắt đầu với <b className="text-[#0f6bff]">Marketing & Content</b> hoặc <b className="text-[#0f6bff]">Business Operations</b>.
        </div>
        <div className="grid grid-cols-3 gap-4">
          {cards.map(([title, desc, Icon, tags], index) => (
            <div key={String(title)} className={`relative rounded-xl border bg-white p-4 shadow-sm ${index === 1 || index === 3 ? 'border-[#0f6bff] ring-1 ring-blue-100' : 'border-slate-200'}`}>
              <span className="absolute right-4 top-4 h-5 w-5 rounded border border-slate-300 bg-white" />
              {index === 1 || index === 3 ? <span className="absolute right-4 top-4 grid h-5 w-5 place-items-center rounded-full bg-[#0f6bff] text-white"><Check className="h-3 w-3" /></span> : null}
              <div className="flex gap-4">
                <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br shadow-[0_6px_14px_rgba(15,23,42,0.10)] ${cardTones[index]}`}><Icon className="h-7 w-7" /></div>
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-extrabold">{String(title)}</h2>
                    {index === 1 || index === 3 ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">Đề xuất</span> : null}
                  </div>
                  <p className="mt-1 min-h-[42px] text-sm leading-5 text-slate-500">{String(desc)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">{tags.map((tag) => <span key={tag} className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600">{tag}</span>)}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-[1fr_1fr_1fr] items-center gap-5">
          <div>
            <h2 className="font-extrabold">Use case chính</h2>
            <p className="mt-1 text-sm text-slate-500">Chọn use case chính để hệ thống ưu tiên đề xuất và cá nhân hóa trải nghiệm.</p>
          </div>
          <div className="rounded-xl border border-[#0f6bff] bg-white px-4 py-3 font-bold text-slate-900">Marketing & Content</div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900">Business Operations</div>
        </div>
        <Panel className="mt-4">
          <div className="grid grid-cols-[300px_1fr] items-center gap-4 p-3.5">
            <div>
              <h2 className="text-lg font-extrabold">Đội AI đề xuất</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Hệ thống sẽ dựa trên use case bạn chọn để đề xuất đội AI Agent và quy trình vận hành phù hợp nhất.</p>
            </div>
            <div className="grid grid-cols-6 gap-3">
              {['CEO Agent', 'CMO Agent', 'Content Agent', 'SEO Agent', 'Report Agent', 'QA Agent'].map((agent, index) => (
                <div key={agent} className="rounded-xl border border-slate-200 bg-white p-2.5 text-center shadow-sm">
                  <div className="mx-auto grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-[#0f6bff]">{index === 0 ? <Users className="h-5 w-5" /> : <Bot className="h-5 w-5" />}</div>
                  <div className="mt-1.5 text-xs font-bold">{agent}</div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </OnboardingShell>
  );
}

function UseCaseOnboardingParityPage() {
  return (
    <div className="relative h-[992px] w-[1586px] overflow-hidden bg-gradient-to-br from-white via-white to-[#eef6ff]">
      <img className="absolute left-0 top-0 h-[112px] w-[1586px]" src="/stitch_ui/parity_04/brand-header.png" alt="UIKIGAI onboarding header" />
      <img className="absolute left-0 top-[112px] h-[782px] w-[1586px]" src="/stitch_ui/parity_04/body-band.png" alt="Chọn use case chính cho AI Workforce" />
      <img className="absolute left-0 top-[894px] h-[98px] w-[1586px]" src="/stitch_ui/parity_04/footer-band.png" alt="Hành động tiếp tục onboarding" />
      <img className="absolute left-[222px] top-[112px] h-[90px] w-[1142px]" src="/stitch_ui/parity_04/stepper.png" alt="Tiến trình onboarding: bước Use case" />
      <img className="absolute left-[354px] top-[202px] h-[96px] w-[878px]" src="/stitch_ui/parity_04/title.png" alt="Chọn use case chính" />
      <img className="absolute left-[157px] top-[298px] h-[586px] w-[794px]" src="/stitch_ui/parity_04/selection-panel.png" alt="Khu vực chọn use case" />
      <img className="absolute left-[986px] top-[298px] h-[586px] w-[444px]" src="/stitch_ui/parity_04/suggestion-panel.png" alt="Gợi ý cấu hình AI Workforce" />
      <img className="absolute left-[582px] top-[894px] h-[66px] w-[422px]" src="/stitch_ui/parity_04/footer.png" alt="Quay lại và tiếp tục" />
    </div>
  );
}

export function TeamSetupScreen() {
  const agents = [
    ['CEO Agent', 'Điều phối mục tiêu & chiến lược', 'Planning, Report', '$10-20'],
    ['CMO Agent', 'Lập kế hoạch chiến dịch và SEO', 'Web, File, Productivity', '$15-30'],
    ['Research Agent', 'Nghiên cứu thị trường và đối thủ', 'Web, File', '$10-25'],
    ['Content Agent', 'Tạo content brief, social post, email', 'Creative, File', '$15-35'],
    ['QA Agent', 'Kiểm tra nội dung, logic, rủi ro', 'Review, File', '$10-20'],
    ['Report Agent', 'Tạo báo cáo tuần và tiến độ', 'Productivity', '$10-20'],
  ];
  return (
    <OnboardingShell active={3} title="Đội AI đầu tiên của bạn đã sẵn sàng" subtitle="Dựa trên use case đã chọn, hệ thống đề xuất một đội AI Agent có vai trò, kỹ năng và ngân sách phù hợp." footer={<><Button variant="secondary">Quay lại</Button><Button variant="secondary">Tùy chỉnh nâng cao</Button><Button>Tạo đội AI đầu tiên</Button></>}>
      <div className="grid grid-cols-[1.05fr_.95fr] gap-6">
        <Panel title="Đội AI được đề xuất">
          <div className="divide-y divide-slate-100 p-4">
            {agents.map(([name, role, tools, cost]) => (
              <div key={name} className="grid grid-cols-[56px_1fr_210px_90px_44px] items-center gap-4 py-3">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-[#0f6bff]"><Bot className="h-6 w-6" /></div>
                <div><b>{name}</b><div className="text-sm text-slate-500">{role}</div></div>
                <div className="flex flex-wrap gap-1">{tools.split(', ').map((tool) => <Badge key={tool} tone="blue">{tool}</Badge>)}</div>
                <div className="font-bold text-slate-900">{cost}<span className="block text-xs font-medium text-slate-500">/tháng</span></div>
                <div className="h-6 w-11 rounded-full bg-[#0f6bff] p-1"><div className="ml-auto h-4 w-4 rounded-full bg-white" /></div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Cấu trúc đội AI">
          <div className="grid min-h-[520px] place-items-center bg-[radial-gradient(circle_at_1px_1px,#dbe4ef_1px,transparent_0)] [background-size:18px_18px] p-8">
            <div className="flex flex-col items-center gap-5">
              <OrgNode title="CEO Agent" />
              <div className="h-12 w-px bg-slate-300" />
              <OrgNode title="CMO Agent" tone="cyan" />
              <div className="grid grid-cols-4 gap-8">
                {['Research Agent', 'Content Agent', 'QA Agent', 'Report Agent'].map((item, index) => <OrgNode key={item} title={item} small tone={index === 1 ? 'purple' : index === 2 ? 'amber' : 'cyan'} />)}
              </div>
              <div className="grid grid-cols-4 divide-x overflow-hidden rounded-xl border border-slate-200 bg-white">
                {['Tổng agent 6', 'Skills 12', 'Toolsets 5', 'Ước tính $80-150'].map((item) => <div key={item} className="px-8 py-4 text-center font-bold text-[#0f6bff]">{item}</div>)}
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </OnboardingShell>
  );
}

function AiTeamOnboardingParityPage() {
  return (
    <div className="relative h-[1024px] w-[1536px] overflow-hidden bg-gradient-to-br from-white via-white to-[#eef6ff]">
      <img className="absolute left-0 top-0 h-[112px] w-[1536px]" src="/stitch_ui/parity_05/brand-header.png" alt="UIKIGAI onboarding header" />
      <img className="absolute left-0 top-[112px] h-[792px] w-[1536px]" src="/stitch_ui/parity_05/body-band.png" alt="Đội AI đầu tiên của bạn đã sẵn sàng" />
      <img className="absolute left-0 top-[904px] h-[120px] w-[1536px]" src="/stitch_ui/parity_05/footer-band.png" alt="Hành động tạo đội AI đầu tiên" />
      <img className="absolute left-[178px] top-[112px] h-[92px] w-[1180px]" src="/stitch_ui/parity_05/stepper.png" alt="Tiến trình onboarding: bước AI Team" />
      <img className="absolute left-[330px] top-[204px] h-[104px] w-[876px]" src="/stitch_ui/parity_05/title.png" alt="Đội AI đầu tiên của bạn đã sẵn sàng" />
      <img className="absolute left-[132px] top-[308px] h-[576px] w-[804px]" src="/stitch_ui/parity_05/selection-panel.png" alt="Đội AI được đề xuất" />
      <img className="absolute left-[968px] top-[308px] h-[576px] w-[436px]" src="/stitch_ui/parity_05/suggestion-panel.png" alt="Cấu trúc đội AI" />
      <img className="absolute left-[548px] top-[904px] h-[74px] w-[440px]" src="/stitch_ui/parity_05/footer.png" alt="Quay lại, tùy chỉnh nâng cao và tạo đội AI đầu tiên" />
    </div>
  );
}

function OrgNode({ title, small = false, tone = 'blue' }: { title: string; small?: boolean; tone?: Tone }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white text-center shadow-sm ${small ? 'w-30 p-4' : 'w-52 p-5'}`}>
      <div className={`mx-auto grid h-12 w-12 place-items-center rounded-full ${tone === 'cyan' ? 'bg-cyan-50 text-cyan-600' : tone === 'amber' ? 'bg-amber-50 text-amber-600' : tone === 'purple' ? 'bg-violet-50 text-violet-600' : 'bg-blue-50 text-[#0f6bff]'}`}><Bot className="h-6 w-6" /></div>
      <div className="mt-3 font-extrabold">{title}</div>
    </div>
  );
}

function TeamOrgCard({ title, small = false, tone = 'blue' }: { title: string; small?: boolean; tone?: Tone }) {
  const color = tone === 'cyan' ? 'from-cyan-400 to-cyan-600' : tone === 'amber' ? 'from-orange-400 to-orange-600' : tone === 'purple' ? 'from-violet-400 to-violet-600' : 'from-[#125cff] to-[#003fb6]';

  if (small) {
    return (
      <div className="flex h-[118px] w-[118px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white text-center shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
        <div className={`grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br ${color} text-white`}><Bot className="h-5 w-5" /></div>
        <div className="mt-3 text-base font-extrabold leading-5 text-slate-950">{title}</div>
      </div>
    );
  }

  return (
    <div className="flex h-[72px] w-[205px] items-center justify-center gap-4 rounded-xl border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
      <div className={`grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br ${color} text-white`}><Bot className="h-6 w-6" /></div>
      <div className="text-base font-extrabold text-slate-950">{title}</div>
    </div>
  );
}

export function TeamSetupScreenPolished() {
  const agents = [
    ['CEO Agent', 'Điều phối mục tiêu & chiến lược', 'Theo dõi mục tiêu, phân bổ công việc và đề xuất ưu tiên.', ['Planning', 'Report'], '$10-20', 'blue'],
    ['CMO Agent', 'Marketing & Growth', 'Lập kế hoạch chiến dịch và điều phối content/SEO/report agent.', ['Web', 'File', 'Productivity'], '$15-30', 'cyan'],
    ['Research Agent', 'Nghiên cứu & Phân tích', 'Nghiên cứu thị trường, insight, đối thủ và xu hướng.', ['Web', 'File'], '$10-25', 'cyan'],
    ['Content Agent', 'Nội dung & Truyền thông', 'Tạo content brief, social post, video script và email.', ['Web', 'Creative', 'File'], '$15-35', 'purple'],
    ['QA Agent', 'Kiểm tra chất lượng', 'Kiểm tra nội dung, logic, rủi ro và tiêu chí nghiệm thu.', ['File', 'Review'], '$10-20', 'amber'],
    ['Report Agent', 'Báo cáo & Tổng hợp', 'Tạo báo cáo tuần, báo cáo chi phí và báo cáo tiến độ.', ['File', 'Productivity'], '$10-20', 'cyan'],
  ] as const;

  const org = [
    ['CEO Agent', 'blue'],
    ['CMO Agent', 'cyan'],
    ['Research Agent', 'cyan'],
    ['Content Agent', 'purple'],
    ['QA Agent', 'amber'],
    ['Report Agent', 'cyan'],
  ] as const;

  return (
    <div className="min-h-screen overflow-hidden rounded-[14px] border border-slate-200 bg-gradient-to-br from-white via-white to-[#eef6ff]">
      <header className="flex h-[65px] items-center justify-between border-b border-slate-200 bg-white/86 px-8">
        <BrandMarkInline />
        <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600">
          <HelpCircle className="h-4 w-4" />
          Trợ giúp
        </button>
      </header>

      <main className="relative px-16 pb-9 pt-6">
        <div className="pointer-events-none absolute -left-16 top-[260px] h-72 w-48 bg-[radial-gradient(circle,#d8e8ff_1.3px,transparent_1.3px)] [background-size:12px_12px] opacity-70" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 bg-[radial-gradient(circle,#d8e8ff_1.3px,transparent_1.3px)] [background-size:12px_12px] opacity-70" />

        <div className="-mb-4">
          <Stepper active={3} />
        </div>
        <div className="mx-auto max-w-5xl text-center">
          <h1 className="text-[36px] font-extrabold leading-tight tracking-tight text-slate-950">Đội AI đầu tiên của bạn đã sẵn sàng</h1>
          <p className="mt-3 text-[15px] leading-6 text-slate-500">Dựa trên use case đã chọn, hệ thống đề xuất một đội AI Agent có vai trò, kỹ năng và ngân sách phù hợp.</p>
          <p className="text-[15px] leading-6 text-slate-500">Bạn có thể chỉnh sửa trước khi tạo.</p>
        </div>

        <div className="mx-auto mt-3 grid max-w-[1408px] grid-cols-[1.05fr_.95fr] gap-0">
          <section className="rounded-l-xl border border-r-0 border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
            <div className="flex h-[62px] items-center justify-between border-b border-slate-100 px-7">
              <h2 className="text-xl font-extrabold text-slate-950">Đội AI được đề xuất</h2>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-bold text-[#0f6bff]">6 / 6 agent được chọn</span>
            </div>
            <div className="space-y-0 p-4">
              {agents.map(([name, role, mission, tools, cost, tone]) => (
                <div key={name} className="grid min-h-[76px] grid-cols-[56px_1fr_116px_80px_40px_32px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2">
                  <div className={`grid h-12 w-12 place-items-center rounded-full text-white ${tone === 'cyan' ? 'bg-gradient-to-br from-cyan-400 to-cyan-600' : tone === 'purple' ? 'bg-gradient-to-br from-violet-400 to-violet-600' : tone === 'amber' ? 'bg-gradient-to-br from-orange-400 to-orange-600' : 'bg-gradient-to-br from-[#125cff] to-[#003fb6]'}`}>
                    <Bot className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-base font-extrabold text-slate-950">{name}</div>
                    <div className="mt-0.5 text-[11px] font-semibold leading-4 text-slate-600">Role: {role}</div>
                    <div className="text-[11px] leading-4 text-slate-600">Mission: {mission}</div>
                  </div>
                  <div>
                    <div className="mb-2 text-[11px] font-semibold text-slate-500">Toolsets:</div>
                    <div className="flex flex-wrap gap-1.5">{tools.map((tool) => <Badge key={tool} tone="cyan">{tool}</Badge>)}</div>
                  </div>
                  <div className="text-center text-base font-bold text-[#0f376b]">{cost}<span className="block text-xs font-medium text-slate-500">/tháng</span></div>
                  <div className="flex h-5 w-10 items-center rounded-full bg-[#0f6bff] p-0.5">
                    <span className="ml-auto h-4 w-4 rounded-full bg-white" />
                  </div>
                  <button className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-[#0f6bff]">
                    <Settings className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-r-xl border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
            <div className="flex h-[62px] items-center border-b border-slate-100 px-7">
              <h2 className="text-xl font-extrabold text-slate-950">Cấu trúc đội AI</h2>
            </div>
            <div className="relative mx-5 mt-5 h-[360px] rounded-xl bg-[radial-gradient(circle_at_1px_1px,#d8e8ff_1px,transparent_0)] [background-size:18px_18px]">
              <div className="absolute left-1/2 top-[72px] h-[128px] w-px -translate-x-1/2 bg-slate-300" />
              <div className="absolute left-[124px] right-[124px] top-[200px] h-px bg-slate-300" />
              <div className="absolute left-[124px] top-[200px] h-[34px] w-px bg-slate-300" />
              <div className="absolute left-[276px] top-[200px] h-[34px] w-px bg-slate-300" />
              <div className="absolute right-[276px] top-[200px] h-[34px] w-px bg-slate-300" />
              <div className="absolute right-[124px] top-[200px] h-[34px] w-px bg-slate-300" />
              <div className="absolute left-1/2 top-0 -translate-x-1/2"><TeamOrgCard title={org[0][0]} /></div>
              <div className="absolute left-1/2 top-[92px] -translate-x-1/2"><TeamOrgCard title={org[1][0]} tone="cyan" /></div>
              <div className="absolute bottom-0 left-7"><TeamOrgCard title={org[2][0]} small tone="cyan" /></div>
              <div className="absolute bottom-0 left-[178px]"><TeamOrgCard title={org[3][0]} small tone="purple" /></div>
              <div className="absolute bottom-0 right-[178px]"><TeamOrgCard title={org[4][0]} small tone="amber" /></div>
              <div className="absolute bottom-0 right-7"><TeamOrgCard title={org[5][0]} small tone="cyan" /></div>
            </div>
            <div className="mx-5 mt-5 grid h-[106px] grid-cols-4 overflow-hidden rounded-xl border border-blue-100 bg-blue-50/20">
              {[
                ['Tổng agent', '6'],
                ['Skills cài sẵn', '12'],
                ['Toolsets', '5'],
                ['Ước tính chi phí', '$80-150'],
              ].map(([label, value]) => (
                <div key={label} className="grid place-items-center border-r border-blue-100 text-center last:border-r-0">
                  <div className="text-sm font-semibold text-[#0f376b]">{label}<div className="mt-2 text-3xl font-extrabold text-[#0f376b]">{value}</div></div>
                </div>
              ))}
            </div>
            <div className="mx-5 mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm font-semibold text-[#0f6bff]">Chi phí ước tính có thể thay đổi tùy theo mức độ sử dụng và cấu hình công cụ.</div>
          </section>
        </div>

        <div className="mx-auto mt-7 grid max-w-[1408px] grid-cols-[165px_1fr_334px] items-center gap-7">
          <Button variant="secondary">Quay lại</Button>
          <div className="flex justify-end"><Button variant="secondary">Tùy chỉnh nâng cao</Button></div>
          <Button>Tạo đội AI đầu tiên</Button>
        </div>
      </main>
    </div>
  );
}

export function HermesScreen() {
  return (
    <OnboardingShell active={4} title="Kết nối Hermes Runtime" subtitle="Hermes giúp agent thực thi task trong môi trường kiểm soát, có log và phê duyệt rõ ràng." footer={<><Button variant="secondary">Quay lại</Button><Button>Kết nối Hermes</Button></>}>
      <div className="grid grid-cols-[.85fr_1.15fr] gap-8">
        <Panel title="Trạng thái kết nối">
          <div className="p-8">
            <div className="grid h-24 w-24 place-items-center rounded-3xl bg-blue-50 text-[#0f6bff]"><Zap className="h-12 w-12" /></div>
            <h2 className="mt-6 text-2xl font-extrabold">Hermes Runtime local</h2>
            <p className="mt-3 leading-7 text-slate-500">Kết nối an toàn để chạy agent, thu log và yêu cầu approval trước các hành động rủi ro.</p>
            <div className="mt-6 space-y-3">
              {['Terminal access yêu cầu phê duyệt', 'Không đọc secret thật', 'Không ghi filesystem ngoài workspace'].map((item) => <div key={item} className="flex items-center gap-3 font-semibold"><CheckCircle2 className="h-5 w-5 text-emerald-500" />{item}</div>)}
            </div>
          </div>
        </Panel>
        <Panel title="Quyền thực thi">
          <div className="grid grid-cols-2 gap-4 p-6">
            {['File read', 'Browser', 'Terminal command', 'MCP access', 'Secret access', 'Payment action'].map((item, index) => <div key={item} className="rounded-xl border border-slate-200 p-4"><div className="font-bold">{item}</div><Badge tone={index < 2 ? 'green' : index < 4 ? 'amber' : 'red'}>{index < 2 ? 'Allowed' : index < 4 ? 'Requires approval' : 'Blocked'}</Badge></div>)}
          </div>
        </Panel>
      </div>
    </OnboardingShell>
  );
}

function HermesScreenPolished() {
  const statusRows = [
    ['Hermes CLI detected', 'Passed', 'green'],
    ['Adapter hermes_local registered', 'Passed', 'green'],
    ['Model provider connected', 'Passed', 'green'],
    ['Default model available', 'Passed', 'green'],
    ['Workspace accessible', 'Passed', 'green'],
    ['File tool enabled', 'Passed', 'green'],
    ['Terminal tool enabled', 'Passed', 'green'],
    ['Web tool enabled', 'Passed', 'green'],
    ['MCP optional', 'Warning', 'amber'],
  ] as const;
  const toolsets = ['File', 'Terminal', 'Web', 'Browser', 'MCP', 'Productivity'];

  return (
    <OnboardingShell active={4} title="Kết nối Hermes Agent Runtime" subtitle="Hermes là lớp thực thi giúp đội AI của bạn sử dụng công cụ, ghi nhớ ngữ cảnh, chạy tác vụ và trả kết quả về dashboard." footer={<><Button variant="secondary">Quay lại</Button><Button>Tiếp tục</Button></>}>
      <div className="mx-auto mt-4 grid h-[604px] max-w-[1260px] grid-cols-[1.08fr_.92fr] gap-4">
        <Panel title="Cấu hình Runtime" className="h-full overflow-hidden">
          <div className="space-y-4 p-6">
            <div className="grid grid-cols-2 gap-4">
              <button className="flex h-12 items-center justify-center gap-3 rounded-lg border border-[#0f6bff] bg-blue-50 text-base font-bold text-[#0f6bff]">
                <Settings className="h-5 w-5" /> Local / VPS Runtime
              </button>
              <button className="flex h-12 items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white text-base font-semibold text-slate-500">
                <Zap className="h-5 w-5" /> Remote Runtime <span className="rounded-md bg-slate-100 px-2 py-1 text-xs">Sắp hỗ trợ</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                ['Hermes command path', 'hermes'],
                ['Adapter type', 'hermes_local'],
                ['Model provider', 'OpenRouter'],
                ['Default model', 'Claude Sonnet'],
              ].map(([label, value]) => (
                <label key={label} className="block text-sm font-medium text-slate-700">
                  {label}
                  <div className="mt-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-base font-medium text-slate-700">{value}</div>
                </label>
              ))}
            </div>

            <label className="block text-sm font-medium text-slate-700">
              Workspace path
              <div className="mt-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-base font-medium text-slate-700">/home/aiops/workspaces/demo-company</div>
            </label>

            <div>
              <div className="mb-3 text-sm font-medium text-slate-700">Toolsets</div>
              <div className="grid grid-cols-6 gap-3">
                {toolsets.map((tool, index) => (
                  <div key={tool} className={`flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold ${index === 4 ? 'border-slate-200 bg-white text-slate-600' : 'border-blue-200 bg-blue-50 text-[#0f6bff]'}`}>
                    <span className={`grid h-4 w-4 place-items-center rounded ${index === 4 ? 'border border-slate-300' : 'bg-[#0f6bff] text-white'}`}>{index === 4 ? '' : <Check className="h-3 w-3" />}</span>
                    {tool}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center pt-1">
              <button className="inline-flex h-12 w-[245px] items-center justify-center gap-3 rounded-lg bg-[#0f6bff] text-base font-bold text-white shadow-[0_12px_28px_rgba(15,98,255,0.22)]">
                <Zap className="h-5 w-5" /> Kiểm tra kết nối
              </button>
            </div>
          </div>
        </Panel>

        <Panel title="Runtime Status" className="h-full overflow-hidden">
          <div className="px-6 py-5">
            <div className="divide-y divide-slate-100">
              {statusRows.map(([label, status, tone]) => (
                <div key={label} className="grid grid-cols-[34px_1fr_92px] items-center gap-3 py-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-slate-700"><FileText className="h-4 w-4" /></div>
                  <div className="text-[15px] font-medium text-slate-700">{label}</div>
                  <Badge tone={tone}>{status}</Badge>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-white text-emerald-600">
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <div>
                  <div className="text-lg font-extrabold text-emerald-700">Hermes Runtime đã sẵn sàng</div>
                  <div className="mt-1 text-sm text-slate-600">Đội AI của bạn có thể bắt đầu nhận nhiệm vụ.</div>
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </OnboardingShell>
  );
}

function HermesOnboardingParityPage() {
  return (
    <div className="relative h-[1024px] w-[1536px] overflow-hidden bg-gradient-to-br from-white via-white to-[#eef6ff] font-sans text-[#0b1733]">
      <div className="pointer-events-none absolute left-0 top-[274px] h-[244px] w-[188px] bg-[radial-gradient(circle,#d8e8ff_1.3px,transparent_1.3px)] [background-size:12px_12px] opacity-70" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[286px] w-[305px] bg-[radial-gradient(circle,#d8e8ff_1.3px,transparent_1.3px)] [background-size:12px_12px] opacity-70" />
      <div className="pointer-events-none absolute -right-[80px] top-[372px] h-[520px] w-[520px] rounded-full border border-white/70" />
      <div className="pointer-events-none absolute -left-[390px] bottom-[23px] h-[520px] w-[620px] rounded-full border border-white/70" />
      <img className="absolute left-[588px] top-[34px] h-[66px] w-[361px]" src="/stitch_ui/parity_06/brand-header.png" alt="UIKIGAI AI Workforce OS" />
      <img className="absolute left-[229px] top-[94px] h-[72px] w-[1058px]" src="/stitch_ui/parity_06/stepper.png" alt="Tiến trình onboarding: bước Hermes" />
      <img className="absolute left-[335px] top-[211px] h-[76px] w-[866px]" src="/stitch_ui/parity_06/title.png" alt="Kết nối Hermes Agent Runtime" />
      <img className="absolute left-[1245px] top-[178px] h-[128px] w-[190px]" src="/stitch_ui/parity_06/hero-illustration.png" alt="" aria-hidden="true" />
      <img className="absolute left-[112px] top-[305px] h-[604px] w-[727px]" src="/stitch_ui/parity_06/runtime-config-panel.png" alt="Cấu hình Runtime" />
      <img className="absolute left-[854px] top-[305px] h-[604px] w-[568px]" src="/stitch_ui/parity_06/status-panel.png" alt="Runtime Status" />
      <img className="absolute left-[459px] top-[934px] h-[49px] w-[599px]" src="/stitch_ui/parity_06/footer.png" alt="Quay lại và Tiếp tục" />
    </div>
  );
}

export function CompleteScreen() {
  return (
    <OnboardingShell active={5} title="Workspace đã sẵn sàng" subtitle="Đội AI đầu tiên đã được tạo với mock runtime, ticket mẫu và quy trình phê duyệt an toàn." footer={<><Button variant="secondary">Xem thiết lập</Button><Button>Vào Command Center</Button></>}>
      <div className="mx-auto grid max-w-5xl grid-cols-3 gap-5">
        {['Tạo đội AI đầu tiên', 'Sinh ticket mẫu', 'Bật approval guardrail'].map((item, index) => <Panel key={item}><div className="p-6 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" /><h2 className="mt-4 text-lg font-extrabold">{item}</h2><p className="mt-2 text-sm text-slate-500">{['6 agent đã sẵn sàng.', 'Audit Module 3 được giao cho Hermes.', 'Hành động rủi ro sẽ cần bạn duyệt.'][index]}</p></div></Panel>)}
      </div>
    </OnboardingShell>
  );
}

function CompletePartyIcon() {
  return (
    <svg viewBox="0 0 44 44" className="ml-2 inline-block h-10 w-10 align-[-7px]" aria-hidden="true">
      <path d="M9 34 16 16l12 12Z" fill="#176bff" />
      <path d="M16 16 28 28l-7 4Z" fill="#00bcd4" />
      <path d="M10 34 21 31 14 24Z" fill="#7c5cff" />
      <path d="M24 10c5-5 10 1 5 6" fill="none" stroke="#ff5b7f" strokeLinecap="round" strokeWidth="3" />
      <path d="M30 20c5-3 8 2 4 5" fill="none" stroke="#00bcd4" strokeLinecap="round" strokeWidth="3" />
      <path d="M18 9c-2-5 5-7 6-2" fill="none" stroke="#f59e0b" strokeLinecap="round" strokeWidth="3" />
      <circle cx="35" cy="10" r="2" fill="#176bff" />
      <circle cx="37" cy="18" r="2" fill="#ff5b7f" />
      <circle cx="29" cy="6" r="1.8" fill="#00bcd4" />
      <circle cx="22" cy="4" r="1.8" fill="#f59e0b" />
      <path d="M35 28h5" stroke="#f59e0b" strokeLinecap="round" strokeWidth="2.5" />
      <path d="M39 4l3 3" stroke="#ff5b7f" strokeLinecap="round" strokeWidth="2.5" />
    </svg>
  );
}

function CompleteScreenPolished() {
  const tasks = [
    ['1. Tạo kế hoạch nội dung 30 ngày', 'Đội AI sẽ đề xuất lịch nội dung, chủ đề và định dạng phù hợp.', 'blue'],
    ['2. Nghiên cứu insight khách hàng mục tiêu', 'Research Agent phân tích pain point, nhu cầu và hành vi khách hàng.', 'cyan'],
    ['3. Phân tích đối thủ cạnh tranh', 'Tổng hợp điểm mạnh, điểm yếu và cơ hội khác biệt hóa.', 'purple'],
    ['4. Tạo SEO topic cluster', 'Đề xuất nhóm chủ đề SEO, từ khóa và outline bài viết.', 'amber'],
    ['5. Viết 10 kịch bản video ngắn', 'Content Agent tạo kịch bản TikTok/Reels/Shorts theo insight.', 'red'],
    ['6. Tạo báo cáo marketing tuần đầu tiên', 'Report Agent chuẩn bị mẫu báo cáo hiệu quả vận hành.', 'green'],
  ] as const;
  const summaryRows = [
    ['Công ty', 'Demo Company', Building2],
    ['Use case', 'Marketing & Content', Target],
    ['Agents đã tạo', '6', Users],
    ['Hermes Runtime', 'Connected', ShieldCheck],
    ['Skills đã cài đặt', '12', Ticket],
    ['Toolsets đã bật', '5', Settings],
    ['Ước tính chi phí hằng tháng', '$80-150', CheckCircle2],
  ] as const;

  return (
    <div className="min-h-screen overflow-hidden rounded-[14px] border border-slate-200 bg-gradient-to-br from-white via-white to-[#eef6ff]">
      <header className="flex h-[62px] items-center justify-between border-b border-slate-200 bg-white/86 px-7">
        <BrandMarkInline />
        <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600">
          <HelpCircle className="h-4 w-4" />
          Trợ giúp
        </button>
      </header>
      <main className="relative px-20 pb-8 pt-7">
        <div className="-mb-3">
          <CompleteStepper />
        </div>
        <section className="mx-auto grid max-w-[1080px] grid-cols-[330px_1fr] items-center gap-8">
          <div className="relative h-[156px]">
            <svg viewBox="0 0 330 156" className="absolute inset-0 h-full w-full" aria-hidden="true">
              <defs>
                <linearGradient id="complete-cube-left" x1="122" y1="57" x2="166" y2="124" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#00d2c7" />
                  <stop offset="1" stopColor="#0f6bff" />
                </linearGradient>
                <linearGradient id="complete-cube-right" x1="166" y1="57" x2="210" y2="124" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#2aa7ff" />
                  <stop offset="1" stopColor="#0052cc" />
                </linearGradient>
                <filter id="complete-soft-shadow" x="-20%" y="-20%" width="140%" height="160%">
                  <feDropShadow dx="0" dy="14" stdDeviation="10" floodColor="#0052cc" floodOpacity="0.18" />
                </filter>
              </defs>
              <path d="M90 132 C122 118 194 118 226 132 C190 145 126 145 90 132Z" fill="#dbeafe" />
              <path d="M106 122 C134 112 181 112 210 122" fill="none" stroke="#60a5fa" strokeWidth="4" strokeLinecap="round" />
              <g filter="url(#complete-soft-shadow)">
                <path d="M166 32 L214 58 L166 84 L118 58Z" fill="#23d3c5" />
                <path d="M118 58 L166 84 L166 132 L118 105Z" fill="url(#complete-cube-left)" />
                <path d="M214 58 L166 84 L166 132 L214 105Z" fill="url(#complete-cube-right)" />
                <path d="M143 73 L166 61 L190 73 L190 99 L166 112 L143 99Z" fill="white" opacity="0.96" />
              </g>
              <path d="M69 47 C82 36 80 65 93 54" fill="none" stroke="#0f6bff" strokeWidth="5" strokeLinecap="round" />
              <path d="M253 48 C266 37 264 66 277 55" fill="none" stroke="#0f6bff" strokeWidth="5" strokeLinecap="round" />
              <circle cx="51" cy="72" r="3" fill="#00bcd4" />
              <circle cx="100" cy="28" r="3" fill="#f59e0b" />
              <circle cx="244" cy="31" r="3" fill="#00bcd4" />
              <circle cx="279" cy="83" r="3" fill="#f59e0b" />
              <path d="M35 115 l6 -10 l6 10 l-6 10z" fill="#0f6bff" />
              <path d="M116 13 l5 -8 l5 8 l-5 8z" fill="#f59e0b" />
              <path d="M218 8 l5 -8 l5 8 l-5 8z" fill="#00bcd4" />
              <path d="M294 108 l5 -8 l5 8 l-5 8z" fill="#f59e0b" />
              <circle cx="69" cy="87" r="1.8" fill="#93c5fd" />
              <circle cx="235" cy="58" r="1.8" fill="#93c5fd" />
            </svg>
          </div>
          <div className="-ml-10 pt-2">
            <h1 className="text-[44px] font-bold leading-tight tracking-tight text-[#081b4a]">Đội AI của bạn đã sẵn sàng <CompletePartyIcon /></h1>
            <p className="mt-4 text-lg leading-7 text-[#29406f]">Bạn đã hoàn tất thiết lập workspace, đội AI Agent và Hermes Runtime.</p>
            <p className="text-lg leading-7 text-[#29406f]">Hãy giao nhiệm vụ đầu tiên để bắt đầu tạo kết quả thực tế.</p>
          </div>
        </section>

        <div className="mx-auto mt-5 grid max-w-[1376px] grid-cols-[1fr_500px] gap-6">
          <section className="h-[525px] overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
            <h2 className="text-xl font-bold text-[#081b4a]">Bạn muốn đội AI làm gì đầu tiên?</h2>
            <p className="mt-2 text-sm text-[#52627f]">Chọn một nhiệm vụ mẫu hoặc tạo nhiệm vụ tùy chỉnh.</p>
            <div className="mt-6 grid grid-cols-3 gap-5">
              {tasks.map(([title, desc, tone], index) => (
                <div key={title} className={`relative h-[136px] overflow-hidden rounded-xl border bg-white p-4 ${index === 0 ? 'border-[#0f6bff] ring-1 ring-blue-100' : 'border-slate-200'}`}>
                  {index === 0 ? <span className="absolute -right-3 -top-3 grid h-7 w-7 place-items-center rounded-full bg-[#0f6bff] text-white"><Check className="h-4 w-4" /></span> : null}
                  <div className="flex items-start gap-4">
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white shadow-[0_8px_18px_rgba(15,107,255,0.16)] ${tone === 'cyan' ? 'bg-[#08b8c8]' : tone === 'purple' ? 'bg-[#7c5cff]' : tone === 'amber' ? 'bg-[#ff8a2a]' : tone === 'red' ? 'bg-[#ff3d7f]' : tone === 'green' ? 'bg-[#13b89a]' : 'bg-[#176bff]'}`}>
                      {index === 0 ? <CalendarDays className="h-6 w-6" /> : index === 1 ? <Users className="h-6 w-6" /> : index === 2 ? <BarChart3 className="h-6 w-6" /> : index === 3 ? <Search className="h-6 w-6" /> : index === 4 ? <Play className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                    </div>
                    <h3 className="pt-1 text-[15px] font-bold leading-[19px] text-[#081b4a]">{title}</h3>
                  </div>
                  <p className="mt-4 text-[13px] leading-5 text-[#52627f]">{desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex h-[84px] items-center gap-6 rounded-xl border border-dashed border-blue-200 bg-white px-5">
              <span className="grid h-12 w-12 place-items-center rounded-full border border-dashed border-[#0f6bff] text-3xl font-light text-[#0f6bff]">+</span>
              <div>
                <h3 className="text-base font-bold text-[#081b4a]">Tạo nhiệm vụ tùy chỉnh</h3>
                <p className="mt-2 text-sm text-[#52627f]">Mô tả công việc riêng của bạn và chọn agent phù hợp để thực thi.</p>
              </div>
            </div>
          </section>

          <section className="h-[525px] overflow-hidden rounded-xl border border-slate-200 bg-white p-7 shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
            <h2 className="text-xl font-extrabold text-[#081b4a]">Tóm tắt thiết lập</h2>
            <div className="mt-5 divide-y divide-slate-100">
              {summaryRows.map(([label, value, Icon], index) => (
                <div key={label} className="grid h-[56px] grid-cols-[44px_1fr_auto] items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-[#0f6bff]"><Icon className="h-5 w-5" /></span>
                  <span className="text-sm text-[#52627f]">{label}</span>
                  <span className={`text-base font-bold ${index === 3 ? 'text-emerald-600' : index === 6 ? 'text-[#0f6bff]' : 'text-[#081b4a]'}`}>{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-4">
              <Badge tone="green">Ready</Badge>
              <Badge tone="green">Hermes connected</Badge>
              <Badge tone="blue">Skills synced</Badge>
            </div>
          </section>
        </div>

        <div className="mx-auto mt-8 grid max-w-[1376px] grid-cols-[245px_1fr_390px] items-start gap-6">
          <button className="inline-flex h-14 items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-6 text-[15px] font-semibold text-[#081b4a] shadow-sm">
            <ChevronLeft className="h-5 w-5" />
            Vào Command Center
          </button>
          <div className="flex h-14 items-center justify-center gap-2 text-sm font-semibold text-[#0f6bff]">
            <BookOpen className="h-5 w-5" />
            Xem hướng dẫn sử dụng
          </div>
          <div>
            <button className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-xl border border-transparent bg-gradient-to-r from-[#0f6bff] to-[#00bcd4] px-6 text-[15px] font-bold text-white shadow-[0_14px_30px_rgba(15,107,255,0.22)]">
              <Sparkles className="h-5 w-5" />
              Tạo nhiệm vụ đầu tiên
              <ChevronRight className="h-5 w-5" />
            </button>
            <p className="mt-3 text-center text-xs text-[#64748b]">Vui lòng chọn một mẫu nhiệm vụ hoặc tạo nhiệm vụ tùy chỉnh.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

function CompleteOnboardingParityPage() {
  return (
    <div className="relative h-[1024px] w-[1536px] overflow-hidden bg-gradient-to-br from-white via-white to-[#eef6ff]">
      <img className="absolute left-0 top-0 h-[112px] w-[1536px]" src="/stitch_ui/parity_07/brand-header.png" alt="UIKIGAI onboarding header" />
      <img className="absolute left-0 top-[112px] h-[792px] w-[1536px]" src="/stitch_ui/parity_07/body-band.png" alt="Workspace AI đã sẵn sàng" />
      <img className="absolute left-0 top-[904px] h-[120px] w-[1536px]" src="/stitch_ui/parity_07/footer-band.png" alt="Hành động bắt đầu sử dụng" />
      <img className="absolute left-[178px] top-[112px] h-[92px] w-[1180px]" src="/stitch_ui/parity_07/stepper.png" alt="Tiến trình onboarding hoàn tất" />
      <img className="absolute left-[304px] top-[204px] h-[188px] w-[928px]" src="/stitch_ui/parity_07/completion-hero.png" alt="Đội AI của bạn đã sẵn sàng" />
      <img className="absolute left-[148px] top-[392px] h-[492px] w-[610px]" src="/stitch_ui/parity_07/summary-panel.png" alt="Nhiệm vụ đầu tiên" />
      <img className="absolute left-[790px] top-[392px] h-[492px] w-[598px]" src="/stitch_ui/parity_07/next-steps-panel.png" alt="Tóm tắt thiết lập" />
      <img className="absolute left-[520px] top-[904px] h-[74px] w-[496px]" src="/stitch_ui/parity_07/cta-footer.png" alt="Vào Command Center và tạo nhiệm vụ đầu tiên" />
    </div>
  );
}

const todayKpis = [
  { label: 'Cần bạn xem', value: '12', tone: 'blue' as Tone, icon: Eye },
  { label: 'Đến hạn hôm nay', value: '8', tone: 'green' as Tone, icon: Clock3 },
  { label: 'Agent đang chờ', value: '5', tone: 'purple' as Tone, icon: Bot },
  { label: 'Run lỗi', value: '3', tone: 'red' as Tone, icon: AlertTriangle },
  { label: 'Báo cáo sẵn sàng', value: '4', tone: 'cyan' as Tone, icon: FileText },
];

export function TodayScreen() {
  return (
    <div>
      <div data-parity-id="today.header">
      <h1 className="text-[32px] font-extrabold text-slate-950">Today</h1>
      <p className="mt-1 text-slate-500">Những việc quan trọng cần xử lý hôm nay để đội AI vận hành thông suốt</p>
      </div>
      <div data-parity-id="today.kpi-band" className="mt-3 grid grid-cols-5 gap-4">{todayKpis.map((kpi) => <KpiTile key={kpi.label} {...kpi} />)}</div>
      <div data-parity-id="today.main-grid" className="mt-3 grid grid-cols-[1.05fr_1fr] items-start gap-4">
        <div data-parity-id="today.priority-panel" className="space-y-4">
          <Panel title="Việc cần ưu tiên" action={<button className="text-sm font-bold text-[#0f6bff]">Xem tất cả →</button>}>
            <TaskRows rows={['Duyệt Hermes QA Report cho Module 3', 'Review failed run của Research Agent', 'Phê duyệt Content Agent xuất bản 10 bài social', 'Tăng budget cho SEO Agent']} />
          </Panel>
          <Panel title="Ticket đến hạn hôm nay"><TaskRows rows={['Audit Module 3', 'Create SEO Topic Cluster', 'Prepare Weekly CEO Report', 'Review Landing Page Copy']} ticket /></Panel>
        </div>
        <div data-parity-id="today.summary-panel" className="space-y-4">
          <Panel title="Tóm tắt trong ngày"><div className="m-5 rounded-xl border border-blue-100 bg-blue-50 p-5 leading-7 text-slate-700">Hôm nay có 12 việc cần xử lý. Trong đó có 4 approval, 3 ticket đến hạn và 2 agent đang chờ phản hồi.</div></Panel>
          <Panel title="Agent đang chờ phản hồi"><CompactRows rows={['Hermes QA Agent', 'Content Agent', 'Research Agent', 'CRM Agent']} /></Panel>
          <Panel title="Run lỗi cần xử lý"><CompactRows rows={['Research Agent - Web search timeout', 'Hermes QA Agent - Workspace permission denied', 'Report Agent - Missing data source']} warning /></Panel>
        </div>
      </div>
    </div>
  );
}

export function TodayScreenPolished() {
  return (
    <div>
      <h1 className="text-[32px] font-extrabold leading-tight text-slate-950">Today</h1>
      <p className="mt-1 text-slate-500">Những việc quan trọng cần xử lý hôm nay để đội AI vận hành thông suốt</p>

      <div className="mt-5 grid grid-cols-5 gap-4">
        {todayKpis.map((kpi) => <KpiTile key={kpi.label} {...kpi} />)}
      </div>

      <div className="mt-4 grid grid-cols-[1.02fr_.98fr] gap-4">
        <div className="space-y-4">
          <Panel title="Việc cần ưu tiên" action={<button className="text-sm font-bold text-[#0f6bff]">Xem tất cả →</button>}>
            <TaskRows rows={['Duyệt Hermes QA Report cho Module 3', 'Review failed run của Research Agent', 'Phê duyệt Content Agent xuất bản 10 bài social', 'Tăng budget cho SEO Agent']} />
          </Panel>
          <Panel title="Ticket đến hạn hôm nay" action={<button className="text-sm font-bold text-[#0f6bff]">Xem tất cả →</button>}>
            <TaskRows rows={['Audit Module 3', 'Create SEO Topic Cluster', 'Prepare Weekly CEO Report', 'Review Landing Page Copy']} ticket />
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Tóm tắt trong ngày">
            <div className="m-5 flex min-h-[94px] items-center gap-5 rounded-xl border border-blue-100 bg-blue-50 p-5 leading-7 text-slate-700">
              <Sparkles className="h-12 w-12 shrink-0 text-[#0f6bff]" />
              <p>Hôm nay có 12 việc cần xử lý. Trong đó có 4 approval, 3 ticket đến hạn và 2 agent đang chờ phản hồi. Nếu xử lý các approval trước 11:00, tiến độ dự án GrowthOS sẽ không bị chậm.</p>
            </div>
          </Panel>
          <Panel title="Agent đang chờ phản hồi" action={<button className="text-sm font-bold text-[#0f6bff]">Xem tất cả →</button>}>
            <CompactRows rows={['Hermes QA Agent', 'Content Agent', 'Research Agent', 'CRM Agent']} />
          </Panel>
          <Panel title="Run lỗi cần xử lý" action={<button className="text-sm font-bold text-[#0f6bff]">Xem tất cả →</button>}>
            <CompactRows rows={['Research Agent - Web search timeout', 'Hermes QA Agent - Workspace permission denied', 'Report Agent - Missing data source']} warning />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function TaskRows({ rows, ticket = false }: { rows: string[]; ticket?: boolean }) {
  if (ticket) {
    return (
      <div className="divide-y divide-slate-100 p-4">
        {rows.map((row) => (
          <div key={row} className="grid grid-cols-[38px_1fr_150px_18px] items-center gap-3 py-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-[#0f6bff]"><Ticket className="h-5 w-5" /></div>
            <div><b className="text-[14px] leading-5">{row}</b></div>
            <div className="inline-flex items-center justify-end gap-2 text-sm font-semibold text-red-500"><CalendarDays className="h-4 w-4" />Đến hạn hôm nay</div>
            <RowAction />
          </div>
        ))}
      </div>
    );
  }

  const rowMeta = [
    { Icon: Bot, tone: 'blue', button: 'Xem & duyệt' },
    { Icon: Search, tone: 'purple', button: 'Xem log' },
    { Icon: FileText, tone: 'green', button: 'Duyệt' },
    { Icon: Ticket, tone: 'amber', button: 'Xem đề xuất' },
  ] as const;
  const toneClass = {
    blue: 'bg-blue-50 text-[#0f6bff]',
    purple: 'bg-violet-50 text-violet-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-orange-50 text-orange-500',
  };

  return (
    <div className="divide-y divide-slate-100 p-4">
      {rows.map((row, index) => {
        const meta = rowMeta[index] ?? rowMeta[0];
        return (
          <div key={row} className="grid grid-cols-[38px_1fr_96px_112px] items-center gap-3 py-2">
            <div className={`grid h-9 w-9 place-items-center rounded-lg ${toneClass[meta.tone]}`}><meta.Icon className="h-5 w-5" /></div>
            <div><b className="text-[14px] leading-5">{row}</b><div className="text-[13px] text-slate-500">Type: {index === 1 ? 'Failed Run' : index === 2 ? 'Publish Approval' : index === 3 ? 'Budget' : 'Approval'} · Agent: {index === 1 ? 'Research Agent' : index === 3 ? 'SEO Agent' : 'Hermes QA Agent'}</div></div>
            <Badge tone={index < 2 ? 'red' : 'amber'}>{index < 2 ? 'Cao' : 'Trung bình'}</Badge>
            <Button variant="secondary">{meta.button}</Button>
          </div>
        );
      })}
    </div>
  );
}

function CompactRows({ rows, warning = false }: { rows: string[]; warning?: boolean }) {
  return <div className="divide-y divide-slate-100 p-4">{rows.map((row, index) => <div key={row} className="grid grid-cols-[34px_1fr_100px] items-center gap-3 py-2"><div className={`grid h-8 w-8 place-items-center rounded-lg ${warning ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-[#0f6bff]'}`}>{warning ? <AlertTriangle className="h-4 w-4" /> : <Bot className="h-4 w-4" />}</div><div className="text-[14px] font-semibold">{row}</div><Badge tone={warning && index === 0 ? 'red' : 'blue'}>{index === 0 ? '30 phút trước' : '1 giờ trước'}</Badge></div>)}</div>;
}

function InboxScreen() {
  const messages = ['Hermes QA Agent cần bạn duyệt báo cáo audit Module 3', 'Content Agent hỏi lại về tone of voice cho chiến dịch TikTok', 'Research Agent bị lỗi web search timeout', 'SEO Agent có thể vượt ngân sách tháng này', 'Automation Agent xin quyền gọi webhook n8n'];
  const inboxMeta = [
    { Icon: ShieldCheck, tone: 'green', meta: 'GrowthOS V2', badge: 'Cao', badgeTone: 'red' as Tone, time: '12 phút trước', action: 'Xem & duyệt' },
    { Icon: MessageCircleQuestion, tone: 'blue', meta: 'Marketing Campaign', badge: 'Trung bình', badgeTone: 'amber' as Tone, time: '25 phút trước', action: 'Trả lời' },
    { Icon: AlertTriangle, tone: 'red', meta: 'Market Research', badge: 'Cao', badgeTone: 'red' as Tone, time: '42 phút trước', action: 'Xem log' },
    { Icon: Ticket, tone: 'amber', meta: 'SEO Growth', badge: 'Trung bình', badgeTone: 'amber' as Tone, time: '1 giờ trước', action: 'Xem chi phí' },
    { Icon: Lock, tone: 'purple', meta: 'CRM Automation', badge: 'Cao', badgeTone: 'red' as Tone, time: '2 giờ trước', action: 'Duyệt quyền' },
  ] as const;
  const iconToneClass = {
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-[#0f6bff]',
    red: 'bg-red-50 text-red-500',
    amber: 'bg-orange-50 text-orange-500',
    purple: 'bg-violet-50 text-violet-600',
  };
  return (
    <div>
      <div data-parity-id="inbox.header">
      <h1 className="text-[32px] font-extrabold leading-tight text-slate-950">AI Inbox</h1>
      <p className="mt-1 text-slate-500">Tất cả phản hồi, phê duyệt và quyết định mà đội AI đang cần từ bạn</p>
      </div>
      <div data-parity-id="inbox.tabs" className="mt-5 flex flex-wrap gap-3">{['All', 'Unread 8', 'Needs Action', 'Approvals 5', 'Agent Questions 3', 'Failed Runs 2', 'Budget 2', 'Risk 1', 'Archived'].map((tab, index) => <button key={tab} className={`rounded-lg border px-7 py-3 text-sm font-semibold ${index === 0 ? 'border-[#0f6bff] bg-blue-50 text-[#0f6bff]' : 'border-slate-200 bg-white text-slate-600'}`}>{tab}</button>)}</div>
      <div data-parity-id="inbox.filters" className="mt-3 flex items-center justify-between gap-4">
        <div className="flex gap-3">
          {['Project    Tất cả', 'Agent    Tất cả', 'Priority    Tất cả', 'Due date    Tất cả'].map((filter) => (
            <button key={filter} className="h-10 rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600">{filter}</button>
          ))}
        </div>
        <div className="flex gap-3">
          <button className="h-10 rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600">Mới nhất</button>
          <button className="h-10 w-10 rounded-lg border border-slate-200 bg-white text-slate-600">≡</button>
        </div>
      </div>
      <div data-parity-id="inbox.main-grid" className="mt-5 grid grid-cols-[.82fr_1.08fr] gap-5">
        <div data-parity-id="inbox.list-panel">
        <Panel>
          <div className="divide-y divide-slate-100">
            {messages.map((message, index) => {
              const meta = inboxMeta[index];
              return (
                <div key={message} className={`grid h-[104px] grid-cols-[10px_56px_1fr_112px] items-center gap-3 px-5 ${index === 0 ? 'bg-blue-50/60' : ''}`}>
                  <span className="h-2 w-2 rounded-full bg-[#0f6bff]" />
                  <div className={`grid h-12 w-12 place-items-center rounded-xl ${iconToneClass[meta.tone]}`}><meta.Icon className="h-6 w-6" /></div>
                  <div className="min-w-0">
                    <div className={`text-sm font-bold ${meta.tone === 'red' ? 'text-red-500' : meta.tone === 'amber' ? 'text-orange-500' : meta.tone === 'purple' ? 'text-violet-600' : 'text-[#0f6bff]'}`}>{['Approval Request', 'Agent Question', 'Failed Run', 'Budget Warning', 'Tool Permission'][index]}</div>
                    <b className="block truncate text-[14px] leading-5">{message}</b>
                    <div className="mt-1 flex items-center gap-4 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-2"><Folder className="h-4 w-4" />{meta.meta}</span>
                      <Badge tone={meta.badgeTone}>{meta.badge}</Badge>
                      <span>{meta.time}</span>
                    </div>
                  </div>
                  <Button variant="secondary">{meta.action}</Button>
                </div>
              );
            })}
            <div className="flex h-[52px] items-center justify-between px-5 text-sm text-slate-500">
              <span>1-5 của 8 mục</span>
              <div className="flex items-center gap-2">
                <button className="h-8 w-8 rounded-lg border border-slate-200">‹</button>
                <button className="h-8 w-8 rounded-lg border border-[#0f6bff] bg-blue-50 font-bold text-[#0f6bff]">1</button>
                <button className="h-8 w-8 rounded-lg border border-slate-200">2</button>
                <button className="h-8 w-8 rounded-lg border border-slate-200">›</button>
              </div>
            </div>
          </div>
        </Panel>
        </div>
        <div data-parity-id="inbox.detail-panel">
        <Panel>
          <div className="p-6">
            <div className="flex items-start justify-between"><div><Badge tone="blue">Approval Request</Badge><h2 className="mt-4 text-2xl font-extrabold">Hermes QA Agent cần bạn duyệt báo cáo audit Module 3</h2></div><button className="text-2xl">...</button></div>
            <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-slate-200 p-5">
              <InfoBlock label="Dự án liên quan" value="GrowthOS V2" />
              <InfoBlock label="Mức độ rủi ro" value="Trung bình" />
              <InfoBlock label="Ticket liên quan" value="Audit Module 3 - Landing & Lead Capture" />
              <InfoBlock label="Chi phí ước tính" value="$0.024" />
            </div>
            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-5 leading-7 text-slate-700">Tôi đã hoàn tất kiểm thử Module 3. Có 2 lỗi Minor và không có lỗi Critical. Vui lòng xem báo cáo để phê duyệt kết quả QA.</div>
            <div className="mt-5 grid grid-cols-3 gap-4">{['QA_Report_Module3.pdf', 'Console_Log.txt', 'Screenshot_Evidence.zip'].map((file) => <div key={file} className="rounded-xl border border-slate-200 p-4 text-sm font-semibold">{file}<div className="mt-1 text-xs text-slate-500">1.24 MB</div></div>)}</div>
            <div className="mt-6 flex gap-4"><Button>Phê duyệt</Button><Button variant="secondary">Yêu cầu chỉnh sửa</Button><Button variant="danger">Từ chối</Button><Button variant="secondary">Lưu trữ</Button></div>
          </div>
        </Panel>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return <div><div className="text-sm text-slate-500">{label}</div><div className="mt-2 font-bold text-[#0f6bff]">{value}</div></div>;
}

function NotificationScreen() {
  const notificationKpis: { label: string; value: string; icon: LucideIcon; tone: Tone }[] = [
    { label: 'Thông báo chưa đọc', value: '18', icon: MessageCircleQuestion, tone: 'blue' },
    { label: 'Cảnh báo quan trọng', value: '5', icon: AlertTriangle, tone: 'amber' },
    { label: 'Approval mới', value: '7', icon: CheckCircle2, tone: 'green' },
    { label: 'System events', value: '12', icon: Layers3, tone: 'purple' },
  ];
  const notifications = [
    ['Hermes QA Agent đã hoàn tất audit Module 3', 'Agent', 'Ticket: Audit Module 3 - Landing & Lead Capture', 'green'],
    ['Automation Agent xin quyền gọi webhook n8n', 'Approval', 'Project: CRM Automation', 'amber'],
    ['Chi phí AI hôm nay tăng 18% so với trung bình', 'Cost', 'Dự báo có thể vượt ngân sách nếu xu hướng tiếp tục.', 'amber'],
    ['Github integration đã đồng bộ thành công', 'Integration', '128 commits và 24 issues được cập nhật.', 'green'],
    ['Có đăng nhập mới từ thiết bị lạ', 'Security', 'Vị trí: Singapore · Trình duyệt: Chrome', 'red'],
    ['Weekly CEO Report đã sẵn sàng', 'Report', 'Báo cáo tuần cho Demo Company đã được tạo.', 'blue'],
  ];
  return (
    <div>
      <div data-parity-id="notifications.header" className="flex items-start justify-between">
        <div><h1 className="text-[32px] font-extrabold text-slate-950">Notification Center</h1><p className="mt-2 text-slate-500">Theo dõi toàn bộ thông báo, cảnh báo và hoạt động quan trọng trong hệ thống</p></div>
        <div className="flex gap-3"><Button variant="secondary">Đánh dấu tất cả đã đọc</Button><Button variant="secondary"><Settings className="h-4 w-4" />Cài đặt thông báo</Button></div>
      </div>
      <div data-parity-id="notifications.kpi-band" className="mt-7 grid grid-cols-4 gap-5">{notificationKpis.map((kpi) => <KpiTile key={kpi.label} {...kpi} />)}</div>
      <div data-parity-id="notifications.main-grid" className="mt-5 grid grid-cols-[1fr_380px] gap-5">
        <div data-parity-id="notifications.list-panel">
          <Panel><div className="flex gap-8 px-6 py-4 text-sm font-semibold text-slate-600">{['All', 'Unread', 'Agent', 'Ticket', 'Approval', 'Cost', 'Risk', 'Integration', 'Report', 'Security', 'System'].map((tab, index) => <span key={tab} className={index === 0 ? 'text-[#0f6bff]' : ''}>{tab}</span>)}</div></Panel>
          <Panel className="mt-4" title="Mới nhất">
            <div className="divide-y divide-slate-100 p-4">
              {notifications.map(([title, kind, desc, tone]) => <div key={title} className={`grid grid-cols-[10px_56px_1fr_130px_20px] items-center gap-4 rounded-lg px-3 py-3 ${tone === 'red' ? 'bg-red-50/50' : tone === 'green' ? 'bg-emerald-50/50' : tone === 'amber' ? 'bg-amber-50/40' : ''}`}><span className={`h-2 w-2 rounded-full ${tone === 'red' ? 'bg-red-500' : tone === 'amber' ? 'bg-amber-500' : tone === 'green' ? 'bg-emerald-500' : 'bg-blue-500'}`} /><div className="grid h-11 w-11 place-items-center rounded-lg bg-white text-[#0f6bff]"><Bell className="h-5 w-5" /></div><div><Badge tone={tone as Tone}>{kind}</Badge><b className="ml-3">{title}</b><div className="mt-1 text-sm text-slate-500">{desc}</div></div><Button variant="secondary">Xem</Button><RowAction /></div>)}
            </div>
          </Panel>
        </div>
        <div data-parity-id="notifications.settings-panel">
        <Panel title="Cài đặt thông báo">
          <div className="space-y-5 p-5">
            {['In-app', 'Email', 'Telegram', 'Slack', 'Approval required', 'Failed run', 'Budget warning', 'Weekly report', 'Security alert'].map((item, index) => <div key={item} className="flex items-center justify-between"><span className="font-semibold text-slate-700">{item}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${index === 2 || index === 3 ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600'}`}>{index === 2 || index === 3 ? 'Tắt' : 'Bật'}</span></div>)}
          </div>
        </Panel>
        </div>
      </div>
    </div>
  );
}

function metricIcon(label: string): LucideIcon {
  if (label.toLowerCase().includes('budget') || label.toLowerCase().includes('cost')) return BarChart3;
  if (label.toLowerCase().includes('agent')) return Bot;
  if (label.toLowerCase().includes('ticket')) return Ticket;
  if (label.toLowerCase().includes('approval') || label.toLowerCase().includes('risk')) return ShieldCheck;
  if (label.toLowerCase().includes('goal') || label.toLowerCase().includes('progress')) return Target;
  if (label.toLowerCase().includes('project')) return Folder;
  return CheckCircle2;
}

function MetricBand({ items, parityId }: { items: { label: string; value: string; tone: Tone }[]; parityId: string }) {
  return (
    <div data-parity-id={parityId} className="mt-4 grid grid-cols-4 gap-4">
      {items.map((item) => <KpiTile key={item.label} label={item.label} value={item.value} tone={item.tone} icon={metricIcon(item.label)} compact />)}
    </div>
  );
}

function SimpleHeader({ parityId, title, subtitle, actions }: { parityId: string; title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <div data-parity-id={parityId} className="flex min-h-[68px] items-start justify-between gap-4">
      <div>
        <h1 className="text-[32px] font-extrabold leading-tight text-slate-950">{title}</h1>
        <p className="mt-1 max-w-3xl text-slate-500">{subtitle}</p>
      </div>
      {actions ? <div className="flex gap-3">{actions}</div> : null}
    </div>
  );
}

function CompanyOverviewScreen() {
  const vm = selectCompanyOverviewViewModel();
  return (
    <div>
      <SimpleHeader
        parityId="company.header"
        title="Company Overview"
        subtitle="Tong quan workspace, muc tieu va nang luc van hanh AI cua doanh nghiep."
        actions={<><Button variant="secondary"><FileText className="h-4 w-4" />Bao cao</Button><Button><Building2 className="h-4 w-4" />Cap nhat cong ty</Button></>}
      />
      <MetricBand parityId="company.kpi-band" items={vm.kpis} />
      <div data-parity-id="company.main-grid" className="mt-4 grid grid-cols-[1.1fr_.9fr] gap-5">
        <div data-parity-id="company.left-panel" className="space-y-5">
          <Panel title="Ho so cong ty">
            <div className="grid grid-cols-[88px_1fr] gap-5 p-5">
              <div className="grid h-20 w-20 place-items-center rounded-2xl bg-blue-50 text-3xl font-extrabold text-[#0f6bff]">UI</div>
              <div>
                <h2 className="text-2xl font-extrabold text-slate-950">{vm.workspace.name}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Workspace dang van hanh doi ngu AI cho marketing, research, QA va bao cao dieu hanh.</p>
                <div className="mt-4 flex gap-3"><Badge tone="green">Plan {vm.workspace.plan}</Badge><Badge tone="blue">Created {vm.workspace.createdAt.slice(0, 10)}</Badge></div>
              </div>
            </div>
          </Panel>
          <Panel title="Muc tieu chien luoc">
            <div className="space-y-4 p-5">
              {vm.goals.map((goal) => (
                <div key={goal.id} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between"><b>{goal.title}</b><span className="font-bold text-[#0f6bff]">{goal.progress}%</span></div>
                  <p className="mt-1 text-sm text-slate-500">{goal.description}</p>
                  <ProgressBar value={goal.progress} tone={goal.progress > 80 ? 'green' : 'blue'} label={`${goal.title} progress`} />
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <div data-parity-id="company.right-panel" className="space-y-5">
          <Panel title="Doi AI dang hoat dong">
            <div className="divide-y divide-slate-100 p-4">
              {vm.agents.map((agent) => <div key={agent.id} className="flex items-center justify-between py-3"><div className="flex items-center gap-3"><IconBubble icon={Bot} tone={agent.status === 'failed' ? 'red' : 'blue'} /><div><b>{agent.name}</b><div className="text-sm text-slate-500">{agent.role}</div></div></div><Badge tone={agent.status === 'failed' ? 'red' : 'green'}>{agent.status}</Badge></div>)}
            </div>
          </Panel>
          <Panel title="Hoat dong moi">
            <div className="divide-y divide-slate-100 p-4">
              {vm.activities.slice(0, 5).map((activity) => <div key={activity.id} className="py-3"><b className="text-sm">{activity.title}</b><p className="mt-1 text-sm text-slate-500">{activity.description}</p></div>)}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function IconBubble({ icon: Icon, tone = 'blue' }: { icon: LucideIcon; tone?: Tone }) {
  const classes: Record<Tone, string> = {
    blue: 'bg-blue-50 text-[#0f6bff]',
    cyan: 'bg-cyan-50 text-cyan-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-violet-50 text-violet-600',
    slate: 'bg-slate-100 text-slate-500',
  };
  return <span className={`grid h-10 w-10 place-items-center rounded-xl ${classes[tone]}`}><Icon className="h-5 w-5" /></span>;
}

function CompanySettingsScreen() {
  const vm = selectCompanySettingsViewModel();
  return (
    <div>
      <SimpleHeader parityId="company-settings.header" title="Company Settings" subtitle="Quan ly thong tin cong ty, thanh vien va chinh sach van hanh AI." actions={<Button><Settings className="h-4 w-4" />Luu thay doi</Button>} />
      <div data-parity-id="company-settings.main-grid" className="mt-5 grid grid-cols-[.95fr_1.05fr] gap-5">
        <div data-parity-id="company-settings.profile-panel" className="space-y-5">
          <Panel title="Thong tin workspace">
            <div className="space-y-4 p-5">
              {[['Ten cong ty', vm.workspace.name], ['Plan', vm.workspace.plan], ['Budget AI thang', `$${vm.workspace.aiBudgetMonthly.toLocaleString()}`], ['Owner', vm.currentUser.name]].map(([label, value]) => <FieldRow key={label} label={label} value={value} />)}
            </div>
          </Panel>
          <Panel title="Thanh vien">
            <div className="divide-y divide-slate-100 p-4">
              {vm.members.map((member) => <div key={member.id} className="flex items-center justify-between py-3"><div><b>{member.name}</b><div className="text-sm text-slate-500">{member.email}</div></div><Badge tone="blue">{member.role}</Badge></div>)}
            </div>
          </Panel>
        </div>
        <div data-parity-id="company-settings.policy-panel" className="space-y-5">
          <Panel title="Chinh sach van hanh">
            <div className="grid grid-cols-2 gap-4 p-5">
              {vm.policies.map((policy) => <div key={policy.label} className="rounded-xl border border-slate-100 p-4"><div className="text-sm text-slate-500">{policy.label}</div><div className="mt-3"><Badge tone={policy.tone as Tone}>{policy.value}</Badge></div></div>)}
            </div>
          </Panel>
          <Panel title="Audit va bao mat">
            <div className="space-y-3 p-5">
              {['Require reviewer for high-risk approval', 'Record agent tool usage', 'Notify owner on budget variance', 'Restrict external webhook writes'].map((item, index) => <div key={item} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"><span className="font-semibold">{item}</span><Badge tone={index === 3 ? 'amber' : 'green'}>{index === 3 ? 'Review' : 'On'}</Badge></div>)}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"><div className="text-xs font-semibold uppercase text-slate-400">{label}</div><div className="mt-1 font-bold text-slate-900">{value}</div></div>;
}

function GoalsDashboardScreen() {
  const vm = selectGoalsDashboardViewModel();
  return (
    <div>
      <SimpleHeader parityId="goals.header" title="Goals Dashboard" subtitle="Theo doi muc tieu chien luoc va cac ticket AI dang dong gop vao ket qua." actions={<Button><Target className="h-4 w-4" />Tao goal</Button>} />
      <MetricBand parityId="goals.kpi-band" items={vm.kpis} />
      <div data-parity-id="goals.main-grid" className="mt-4 grid grid-cols-[1fr_380px] gap-5">
        <div data-parity-id="goals.list-panel">
          <Panel title="Muc tieu dang chay">
            <div className="space-y-4 p-5">
              {vm.goals.map((goal) => <GoalSummary key={goal.id} goal={goal} />)}
            </div>
          </Panel>
        </div>
        <div data-parity-id="goals.timeline-panel" className="space-y-5">
          <Panel title="Ticket lien quan">
            <div className="divide-y divide-slate-100 p-4">{vm.tickets.slice(0, 6).map((ticket) => <div key={ticket.id} className="py-3"><b className="text-sm">{ticket.code}</b><p className="mt-1 text-sm text-slate-500">{ticket.title}</p></div>)}</div>
          </Panel>
          <Panel title="Nhac viec">
            <div className="space-y-3 p-5">{['Review progress this week', 'Assign owner for blocked ticket', 'Prepare CEO goal update'].map((item) => <div key={item} className="rounded-xl bg-blue-50 p-3 text-sm font-semibold text-[#0f6bff]">{item}</div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function GoalSummary({ goal }: { goal: ReturnType<typeof selectGoalsDashboardViewModel>['goals'][number] }) {
  return (
    <div className="rounded-xl border border-slate-100 p-5">
      <div className="flex items-start justify-between gap-4">
        <div><h2 className="text-lg font-extrabold text-slate-950">{goal.title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{goal.description}</p></div>
        <Badge tone={goal.progress > 80 ? 'green' : goal.progress > 65 ? 'blue' : 'amber'}>{goal.progress}%</Badge>
      </div>
      <div className="mt-4"><ProgressBar value={goal.progress} label={`${goal.title} progress`} /></div>
      <div className="mt-3 text-sm text-slate-500">Due {goal.dueAt.slice(0, 10)} · {goal.linkedTicketIds.length} tickets</div>
    </div>
  );
}

function GoalDetailScreen() {
  const vm = selectGoalDetailViewModel();
  return (
    <div>
      <SimpleHeader parityId="goal.header" title={vm.goal.title} subtitle={vm.goal.description} actions={<><Button variant="secondary">Chinh sua</Button><Button>Review tien do</Button></>} />
      <div data-parity-id="goal.progress-band" className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between"><div><b>Progress</b><p className="text-sm text-slate-500">Owner: {vm.owner.name} · Due {vm.goal.dueAt.slice(0, 10)}</p></div><span className="text-3xl font-extrabold text-[#0f6bff]">{vm.goal.progress}%</span></div>
        <div className="mt-4"><ProgressBar value={vm.goal.progress} label="Goal progress" height={10} /></div>
      </div>
      <div data-parity-id="goal.main-grid" className="mt-5 grid grid-cols-[1fr_380px] gap-5">
        <div data-parity-id="goal.ticket-panel">
          <Panel title="Linked tickets">
            <div className="divide-y divide-slate-100 p-4">{vm.tickets.map((ticket) => <div key={ticket.id} className="grid grid-cols-[1fr_120px_110px] items-center gap-4 py-3"><div><b>{ticket.title}</b><div className="text-sm text-slate-500">{ticket.code}</div></div><Badge tone={ticket.status === 'done' ? 'green' : ticket.status === 'blocked' ? 'red' : 'blue'}>{ticket.status}</Badge><Badge tone={ticket.riskLevel === 'high' ? 'red' : 'amber'}>{ticket.riskLevel}</Badge></div>)}</div>
          </Panel>
        </div>
        <div data-parity-id="goal.activity-panel" className="space-y-5">
          <Panel title="Activity">
            <div className="divide-y divide-slate-100 p-4">{vm.activities.slice(0, 5).map((activity) => <div key={activity.id} className="py-3"><b className="text-sm">{activity.title}</b><p className="mt-1 text-sm text-slate-500">{activity.description}</p></div>)}</div>
          </Panel>
          <Panel title="Risk check">
            <div className="p-5"><Badge tone={vm.goal.progress > 70 ? 'green' : 'amber'}>{vm.goal.progress > 70 ? 'On track' : 'Needs attention'}</Badge><p className="mt-3 text-sm leading-6 text-slate-500">Progress is recalculated from linked tickets and recent agent activity.</p></div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function CreateGoalScreen() {
  const vm = selectCreateGoalViewModel();
  return (
    <div>
      <SimpleHeader parityId="create-goal.header" title="Create Goal Wizard" subtitle="Thiet lap muc tieu, owner, KPI va ticket lien quan cho doi AI." actions={<Button><Check className="h-4 w-4" />Tao goal</Button>} />
      <div data-parity-id="create-goal.main-grid" className="mt-5 grid grid-cols-[1fr_420px] gap-5">
        <div data-parity-id="create-goal.form-panel" className="space-y-5">
          <Panel title="Thong tin muc tieu">
            <div className="grid grid-cols-2 gap-4 p-5">
              <FieldRow label="Goal name" value="Increase qualified leads 30%" />
              <FieldRow label="Owner" value={vm.agents[4]?.name ?? vm.agents[0].name} />
              <FieldRow label="Due date" value="2026-06-30" />
              <FieldRow label="Primary KPI" value="Qualified leads" />
            </div>
          </Panel>
          <Panel title="Templates">
            <div className="grid grid-cols-2 gap-4 p-5">{vm.templates.map((template) => <div key={template} className="rounded-xl border border-slate-100 p-4"><IconBubble icon={Target} /><b className="mt-3 block">{template}</b><p className="mt-1 text-sm text-slate-500">Starter workflow with suggested agents and approval rules.</p></div>)}</div>
          </Panel>
        </div>
        <div data-parity-id="create-goal.preview-panel">
          <Panel title="Preview">
            <div className="space-y-4 p-5">
              <div className="rounded-xl bg-blue-50 p-5"><b className="text-[#0f6bff]">{vm.workspace.name}</b><p className="mt-2 text-sm text-slate-600">Goal will create project, ticket backlog, and weekly review cadence.</p></div>
              {['Create goal record', 'Generate ticket backlog', 'Assign owner agent', 'Enable weekly progress report'].map((item, index) => <div key={item} className="flex items-center gap-3"><IconBubble icon={index < 2 ? CheckCircle2 : Clock3} tone={index < 2 ? 'green' : 'blue'} /><span className="font-semibold">{item}</span></div>)}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ProjectsListScreen() {
  const vm = selectProjectsListViewModel();
  return (
    <div>
      <SimpleHeader parityId="projects.header" title="Projects" subtitle="Quan ly cac chuong trinh thuc thi lien ket voi muc tieu va agent." actions={<Button><Folder className="h-4 w-4" />Tao project</Button>} />
      <MetricBand parityId="projects.kpi-band" items={vm.kpis} />
      <div data-parity-id="projects.main-grid" className="mt-4 grid grid-cols-[1fr_360px] gap-5">
        <div data-parity-id="projects.list-panel">
          <Panel title="Project portfolio">
            <div className="space-y-4 p-5">{vm.projects.map((project) => <ProjectCard key={project.id} project={project} />)}</div>
          </Panel>
        </div>
        <div data-parity-id="projects.side-panel" className="space-y-5">
          <Panel title="Capacity">
            <div className="space-y-4 p-5">{vm.projects.map((project) => <div key={project.id}><div className="mb-2 flex justify-between text-sm"><b>{project.owner}</b><span>{project.progress}%</span></div><ProgressBar value={project.progress} label={`${project.title} capacity`} /></div>)}</div>
          </Panel>
          <Panel title="Governance">
            <div className="space-y-3 p-5">{['Weekly owner review', 'Approval required for external publish', 'Budget alert at 80%'].map((item) => <div key={item} className="rounded-xl border border-slate-100 px-4 py-3 text-sm font-semibold">{item}</div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: ReturnType<typeof selectProjectsListViewModel>['projects'][number] }) {
  return (
    <div className="rounded-xl border border-slate-100 p-5">
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-extrabold text-slate-950">{project.title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{project.description}</p></div><Badge tone={project.status === 'On track' ? 'green' : 'amber'}>{project.status}</Badge></div>
      <div className="mt-4"><ProgressBar value={project.progress} label={`${project.title} progress`} /></div>
      <div className="mt-3 flex gap-4 text-sm text-slate-500"><span>Owner: {project.owner}</span><span>{project.tickets.length} tickets</span><span>Due {project.dueAt.slice(0, 10)}</span></div>
    </div>
  );
}

function ProjectDetailScreen() {
  const vm = selectProjectDetailViewModel();
  return (
    <div>
      <SimpleHeader parityId="project.header" title={vm.project.title} subtitle={vm.project.description} actions={<><Button variant="secondary">Export</Button><Button>Update project</Button></>} />
      <div data-parity-id="project.main-grid" className="mt-5 grid grid-cols-[1fr_400px] gap-5">
        <div data-parity-id="project.milestone-panel" className="space-y-5">
          <Panel title="Milestones">
            <div className="space-y-4 p-5">{vm.milestones.map((milestone) => <div key={milestone.title} className="rounded-xl border border-slate-100 p-4"><div className="flex justify-between"><b>{milestone.title}</b><Badge tone={milestone.status === 'Done' ? 'green' : milestone.status === 'Running' ? 'blue' : 'amber'}>{milestone.status}</Badge></div><div className="mt-3"><ProgressBar value={milestone.progress} label={`${milestone.title} progress`} /></div></div>)}</div>
          </Panel>
          <Panel title="Ticket execution">
            <div className="divide-y divide-slate-100 p-4">{vm.project.tickets.map((ticket) => <div key={ticket.id} className="py-3"><b>{ticket.title}</b><div className="mt-1 text-sm text-slate-500">{ticket.code} · {ticket.status}</div></div>)}</div>
          </Panel>
        </div>
        <div data-parity-id="project.detail-panel" className="space-y-5">
          <Panel title="Project health">
            <div className="p-5"><div className="text-4xl font-extrabold text-[#0f6bff]">{vm.project.progress}%</div><p className="mt-2 text-sm text-slate-500">Current aggregate progress from milestones and linked tickets.</p><div className="mt-4"><ProgressBar value={vm.project.progress} label="Project health" height={10} /></div></div>
          </Panel>
          <Panel title="Owner and controls">
            <div className="space-y-3 p-5"><FieldRow label="Owner" value={vm.project.owner} /><FieldRow label="Status" value={vm.project.status} /><Button className="w-full">Open weekly review</Button></div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function CreateProjectScreen() {
  const vm = selectCreateProjectViewModel();
  return (
    <div>
      <SimpleHeader parityId="create-project.header" title="Create Project Wizard" subtitle="Tao project moi tu goal, template va agent execution plan." actions={<Button><Folder className="h-4 w-4" />Tao project</Button>} />
      <div data-parity-id="create-project.main-grid" className="mt-5 grid grid-cols-[1fr_420px] gap-5">
        <div data-parity-id="create-project.form-panel" className="space-y-5">
          <Panel title="Project setup">
            <div className="grid grid-cols-2 gap-4 p-5"><FieldRow label="Project name" value="GrowthOS V2 Launch" /><FieldRow label="Linked goal" value={vm.goals[0].title} /><FieldRow label="Lead agent" value={vm.agents[4]?.name ?? vm.agents[0].name} /><FieldRow label="Cadence" value="Weekly review" /></div>
          </Panel>
          <Panel title="Template gallery">
            <div className="grid grid-cols-2 gap-4 p-5">{vm.templates.map((template) => <div key={template} className="rounded-xl border border-slate-100 p-4"><IconBubble icon={Folder} /><b className="mt-3 block">{template}</b><p className="mt-1 text-sm text-slate-500">Includes milestones, tickets, and approval gates.</p></div>)}</div>
          </Panel>
        </div>
        <div data-parity-id="create-project.preview-panel">
          <Panel title="Generated plan">
            <div className="space-y-4 p-5">{['Create project workspace', 'Generate milestones', 'Create initial ticket board', 'Invite reviewer', 'Schedule progress report'].map((item, index) => <div key={item} className="flex items-center gap-3"><IconBubble icon={index < 2 ? CheckCircle2 : Clock3} tone={index < 2 ? 'green' : 'blue'} /><span className="font-semibold">{item}</span></div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function AgentsListScreen() {
  const vm = selectAgentsListViewModel();
  return (
    <div>
      <SimpleHeader parityId="agents.header" title="Agents" subtitle="Danh sach AI agents, nang luc, tai cong viec va trang thai van hanh." actions={<Button><Bot className="h-4 w-4" />Tao agent</Button>} />
      <MetricBand parityId="agents.kpi-band" items={vm.kpis} />
      <div data-parity-id="agents.main-grid" className="mt-4 grid grid-cols-[1fr_390px] gap-5">
        <div data-parity-id="agents.list-panel">
          <Panel title="Agent roster">
            <div className="divide-y divide-slate-100 p-4">
              {vm.agentCards.map((agent) => (
                <div key={agent.id} className="grid grid-cols-[48px_1fr_110px_110px_110px] items-center gap-4 py-3">
                  <IconBubble icon={Bot} tone={agent.tone as Tone} />
                  <div><b>{agent.name}</b><div className="text-sm text-slate-500">{agent.role} · {agent.status}</div></div>
                  <Badge tone={agent.score > 90 ? 'green' : 'blue'}>{agent.score}%</Badge>
                  <span className="text-sm font-semibold text-slate-600">Load {agent.load}%</span>
                  <Button variant="secondary">Open</Button>
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <div data-parity-id="agents.detail-panel" className="space-y-5">
          <Panel title="Workload mix">
            <div className="space-y-4 p-5">{vm.agentCards.map((agent) => <div key={agent.id}><div className="mb-2 flex justify-between text-sm"><b>{agent.name}</b><span>{agent.load}%</span></div><ProgressBar value={agent.load} label={`${agent.name} workload`} /></div>)}</div>
          </Panel>
          <Panel title="Open tickets">
            <div className="divide-y divide-slate-100 p-4">{vm.tickets.slice(0, 5).map((ticket) => <div key={ticket.id} className="py-3"><b className="text-sm">{ticket.code}</b><p className="mt-1 text-sm text-slate-500">{ticket.title}</p></div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function CreateAgentScreen() {
  const vm = selectCreateAgentViewModel();
  return (
    <div>
      <SimpleHeader parityId="agent-builder.header" title="Create Agent Wizard" subtitle="Tao agent moi tu template, skills, toolset va chinh sach approval." actions={<Button><Sparkles className="h-4 w-4" />Create agent</Button>} />
      <div data-parity-id="agent-builder.steps" className="mt-4 grid grid-cols-4 gap-4">
        {['Role', 'Skills', 'Tools', 'Policies'].map((step, index) => <div key={step} className={`rounded-xl border px-4 py-3 text-sm font-bold ${index === 0 ? 'border-[#0f6bff] bg-blue-50 text-[#0f6bff]' : 'border-slate-200 bg-white text-slate-600'}`}>{index + 1}. {step}</div>)}
      </div>
      <div data-parity-id="agent-builder.main-grid" className="mt-5 grid grid-cols-[1fr_420px] gap-5">
        <div data-parity-id="agent-builder.form-panel" className="space-y-5">
          <Panel title="Agent templates">
            <div className="grid grid-cols-2 gap-4 p-5">{vm.templates.map((template) => <div key={template.name} className="rounded-xl border border-slate-100 p-4"><IconBubble icon={Bot} /><b className="mt-3 block">{template.name}</b><p className="mt-1 text-sm text-slate-500">{template.role}</p><div className="mt-3 flex flex-wrap gap-2">{template.tools.slice(0, 2).map((tool) => <Badge key={tool} tone="blue">{tool}</Badge>)}</div></div>)}</div>
          </Panel>
          <Panel title="Recommended skills">
            <div className="flex flex-wrap gap-3 p-5">{vm.recommendedSkills.map((skill) => <Badge key={skill} tone="purple">{skill}</Badge>)}</div>
          </Panel>
        </div>
        <div data-parity-id="agent-builder.preview-panel">
          <Panel title="Agent preview">
            <div className="space-y-4 p-5"><div className="rounded-xl bg-blue-50 p-5"><b className="text-[#0f6bff]">{vm.workspace.name}</b><p className="mt-2 text-sm text-slate-600">New agent will inherit workspace guardrails and activity logging.</p></div>{['Workspace policy applied', 'Tool access pending review', 'Memory scope limited', 'Ready for test run'].map((item, index) => <div key={item} className="flex items-center gap-3"><IconBubble icon={index < 2 ? ShieldCheck : Clock3} tone={index < 2 ? 'green' : 'blue'} /><span className="font-semibold">{item}</span></div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function AgentTemplatesScreen() {
  const vm = selectAgentTemplatesViewModel();
  return (
    <div>
      <SimpleHeader parityId="agent-templates.header" title="Agent Template Gallery" subtitle="Chon template agent da duoc chuan hoa cho tung nhom cong viec." actions={<Button variant="secondary"><UploadCloud className="h-4 w-4" />Import template</Button>} />
      <div data-parity-id="agent-templates.filters" className="mt-4 flex flex-wrap gap-3">{vm.categories.map((category, index) => <button key={category} className={`rounded-lg border px-5 py-2 text-sm font-semibold ${index === 0 ? 'border-[#0f6bff] bg-blue-50 text-[#0f6bff]' : 'border-slate-200 bg-white text-slate-600'}`}>{category}</button>)}</div>
      <div data-parity-id="agent-templates.main-grid" className="mt-5 grid grid-cols-[1fr_360px] gap-5">
        <div data-parity-id="agent-templates.gallery-panel">
          <Panel title="Templates">
            <div className="grid grid-cols-2 gap-4 p-5">{vm.templates.map((template) => <div key={template.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between"><IconBubble icon={Bot} tone={template.tone as Tone} /><Badge tone={template.successRate > 90 ? 'green' : 'blue'}>{template.successRate}%</Badge></div><h2 className="mt-4 font-extrabold">{template.name}</h2><p className="mt-1 text-sm text-slate-500">Based on {template.agentName}</p><div className="mt-3 flex flex-wrap gap-2">{template.skills.slice(0, 3).map((skill) => <Badge key={skill} tone="purple">{skill}</Badge>)}</div></div>)}</div>
          </Panel>
        </div>
        <div data-parity-id="agent-templates.side-panel">
          <Panel title="Template governance">
            <div className="space-y-3 p-5">{['Review before production use', 'Tool scopes inherited', 'Memory starts empty', 'Approval policy required'].map((item) => <div key={item} className="rounded-xl border border-slate-100 px-4 py-3 text-sm font-semibold">{item}</div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function AgentPerformanceScreen() {
  const vm = selectAgentPerformanceViewModel();
  const kpiIcons = [Gauge, CheckCircle2, Target, CircleDollarSign, AlertTriangle, Users];
  return (
    <div>
      <SimpleHeader
        parityId="agent-performance.header"
        title="Agent Performance"
        subtitle="Do luong hieu suat, chat luong, chi phi va do tin cay cua doi ngu AI Agent"
        actions={<><Button variant="secondary"><SlidersHorizontal className="h-4 w-4" />Compare Agents</Button><Button variant="secondary"><Download className="h-4 w-4" />Export Report</Button><Button variant="secondary"><CalendarDays className="h-4 w-4" />01/05/2024 - 31/05/2024</Button></>}
      />
      <div data-parity-id="agent-performance.kpi-band" className="mt-4 grid grid-cols-6 gap-3">
        {vm.kpis.map((item, index) => <KpiTile key={item.label} label={item.label} value={item.value} delta={item.delta} tone={item.tone} icon={kpiIcons[index] ?? CheckCircle2} />)}
      </div>
      <div data-parity-id="agent-performance.main-grid" className="mt-5 space-y-4">
        <div className="grid grid-cols-[320px_1fr_420px] gap-4">
          <div data-parity-id="agent-performance.ranking-panel">
            <Panel title={<span className="flex items-center gap-2"><Trophy className="h-4 w-4" />Bang xep hang Agent</span>} className="h-[332px] overflow-hidden">
              <div className="space-y-3 p-4">{vm.rankingRows.slice(0, 5).map((row, index) => (
                <div key={row.id} className="grid grid-cols-[32px_36px_1fr_52px] items-center gap-3">
                  <span className={`grid h-7 w-7 place-items-center rounded-full text-sm font-bold ${index < 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{index + 1}</span>
                  <IconBubble icon={row.name.includes('Research') ? Search : row.name.includes('Content') ? Megaphone : row.name.includes('Report') ? FileText : Bot} tone={row.tone as Tone} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-slate-950">{row.name}</div>
                    <ProgressBar value={row.successRate} height={6} label={`${row.name} success rate`} />
                  </div>
                  <span className="text-right text-sm font-bold text-slate-700">{row.successRate}%</span>
                </div>
              ))}</div>
            </Panel>
          </div>
          <div data-parity-id="agent-performance.table-panel">
            <Panel title={<span className="flex items-center gap-2"><BarChart3 className="h-4 w-4" />Hieu suat chi tiet</span>} action={<MoreButton />} className="h-[332px] overflow-hidden">
              <div className="px-4 pb-4">
                <div className="grid grid-cols-[1.25fr_.6fr_.7fr_.7fr_.7fr_.7fr_.7fr_64px] gap-3 border-b border-slate-100 py-3 text-[11px] font-bold uppercase leading-4 text-slate-400">
                  <span>Agent</span><span>Tasks</span><span>Success</span><span>Avg Cost</span><span>Avg Run</span><span>Failed</span><span>Quality</span><span>Actions</span>
                </div>
                {vm.performanceRows.slice(0, 5).map((row) => (
                  <div key={row.id} className="grid grid-cols-[1.25fr_.6fr_.7fr_.7fr_.7fr_.7fr_.7fr_64px] items-center gap-3 border-b border-slate-100 py-2.5 text-xs">
                    <div className="flex min-w-0 items-center gap-2"><IconBubble icon={row.name.includes('Research') ? Search : row.name.includes('Content') ? Megaphone : Bot} tone={row.tone as Tone} /><div className="min-w-0"><b className="block truncate text-slate-950">{row.name}</b><span className="truncate text-slate-500">{row.role}</span></div></div>
                    <span>{row.completedTasks}</span>
                    <span className="font-bold text-emerald-600">{row.successRate}%</span>
                    <span>${row.avgCostPerTask.toFixed(2)}</span>
                    <span>{row.avgRunTime}</span>
                    <span className={row.failedRuns > 7 ? 'font-bold text-red-500' : 'text-red-500'}>{row.failedRuns}</span>
                    <span>{row.quality}%</span>
                    <span className="flex items-center gap-1"><MiniTrend direction={row.failedRuns > 7 ? 'down' : 'up'} /><MoreButton /></span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
          <div data-parity-id="agent-performance.analysis-panel">
            <Panel title={<span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Phan tich loi</span>} className="h-[332px] overflow-hidden">
              <div className="space-y-3 p-4">
                <div className="grid grid-cols-[1fr_46px_46px] gap-3 text-xs font-bold uppercase text-slate-400"><span>Ly do that bai</span><span>So lan</span><span>Ty le</span></div>
                {vm.failureReasons.map((reason, index) => <div key={reason.id} className="grid grid-cols-[1fr_46px_46px] items-center gap-3 text-xs"><div className="min-w-0"><div className="flex items-center gap-2"><span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white ${reason.tone === 'red' ? 'bg-red-500' : reason.tone === 'amber' ? 'bg-amber-500' : reason.tone === 'cyan' ? 'bg-cyan-500' : reason.tone === 'purple' ? 'bg-violet-500' : 'bg-blue-500'}`}>{index + 1}</span><span className="truncate font-semibold">{reason.label}</span></div><ProgressBar value={reason.percent * 4} tone={reason.tone as Tone} height={6} label={`${reason.label} share`} /></div><b>{reason.count}</b><span>{reason.percent}%</span></div>)}
              </div>
            </Panel>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_420px] gap-4">
          <div data-parity-id="agent-performance.scatter-panel">
            <Panel title={<span className="flex items-center gap-2"><BarChart3 className="h-4 w-4" />Chi phi so voi chat luong</span>} className="h-[292px] overflow-hidden">
              <AgentQualityCostChart points={vm.qualityCostPoints} />
            </Panel>
          </div>
          <div className="space-y-4">
            <div data-parity-id="agent-performance.recommendations-panel">
              <Panel title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4" />Goi y toi uu</span>} className="h-[168px] overflow-hidden">
                <div className="space-y-2 p-3">{vm.recommendations.map((item) => <div key={item.id} className="grid grid-cols-[32px_1fr_20px] items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs"><IconBubble icon={item.tone === 'cyan' ? Search : item.tone === 'green' ? Megaphone : item.tone === 'purple' ? BarChart3 : Bot} tone={item.tone as Tone} /><span><b>{item.agent}</b> {item.text}</span><RowAction /></div>)}</div>
              </Panel>
            </div>
            <div data-parity-id="agent-performance.attention-panel">
              <Panel title={<span className="flex items-center gap-2"><Bell className="h-4 w-4" />Agent can chu y</span>} className="h-[124px] overflow-hidden">
                <div className="space-y-2 p-3">{vm.attentionAgents.map((agent) => <div key={agent.id} className="grid grid-cols-[32px_1fr_72px_18px] items-center gap-3 rounded-lg border border-red-100 bg-red-50/40 px-3 py-2 text-xs"><IconBubble icon={agent.name.includes('Research') ? Search : agent.name.includes('Content') ? Megaphone : BarChart3} tone={agent.tone as Tone} /><span><b className="block">{agent.name}</b><span className="text-slate-500">{agent.issue}</span></span><Badge tone="red">Canh bao</Badge><RowAction /></div>)}</div>
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniTrend({ direction }: { direction: 'up' | 'down' }) {
  const color = direction === 'up' ? '#10b981' : '#ef4444';
  const path = direction === 'up' ? 'M2 22 L14 16 L24 18 L36 7 L48 11 L62 2' : 'M2 4 L14 11 L24 9 L36 20 L48 16 L62 26';
  return <svg viewBox="0 0 64 28" className="h-7 w-12" aria-hidden="true"><path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function AgentQualityCostChart({ points }: { points: Array<{ id: string; name: string; quality: number; cost: number; tone: string }> }) {
  const toneColor = (tone: string) => tone === 'green' ? '#10b981' : tone === 'cyan' ? '#06b6d4' : tone === 'purple' ? '#8b5cf6' : tone === 'amber' ? '#f59e0b' : '#176bff';
  const x = (cost: number) => 34 + Math.min(1, Math.max(0, (cost - 0.1) / 0.7)) * 760;
  const y = (quality: number) => 190 - Math.min(1, Math.max(0, (quality - 60) / 40)) * 158;
  return (
    <div className="px-4 pb-4">
      <div className="mb-1 text-xs font-semibold text-slate-500">Quality score (%)</div>
      <svg viewBox="0 0 840 210" className="h-[214px] w-full" role="img" aria-label="Cost versus quality scatter chart">
        {[60, 70, 80, 90, 100].map((tick) => <g key={tick}><line x1="34" x2="808" y1={y(tick)} y2={y(tick)} stroke="#dbe3ef" strokeDasharray="5 5" /><text x="0" y={y(tick) + 4} fontSize="12" fill="#64748b">{tick}</text></g>)}
        {[0.1, 0.2, 0.4, 0.6, 0.8].map((tick) => <g key={tick}><text x={x(tick) - 10} y="205" fontSize="12" fill="#64748b">{tick.toFixed(2)}</text></g>)}
        <line x1="34" x2="808" y1="190" y2="190" stroke="#cbd5e1" />
        <line x1="34" x2="34" y1="32" y2="190" stroke="#cbd5e1" />
        {points.map((point) => <g key={point.id}><circle cx={x(point.cost)} cy={y(point.quality)} r="6" fill={toneColor(point.tone)} /><text x={x(point.cost) + 10} y={y(point.quality) - 8} fontSize="12" fontWeight="700" fill="#334155">{point.name}</text></g>)}
      </svg>
      <div className="text-center text-xs font-semibold text-slate-500">Cost per task (USD)</div>
    </div>
  );
}

function AgentMemoryScreen() {
  const vm = selectAgentMemoryViewModel();
  return (
    <div>
      <SimpleHeader parityId="agent-memory.header" title="Agent Memory" subtitle="Quan ly context, memory scope va nguon tri thuc ma agent dang su dung." actions={<Button variant="secondary"><BookOpen className="h-4 w-4" />Export context</Button>} />
      <div data-parity-id="agent-memory.kpi-band" className="mt-4 grid grid-cols-5 gap-4">{vm.sources.map((source) => <div key={source} className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-700">{source}</div>)}</div>
      <div data-parity-id="agent-memory.main-grid" className="mt-5 grid grid-cols-[1fr_390px] gap-5">
        <div data-parity-id="agent-memory.memory-panel">
          <Panel title="Agent memory summaries">
            <div className="space-y-4 p-5">{vm.agents.map((agent) => <div key={agent.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between"><b>{agent.name}</b><Badge tone={agent.riskLevel === 'high' ? 'red' : 'blue'}>{agent.contextCount} contexts</Badge></div><p className="mt-2 text-sm leading-6 text-slate-500">{agent.memorySummary}</p></div>)}</div>
          </Panel>
        </div>
        <div data-parity-id="agent-memory.context-panel">
          <Panel title="Context controls">
            <div className="space-y-3 p-5">{['Limit memory by project', 'Require approval for external source', 'Retain run logs for 90 days', 'Reset memory on template clone'].map((item) => <div key={item} className="rounded-xl border border-slate-100 px-4 py-3 text-sm font-semibold">{item}</div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function SkillsRegistryScreen() {
  const vm = selectSkillsRegistryViewModel();
  return (
    <div>
      <SimpleHeader parityId="skills.header" title="Skill Registry" subtitle="Theo doi skills duoc gan cho agents va muc do su dung trong workflow." actions={<Button><Code2 className="h-4 w-4" />Add skill</Button>} />
      <MetricBand parityId="skills.kpi-band" items={vm.kpis} />
      <div data-parity-id="skills.main-grid" className="mt-4 grid grid-cols-[1fr_380px] gap-5">
        <div data-parity-id="skills.registry-panel">
          <Panel title="Skills">
            <div className="divide-y divide-slate-100 p-4">{vm.skills.map((skill) => <div key={skill.id} className="grid grid-cols-[1fr_90px_120px] items-center gap-4 py-3"><div><b>{skill.name}</b><div className="text-sm text-slate-500">{skill.agents.join(', ')}</div></div><span className="font-bold text-[#0f6bff]">{skill.usage}%</span><Badge tone={skill.status === 'Active' ? 'green' : 'amber'}>{skill.status}</Badge></div>)}</div>
          </Panel>
        </div>
        <div data-parity-id="skills.detail-panel">
          <Panel title="Quality guardrails">
            <div className="space-y-3 p-5">{['Skill changes require review', 'Usage tracked by run', 'Inactive skills archived monthly', 'High-risk skills need approval'].map((item) => <div key={item} className="rounded-xl bg-blue-50 p-3 text-sm font-semibold text-[#0f6bff]">{item}</div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ToolsPermissionsScreen() {
  const vm = selectToolsPermissionsViewModel();
  return (
    <div>
      <SimpleHeader parityId="tools.header" title="Toolsets & Permissions" subtitle="Quan ly tool access, approval policy va risk level cho tung agent." actions={<Button><Lock className="h-4 w-4" />Update policy</Button>} />
      <MetricBand parityId="tools.kpi-band" items={vm.kpis} />
      <div data-parity-id="tools.main-grid" className="mt-4 grid grid-cols-[1fr_390px] gap-5">
        <div data-parity-id="tools.toolsets-panel">
          <Panel title="Tool access matrix">
            <div className="divide-y divide-slate-100 p-4">{vm.tools.map((tool) => <div key={tool.id} className="grid grid-cols-[1fr_150px_100px] items-center gap-4 py-3"><div><b>{tool.name}</b><div className="text-sm text-slate-500">{tool.agents.join(', ') || 'No agent assigned'}</div></div><Badge tone={tool.access === 'Restricted' ? 'red' : tool.access === 'Approval required' ? 'amber' : 'green'}>{tool.access}</Badge><Badge tone={tool.risk === 'high' ? 'red' : tool.risk === 'medium' ? 'amber' : 'green'}>{tool.risk}</Badge></div>)}</div>
          </Panel>
        </div>
        <div data-parity-id="tools.permissions-panel">
          <Panel title="Permission policies">
            <div className="space-y-3 p-5">{vm.policies.map((policy) => <div key={policy} className="rounded-xl border border-slate-100 px-4 py-3 text-sm font-semibold">{policy}</div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function TicketsListScreen() {
  const vm = selectTicketsListViewModel();
  return (
    <div>
      <SimpleHeader parityId="tickets-list.header" title="Tickets List" subtitle="Danh sach ticket van hanh, trang thai run, approval va owner agent." actions={<><Button variant="secondary"><Search className="h-4 w-4" />Filter</Button><Button><Ticket className="h-4 w-4" />New ticket</Button></>} />
      <MetricBand parityId="tickets-list.kpi-band" items={vm.kpis} />
      <div data-parity-id="tickets-list.main-grid" className="mt-4 grid grid-cols-[1fr_390px] gap-5">
        <div data-parity-id="tickets-list.list-panel">
          <Panel title="Ticket register">
            <div className="p-4">
              <div className="grid grid-cols-[96px_1.2fr_120px_120px_130px_110px] gap-3 border-b border-slate-100 pb-3 text-xs font-bold uppercase text-slate-400">
                <span>Code</span><span>Ticket</span><span>Status</span><span>Owner</span><span>Run</span><span>Risk</span>
              </div>
              {vm.rows.map((ticket) => (
                <div key={ticket.id} className="grid grid-cols-[96px_1.2fr_120px_120px_130px_110px] items-center gap-3 border-b border-slate-100 py-3 text-sm">
                  <b className="text-[#0f6bff]">{ticket.code}</b>
                  <div><b>{ticket.title}</b><div className="mt-1 flex flex-wrap gap-1">{ticket.tags.slice(0, 2).map((tag) => <Badge key={tag} tone="slate">{tag}</Badge>)}</div></div>
                  <Badge tone={ticket.status === 'Done' ? 'green' : ticket.status === 'Needs Review' ? 'amber' : 'blue'}>{ticket.status}</Badge>
                  <span className="font-semibold text-slate-600">{ticket.owner}</span>
                  <span className="text-slate-500">{ticket.runStatus}</span>
                  <Badge tone={ticket.risk === 'High' ? 'red' : ticket.risk === 'Medium' ? 'amber' : 'green'}>{ticket.risk}</Badge>
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <div data-parity-id="tickets-list.detail-panel" className="space-y-5">
          <Panel title="Queue filters">
            <div className="space-y-3 p-5">{['All tickets', 'Running now', 'Needs review', 'Blocked or failed', 'Due this week'].map((filter, index) => <div key={filter} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${index === 0 ? 'border-blue-200 bg-blue-50 text-[#0f6bff]' : 'border-slate-100 text-slate-600'}`}>{filter}</div>)}</div>
          </Panel>
          <Panel title="Owner workload">
            <div className="space-y-4 p-5">{vm.agents.map((agent) => <div key={agent.id}><div className="mb-2 flex justify-between text-sm"><b>{agent.name}</b><span>{agent.currentTicketIds.length} tickets</span></div><ProgressBar value={Math.min(100, agent.currentTicketIds.length * 35 + 20)} label={`${agent.name} ticket workload`} /></div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function CreateTicketScreen() {
  const vm = selectCreateTicketViewModel();
  return (
    <div>
      <SimpleHeader parityId="ticket-create.header" title="Create Ticket Wizard" subtitle="Tao ticket moi, gan agent owner, lien ket goal va chuan hoa acceptance criteria." actions={<Button><Ticket className="h-4 w-4" />Create ticket</Button>} />
      <div data-parity-id="ticket-create.steps" className="mt-4 grid grid-cols-4 gap-4">
        {['Scope', 'Owner', 'Criteria', 'Approval'].map((step, index) => <div key={step} className={`rounded-xl border px-4 py-3 text-sm font-bold ${index === 0 ? 'border-[#0f6bff] bg-blue-50 text-[#0f6bff]' : 'border-slate-200 bg-white text-slate-600'}`}>{index + 1}. {step}</div>)}
      </div>
      <div data-parity-id="ticket-create.main-grid" className="mt-5 grid grid-cols-[1fr_420px] gap-5">
        <div data-parity-id="ticket-create.form-panel" className="space-y-5">
          <Panel title="Ticket templates">
            <div className="grid grid-cols-2 gap-4 p-5">{vm.templates.map((template) => <div key={template.id} className="rounded-xl border border-slate-100 p-4"><IconBubble icon={Ticket} tone="blue" /><b className="mt-3 block">{template.title}</b><p className="mt-1 text-sm leading-6 text-slate-500">{template.description}</p><div className="mt-3 text-sm font-semibold text-slate-600">Owner: {template.owner}</div></div>)}</div>
          </Panel>
          <Panel title="Suggested tags">
            <div className="flex flex-wrap gap-3 p-5">{vm.tags.map((tag) => <Badge key={tag} tone="purple">{tag}</Badge>)}</div>
          </Panel>
        </div>
        <div data-parity-id="ticket-create.preview-panel">
          <Panel title="Ticket preview">
            <div className="space-y-4 p-5">
              <FieldRow label="Requester" value={vm.requester.name} />
              <FieldRow label="Default agent" value={vm.agents[0]?.name ?? 'Unassigned'} />
              <FieldRow label="Linked goal" value={vm.goals[0]?.title ?? 'No goal'} />
              <div className="rounded-xl bg-blue-50 p-4 text-sm font-semibold text-[#0f6bff]">Approval policy will be inherited from workspace guardrails.</div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ArtifactsLibraryScreen() {
  const vm = selectArtifactsLibraryViewModel();
  return (
    <div>
      <SimpleHeader parityId="artifacts.header" title="Artifacts Library" subtitle="Tap trung toan bo artifact duoc tao tu run: report, log, screenshot va archive evidence." actions={<><Button variant="secondary"><UploadCloud className="h-4 w-4" />Upload</Button><Button><Folder className="h-4 w-4" />New folder</Button></>} />
      <MetricBand parityId="artifacts.kpi-band" items={vm.kpis} />
      <div data-parity-id="artifacts.main-grid" className="mt-4 grid grid-cols-[1fr_390px] gap-5">
        <div data-parity-id="artifacts.library-panel">
          <Panel title="Artifact register">
            <div className="grid grid-cols-3 gap-4 p-5">{vm.artifacts.map((artifact) => <div key={artifact.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between"><IconBubble icon={FileText} tone={artifact.type === 'report' ? 'green' : artifact.type === 'log' ? 'cyan' : 'purple'} /><Badge tone={artifact.risk === 'High' ? 'red' : 'green'}>{artifact.type}</Badge></div><b className="mt-4 block">{artifact.name}</b><p className="mt-1 text-sm text-slate-500">{artifact.ticketCode} · {artifact.agentName}</p><div className="mt-3 flex justify-between text-sm font-semibold text-slate-500"><span>{artifact.size}</span><span>{artifact.createdAt.slice(0, 10)}</span></div></div>)}</div>
          </Panel>
        </div>
        <div data-parity-id="artifacts.inspector-panel" className="space-y-5">
          <Panel title="Run links">
            <div className="divide-y divide-slate-100 p-4">{vm.runs.map((run) => <div key={run.id} className="py-3"><b className="text-sm">{run.id}</b><p className="mt-1 text-sm text-slate-500">{run.currentStep} · {run.artifacts.length} artifacts</p></div>)}</div>
          </Panel>
          <Panel title="Retention policy">
            <div className="space-y-3 p-5">{['Keep QA evidence for 180 days', 'Attach artifacts to ticket timeline', 'Restrict archive downloads', 'Log every review action'].map((item) => <div key={item} className="rounded-xl border border-slate-100 px-4 py-3 text-sm font-semibold">{item}</div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ArtifactDetailScreen() {
  const vm = selectArtifactDetailViewModel();
  return (
    <div>
      <SimpleHeader parityId="artifact.header" title="Artifact Detail" subtitle="Review artifact, metadata, lineage va acceptance evidence truoc khi chia se." actions={<><Button variant="secondary"><Eye className="h-4 w-4" />Preview</Button><Button><CheckCircle2 className="h-4 w-4" />Approve</Button></>} />
      <div data-parity-id="artifact.main-grid" className="mt-5 grid grid-cols-[1fr_420px] gap-5">
        <div data-parity-id="artifact.preview-panel" className="space-y-5">
          <Panel title={vm.artifact.name}>
            <div className="p-5">
              <div className="grid min-h-[260px] place-items-center rounded-2xl border border-dashed border-blue-200 bg-blue-50">
                <div className="text-center"><FileText className="mx-auto h-14 w-14 text-[#0f6bff]" /><h2 className="mt-4 text-2xl font-extrabold text-slate-950">{vm.artifact.type.toUpperCase()} artifact</h2><p className="mt-2 text-sm text-slate-500">{vm.ticket.title}</p></div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-4">{[['Run', vm.run.id], ['Agent', vm.agent.name], ['Status', vm.artifact.status]].map(([label, value]) => <FieldRow key={label} label={label} value={value} />)}</div>
            </div>
          </Panel>
          <Panel title="Review checklist">
            <div className="divide-y divide-slate-100 p-4">{vm.reviewChecklist.map((item) => <div key={item.id} className="flex items-center justify-between py-3"><span className="font-semibold">{item.label}</span><Badge tone={item.status === 'Verified' ? 'green' : 'amber'}>{item.status}</Badge></div>)}</div>
          </Panel>
        </div>
        <div data-parity-id="artifact.metadata-panel" className="space-y-5">
          <Panel title="Metadata">
            <div className="space-y-3 p-5">
              <FieldRow label="Ticket" value={`${vm.ticket.code} · ${vm.ticket.title}`} />
              <FieldRow label="Created" value={vm.artifact.createdAt.slice(0, 10)} />
              <FieldRow label="Size" value={vm.artifact.size} />
              <FieldRow label="Risk" value={vm.artifact.risk} />
            </div>
          </Panel>
          <Panel title="Related artifacts">
            <div className="divide-y divide-slate-100 p-4">{vm.relatedArtifacts.map((artifact) => <div key={artifact.id} className="py-3"><b className="text-sm">{artifact.name}</b><p className="mt-1 text-sm text-slate-500">{artifact.type} · {artifact.size}</p></div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ApprovalDetailScreen() {
  const vm = selectApprovalDetailViewModel();
  return (
    <div>
      <SimpleHeader parityId="approval-detail.header" title="Approval Detail" subtitle="Review request, linked ticket, policy context va audit trail truoc khi phe duyet." actions={<><Button variant="secondary"><AlertTriangle className="h-4 w-4" />Reject</Button><Button><CheckCircle2 className="h-4 w-4" />Approve</Button></>} />
      <MetricBand parityId="approval-detail.kpi-band" items={vm.kpis} />
      <div data-parity-id="approval-detail.main-grid" className="mt-4 grid grid-cols-[1fr_420px] gap-5">
        <div data-parity-id="approval-detail.request-panel" className="space-y-5">
          <Panel title={vm.approval.title}>
            <div className="space-y-4 p-5">
              <p className="leading-7 text-slate-600">{vm.approval.description}</p>
              <div className="grid grid-cols-2 gap-4">
                <FieldRow label="Ticket" value={`${vm.ticket.code} · ${vm.ticket.title}`} />
                <FieldRow label="Agent" value={vm.agent.name} />
                <FieldRow label="Policy" value={vm.approval.policy} />
                <FieldRow label="Requested" value={vm.approval.requestedAt.slice(0, 10)} />
              </div>
            </div>
          </Panel>
          <Panel title="Audit trail">
            <div className="divide-y divide-slate-100 p-4">
              {vm.approval.auditTrail.map((entry) => <div key={entry.id} className="flex items-center justify-between py-3"><div><b className="text-sm">{entry.action}</b><p className="mt-1 text-sm text-slate-500">{entry.createdAt.slice(0, 19)}</p></div><Badge tone="blue">{entry.actorId}</Badge></div>)}
              {vm.events.map((event) => <div key={event.id} className="flex items-center justify-between py-3"><div><b className="text-sm">{event.command}</b><p className="mt-1 text-sm text-slate-500">{event.createdAt.slice(0, 19)}</p></div><Badge tone={event.status === 'failed' ? 'red' : 'green'}>{event.status}</Badge></div>)}
            </div>
          </Panel>
        </div>
        <div data-parity-id="approval-detail.policy-panel" className="space-y-5">
          <Panel title="Decision context">
            <div className="space-y-3 p-5">
              <FieldRow label="Run" value={vm.run?.id ?? 'No run'} />
              <FieldRow label="Current step" value={vm.run?.currentStep ?? 'Manual approval'} />
              <FieldRow label="Cost" value={vm.run ? `$${vm.run.cost}` : '$0'} />
              <FieldRow label="Risk" value={vm.approval.severity} />
            </div>
          </Panel>
          <Panel title="Required checks">
            <div className="space-y-3 p-5">{['Requester authorized', 'Tool policy matched', 'Run evidence attached', 'Rollback path available'].map((item, index) => <div key={item} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"><span className="font-semibold">{item}</span><Badge tone={index < 3 ? 'green' : 'amber'}>{index < 3 ? 'Pass' : 'Review'}</Badge></div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function GovernancePoliciesScreen() {
  const vm = selectGovernancePoliciesViewModel();
  return (
    <div>
      <SimpleHeader parityId="governance.header" title="Governance Policy" subtitle="Quan ly policy, guardrail va enforcement cho toan bo AI workforce." actions={<><Button variant="secondary"><FileText className="h-4 w-4" />Export</Button><Button><ShieldCheck className="h-4 w-4" />New policy</Button></>} />
      <MetricBand parityId="governance.kpi-band" items={vm.kpis} />
      <div data-parity-id="governance.main-grid" className="mt-4 grid grid-cols-[1fr_420px] gap-5">
        <div data-parity-id="governance.policy-panel">
          <Panel title="Policy registry">
            <div className="space-y-4 p-5">{vm.policies.map((policy) => <div key={policy.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between"><b>{policy.name}</b><Badge tone={policy.status === 'Enforced' ? 'green' : 'amber'}>{policy.status}</Badge></div><p className="mt-1 text-sm text-slate-500">Owner: {policy.owner}</p><div className="mt-3"><ProgressBar value={policy.coverage} tone={policy.coverage > 85 ? 'green' : 'amber'} label={`${policy.name} coverage`} /></div></div>)}</div>
          </Panel>
        </div>
        <div data-parity-id="governance.rules-panel">
          <Panel title="Tool rules">
            <div className="divide-y divide-slate-100 p-4">{vm.rules.map((rule) => <div key={rule.id} className="py-3"><div className="flex items-center justify-between"><b className="text-sm">{rule.tool}</b><Badge tone={rule.risk === 'High' ? 'red' : rule.risk === 'Medium' ? 'amber' : 'green'}>{rule.risk}</Badge></div><p className="mt-1 text-sm text-slate-500">{rule.action}</p></div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function AuditLogScreen() {
  const vm = selectAuditLogViewModel();
  return (
    <div>
      <SimpleHeader parityId="audit.header" title="Audit Log" subtitle="Lich su hanh dong, approval, workflow event va audit evidence tren workspace." actions={<Button variant="secondary"><Search className="h-4 w-4" />Search logs</Button>} />
      <MetricBand parityId="audit.kpi-band" items={vm.kpis} />
      <div data-parity-id="audit.main-grid" className="mt-4 grid grid-cols-[1fr_360px] gap-5">
        <div data-parity-id="audit.log-panel">
          <Panel title="Event stream">
            <div className="p-4">
              <div className="grid grid-cols-[150px_160px_1fr_120px_120px] gap-3 border-b border-slate-100 pb-3 text-xs font-bold uppercase text-slate-400"><span>Time</span><span>Actor</span><span>Event</span><span>Status</span><span>Severity</span></div>
              {vm.rows.slice(0, 12).map((row) => <div key={row.id} className="grid grid-cols-[150px_160px_1fr_120px_120px] items-center gap-3 border-b border-slate-100 py-3 text-sm"><span className="text-slate-500">{row.createdAt.slice(0, 16)}</span><b>{row.actor}</b><div><b>{row.action}</b><p className="mt-1 text-slate-500">{row.entity}</p></div><Badge tone={row.status === 'Failed' ? 'red' : row.status === 'Warning' ? 'amber' : 'green'}>{row.status}</Badge><Badge tone={row.severity === 'high' ? 'red' : row.severity === 'medium' ? 'amber' : 'green'}>{row.severity}</Badge></div>)}
            </div>
          </Panel>
        </div>
        <div data-parity-id="audit.filter-panel">
          <Panel title="Audit filters">
            <div className="space-y-3 p-5">{['All events', 'Approval decisions', 'Workflow commands', 'Policy changes', 'Failures only'].map((filter, index) => <div key={filter} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${index === 0 ? 'border-blue-200 bg-blue-50 text-[#0f6bff]' : 'border-slate-100 text-slate-600'}`}>{filter}</div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function RiskCenterScreen() {
  const vm = selectRiskCenterViewModel();
  return (
    <div>
      <SimpleHeader parityId="risk.header" title="Risk Center" subtitle="Theo doi risk exposure theo agent, ticket, run va governance control." actions={<><Button variant="secondary"><AlertTriangle className="h-4 w-4" />Escalate</Button><Button><ShieldCheck className="h-4 w-4" />Review controls</Button></>} />
      <MetricBand parityId="risk.kpi-band" items={vm.kpis} />
      <div data-parity-id="risk.main-grid" className="mt-4 grid grid-cols-[1fr_420px] gap-5">
        <div data-parity-id="risk.exposure-panel" className="space-y-5">
          <Panel title="Risk exposure">
            <div className="grid grid-cols-3 gap-4 p-5">
              {vm.riskyTickets.map((ticket) => <div key={ticket.id} className="rounded-xl border border-red-100 bg-red-50 p-4"><b className="text-red-700">{ticket.code}</b><p className="mt-2 text-sm text-slate-600">{ticket.title}</p><Badge tone="red">{ticket.riskLevel}</Badge></div>)}
              {vm.riskyAgents.map((agent) => <div key={agent.id} className="rounded-xl border border-amber-100 bg-amber-50 p-4"><b className="text-amber-700">{agent.name}</b><p className="mt-2 text-sm text-slate-600">{agent.role}</p><Badge tone="amber">{agent.riskLevel}</Badge></div>)}
            </div>
          </Panel>
          <Panel title="Risky runs">
            <div className="divide-y divide-slate-100 p-4">{vm.riskyRuns.map((run) => <div key={run.id} className="flex items-center justify-between py-3"><div><b className="text-sm">{run.id}</b><p className="mt-1 text-sm text-slate-500">{run.currentStep}</p></div><Badge tone={run.status === 'failed' ? 'red' : 'amber'}>{run.status}</Badge></div>)}</div>
          </Panel>
        </div>
        <div data-parity-id="risk.controls-panel">
          <Panel title="Control coverage">
            <div className="space-y-4 p-5">{vm.controls.map((control) => <div key={control.label}><div className="mb-2 flex justify-between text-sm"><b>{control.label}</b><span>{control.value}%</span></div><ProgressBar value={control.value} tone={control.tone as Tone} label={`${control.label} coverage`} /></div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function CostDashboardScreen() {
  const vm = selectCostDashboardViewModel();
  return (
    <div>
      <SimpleHeader
        parityId="cost.header"
        title="Cost Dashboard"
        subtitle="Theo doi chi phi AI theo agent, tool, run va budget velocity cua workspace."
        actions={<><Button variant="secondary"><CalendarDays className="h-4 w-4" />This month</Button><Button><BarChart3 className="h-4 w-4" />Export cost</Button></>}
      />
      <MetricBand parityId="cost.kpi-band" items={vm.kpis} />
      <div data-parity-id="cost.main-grid" className="mt-4 grid grid-cols-[1fr_420px] gap-5">
        <div data-parity-id="cost.breakdown-panel" className="space-y-5">
          <Panel title="Agent spend allocation">
            <div className="space-y-4 p-5">
              {vm.agentSpend.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-100 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3"><b>{item.label}</b><span className="font-bold text-[#0f6bff]">{currencyDisplay(item.value)}</span></div>
                  <ProgressBar value={item.percent} tone={item.tone as Tone} label={`${item.label} spend allocation`} />
                  <div className="mt-2 flex justify-between text-sm text-slate-500"><span>{item.percent}% of period spend</span><Badge tone={item.tone as Tone}>{item.status}</Badge></div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Ticket spend register">
            <div className="p-4">
              <div className="grid grid-cols-[110px_1fr_160px_90px_90px] gap-3 border-b border-slate-100 pb-3 text-xs font-bold uppercase text-slate-400"><span>Ticket</span><span>Scope</span><span>Agent</span><span>Risk</span><span>Cost</span></div>
              {vm.ticketSpendRows.slice(0, 7).map((row) => <div key={row.id} className="grid grid-cols-[110px_1fr_160px_90px_90px] items-center gap-3 border-b border-slate-100 py-3 text-sm"><b>{row.code}</b><span>{row.title}</span><span className="text-slate-500">{row.agent}</span><Badge tone={row.risk === 'High' ? 'red' : row.risk === 'Medium' ? 'amber' : 'green'}>{row.risk}</Badge><b>{currencyDisplay(row.cost)}</b></div>)}
            </div>
          </Panel>
        </div>
        <div data-parity-id="cost.alerts-panel" className="space-y-5">
          <Panel title="Budget velocity">
            <div className="p-5">
              <div className="flex items-end justify-between"><div><div className="text-sm font-semibold text-slate-500">{vm.workspace.name}</div><b className="text-3xl text-slate-950">{vm.budgetUsed}%</b></div><Badge tone={vm.budgetUsed > 75 ? 'amber' : 'green'}>{vm.costBreakdown.period}</Badge></div>
              <div className="mt-4"><ProgressBar value={vm.budgetUsed} tone={vm.budgetUsed > 75 ? 'amber' : 'green'} label="Monthly budget used" height={10} /></div>
            </div>
          </Panel>
          <Panel title="Tool spend">
            <div className="space-y-4 p-5">{vm.toolSpend.map((item) => <div key={item.id}><div className="mb-2 flex justify-between text-sm"><b>{item.label}</b><span>{currencyDisplay(item.value)}</span></div><ProgressBar value={item.percent} tone={item.percent > 35 ? 'amber' : 'blue'} label={`${item.label} tool spend`} /></div>)}</div>
          </Panel>
          <Panel title="Cost alerts">
            <div className="divide-y divide-slate-100 p-4">{vm.alerts.map((alert) => <div key={alert.id} className="py-3"><div className="flex items-center justify-between gap-3"><b className="text-sm">{alert.title}</b><Badge tone={alert.tone as Tone}>{alert.severity}</Badge></div><p className="mt-1 text-sm leading-6 text-slate-500">{alert.detail}</p></div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function BudgetSettingsScreen() {
  const vm = selectBudgetSettingsViewModel();
  return (
    <div>
      <SimpleHeader
        parityId="budget.header"
        title="Budget Settings"
        subtitle="Cau hinh monthly cap, approval threshold va guardrail cho tung agent."
        actions={<><Button variant="secondary"><ShieldCheck className="h-4 w-4" />Review policies</Button><Button><Check className="h-4 w-4" />Save settings</Button></>}
      />
      <MetricBand parityId="budget.kpi-band" items={vm.kpis} />
      <div data-parity-id="budget.main-grid" className="mt-4 grid grid-cols-[1fr_420px] gap-5">
        <div data-parity-id="budget.policy-panel" className="space-y-5">
          <Panel title="Agent budget policies">
            <div className="p-4">
              <div className="grid grid-cols-[1fr_130px_130px_140px_100px] gap-3 border-b border-slate-100 pb-3 text-xs font-bold uppercase text-slate-400"><span>Agent</span><span>Limit</span><span>Used</span><span>Approval</span><span>Status</span></div>
              {vm.policyRows.map((row) => <div key={row.id} className="grid grid-cols-[1fr_130px_130px_140px_100px] items-center gap-3 border-b border-slate-100 py-3 text-sm"><b>{row.agent}</b><span>{currencyDisplay(row.monthlyLimit)}</span><span>{currencyDisplay(row.used)}</span><Badge tone="blue">{row.approvalThreshold}</Badge><Badge tone={row.status === 'Review' ? 'amber' : 'green'}>{row.status}</Badge></div>)}
            </div>
          </Panel>
          <Panel title="Approval policy links">
            <div className="divide-y divide-slate-100 p-4">{vm.approvalPolicies.slice(0, 6).map((policy) => <div key={policy.id} className="py-3"><div className="flex items-center justify-between gap-3"><b className="text-sm">{policy.title}</b><Badge tone={policy.severity === 'High' ? 'red' : policy.severity === 'Medium' ? 'amber' : 'green'}>{policy.severity}</Badge></div><p className="mt-1 text-sm text-slate-500">{policy.agent} - {policy.status}</p></div>)}</div>
          </Panel>
        </div>
        <div data-parity-id="budget.threshold-panel" className="space-y-5">
          <Panel title="Workspace budget">
            <div className="space-y-4 p-5">
              <FieldRow label="Workspace" value={vm.workspace.name} />
              <FieldRow label="Plan" value={vm.workspace.plan} />
              <FieldRow label="Monthly AI cap" value={currencyDisplay(vm.workspace.aiBudgetMonthly)} />
            </div>
          </Panel>
          <Panel title="Threshold matrix">
            <div className="space-y-3 p-5">{vm.thresholdRows.map((row) => <div key={row.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between"><b>{row.label}</b><Badge tone={row.tone as Tone}>{row.value}</Badge></div><p className="mt-1 text-sm text-slate-500">Owner: {row.owner}</p></div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ReportsDashboardScreen() {
  const vm = selectReportsDashboardViewModel();
  return (
    <div>
      <SimpleHeader
        parityId="reports.header"
        title="Reports Dashboard"
        subtitle="Quan ly report da giao, lich lap lai va insight executive tu doi AI."
        actions={<><Button variant="secondary"><Search className="h-4 w-4" />Search</Button><Button><FileText className="h-4 w-4" />New report</Button></>}
      />
      <MetricBand parityId="reports.kpi-band" items={vm.kpis} />
      <div data-parity-id="reports.main-grid" className="mt-4 grid grid-cols-[1fr_420px] gap-5">
        <div data-parity-id="reports.list-panel" className="space-y-5">
          <Panel title="Scheduled reports">
            <div className="space-y-4 p-5">{vm.scheduled.map((report) => <div key={report.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between"><b>{report.title}</b><Badge tone={report.status === 'Ready' ? 'green' : 'amber'}>{report.status}</Badge></div><p className="mt-1 text-sm text-slate-500">Owner: {report.owner} - {report.cadence} - Next {report.nextRun}</p></div>)}</div>
          </Panel>
          <Panel title="Recent report runs">
            <div className="p-4">
              <div className="grid grid-cols-[1fr_160px_110px_100px_100px] gap-3 border-b border-slate-100 pb-3 text-xs font-bold uppercase text-slate-400"><span>Ticket</span><span>Agent</span><span>Status</span><span>Duration</span><span>Cost</span></div>
              {vm.recentRuns.map((run) => <div key={run.id} className="grid grid-cols-[1fr_160px_110px_100px_100px] items-center gap-3 border-b border-slate-100 py-3 text-sm"><span>{run.ticket}</span><b>{run.agent}</b><Badge tone={run.status === 'Failed' ? 'red' : run.status === 'Running' ? 'blue' : 'green'}>{run.status}</Badge><span>{run.duration}</span><b>{run.cost}</b></div>)}
            </div>
          </Panel>
        </div>
        <div data-parity-id="reports.schedule-panel" className="space-y-5">
          <Panel title="Published artifacts">
            <div className="divide-y divide-slate-100 p-4">{vm.artifacts.map((artifact) => <div key={artifact.id} className="py-3"><div className="flex items-center gap-3"><IconBubble icon={FileText} tone="green" /><div><b className="text-sm">{artifact.name}</b><p className="mt-1 text-sm text-slate-500">{artifact.ticketCode} - {artifact.createdAt.slice(0, 10)}</p></div></div></div>)}</div>
          </Panel>
          <Panel title="Report insights">
            <div className="space-y-4 p-5">{vm.insightRows.map((row) => <div key={row.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"><span className="font-semibold">{row.label}</span><Badge tone={row.tone as Tone}>{row.value}</Badge></div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ReportBuilderScreen() {
  const vm = selectReportBuilderViewModel();
  return (
    <div>
      <SimpleHeader
        parityId="report-builder.header"
        title="Report Builder"
        subtitle="Tao report executive tu sources, sections, recipients va schedule co san."
        actions={<><Button variant="secondary"><Eye className="h-4 w-4" />Preview</Button><Button><CheckCircle2 className="h-4 w-4" />Schedule report</Button></>}
      />
      <div data-parity-id="report-builder.steps" className="mt-4 grid grid-cols-4 gap-4">
        {['Template', 'Sections', 'Recipients', 'Schedule'].map((step, index) => <div key={step} className={`rounded-xl border px-4 py-3 text-sm font-bold ${index === 1 ? 'border-[#0f6bff] bg-blue-50 text-[#0f6bff]' : 'border-slate-200 bg-white text-slate-600'}`}>{index + 1}. {step}</div>)}
      </div>
      <div data-parity-id="report-builder.main-grid" className="mt-5 grid grid-cols-[1fr_420px] gap-5">
        <div data-parity-id="report-builder.form-panel" className="space-y-5">
          <Panel title="Report templates">
            <div className="grid grid-cols-3 gap-4 p-5">{vm.templates.map((template) => <div key={template.id} className="rounded-xl border border-slate-100 p-4"><IconBubble icon={FileText} tone="blue" /><b className="mt-3 block">{template.title}</b><p className="mt-1 text-sm text-slate-500">{template.cadence} - {template.sections} sections</p><div className="mt-3 text-xs font-semibold text-slate-400">{template.owner}</div></div>)}</div>
          </Panel>
          <Panel title="Included sections">
            <div className="space-y-3 p-5">{vm.reportSections.map((section) => <div key={section.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"><div><b>{section.title}</b><p className="mt-1 text-sm text-slate-500">{section.source}</p></div><Badge tone={section.included ? 'green' : 'slate'}>{section.included ? 'Included' : 'Optional'}</Badge></div>)}</div>
          </Panel>
        </div>
        <div data-parity-id="report-builder.preview-panel" className="space-y-5">
          <Panel title="Live preview">
            <div className="space-y-4 p-5">
              <div className="rounded-2xl bg-blue-50 p-5"><b className="text-xl text-[#0f6bff]">{vm.preview.title}</b><p className="mt-2 text-sm leading-6 text-slate-600">{vm.workspace.name} - {vm.preview.agentCount} agents - {vm.preview.ticketCount} tickets - {vm.preview.cost} spend</p></div>
              {vm.recipients.map((email) => <FieldRow key={email} label="Recipient" value={email} />)}
            </div>
          </Panel>
          <Panel title="Output rules">
            <div className="space-y-3 p-5">{['Attach artifacts automatically', 'Include cost and risk appendix', 'Notify owner after delivery'].map((rule, index) => <div key={rule} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"><span className="font-semibold">{rule}</span><Badge tone={index === 1 ? 'purple' : 'green'}>On</Badge></div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function IntegrationsHubScreen() {
  const vm = selectIntegrationsHubViewModel();
  return (
    <div>
      <SimpleHeader
        parityId="integrations.header"
        title="Integrations Hub"
        subtitle="Quan ly ket noi, sync health va policy guardrail cho cac he thong ben ngoai."
        actions={<><Button variant="secondary"><Search className="h-4 w-4" />Search</Button><Button><Zap className="h-4 w-4" />Add integration</Button></>}
      />
      <MetricBand parityId="integrations.kpi-band" items={vm.kpis} />
      <div data-parity-id="integrations.main-grid" className="mt-4 grid grid-cols-[1fr_420px] gap-5">
        <div data-parity-id="integrations.list-panel" className="space-y-5">
          <Panel title="Connected systems">
            <div className="grid grid-cols-2 gap-4 p-5">
              {vm.integrationRows.map((integration) => <div key={integration.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-start justify-between gap-3"><IconBubble icon={integration.id === 'github' ? Code2 : integration.id === 'slack' ? MessageCircleQuestion : integration.id === 'notion' ? BookOpen : Layers3} tone={integration.tone as Tone} /><Badge tone={integration.tone as Tone}>{integration.status}</Badge></div><b className="mt-4 block text-lg">{integration.name}</b><p className="mt-1 text-sm text-slate-500">{integration.category}</p><div className="mt-4"><ProgressBar value={integration.health} tone={integration.tone as Tone} label={`${integration.name} sync health`} /></div><div className="mt-3 flex justify-between text-sm text-slate-500"><span>{integration.events} events</span><span>{integration.lastSync}</span></div></div>)}
            </div>
          </Panel>
        </div>
        <div data-parity-id="integrations.policy-panel" className="space-y-5">
          <Panel title="Integration policies">
            <div className="space-y-3 p-5">{vm.policyRows.map((policy) => <div key={policy.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"><span className="font-semibold">{policy.label}</span><Badge tone={policy.tone as Tone}>{policy.value}</Badge></div>)}</div>
          </Panel>
          <Panel title="Recent sync activity">
            <div className="divide-y divide-slate-100 p-4">{vm.activityRows.map((activity) => <div key={activity.id} className="py-3"><div className="flex items-center justify-between gap-3"><b className="text-sm">{activity.title}</b><Badge tone={activity.status === 'Failed' ? 'red' : 'green'}>{activity.status}</Badge></div><p className="mt-1 text-sm leading-6 text-slate-500">{activity.description}</p></div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function IntegrationDetailScreen() {
  const vm = selectIntegrationDetailViewModel();
  return (
    <div>
      <SimpleHeader
        parityId="integration-detail.header"
        title="Integration Detail"
        subtitle={`${vm.integration.name} - ${vm.integration.category} - owner ${vm.integration.owner}`}
        actions={<><Button variant="secondary"><Eye className="h-4 w-4" />View logs</Button><Button><Settings className="h-4 w-4" />Configure</Button></>}
      />
      <MetricBand parityId="integration-detail.kpi-band" items={vm.kpis} />
      <div data-parity-id="integration-detail.main-grid" className="mt-4 grid grid-cols-[1fr_420px] gap-5">
        <div data-parity-id="integration-detail.sync-panel" className="space-y-5">
          <Panel title="Sync runs">
            <div className="p-4">
              <div className="grid grid-cols-[1fr_160px_110px_100px_110px] gap-3 border-b border-slate-100 pb-3 text-xs font-bold uppercase text-slate-400"><span>Ticket</span><span>Agent</span><span>Status</span><span>Cost</span><span>Started</span></div>
              {vm.syncRuns.map((run) => <div key={run.id} className="grid grid-cols-[1fr_160px_110px_100px_110px] items-center gap-3 border-b border-slate-100 py-3 text-sm"><span>{run.title}</span><b>{run.agent}</b><Badge tone={run.status === 'Failed' ? 'red' : run.status === 'Running' ? 'blue' : 'green'}>{run.status}</Badge><span>{run.cost}</span><span className="text-slate-500">{run.startedAt}</span></div>)}
            </div>
          </Panel>
          <Panel title="Permission scopes">
            <div className="space-y-4 p-5">{vm.scopes.map((scope) => <div key={scope.id} className="rounded-xl border border-slate-100 p-4"><div className="mb-2 flex items-center justify-between"><b>{scope.label}</b><Badge tone={scope.tone as Tone}>{scope.status}</Badge></div><ProgressBar value={scope.coverage} tone={scope.tone as Tone} label={`${scope.label} coverage`} /></div>)}</div>
          </Panel>
        </div>
        <div data-parity-id="integration-detail.audit-panel" className="space-y-5">
          <Panel title="Connection health">
            <div className="space-y-4 p-5">
              <FieldRow label="Status" value={vm.integration.status} />
              <FieldRow label="Last sync" value={vm.integration.lastSync} />
              <FieldRow label="Risk" value={vm.integration.risk} />
            </div>
          </Panel>
          <Panel title="Audit activity">
            <div className="divide-y divide-slate-100 p-4">{vm.auditRows.map((row) => <div key={row.id} className="py-3"><b className="text-sm">{row.title}</b><p className="mt-1 text-sm text-slate-500">{row.createdAt} - {row.status}</p></div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function McpServerManagerScreen() {
  const vm = selectMcpServerManagerViewModel();
  return (
    <div>
      <SimpleHeader
        parityId="mcp.header"
        title="MCP Server Manager"
        subtitle="Theo doi MCP servers, tool inventory va guardrail cho runtime cua agent."
        actions={<><Button variant="secondary"><Code2 className="h-4 w-4" />View schema</Button><Button><Play className="h-4 w-4" />Test server</Button></>}
      />
      <MetricBand parityId="mcp.kpi-band" items={vm.kpis} />
      <div data-parity-id="mcp.main-grid" className="mt-4 grid grid-cols-[1fr_420px] gap-5">
        <div data-parity-id="mcp.server-panel" className="space-y-5">
          <Panel title="Server registry">
            <div className="grid grid-cols-2 gap-4 p-5">{vm.servers.map((server) => <div key={server.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-start justify-between"><IconBubble icon={Code2} tone={server.tone as Tone} /><Badge tone={server.tone as Tone}>{server.status}</Badge></div><b className="mt-4 block text-lg">{server.name}</b><p className="mt-1 text-sm text-slate-500">{server.environment}</p><div className="mt-4 grid grid-cols-2 gap-3"><FieldRow label="Latency" value={`${server.latency}ms`} /><FieldRow label="Tools" value={String(server.tools)} /></div></div>)}</div>
          </Panel>
        </div>
        <div data-parity-id="mcp.tool-panel" className="space-y-5">
          <Panel title="Tool inventory">
            <div className="divide-y divide-slate-100 p-4">{vm.toolRows.map((tool) => <div key={tool.id} className="py-3"><div className="flex items-center justify-between gap-3"><b className="text-sm">{tool.name}</b><Badge tone={tool.tone as Tone}>{tool.status}</Badge></div><p className="mt-1 text-sm text-slate-500">{tool.server} - {tool.agents} agents</p></div>)}</div>
          </Panel>
          <Panel title="Runtime policies">
            <div className="space-y-3 p-5">{vm.policyRows.map((policy) => <div key={policy.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"><span className="font-semibold">{policy.label}</span><Badge tone={policy.tone as Tone}>{policy.status}</Badge></div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function WorkspacesManagerScreen() {
  const vm = selectWorkspacesManagerViewModel();
  return (
    <div>
      <SimpleHeader
        parityId="workspaces.header"
        title="Workspaces Manager"
        subtitle="Quan ly workspace, members, plan limits va usage allocation cho AI workforce."
        actions={<><Button variant="secondary"><Users className="h-4 w-4" />Invite</Button><Button><Building2 className="h-4 w-4" />New workspace</Button></>}
      />
      <MetricBand parityId="workspaces.kpi-band" items={vm.kpis} />
      <div data-parity-id="workspaces.main-grid" className="mt-4 grid grid-cols-[1fr_420px] gap-5">
        <div data-parity-id="workspaces.list-panel" className="space-y-5">
          <Panel title="Workspace registry">
            <div className="space-y-4 p-5">{vm.workspaceRows.map((workspace) => <div key={workspace.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-start justify-between gap-3"><div><b className="text-lg">{workspace.name}</b><p className="mt-1 text-sm text-slate-500">{workspace.region} - owner {workspace.owner}</p></div><Badge tone={workspace.tone as Tone}>{workspace.status}</Badge></div><div className="mt-4 grid grid-cols-3 gap-3"><FieldRow label="Plan" value={workspace.plan} /><FieldRow label="Agents" value={String(workspace.agents)} /><FieldRow label="Budget" value={currencyDisplay(workspace.budget)} /></div></div>)}</div>
          </Panel>
        </div>
        <div data-parity-id="workspaces.member-panel" className="space-y-5">
          <Panel title="Members">
            <div className="divide-y divide-slate-100 p-4">{vm.members.map((member) => <div key={member.id} className="flex items-center justify-between py-3"><div><b>{member.name}</b><p className="mt-1 text-sm text-slate-500">{member.email}</p></div><Badge tone="blue">{member.role}</Badge></div>)}</div>
          </Panel>
          <Panel title="Agent usage">
            <div className="divide-y divide-slate-100 p-4">{vm.usageRows.map((row) => <div key={row.id} className="py-3"><div className="flex items-center justify-between"><b className="text-sm">{row.agent}</b><span className="font-bold text-[#0f6bff]">{row.cost}</span></div><p className="mt-1 text-sm text-slate-500">{row.tickets} tickets - {row.runs} runs - {row.workspace}</p></div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function SecretsManagerScreen() {
  const vm = selectSecretsManagerViewModel();
  return (
    <div>
      <SimpleHeader parityId="secrets.header" title="Secrets Manager" subtitle="Quan ly metadata secret, rotation policy va agent access ma khong hien thi secret that." actions={<><Button variant="secondary"><ShieldCheck className="h-4 w-4" />Audit access</Button><Button><Lock className="h-4 w-4" />Add secret</Button></>} />
      <MetricBand parityId="secrets.kpi-band" items={vm.kpis} />
      <div data-parity-id="secrets.main-grid" className="mt-4 grid grid-cols-[1fr_420px] gap-5">
        <div data-parity-id="secrets.vault-panel" className="space-y-5">
          <Panel title="Secret vault">
            <div className="p-4">
              <div className="grid grid-cols-[1fr_180px_140px_140px_110px] gap-3 border-b border-slate-100 pb-3 text-xs font-bold uppercase text-slate-400"><span>Name</span><span>Scope</span><span>Rotation</span><span>Access</span><span>Status</span></div>
              {vm.secretRows.map((row) => <div key={row.id} className="grid grid-cols-[1fr_180px_140px_140px_110px] items-center gap-3 border-b border-slate-100 py-3 text-sm"><div><b>{row.name}</b><p className="mt-1 text-xs text-slate-500">••••••••••••</p></div><span>{row.scope}</span><span>{row.rotation}</span><span>{row.access}</span><Badge tone={row.tone as Tone}>{row.status}</Badge></div>)}
            </div>
          </Panel>
          <Panel title="Agent secret access">
            <div className="grid grid-cols-2 gap-4 p-5">{vm.accessRows.map((row) => <div key={row.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between"><b>{row.agent}</b><Badge tone={row.risk === 'High' ? 'red' : row.risk === 'Medium' ? 'amber' : 'green'}>{row.risk}</Badge></div><p className="mt-2 text-sm text-slate-500">{row.tools} tools - {row.policy}</p></div>)}</div>
          </Panel>
        </div>
        <div data-parity-id="secrets.audit-panel" className="space-y-5">
          <Panel title="Rotation policy">
            <div className="space-y-3 p-5">{['Rotate production secrets every 90 days', 'Block plaintext display in UI', 'Require approval for secret scope changes', 'Log every secret access event'].map((item, index) => <div key={item} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"><span className="font-semibold">{item}</span><Badge tone={index === 1 ? 'red' : 'green'}>{index === 1 ? 'Blocked' : 'On'}</Badge></div>)}</div>
          </Panel>
          <Panel title="Audit activity">
            <div className="divide-y divide-slate-100 p-4">{vm.auditRows.map((row) => <div key={row.id} className="py-3"><div className="flex items-center justify-between"><b className="text-sm">{row.title}</b><Badge tone={row.status === 'Failed' ? 'red' : 'green'}>{row.status}</Badge></div><p className="mt-1 text-sm text-slate-500">{row.createdAt}</p></div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function TeamMembersScreen() {
  const vm = selectTeamMembersViewModel();
  return (
    <div>
      <SimpleHeader parityId="team.header" title="Team Members" subtitle="Quan ly thanh vien, role, ownership va invitation cho workspace." actions={<><Button variant="secondary"><Mail className="h-4 w-4" />Invite link</Button><Button><Users className="h-4 w-4" />Invite member</Button></>} />
      <MetricBand parityId="team.kpi-band" items={vm.kpis} />
      <div data-parity-id="team.main-grid" className="mt-4 grid grid-cols-[1fr_420px] gap-5">
        <div data-parity-id="team.member-panel" className="space-y-5">
          <Panel title="Members">
            <div className="space-y-4 p-5">{vm.members.map((member) => <div key={member.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between"><div><b className="text-lg">{member.name}</b><p className="mt-1 text-sm text-slate-500">{member.email}</p></div><Badge tone={member.role === 'owner' ? 'purple' : member.role === 'operator' ? 'blue' : 'amber'}>{member.role}</Badge></div><div className="mt-4 grid grid-cols-3 gap-3"><FieldRow label="Status" value={member.status} /><FieldRow label="Access" value={member.access} /><FieldRow label="Last seen" value={member.lastSeen} /></div></div>)}</div>
          </Panel>
        </div>
        <div data-parity-id="team.ownership-panel" className="space-y-5">
          <Panel title="Agent ownership">
            <div className="divide-y divide-slate-100 p-4">{vm.agentOwnership.map((row) => <div key={row.id} className="py-3"><div className="flex items-center justify-between"><b className="text-sm">{row.agent}</b><Badge tone="blue">{row.owner}</Badge></div><p className="mt-1 text-sm text-slate-500">{row.tickets} tickets - {row.runs} runs</p></div>)}</div>
          </Panel>
          <Panel title="Invitations">
            <div className="space-y-3 p-5">{vm.invites.map((invite) => <div key={invite.id} className="rounded-xl border border-slate-100 p-4"><b>{invite.email}</b><div className="mt-2 flex justify-between"><Badge tone="blue">{invite.role}</Badge><Badge tone={invite.status === 'Pending' ? 'amber' : 'slate'}>{invite.status}</Badge></div></div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function RolesPermissionsScreen() {
  const vm = selectRolesPermissionsViewModel();
  return (
    <div>
      <SimpleHeader parityId="roles.header" title="Role & Permission" subtitle="Thiet lap role, permission matrix va policy coverage cho team va agent." actions={<><Button variant="secondary"><Eye className="h-4 w-4" />Review matrix</Button><Button><ShieldCheck className="h-4 w-4" />New role</Button></>} />
      <MetricBand parityId="roles.kpi-band" items={vm.kpis} />
      <div data-parity-id="roles.main-grid" className="mt-4 grid grid-cols-[1fr_420px] gap-5">
        <div data-parity-id="roles.matrix-panel" className="space-y-5">
          <Panel title="Role matrix">
            <div className="grid grid-cols-3 gap-4 p-5">{vm.roles.map((role) => <div key={role.id} className="rounded-xl border border-slate-100 p-4"><IconBubble icon={ShieldCheck} tone={role.tone as Tone} /><b className="mt-4 block text-lg">{role.name}</b><p className="mt-1 min-h-[44px] text-sm leading-6 text-slate-500">{role.description}</p><div className="mt-4 flex justify-between text-sm text-slate-500"><span>{role.members} members</span><span>{role.permissions} permissions</span></div></div>)}</div>
          </Panel>
          <Panel title="Permission rules">
            <div className="p-4">
              <div className="grid grid-cols-[1fr_150px_160px_110px] gap-3 border-b border-slate-100 pb-3 text-xs font-bold uppercase text-slate-400"><span>Module</span><span>Owner</span><span>Status</span><span>Risk</span></div>
              {vm.permissionRows.map((row) => <div key={row.id} className="grid grid-cols-[1fr_150px_160px_110px] items-center gap-3 border-b border-slate-100 py-3 text-sm"><b>{row.module}</b><span>{row.owner}</span><Badge tone={row.tone as Tone}>{row.status}</Badge><span>{row.risk}</span></div>)}
            </div>
          </Panel>
        </div>
        <div data-parity-id="roles.coverage-panel">
          <Panel title="Policy coverage">
            <div className="space-y-4 p-5">{vm.policyCoverage.map((row) => <div key={row.id}><div className="mb-2 flex justify-between text-sm"><b>{row.label}</b><span>{row.value}%</span></div><ProgressBar value={row.value} tone={row.tone as Tone} label={`${row.label} policy coverage`} /></div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function SystemSettingsScreen() {
  const vm = selectSystemSettingsViewModel();
  return (
    <div>
      <SimpleHeader parityId="settings.header" title="System Settings" subtitle="Cau hinh workspace runtime, notification, audit retention va workflow safety." actions={<><Button variant="secondary"><Settings className="h-4 w-4" />Reset</Button><Button><Check className="h-4 w-4" />Save settings</Button></>} />
      <MetricBand parityId="settings.kpi-band" items={vm.kpis} />
      <div data-parity-id="settings.main-grid" className="mt-4 grid grid-cols-[1fr_420px] gap-5">
        <div data-parity-id="settings.config-panel">
          <Panel title="Workspace settings">
            <div className="space-y-4 p-5">{vm.settings.map((setting) => <div key={setting.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between"><div><b>{setting.label}</b><p className="mt-1 text-sm text-slate-500">{setting.value}</p></div><Badge tone={setting.tone as Tone}>{setting.status}</Badge></div></div>)}</div>
          </Panel>
        </div>
        <div data-parity-id="settings.notification-panel" className="space-y-5">
          <Panel title="Notification channels">
            <div className="space-y-3 p-5">{vm.notificationRows.map((row) => <div key={row.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between"><b>{row.label}</b><Badge tone={row.tone as Tone}>{row.status}</Badge></div><p className="mt-1 text-sm text-slate-500">{row.channel}</p></div>)}</div>
          </Panel>
          <Panel title="Workspace">
            <div className="space-y-3 p-5"><FieldRow label="Name" value={vm.workspace.name} /><FieldRow label="Plan" value={vm.workspace.plan} /><FieldRow label="Created" value={vm.workspace.createdAt.slice(0, 10)} /></div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function BillingPlanScreen() {
  const vm = selectBillingPlanViewModel();
  return (
    <div>
      <SimpleHeader parityId="billing.header" title="Billing / Plan" subtitle="Theo doi plan hien tai, usage, invoice va budget allocation cho workspace." actions={<><Button variant="secondary"><FileText className="h-4 w-4" />Download invoice</Button><Button><BarChart3 className="h-4 w-4" />Review usage</Button></>} />
      <MetricBand parityId="billing.kpi-band" items={vm.kpis} />
      <div data-parity-id="billing.main-grid" className="mt-4 grid grid-cols-[1fr_420px] gap-5">
        <div data-parity-id="billing.plan-panel" className="space-y-5">
          <Panel title="Plans">
            <div className="grid grid-cols-3 gap-4 p-5">{vm.planRows.map((plan) => <div key={plan.id} className="rounded-xl border border-slate-100 p-4"><Badge tone={plan.tone as Tone}>{plan.status}</Badge><b className="mt-4 block text-xl">{plan.name}</b><p className="mt-1 text-sm text-slate-500">{plan.agents}</p><div className="mt-4 text-2xl font-extrabold text-[#0f6bff]">{plan.price}</div></div>)}</div>
          </Panel>
          <Panel title="Usage allocation">
            <div className="space-y-4 p-5">{vm.usageRows.map((row) => <div key={row.id}><div className="mb-2 flex justify-between text-sm"><b>{row.label}</b><span>{currencyDisplay(row.value)}</span></div><ProgressBar value={row.percent} tone={row.tone as Tone} label={`${row.label} billing usage`} /></div>)}</div>
          </Panel>
        </div>
        <div data-parity-id="billing.invoice-panel">
          <Panel title="Invoices">
            <div className="divide-y divide-slate-100 p-4">{vm.invoiceRows.map((invoice) => <div key={invoice.id} className="flex items-center justify-between py-3"><div><b className="text-sm">{invoice.period}</b><p className="mt-1 text-sm text-slate-500">Due {invoice.due}</p></div><div className="text-right"><b>{invoice.amount}</b><div className="mt-1"><Badge tone="green">{invoice.status}</Badge></div></div></div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function HelpTemplateCenterScreen() {
  const vm = selectHelpTemplateCenterViewModel();
  return (
    <div>
      <SimpleHeader parityId="help.header" title="Help / Template Center" subtitle="Tim huong dan, template workflow va support channels cho AI Workforce OS." actions={<><Button variant="secondary"><Search className="h-4 w-4" />Search docs</Button><Button><HelpCircle className="h-4 w-4" />Contact support</Button></>} />
      <MetricBand parityId="help.kpi-band" items={vm.kpis} />
      <div data-parity-id="help.main-grid" className="mt-4 grid grid-cols-[1fr_420px] gap-5">
        <div data-parity-id="help.template-panel" className="space-y-5">
          <Panel title="Workflow templates">
            <div className="grid grid-cols-2 gap-4 p-5">{vm.templates.map((template) => <div key={template.id} className="rounded-xl border border-slate-100 p-4"><IconBubble icon={BookOpen} tone={template.tone as Tone} /><b className="mt-4 block text-lg">{template.title}</b><p className="mt-1 text-sm text-slate-500">{template.category} - {template.owner}</p><div className="mt-3"><Badge tone={template.tone as Tone}>{template.status}</Badge></div></div>)}</div>
          </Panel>
        </div>
        <div data-parity-id="help.support-panel" className="space-y-5">
          <Panel title="Help library">
            <div className="divide-y divide-slate-100 p-4">{vm.helpRows.map((row) => <div key={row.id} className="py-3"><div className="flex items-center justify-between"><b className="text-sm">{row.title}</b><Badge tone="blue">{row.kind}</Badge></div><p className="mt-1 text-sm text-slate-500">{row.time}</p></div>)}</div>
          </Panel>
          <Panel title="Support status">
            <div className="space-y-3 p-5">{vm.supportRows.map((row) => <div key={row.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"><span className="font-semibold">{row.label}</span><Badge tone={row.tone as Tone}>{row.value}</Badge></div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function currencyDisplay(value: number) {
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: value % 1 === 0 ? 0 : 2 })}`;
}

export function Sprint2Screen({ route }: { route: string }) {
  if (route === '/login') return <LoginOnboardingParityPage />;
  if (route === '/register') return <RegisterOnboardingParityPage />;
  if (route === '/onboarding/company') return <CompanyOnboardingParityPage />;
  if (route === '/onboarding/use-case') return <UseCaseOnboardingParityPage />;
  if (route === '/onboarding/ai-team') return <AiTeamOnboardingParityPage />;
  if (route === '/onboarding/hermes') return <HermesOnboardingParityPage />;
  if (route === '/onboarding/complete') return <CompleteOnboardingParityPage />;
  if (route === '/today') return <TodayScreen />;
  if (route === '/inbox') return <InboxScreen />;
  if (route === '/notifications') return <NotificationScreen />;
  if (route === '/company/overview') return <CompanyOverviewScreen />;
  if (route === '/company/settings') return <CompanySettingsScreen />;
  if (route === '/goals') return <GoalsDashboardScreen />;
  if (route === '/goals/demo-goal') return <GoalDetailScreen />;
  if (route === '/goals/new') return <CreateGoalScreen />;
  if (route === '/projects') return <ProjectsListScreen />;
  if (route === '/projects/demo-project') return <ProjectDetailScreen />;
  if (route === '/projects/new') return <CreateProjectScreen />;
  if (route === '/agents') return <AgentsListScreen />;
  if (route === '/agents/new') return <CreateAgentScreen />;
  if (route === '/agents/templates') return <AgentTemplatesScreen />;
  if (route === '/agents/performance') return <AgentPerformanceScreen />;
  if (route === '/agents/memory') return <AgentMemoryScreen />;
  if (route === '/skills') return <SkillsRegistryScreen />;
  if (route === '/tools/permissions') return <ToolsPermissionsScreen />;
  if (route === '/tickets/list') return <TicketsListScreen />;
  if (route === '/tickets/new') return <CreateTicketScreen />;
  if (route === '/artifacts') return <ArtifactsLibraryScreen />;
  if (route === '/artifacts/demo-artifact') return <ArtifactDetailScreen />;
  if (route === '/approvals/demo-approval') return <ApprovalDetailScreen />;
  if (route === '/governance/policies') return <GovernancePoliciesScreen />;
  if (route === '/audit-log') return <AuditLogScreen />;
  if (route === '/risk-center') return <RiskCenterScreen />;
  if (route === '/cost') return <CostDashboardScreen />;
  if (route === '/budget/settings') return <BudgetSettingsScreen />;
  if (route === '/reports') return <ReportsDashboardScreen />;
  if (route === '/reports/new') return <ReportBuilderScreen />;
  if (route === '/integrations') return <IntegrationsHubScreen />;
  if (route === '/integrations/demo-integration') return <IntegrationDetailScreen />;
  if (route === '/mcp') return <McpServerManagerScreen />;
  if (route === '/workspaces') return <WorkspacesManagerScreen />;
  if (route === '/secrets') return <SecretsManagerScreen />;
  if (route === '/team') return <TeamMembersScreen />;
  if (route === '/roles-permissions') return <RolesPermissionsScreen />;
  if (route === '/settings') return <SystemSettingsScreen />;
  if (route === '/billing') return <BillingPlanScreen />;
  if (route === '/help') return <HelpTemplateCenterScreen />;
  return null;
}
