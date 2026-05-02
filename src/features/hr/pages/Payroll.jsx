import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as AntApp } from 'antd';
import {
  Plus, Zap, Lock, FileText, RefreshCw, Banknote, Wallet, TrendingDown, Sparkles, Calendar,
} from 'lucide-react';
import dayjs from 'dayjs';

import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

import { hrService, formatINR, financialYearForMonth } from '../services/hrService';
import HrDocumentViewer from '../components/HrDocumentViewer';
import {
  PageHeader, KpiHero, SectionCard, EmptyState, KpiTile,
} from '../components/visuals';
import { BRAND_CTA } from '../components/tokens';

export default function Payroll() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const navigate = useNavigate();
  const { message } = AntApp.useApp();

  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [slipsLoading, setSlipsLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // { kind: 'process'|'lock', title, body, onOk }
  const [form, setForm] = useState({ month: dayjs().month() + 1, year: dayjs().year() });
  const [docViewer, setDocViewer] = useState({ open: false, payslipId: null, employeeId: null, employeeName: null });

  const loadRuns = async () => {
    if (!schoolCode) return;
    try {
      setLoading(true);
      const r = await hrService.listPayrollRuns(schoolCode);
      setRuns(r);
      if (r.length > 0 && !selectedRunId) setSelectedRunId(r[0].id);
    } catch (e) {
      message.error(e.message || 'Failed to load payroll runs');
    } finally {
      setLoading(false);
    }
  };

  const loadPayslips = async (runId) => {
    if (!runId) { setPayslips([]); return; }
    try {
      setSlipsLoading(true);
      const data = await hrService.listPayslipsForRun(runId);
      setPayslips(data);
    } catch (e) {
      message.error(e.message || 'Failed to load payslips');
    } finally {
      setSlipsLoading(false);
    }
  };

  useEffect(() => { loadRuns(); /* eslint-disable-next-line */ }, [schoolCode]);
  useEffect(() => { loadPayslips(selectedRunId); /* eslint-disable-next-line */ }, [selectedRunId]);

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null;

  const totals = useMemo(() => payslips.reduce((acc, p) => ({
    gross: acc.gross + Number(p.gross_earnings || 0),
    deductions: acc.deductions + Number(p.total_deductions || 0),
    net: acc.net + Number(p.net_pay || 0),
  }), { gross: 0, deductions: 0, net: 0 }), [payslips]);

  const hasCurrentMonthRun = runs.some((r) => r.month === dayjs().month() + 1 && r.year === dayjs().year());

  const submitCreate = async () => {
    try {
      if (!form.month || !form.year) {
        message.warning('Please enter month and year');
        return;
      }
      setBusy(true);
      const fy = financialYearForMonth(form.year, form.month);
      const created = await hrService.createPayrollRun({
        school_code: schoolCode,
        month: form.month,
        year: form.year,
        financial_year: fy,
      });
      message.success('Payroll run created');
      setCreateOpen(false);
      await loadRuns();
      setSelectedRunId(created.id);
    } catch (e) {
      message.error(e.message || 'Failed to create run');
    } finally {
      setBusy(false);
    }
  };

  const askProcess = () => setConfirm({
    kind: 'process',
    title: 'Process this payroll run?',
    body: 'Payslips will be computed for all active employees. You can re-process while the run is still in draft.',
    confirmLabel: 'Process run',
    confirmTone: 'sky',
    icon: <Zap />,
    onOk: async () => {
      try {
        setBusy(true);
        await hrService.processPayrollRun(selectedRun.id);
        message.success('Payroll processed');
        await loadRuns();
        await loadPayslips(selectedRun.id);
        setConfirm(null);
      } catch (e) {
        message.error(e.message || 'Failed to process payroll');
      } finally {
        setBusy(false);
      }
    },
  });

  const askLock = () => setConfirm({
    kind: 'lock',
    title: 'Lock this payroll run?',
    body: 'Once locked, no further edits are allowed and payslips become final.',
    confirmLabel: 'Lock run',
    confirmTone: 'rose',
    icon: <Lock />,
    onOk: async () => {
      try {
        setBusy(true);
        await hrService.lockPayrollRun(selectedRun.id);
        message.success('Payroll locked');
        await loadRuns();
        setConfirm(null);
      } catch (e) {
        message.error(e.message || 'Failed to lock run');
      } finally {
        setBusy(false);
      }
    },
  });

  if (loading) {
    return (
      <div className="px-7 py-6 max-w-[1400px] mx-auto space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const totalEmployees = payslips.length;
  const collectionPct = totals.gross > 0 ? Math.round((totals.net / totals.gross) * 100) : 0;

  return (
    <div className="px-7 py-6 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Compensation"
        title="Payroll"
        subtitle={`${runs.length} run${runs.length !== 1 ? 's' : ''} · ${schoolCode}`}
        actions={
          <>
            <Button variant="outline" onClick={loadRuns} disabled={loading}>
              <RefreshCw className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
            {!hasCurrentMonthRun && (
              <Button className={BRAND_CTA} onClick={() => { setForm({ month: dayjs().month() + 1, year: dayjs().year() }); setCreateOpen(true); }}>
                <Plus />
                Create run · {dayjs().format('MMM YYYY')}
              </Button>
            )}
          </>
        }
      />

      {runs.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={<Wallet size={20} />}
            title="No payroll runs yet"
            subtitle="Create your first run for the current month to compute payslips."
            action={
              <Button className={BRAND_CTA} onClick={() => setCreateOpen(true)}>
                <Plus />
                Create first run
              </Button>
            }
          />
        </SectionCard>
      ) : (
        <>
          {/* Run selector + status hero */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
            <div className="lg:col-span-2">
              <KpiHero
                tone="brand"
                eyebrow={selectedRun ? `Payroll run · FY ${selectedRun.financial_year}` : 'Select a run'}
                value={selectedRun ? formatINR(totals.net).replace('₹', '') : '—'}
                prefix={selectedRun ? '₹' : null}
                label={
                  selectedRun
                    ? `Net pay across ${totalEmployees} employee${totalEmployees === 1 ? '' : 's'}`
                    : 'Pick a run from the dropdown'
                }
                icon={<Banknote size={16} />}
                foot={
                  <div className="flex items-center justify-between gap-3">
                    <Select value={selectedRunId ?? ''} onValueChange={setSelectedRunId}>
                      <SelectTrigger className="bg-white/15 hover:bg-white/25 border-white/20 text-white shadow-none w-fit min-w-[260px]">
                        <SelectValue placeholder="Select run" />
                      </SelectTrigger>
                      <SelectContent>
                        {runs.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {dayjs().month(r.month - 1).format('MMMM')} {r.year} · FY {r.financial_year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedRun && (
                      <span className="px-2.5 py-1 rounded-full bg-white/20 text-white text-[11px] font-semibold uppercase tracking-wider">
                        {selectedRun.status}
                      </span>
                    )}
                  </div>
                }
              />
            </div>

            {/* Action panel */}
            <SectionCard
              tone={selectedRun?.status === 'locked' ? 'emerald' : selectedRun?.status === 'processing' ? 'sky' : 'amber'}
              icon={<Sparkles size={14} />}
              title="Run actions"
              subtitle={selectedRun ? `Status: ${selectedRun.status}` : 'No run selected'}
            >
              {!selectedRun ? (
                <div className="text-sm text-slate-500">Select a run to view actions.</div>
              ) : selectedRun.status === 'draft' ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">This run is in draft. Process it to compute payslips for all active employees.</p>
                  <Button onClick={askProcess} className="w-full bg-sky-600 hover:bg-sky-700 text-white border-0">
                    <Zap />
                    Process run
                  </Button>
                </div>
              ) : selectedRun.status === 'processing' ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">Payslips computed. Lock the run to finalise.</p>
                  <Button onClick={askLock} className="w-full bg-rose-600 hover:bg-rose-700 text-white border-0">
                    <Lock />
                    Lock run
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 ring-1 ring-emerald-100 text-emerald-700">
                  <Lock size={16} />
                  <div className="text-sm font-medium">Run locked · final</div>
                </div>
              )}
            </SectionCard>
          </div>

          {/* Totals */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <KpiTile tone="emerald" label="Gross" value={formatINR(totals.gross)} icon={<Wallet size={16} />} />
            <KpiTile tone="rose" label="Deductions" value={formatINR(totals.deductions)} icon={<TrendingDown size={16} />} />
            <KpiTile tone="brand" label="Net total" value={formatINR(totals.net)} icon={<Banknote size={16} />} sub={`${collectionPct}% of gross`} />
            <KpiTile tone="sky" label="Employees" value={totalEmployees} icon={<Calendar size={16} />} />
          </div>

          {/* Payslips table */}
          <SectionCard
            tone="brand"
            icon={<Banknote size={14} className="text-indigo-600" />}
            title="Payslips"
            subtitle={selectedRun ? `${dayjs().month(selectedRun.month - 1).format('MMMM')} ${selectedRun.year}` : null}
            padding="p-0"
          >
            {slipsLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : payslips.length === 0 ? (
              <EmptyState icon={<Banknote size={20} />} title="No payslips for this run yet" />
            ) : (
              <TooltipProvider delayDuration={200}>
                <Table className="table-fixed">
                  <colgroup>
                    <col />
                    <col className="w-[160px]" />
                    <col className="w-[100px]" />
                    <col className="w-[130px]" />
                    <col className="w-[130px]" />
                    <col className="w-[150px]" />
                    <col className="w-[60px]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                      <TableHead className="pl-5">Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Paid days</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Deductions</TableHead>
                      <TableHead className="text-right">Net pay</TableHead>
                      <TableHead className="pr-5 text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payslips.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="pl-5 py-3">
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate">{r.employees?.full_name}</div>
                              <div className="text-xs text-slate-500 truncate">
                                <span className="font-mono">{r.employees?.employee_code}</span>
                                <span className="mx-1">·</span>
                                {r.employees?.designation}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600 truncate">{r.employees?.department}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.paid_days}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatINR(r.gross_earnings)}</TableCell>
                          <TableCell className="text-right tabular-nums text-rose-700">{formatINR(r.total_deductions)}</TableCell>
                          <TableCell className="text-right tabular-nums font-bold text-emerald-700">{formatINR(r.net_pay)}</TableCell>
                          <TableCell className="pr-5 text-right">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => setDocViewer({
                                    open: true, payslipId: r.id, employeeId: r.employee_id, employeeName: r.employees?.full_name,
                                  })}
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
        </>
      )}

      {/* Create run dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create payroll run</DialogTitle>
            <DialogDescription>Select the month and year for the new run.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="month">Month (1–12)</Label>
              <Input
                id="month"
                type="number"
                min={1}
                max={12}
                value={form.month}
                onChange={(e) => setForm((f) => ({ ...f, month: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                min={2000}
                max={2100}
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
              />
            </div>
            <div className="col-span-2">
              <div className="rounded-lg bg-indigo-50 ring-1 ring-indigo-100 px-3 py-2.5 text-sm">
                <span className="text-indigo-700 font-semibold">Financial year: </span>
                <span className="font-mono text-slate-900">FY {financialYearForMonth(form.year, form.month) || '—'}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={busy}>Cancel</Button>
            <Button className={BRAND_CTA} onClick={submitCreate} disabled={busy}>
              <Plus />
              Create run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm dialog (process / lock) */}
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>Cancel</Button>
            <Button
              onClick={() => confirm?.onOk()}
              disabled={busy}
              className={
                confirm?.confirmTone === 'rose'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white border-0'
                  : 'bg-sky-600 hover:bg-sky-700 text-white border-0'
              }
            >
              {confirm?.icon}
              {confirm?.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HrDocumentViewer
        open={docViewer.open}
        onClose={() => setDocViewer({ open: false, payslipId: null, employeeId: null, employeeName: null })}
        docType="payslip"
        employeeId={docViewer.employeeId}
        payslipId={docViewer.payslipId}
        employeeName={docViewer.employeeName}
      />
    </div>
  );
}
