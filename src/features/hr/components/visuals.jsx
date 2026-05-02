import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { TONES } from './tokens';

/* ─── Page header — eyebrow + title + subtitle + actions ──────────────────── */
export function PageHeader({ eyebrow, title, subtitle, actions, className }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3 mb-5', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-1">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[26px] font-bold tracking-tight text-slate-900 leading-tight">{title}</h1>
        {subtitle && <div className="text-sm text-slate-500 mt-0.5">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ─── KPI hero card — bold value, gradient bg, decorative blob ────────────── */
export function KpiHero({ tone = 'brand', eyebrow, value, suffix, prefix, label, icon, foot, onClick }) {
  const t = TONES[tone] || TONES.brand;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-2xl bg-gradient-to-br text-white p-5 text-left',
        'shadow-lg', t.grad, t.ring,
        onClick && 'cursor-pointer transition-transform hover:scale-[1.015] active:scale-[0.99]',
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.22), transparent)' }}
      />
      <div className="relative z-10">
        {(eyebrow || icon) && (
          <div className="flex items-center gap-2 mb-2">
            {icon && <span className="grid place-items-center size-7 rounded-lg bg-white/20 text-white">{icon}</span>}
            {eyebrow && (
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/85">
                {eyebrow}
              </div>
            )}
          </div>
        )}
        <div className="flex items-baseline gap-1">
          {prefix && <span className="text-lg font-semibold opacity-90">{prefix}</span>}
          <span className="text-[40px] leading-none font-bold tabular-nums tracking-tight">{value}</span>
          {suffix && <span className="text-lg font-semibold opacity-90">{suffix}</span>}
        </div>
        {label && <div className="text-sm text-white/85 mt-1">{label}</div>}
        {foot && <div className="mt-3">{foot}</div>}
      </div>
    </Tag>
  );
}

/* ─── Soft KPI tile — small, white card with tinted icon & accent bar ─────── */
export function KpiTile({ tone = 'brand', label, value, sub, icon, accent = true, onClick, className }) {
  const t = TONES[tone] || TONES.brand;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'relative w-full rounded-xl bg-white border border-slate-200/80 p-4 pl-5 text-left',
        'shadow-sm transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:border-slate-300',
        className,
      )}
    >
      {accent && <div className={cn('absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-gradient-to-b', t.grad)} />}
      <div className="flex items-start gap-3">
        {icon && (
          <div className={cn('grid place-items-center size-9 rounded-lg shrink-0 ring-1', t.soft)}>
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">{label}</div>
          <div className="text-xl font-bold text-slate-900 tabular-nums mt-0.5 truncate">{value}</div>
          {sub && <div className="text-xs text-slate-500 mt-0.5 truncate">{sub}</div>}
        </div>
      </div>
    </Tag>
  );
}

/* ─── Status pill — small Badge with semantic tones ───────────────────────── */
export function StatusPill({ tone = 'slate', children, className }) {
  const t = TONES[tone] || TONES.slate;
  return (
    <Badge className={cn('ring-1 ring-inset border-0 font-semibold capitalize', t.soft, className)}>
      {children}
    </Badge>
  );
}

/* ─── Soft alert bar — tinted background + accent left border ─────────────── */
export function AlertBar({ tone = 'amber', icon, title, description, action, className }) {
  const t = TONES[tone] || TONES.amber;
  return (
    <div className={cn('flex items-center gap-3 rounded-xl px-4 py-3 ring-1 ring-inset', t.soft, className)}>
      {icon && <div className="shrink-0">{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm">{title}</div>
        {description && <div className="text-xs opacity-80 mt-0.5">{description}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ─── Section card — white card with optional accent header strip ─────────── */
export function SectionCard({ title, subtitle, icon, action, tone, children, className, padding = 'p-5' }) {
  const t = tone ? (TONES[tone] || TONES.brand) : null;
  return (
    <div className={cn('rounded-xl bg-white border border-slate-200/80 shadow-sm overflow-hidden', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && t && (
              <div className={cn('grid place-items-center size-7 rounded-md ring-1', t.soft)}>{icon}</div>
            )}
            <div className="min-w-0">
              {title && <div className="font-semibold text-slate-900 text-[15px] truncate">{title}</div>}
              {subtitle && <div className="text-xs text-slate-500 truncate">{subtitle}</div>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={padding}>{children}</div>
    </div>
  );
}

/* ─── Mini progress bar — used inside KPI hero foot, tile, etc. ───────────── */
export function ProgressBar({ value = 0, tone = 'brand', height = 6, className, onWhite = false }) {
  const t = TONES[tone] || TONES.brand;
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div
      className={cn('w-full overflow-hidden rounded-full', onWhite ? 'bg-slate-100' : 'bg-white/25', className)}
      style={{ height }}
    >
      <div
        className={cn('h-full rounded-full bg-gradient-to-r transition-[width] duration-500', t.grad)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ─── Empty state — icon + title + subtitle ───────────────────────────────── */
export function EmptyState({ icon, title, subtitle, action, className }) {
  return (
    <div className={cn('text-center py-10 px-4', className)}>
      {icon && (
        <div className="mx-auto grid place-items-center size-12 rounded-full bg-slate-100 text-slate-400 mb-3">
          {icon}
        </div>
      )}
      <div className="font-semibold text-slate-700">{title}</div>
      {subtitle && <div className="text-sm text-slate-500 mt-1">{subtitle}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
