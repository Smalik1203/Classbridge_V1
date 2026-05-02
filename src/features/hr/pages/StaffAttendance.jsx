import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as AntApp } from 'antd';
import {
  ChevronLeft, ChevronRight, RefreshCw, CalendarDays, TrendingUp, Clock, AlertCircle,
  PencilLine, Upload,
} from 'lucide-react';
import dayjs from 'dayjs';

import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

import { hrService } from '../services/hrService';
import {
  PageHeader, SectionCard, EmptyState, KpiTile,
} from '../components/visuals';
import BiometricImportDialog from '../components/BiometricImportDialog';
import { cn } from '@/lib/utils';

const COLS = [
  { key: 'present_days', label: 'Present', short: 'P', cls: 'bg-emerald-500 text-white', tile: 'emerald' },
  { key: 'absent_days', label: 'Absent', short: 'A', cls: 'bg-rose-500 text-white', tile: 'rose' },
  { key: 'late_days', label: 'Late', short: 'L', cls: 'bg-amber-500 text-white', tile: 'amber' },
  { key: 'on_leave_days', label: 'On leave', short: 'LV', cls: 'bg-indigo-500 text-white', tile: 'brand' },
  { key: 'half_days', label: 'Half day', short: 'H', cls: 'bg-amber-300 text-amber-900', tile: 'amber' },
];

export default function StaffAttendance() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const navigate = useNavigate();
  const { message } = AntApp.useApp();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [ym, setYm] = useState({ year: dayjs().year(), month: dayjs().month() + 1 });
  const [importOpen, setImportOpen] = useState(false);

  const load = async () => {
    if (!schoolCode) return;
    try {
      setLoading(true);
      const rows = await hrService.getAttendanceSummary(schoolCode, ym.year, ym.month);
      setData(rows);
    } catch (e) {
      message.error(e.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [schoolCode, ym.year, ym.month]);

  const monthLabel = dayjs(`${ym.year}-${String(ym.month).padStart(2, '0')}-01`).format('MMMM YYYY');
  const isCurrent = ym.year === dayjs().year() && ym.month === dayjs().month() + 1;
  const move = (delta) => {
    const d = dayjs(`${ym.year}-${String(ym.month).padStart(2, '0')}-01`).add(delta, 'month');
    setYm({ year: d.year(), month: d.month() + 1 });
  };

  const totals = useMemo(() => COLS.reduce((acc, c) => {
    acc[c.key] = data.reduce((s, r) => s + Number(r[c.key] || 0), 0);
    return acc;
  }, {}), [data]);

  const totalLate = useMemo(() => data.reduce((s, r) => s + Number(r.total_late_minutes || 0), 0), [data]);
  const totalWorking = useMemo(() => data.reduce((s, r) => s + Number(r.working_days || 0), 0), [data]);
  const presentPct = totalWorking ? Math.round((totals.present_days / totalWorking) * 100) : 0;

  return (
    <div className="px-7 py-6 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Attendance · monthly"
        title="Staff Attendance"
        subtitle={`Per-employee summary for ${monthLabel}`}
        actions={
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" onClick={() => move(-1)}><ChevronLeft /></Button>
            <div className="px-3 py-1.5 rounded-md bg-white border border-slate-200 font-semibold text-slate-800 min-w-[150px] text-center">
              {monthLabel}
            </div>
            <Button variant="outline" size="icon" onClick={() => move(1)} disabled={isCurrent}><ChevronRight /></Button>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload />
              Import biometric
            </Button>
            <Button onClick={() => navigate('/hr/attendance/mark')}>
              <PencilLine />
              Mark attendance
            </Button>
          </div>
        }
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <KpiTile tone={presentPct >= 90 ? 'emerald' : presentPct >= 75 ? 'amber' : 'rose'} label="Avg presence" value={`${presentPct}%`} icon={<TrendingUp size={16} />} />
        <KpiTile tone="emerald" label="Present" value={totals.present_days || 0} icon={<CalendarDays size={16} />} />
        <KpiTile tone="rose" label="Absent" value={totals.absent_days || 0} icon={<AlertCircle size={16} />} />
        <KpiTile tone="amber" label="Late" value={totals.late_days || 0} icon={<Clock size={16} />} />
        <KpiTile tone="brand" label="On leave" value={totals.on_leave_days || 0} icon={<CalendarDays size={16} />} />
        <KpiTile tone="slate" label="Late minutes" value={totalLate} icon={<Clock size={16} />} />
      </div>

      <SectionCard padding="p-0">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-1.5 px-5 py-3 border-b border-slate-100 bg-slate-50/40">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">Legend</span>
          {COLS.map((c) => (
            <span key={c.key} className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold', c.cls)}>
              {c.label}
            </span>
          ))}
        </div>

        {loading && data.length === 0 ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : data.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={20} />}
            title="No attendance data for this month"
            subtitle="Check back once staff start checking in."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                <TableHead className="pl-5 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Employee</TableHead>
                {COLS.map((c) => (
                  <TableHead key={c.key} className="text-center text-[11px] uppercase tracking-wider text-slate-500 font-semibold w-[70px]">
                    <span title={c.label}>{c.short}</span>
                  </TableHead>
                ))}
                <TableHead className="text-right text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Working days</TableHead>
                <TableHead className="pr-5 text-right text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Late (min)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.employee_id}>
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
                          {r.department}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  {COLS.map((c) => {
                    const v = r[c.key];
                    return (
                      <TableCell key={c.key} className="text-center">
                        {v > 0 ? (
                          <span className={cn('inline-flex min-w-[28px] justify-center px-2 py-0.5 rounded-md text-xs font-semibold', c.cls)}>
                            {v}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right tabular-nums font-semibold text-slate-700">{r.working_days}</TableCell>
                  <TableCell className="pr-5 text-right tabular-nums text-slate-600">{r.total_late_minutes ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <BiometricImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        schoolCode={schoolCode}
        userId={user?.id}
        onImported={load}
      />
    </div>
  );
}
