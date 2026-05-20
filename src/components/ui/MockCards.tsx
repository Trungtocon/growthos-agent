import { ArrowUpRight } from 'lucide-react';

export function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border border-slate-200 bg-white p-4 shadow-soft">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-slate-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-950">{title}</h2>
        <button className="flex items-center gap-1 text-sm font-semibold text-brand-600">Xem thêm <ArrowUpRight className="h-3.5 w-3.5" /></button>
      </div>
      {children}
    </section>
  );
}
