import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as AntApp } from 'antd';
import {
  Check, X, RefreshCw, Settings2, IdCard, FileCheck2, Users, CalendarDays, Hourglass, CheckCircle2,
} from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

import { hrService } from '../services/hrService';
import LeaveTypesModal from '../components/LeaveTypesModal';
import {
  PageHeader, KpiTile, SectionCard, EmptyState, StatusPill, AlertBar,
} from '../components/visuals';
import { cn } from '@/lib/utils';

dayjs.extend(relativeTime);

export default function LeavesApprovals() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const navigate = useNavigate();
  const { message } = AntApp.useApp();

  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState([]);
  const [reviewing, setReviewing] = useState(null);
  const [reviewMode, setReviewMode] = useState('approve');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);

  const load = async () => {
    if (!schoolCode) return;
    try {
      setLoading(true);
      const data = await hrService.listPendingLeaveApplications(schoolCode);
      setPending(data);
    } catch (e) {
      message.error(e.message || 'Failed to load pending leaves');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [schoolCode]);

  const stats = useMemo(() => ({
    count: pending.length,
    days: pending.reduce((s, p) => s + Number(p.days || 0), 0),
    staff: new Set(pending.map((p) => p.employee_id)).size,
  }), [pending]);

  const openReview = (item, mode) => {
    setReviewing(item);
    setReviewMode(mode);
    setNote('');
  };

  const submitReview = async () => {
    if (!reviewing) return;
    try {
      setBusy(true);
      if (reviewMode === 'approve') await hrService.approveLeave(reviewing.id, note || undefined);
      else await hrService.rejectLeave(reviewing.id, note || undefined);
      message.success(reviewMode === 'approve' ? 'Leave approved' : 'Leave rejected');
      setPending((p) => p.filter((x) => x.id !== reviewing.id));
      setReviewing(null);
    } catch (e) {
      message.error(e.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const formatRange = (from, to) => {
    const f = dayjs(from), t = dayjs(to);
    if (f.isSame(t, 'day')) return f.format('DD MMM YYYY');
    if (f.isSame(t, 'month')) return `${f.format('DD')} → ${t.format('DD MMM YYYY')}`;
    return `${f.format('DD MMM')} → ${t.format('DD MMM YYYY')}`;
  };

  if (loading) {
    return (
      <div className="px-7 py-6 max-w-[1200px] mx-auto space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="px-7 py-6 max-w-[1200px] mx-auto">
      <PageHeader
        eyebrow="Approvals queue"
        title="Leaves & Approvals"
        subtitle="Review pending leave applications across all staff"
        actions={
          <>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => setTypesOpen(true)}>
              <Settings2 />
              Leave types
            </Button>
          </>
        }
      />

      {stats.count > 0 ? (
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 via-amber-400 to-orange-400 text-white p-5 mb-5 shadow-lg shadow-amber-500/30 relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full"
            style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.25), transparent)' }}
          />
          <div className="relative z-10 flex items-center gap-3">
            <div className="grid place-items-center size-12 rounded-xl bg-white/20">
              <Hourglass size={22} />
            </div>
            <div className="flex-1">
              <div className="text-lg font-bold leading-tight">
                {stats.count} request{stats.count > 1 ? 's' : ''} awaiting your review
              </div>
              <div className="text-sm text-white/90 mt-0.5">
                {stats.days.toFixed(1)} total day{stats.days === 1 ? '' : 's'} · {stats.staff} staff member{stats.staff > 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <AlertBar
          tone="emerald"
          className="mb-5"
          icon={<CheckCircle2 size={18} className="text-emerald-600" />}
          title="All caught up"
          description="No leave requests waiting for review right now."
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <KpiTile tone="amber" label="Pending requests" value={stats.count} icon={<FileCheck2 size={16} />} />
        <KpiTile tone="brand" label="Total days" value={stats.days.toFixed(1)} icon={<CalendarDays size={16} />} />
        <KpiTile tone="sky" label="Staff" value={stats.staff} icon={<Users size={16} />} />
      </div>

      <SectionCard padding={pending.length === 0 ? 'p-0' : 'p-0'}>
        {pending.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={20} />}
            title="No pending requests"
            subtitle="When staff submit leave applications they'll appear here."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {pending.map((item) => (
              <li
                key={item.id}
                className="px-5 py-4 flex flex-wrap items-start gap-4 hover:bg-slate-50/70 transition-colors"
              >
                <div className="grid place-items-center size-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow-sm shadow-indigo-500/30 shrink-0">
                  <IdCard size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">{item.employees?.full_name}</span>
                    {item.employees?.designation && (
                      <span className="text-xs text-slate-500">· {item.employees.designation}</span>
                    )}
                    <StatusPill tone="brand">{item.leave_types?.code}</StatusPill>
                    {item.is_half_day && <StatusPill tone="sky">Half-day · {item.half_day_slot}</StatusPill>}
                  </div>
                  <div className="text-sm text-slate-700 mt-1.5">
                    <span className="font-medium">{formatRange(item.from_date, item.to_date)}</span>
                    <span className="mx-1.5 text-slate-400">·</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 font-semibold text-xs tabular-nums">
                      {item.days} day{item.days > 1 ? 's' : ''}
                    </span>
                  </div>
                  {item.reason && (
                    <div className="text-sm text-slate-600 italic mt-1.5 max-w-[640px]">"{item.reason}"</div>
                  )}
                  <div className="text-[11px] text-slate-400 mt-1.5">Applied {dayjs(item.applied_at).fromNow()}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    className={cn('bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-sm shadow-emerald-500/25')}
                    onClick={() => openReview(item, 'approve')}
                  >
                    <Check />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="text-rose-700 border-rose-200 hover:bg-rose-50 hover:text-rose-800"
                    onClick={() => openReview(item, 'reject')}
                  >
                    <X />
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewMode === 'approve' ? 'Approve leave' : 'Reject leave'}</DialogTitle>
            {reviewing && (
              <DialogDescription className="space-y-1">
                <div className="text-slate-900 font-medium">{reviewing.employees?.full_name}</div>
                <div className="text-sm">
                  {formatRange(reviewing.from_date, reviewing.to_date)}
                  <span className="mx-1">·</span>
                  {reviewing.days} day{reviewing.days > 1 ? 's' : ''}
                  <span className="mx-1">·</span>
                  {reviewing.leave_types?.name}
                </div>
                {reviewing.reason && (
                  <div className="text-sm italic mt-1">"{reviewing.reason}"</div>
                )}
              </DialogDescription>
            )}
          </DialogHeader>
          <Textarea
            placeholder="Optional review note (visible to employee)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)} disabled={busy}>Cancel</Button>
            <Button
              onClick={submitReview}
              disabled={busy}
              className={
                reviewMode === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-0'
                  : 'bg-rose-600 hover:bg-rose-700 text-white border-0'
              }
            >
              {reviewMode === 'approve' ? <Check /> : <X />}
              {reviewMode === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LeaveTypesModal open={typesOpen} onClose={() => setTypesOpen(false)} schoolCode={schoolCode} />
    </div>
  );
}
