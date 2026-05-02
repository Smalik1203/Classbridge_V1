/**
 * Modal — prototype-style modal built on shadcn Dialog (Radix Dialog).
 *
 * Usage matches the prototype:
 *   <Modal open onClose={...} title="..." sub="..." footer={<>...</>} width={520}>
 *     ...
 *   </Modal>
 */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export function Modal({ open, onClose, title, sub, children, footer, width = 480, className }) {
  return (
    <Dialog open={!!open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent
        className={cn(
          // override shadcn defaults to match prototype
          'gap-0 p-0 sm:max-w-none',
          'bg-[color:var(--bg-elev)] border-[color:var(--border)] rounded-[var(--radius-lg)]',
          'flex flex-col max-h-[calc(100vh-64px)]',
          className
        )}
        style={{ width }}
        showCloseButton={false}
      >
        {(title || sub) && (
          <DialogHeader className="px-6 pt-[18px] pb-4 border-b border-[color:var(--border)] flex-row items-start justify-between gap-4 flex-shrink-0">
            <div className="text-left">
              {title && (
                <DialogTitle className="text-[17px] font-semibold tracking-[-0.012em] text-[color:var(--fg)] leading-tight">
                  {title}
                </DialogTitle>
              )}
              {sub && (
                <DialogDescription className="text-[12.5px] text-[color:var(--fg-subtle)] mt-1">
                  {sub}
                </DialogDescription>
              )}
            </div>
          </DialogHeader>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <DialogFooter className="px-6 py-3.5 border-t border-[color:var(--border)] bg-[color:var(--bg-subtle)] flex-shrink-0 sm:justify-end gap-2">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default Modal;
