/**
 * MultiSelect — popover-based multi-pick control with checkboxes and a
 * search box. Renders selected values as removable chips above the trigger.
 *
 *   <MultiSelect
 *     value={ids}
 *     onChange={setIds}
 *     options={[{ value: 'cls-1', label: 'Grade 1-A' }, …]}
 *     placeholder="Pick classes…"
 *     searchPlaceholder="Search classes…"
 *     dedupeKey={(opt) => opt.label}   // optional — collapse duplicate labels
 *   />
 *
 * Built on shadcn Popover + Checkbox (Radix). Popover content is portaled,
 * so it stacks correctly above an open Dialog/Sheet (no more behind-modal
 * dropdowns). Trigger button width follows its parent.
 */
import { useMemo, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function MultiSelect({
  value = [],
  onChange,
  options = [],
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  dedupeKey,
  emptyText = 'No options',
  className,
  triggerClassName,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Dedupe options by `dedupeKey` (defaults to identity by `value`).
  const uniqueOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const opt of options) {
      const key = dedupeKey ? dedupeKey(opt) : opt.value;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(opt);
    }
    return out;
  }, [options, dedupeKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return uniqueOptions;
    return uniqueOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [uniqueOptions, query]);

  const valueSet = useMemo(() => new Set(value), [value]);
  const selectedOptions = useMemo(
    () => uniqueOptions.filter((o) => valueSet.has(o.value)),
    [uniqueOptions, valueSet],
  );

  const toggle = (optValue) => {
    if (valueSet.has(optValue)) {
      onChange?.(value.filter((v) => v !== optValue));
    } else {
      onChange?.([...value, optValue]);
    }
  };

  const removeOne = (optValue) => onChange?.(value.filter((v) => v !== optValue));
  const clearAll = () => onChange?.([]);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Selected chips */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => removeOne(opt.value)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[12px] font-medium bg-[color:var(--brand-soft)] text-[color:var(--brand)] hover:bg-[color:var(--brand-soft)]/70 transition-colors"
              title="Remove"
            >
              {opt.label}
              <X size={11} className="opacity-70" />
            </button>
          ))}
          {selectedOptions.length > 1 && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11.5px] font-medium text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Trigger */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex items-center justify-between gap-2 w-full h-9 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-elev)] px-3 text-[13px] text-left transition-colors',
              'hover:border-[color:var(--border-strong)]',
              'focus-visible:outline-none focus-visible:border-[color:var(--brand)] focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]',
              triggerClassName,
            )}
          >
            <span
              className={cn(
                selectedOptions.length === 0 && 'text-[color:var(--fg-faint)]',
              )}
            >
              {selectedOptions.length === 0
                ? placeholder
                : `${selectedOptions.length} selected`}
            </span>
            <ChevronDown size={14} className="text-[color:var(--fg-subtle)] shrink-0" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[260px]"
          align="start"
          sideOffset={4}
        >
          {/* Search */}
          <div className="p-2 border-b border-[color:var(--border)]">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--fg-subtle)] pointer-events-none"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-8 h-8 text-[12.5px]"
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-[260px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12.5px] text-[color:var(--fg-subtle)]">
                {emptyText}
              </div>
            ) : (
              filtered.map((opt) => {
                const checked = valueSet.has(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggle(opt.value)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left hover:bg-[color:var(--bg-subtle)] transition-colors"
                  >
                    <Checkbox checked={checked} className="shrink-0" tabIndex={-1} />
                    <span className="flex-1 truncate">{opt.label}</span>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {selectedOptions.length > 0 && (
            <div className="px-3 py-2 border-t border-[color:var(--border)] flex items-center justify-between">
              <span className="text-[11.5px] text-[color:var(--fg-subtle)]">
                {selectedOptions.length} selected
              </span>
              <button
                type="button"
                onClick={clearAll}
                className="text-[11.5px] font-medium text-[color:var(--brand)] hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default MultiSelect;
