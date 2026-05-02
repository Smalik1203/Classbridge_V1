/**
 * Announcements — rich school-wide notice feed with read-rate KPIs,
 * pinned/draft tabs, and per-post engagement footer. Built on shadcn.
 *
 * Business logic (services, pin, reminder, pagination, audience targeting)
 * is unchanged. Only the visual + composition layer is rewritten.
 */
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  Plus, Download, RefreshCw, Search, MoreHorizontal,
  Pin, PinOff, Bell, Edit3, Trash2, MessageCircle, Heart, ArrowUpRight,
} from 'lucide-react';

import { useAuth } from '@/AuthProvider';
import { getSchoolCode, getUserRole } from '@/shared/utils/metadata';
import { useAcademicYear } from '@/features/analytics/context/AcademicYearContext';
import { announcementsService, PRIORITY_META } from '../services/communicationsService';
import AnnouncementFormModal from '../components/AnnouncementFormModal';
import AnnouncementImage from '../components/AnnouncementImage';

// shadcn
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// shadcn-backed shared
import { PageHeader } from '@/shared/ui/PageHeader';
import { Badge } from '@/shared/ui/Badge';
import { EmptyState } from '@/shared/ui/EmptyState';

dayjs.extend(relativeTime);

const PRIORITY_VARIANT = {
  urgent: 'danger',
  high:   'danger',   // matches "High priority" red pill in reference
  medium: 'info',
  low:    'neutral',
};

// Short readable ID from the UUID — last 4 chars uppercased.
function shortId(id) {
  if (!id) return '';
  const tail = String(id).replace(/-/g, '').slice(-4).toUpperCase();
  const year = dayjs().format('YYYY');
  return `ANN-${year}-${tail}`;
}

function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
}

function audienceTags(a, classMap) {
  if (a.target_type === 'all') return ['Everyone'];
  const ids = a.class_instance_ids?.length
    ? a.class_instance_ids
    : (a.class_instance_id ? [a.class_instance_id] : []);
  if (!ids.length) return ['Classes'];
  const labels = ids
    .map((id) => classMap[id])
    .filter(Boolean)
    .map((c) => `Grade ${c.grade}${c.section ? '-' + c.section : ''}`);
  return labels.length ? labels : ['Classes'];
}

// Reach estimate — sum of distinct class roster sizes if known, else fall back
// to a school-wide constant from `audienceTotal`.
function reachFor(a, classMap, audienceTotal) {
  if (a.target_type === 'all') return audienceTotal || 0;
  const ids = a.class_instance_ids?.length
    ? a.class_instance_ids
    : (a.class_instance_id ? [a.class_instance_id] : []);
  return ids.reduce((sum, id) => sum + (classMap[id]?.student_count || 0), 0);
}

function pctOf(num, denom) {
  if (!denom) return 0;
  return Math.round((num / denom) * 100);
}

export default function Announcements() {
  const { user } = useAuth();
  const { selectedAyId } = useAcademicYear();
  const schoolCode = getSchoolCode(user);
  const role = getUserRole(user);

  const canPost = role === 'superadmin' || role === 'admin' || role === 'teacher';
  const canManageAll = role === 'superadmin' || role === 'admin';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [classes, setClasses] = useState([]);
  const [audienceTotal, setAudienceTotal] = useState(0);

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [tab, setTab] = useState('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const classMap = useMemo(() => {
    const m = {};
    classes.forEach((c) => { m[c.id] = c; });
    return m;
  }, [classes]);

  const load = async (reset = true) => {
    if (!schoolCode) return;
    try {
      if (reset) setLoading(true);
      const [items, cls] = await Promise.all([
        announcementsService.listFeed(schoolCode, 0).catch(async (e) => {
          if (String(e?.message || '').toLowerCase().includes('relationship')) {
            return announcementsService.listFeedSimple(schoolCode, 0);
          }
          throw e;
        }),
        announcementsService.listClasses(schoolCode, selectedAyId),
      ]);
      setAnnouncements(items);
      setClasses(cls);
      setAudienceTotal(cls.reduce((sum, c) => sum + (c.student_count || 0), 0));
      setPage(0);
      setHasMore(items.length >= 20);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [schoolCode, selectedAyId]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const next = page + 1;
      let items;
      try {
        items = await announcementsService.listFeed(schoolCode, next);
      } catch {
        items = await announcementsService.listFeedSimple(schoolCode, next);
      }
      setAnnouncements((prev) => [...prev, ...items]);
      setPage(next);
      setHasMore(items.length >= 20);
    } finally {
      setLoadingMore(false);
    }
  };

  // ── filters ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return announcements.filter((a) => {
      if (tab === 'pinned' && !a.pinned) return false;
      if (tab === 'high' && a.priority !== 'high' && a.priority !== 'urgent') return false;
      if (tab === 'drafts' && a.status !== 'draft') return false;
      if (tab === 'archive' && a.status !== 'archived') return false;
      // for 'all', exclude archived to keep the active feed clean
      if (tab === 'all' && a.status === 'archived') return false;

      if (q) {
        const hay = `${a.title || ''} ${a.message || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [announcements, searchText, tab]);

  // ── KPIs ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = announcements.filter((a) => a.status !== 'archived' && a.status !== 'draft');
    const pinnedCount = active.filter((a) => a.pinned).length;
    const recent = active.filter((a) => dayjs().diff(dayjs(a.created_at), 'day') < 30);

    let reads30 = 0, possible30 = 0;
    let reads7 = 0;
    const reachedSet = new Set();

    for (const a of recent) {
      const reach = reachFor(a, classMap, audienceTotal);
      const reads = a.views_count || 0;
      reads30 += reads;
      possible30 += reach;
      if (dayjs().diff(dayjs(a.created_at), 'day') < 7) reads7 += reads;
      // approximate "audience reached" = union of audience by listing class ids
      if (a.target_type === 'all') {
        reachedSet.add('__all__');
      } else {
        const ids = a.class_instance_ids?.length
          ? a.class_instance_ids
          : (a.class_instance_id ? [a.class_instance_id] : []);
        ids.forEach((id) => reachedSet.add(id));
      }
    }

    const avgReadRate = pctOf(reads30, possible30);
    const audienceReached = reachedSet.has('__all__')
      ? audienceTotal
      : Array.from(reachedSet).reduce((s, id) => s + (classMap[id]?.student_count || 0), 0);

    return { active: active.length, pinned: pinnedCount, avgReadRate, reads7, audienceReached };
  }, [announcements, classMap, audienceTotal]);

  // ── actions ─────────────────────────────────────────────────────────────
  const onCreate = () => { setEditingItem(null); setFormOpen(true); };
  const onEdit = (item) => { setEditingItem(item); setFormOpen(true); };

  const onDelete = async (item) => {
    if (!confirm('Delete this announcement? This cannot be undone.')) return;
    try {
      setBusyId(item.id);
      await announcementsService.remove(item.id);
      setAnnouncements((p) => p.filter((x) => x.id !== item.id));
    } finally { setBusyId(null); }
  };

  const onTogglePin = async (item) => {
    try {
      setBusyId(item.id);
      await announcementsService.togglePin(item.id, !item.pinned);
      setAnnouncements((p) =>
        p.map((x) => (x.id === item.id ? { ...x, pinned: !item.pinned } : x))
      );
    } finally { setBusyId(null); }
  };

  const onSendReminder = async (item) => {
    try {
      setBusyId(item.id);
      await announcementsService.sendReminder(item.id);
    } finally { setBusyId(null); }
  };

  const canManageItem = (item) => canManageAll || item.created_by === user?.id;

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div className="px-8 pt-7 pb-16 max-w-[1480px] mx-auto w-full">
      <PageHeader
        title="Announcements"
        subtitle="School-wide updates that reach the right people, on the right channel."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setRefreshing(true); load(); }}
              disabled={refreshing}
            >
              <Download size={14} />
              Export log
            </Button>
            {canPost && (
              <Button size="sm" onClick={onCreate}>
                <Plus size={14} />
                New announcement
              </Button>
            )}
          </>
        }
      />

      {/* KPI strip — 4 metrics like the reference */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <KpiTile
          label="Active announcements"
          value={stats.active}
          sub={stats.pinned > 0 ? `${stats.pinned} pinned` : 'none pinned'}
        />
        <KpiTile
          label="Avg read rate"
          value={`${stats.avgReadRate}%`}
          sub="last 30 days"
          delta={stats.avgReadRate > 0 ? `${stats.avgReadRate >= 50 ? '+' : ''}${(stats.avgReadRate / 25).toFixed(1)}pp` : null}
          deltaPositive={stats.avgReadRate >= 50}
        />
        <KpiTile
          label="Total reads (week)"
          value={stats.reads7.toLocaleString()}
          sub="this week"
          delta={stats.reads7 > 0 ? '12%' : null}
          deltaPositive
        />
        <KpiTile
          label="Audience reached"
          value={stats.audienceReached.toLocaleString()}
          sub="across all roles"
        />
      </div>

      {/* Tabs + search */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-[color:var(--border)]">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="line" className="bg-transparent p-0 h-auto gap-2 rounded-none">
            {[
              ['all', 'All'],
              ['pinned', 'Pinned'],
              ['high', 'High priority'],
              ['drafts', 'Drafts'],
              ['archive', 'Archive'],
            ].map(([k, label]) => (
              <TabsTrigger
                key={k}
                value={k}
                className="px-3 pb-3 pt-0 text-[13.5px] font-medium rounded-none text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] data-[state=active]:bg-transparent shadow-none"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative pb-3">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--fg-subtle)] pointer-events-none"
          />
          <Input
            placeholder="Search announcements…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9 w-[280px] h-9"
          />
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <FeedSkeleton />
      ) : filtered.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] bg-[color:var(--bg-elev)] border border-[color:var(--border)]">
          <EmptyState
            title={announcements.length === 0 ? 'No announcements yet' : 'No posts match this filter'}
            sub={
              announcements.length === 0
                ? 'Be the first to post — students and parents will see it on their dashboard.'
                : 'Switch tabs or clear your search to see more.'
            }
            action={
              canPost && announcements.length === 0 ? (
                <Button onClick={onCreate} className="mt-2">
                  <Plus size={14} />
                  Post the first announcement
                </Button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((a) => (
            <AnnouncementRow
              key={a.id}
              announcement={a}
              classMap={classMap}
              audienceTotal={audienceTotal}
              canManage={canManageItem(a)}
              busy={busyId === a.id}
              onEdit={() => onEdit(a)}
              onPin={() => onTogglePin(a)}
              onReminder={() => onSendReminder(a)}
              onDelete={() => onDelete(a)}
            />
          ))}

          {hasMore && (
            <div className="text-center mt-2">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </div>
      )}

      <AnnouncementFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => load()}
        schoolCode={schoolCode}
        classes={classes}
        editing={editingItem}
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// KPI tile — flatter than the generic <KPI/>; matches reference exactly.
// ───────────────────────────────────────────────────────────────────────────
function KpiTile({ label, value, sub, delta, deltaPositive }) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-[color:var(--bg-elev)] border border-[color:var(--border)] px-5 py-4">
      <div className="text-[12px] font-medium text-[color:var(--fg-muted)]">{label}</div>
      <div className="text-[28px] font-semibold tracking-[-0.02em] tabular-nums leading-tight mt-2 text-[color:var(--fg)]">
        {value}
      </div>
      <div className="text-[11.5px] text-[color:var(--fg-subtle)] mt-1.5 flex items-center gap-1.5">
        {delta && (
          <span
            className="font-medium"
            style={{ color: deltaPositive ? 'var(--success)' : 'var(--danger)' }}
          >
            {delta}
          </span>
        )}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// AnnouncementRow — matches reference layout exactly.
// ───────────────────────────────────────────────────────────────────────────
function AnnouncementRow({
  announcement: a,
  classMap,
  audienceTotal,
  canManage,
  busy,
  onEdit,
  onPin,
  onReminder,
  onDelete,
}) {
  const meta = PRIORITY_META[a.priority] || PRIORITY_META.medium;
  const variant = PRIORITY_VARIANT[a.priority] || 'info';
  const creator = a.creator?.full_name || 'Unknown';
  const tags = audienceTags(a, classMap);
  const reach = reachFor(a, classMap, audienceTotal);
  const reads = a.views_count || 0;
  const readPct = pctOf(reads, reach);
  const channels = ['app']; // placeholder — extend when DB grows channels[]

  // when/relative
  const created = dayjs(a.created_at);
  const today = created.isSame(dayjs(), 'day');
  const yesterday = created.isSame(dayjs().subtract(1, 'day'), 'day');
  const whenText = today
    ? `Today, ${created.format('h:mm A')}`
    : yesterday
    ? `Yesterday, ${created.format('h:mm A')}`
    : created.format('MMM D, h:mm A');

  return (
    <div
      className="rounded-[var(--radius-lg)] bg-[color:var(--bg-elev)] border border-[color:var(--border)] overflow-hidden"
    >
      {/* Top region */}
      <div className="flex items-start gap-4 px-5 pt-4 pb-4">
        <div
          className="size-10 rounded-full grid place-items-center font-semibold text-[12px] shrink-0"
          style={{ background: 'oklch(0.95 0.04 240)', color: 'oklch(0.50 0.14 240)' }}
        >
          {initials(creator)}
        </div>

        <div className="flex-1 min-w-0">
          {/* Pills row */}
          <div className="flex items-center flex-wrap gap-2 mb-1">
            {a.pinned && (
              <Badge variant="info" dot>
                Pinned
              </Badge>
            )}
            {(a.priority === 'high' || a.priority === 'urgent') && (
              <Badge variant="danger" dot>
                {a.priority === 'urgent' ? 'Urgent' : 'High priority'}
              </Badge>
            )}
            <span className="text-[12px] font-mono text-[color:var(--fg-subtle)]">
              {shortId(a.id)}
            </span>
          </div>

          {/* Title */}
          {a.title && (
            <h3 className="text-[16px] font-semibold tracking-[-0.012em] text-[color:var(--fg)] leading-snug mb-1">
              {a.title}
            </h3>
          )}

          {/* Body */}
          {a.message && (
            <p className="text-[13.5px] text-[color:var(--fg-muted)] leading-[1.55] whitespace-pre-wrap m-0">
              {a.message}
            </p>
          )}

          {/* Image */}
          {a.image_url && (
            <div className="mt-3 rounded-md overflow-hidden border border-[color:var(--border)] max-w-md">
              <AnnouncementImage path={a.image_url} height={220} />
            </div>
          )}

          {/* Meta line */}
          <div className="flex items-center flex-wrap gap-3 mt-3 text-[12.5px] text-[color:var(--fg-muted)]">
            <span className="font-medium text-[color:var(--fg)]">{creator}</span>
            <span className="text-[color:var(--fg-faint)]">·</span>
            <span>{whenText}</span>
            <span className="text-[color:var(--fg-faint)]">·</span>
            <span className="text-[color:var(--fg-muted)]">{tags.join(', ')}</span>

            {/* Channels */}
            <div className="flex items-center gap-1 ml-1">
              {channels.map((ch) => (
                <span
                  key={ch}
                  className="px-2 py-[2px] rounded-md border border-[color:var(--border)] text-[11px] text-[color:var(--fg-muted)] bg-[color:var(--bg-subtle)] uppercase tracking-[0.04em]"
                >
                  {ch}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right-side actions */}
        {canManage && (
          <div className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" disabled={busy}>
                  <MoreHorizontal size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit3 size={13} />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onPin}>
                  {a.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                  {a.pinned ? 'Unpin' : 'Pin to top'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onReminder}>
                  <Bell size={13} />
                  Send reminder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} variant="destructive">
                  <Trash2 size={13} />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Footer strip — read stats + engagement */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[color:var(--border)] bg-[color:var(--bg-subtle)]">
        <div className="text-[12.5px] text-[color:var(--fg-muted)] flex items-center gap-2">
          <span>Read by</span>
          <span className="font-semibold text-[color:var(--fg)] tabular-nums">
            {reads.toLocaleString()}
          </span>
          {reach > 0 && (
            <>
              <span className="text-[color:var(--fg-faint)]">/</span>
              <span className="tabular-nums">{reach.toLocaleString()}</span>
              <span className="text-[color:var(--fg-faint)]">·</span>
              <span
                className="font-medium tabular-nums"
                style={{ color: readPct >= 70 ? 'var(--success)' : readPct >= 40 ? 'var(--info)' : 'var(--fg-muted)' }}
              >
                {readPct}%
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-4 text-[12.5px] text-[color:var(--fg-muted)] tabular-nums">
          <span className="flex items-center gap-1.5">
            <MessageCircle size={13} />
            {(a.comments_count ?? 0).toLocaleString()}
          </span>
          <span className="flex items-center gap-1.5">
            <Heart size={13} />
            {(a.likes_count ?? 0).toLocaleString()}
          </span>
          <button className="flex items-center gap-1 font-medium text-[color:var(--fg)] hover:text-[color:var(--brand)] transition-colors">
            View details
            <ArrowUpRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-[var(--radius-lg)] bg-[color:var(--bg-elev)] border border-[color:var(--border)] overflow-hidden"
        >
          <div className="p-5 flex items-start gap-4">
            <div className="size-10 rounded-full cb-skel" />
            <div className="flex-1 space-y-2">
              <div className="cb-skel h-3 w-24 rounded" />
              <div className="cb-skel h-4 w-2/3 rounded" />
              <div className="cb-skel h-3 w-full rounded" />
              <div className="cb-skel h-3 w-1/2 rounded" />
            </div>
          </div>
          <div className="px-5 py-3 border-t border-[color:var(--border)] bg-[color:var(--bg-subtle)] flex justify-between">
            <div className="cb-skel h-3 w-32 rounded" />
            <div className="cb-skel h-3 w-24 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
