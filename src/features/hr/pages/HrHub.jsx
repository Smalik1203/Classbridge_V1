import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as AntApp } from 'antd';
import {
  Users, CalendarDays, Wallet, FileCheck2, Check, X, ChevronRight, RefreshCw,
  IdCard, Clock, AlertTriangle, Sparkles, BadgeIndianRupee, ShieldCheck, Settings2,
} from 'lucide-react';
import dayjs from 'dayjs';

import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { supabase } from '@/config/supabaseClient';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { hrService, formatINR } from '../services/hrService';
import {
  PageHeader, KpiHero, AlertBar, SectionCard, ProgressBar, EmptyState, StatusPill,
} from '../components/visuals';
import { BRAND_CTA } from '../components/tokens';

const STATUS_PRESENT = new Set(['present', 'late', 'half_day']);

export default function HrHub() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const navigate = useNavigate();
  const { message } = AntApp.useApp();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [leaveApps, setLeaveApps] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [currentRun, setCurrentRun] = useState(null);
  const [currentRunPayslips, setCurrentRunPayslips] = useState([]);
  const [last7Attendance, setLast7Attendance] = useState([]);
  const [actionId, setActionId] = useState(null);

  const today = dayjs();
  const monthStart = today.startOf('month').format('YYYY-MM-DD');
  const monthEnd = today.endOf('month').format('YYYY-MM-DD');
  const sevenDaysAgo = today.subtract(6, 'day').format('YYYY-MM-DD');

  const load = async () => {
    if (!schoolCode) return;
    try {
      const emps = await hrService.listEmployees(schoolCode);
      setEmployees(emps);

      const { data: leaves } = await supabase
        .from('leave_applications')
        .select('id, status, days, applied_at')
        .eq('school_code', schoolCode)
        .gte('applied_at', monthStart)
        .lte('applied_at', `${monthEnd}T23:59:59`);
      setLeaveApps(leaves ?? []);

      const pending = await hrService.listPendingLeaveApplications(schoolCode);
      setPendingLeaves(pending.slice(0, 5));

      const runs = await hrService.listPayrollRuns(schoolCode);
      const cur = runs.find((r) => r.month === today.month() + 1 && r.year === today.year()) ?? null;
      setCurrentRun(cur);
      if (cur) {
        const slips = await hrService.listPayslipsForRun(cur.id);
        setCurrentRunPayslips(slips);
      } else {
        setCurrentRunPayslips([]);
      }

      const { data: att } = await supabase
        .from('staff_attendance')
        .select('date, status')
        .eq('school_code', schoolCode)
        .gte('date', sevenDaysAgo)
        .lte('date', today.format('YYYY-MM-DD'));
      setLast7Attendance(att ?? []);
    } catch (e) {
      message.error(e.message || 'Failed to load HR data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [schoolCode]);

  const stats = useMemo(() => {
    const active = employees.filter((e) => e.status === 'active').length;
    const total = employees.length;
    const pending = leaveApps.filter((l) => l.status === 'pending').length;
    const approved = leaveApps.filter((l) => l.status === 'approved').length;
    const rejected = leaveApps.filter((l) => l.status === 'rejected').length;

    const daily = {};
    last7Attendance.forEach((a) => {
      if (!daily[a.date]) daily[a.date] = { present: 0, total: 0 };
      daily[a.date].total += 1;
      if (STATUS_PRESENT.has(a.status)) daily[a.date].present += 1;
    });
    const perDay = [];
    for (let i = 6; i >= 0; i--) {
      const d = today.subtract(i, 'day').format('YYYY-MM-DD');
      const day = daily[d] || { present: 0, total: 0 };
      const pct = day.total ? Math.round((day.present / day.total) * 100) : 0;
      perDay.push({ date: d, ...day, pct });
    }
    const avgPct = perDay.length ? Math.round(perDay.reduce((s, d) => s + d.pct, 0) / perDay.length) : 0;

    const todayKey = today.format('YYYY-MM-DD');
    const todayMarked = last7Attendance.filter((a) => a.date === todayKey).length;
    const gap = Math.max(0, active - todayMarked);

    const totalNet = currentRunPayslips.reduce((s, p) => s + Number(p.net_pay || 0), 0);

    return { active, total, pending, approved, rejected, avgPct, gap, totalNet, perDay };
  }, [employees, leaveApps, last7Attendance, currentRunPayslips, today]);

  const handleApprove = async (id) => {
    try {
      setActionId(id);
      await hrService.approveLeave(id);
      message.success('Leave approved');
      setPendingLeaves((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      message.error(e.message || 'Failed to approve');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id) => {
    try {
      setActionId(id);
      await hrService.rejectLeave(id);
      message.success('Leave rejected');
      setPendingLeaves((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      message.error(e.message || 'Failed to reject');
    } finally {
      setActionId(null);
    }
  };

  const refresh = async () => { setRefreshing(true); await load(); };

  if (loading) {
    return (
      <div className="px-7 py-6 max-w-[1400px] mx-auto space-y-4">
        <Skeleton className="h-16 w-1/2" />
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  const attendanceTone = stats.avgPct >= 90 ? 'emerald' : stats.avgPct >= 75 ? 'amber' : 'rose';
  const payrollTone = currentRun?.status === 'locked' ? 'emerald' : currentRun?.status === 'processing' ? 'sky' : 'slate';

  return (
    <div className="px-7 py-6 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="People · Operations"
        title="HR Hub"
        subtitle={`${today.format('dddd, DD MMM YYYY')} · ${schoolCode}`}
        actions={
          <>
            <Button variant="outline" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button onClick={() => navigate('/hr/staff')} className={BRAND_CTA}>
              <Users />
              Staff Directory
            </Button>
          </>
        }
      />

      {/* KPI hero strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiHero
          tone="brand"
          eyebrow="Active staff"
          value={stats.active}
          suffix={<span className="text-base font-semibold opacity-75 ml-1">/ {stats.total}</span>}
          label={`${stats.total ? Math.round((stats.active / stats.total) * 100) : 0}% of headcount active`}
          icon={<Users size={16} />}
          foot={<ProgressBar value={stats.total ? (stats.active / stats.total) * 100 : 0} />}
          onClick={() => navigate('/hr/staff')}
        />
        <KpiHero
          tone={attendanceTone}
          eyebrow="Attendance · 7d avg"
          value={stats.avgPct}
          suffix="%"
          label={stats.gap > 0 ? `${stats.gap} not marked today` : 'Everyone marked today'}
          icon={<CalendarDays size={16} />}
          foot={<ProgressBar value={stats.avgPct} tone={attendanceTone} />}
          onClick={() => navigate('/hr/attendance')}
        />
        <KpiHero
          tone={stats.pending > 0 ? 'amber' : 'emerald'}
          eyebrow="Leaves this month"
          value={stats.pending}
          label={`${stats.approved} approved · ${stats.rejected} rejected`}
          icon={<FileCheck2 size={16} />}
          foot={
            <div className="flex gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-semibold">
                {stats.pending} pending
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-semibold">
                {stats.approved} approved
              </span>
            </div>
          }
          onClick={() => navigate('/hr/leaves')}
        />
        <KpiHero
          tone={payrollTone}
          eyebrow={`Payroll · ${today.format('MMM YYYY')}`}
          value={currentRun ? formatINR(stats.totalNet).replace('₹', '') : '—'}
          prefix={currentRun ? '₹' : null}
          label={currentRun ? `${currentRunPayslips.length} payslips · ${currentRun.status}` : 'No run yet this month'}
          icon={<Wallet size={16} />}
          onClick={() => navigate('/hr/payroll')}
        />
      </div>

      {stats.gap > 0 && (
        <AlertBar
          tone="amber"
          className="mb-5"
          icon={<AlertTriangle size={18} className="text-amber-600" />}
          title={`${stats.gap} active staff missed check-in today`}
          description={today.format('dddd, DD MMM YYYY')}
          action={
            <Button variant="outline" size="sm" onClick={() => navigate('/hr/attendance')}>
              Open Attendance
            </Button>
          }
        />
      )}

      {/* 7-day attendance trend */}
      <SectionCard
        tone="brand"
        icon={<Sparkles size={14} className="text-indigo-600" />}
        title="Last 7 days · Attendance trend"
        subtitle="Daily attendance percentage across active staff"
        className="mb-5"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {stats.perDay.map((d) => {
            const tone = d.pct >= 90 ? 'emerald' : d.pct >= 75 ? 'amber' : d.total > 0 ? 'rose' : 'slate';
            const palette = {
              emerald: { bar: 'from-emerald-500 to-teal-400', text: 'text-emerald-600' },
              amber:   { bar: 'from-amber-500 to-orange-400', text: 'text-amber-600' },
              rose:    { bar: 'from-rose-500 to-pink-500', text: 'text-rose-600' },
              slate:   { bar: 'from-slate-300 to-slate-200', text: 'text-slate-400' },
            }[tone];
            return (
              <div
                key={d.date}
                className="rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/60 p-3 text-center"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {dayjs(d.date).format('ddd')}
                </div>
                <div className="text-xs font-semibold text-slate-700">{dayjs(d.date).format('DD MMM')}</div>
                <div className={`mt-2 text-2xl font-bold tabular-nums ${palette.text}`}>
                  {d.total > 0 ? `${d.pct}%` : '—'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">{d.present}/{d.total}</div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${palette.bar} transition-[width] duration-500`}
                    style={{ width: `${d.pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Action center: pending leaves */}
        <SectionCard
          tone="amber"
          icon={<FileCheck2 size={14} className="text-amber-600" />}
          title="Action center"
          subtitle={pendingLeaves.length > 0 ? `${pendingLeaves.length} requests awaiting review` : 'All caught up'}
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate('/hr/leaves')}>
              View all <ChevronRight />
            </Button>
          }
          className="lg:col-span-2"
          padding="p-0"
        >
          {pendingLeaves.length === 0 ? (
            <EmptyState
              icon={<Check size={20} />}
              title="No leave requests waiting"
              subtitle="You'll see new requests here as soon as they're filed."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendingLeaves.map((item) => (
                <li key={item.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50/70 transition-colors">
                  <div className="grid place-items-center size-9 rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 shrink-0">
                    <IdCard size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 truncate">{item.employees?.full_name}</span>
                      <StatusPill tone="sky">{item.leave_types?.code}</StatusPill>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {dayjs(item.from_date).format('DD MMM')} → {dayjs(item.to_date).format('DD MMM YYYY')}
                      <span className="mx-1.5">·</span>
                      <span className="font-semibold text-slate-700">{item.days} day{item.days > 1 ? 's' : ''}</span>
                    </div>
                    {item.reason && (
                      <div className="text-xs text-slate-600 italic mt-0.5 truncate">"{item.reason}"</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                      disabled={actionId === item.id}
                      onClick={() => handleApprove(item.id)}
                    >
                      <Check />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-rose-700 border-rose-200 hover:bg-rose-50 hover:text-rose-800"
                      disabled={actionId === item.id}
                      onClick={() => handleReject(item.id)}
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

        {/* Quick actions */}
        <SectionCard
          tone="sky"
          icon={<Sparkles size={14} className="text-sky-600" />}
          title="Quick actions"
          subtitle="Jump to a workflow"
        >
          <div className="space-y-2">
            <QuickAction icon={<Users size={16} />} tone="brand" label="Staff Directory" onClick={() => navigate('/hr/staff')} />
            <QuickAction icon={<BadgeIndianRupee size={16} />} tone="emerald" label="Payroll Runs" onClick={() => navigate('/hr/payroll')} />
            <QuickAction icon={<FileCheck2 size={16} />} tone="amber" label="Leaves & Approvals" onClick={() => navigate('/hr/leaves')} />
            <QuickAction icon={<ShieldCheck size={16} />} tone="brand" label="Tax Declarations (Form 12BB)" onClick={() => navigate('/hr/tax')} />
            <QuickAction icon={<FileCheck2 size={16} />} tone="sky" label="Form 15G / 15H Register" onClick={() => navigate('/hr/tax/form-15gh')} />
            <QuickAction icon={<Settings2 size={16} />} tone="slate" label="Tax Settings (TAN/PAN)" onClick={() => navigate('/hr/tax/settings')} />
            <QuickAction icon={<Clock size={16} />} tone="sky" label="Staff Attendance" onClick={() => navigate('/hr/attendance')} />
            <QuickAction icon={<Wallet size={16} />} tone="rose" label="Salary Components" onClick={() => navigate('/hr/salary-components')} />
            <div className="pt-2 mt-2 border-t border-slate-100">
              <QuickAction icon={<IdCard size={16} />} tone="slate" label="My HR (Self-Service)" onClick={() => navigate('/hr/my')} />
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function QuickAction({ icon, label, tone, onClick }) {
  const TONES_MAP = {
    brand: 'bg-indigo-50 text-indigo-700 ring-indigo-100 group-hover:bg-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100 group-hover:bg-emerald-100',
    amber: 'bg-amber-50 text-amber-800 ring-amber-100 group-hover:bg-amber-100',
    rose: 'bg-rose-50 text-rose-700 ring-rose-100 group-hover:bg-rose-100',
    sky: 'bg-sky-50 text-sky-700 ring-sky-100 group-hover:bg-sky-100',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200 group-hover:bg-slate-200',
  };
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors hover:bg-slate-50"
    >
      <div className={`grid place-items-center size-9 rounded-lg ring-1 ${TONES_MAP[tone]} transition-colors shrink-0`}>
        {icon}
      </div>
      <span className="font-medium text-slate-700 group-hover:text-slate-900 flex-1">{label}</span>
      <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
    </button>
  );
}
