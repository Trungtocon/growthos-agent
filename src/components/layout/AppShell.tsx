import {
  BarChart3,
  Bell,
  Bot,
  Calendar,
  CheckCircle2,
  FileText,
  Folder,
  Inbox,
  LayoutDashboard,
  Network,
  PlaySquare,
  Search,
  Settings,
  Shield,
  Target,
  Ticket,
  Workflow,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  count?: number;
};

type ShellProfile = {
  sidebarWidth: number;
  headerHeight: number;
  logoSubtitle: string;
  logoVariant: 'leaf' | 'shield';
  company: string;
  searchPlaceholder: string;
  searchWidth: number;
  searchGap: number;
  costLabel: string;
  costValue: string;
  notificationCount: number;
  userName: string;
  userRole: string;
  createLabel: string;
  navItems: NavItem[];
  bottom: 'command' | 'copilot' | 'workspace' | 'product' | 'none';
  mainClass: string;
  sidebarPaddingY?: number;
  sidebarTheme?: 'light' | 'dark';
};

export const APP_SHELL_TOKENS = {
  sidebarWidth: 218,
  topbarHeight: 72,
  contentPaddingX: 22,
  contentPaddingY: 18,
  navItemHeight: 44,
  navItemGap: 7,
  cardRadius: 12,
  borderColor: '#e2e8f0',
  shadow: '0 8px 24px rgba(15,23,42,0.04)',
} as const;

const executiveNav: NavItem[] = [
  { label: 'Command Center', href: '/command-center', icon: LayoutDashboard },
  { label: 'Today', href: '/today', icon: Calendar },
  { label: 'Inbox', href: '/inbox', icon: Inbox, count: 8 },
  { label: 'Goals', href: '/goals', icon: Target },
  { label: 'Projects', href: '/projects', icon: Folder },
  { label: 'Agents', href: '/agents', icon: Bot },
  { label: 'Org Chart', href: '/org-chart', icon: Network },
  { label: 'Tickets', href: '/tickets', icon: Ticket, count: 12 },
  { label: 'Approvals', href: '/approvals', icon: CheckCircle2, count: 3 },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Integrations', href: '/integrations', icon: Workflow },
  { label: 'Settings', href: '/settings', icon: Settings },
];

const workforceNav: NavItem[] = [
  { label: 'Command Center', href: '/command-center', icon: LayoutDashboard },
  { label: 'Today', href: '/today', icon: Calendar },
  { label: 'Inbox', href: '/inbox', icon: Inbox, count: 18 },
  { label: 'Goals', href: '/goals', icon: Target },
  { label: 'Projects', href: '/projects', icon: Folder },
  { label: 'Agents', href: '/agents', icon: Bot },
  { label: 'Org Chart', href: '/org-chart', icon: Network },
  { label: 'Tickets', href: '/tickets', icon: Ticket, count: 24 },
  { label: 'Approvals', href: '/approvals', icon: CheckCircle2, count: 7 },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Integrations', href: '/integrations', icon: Workflow },
  { label: 'Settings', href: '/settings', icon: Settings },
];

const detailNav: NavItem[] = [
  { label: 'Tổng quan', href: '/command-center', icon: LayoutDashboard },
  { label: 'Goals', href: '/goals', icon: Target },
  { label: 'Projects', href: '/projects', icon: Folder },
  { label: 'Agents', href: '/agents', icon: Bot },
  { label: 'Org Chart', href: '/org-chart', icon: Network },
  { label: 'Tickets', href: '/tickets', icon: Ticket },
  { label: 'Runs', href: '/runs/demo-run', icon: PlaySquare },
  { label: 'Reports', href: '/reports', icon: FileText },
  { label: 'Workflows', href: '/workflows', icon: Workflow },
  { label: 'Knowledge', href: '/knowledge', icon: Inbox },
  { label: 'Integrations', href: '/integrations', icon: Network },
  { label: 'Settings', href: '/settings', icon: Settings },
];

function shellProfile(currentPath: string): ShellProfile {
  if (currentPath === '/inbox') {
    return {
      sidebarWidth: 240,
      headerHeight: 80,
      logoSubtitle: 'AI Workforce OS',
      logoVariant: 'leaf',
      company: 'Demo Company',
      searchPlaceholder: 'Tìm kiếm...',
      searchWidth: 418,
      searchGap: 112,
      costLabel: 'Chi phí AI tháng này',
      costValue: '$18,450.75',
      notificationCount: 5,
      userName: 'Nguyễn Minh',
      userRole: 'Admin',
      createLabel: '+  Create',
      navItems: executiveNav,
      bottom: 'copilot',
      mainClass: 'px-[28px] py-[16px]',
      sidebarPaddingY: 28,
    };
  }

  if (currentPath === '/today') {
    return {
      sidebarWidth: 240,
      headerHeight: 80,
      logoSubtitle: 'AI Workforce OS',
      logoVariant: 'leaf',
      company: 'Demo Company',
      searchPlaceholder: 'Tìm kiếm...',
      searchWidth: 382,
      searchGap: 88,
      costLabel: 'Chi phí AI tháng này',
      costValue: '$18,450.75',
      notificationCount: 3,
      userName: 'Nguyễn Minh',
      userRole: 'Admin',
      createLabel: '+  Create',
      navItems: executiveNav,
      bottom: 'copilot',
      mainClass: 'px-[28px] py-[8px]',
      sidebarPaddingY: 28,
    };
  }

  if (currentPath === '/notifications') {
    return {
      sidebarWidth: 240,
      headerHeight: 80,
      logoSubtitle: 'AI Workforce OS',
      logoVariant: 'leaf',
      company: 'Demo Company',
      searchPlaceholder: 'Tìm kiếm...',
      searchWidth: 382,
      searchGap: 88,
      costLabel: 'Chi phí AI tháng này',
      costValue: '$18,450.75',
      notificationCount: currentPath === '/notifications' ? 0 : 3,
      userName: 'Nguyễn Minh',
      userRole: 'Admin',
      createLabel: '+  Create',
      navItems: executiveNav,
      bottom: 'copilot',
      mainClass: 'px-[28px] py-[10px]',
      sidebarPaddingY: 22,
    };
  }

  if (currentPath === '/workforce') {
    return {
      sidebarWidth: 258,
      headerHeight: 72,
      logoSubtitle: 'AI Workforce OS',
      logoVariant: 'leaf',
      company: 'Demo Company',
      searchPlaceholder: 'Tìm kiếm...',
      searchWidth: 408,
      searchGap: 32,
      costLabel: 'Chi phí AI tháng này',
      costValue: '$1,240',
      notificationCount: 3,
      userName: 'Alex Nguyen',
      userRole: 'Owner',
      createLabel: '+  Create',
      navItems: workforceNav,
      bottom: 'workspace',
      mainClass: 'px-[22px] py-[26px]',
    };
  }

  if (currentPath === '/org-chart') {
    return {
      sidebarWidth: 208,
      headerHeight: 68,
      logoSubtitle: 'AI Workforce OS',
      logoVariant: 'leaf',
      company: 'Demo Company',
      searchPlaceholder: 'Tìm kiếm...',
      searchWidth: 410,
      searchGap: 108,
      costLabel: 'Chi phí AI tháng này',
      costValue: '$12,450.60',
      notificationCount: 7,
      userName: 'Nguyễn Minh',
      userRole: 'Admin',
      createLabel: '+  Create',
      navItems: executiveNav.map((item) =>
        item.href === '/inbox' ? { ...item, count: 12 } : item.href === '/tickets' ? { ...item, count: 8 } : item.href === '/approvals' ? { ...item, count: 5 } : item,
      ),
      bottom: 'product',
      mainClass: 'px-[18px] py-[20px]',
    };
  }

  if (currentPath === '/tickets') {
    return {
      sidebarWidth: 210,
      headerHeight: 72,
      logoSubtitle: 'AI Workforce OS',
      logoVariant: 'leaf',
      company: 'Demo Company',
      searchPlaceholder: 'Tìm kiếm...',
      searchWidth: 552,
      searchGap: 54,
      costLabel: 'AI Cost',
      costValue: '$12.48',
      notificationCount: 8,
      userName: 'Nguyễn Minh',
      userRole: 'Admin',
      createLabel: '+  Create',
      navItems: executiveNav.map((item) => (item.href === '/inbox' ? { ...item, count: 12 } : { ...item, count: undefined })),
      bottom: 'workspace',
      mainClass: 'px-[24px] py-[20px]',
    };
  }

  if (currentPath === '/agents/demo-agent' || currentPath === '/tickets/demo-ticket' || currentPath === '/runs/demo-run') {
    return {
      sidebarWidth: currentPath === '/runs/demo-run' ? 190 : 185,
      headerHeight: currentPath === '/runs/demo-run' ? 54 : 60,
      logoSubtitle: 'AI Workforce OS',
      logoVariant: 'shield',
      company: currentPath === '/runs/demo-run' ? 'GrowthOS Workspace' : 'UIKIGAI Technologies',
      searchPlaceholder: 'Tìm kiếm (Ctrl + K)',
      searchWidth: currentPath === '/runs/demo-run' ? 250 : 474,
      searchGap: currentPath === '/runs/demo-run' ? 36 : 78,
      costLabel: currentPath === '/runs/demo-run' ? '' : 'AI Cost',
      costValue: currentPath === '/runs/demo-run' ? '' : '$2,840.00',
      notificationCount: currentPath === '/runs/demo-run' ? 0 : 8,
      userName: currentPath === '/runs/demo-run' ? 'Lê Tuấn Anh' : 'John Smith',
      userRole: currentPath === '/runs/demo-run' ? 'Admin' : 'Owner',
      createLabel: '+  Create',
      navItems: detailNav,
      bottom: currentPath === '/runs/demo-run' ? 'workspace' : 'product',
      mainClass: currentPath === '/runs/demo-run' ? 'px-[26px] py-[16px]' : 'px-[30px] py-[12px]',
    };
  }

  if (currentPath === '/agents/performance') {
    return {
      sidebarWidth: 204,
      headerHeight: 60,
      logoSubtitle: 'Growth on Autopilot.',
      logoVariant: 'leaf',
      company: 'Demo Company',
      searchPlaceholder: 'Tim kiem agents, projects, tasks...',
      searchWidth: 456,
      searchGap: 164,
      costLabel: 'AI Cost',
      costValue: '$1,248.75',
      notificationCount: 9,
      userName: 'Nguyen Minh',
      userRole: 'Admin',
      createLabel: '+  Tao moi',
      navItems: executiveNav.map((item) =>
        item.href === '/inbox' ? { ...item, count: 12 } : item.href === '/tickets' ? { ...item, count: 8 } : item.href === '/approvals' ? { ...item, count: 5 } : item,
      ),
      bottom: 'command',
      mainClass: 'px-[18px] py-[20px]',
      sidebarPaddingY: 24,
      sidebarTheme: 'dark',
    };
  }

  return {
    sidebarWidth: APP_SHELL_TOKENS.sidebarWidth,
    headerHeight: APP_SHELL_TOKENS.topbarHeight,
    logoSubtitle: 'Growth on Autopilot.',
    logoVariant: 'leaf',
    company: 'Demo Company',
    searchPlaceholder: 'Tìm kiếm...',
    searchWidth: 414,
    searchGap: 144,
    costLabel: 'Chi phí AI tháng này',
    costValue: '$18,450.75',
    notificationCount: 5,
    userName: 'Nguyễn Minh',
    userRole: 'Admin',
    createLabel: '+  Create',
    navItems: executiveNav,
    bottom: 'command',
    mainClass: 'px-[22px] py-[18px]',
  };
}

function isActive(currentPath: string, href: string) {
  if (href === '/command-center') return currentPath === '/' || currentPath === href;
  if (href === '/agents') return currentPath === '/workforce' || currentPath === href || currentPath.startsWith('/agents/');
  if (href === '/tickets') return currentPath === href || currentPath.startsWith('/tickets/');
  if (href === '/approvals') return currentPath === href || currentPath.startsWith('/approvals/');
  if (href === '/runs/demo-run') return currentPath === href;
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

function Logo({ profile }: { profile: ShellProfile }) {
  if (profile.logoVariant === 'shield') {
    return (
      <div className="flex items-center gap-2">
        <div className="grid h-10 w-10 place-items-center rounded-xl border-2 border-[#0f6bff] text-[#0f6bff]">
          <Shield className="h-6 w-6" strokeWidth={2.5} />
        </div>
        <div>
          <div className="text-[21px] font-extrabold leading-5 tracking-tight text-[#1264f4]">UIKIGAI</div>
          <div className="text-[11px] font-semibold leading-4 text-[#1264f4]">{profile.logoSubtitle}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-[9px]">
      <div className="relative h-12 w-[37px]">
        <span className="absolute left-0 top-2 h-9 w-5 rounded-br-[18px] rounded-tl-[18px] bg-gradient-to-b from-[#00bcd4] to-[#1273e6]" />
        <span className="absolute left-[17px] top-0 h-11 w-5 rounded-bl-[18px] rounded-tr-[18px] bg-gradient-to-b from-[#00d2c7] to-[#0052cc]" />
      </div>
      <div>
        <div className="text-[25px] font-extrabold leading-6 tracking-tight text-[#1264f4]">UIKIGAI</div>
        <div className="text-[11px] font-semibold leading-3 text-[#3694d8]">{profile.logoSubtitle}</div>
      </div>
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="relative h-11 w-11 overflow-hidden rounded-full bg-[#e8eef5]">
      <div className="absolute left-[13px] top-[8px] h-[14px] w-[14px] rounded-full bg-[#ffd0b6]" />
      <div className="absolute left-[8px] top-[24px] h-[20px] w-[25px] rounded-t-full bg-[#1f2937]" />
      <div className="absolute left-[12px] top-[4px] h-[11px] w-[19px] rounded-t-full bg-[#2b2b2b]" />
    </div>
  );
}

function BottomPanel({ type, dark = false }: { type: ShellProfile['bottom']; dark?: boolean }) {
  if (type === 'none') return null;

  if (dark) {
    return (
      <div className="absolute bottom-[18px] left-3 right-3 rounded-xl border border-[#24476f] bg-[#0b2a52] px-4 py-4 text-white">
        <div className="mb-2 flex items-center gap-2 text-[12px] font-extrabold">
          <span className="grid h-6 w-6 place-items-center rounded-full border border-blue-200">?</span>
          Ban can tro giup?
        </div>
        <div className="text-[11px] font-semibold leading-4 text-blue-100">Trung tam ho tro</div>
      </div>
    );
  }

  if (type === 'workspace') {
    return (
      <div className="absolute bottom-[32px] left-3 right-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#eaf3ff] text-[#0f6bff]">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500">Workspace</div>
            <div className="text-sm font-extrabold text-slate-900">Demo Company</div>
          </div>
        </div>
        <div className="mt-3 text-xs font-semibold text-emerald-600">• Pro Plan</div>
      </div>
    );
  }

  if (type === 'product') {
    return (
      <div className="absolute bottom-[32px] left-3 right-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="text-sm font-extrabold text-[#0f6bff]">UIKIGAI AI</div>
        <div className="mt-3 text-xs leading-5 text-slate-500">Thông minh hơn mỗi ngày.<br />Khai phóng sức mạnh đội ngũ.</div>
      </div>
    );
  }

  if (type === 'copilot') {
    return (
      <div className="absolute bottom-[32px] left-3 right-3 rounded-xl border border-[#cfe2ff] bg-[#f8fbff] px-5 py-5">
        <div className="mb-4 flex items-center gap-2 text-[13px] font-extrabold text-[#1264f4]">
          <span className="text-lg leading-none">✦</span>
          UIKIGAI Copilot
        </div>
        <div className="text-[12px] font-semibold leading-5 text-slate-600">Trợ lý AI đồng hành<br />cùng đội ngũ của bạn</div>
        <button className="mt-4 inline-flex h-8 items-center gap-2 rounded-lg bg-[#eaf3ff] px-4 text-[12px] font-bold text-[#0f6bff]">
          Tìm hiểu thêm <span aria-hidden="true">→</span>
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-[30px] left-3 right-3 rounded-xl border border-[#cfe2ff] bg-[#f8fbff] px-5 py-5">
      <div className="mb-4 flex items-center gap-2 text-[12px] font-extrabold text-[#1264f4]">
        <span className="text-lg leading-none">✦</span>
        UIKIGAI AI Workforce OS
      </div>
      <div className="text-[12px] font-semibold leading-5 text-slate-600">Vận hành đội ngũ AI.<br />Tăng trưởng tự động.</div>
    </div>
  );
}

export function AppShell({ currentPath, children }: { currentPath: string; children: React.ReactNode }) {
  const profile = shellProfile(currentPath);
  const darkSidebar = profile.sidebarTheme === 'dark';

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <aside data-parity-id="app-shell.sidebar" className={`fixed left-0 top-0 h-screen border-r px-3 ${darkSidebar ? 'border-[#0d2544] bg-[#061426]' : 'border-slate-200 bg-white'}`} style={{ width: profile.sidebarWidth, paddingTop: profile.sidebarPaddingY ?? 22, paddingBottom: profile.sidebarPaddingY ?? 22 }}>
        <div className="mb-[28px] px-5">
          <Logo profile={profile} />
        </div>
        <nav className="flex flex-col" style={{ gap: APP_SHELL_TOKENS.navItemGap }} aria-label="Main navigation">
          {profile.navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(currentPath, item.href);
            return (
              <a key={`${item.href}-${item.label}`} href={item.href} style={{ height: APP_SHELL_TOKENS.navItemHeight }} className={`flex items-center gap-4 rounded-lg px-4 text-[14px] font-semibold transition ${darkSidebar ? active ? 'bg-[#0f8fff] text-white' : 'text-slate-200 hover:bg-white/10 hover:text-white' : active ? 'bg-[#eaf3ff] text-[#0f6bff]' : 'text-[#536174] hover:bg-slate-50 hover:text-slate-950'}`}>
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.7 : 2.1} aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                {item.count ? <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${darkSidebar ? 'bg-[#0f6bff] text-white' : 'bg-[#e6f7ff] text-[#087dcc]'}`}>{item.count}</span> : null}
              </a>
            );
          })}
        </nav>
        <BottomPanel type={profile.bottom} dark={darkSidebar} />
      </aside>

      <div style={{ paddingLeft: profile.sidebarWidth }}>
        <header data-parity-id="app-shell.topbar" className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur" style={{ height: profile.headerHeight }}>
          <div className="flex items-center" style={{ gap: profile.searchGap }}>
            <select className="h-[42px] w-[182px] rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 shadow-[0_2px_8px_rgba(15,23,42,0.03)]" aria-label="Company switcher">
              <option>{profile.company}</option>
            </select>
            <div className="relative" style={{ width: profile.searchWidth }}>
              <Search className="absolute right-4 top-3 h-5 w-5 text-slate-500" aria-hidden="true" />
              <input aria-label="Search workspace" className="h-[42px] w-full rounded-lg border border-slate-200 bg-white py-2 pl-4 pr-12 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder={profile.searchPlaceholder} />
            </div>
          </div>

          <div className="flex items-center gap-[18px]">
            <a href="/notifications" className="relative grid h-10 w-10 place-items-center rounded-xl bg-white text-slate-800" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {profile.notificationCount > 0 ? <span className="absolute right-1.5 top-0 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{profile.notificationCount}</span> : null}
            </a>
            {profile.costValue ? (
              <div className="flex h-[56px] w-[193px] items-center justify-between rounded-lg border border-slate-200 bg-white px-4 shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
                <div>
                  <div className="whitespace-nowrap text-[11px] font-semibold text-slate-500">{profile.costLabel}</div>
                  <div className="mt-1 text-[15px] font-extrabold text-slate-950">{profile.costValue}</div>
                </div>
                <svg width="50" height="28" viewBox="0 0 50 28" className="overflow-visible">
                  <path d="M1 20 C10 14, 15 16, 20 18 S30 22, 36 13 S44 7, 49 1" fill="none" stroke="#0f6bff" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </div>
            ) : null}
            <button className="h-[44px] rounded-lg bg-[#0f6bff] px-6 text-[15px] font-bold text-white shadow-[0_10px_20px_rgba(15,98,255,0.18)] hover:bg-brand-700">{profile.createLabel}</button>
            <div className="h-10 w-px bg-slate-200" />
            <div className="flex items-center gap-3">
              <UserAvatar />
              <div className="mr-1">
                <div className="whitespace-nowrap text-sm font-extrabold text-slate-900">{profile.userName}</div>
                <div className="text-xs font-semibold text-slate-500">{profile.userRole}</div>
              </div>
              <span className="text-slate-600">⌄</span>
            </div>
          </div>
        </header>
        <main className={profile.mainClass}>
          <div
            data-parity-id="app-shell.main"
            style={
              currentPath === '/command-center'
                ? { minHeight: 'calc(100vh - 90px)' }
                : currentPath === '/workforce'
                  ? { minHeight: 'calc(100vh - 98px)' }
                  : currentPath === '/tickets'
                    ? { minHeight: 'calc(100vh - 92px)' }
                    : currentPath === '/tickets/demo-ticket'
                      ? { minHeight: 'calc(100vh - 72px)' }
                      : currentPath === '/runs/demo-run'
                        ? { minHeight: 'calc(100vh - 70px)' }
                        : currentPath === '/approvals'
                          ? { minHeight: 'calc(100vh - 90px)' }
                    : undefined
            }
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
