/**
 * OptionGroup — segmented radio-like control. One option is selected at a
 * time; the active option uses brand styling. Each option can have an icon.
 *
 *   <OptionGroup
 *     value={priority}
 *     onChange={setPriority}
 *     options={[
 *       { value: 'urgent', label: 'Urgent', icon: '🚨' },
 *       { value: 'high',   label: 'High',   icon: '⚠️' },
 *       ...
 *     ]}
 *   />
 *
 * Used for short, mutually-exclusive choices (priority, sentiment, audience
 * type). Renders inline; wraps onto multiple rows on narrow viewports.
 */
import { cn } from '@/lib/utils';

export function OptionGroup({
  value,
  onChange,
  options = [],
  className,
  disabled,
  size = 'md',
}) {
  return (
    <div
      role="radiogroup"
      className={cn('inline-flex flex-wrap gap-1.5', className)}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled || opt.disabled}
            onClick={() => onChange?.(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border transition-colors font-medium',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] focus-visible:ring-offset-1',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              size === 'sm' ? 'h-8 px-3 text-[12.5px]' : 'h-9 px-3.5 text-[13px]',
              isActive
                ? 'bg-[color:var(--brand)] text-white border-[color:var(--brand)] shadow-sm'
                : 'bg-[color:var(--bg-elev)] text-[color:var(--fg)] border-[color:var(--border)] hover:bg-[color:var(--bg-subtle)] hover:border-[color:var(--border-strong)]',
            )}
          >
            {opt.icon && <span className="text-[14px] leading-none">{opt.icon}</span>}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * RadioRow — circular-radio list (like the "Audience" choices in the
 * screenshot: ◉ Everyone in school   ○ Specific classes).
 */
export function RadioRow({
  value,
  onChange,
  options = [],
  className,
  direction = 'horizontal',
  disabled,
}) {
  return (
    <div
      role="radiogroup"
      className={cn(
        'flex gap-5',
        direction === 'vertical' && 'flex-col gap-2.5',
        className,
      )}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <label
            key={opt.value}
            className={cn(
              'inline-flex items-center gap-2 cursor-pointer text-[13.5px] text-[color:var(--fg)]',
              (disabled || opt.disabled) && 'opacity-50 cursor-not-allowed',
            )}
          >
            <button
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={disabled || opt.disabled}
              onClick={() => onChange?.(opt.value)}
              className={cn(
                'size-[18px] rounded-full border flex items-center justify-center transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] focus-visible:ring-offset-1',
                isActive
                  ? 'border-[color:var(--brand)] bg-[color:var(--brand)]'
                  : 'border-[color:var(--border-strong)] bg-[color:var(--bg-elev)] hover:border-[color:var(--brand)]',
              )}
            >
              {isActive && <span className="size-1.5 rounded-full bg-white" />}
            </button>
            <span>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export default OptionGroup;
