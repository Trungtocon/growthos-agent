import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Bot, ChevronRight, MoreVertical } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Tone } from '../../data/demoScreens';

const toneClasses: Record<Tone, { icon: string; soft: string; text: string; border: string; fill: string }> = {
  blue: { icon: 'text-brand-600', soft: 'bg-blue-50', text: 'text-brand-700', border: 'border-blue-200', fill: 'bg-brand-600' },
  cyan: { icon: 'text-cyan-600', soft: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', fill: 'bg-cyan-500' },
  green: { icon: 'text-emerald-600', soft: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', fill: 'bg-emerald-500' },
  amber: { icon: 'text-amber-600', soft: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', fill: 'bg-amber-500' },
  red: { icon: 'text-red-600', soft: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', fill: 'bg-red-500' },
  purple: { icon: 'text-violet-600', soft: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', fill: 'bg-violet-500' },
  slate: { icon: 'text-slate-500', soft: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', fill: 'bg-slate-400' },
};

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  dense = false,
  contentParityId,
}: {
  title: string;
  subtitle: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  dense?: boolean;
  contentParityId?: string;
}) {
  const Icon = icon;
  return (
    <div className={`${dense ? 'mb-3' : 'mb-4'} flex items-center justify-between gap-4`}>
      <div className="flex items-center gap-4">
        {Icon ? (
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-brand-600">
            <Icon className="h-7 w-7" />
          </div>
        ) : null}
        <div data-parity-id={contentParityId}>
          <h1 className={`${dense ? 'text-[24px]' : 'text-[30px]'} font-bold leading-tight tracking-tight text-slate-950`}>{title}</h1>
          <p className={`${dense ? 'mt-1 text-[13px]' : 'mt-1 text-[15px]'} text-slate-500`}>{subtitle}</p>
        </div>
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function Button({ children, variant = 'primary' }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'success' }) {
  const classes = {
    primary: 'bg-[#176bff] text-white border-[#176bff] shadow-[0_8px_20px_rgba(23,107,255,0.20)] hover:bg-brand-700',
    secondary: 'bg-white text-slate-700 border-slate-200 hover:border-brand-200 hover:text-brand-700',
    danger: 'bg-white text-red-600 border-red-200 hover:bg-red-50',
    warning: 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50',
    success: 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50',
  }[variant];
  return <button className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-200 ${classes}`}>{children}</button>;
}

export function IconTile({ icon: Icon, tone = 'blue', size = 'md' }: { icon: LucideIcon; tone?: Tone; size?: 'sm' | 'md' | 'lg' }) {
  const toneClass = toneClasses[tone];
  const sizeClass = size === 'lg' ? 'h-[60px] w-[60px] rounded-2xl' : size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-xl';
  const iconClass = size === 'lg' ? 'h-8 w-8' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <div className={`grid shrink-0 place-items-center ${sizeClass} ${toneClass.soft} ${toneClass.icon}`}>
      <Icon className={iconClass} />
    </div>
  );
}

export function Panel({ title, children, action, className = '' }: { title?: ReactNode; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] ${className}`}>
      {title ? (
        <div className="flex min-h-12 items-center justify-between px-4 py-3">
          <h2 className="text-base font-bold text-slate-950">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function DashboardCard({ title, icon, children, action, className = '' }: { title?: ReactNode; icon?: LucideIcon; children: ReactNode; action?: ReactNode; className?: string }) {
  const Icon = icon;
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] ${className}`}>
      {title ? (
        <div className="flex min-h-12 items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {Icon ? <Icon className="h-5 w-5 shrink-0 text-brand-600" /> : null}
            <h2 className="truncate text-base font-bold text-slate-950">{title}</h2>
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function KpiTile({ label, value, delta, tone, icon: Icon, compact = false }: { label: string; value: string; delta?: string; tone: Tone; icon: LucideIcon; compact?: boolean }) {
  const toneClass = toneClasses[tone];
  return (
    <div className={`flex items-center rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] ${compact ? 'h-[62px] gap-3 px-4' : 'h-[112px] gap-5 px-4'}`}>
      <div className={`grid shrink-0 place-items-center rounded-2xl ${compact ? 'h-9 w-9' : 'h-[60px] w-[60px]'} ${toneClass.soft} ${toneClass.icon}`}>
        <Icon className={compact ? 'h-5 w-5' : 'h-8 w-8'} />
      </div>
      <div className="min-w-0">
        <div className={`truncate font-medium text-slate-500 ${compact ? 'text-[11px]' : 'text-[12px]'}`}>{label}</div>
        <div className={`${compact ? 'mt-0.5 text-[20px]' : 'mt-1 text-[25px]'} font-bold leading-none tracking-tight text-slate-950`}>{value}</div>
        {delta ? <div className={`mt-2 text-[11px] font-semibold leading-4 ${delta.startsWith('+') ? 'text-emerald-600' : 'text-red-500'}`}>{delta} so với tháng trước</div> : null}
      </div>
    </div>
  );
}

export function MetricCard({ label, value, trend, tone, icon, compact = false }: { label: string; value: string; trend?: string; tone: Tone; icon: LucideIcon; compact?: boolean }) {
  const trendPositive = trend?.startsWith('+');
  return (
    <div className={`flex items-center rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] ${compact ? 'h-[62px] gap-3 px-4' : 'h-[112px] gap-5 px-4'}`}>
      <IconTile icon={icon} tone={tone} size={compact ? 'sm' : 'lg'} />
      <div className="min-w-0">
        <div className={`truncate font-medium text-slate-500 ${compact ? 'text-[11px]' : 'text-[12px]'}`}>{label}</div>
        <div className={`${compact ? 'mt-0.5 text-[20px]' : 'mt-1 text-[25px]'} font-bold leading-none tracking-tight text-slate-950`}>{value}</div>
        {trend ? <div className={`mt-2 text-[11px] font-semibold leading-4 ${trendPositive ? 'text-emerald-600' : 'text-red-500'}`}>{trend} so với tháng trước</div> : null}
      </div>
    </div>
  );
}

export function Badge({ children, tone = 'blue' }: { children: ReactNode; tone?: Tone }) {
  const toneClass = toneClasses[tone];
  return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${toneClass.soft} ${toneClass.text} ${toneClass.border}`}>{children}</span>;
}

export function ProgressBar({ value, tone = 'blue', height = 6, label }: { value: number; tone?: Tone; height?: number; label?: string }) {
  return (
    <div aria-label={label} className="overflow-hidden rounded-full bg-slate-100" style={{ height }}>
      <div className={`h-full rounded-full ${toneClasses[tone].fill}`} style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
    </div>
  );
}

export function DonutChart({ value, size = 176, strokeWidth = 16, label, sublabel, tone = 'blue' }: { value: number; size?: number; strokeWidth?: number; label?: ReactNode; sublabel?: ReactNode; tone?: Tone }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const primary = circumference * Math.max(0, Math.min(100, value)) / 100;
  const secondary = circumference * 0.18;
  const color = tone === 'cyan' ? '#00bcd4' : tone === 'green' ? '#10b981' : '#126bff';

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e7eef7" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={`${primary} ${circumference}`} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#18c4d6" strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={`${secondary} ${circumference}`} strokeDashoffset={-(primary + 18)} />
      </svg>
      <div className="relative text-center">
        {label}
        {sublabel}
      </div>
    </div>
  );
}

export function DonutScore({ value, label = 'Tốt', size = 'lg' }: { value: number; label?: string; size?: 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'h-44 w-44' : 'h-36 w-36';
  return (
    <div className={`grid ${dim} place-items-center rounded-full`} style={{ background: `conic-gradient(#0052cc 0 ${value * 0.58}%, #00bcd4 ${value * 0.58}% ${value}%, #e5edf7 ${value}% 100%)` }}>
      <div className="grid h-[72%] w-[72%] place-items-center rounded-full bg-white text-center shadow-inner">
        <div>
          <div className="text-4xl font-bold text-slate-950">{value}<span className="text-xl text-slate-500">/100</span></div>
          <div className="mt-2 text-sm font-semibold text-emerald-600">{label}</div>
        </div>
      </div>
    </div>
  );
}

export function MiniSparkline({ tone = 'blue' }: { tone?: Tone }) {
  const color = tone === 'green' ? '#10b981' : tone === 'red' ? '#ef4444' : '#0052cc';
  return (
    <svg viewBox="0 0 72 28" className="h-8 w-20" aria-hidden="true">
      <path d="M3 22 L14 17 L24 19 L35 12 L45 15 L58 7 L69 3" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RowAction() {
  return <ChevronRight className="h-4 w-4 text-slate-400" />;
}

export function ActivityRow({ avatar, title, subtitle, status, statusTone = 'green', time }: { avatar: ReactNode; title: ReactNode; subtitle?: ReactNode; status?: ReactNode; statusTone?: Tone; time?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-slate-700">{title}</div>
        {time ? <div className="mt-1 text-xs text-slate-500">{time}</div> : subtitle ? <div className="mt-1 truncate text-xs text-slate-500">{subtitle}</div> : null}
      </div>
      {status ? <Badge tone={statusTone}>{status}</Badge> : null}
    </div>
  );
}

export function AlertRow({ severity = 'amber', title, description, badge, chevron = true }: { severity?: Tone; title: ReactNode; description?: ReactNode; badge?: ReactNode; chevron?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
      <IconTile icon={severity === 'red' ? Bot : ChevronRight} tone={severity} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-950">{title}</div>
        {description ? <div className="truncate text-xs text-slate-500">{description}</div> : null}
      </div>
      {badge ? <Badge tone={severity}>{badge}</Badge> : null}
      {chevron ? <RowAction /> : null}
    </div>
  );
}

export function RecommendationRow({ icon, tone = 'blue', title, description, badge, chevron = true }: { icon: LucideIcon; tone?: Tone; title: ReactNode; description?: ReactNode; badge?: ReactNode; chevron?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
      <IconTile icon={icon} tone={tone} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-950">{title}</div>
        {description ? <div className="truncate text-xs text-slate-500">{description}</div> : null}
      </div>
      {badge ? <Badge tone={tone}>{badge}</Badge> : null}
      {chevron ? <RowAction /> : null}
    </div>
  );
}

export function CostDistributionChart({ total, rows }: { total: string; rows: Array<{ label: string; value: string; percent?: string; color: string }> }) {
  const stops = rows.reduce<Array<{ color: string; start: number; end: number }>>((acc, row) => {
    const current = acc.length ? acc[acc.length - 1].end : 0;
    const next = current + Number.parseFloat(row.percent ?? '0');
    acc.push({ color: row.color, start: current, end: Number.isFinite(next) ? next : current });
    return acc;
  }, []);
  const gradient = stops.length ? `conic-gradient(${stops.map((stop) => `${stop.color} ${stop.start}% ${stop.end}%`).join(', ')})` : 'conic-gradient(#0052cc 0 100%)';

  return (
    <div className="grid grid-cols-[180px_1fr] gap-4 p-5">
      <div className="grid h-40 w-40 place-items-center rounded-full" style={{ background: gradient }}>
        <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center">
          <div><div className="text-xl font-bold">{total}</div><div className="text-xs text-slate-500">Tổng chi phí</div></div>
        </div>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[12px_1fr_auto] items-center gap-3 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
            <span className="text-slate-600">{row.label}</span>
            <span className="font-semibold text-slate-950">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MoreButton() {
  return <button className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><MoreVertical className="h-4 w-4" /></button>;
}

export function LinkFooter({ children }: { children: ReactNode }) {
  return (
    <div className="border-t border-slate-100 px-4 py-3 text-center">
      <button className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600">{children}<ArrowRight className="h-4 w-4" /></button>
    </div>
  );
}

export function AvatarBot({ tone = 'blue', label = 'AI' }: { tone?: Tone; label?: string }) {
  const toneClass = toneClasses[tone];
  return (
    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-white ${toneClass.soft} ${toneClass.text} shadow-sm`}>
      {label === 'AI' ? <Bot className="h-6 w-6" strokeWidth={2.4} /> : <span className="text-xs font-black">{label}</span>}
    </div>
  );
}
