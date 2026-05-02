import React, { useEffect, useMemo, useState } from 'react';
import { App as AntApp } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, RefreshCw, CheckCircle2, XCircle, Clock, Coffee, Plane,
  CalendarOff, Sun, Search, Sparkles,
} from 'lucide-react';
import dayjs from 'dayjs';

import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

import { hrService } from '../services/hrService';
import {
  PageHeader, SectionCard, EmptyState, KpiTile,
} from '../components/visuals';
import { cn } from '@/lib/utils';

const STATUSES = [
  { key: 'present',  label: 'Present',  short: 'P',  icon: CheckCircle2, cls: 'bg-emerald-500 text-white border-emerald-600',  ring: 'ring-emerald-300' },
  { key: 'absent',   label: 'Absent',   short: 'A',  icon: XCircle,      cls: 'bg-rose-500 text-white border-rose-600',         ring: 'ring-rose-300' },
  { key: 'late',     label: 'Late',     short: 'L',  icon: Clock,        cls: 'bg-amber-500 text-white border-amber-600',       ring: 'ring-amber-300' },
  { key: 'half_day', label: 'Half day', short: 'H',  icon: Coffee,       cls: 'bg-amber-300 text-amber-900 border-amber-400',   ring: 'ring-amber-200' },
  { key: 'on_leave', label: 'On leave', short: 'LV', icon: Plane,        cls: 'bg-indigo-500 text-white border-indigo-600',     ring: 'ring-indigo-300' },
  { key: 'holiday',  label: 'Holiday',  short: 'HD', icon: Sun,          cls: 'bg-sky-500 text-white border-sky-600',           ring: 'ring-sky-300' },
  { key: 'week_off', label: 'Week off', short: 'WO', icon: CalendarOff,  cls: 'bg-slate-400 text-white border-slate-500',       ring: 'ring-slate-300' },
];

const todayStr = () => dayjs().format('YYYY-MM-DD');

export default function MarkStaffAttendance() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const navigate = useNavigate();
  const { message, modal } = AntApp.useApp();

  const [date, setDate] = useState(todayStr());
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]); // [{ id, full_name, employee_code, designation, department, mark }]
  const [draft, setDraft] = useState({}); // { employee_id: { status, in_time, out_time, late_minutes, half_day_slot, note } }
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [detailFor, setDetailFor] = useState(null);

  const isFuture = dayjs(date).isAfter(dayjs(), 'day');

  const load = async () => {
    if (!schoolCode || isFuture) return;
    try {
      setLoading(true);
      const data = await hrService.getDayAttendance(schoolCode, date);
      setRows(data);
      // Hydrate draft from existing marks so toggles reflect saved state
      const init = {};
      data.forEach((r) => {
        if (r.mark) {
          init[r.id] = {
            status: r.mark.status,
            in_time: r.mark.in_time || '',
            out_time: r.mark.out_time || '',
            late_minutes: r.mark.late_minutes || 0,
            half_day_slot: r.mark.half_day_slot || null,
            note: r.mark.note || '',
          };
        }
      });
      setDraft(init);
    } catch (e) {
      message.error(e.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [schoolCode, date]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.full_name} ${r.employee_code} ${r.department} ${r.designation}`.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const counts = useMemo(() => {
    const acc = { total: rows.length, marked: 0, unmarked: 0 };
    STATUSES.forEach((s) => { acc[s.key] = 0; });
    rows.forEach((r) => {
      const s = draft[r.id]?.status;
      if (s) {
        acc.marked += 1;
        acc[s] = (acc[s] || 0) + 1;
      } else {
        acc.unmarked += 1;
      }
    });
    return acc;
  }, [rows, draft]);

  const dirtyCount = useMemo(() => {
    let n = 0;
    rows.forEach((r) => {
      const cur = draft[r.id];
      const orig = r.mark;
      if (!cur && !orig) return;
      if (cur && !orig) { n += 1; return; }
      if (!cur && orig) return;
      if (
        cur.status !== orig.status ||
        (cur.in_time || null) !== (orig.in_time || null) ||
        (cur.out_time || null) !== (orig.out_time || null) ||
        (cur.late_minutes || 0) !== (orig.late_minutes || 0) ||
        (cur.half_day_slot || null) !== (orig.half_day_slot || null) ||
        (cur.note || '') !== (orig.note || '')
      ) n += 1;
    });
    return n;
  }, [rows, draft]);

  const setStatus = (employeeId, status) => {
    setDraft((d) => {
      const cur = d[employeeId] || {};
      const next = { ...cur, status };
      if (status !== 'half_day') next.half_day_slot = null;
      else if (!next.half_day_slot) next.half_day_slot = 'morning';
      if (status !== 'late') next.late_minutes = 0;
      else if (!next.late_minutes) next.late_minutes = 15;
      return { ...d, [employeeId]: next };
    });
  };

  const updateField = (employeeId, patch) => {
    setDraft((d) => ({ ...d, [employeeId]: { ...(d[employeeId] || {}), ...patch } }));
  };

  const markAllPresent = () => {
    const next = { ...draft };
    filtered.forEach((r) => {
      next[r.id] = { ...(next[r.id] || {}), status: 'present', late_minutes: 0, half_day_slot: null };
    });
    setDraft(next);
  };

  const clearAll = () => {
    modal.confirm({
      title: 'Clear all unsaved changes?',
      content: 'This resets the form to the last saved state. Existing saved marks are not deleted.',
      onOk: () => load(),
      okButtonProps: { danger: true },
      okText: 'Clear',
    });
  };

  const save = async () => {
    const marks = rows
      .filter((r) => draft[r.id]?.status)
      .map((r) => ({ employee_id: r.id, ...draft[r.id] }));

    // client-side validation
    const bad = [];
    marks.forEach((m) => {
      if (m.status === 'late' && (!m.late_minutes || m.late_minutes <= 0)) {
        bad.push('Late entries need a positive "late minutes" value.');
      }
      if (m.status === 'half_day' && !m.half_day_slot) {
        bad.push('Half-day entries need a slot (morning / afternoon).');
      }
    });
    if (bad.length) { message.error([...new Set(bad)].join(' ')); return; }

    if (marks.length === 0) { message.info('Nothing to save.'); return; }

    try {
      setBusy(true);
      await hrService.upsertStaffAttendance({
        schoolCode, date, marks,
        markedBy: user?.id || null,
        source: 'manual',
      });
      message.success(`Saved ${marks.length} attendance ${marks.length === 1 ? 'entry' : 'entries'} for ${dayjs(date).format('DD MMM YYYY')}`);
      load();
    } catch (e) {
      message.error(e.message || 'Failed to save attendance');
    } finally {
      setBusy(false);
    }
  };

  const openDetails = (row) => {
    if (!draft[row.id]?.status) setStatus(row.id, 'present');
    setDetailFor(row);
  };

  const det = detailFor ? draft[detailFor.id] || {} : {};

  return (
    <div className="px-7 py-6 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Attendance · daily"
        title="Mark Staff Attendance"
        subtitle="Toggle a status for each employee, or use bulk actions. Save when done."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/hr/attendance')}>
              <ArrowLeft />
              Summary
            </Button>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => setDate(e.target.value || todayStr())}
              className="h-9 rounded-md border border-input bg-white px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <Button variant="outline" onClick={load} disabled={loading || isFuture}>
              <RefreshCw className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button onClick={save} disabled={busy || dirtyCount === 0}>
              <Save />
              Save
              {dirtyCount > 0 && (
                <span className="ml-1 px-1.5 py-px rounded bg-white/20 text-[10px] font-bold">
                  {dirtyCount}
                </span>
              )}
            </Button>
          </div>
        }
      />

      {isFuture && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-amber-50 ring-1 ring-amber-100 text-sm text-amber-900">
          You can't mark attendance for a future date. Pick today or a past date.
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 mb-4">
        <KpiTile tone="brand" label="Total" value={counts.total} />
        <KpiTile tone="emerald" label="Marked" value={counts.marked} />
        <KpiTile tone="slate" label="Unmarked" value={counts.unmarked} />
        {STATUSES.map((s) => (
          <KpiTile
            key={s.key}
            tone={s.key === 'present' ? 'emerald' : s.key === 'absent' ? 'rose' : s.key === 'on_leave' ? 'brand' : s.key === 'holiday' ? 'sky' : 'amber'}
            label={s.label}
            value={counts[s.key] || 0}
          />
        ))}
      </div>

      <SectionCard padding="p-0">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search name / code / department"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <Button variant="outline" size="sm" onClick={markAllPresent} disabled={isFuture}>
              <Sparkles size={14} />
              Mark filtered as present
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll} disabled={dirtyCount === 0}>
              Clear unsaved
            </Button>
          </div>
        </div>

        {loading && rows.length === 0 ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={rows.length === 0 ? 'No active employees' : 'No matches'}
            subtitle={rows.length === 0 ? 'Add staff in HR → Staff Directory first.' : 'Try a different search'}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                <TableHead className="pl-5 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Employee</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Status</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Detail</TableHead>
                <TableHead className="pr-5 text-right text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const cur = draft[r.id] || {};
                const status = cur.status || null;
                return (
                  <TableRow key={r.id} className={cn(status ? '' : 'bg-amber-50/30')}>
                    <TableCell className="pl-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9 ring-1 ring-slate-200">
                          <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-blue-500 text-white text-xs">
                            {(r.full_name || '?').split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{r.full_name}</div>
                          <div className="text-[11px] text-slate-500 truncate">
                            <span className="font-mono">{r.employee_code}</span>
                            <span className="mx-1">·</span>
                            {r.designation}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        {STATUSES.map((s) => {
                          const active = status === s.key;
                          const Icon = s.icon;
                          return (
                            <button
                              key={s.key}
                              type="button"
                              onClick={() => setStatus(r.id, s.key)}
                              className={cn(
                                'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold border transition-all',
                                active
                                  ? `${s.cls} shadow-sm scale-[1.02]`
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900',
                              )}
                              title={s.label}
                            >
                              <Icon size={12} />
                              {s.short}
                            </button>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      {status === 'late' ? (
                        <span className="text-xs text-amber-700 font-semibold">{cur.late_minutes || 0} min late</span>
                      ) : status === 'half_day' ? (
                        <span className="text-xs text-amber-700 font-semibold capitalize">{cur.half_day_slot || 'morning'} half</span>
                      ) : cur.in_time ? (
                        <span className="text-xs font-mono text-slate-700">
                          {cur.in_time}{cur.out_time ? ` → ${cur.out_time}` : ''}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openDetails(r)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline-offset-2 hover:underline"
                          disabled={!status}
                        >
                          Add timing / note
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      {r.mark ? (
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide',
                          r.mark.source === 'biometric_import'
                            ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-100'
                            : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
                        )}>
                          {r.mark.source === 'biometric_import' ? 'biometric' : 'manual'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 uppercase tracking-wide">unmarked</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      {/* Detail dialog */}
      <Dialog open={!!detailFor} onOpenChange={(o) => !o && setDetailFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{detailFor?.full_name}</DialogTitle>
            <DialogDescription>
              Optional details for {dayjs(date).format('DD MMM YYYY')} · status: <span className="font-semibold">{det.status || '—'}</span>
            </DialogDescription>
          </DialogHeader>
          {detailFor && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>In time</Label>
                  <Input
                    type="time"
                    value={det.in_time || ''}
                    onChange={(e) => updateField(detailFor.id, { in_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Out time</Label>
                  <Input
                    type="time"
                    value={det.out_time || ''}
                    onChange={(e) => updateField(detailFor.id, { out_time: e.target.value })}
                  />
                </div>
              </div>
              {det.status === 'late' && (
                <div>
                  <Label>Late by (minutes)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={det.late_minutes || ''}
                    onChange={(e) => updateField(detailFor.id, { late_minutes: Number(e.target.value) || 0 })}
                  />
                </div>
              )}
              {det.status === 'half_day' && (
                <div>
                  <Label>Half-day slot</Label>
                  <div className="flex gap-2 mt-1">
                    {['morning', 'afternoon'].map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => updateField(detailFor.id, { half_day_slot: slot })}
                        className={cn(
                          'flex-1 px-3 py-2 rounded-md text-sm font-semibold border capitalize',
                          det.half_day_slot === slot
                            ? 'bg-amber-100 border-amber-300 text-amber-900'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300',
                        )}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Label>Note (optional)</Label>
                <Input
                  value={det.note || ''}
                  onChange={(e) => updateField(detailFor.id, { note: e.target.value })}
                  placeholder="e.g. Client meeting offsite"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDetailFor(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
