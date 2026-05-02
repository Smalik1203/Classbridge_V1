/**
 * KPI — prototype-style metric card.
 *
 *   <KPI label="Total students" value="2,847" trend="up" trendValue="4.2%"
 *        sub="vs last term" icon={GraduationCap} />
 */
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function KPI({ label, value, trend, trendValue, sub, icon: Icon, className }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 min-h-[110px] rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--bg-elev)] px-5 py-[18px] transition-colors hover:border-[color:var(--border-strong)]',
        className
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--fg-muted)]">
        {Icon && <Icon size={13} className="text-[color:var(--fg-subtle)] shrink-0" />}
        <span>{label}</span>
      </div>
      <div className="text-[28px] font-semibold tracking-[-0.025em] tabular-nums leading-[1.1] mt-1 text-[color:var(--fg)]">
        {value}
      </div>
      <div className="text-[11.5px] text-[color:var(--fg-subtle)] flex items-center gap-1.5 mt-auto">
        {trend === 'up' && (
          <span className="text-[color:var(--success)] inline-flex items-center gap-1">
            <TrendingUp size={11} />
            <span className="tabular-nums">{trendValue}</span>
          </span>
        )}
        {trend === 'down' && (
          <span className="text-[color:var(--danger)] inline-flex items-center gap-1">
            <TrendingDown size={11} />
            <span className="tabular-nums">{trendValue}</span>
          </span>
        )}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

export default KPI;
