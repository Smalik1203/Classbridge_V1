/**
 * Card — prototype-style card built on shadcn's Card primitive.
 *
 * Usage matches the prototype:
 *   <Card title="..." sub="..." actions={...} padded={true|false}>...</Card>
 *
 * Underlying primitive: shadcn Card (Radix-styled, semantic tokens).
 */
import {
  Card as ShadcnCard,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function Card({ title, sub, actions, children, padded = true, className = '' }) {
  const showHeader = title || actions;

  return (
    <ShadcnCard
      className={cn(
        // override shadcn's defaults to match prototype look
        'gap-0 py-0 rounded-[var(--radius-lg)] border-[color:var(--border)] bg-[color:var(--bg-elev)] shadow-none',
        className
      )}
    >
      {showHeader && (
        <CardHeader
          className={cn(
            'px-[22px] py-[14px] min-h-[52px] border-b border-[color:var(--border)]',
            // override shadcn grid layout — use flex for our row
            '!grid-cols-[1fr_auto] gap-3 items-center'
          )}
        >
          <div>
            {title && (
              <CardTitle className="text-[14px] font-semibold tracking-[-0.01em] text-[color:var(--fg)]">
                {title}
              </CardTitle>
            )}
            {sub && (
              <CardDescription className="text-[12.5px] mt-0.5 text-[color:var(--fg-subtle)]">
                {sub}
              </CardDescription>
            )}
          </div>
          {actions && (
            <CardAction className="flex items-center gap-2">
              {actions}
            </CardAction>
          )}
        </CardHeader>
      )}
      <CardContent className={cn('px-0', padded && 'p-[20px_22px]')}>
        {children}
      </CardContent>
    </ShadcnCard>
  );
}

export default Card;
