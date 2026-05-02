/**
 * FormDrawer — reusable form side-panel built on shadcn Sheet.
 *
 *   <FormDrawer
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     title="Edit User"
 *     description="Update profile and permissions"
 *     onSubmit={async (e) => { ... }}
 *     submitLabel="Save"
 *     submitting={busy}
 *     width={520}
 *   >
 *     <Field label="Name">
 *       <Input ... />
 *     </Field>
 *   </FormDrawer>
 *
 * Same contract as FormDialog — but slides in from the right. Use this for
 * heavier forms (multi-section, long lists). FormDialog for short ones.
 */
import { useState } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function FormDrawer({
  open,
  onClose,
  title,
  description,
  children,
  onSubmit,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  submitting: submittingProp,
  width = 520,
  side = 'right',
  destructive = false,
  className,
}) {
  const [internalSubmitting, setInternalSubmitting] = useState(false);
  const submitting = submittingProp ?? internalSubmitting;

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    if (!onSubmit) return;
    try {
      setInternalSubmitting(true);
      await onSubmit(e);
    } finally {
      setInternalSubmitting(false);
    }
  }

  return (
    <Sheet
      open={!!open}
      onOpenChange={(o) => {
        if (!o && !submitting) onClose?.();
      }}
    >
      <SheetContent
        side={side}
        showCloseButton={!submitting}
        className={cn(
          'gap-0 p-0 w-full sm:max-w-none flex flex-col',
          'bg-[color:var(--bg-elev)] border-[color:var(--border)]',
          className,
        )}
        style={{ maxWidth: width }}
      >
        <form onSubmit={handleSubmit} className="contents">
          {(title || description) && (
            <SheetHeader className="px-6 pt-[18px] pb-4 border-b border-[color:var(--border)] flex-row items-start justify-between gap-4 flex-shrink-0 space-y-0">
              <div className="text-left flex-1 min-w-0">
                {title && (
                  <SheetTitle className="text-[18px] font-semibold tracking-[-0.012em] text-[color:var(--fg)] leading-tight">
                    {title}
                  </SheetTitle>
                )}
                {description && (
                  <SheetDescription className="text-[12.5px] text-[color:var(--fg-subtle)] mt-1">
                    {description}
                  </SheetDescription>
                )}
              </div>
            </SheetHeader>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
            {children}
          </div>

          <SheetFooter className="px-6 py-3.5 border-t border-[color:var(--border)] bg-[color:var(--bg-subtle)] flex-shrink-0 flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onClose?.()}
              disabled={submitting}
            >
              {cancelLabel}
            </Button>
            <Button
              type="submit"
              size="sm"
              variant={destructive ? 'destructive' : 'default'}
              disabled={submitting}
            >
              {submitting ? 'Saving…' : submitLabel}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export default FormDrawer;
