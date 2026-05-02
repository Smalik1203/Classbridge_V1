/**
 * Drawer — prototype-style side panel built on shadcn Sheet (Radix Dialog).
 *
 * Usage:
 *   <Drawer open onClose={...} title="..." sub="..." footer={<>...</>} width={520}>
 *     ...
 *   </Drawer>
 */
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export function Drawer({ open, onClose, title, sub, children, footer, width = 520, side = 'right', className }) {
  return (
    <Sheet open={!!open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <SheetContent
        side={side}
        showCloseButton
        className={cn(
          // override shadcn defaults — uncap width, match prototype shell
          'gap-0 p-0 w-full sm:max-w-none',
          'bg-[color:var(--bg-elev)] border-[color:var(--border)]',
          className
        )}
        style={{ maxWidth: width }}
      >
        {(title || sub) && (
          <SheetHeader className="px-6 pt-[18px] pb-4 border-b border-[color:var(--border)] flex-row items-start justify-between gap-4 flex-shrink-0 space-y-0">
            <div className="text-left flex-1 min-w-0">
              {title && (
                <SheetTitle className="text-[18px] font-semibold tracking-[-0.012em] text-[color:var(--fg)] leading-tight">
                  {title}
                </SheetTitle>
              )}
              {sub && (
                <SheetDescription className="text-[12.5px] text-[color:var(--fg-subtle)] mt-1">
                  {sub}
                </SheetDescription>
              )}
            </div>
          </SheetHeader>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <SheetFooter className="px-6 py-3.5 border-t border-[color:var(--border)] bg-[color:var(--bg-subtle)] flex-shrink-0 flex-row sm:flex-row sm:justify-end gap-2">
            {footer}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default Drawer;
