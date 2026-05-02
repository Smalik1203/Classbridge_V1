import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as AntApp } from 'antd';
import {
  User, Plus, RefreshCw, FileText, Mail, Phone, Hourglass, BadgeCheck, XCircle, Wallet, Banknote,
  CalendarDays, Sparkles, AlertTriangle, Trash2, ShieldCheck, ChevronRight,
} from 'lucide-react';
import dayjs from 'dayjs';

import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

import { hrService, formatINR } from '../services/hrService';
import HrDocumentViewer from '../components/HrDocumentViewer';
import {
  SectionCard, KpiTile, EmptyState, StatusPill,
} from '../components/visuals';
import { BRAND_CTA } from '../components/tokens';
import { cn } from '@/lib/utils';

const LEAVE_STATUS_TONE = {
  pending: 'amber', approved: 'emerald', rejected: 'rose', cancelled: 'slate',
};

const TODAY = () => dayjs().format('YYYY-MM-DD');

export default function MyHr() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const navigate = useNavigate();
  const { message } = AntApp.useApp();

  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState(null);
  const [academicYear, setAcademicYear] = useState(null);
  const [balance, setBalance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);

  const [requestOpen, setRequestOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [docViewer, setDocViewer] = useState({ open: false, payslipId: null });
  const [confirmCancelId, setConfirmCancelId] = useState(null);

  const [form, setForm] = useState({
    leave_type_id: '',
    from_date: TODAY(),
    to_date: TODAY(),
    is_half_day: false,
    half_day_slot: 'morning',
    reason: '',
  });

  const load = async () => {
    if (!schoolCode || !user) return;
    try {
      const emp = await hrService.getEmployeeByUserId(user.id);
      setEmployee(emp);
      if (!emp) { setLoading(false); return; }

      const ay = await hrService.getActiveAcademicYearId(schoolCode);
      setAcademicYear(ay);

      const [bal, apps, slips, types] = await Promise.all([
        ay?.id ? hrService.getLeaveBalance(emp.id, ay.id).catch(() => []) : Promise.resolve([]),
        hrService.listLeaveApplications(emp.id),
        hrService.listPayslipsForEmployee(emp.id),
        hrService.listLeaveTypes(schoolCode),
      ]);
      setBalance(bal);
      setLeaves(apps);
      setPayslips(slips);
      setLeaveTypes(types.filter((t) => t.is_active));
    } catch (e) {
      message.error(e.message || 'Failed to load HR data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, schoolCode]);

  const stats = useMemo(() => ({
    pending: leaves.filter((l) => l.status === 'pending').length,
    approved: leaves.filter((l) => l.status === 'approved').length,
    rejected: leaves.filter((l) => l.status === 'rejected').length,
  }), [leaves]);

  const latestPayslip = payslips[0];

  const openRequest = () => {
    setForm({
      leave_type_id: '',
      from_date: TODAY(),
      to_date: TODAY(),
      is_half_day: false,
      half_day_slot: 'morning',
      reason: '',
    });
    setRequestOpen(true);
  };

  const submitRequest = async () => {
    try {
      if (!form.leave_type_id) return message.warning('Please pick a leave type');
      if (!form.from_date || !form.to_date) return message.warning('Please pick a date range');
      if (!form.reason?.trim()) return message.warning('Please enter a reason');
      if (!academicYear?.id) return message.error('No active academic year configured');

      const from = dayjs(form.from_date);
      const to = dayjs(form.to_date);
      if (to.isBefore(from)) return message.warning('End date must be on or after start date');

      const days = form.is_half_day ? 0.5 : (to.diff(from, 'day') + 1);

      setSubmitting(true);
      await hrService.applyForLeave({
        school_code: schoolCode,
        employee_id: employee.id,
        leave_type_id: form.leave_type_id,
        academic_year_id: academicYear.id,
        from_date: form.from_date,
        to_date: form.to_date,
        days,
        is_half_day: !!form.is_half_day,
        half_day_slot: form.is_half_day ? form.half_day_slot : undefined,
        reason: form.reason,
      });
      message.success('Leave request submitted');
      setRequestOpen(false);
      load();
    } catch (e) {
      message.error(e.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelLeave = async () => {
    if (!confirmCancelId) return;
    try {
      await hrService.cancelLeaveApplication(confirmCancelId);
      message.success('Leave cancelled');
      setConfirmCancelId(null);
      load();
    } catch (e) {
      message.error(e.message || 'Failed');
    }
  };

  if (loading) {
    return (
      <div className="px-7 py-6 max-w-[1200px] mx-auto space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="px-7 py-12 max-w-[800px] mx-auto">
        <SectionCard className="text-center">
          <div className="mx-auto grid place-items-center size-14 rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-100 mb-3">
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Your HR record isn't set up yet</h2>
          <p className="text-sm text-slate-500 mt-1">
            Please contact your school administrator to link your account to an employee profile.
          </p>
        </SectionCard>
      </div>
    );
  }

  const selectedLeaveType = leaveTypes.find((t) => t.id === form.leave_type_id);
  const previewDays = (() => {
    if (!form.from_date || !form.to_date) return 0;
    const from = dayjs(form.from_date), to = dayjs(form.to_date);
    if (to.isBefore(from)) return 0;
    return form.is_half_day ? 0.5 : to.diff(from, 'day') + 1;
  })();
  const selectedBalance = balance.find((b) => b.leave_type_id === form.leave_type_id);
  const available = selectedBalance?.balance ?? 0;
  const after = available - previewDays;
  const insufficient = after < 0 && selectedLeaveType?.is_paid;

  return (
    <div className="px-7 py-6 max-w-[1200px] mx-auto">
      {/* Identity card with brand gradient header */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden mb-5">
        <div className="relative h-24 bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-500">
          <div
            aria-hidden
            className="absolute inset-0 opacity-30"
            style={{ background: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.4), transparent 60%)' }}
          />
        </div>
        <div className="px-6 pb-5 -mt-12">
          <div className="flex flex-wrap items-end gap-4">
            <Avatar className="size-24 ring-4 ring-white shadow-lg">
              <AvatarImage src={employee.photo_url} alt={employee.full_name} />
              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-blue-500 text-white text-xl font-bold">
                {(employee.full_name || '?').split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-[280px] pt-12">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">{employee.full_name}</h1>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">{employee.employee_code}</span>
                <span>·</span>
                <span>{employee.designation}</span>
                <span>·</span>
                <span className="text-slate-500">{employee.department}</span>
              </div>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {employee.phone && (
                  <a href={`tel:${employee.phone}`} className="inline-flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-800">
                    <Phone size={14} />
                    {employee.phone}
                  </a>
                )}
                {employee.email && (
                  <a href={`mailto:${employee.email}`} className="inline-flex items-center gap-1.5 text-sm text-sky-700 hover:text-sky-800">
                    <Mail size={14} />
                    {employee.email}
                  </a>
                )}
              </div>
            </div>
            <div className="pt-12 flex items-center gap-2 flex-wrap">
              <Button variant="outline" onClick={load}>
                <RefreshCw />
                Refresh
              </Button>
              <Button variant="outline" onClick={() => navigate('/hr/my/tax')}>
                <ShieldCheck />
                Tax declaration
              </Button>
              <Button className={BRAND_CTA} onClick={openRequest}>
                <Plus />
                Request leave
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tax declaration banner — prominent compliance CTA */}
      <button
        type="button"
        onClick={() => navigate('/hr/my/tax')}
        className="mb-5 w-full text-left group rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-500 text-white p-5 shadow-lg shadow-indigo-500/30 relative overflow-hidden hover:shadow-xl hover:shadow-indigo-500/40 transition-shadow"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.25), transparent)' }}
        />
        <div className="relative z-10 flex items-center gap-4">
          <div className="grid place-items-center size-12 rounded-xl bg-white/20 shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/85">
              Income tax · FY 2026-27
            </div>
            <div className="text-lg font-bold leading-tight">Submit your Form 12BB declaration</div>
            <div className="text-sm text-white/85 mt-0.5">
              Tell HR about your investments and HRA so the right TDS gets deducted.
            </div>
          </div>
          <ChevronRight size={20} className="text-white/80 group-hover:translate-x-1 transition-transform" />
        </div>
      </button>

      {/* 3-column: balance | leave stats | latest payslip (gradient) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <SectionCard tone="brand" icon={<CalendarDays size={14} className="text-indigo-600" />} title="Leave balance">
          {balance.length === 0 ? (
            <div className="text-sm text-slate-500">No balance available.</div>
          ) : (
            <div className="space-y-2">
              {balance.map((b) => {
                const pct = b.annual_quota > 0 ? Math.min(100, Math.round((b.used / b.annual_quota) * 100)) : 0;
                return (
                  <div key={b.leave_type_id} className="rounded-lg bg-slate-50/80 ring-1 ring-slate-200/60 p-3">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="text-sm font-medium text-slate-700 truncate">{b.leave_type_name}</div>
                      <div className="text-base font-bold tabular-nums text-slate-900">
                        {b.balance}<span className="text-xs font-medium text-slate-500"> / {b.annual_quota}</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-400" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">used {b.used}</div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard tone="amber" icon={<Sparkles size={14} className="text-amber-600" />} title="My leaves">
          <div className="space-y-2">
            <KpiTile tone="amber" label="Pending" value={stats.pending} icon={<Hourglass size={14} />} />
            <KpiTile tone="emerald" label="Approved" value={stats.approved} icon={<BadgeCheck size={14} />} />
            <KpiTile tone="rose" label="Rejected" value={stats.rejected} icon={<XCircle size={14} />} />
          </div>
        </SectionCard>

        {/* Latest payslip — gradient hero */}
        {!latestPayslip ? (
          <SectionCard tone="slate" icon={<Wallet size={14} className="text-slate-600" />} title="Latest payslip">
            <EmptyState icon={<Banknote size={20} />} title="No payslips yet" />
          </SectionCard>
        ) : (
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-500 text-white p-5 shadow-lg shadow-indigo-500/30">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full"
              style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.22), transparent)' }}
            />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="grid place-items-center size-7 rounded-lg bg-white/20"><Banknote size={14} /></div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/85">
                  {dayjs().month(latestPayslip.run_month - 1).format('MMMM')} {latestPayslip.run_year}
                </span>
              </div>
              <div className="text-[40px] font-bold leading-none tabular-nums tracking-tight">
                {formatINR(latestPayslip.net_pay)}
              </div>
              <div className="text-sm text-white/85 mt-1">
                Net pay · {latestPayslip.paid_days} paid days · FY {latestPayslip.financial_year}
              </div>
              <Button
                variant="secondary"
                className="mt-3 bg-white/20 hover:bg-white/30 text-white border-0"
                onClick={() => setDocViewer({ open: true, payslipId: latestPayslip.id })}
              >
                <FileText />
                View payslip
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Recent leave applications */}
      <SectionCard
        tone="brand"
        icon={<CalendarDays size={14} className="text-indigo-600" />}
        title="Recent leave applications"
        padding="p-0"
        className="mb-5"
      >
        {leaves.length === 0 ? (
          <EmptyState icon={<CalendarDays size={20} />} title="No leave applications yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                <TableHead className="pl-5">Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="pr-5"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaves.slice(0, 10).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-5 font-medium text-slate-700">{r.leave_types?.name ?? '—'}</TableCell>
                  <TableCell className="text-sm text-slate-600">{dayjs(r.from_date).format('DD MMM YYYY')}</TableCell>
                  <TableCell className="text-sm text-slate-600">{dayjs(r.to_date).format('DD MMM YYYY')}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.days}</TableCell>
                  <TableCell><StatusPill tone={LEAVE_STATUS_TONE[r.status] || 'slate'}>{r.status}</StatusPill></TableCell>
                  <TableCell className="text-sm text-slate-600 max-w-[260px] truncate">{r.reason ?? '—'}</TableCell>
                  <TableCell className="pr-5">
                    {r.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                        onClick={() => setConfirmCancelId(r.id)}
                      >
                        <Trash2 size={14} />
                        Cancel
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      {/* Recent payslips */}
      <SectionCard
        tone="emerald"
        icon={<Banknote size={14} className="text-emerald-600" />}
        title="Recent payslips"
        padding="p-0"
      >
        {payslips.length === 0 ? (
          <EmptyState icon={<Banknote size={20} />} title="No payslips yet" />
        ) : (
          <TooltipProvider delayDuration={200}>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                  <TableHead className="pl-5">Period</TableHead>
                  <TableHead>FY</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="pr-5 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-5 font-medium">
                      {dayjs().month(r.run_month - 1).format('MMM')} {r.run_year}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{r.financial_year}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(r.gross_earnings)}</TableCell>
                    <TableCell className="text-right tabular-nums text-rose-700">{formatINR(r.total_deductions)}</TableCell>
                    <TableCell className="text-right tabular-nums font-bold text-emerald-700">{formatINR(r.net_pay)}</TableCell>
                    <TableCell className="pr-5 text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDocViewer({ open: true, payslipId: r.id })}
                          >
                            <FileText size={14} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View payslip</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TooltipProvider>
        )}
      </SectionCard>

      {/* Request leave dialog */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request leave</DialogTitle>
            <DialogDescription>Tell HR what type and when. They'll review your request.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Leave type</Label>
              <Select value={form.leave_type_id} onValueChange={(v) => setForm((f) => ({ ...f, leave_type_id: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="from-date">From</Label>
                <Input
                  id="from-date"
                  type="date"
                  min={TODAY()}
                  value={form.from_date}
                  onChange={(e) => setForm((f) => ({ ...f, from_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to-date">To</Label>
                <Input
                  id="to-date"
                  type="date"
                  min={form.from_date || TODAY()}
                  value={form.to_date}
                  onChange={(e) => setForm((f) => ({ ...f, to_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-slate-50 ring-1 ring-slate-200/60">
              <input
                id="half-day"
                type="checkbox"
                checked={form.is_half_day}
                onChange={(e) => setForm((f) => ({ ...f, is_half_day: e.target.checked }))}
                className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <Label htmlFor="half-day" className="cursor-pointer">Half-day</Label>
              {form.is_half_day && (
                <div className="ml-auto flex items-center gap-1 p-0.5 rounded-md bg-white ring-1 ring-slate-200">
                  {['morning', 'afternoon'].map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, half_day_slot: slot }))}
                      className={cn(
                        'px-2.5 py-1 rounded text-xs font-medium capitalize transition-colors',
                        form.half_day_slot === slot
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:text-slate-900',
                      )}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                rows={3}
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="A short note for your reviewer"
              />
            </div>

            {selectedLeaveType && form.from_date && form.to_date && previewDays > 0 && (
              <div className={cn(
                'rounded-xl px-4 py-3 ring-1 ring-inset',
                insufficient
                  ? 'bg-rose-50 ring-rose-200 text-rose-900'
                  : 'bg-indigo-50 ring-indigo-100 text-slate-800',
              )}>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">Requesting</div>
                    <div className="text-2xl font-bold tabular-nums mt-0.5">
                      {previewDays.toFixed(1)}<span className="text-sm font-medium opacity-70 ml-1">days</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">Available</div>
                    <div className="text-2xl font-bold tabular-nums mt-0.5">{available}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">After approval</div>
                    <div className={cn(
                      'text-2xl font-bold tabular-nums mt-0.5',
                      insufficient ? 'text-rose-700' : 'text-emerald-700',
                    )}>
                      {after.toFixed(1)}
                    </div>
                  </div>
                </div>
                {insufficient && (
                  <div className="text-xs mt-2 text-rose-700 flex items-center gap-1.5">
                    <AlertTriangle size={12} />
                    Insufficient balance — approval may be denied or treated as loss-of-pay.
                  </div>
                )}
                {!selectedLeaveType.is_paid && (
                  <div className="text-xs mt-2 opacity-80">{selectedLeaveType.name} is unpaid leave.</div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)} disabled={submitting}>Cancel</Button>
            <Button className={BRAND_CTA} onClick={submitRequest} disabled={submitting}>
              <Plus />
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirm */}
      <Dialog open={!!confirmCancelId} onOpenChange={(o) => !o && setConfirmCancelId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this leave request?</DialogTitle>
            <DialogDescription>
              This will withdraw the request from your reviewer's queue. You can submit a new one anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancelId(null)}>Keep request</Button>
            <Button className="bg-rose-600 hover:bg-rose-700 text-white border-0" onClick={cancelLeave}>
              <Trash2 />
              Cancel request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HrDocumentViewer
        open={docViewer.open}
        onClose={() => setDocViewer({ open: false, payslipId: null })}
        docType="payslip"
        employeeId={employee?.id}
        payslipId={docViewer.payslipId}
        employeeName={employee?.full_name}
      />
    </div>
  );
}
