// Topbar notification bell + popover. Self-contained: holds its own state
// (currently a local stub that starts empty) so it can be wired to a real
// notifications source later without touching the layout.
//
// Behavior:
//   - Bell button opens a panel on click.
//   - Blue indicator dot is shown ONLY when there is at least one unread
//     notification.
//   - When the list is empty, the panel renders an empty-state message
//     ("No recent notifications").

import { useMemo, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// Replace this with real data later (e.g. a hook bound to Supabase).
const INITIAL_NOTIFICATIONS = [];

function formatRelative(date) {
  const diff = Date.now() - new Date(date).getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function NotificationBell({ className }) {
  const [items, setItems] = useState(INITIAL_NOTIFICATIONS);

  const unreadCount = useMemo(
    () => items.filter((n) => !n.read).length,
    [items],
  );
  const hasUnread = unreadCount > 0;
  const hasAny = items.length > 0;

  const markAllRead = () => {
    setItems((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
  };

  const markOneRead = (id) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id && !n.read ? { ...n, read: true } : n)),
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            hasUnread
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications'
          }
          className={cn(
            'relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]',
            className,
          )}
        >
          <Bell size={15} />
          {hasUnread && (
            <span
              aria-hidden="true"
              className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--brand)] ring-2 ring-background"
            />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[340px] p-0"
      >
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Notifications</span>
            {hasUnread && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand-soft)] px-1.5 text-[11px] font-medium text-[var(--brand)]">
                {unreadCount}
              </span>
            )}
          </div>
          {hasUnread && (
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CheckCheck size={12} />
              Mark all read
            </button>
          )}
        </div>

        {!hasAny ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Bell size={16} />
            </div>
            <p className="text-sm font-medium text-foreground">All caught up</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              No recent notifications.
            </p>
          </div>
        ) : (
          <ul className="max-h-[360px] divide-y overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => markOneRead(n.id)}
                  className={cn(
                    'group flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60',
                    !n.read && 'bg-[var(--brand-soft)]/35',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                      n.read ? 'bg-transparent' : 'bg-[var(--brand)]',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-foreground">
                      {n.title}
                    </span>
                    {n.body && (
                      <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground line-clamp-2">
                        {n.body}
                      </span>
                    )}
                    {n.createdAt && (
                      <span className="mt-1 block text-[11px] text-muted-foreground/80">
                        {formatRelative(n.createdAt)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
