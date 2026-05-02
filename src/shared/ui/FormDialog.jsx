/**
 * FormDialog — reusable form modal built on shadcn Dialog.
 *
 *   <FormDialog
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     title="Edit Announcement"
 *     description="Optional"
 *     onSubmit={async (e) => { ... }}
 *     submitLabel="Save changes"
 *     submitting={busy}
 *     width={680}
 *   >
 *     <Field label="Title">
 *       <Input ... />
 *     </Field>
 *     ...
 *   </FormDialog>
 *
 * The form layer handles the <form onSubmit/>, prevents the dialog from
 * closing while a submit is in flight, and exposes consistent Cancel +
 * Submit buttons. Validation/business logic stays in the parent.
 */
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function FormDialog({
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
    <Dialog
      open={!!open}
      onOpenChange={(o) => {
        if (!o && !submitting) onClose?.();
      }}
    >
      <DialogContent
        className={cn(
          'gap-0 p-0 sm:max-w-none flex flex-col max-h-[calc(100vh-64px)]',
          'bg-[color:var(--bg-elev)] border-[color:var(--border)] rounded-[var(--radius-lg)]',
          className,
        )}
        style={{ width }}
        showCloseButton={!submitting}
      >
        <form onSubmit={handleSubmit} className="contents">
          {(title || description) && (
            <DialogHeader className="px-6 pt-[18px] pb-4 border-b border-[color:var(--border)] flex-row items-start justify-between gap-4 flex-shrink-0 space-y-0">
              <div className="text-left">
                {title && (
                  <DialogTitle className="text-[17px] font-semibold tracking-[-0.012em] text-[color:var(--fg)] leading-tight">
                    {title}
                  </DialogTitle>
                )}
                {description && (
                  <DialogDescription className="text-[12.5px] text-[color:var(--fg-subtle)] mt-1">
                    {description}
                  </DialogDescription>
                )}
              </div>
            </DialogHeader>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
            {children}
          </div>

          <DialogFooter className="px-6 py-3.5 border-t border-[color:var(--border)] bg-[color:var(--bg-subtle)] flex-shrink-0 sm:justify-end gap-2 flex-row">
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default FormDialog;
