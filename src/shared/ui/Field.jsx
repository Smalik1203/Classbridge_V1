/**
 * Field — form field wrapper built on shadcn Label.
 *
 *   <Field label="Email" required hint="..." error="...">
 *     <Input type="email" />
 *   </Field>
 */
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function Field({ label, required, hint, error, children, className }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <Label
          className={cn(
            'text-[12.5px] font-medium text-[color:var(--fg)]',
            required && "after:ml-0.5 after:text-[color:var(--danger)] after:content-['*']"
          )}
        >
          {label}
        </Label>
      )}
      {children}
      {hint && !error && <span className="text-xs text-[color:var(--fg-subtle)]">{hint}</span>}
      {error && <span className="text-xs text-[color:var(--danger)]">{error}</span>}
    </div>
  );
}

export default Field;
