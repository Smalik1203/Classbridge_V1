/**
 * Badge — prototype-style status pill, built on shadcn Badge.
 *
 * Variants: success | warning | danger | error | info | accent | neutral
 */
import { Badge as ShadcnBadge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const VARIANT_CLASS = {
  success: 'bg-[color:var(--success-soft)] text-[color:var(--success)]',
  warning: 'bg-[color:var(--warning-soft)] text-[oklch(0.50_0.13_75)] dark:text-[oklch(0.85_0.13_80)]',
  danger:  'bg-[color:var(--danger-soft)]  text-[color:var(--danger)]',
  error:   'bg-[color:var(--danger-soft)]  text-[color:var(--danger)]',
  info:    'bg-[color:var(--info-soft)]    text-[color:var(--info)]',
  accent:  'bg-[color:var(--accent-soft)]  text-[color:var(--primary)]',
  neutral: 'bg-[color:var(--bg-muted)]     text-[color:var(--fg-muted)]',
};

export function Badge({ children, variant = 'neutral', dot, className }) {
  return (
    <ShadcnBadge
      variant="secondary"
      className={cn(
        'h-5 rounded-[5px] px-[7px] text-[11.5px] font-medium border-transparent',
        VARIANT_CLASS[variant] || VARIANT_CLASS.neutral,
        className
      )}
    >
      {dot && (
        <span
          className="size-1.5 rounded-full"
          style={{ background: 'currentColor' }}
        />
      )}
      {children}
    </ShadcnBadge>
  );
}

export default Badge;
