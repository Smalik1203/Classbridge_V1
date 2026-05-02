import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { App as AntApp } from 'antd';
import {
  Pencil, Wallet, Mail, Phone, User, FileText, ChevronLeft, ChevronRight,
  ChevronDown, FileEdit, Briefcase, Building2, Calendar, BadgeCheck, Banknote, Clock,
  Sparkles, IdCard,
} from 'lucide-react';
import dayjs from 'dayjs';

import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { hrService, formatINR } from '../services/hrService';
import EmployeeFormModal from '../components/EmployeeFormModal';
import SalaryStructureModal from '../components/SalaryStructureModal';
import HrDocumentViewer from '../components/HrDocumentViewer';
import {
  StatusPill, KpiTile, SectionCard, EmptyState,
} from '../components/visuals';
import { BRAND_CTA } from '../components/tokens';
import { cn } from '@/lib/utils';

const STATUS_TONES = {
  active: 'emerald', on_notice: 'amber', inactive: 'slate', terminated: 'rose',
};

const ATT_TONE = {
  present: { bg: 'bg-emerald-500', text: 'text-white' },
  late: { bg: 'bg-amber-500', text: 'text-white' },
  half_day: { bg: 'bg-amber-300', text: 'text-amber-900' },
  absent: { bg: 'bg-rose-500', text: 'text-white' },
  on_leave: { bg: 'bg-indigo-500', text: 'text-white' },
  holiday: { bg: 'bg-slate-300', text: 'text-slate-700' },
  weekoff: { bg: 'bg-slate-200', text: 'text-slate-600' },
};

const LEAVE_STATUS_TONE = {
  pending: 'amber', approved: 'emerald', rejected: 'rose', cancelled: 'slate',
};

export default function StaffDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const navigate = useNavigate();
  const { message } = AntApp.useApp();

  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState(null);
  const [leaveBalance, setLeaveBalance] = useState([]);
  const [leaveApps, setLeaveApps] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [attYearMonth, setAttYearMonth] = useState({ year: dayjs().year(), month: dayjs().month() + 1 });
  const [editOpen, setEditOpen] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [salaryStructure, setSalaryStructure] = useState(null);
  const [docViewer, setDocViewer] = useState({ open: false, docType: null, payslipId: null });

  const loadEmployee = async () => {
    try {
      const emp = await hrService.getEmployee(id);
      setEmployee(emp);
      const ay = await hrService.getActiveAcademicYearId(schoolCode);
      if (ay?.id) {
        try {
          const lb = await hrService.getLeaveBalance(emp.id, ay.id);
          setLeaveBalance(lb);
        } catch { /* ignore */ }
      }
      const apps = await hrService.listLeaveApplications(emp.id);
      setLeaveApps(apps);
      const slips = await hrService.listPayslipsForEmployee(emp.id);
      setPayslips(slips);
      try {
        const struct = await hrService.getActiveSalaryStructure(emp.id);
        setSalaryStructure(struct);
      } catch { /* ignore */ }
    } catch (e) {
      message.error(e.message || 'Failed to load employee');
    } finally {
      setLoading(false);
    }
  };

  const loadAttendance = async () => {
    if (!employee) return;
    try {
      const att = await hrService.getEmployeeAttendance(employee.id, attYearMonth.year, attYearMonth.month);
      setAttendance(att);
    } catch (e) {
      message.error(e.message || 'Failed to load attendance');
    }
  };

  useEffect(() => { loadEmployee(); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => { loadAttendance(); /* eslint-disable-next-line */ }, [employee?.id, attYearMonth.year, attYearMonth.month]);

  if (loading) {
    return (
      <div className="px-7 py-6 max-w-[1400px] mx-auto space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="px-7 py-12 max-w-[1400px] mx-auto">
        <EmptyState
          icon={<User size={20} />}
          title="Employee not found"
          subtitle="This profile may have been removed."
          action={<Button onClick={() => navigate('/hr/staff')} className={BRAND_CTA}>Back to directory</Button>}
        />
      </div>
    );
  }

  const yearsInService = employee.join_date ? dayjs().diff(dayjs(employee.join_date), 'month') : 0;
  const ysLabel = `${Math.floor(yearsInService / 12)}y ${yearsInService % 12}m`;

  const monthLabel = dayjs(`${attYearMonth.year}-${String(attYearMonth.month).padStart(2, '0')}-01`).format('MMMM YYYY');
  const isCurrentMonth = attYearMonth.year === dayjs().year() && attYearMonth.month === dayjs().month() + 1;
  const moveMonth = (delta) => {
    const d = dayjs(`${attYearMonth.year}-${String(attYearMonth.month).padStart(2, '0')}-01`).add(delta, 'month');
    setAttYearMonth({ year: d.year(), month: d.month() + 1 });
  };

  const monthlyEarnings = salaryStructure?.lines.filter((l) => l.component?.type === 'earning').reduce((s, l) => s + Number(l.monthly_amount || 0), 0) || 0;
  const monthlyDeductions = salaryStructure?.lines.filter((l) => l.component?.type === 'deduction').reduce((s, l) => s + Number(l.monthly_amount || 0), 0) || 0;

  return (
    <div className="px-7 py-6 max-w-[1400px] mx-auto">
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
                <StatusPill tone={STATUS_TONES[employee.status] || 'slate'}>
                  {employee.status?.replace('_', ' ')}
                </StatusPill>
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <FileText />
                    Generate document
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setDocViewer({ open: true, docType: 'appointment_letter', payslipId: null })}>
                    Appointment Letter
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setDocViewer({ open: true, docType: 'experience_letter', payslipId: null })}>
                    Experience Letter
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!employee.relieving_date}
                    onSelect={() => setDocViewer({ open: true, docType: 'relieving_letter', payslipId: null })}
                  >
                    Relieving Letter
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" onClick={() => setSalaryOpen(true)}>
                <Wallet />
                Salary structure
              </Button>
              <Button className={BRAND_CTA} onClick={() => setEditOpen(true)}>
                <Pencil />
                Edit
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <KpiTile tone="brand" label="Years in service" value={ysLabel} icon={<Briefcase size={16} />} />
            <KpiTile tone="amber" label="Pending leaves" value={leaveApps.filter((l) => l.status === 'pending').length} icon={<Clock size={16} />} />
            <KpiTile tone="emerald" label="Approved (FY)" value={leaveApps.filter((l) => l.status === 'approved').length} icon={<BadgeCheck size={16} />} />
            <KpiTile tone="sky" label="Payslips" value={payslips.length} icon={<Banknote size={16} />} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="gap-4">
        <TabsList variant="line" className="border-b border-slate-200 w-full justify-start rounded-none px-0">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="leaves">Leaves ({leaveApps.length})</TabsTrigger>
          <TabsTrigger value="payslips">Payslips ({payslips.length})</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SectionCard tone="brand" icon={<User size={14} className="text-indigo-600" />} title="Personal">
              <Descriptions
                items={[
                  ['Gender', employee.gender ?? '—'],
                  ['Date of birth', employee.date_of_birth ? dayjs(employee.date_of_birth).format('DD MMM YYYY') : '—'],
                  ['Phone', employee.phone ?? '—'],
                  ['Email', employee.email ?? '—'],
                  ['Address', employee.address ?? '—'],
                ]}
              />
            </SectionCard>

            <SectionCard tone="sky" icon={<Building2 size={14} className="text-sky-600" />} title="Employment">
              <Descriptions
                items={[
                  ['Department', employee.department],
                  ['Designation', employee.designation],
                  ['Type', employee.employment_type],
                  ['Joined', employee.join_date ? dayjs(employee.join_date).format('DD MMM YYYY') : '—'],
                  ['Confirmed', employee.confirmation_date ? dayjs(employee.confirmation_date).format('DD MMM YYYY') : '—'],
                  ['Years in service', ysLabel],
                ]}
              />
            </SectionCard>

            <SectionCard tone="emerald" icon={<Banknote size={14} className="text-emerald-600" />} title="Bank & Tax">
              <Descriptions
                items={[
                  ['PAN', employee.pan_number ?? '—'],
                  ['A/C #', employee.bank_account_number ?? '—'],
                  ['IFSC', employee.bank_ifsc ?? '—'],
                  ['Bank', employee.bank_name ?? '—'],
                  ['TDS applicable', employee.is_tds_applicable ? 'Yes' : 'No'],
                ]}
              />
            </SectionCard>

            <SectionCard tone="amber" icon={<Calendar size={14} className="text-amber-600" />} title="Leave Balance">
              {leaveBalance.length === 0 ? (
                <div className="text-sm text-slate-500">No leave balance available for the active academic year.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {leaveBalance.map((b) => (
                    <div key={b.leave_type_id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50/80 border border-slate-200/60">
                      <div className="min-w-0">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 text-[11px] font-semibold">
                          {b.leave_type_code}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1 truncate">{b.leave_type_name}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-bold text-slate-900 tabular-nums leading-none">{b.balance}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">used {b.used} / {b.annual_quota}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <div className="md:col-span-2">
              <SectionCard
                tone="brand"
                icon={<Wallet size={14} className="text-indigo-600" />}
                title="Salary Structure"
                action={
                  <Button variant="ghost" size="sm" onClick={() => setSalaryOpen(true)}>
                    {salaryStructure ? <FileEdit /> : <Sparkles />}
                    {salaryStructure ? 'Edit' : 'Set up'}
                  </Button>
                }
              >
                {!salaryStructure ? (
                  <EmptyState
                    icon={<Wallet size={20} />}
                    title="No salary structure set yet"
                    subtitle="Configure earnings and deductions to enable payroll for this employee."
                  />
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KpiTile tone="brand" label="Annual CTC" value={formatINR(salaryStructure.structure.ctc)} icon={<Wallet size={14} />} />
                    <KpiTile tone="sky" label="Effective From" value={dayjs(salaryStructure.structure.effective_from).format('DD MMM YYYY')} icon={<Calendar size={14} />} />
                    <KpiTile tone="emerald" label="Monthly earnings" value={formatINR(monthlyEarnings)} icon={<Banknote size={14} />} />
                    <KpiTile tone="rose" label="Monthly deductions" value={formatINR(monthlyDeductions)} icon={<Banknote size={14} />} />
                  </div>
                )}
              </SectionCard>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leaves">
          <SectionCard padding="p-0">
            {leaveApps.length === 0 ? (
              <EmptyState icon={<Calendar size={20} />} title="No leave applications" />
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
                    <TableHead className="pr-5">Applied</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveApps.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-5 font-medium text-slate-700">{r.leave_types?.name ?? r.leave_type_id}</TableCell>
                      <TableCell className="text-slate-600 text-sm">{dayjs(r.from_date).format('DD MMM YYYY')}</TableCell>
                      <TableCell className="text-slate-600 text-sm">{dayjs(r.to_date).format('DD MMM YYYY')}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.days}</TableCell>
                      <TableCell>
                        <StatusPill tone={LEAVE_STATUS_TONE[r.status] || 'slate'}>{r.status}</StatusPill>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 max-w-[260px] truncate">{r.reason ?? '—'}</TableCell>
                      <TableCell className="pr-5 text-sm text-slate-500">{dayjs(r.applied_at).format('DD MMM YYYY HH:mm')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="payslips">
          <SectionCard padding="p-0">
            {payslips.length === 0 ? (
              <EmptyState icon={<Banknote size={20} />} title="No payslips yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                    <TableHead className="pl-5">Period</TableHead>
                    <TableHead>FY</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-5 text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslips.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-5 font-medium">
                        {dayjs().month(r.run_month - 1).format('MMM')} {r.run_year}
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">{r.financial_year}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(r.gross_earnings)}</TableCell>
                      <TableCell className="text-right tabular-nums text-rose-700">{formatINR(r.total_deductions)}</TableCell>
                      <TableCell className="text-right tabular-nums font-bold text-emerald-700">{formatINR(r.net_pay)}</TableCell>
                      <TableCell><StatusPill tone="sky">{r.run_status}</StatusPill></TableCell>
                      <TableCell className="pr-5 text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDocViewer({ open: true, docType: 'payslip', payslipId: r.id })}
                        >
                          <FileText size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="attendance">
          <SectionCard
            tone="brand"
            icon={<Calendar size={14} className="text-indigo-600" />}
            title={monthLabel}
            action={
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="icon-sm" onClick={() => moveMonth(-1)}><ChevronLeft size={14} /></Button>
                <Button variant="outline" size="icon-sm" onClick={() => moveMonth(1)} disabled={isCurrentMonth}>
                  <ChevronRight size={14} />
                </Button>
              </div>
            }
          >
            {/* Legend */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {Object.entries({ present: 'Present', late: 'Late', half_day: 'Half day', absent: 'Absent', on_leave: 'On leave' }).map(([k, label]) => (
                <span key={k} className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold', ATT_TONE[k].bg, ATT_TONE[k].text)}>
                  <span className="size-1.5 rounded-full bg-current opacity-80" />
                  {label}
                  <span className="opacity-80">{attendance.filter((a) => a.status === k).length}</span>
                </span>
              ))}
            </div>

            <AttendanceCalendar year={attYearMonth.year} month={attYearMonth.month} data={attendance} />

            {attendance.length > 0 && (
              <div className="mt-4 -mx-5 -mb-5 border-t border-slate-100">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                      <TableHead className="pl-5">Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>In</TableHead>
                      <TableHead>Out</TableHead>
                      <TableHead className="text-right">Late (min)</TableHead>
                      <TableHead className="pr-5">Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.slice(0, 50).map((a) => {
                      const tone = ATT_TONE[a.status] || ATT_TONE.weekoff;
                      return (
                        <TableRow key={a.date}>
                          <TableCell className="pl-5 text-sm font-medium">{dayjs(a.date).format('ddd, DD MMM')}</TableCell>
                          <TableCell>
                            <span className={cn('px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize', tone.bg, tone.text)}>
                              {a.status?.replace('_', ' ')}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">{a.in_time ?? '—'}</TableCell>
                          <TableCell className="text-sm tabular-nums">{a.out_time ?? '—'}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm">{a.late_minutes ?? '—'}</TableCell>
                          <TableCell className="pr-5 text-sm text-slate-600 max-w-[260px] truncate">{a.note ?? '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      <EmployeeFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        schoolCode={schoolCode}
        employee={employee}
        onSaved={(saved) => setEmployee(saved)}
      />
      <SalaryStructureModal
        open={salaryOpen}
        onClose={() => setSalaryOpen(false)}
        schoolCode={schoolCode}
        employee={employee}
        onSaved={async () => {
          try {
            const struct = await hrService.getActiveSalaryStructure(employee.id);
            setSalaryStructure(struct);
          } catch { /* ignore */ }
        }}
      />
      <HrDocumentViewer
        open={docViewer.open}
        onClose={() => setDocViewer({ open: false, docType: null, payslipId: null })}
        docType={docViewer.docType}
        employeeId={employee.id}
        payslipId={docViewer.payslipId}
        employeeName={employee.full_name}
      />
    </div>
  );
}

function Descriptions({ items }) {
  return (
    <dl className="grid grid-cols-1 gap-y-2 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[120px_1fr] gap-3 items-baseline">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{k}</dt>
          <dd className="text-slate-800 truncate">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function AttendanceCalendar({ year, month, data }) {
  const monthStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  const daysInMonth = monthStart.daysInMonth();
  const firstWeekday = (monthStart.day() + 6) % 7;
  const today = dayjs();
  const byDate = {};
  data.forEach((a) => { byDate[a.date] = a; });

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = monthStart.date(d).format('YYYY-MM-DD');
    cells.push({ d, date, rec: byDate[date] });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <TooltipProvider delayDuration={150}>
      <div>
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((c, i) => {
            if (!c) return <div key={i} className="aspect-square" />;
            const status = c.rec?.status;
            const tone = status ? ATT_TONE[status] : null;
            const isFuture = dayjs(c.date).isAfter(today, 'day');
            const isToday = dayjs(c.date).isSame(today, 'day');
            const tooltipParts = [c.rec?.status, c.rec?.in_time && `In: ${c.rec.in_time}`, c.rec?.out_time && `Out: ${c.rec.out_time}`].filter(Boolean);
            const label = tooltipParts.length ? `${dayjs(c.date).format('DD MMM YYYY')} · ${tooltipParts.join(' · ')}` : dayjs(c.date).format('DD MMM YYYY');
            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'aspect-square rounded-lg grid place-items-center text-sm font-semibold transition-transform hover:scale-105 cursor-default',
                      tone ? `${tone.bg} ${tone.text} shadow-sm` : isFuture ? 'bg-slate-50 text-slate-300' : 'bg-white text-slate-400 border border-slate-200',
                      isToday && 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-white',
                    )}
                  >
                    {c.d}
                  </div>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
