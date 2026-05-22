import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Filter,
  Flag,
  GitBranch,
  Layers3,
  ListFilter,
  Network,
  Pause,
  Play,
  Plus,
  Send,
  ShieldCheck,
  Square,
  Target,
  Ticket,
  Timer,
  Users,
  Workflow,
  Wrench,
  X,
  DollarSign,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ActivityRow, AvatarBot, Badge, Button, CostDistributionChart, DashboardCard, DonutScore, KpiTile, LinkFooter, MetricCard, MoreButton, PageHeader, Panel, ProgressBar, RecommendationRow, RowAction } from '../components/ui/DemoPrimitives';
import type { Tone } from '../data/demoScreens';

type Kpi = {
  label: string;
  value: string;
  delta?: string;
  tone: Tone;
  icon: typeof Bot;
};

const dashboardKpis: Kpi[] = [
  { label: 'AI Agents hoạt động', value: '128', delta: '+12%', tone: 'cyan', icon: Bot },
  { label: 'Ticket đang mở', value: '36', delta: '-8%', tone: 'blue', icon: Ticket },
  { label: 'Phê duyệt chờ xử lý', value: '14', delta: '-12%', tone: 'purple', icon: ShieldCheck },
  { label: 'Chi phí AI tháng này', value: '$18,450.75', delta: '+8.5%', tone: 'blue', icon: DollarSign },
  { label: 'Tỷ lệ thành công', value: '93.6%', delta: '+4.1%', tone: 'green', icon: Flag },
  { label: 'Cảnh báo rủi ro', value: '7', delta: '+40%', tone: 'red', icon: AlertTriangle },
];

const workforceKpis: Kpi[] = [
  { label: 'Tổng Agent', value: '32', delta: '+14%', tone: 'purple', icon: Bot },
  { label: 'Đang hoạt động', value: '18', delta: '+8%', tone: 'green', icon: Play },
  { label: 'Đang rảnh', value: '9', delta: '-5%', tone: 'blue', icon: Clock3 },
  { label: 'Đang lỗi', value: '5', delta: '+2%', tone: 'red', icon: AlertTriangle },
  { label: 'Chi phí tháng này', value: '$2,840', delta: '+15.2%', tone: 'purple', icon: DollarSign },
  { label: 'Tỷ lệ thành công', value: '91.8%', delta: '+3.4%', tone: 'cyan', icon: Flag },
];

const ticketKpis: Kpi[] = [
  { label: 'Tổng ticket', value: '128', tone: 'blue', icon: Ticket },
  { label: 'Đang chạy', value: '14', tone: 'green', icon: Play },
  { label: 'Cần review', value: '9', tone: 'amber', icon: Clock3 },
  { label: 'Bị chặn', value: '6', tone: 'red', icon: X },
  { label: 'Failed', value: '3', tone: 'purple', icon: AlertTriangle },
  { label: 'Thời gian TB', value: '2h 18m', tone: 'cyan', icon: Timer },
];

const approvalKpis: Kpi[] = [
  { label: 'Chờ phê duyệt', value: '14', tone: 'blue', icon: Clock3 },
  { label: 'Rủi ro cao', value: '5', tone: 'red', icon: ShieldCheck },
  { label: 'Quá hạn', value: '3', tone: 'amber', icon: AlertTriangle },
  { label: 'Đã duyệt hôm nay', value: '18', tone: 'green', icon: CheckCircle2 },
  { label: 'Đã từ chối hôm nay', value: '4', tone: 'red', icon: X },
  { label: 'Thời gian duyệt TB', value: '12m', tone: 'blue', icon: Timer },
];

const agents = [
  { name: 'Hermes QA Agent', role: 'QA & UAT', status: 'Running', load: 76, score: 97.2, tone: 'purple' as Tone },
  { name: 'Research Agent', role: 'Research & Insight', status: 'Running', load: 66, score: 95.6, tone: 'cyan' as Tone },
  { name: 'Content Agent', role: 'Content Production', status: 'Busy', load: 89, score: 93.4, tone: 'purple' as Tone },
  { name: 'Report Agent', role: 'Reporting', status: 'Running', load: 57, score: 92.8, tone: 'blue' as Tone },
  { name: 'CRM Agent', role: 'CRM Automation', status: 'Waiting', load: 48, score: 91.1, tone: 'amber' as Tone },
  { name: 'Automation Agent', role: 'Workflow automation', status: 'Running', load: 61, score: 90.9, tone: 'cyan' as Tone },
  { name: 'Risk Monitor Agent', role: 'Budget alerts', status: 'Running', load: 41, score: 90.2, tone: 'green' as Tone },
  { name: 'Documentation Agent', role: 'Waiting for review', status: 'Idle', load: 24, score: 88.4, tone: 'slate' as Tone },
];

const tickets = [
  { title: 'SEO Topic Cluster Planning - Q2', project: 'GrowthOS V2', agent: 'Content Strategist', column: 'Backlog', priority: 'Trung bình', risk: 'Thấp', cost: '$0.15' },
  { title: 'Weekly Performance Report Automation', project: 'GrowthOS V2', agent: 'Data Analyst Agent', column: 'Ready', priority: 'Trung bình', risk: 'Thấp', cost: '$0.18' },
  { title: 'CRM Data Cleanup & Deduplication', project: 'CRM Automation Setup', agent: 'Automation Agent', column: 'Assigned', priority: 'Cao', risk: 'Trung bình', cost: '$0.22' },
  { title: 'Audit Module 3 - Landing & Lead Capture', project: 'GrowthOS V2', agent: 'Hermes QA Agent', column: 'Running', priority: 'Cao', risk: 'Trung bình', cost: '$0.80' },
  { title: 'Generate 10 TikTok Scripts', project: 'Marketing Content Factory', agent: 'Content Agent', column: 'Needs Review', priority: 'Trung bình', risk: 'Thấp', cost: '$0.12' },
  { title: 'Design System Components Library', project: 'GrowthOS V2', agent: 'Design Agent', column: 'Done', priority: 'Thấp', risk: 'Thấp', cost: '$0.07' },
  { title: 'Fix CRM Lead Source Mapping', project: 'CRM Automation Setup', agent: 'Automation Agent', column: 'Blocked', priority: 'Cao', risk: 'Cao', cost: '$0.20' },
  { title: 'Bulk Email Campaign Execution', project: 'Marketing Content Factory', agent: 'Email Agent', column: 'Failed', priority: 'Trung bình', risk: 'Trung bình', cost: '$0.11' },
];

const ticketColumns = ['Backlog', 'Ready', 'Assigned', 'Running', 'Needs Review', 'Done', 'Blocked', 'Failed'];

const runSteps = [
  ['Run started', 'Success', '09:42:13', '1s', '$0.000'],
  ['Loaded ticket context', 'Success', '09:42:14', '2s', '$0.000'],
  ['Loaded skill growthos-module-uat', 'Success', '09:42:16', '1s', '$0.000'],
  ['Read PROJECT_BIBLE.md', 'Success', '09:42:18', '3s', '$0.002'],
  ['Read module architecture', 'Success', '09:42:21', '4s', '$0.003'],
  ['Ran build', 'Success', '09:42:25', '1m 42s', '$0.018'],
  ['Analyzed routes', 'Warning', '09:44:07', '22s', '$0.006'],
  ['Generating QA report', 'Running', '09:44:29', '-', '-'],
];

const approvals = [
  { title: 'Hermes QA Agent xin chạy npm test', agent: 'Hermes QA Agent', project: 'GrowthOS V2', ticket: 'Audit Module 3 - Landing & Lead Capture', risk: 'Medium', impact: 'Local workspace', requested: '8 phút trước', tone: 'blue' as Tone },
  { title: 'Automation Agent muốn sửa lead-source-mapping.ts', agent: 'Automation Agent', project: 'CRM Automation Setup', ticket: 'Mapping nguồn lead', risk: 'High', impact: 'Source code', requested: '18 phút trước', tone: 'purple' as Tone },
  { title: 'CRM Agent muốn gửi email nurturing cho 120 leads', agent: 'CRM Agent', project: 'CRM Nurturing', ticket: 'Email campaign', risk: 'High', impact: 'Customer communication', requested: '32 phút trước', tone: 'amber' as Tone },
  { title: 'Research Agent đề xuất tăng budget thêm $30', agent: 'Research Agent', project: 'Market Research', ticket: 'Budget optimization', risk: 'Medium', impact: 'AI spend', requested: '1 giờ trước', tone: 'green' as Tone },
  { title: 'Data Agent muốn ghi dữ liệu vào production DB', agent: 'Data Agent', project: 'Analytics Pipeline', ticket: 'Database write', risk: 'High', impact: 'Production database', requested: '2 giờ trước', tone: 'cyan' as Tone },
];

const toolCalls: [string, string, string, string, string, LucideIcon][] = [
  ['Read File', 'PROJECT_BIBLE.md', 'Success', '3s', '$0.002', FileText],
  ['Read File', 'module-3-architecture.md', 'Success', '4s', '$0.003', FileText],
  ['Run Build', 'npm run build', 'Success', '1m 42s', '$0.018', GitBranch],
  ['Analyze Route', '/module-3/leads', 'Warning', '22s', '$0.006', Wrench],
  ['Generate Artifact', 'QA_Report_Module3.md', 'Running', '-', '-', FileText],
];

function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">{children}</div>;
}

function statusTone(value: string): Tone {
  if (value === 'Low') return 'green';
  if (value === 'Medium') return 'amber';
  if (value === 'High') return 'red';
  if (['Success', 'Running', 'Active', 'Thấp'].includes(value)) return 'green';
  if (['Warning', 'Medium', 'Trung bình', 'Waiting'].includes(value)) return 'amber';
  if (['Failed', 'High', 'Cao', 'Blocked'].includes(value)) return 'red';
  if (value === 'Busy') return 'purple';
  return 'blue';
}

function kpiGrid(items: Kpi[], compact = false) {
  return <StatGrid>{items.map((kpi) => <KpiTile key={kpi.label} {...kpi} compact={compact} />)}</StatGrid>;
}

function MetricRows({ rows }: { rows: [string, number][] }) {
  return (
    <div className="space-y-3">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[135px_1fr_48px] items-center gap-3">
          <div className="text-sm font-medium text-slate-600">{label}</div>
          <ProgressBar value={value} />
          <div className="text-right text-sm font-semibold text-slate-700">{value}%</div>
        </div>
      ))}
    </div>
  );
}

function CommandMetricRows({ rows }: { rows: [string, number][] }) {
  return (
    <div className="space-y-[16px] pt-1">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[118px_1fr_50px] items-center gap-3">
          <div className="text-[13px] font-medium text-slate-600">{label}</div>
          <ProgressBar value={value} />
          <div className="text-right text-[13px] font-semibold text-slate-700">{value}/100</div>
        </div>
      ))}
    </div>
  );
}

function CommandHealthDonut() {
  const size = 184;
  const radius = 76;
  const stroke = 16;
  const circumference = 2 * Math.PI * radius;
  const blueArc = circumference * 0.33;
  const cyanArc = circumference * 0.47;

  return (
    <div className="relative grid h-[184px] w-[184px] place-items-center">
      <svg className="absolute inset-0 -rotate-[132deg]" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e7eef7" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#126bff" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${blueArc} ${circumference}`} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#18c4d6" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${cyanArc} ${circumference}`} strokeDashoffset={-(blueArc + 20)} />
      </svg>
      <div className="relative text-center">
        <div className="text-[42px] font-bold leading-none text-slate-950">92<span className="text-[24px] font-semibold text-slate-500">/100</span></div>
        <div className="mt-2 text-[15px] font-bold text-emerald-600">Tốt</div>
        <div className="mt-2 text-[10px] font-semibold text-slate-500">+6 điểm so với tuần trước</div>
      </div>
    </div>
  );
}

function ActivityList() {
  const items = [
    ['Hermes QA Agent', 'Hoàn tất audit Module 3', '2 phút trước', 'Thành công'],
    ['Research Agent', 'Hoàn tất báo cáo đối thủ', '18 phút trước', 'Thành công'],
    ['Content Agent', 'Tạo 10 kịch bản video', '45 phút trước', 'Đang xử lý'],
    ['Report Agent', 'Tạo báo cáo tuần', '1 giờ trước', 'Thành công'],
  ];
  return (
    <div className="space-y-4 p-4">
      {items.map(([agent, action, time, status], index) => (
        <div key={agent} className="flex items-center gap-3">
          <AvatarBot tone={index === 2 ? 'purple' : 'cyan'} label="AI" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-slate-700"><span className="font-bold text-slate-950">{agent}</span>: {action}</div>
            <div className="mt-1 text-xs text-slate-500">{time}</div>
          </div>
          <Badge tone={status === 'Đang xử lý' ? 'blue' : 'green'}>{status}</Badge>
        </div>
      ))}
    </div>
  );
}

function CommandCenterHeader() {
  return <PageHeader title="Command Center" subtitle="Tổng quan vận hành đội ngũ AI cho doanh nghiệp" contentParityId="command.header" />;
}

function CommandKpiBand() {
  return <StatGrid>{dashboardKpis.map((kpi) => <MetricCard key={kpi.label} label={kpi.label} value={kpi.value} trend={kpi.delta} tone={kpi.tone} icon={kpi.icon} />)}</StatGrid>;
}

function WorkforceHealthCard() {
  return (
    <DashboardCard title="AI Workforce Health" className="h-[324px] overflow-hidden">
      <div className="grid grid-cols-[194px_1fr] gap-5 px-5 py-[22px]">
        <CommandHealthDonut />
        <CommandMetricRows rows={[['Hiệu suất', 90], ['Độ tin cậy', 94], ['Chất lượng đầu ra', 93], ['Tối ưu chi phí', 88], ['Tuân thủ chính sách', 92]]} />
      </div>
      <div className="mx-5 mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-medium text-brand-700">Hệ thống đang vận hành tốt. Duy trì tối ưu để đạt hiệu suất xuất sắc.</div>
    </DashboardCard>
  );
}

function StrategicGoalsCard() {
  return (
    <DashboardCard title="Tiến độ mục tiêu chiến lược" className="h-[324px] overflow-hidden" action={<MoreButton />}>
      <div className="space-y-5 p-4">
        {[
          ['Tăng lead marketing 30% trong Q2', 72],
          ['Tự động hóa 60% quy trình content', 65],
          ['Giảm 20% thời gian báo cáo thủ công', 84],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium text-slate-700">{label}</span><span className="font-bold text-brand-600">{value}%</span></div>
            <ProgressBar value={Number(value)} />
            <div className="mt-2 text-xs text-slate-500">Mục tiêu: +30% · Hạn: 30/06/2024</div>
          </div>
        ))}
      </div>
      <LinkFooter>Xem tất cả mục tiêu</LinkFooter>
    </DashboardCard>
  );
}

function RecentActivityCard() {
  const items = [
    ['Hermes QA Agent', 'Hoàn tất audit Module 3', '2 phút trước', 'Thành công'],
    ['Research Agent', 'Hoàn tất báo cáo đối thủ', '18 phút trước', 'Thành công'],
    ['Content Agent', 'Tạo 10 kịch bản video', '45 phút trước', 'Đang xử lý'],
    ['Report Agent', 'Tạo báo cáo tuần', '1 giờ trước', 'Thành công'],
  ];
  return (
    <DashboardCard title="Hoạt động gần đây" className="h-[324px] overflow-hidden" action={<button className="text-sm font-semibold text-brand-600">Xem tất cả</button>}>
      <div className="space-y-4 p-4">
        {items.map(([agent, action, time, status], index) => (
          <ActivityRow
            key={agent}
            avatar={<AvatarBot tone={index === 2 ? 'purple' : 'cyan'} label="AI" />}
            title={<><span className="font-bold text-slate-950">{agent}</span>: {action}</>}
            time={time}
            status={status}
            statusTone={status === 'Đang xử lý' ? 'blue' : 'green'}
          />
        ))}
      </div>
    </DashboardCard>
  );
}

function NextActionsCard() {
  const rows = [
    { icon: CheckCircle2, tone: 'green' as Tone, title: 'Duyệt 3 approval đang chờ', description: '3 approval cần bạn xem xét và phê duyệt', badge: '3' },
    { icon: AlertTriangle, tone: 'red' as Tone, title: 'Review 2 ticket failed', description: '2 ticket cần được kiểm tra và xử lý', badge: '2' },
    { icon: DollarSign, tone: 'blue' as Tone, title: 'Tối ưu budget cho Research Agent', description: 'Chi phí tháng này cao hơn 15% so với dự kiến' },
    { icon: Target, tone: 'purple' as Tone, title: 'Tạo goal mới cho chiến dịch tháng tới', description: 'Đặt mục tiêu và KPI cho chiến dịch mới' },
  ];
  return (
    <DashboardCard title="Gợi ý hành động tiếp theo">
      <div className="divide-y divide-slate-100 p-3">
        {rows.map((row) => <RecommendationRow key={row.title} {...row} />)}
      </div>
    </DashboardCard>
  );
}

function AlertsCard() {
  return (
    <DashboardCard title="Cảnh báo cần chú ý">
      <ActionRows warning items={['Chi phí AI có thể vượt ngân sách', '2 agent có tỷ lệ lỗi tăng cao', '3 approval quá hạn', '1 integration mất kết nối']} />
    </DashboardCard>
  );
}

function CostDistributionCard() {
  return (
    <DashboardCard title="Phân bổ chi phí AI theo agent" className="h-[269px] overflow-hidden">
      <CostDistributionChart
        total="$18,450.75"
        rows={[
          { label: 'Research Agent', value: '$5,420', percent: '29', color: '#0052cc' },
          { label: 'Content Agent', value: '$4,315', percent: '24', color: '#4f7dff' },
          { label: 'QA Agent', value: '$3,210', percent: '17', color: '#67a3ff' },
          { label: 'Report Agent', value: '$2,845', percent: '16', color: '#00bcd4' },
          { label: 'Khác', value: '$2,658', percent: '14', color: '#d7dee9' },
        ]}
      />
    </DashboardCard>
  );
}

function CommandCenter() {
  return (
    <div>
      <CommandCenterHeader />
      <div data-parity-id="command.kpi-band">
        <CommandKpiBand />
      </div>
      <div data-parity-id="command.main-grid" className="mt-4 grid grid-cols-[1.18fr_.95fr_1.18fr] gap-4">
        <div data-parity-id="command.main-left" className="space-y-4">
          <div data-parity-id="command.health-card">
            <WorkforceHealthCard />
          </div>
          <div data-parity-id="command.actions-card">
            <NextActionsCard />
          </div>
        </div>
        <div className="space-y-4">
          <div data-parity-id="command.goals-card">
            <StrategicGoalsCard />
          </div>
          <div data-parity-id="command.alerts-card">
            <AlertsCard />
          </div>
        </div>
        <div data-parity-id="command.main-right" className="space-y-4">
          <div data-parity-id="command.activity-card">
            <RecentActivityCard />
          </div>
          <div data-parity-id="command.cost-card">
            <CostDistributionCard />
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionRows({ items, warning = false }: { items: string[]; warning?: boolean }) {
  return (
    <div className="divide-y divide-slate-100 p-3">
      {items.map((title, index) => (
        <div key={title} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
          <div className={`grid h-8 w-8 place-items-center rounded-lg ${warning ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-brand-600'}`}>
            {warning ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-950">{title}</div>
            <div className="text-xs text-slate-500">{warning ? 'Cần kiểm tra và xử lý theo chính sách.' : 'Đề xuất ưu tiên trong ngày.'}</div>
          </div>
          {index < 2 ? <Badge tone={warning ? 'amber' : 'blue'}>{index + 2}</Badge> : null}
          <RowAction />
        </div>
      ))}
    </div>
  );
}

function CostDonut() {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-4 p-5">
      <div className="grid h-40 w-40 place-items-center rounded-full" style={{ background: 'conic-gradient(#0052cc 0 29%, #4f7dff 29% 53%, #67a3ff 53% 70%, #00bcd4 70% 86%, #d7dee9 86% 100%)' }}>
        <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center">
          <div><div className="text-xl font-bold">$18,450.75</div><div className="text-xs text-slate-500">Tổng chi phí</div></div>
        </div>
      </div>
      <div className="space-y-3">
        {['Research Agent', 'Content Agent', 'QA Agent', 'Report Agent', 'Khác'].map((item, index) => (
          <div key={item} className="flex items-center justify-between text-sm"><span className="text-slate-600">{item}</span><span className="font-semibold text-slate-950">${[5420, 4315, 3210, 2845, 2658][index].toLocaleString()}</span></div>
        ))}
      </div>
    </div>
  );
}

function WorkforceOverviewRealPage() {
  return (
    <div>
      <div data-parity-id="workforce.header">
        <PageHeader title="AI Workforce" subtitle="Quản lý đội ngũ AI Agent như một phòng ban thực thụ" icon={Users} actions={<><Button variant="secondary"><Network className="h-4 w-4" />Xem Org Chart</Button><Button variant="secondary"><Layers3 className="h-4 w-4" />Agent Templates</Button><Button><Plus className="h-4 w-4" />Tạo Agent mới</Button></>} />
      </div>
      <div data-parity-id="workforce.kpi-band">{kpiGrid(workforceKpis)}</div>
      <div data-parity-id="workforce.main-grid" className="mt-5 grid grid-cols-[2fr_1fr] gap-5">
        <div data-parity-id="workforce.left-panel" className="grid grid-cols-2 gap-5">
          <div data-parity-id="workforce.health-card"><Panel title="Sức khỏe đội AI" className="h-[304px] overflow-hidden"><div className="grid grid-cols-[180px_1fr] gap-5 p-5"><DonutScore value={89} size="md" /><MetricRows rows={[['Agent Availability', 92], ['Task Completion', 90], ['Output Quality', 87], ['Budget Efficiency', 84], ['Policy Compliance', 93], ['Workload Balance', 86]]} /></div><div className="px-5 pb-5 text-sm font-semibold text-emerald-600">Ổn định, cần tối ưu nhẹ</div></Panel></div>
          <div data-parity-id="workforce.agent-status-card"><Panel title="Phân bổ trạng thái agent" className="h-[304px] overflow-hidden"><StatusDistribution /></Panel></div>
          <div data-parity-id="workforce.workload-card"><Panel title="Phân bổ khối lượng công việc" className="h-[258px] overflow-hidden"><WorkloadRows /></Panel></div>
          <div data-parity-id="workforce.cost-card"><Panel title="Chi phí theo Agent" className="h-[258px] overflow-hidden"><AgentCostRows /></Panel></div>
        </div>
        <div data-parity-id="workforce.right-panel" className="grid gap-5">
          <div data-parity-id="workforce.top-agents-card"><Panel title="Agent hiệu quả nhất" className="h-[304px] overflow-hidden"><TopAgents /></Panel></div>
          <div data-parity-id="workforce.recommendations-card"><Panel title="Gợi ý tối ưu đội AI" className="h-[258px] overflow-hidden"><ActionRows items={['Nên thêm QA Agent cho GrowthOS V2', 'Content Agent đang xử lý quá nhiều task', 'Research Agent có chi phí tăng 28%', '3 agent idle trong 10 ngày']} /></Panel></div>
        </div>
      </div>
    </div>
  );
}

function StatusDistribution() {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-5 p-5">
      <div className="grid h-40 w-40 place-items-center rounded-full" style={{ background: 'conic-gradient(#22c55e 0 56%, #0052cc 56% 84%, #f59e0b 84% 93%, #ef4444 93% 100%)' }}>
        <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center"><div><div className="text-3xl font-bold">32</div><div className="text-xs text-slate-500">Tổng</div></div></div>
      </div>
      <div className="space-y-3">
        {['Active 18 56.3%', 'Idle 9 28.1%', 'Waiting 3 9.4%', 'Failed 2 6.3%', 'Paused 0 0%'].map((row) => <div key={row} className="text-sm font-medium text-slate-700">{row}</div>)}
      </div>
    </div>
  );
}

function TopAgents() {
  return <div className="space-y-4 p-5">{agents.slice(0, 5).map((agent, index) => <div key={agent.name} className="grid grid-cols-[24px_40px_1fr_72px] items-center gap-3 text-sm"><span className="text-slate-500">{index + 1}</span><AvatarBot tone={agent.tone} label="AI" /><span className="font-semibold text-slate-800">{agent.name}</span><span className="font-bold">{agent.score}%</span></div>)}</div>;
}

function WorkloadRows() {
  return <div className="space-y-4 p-5">{[['Product & Coding', 36], ['Marketing & Content', 28], ['Sales & CRM', 16], ['Research', 12], ['Operations', 8]].map(([label, value]) => <div key={String(label)}><div className="mb-2 flex justify-between text-sm"><span className="font-medium">{label}</span><b>{value}%</b></div><ProgressBar value={Number(value)} /></div>)}</div>;
}

function AgentCostRows() {
  return <div className="space-y-4 p-5">{agents.slice(0, 5).map((agent, index) => <div key={agent.name} className="grid grid-cols-[40px_1fr_48px] items-center gap-3 text-sm"><AvatarBot tone={agent.tone} label="AI" /><span className="font-semibold">{agent.name}</span><b>${[420, 360, 310, 280, 190][index]}</b></div>)}</div>;
}

function OrgCard({ agent, compact = false }: { agent: typeof agents[number]; compact?: boolean }) {
  return (
    <div className={`rounded-xl border bg-white p-3 shadow-[0_8px_18px_rgba(15,23,42,0.05)] ${agent.name === 'Hermes QA Agent' ? 'border-brand-500 ring-2 ring-blue-100' : 'border-slate-200'} ${compact ? 'w-[238px]' : 'w-[260px]'}`}>
      <div className="flex items-start gap-3">
        <AvatarBot tone={agent.tone} label="AI" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between"><div className="truncate font-bold text-slate-950">{agent.name}</div><Badge tone={statusTone(agent.status)}>{agent.status}</Badge></div>
          <div className="mt-1 text-sm text-slate-500">{agent.role}</div>
          <div className="mt-1 text-sm text-slate-600">{agent.name === 'Hermes QA Agent' ? 'Audit Module 3' : 'GrowthOS V2'}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-[38px_1fr_52px] items-center gap-2 text-sm"><span>{agent.load}%</span><ProgressBar value={agent.load} /><span className="font-semibold text-emerald-600">{agent.score}%</span></div>
    </div>
  );
}

function OrgChart() {
  return (
    <div>
      <PageHeader title="Org Chart" subtitle="Sơ đồ tổ chức đội ngũ AI Agent theo vai trò, cấp bậc và trách nhiệm" actions={<><Button variant="secondary"><Layers3 className="h-4 w-4" />Dùng template</Button><Button variant="secondary"><Workflow className="h-4 w-4" />Tùy chỉnh cấu trúc</Button><Button><Plus className="h-4 w-4" />Thêm Agent</Button></>} />
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="mb-3 flex flex-wrap gap-2 border-b border-slate-100 pb-3">{['Phóng to', 'Thu nhỏ', 'Vừa màn hình', 'Mở rộng tất cả', 'Thu gọn tất cả', 'Hiển thị tải', 'Hiển thị chi phí'].map((item) => <button key={item} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">{item}</button>)}</div>
        <div className="grid grid-cols-[1fr_280px] gap-4">
          <div className="relative min-h-[680px] overflow-hidden rounded-xl border border-slate-100 bg-[radial-gradient(circle_at_1px_1px,#dbe4ef_1px,transparent_0)] [background-size:18px_18px] p-8">
            <div className="mx-auto flex w-fit flex-col items-center gap-8">
              <OrgCard agent={{ ...agents[0], name: 'CEO Agent', role: 'Chief Strategy', load: 62, score: 95.4 }} />
              <div className="h-px w-[820px] bg-slate-300" />
              <div className="grid grid-cols-4 gap-8">{['CTO Agent', 'CMO Agent', 'Sales Director Agent', 'COO Agent'].map((name, index) => <OrgCard key={name} agent={{ ...agents[index], name, load: [74, 82, 68, 59][index], score: [93.8, 92.1, 90.7, 91.5][index] }} compact />)}</div>
              <div className="grid grid-cols-4 gap-8">{[0, 1, 2, 3].map((col) => <div key={col} className="space-y-4">{agents.slice(col * 2, col * 2 + 3).map((agent) => <OrgCard key={`${col}-${agent.name}`} agent={agent} compact />)}</div>)}</div>
            </div>
          </div>
          <Panel><div className="p-4"><div className="mb-4 flex items-center gap-3"><AvatarBot tone="purple" label="AI" /><div><div className="font-bold">Hermes QA Agent</div><div className="text-sm text-slate-500">QA & UAT</div></div></div><MetricRows rows={[['Tải công việc', 76], ['Hiệu suất', 97], ['Tin cậy', 94]]} /><div className="mt-4 grid gap-2"><Button>View Agent Detail</Button><Button variant="secondary">Assign Task</Button><Button variant="secondary">Pause Agent</Button></div></div></Panel>
        </div>
      </div>
    </div>
  );
}

function AgentDetail() {
  return (
    <div>
      <PageHeader dense title="Agent Detail" subtitle="Hồ sơ năng lực, công việc, kỹ năng, công cụ và hiệu suất của AI Agent" />
      <Panel className="mb-3"><div className="flex items-center justify-between p-4"><div className="flex items-center gap-5"><div className="grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 text-4xl">🤖</div><div><div className="flex items-center gap-3"><h2 className="text-2xl font-bold">Hermes QA Agent</h2><Badge tone="green">Running</Badge></div><p className="mt-2 text-slate-500">QA & UAT Specialist</p><div className="mt-3 flex gap-2"><Badge tone="blue">hermes_local</Badge><Badge tone="green">QA module</Badge></div></div></div><div className="grid grid-cols-2 gap-3"><Button><Bot className="h-4 w-4" />Assign Task</Button><Button variant="secondary">Edit Agent</Button><Button variant="warning">Pause Agent</Button><Button variant="secondary">View Runs</Button></div></div></Panel>
      {kpiGrid([{ label: 'Performance Score', value: '97.2%', tone: 'blue', icon: ShieldCheck }, { label: 'Tasks Completed', value: '86', tone: 'green', icon: CheckCircle2 }, { label: 'Success Rate', value: '94.8%', tone: 'green', icon: Flag }, { label: 'Monthly Cost', value: '$420', tone: 'purple', icon: DollarSign }, { label: 'Avg Run Time', value: '6m 42s', tone: 'blue', icon: Clock3 }, { label: 'Risk Events', value: '2', tone: 'amber', icon: AlertTriangle }], true)}
      <div className="mt-4 grid grid-cols-[1fr_390px] gap-4">
        <div className="space-y-4"><AgentMainPanels /><Panel title="Hiệu suất theo thời gian"><LineChart /></Panel></div>
        <AgentSidePanels />
      </div>
    </div>
  );
}

function AgentMainPanels() {
  return <div className="grid grid-cols-2 gap-4"><Panel><div className="p-5"><Badge tone="blue">1</Badge><h3 className="mt-3 font-bold">Nhiệm vụ chính</h3><p className="mt-2 text-sm leading-6 text-slate-600">Kiểm thử, audit, UAT và đánh giá chất lượng module trước khi chuyển sang trạng thái hoàn thành.</p></div></Panel><Panel><div className="p-5"><Badge tone="blue">2</Badge><h3 className="mt-3 font-bold">Công việc hiện tại</h3><div className="mt-3 space-y-2 text-sm"><div className="flex justify-between"><span>Ticket</span><b className="text-brand-600">Audit Module 3</b></div><div className="flex justify-between"><span>Status</span><Badge tone="green">Running</Badge></div><ProgressBar value={68} /></div></div></Panel><Panel><div className="p-5"><Badge tone="blue">3</Badge><h3 className="mt-3 font-bold">Kỹ năng đã cài</h3><div className="mt-4 flex flex-wrap gap-2">{['growthos-module-uat', 'ui-parity-audit', 'worktree-clean-check'].map((skill) => <Badge key={skill} tone="blue">{skill}</Badge>)}</div></div></Panel><Panel><div className="p-5"><Badge tone="blue">4</Badge><h3 className="mt-3 font-bold">Công cụ được phép sử dụng</h3><div className="mt-4 grid grid-cols-2 gap-3 text-sm">{['File', 'Browser', 'Terminal', 'Web'].map((tool, index) => <div key={tool} className="flex justify-between rounded-lg border border-slate-100 p-3"><span>{tool}</span><Badge tone={index > 1 ? 'amber' : 'green'}>{index > 1 ? 'Requires Approval' : 'Allowed'}</Badge></div>)}</div></div></Panel></div>;
}

function AgentSidePanels() {
  return <div className="space-y-4"><Panel title="Kiểm soát Agent"><div className="space-y-3 p-4 text-sm">{[['Status', 'Running'], ['Current workload', '76%'], ['Monthly budget', '$600'], ['Budget used', '$420 (70%)'], ['Model / Provider', 'OpenRouter / Claude Sonnet'], ['Last active', '2 phút trước']].map(([a, b]) => <div key={a} className="flex justify-between"><span className="text-slate-500">{a}</span><b>{b}</b></div>)}<ProgressBar value={76} /></div></Panel><Panel title="Chính sách phê duyệt"><div className="divide-y divide-slate-100 p-4 text-sm">{['Terminal command', 'File write', 'MCP access', 'Secret access'].map((item, index) => <div key={item} className="flex justify-between py-3"><span>{item}</span><Badge tone={index === 3 ? 'red' : 'amber'}>{index === 3 ? 'Blocked' : 'Requires approval'}</Badge></div>)}</div></Panel><Panel title="Rủi ro"><div className="space-y-3 p-4 text-sm"><div className="flex justify-between"><span>Risk level</span><Badge tone="amber">Medium</Badge></div><div className="flex justify-between"><span>Policy violations</span><b>0</b></div><div className="flex justify-between"><span>Pending approvals</span><b>1</b></div></div></Panel></div>;
}

function LineChart() {
  return <div className="p-5"><svg viewBox="0 0 760 150" className="h-40 w-full"><path d="M20 110 C120 70 180 80 260 62 S400 85 480 58 620 86 740 54" fill="none" stroke="#0052cc" strokeWidth="4" /><path d="M20 120 C130 92 210 125 300 98 S450 122 540 94 650 120 740 88" fill="none" stroke="#00bcd4" strokeWidth="4" /><path d="M20 136 C150 128 220 132 300 118 S460 130 540 116 650 132 740 112" fill="none" stroke="#7c3aed" strokeWidth="4" /></svg></div>;
}

function ticketColumnParityId(column: string) {
  const ids: Record<string, string> = {
    Backlog: 'tickets.column.todo',
    Ready: 'tickets.column.ready',
    Assigned: 'tickets.column.assigned',
    Running: 'tickets.column.in-progress',
    'Needs Review': 'tickets.column.review',
    Done: 'tickets.column.done',
    Blocked: 'tickets.column.blocked',
    Failed: 'tickets.column.failed',
  };
  return ids[column];
}

function TicketsBoardRealPage() {
  return (
    <div>
      <div data-parity-id="tickets.header">
        <PageHeader title="Tickets Board" subtitle="Theo dõi toàn bộ công việc đang được giao, thực thi, review và hoàn thành bởi đội AI" actions={<><Button variant="secondary">Import Tickets</Button><Button variant="secondary">Export Board</Button><Button><Plus className="h-4 w-4" />Tạo ticket mới</Button></>} />
      </div>
      <div data-parity-id="tickets.kpi-band">{kpiGrid(ticketKpis)}</div>
      <div data-parity-id="tickets.filters" className="mt-5 flex items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{['Project', 'Goal', 'Agent', 'Status', 'Priority', 'Risk', 'Due date'].map((filter) => <button key={filter} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600">{filter}</button>)}</div><div className="flex rounded-lg border border-slate-200 bg-white p-1"><button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Board</button><button className="px-4 py-2 text-sm font-semibold text-slate-500">List</button><button className="px-4 py-2 text-sm font-semibold text-slate-500">Calendar</button></div></div>
      <div data-parity-id="tickets.board" className="mt-5 grid grid-cols-[1fr_250px] gap-4"><div className="grid grid-cols-8 gap-3 overflow-hidden">{ticketColumns.map((column) => <KanbanColumn key={column} column={column} />)}</div><div data-parity-id="tickets.insights"><Panel title="Gợi ý từ AI"><ActionRows items={['6 ticket đang bị blocked vì chờ approval', '3 ticket failed do workspace permission', 'Hermes QA Agent đang xử lý quá nhiều ticket', 'Nên review 4 ticket trước 17:00']} /></Panel></div></div>
    </div>
  );
}

function KanbanColumn({ column }: { column: string }) {
  const items = tickets.filter((ticket) => ticket.column === column);
  return <div data-parity-id={ticketColumnParityId(column)} className="min-h-[560px] rounded-xl border border-slate-200 bg-white p-2 shadow-[0_8px_20px_rgba(15,23,42,0.03)]"><div className="mb-3 flex items-center justify-between px-1"><div className="text-sm font-bold text-slate-950">{column} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{items.length || 3}</span></div><MoreButton /></div><div className="space-y-3">{items.map((ticket, index) => <div key={ticket.title} data-parity-id={index < 3 ? `tickets.card.${index + 1}` : undefined} className={`rounded-lg border p-3 text-xs ${column === 'Running' ? 'border-emerald-300 bg-emerald-50/40' : column === 'Blocked' ? 'border-red-200 bg-red-50/50' : column === 'Needs Review' ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'}`}><h3 className="text-sm font-bold leading-5 text-slate-950">{ticket.title}</h3><div className="mt-2 space-y-1 text-slate-500"><div>Project: {ticket.project}</div><div>Agent: {ticket.agent}</div></div><div className="mt-3 flex flex-wrap gap-2"><Badge tone={statusTone(ticket.priority)}>{ticket.priority}</Badge><Badge tone={statusTone(ticket.risk)}>{ticket.risk}</Badge></div><div className="mt-3 flex items-center justify-between text-slate-500"><span>Due: Hôm nay</span><span>{ticket.cost}</span></div></div>)}</div><button className="mt-4 w-full rounded-lg py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50">+ Thêm ticket</button></div>;
}

function TicketDetailRealPage() {
  return (
    <div>
      <div data-parity-id="ticket.header">
        <PageHeader dense title="Ticket Detail" subtitle="Theo dõi công việc, hội thoại và tiến trình thực thi của AI Agent" actions={<><Button variant="secondary">Chia sẻ</Button><Button variant="secondary">Sửa ticket</Button></>} />
        <div className="mb-5 flex items-center gap-5"><div className="grid h-16 w-16 place-items-center rounded-full bg-blue-50 text-brand-600"><Ticket className="h-8 w-8" /></div><div><h2 className="text-2xl font-bold">Audit Module 3 - Landing & Lead Capture</h2><div className="mt-2 flex gap-4 text-sm text-slate-500"><span>Ticket ID: TKT-1024</span><span>Tạo lúc: 09:14</span><span>Bởi: Lê Tuấn Anh</span></div></div></div>
      </div>
      <div data-parity-id="ticket.tabs" className="mb-4 flex gap-2">
        {['Overview', 'Transcript', 'Artifacts', 'Approvals', 'Audit log'].map((tab, index) => <button key={tab} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${index === 0 ? 'border-brand-500 bg-blue-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600'}`}>{tab}</button>)}
      </div>
      <div data-parity-id="ticket.main-grid" className="grid grid-cols-[330px_1fr_410px] gap-4"><div data-parity-id="ticket.left-panel"><TicketInfo /></div><div data-parity-id="ticket.center-panel"><TranscriptPanel /></div><div data-parity-id="ticket.right-panel"><TicketSide /></div></div>
    </div>
  );
}

function TicketInfo() {
  return <div className="space-y-4"><div data-parity-id="ticket.info-card"><Panel title="Thông tin ticket"><div className="space-y-4 p-4 text-sm">{[['Project', 'GrowthOS V2'], ['Linked goal', 'Hoàn thiện GrowthOS V2 đúng UI parity và nghiệp vụ'], ['Assignee', 'Hermes QA Agent'], ['Status', 'Running'], ['Priority', 'Cao'], ['Risk level', 'Trung bình'], ['Due date', 'Hôm nay'], ['Created by', 'Lê Tuấn Anh']].map(([a, b]) => <div key={a} className="grid grid-cols-[110px_1fr] gap-2"><span className="text-slate-500">{a}</span><span className="font-semibold text-slate-800">{b}</span></div>)}</div></Panel></div><Panel title="Mô tả"><p className="p-4 text-sm leading-6 text-slate-600">Kiểm tra Module 3 theo kiến trúc: Elementor tạo landing page, FluentForm tạo form, lead cần đổ về CRM đúng logic.</p></Panel><div data-parity-id="ticket.criteria-card"><Panel title="Tiêu chí nghiệm thu"><div className="space-y-3 p-4 text-sm">{['Có verdict Pass / Conditional Pass / Fail', 'Có danh sách lỗi Critical / Major / Minor', 'Có evidence', 'Có next action'].map((item) => <label key={item} className="flex gap-2"><input type="checkbox" checked readOnly />{item}</label>)}</div></Panel></div></div>;
}

function TranscriptPanel() {
  return <div data-parity-id="ticket.transcript-card"><Panel title="Run Transcript" action={<Button variant="secondary"><Filter className="h-4 w-4" />Filter</Button>}><div className="space-y-5 p-5"><div className="grid grid-cols-[80px_1fr] gap-4 text-sm"><span className="text-slate-500">09:14:22</span><div><b>Manager instruction</b><p className="mt-2 text-slate-600">Hãy audit Module 3 theo checklist growthos-module-uat.</p></div></div><div className="grid grid-cols-[80px_1fr] gap-4 text-sm"><span className="text-slate-500">09:14:28</span><div><b>Hermes QA Agent</b><p className="mt-2 text-slate-600">Tôi sẽ kiểm tra tài liệu kiến trúc, route, data flow và evidence.</p></div></div><ToolCallList /><div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">Nhập phản hồi hoặc yêu cầu agent làm tiếp...</div><div className="flex justify-end gap-3"><Button variant="secondary">Yêu cầu tiếp tục</Button><Button variant="secondary">Tạo ticket follow-up</Button><Button><Send className="h-4 w-4" />Gửi</Button></div></div></Panel></div>;
}

function ToolCallList() {
  return <div className="space-y-3">{toolCalls.slice(0, 4).map(([name, target, status, duration, cost, Icon]) => <div key={String(target)} className="rounded-xl border border-blue-100 bg-blue-50/40 p-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-white text-brand-600"><Icon className="h-5 w-5" /></div><div className="flex-1"><b>Tool Call: {name}</b><div className="mt-1 text-sm text-slate-500">Target: {target}</div></div><Badge tone={statusTone(String(status))}>{status}</Badge></div><div className="mt-3 flex gap-8 text-sm text-slate-600"><span>Duration: {duration}</span><span>Cost: {cost}</span><button className="ml-auto font-semibold text-brand-600">View details</button></div></div>)}</div>;
}

function TicketSide() {
  return <div className="space-y-4"><div data-parity-id="ticket.status-card"><Panel title="Trạng thái thực thi"><SideRows rows={[['Status', 'Running'], ['Elapsed time', '8m 24s'], ['Progress', '68%'], ['Current step', 'Generating QA report'], ['Last update', '1 phút trước']]} /><div className="px-4 pb-4"><ProgressBar value={68} /></div></Panel></div><Panel title="Chi phí"><SideRows rows={[['Estimated cost', '$0.08'], ['Actual cost', '$0.029'], ['Budget status', 'Trong giới hạn']]} /></Panel><Panel title="Rủi ro"><SideRows rows={[['Risk level', 'Trung bình'], ['Policy checks', 'Passed'], ['Pending approvals', '0']]} /></Panel><div data-parity-id="ticket.actions-card"><Panel title="Phê duyệt"><div className="grid grid-cols-2 gap-3 p-4"><Button variant="success">Approve</Button><Button variant="danger">Reject</Button><Button variant="warning">Request changes</Button><Button variant="secondary">Ask agent</Button></div></Panel></div><div data-parity-id="ticket.artifacts-card"><Panel title="Kết quả đầu ra"><div className="divide-y divide-slate-100 p-4 text-sm">{['QA_Report_Module3.pdf', 'Console_Log.txt', 'Screenshot_Evidence.zip'].map((file) => <div key={file} className="flex items-center justify-between py-2"><span>{file}</span><Download className="h-4 w-4 text-slate-400" /></div>)}</div></Panel></div></div>;
}

function SideRows({ rows }: { rows: string[][] }) {
  return <div className="space-y-3 p-4 text-sm">{rows.map(([a, b]) => <div key={a} className="flex justify-between"><span>{a}</span><b>{b}</b></div>)}</div>;
}

function RunConsoleRealPage() {
  return (
    <div>
      <div data-parity-id="run.header">
        <PageHeader dense title="Run Console" subtitle="Theo dõi thời gian thực quá trình AI Agent thực thi ticket, gọi tool, tạo log và sinh artifact" actions={<><Button variant="secondary">Open Ticket</Button><Button variant="secondary">Open Agent</Button><Button variant="secondary">Request Update</Button><Button variant="warning"><Pause className="h-4 w-4" />Pause</Button><Button variant="danger"><Square className="h-4 w-4" />Stop</Button></>} />
      </div>
      <div data-parity-id="run.status-band">
        <Panel className="mb-5"><div className="grid grid-cols-[130px_1.4fr_1.2fr_1fr_1fr_1fr_1.5fr] divide-x divide-slate-100 p-4 text-sm"><InfoCell label="Run ID" value="run_2381" /><InfoCell label="Ticket" value="Audit Module 3 - Landing & Lead Capture" /><InfoCell label="Agent" value="Hermes QA Agent" /><InfoCell label="Project" value="GrowthOS V2" /><InfoCell label="Status" value="Running" /><InfoCell label="Elapsed" value="8m 24s" /><InfoCell label="Current step" value="Generating QA report" /></div></Panel>
        {kpiGrid([{ label: 'Progress', value: '68%', tone: 'blue', icon: Play }, { label: 'Elapsed Time', value: '8m 24s', tone: 'blue', icon: Clock3 }, { label: 'Estimated Remaining', value: '4m', tone: 'cyan', icon: Timer }, { label: 'Actual Cost', value: '$0.029', tone: 'green', icon: DollarSign }, { label: 'Tool Calls', value: '12', tone: 'blue', icon: Wrench }, { label: 'Risk Level', value: 'Medium', tone: 'amber', icon: ShieldCheck }])}
      </div>
      <div data-parity-id="run.main-grid" className="mt-5 grid grid-cols-[1.05fr_1fr_360px] gap-4"><div data-parity-id="run.timeline-panel"><div data-parity-id="run.timeline-card"><Panel title="Live Timeline"><div className="space-y-3 p-4">{runSteps.map(([name, status, time, duration, cost], index) => <div key={String(name)} className="grid grid-cols-[24px_1fr_80px_70px_70px_20px] items-center gap-3 rounded-lg border border-slate-100 p-3 text-sm"><span className="grid h-6 w-6 place-items-center rounded-full bg-blue-50 text-xs font-bold text-brand-600">{index + 1}</span><b>{name}</b><Badge tone={statusTone(String(status))}>{status}</Badge><span>{time}</span><span>{duration}</span><span>{cost}</span></div>)}</div></Panel></div></div><div data-parity-id="run.logs-panel" className="space-y-4"><div data-parity-id="run.tool-calls-card"><Panel title="Tool Calls"><div className="p-4"><ToolCallList /></div></Panel></div><div data-parity-id="run.logs-card"><Panel title="Logs"><pre className="m-4 h-72 overflow-hidden rounded-xl bg-slate-950 p-5 font-mono text-xs leading-6 text-slate-200">0001 [09:42:13] INFO Run started by Hermes QA Agent{'\n'}0002 [09:42:18] TOOL read_file - PROJECT_BIBLE.md{'\n'}0003 [09:42:25] TOOL run_build - npm run build{'\n'}0004 [09:44:07] WARN analyze_route - missing redirect{'\n'}0005 [09:44:29] INFO Generating QA report...</pre></Panel></div></div><RunInspector /></div>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return <div className="px-4 first:pl-0"><div className="text-xs font-semibold text-slate-500">{label}</div><div className="mt-2 font-bold text-slate-950">{value}</div></div>;
}

function RunInspector() {
  return <div data-parity-id="run.inspector-panel" className="space-y-4"><Panel title="Run Inspector"><SideRows rows={[['Agent', 'Hermes QA Agent'], ['Runtime', 'hermes_local'], ['Model', 'Claude Sonnet via OpenRouter'], ['Workspace', '/workspaces/growthos'], ['Enabled tools', 'File, Terminal, Browser, Web'], ['Checkpoints', 'Enabled']]} /></Panel><div data-parity-id="run.cost-card"><Panel title="Chi phí"><SideRows rows={[['Estimated cost', '$0.08'], ['Actual cost', '$0.029'], ['Budget status', 'Trong giới hạn']]} /></Panel></div><div data-parity-id="run.risk-card"><Panel title="Rủi ro"><SideRows rows={[['Risk level', 'Medium'], ['Policy checks', 'Passed'], ['Pending approvals', '0']]} /></Panel></div><div data-parity-id="run.artifacts-card"><Panel title="Artifacts (3)"><div className="divide-y divide-slate-100 p-4 text-sm">{['QA_Report_Module3.md', 'Console_Log.txt', 'Screenshot_Evidence.zip'].map((file) => <div key={file} className="flex justify-between py-3"><span>{file}</span><Download className="h-4 w-4 text-slate-400" /></div>)}</div></Panel></div><div data-parity-id="run.controls-card"><Panel title="Controls"><div className="grid grid-cols-2 gap-2 p-4"><Button variant="warning">Pause run</Button><Button variant="danger">Stop run</Button><Button variant="secondary">Retry run</Button><Button variant="secondary">Continue checkpoint</Button></div></Panel></div></div>;
}

function ApprovalCenter() {
  const selected = approvals[0];
  return (
    <div>
      <PageHeader title="Approval Center" subtitle="Phê duyệt các hành động rủi ro trước khi AI Agent tiếp tục thực thi" actions={<><Button variant="secondary"><ShieldCheck className="h-4 w-4" />Approval Policy</Button><Button variant="secondary"><Download className="h-4 w-4" />Export Approval Log</Button><Button><Layers3 className="h-4 w-4" />Bulk Review</Button></>} />
      {kpiGrid(approvalKpis)}
      <div className="mt-5 flex flex-wrap gap-2">{['All 14', 'High Risk 5', 'Terminal 4', 'File Changes 3', 'Database 1', 'Email 2', 'Budget 1', 'MCP 1', 'Overdue 3'].map((filter, index) => <button key={filter} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${index === 0 ? 'border-brand-500 bg-blue-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600'}`}>{filter}</button>)}</div>
      <div className="mt-4 grid grid-cols-[0.82fr_1.08fr] gap-4">
        <Panel title="Danh sách chờ phê duyệt (14)" action={<><button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold">Mới nhất</button><Button variant="secondary"><ListFilter className="h-4 w-4" /></Button></>}><div className="space-y-3 p-3">{approvals.map((approval, index) => <div key={approval.title} className={`rounded-xl border p-4 ${index === 0 ? 'border-brand-500 ring-2 ring-blue-100' : 'border-slate-200'}`}><div className="grid grid-cols-[44px_1fr_180px_82px_26px] gap-3"><div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-800 text-white">{index === 0 ? '>' : index + 1}</div><div><h3 className="font-bold">{approval.title}</h3><div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600"><span>Agent · {approval.agent}</span><span>Ticket · {approval.ticket}</span><span>Project · {approval.project}</span><span>Requested · {approval.requested}</span></div></div><div className="space-y-2 text-sm"><div className="flex justify-between"><span>Risk</span><Badge tone={statusTone(approval.risk)}>{approval.risk}</Badge></div><div className="flex justify-between"><span>Impact</span><b>{approval.impact}</b></div></div><Button variant="secondary">Review</Button><MoreButton /></div></div>)}</div></Panel>
        <div className="space-y-4"><Panel><div className="p-5"><div className="mb-5 flex items-start justify-between"><div className="flex items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-lg bg-slate-800 text-white text-2xl">&gt;</div><div><h2 className="text-xl font-bold">{selected.title}</h2><div className="mt-2 flex gap-4 text-sm"><Badge tone="red">Pending Review</Badge><span>ID: APPR-2381</span></div></div></div></div><div className="grid grid-cols-[170px_1fr] gap-4 rounded-xl border border-slate-200 p-4 text-sm">{[['Agent', selected.agent], ['Runtime', 'hermes_local'], ['Liên quan ticket', selected.ticket], ['Yêu cầu hành động', 'Run terminal command'], ['Command', 'npm test'], ['Lý do', 'Cần chạy test để xác minh module trước khi tạo QA report.'], ['Risk level', selected.risk], ['Impact area', selected.impact], ['Estimated cost', '$0.012']].map(([a, b]) => <><span className="text-slate-500">{a}</span><b className="text-slate-800">{b}</b></>)}</div><div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4"><h3 className="font-bold text-brand-700">Gợi ý từ AI</h3><p className="mt-2 text-sm leading-6 text-slate-700">Yêu cầu này có rủi ro trung bình vì chỉ chạy test trong local workspace. Có thể approve once, nhưng không nên tạo policy tự động cho mọi terminal command.</p><div className="mt-3 flex items-center gap-3"><ProgressBar value={92} /><b>92%</b></div></div><div className="mt-5 grid grid-cols-5 gap-3"><Button variant="success">Approve once</Button><Button>Approve and remember policy</Button><Button variant="danger">Reject</Button><Button variant="warning">Request changes</Button><Button variant="secondary">Ask agent</Button></div></div></Panel><Panel title="Lịch sử phê duyệt"><div className="p-4 text-sm">Hermes QA Agent tạo yêu cầu phê duyệt · 8 phút trước</div></Panel></div>
      </div>
    </div>
  );
}

export function DemoScreen({ route }: { route: string }) {
  if (route === '/command-center') return <CommandCenter />;
  if (route === '/workforce') return <WorkforceOverviewRealPage />;
  if (route === '/org-chart') return <OrgChart />;
  if (route === '/agents/demo-agent') return <AgentDetail />;
  if (route === '/tickets') return <TicketsBoardRealPage />;
  if (route === '/tickets/demo-ticket') return <TicketDetailRealPage />;
  if (route === '/runs/demo-run') return <RunConsoleRealPage />;
  if (route === '/approvals') return <ApprovalCenter />;
  return null;
}
