import React, { useEffect, useMemo, useState } from 'react';
import { App as AntApp } from 'antd';
import {
  Plus, Trash2, Download, RefreshCw, Receipt, AlertTriangle, Wallet, FileSpreadsheet,
  Banknote, ShieldCheck,
} from 'lucide-react';
import dayjs from 'dayjs';

import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

import { taxService } from '../services/taxService';
import {
  PageHeader, KpiTile, SectionCard, EmptyState, AlertBar,
} from '../components/visuals';
import { BRAND_CTA } from '../components/tokens';
import { cn } from '@/lib/utils';

const formatINR = (v) =>
  '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const QUARTERS = [
  { q: 1, label: 'Q1', months: 'Apr–Jun' },
  { q: 2, label: 'Q2', months: 'Jul–Sep' },
  { q: 3, label: 'Q3', months: 'Oct–Dec' },
  { q: 4, label: 'Q4', months: 'Jan–Mar' },
];

// CSV helpers
const csvEscape = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
};
const downloadCsv = (filename, rows) => {
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export default function Form24Q() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const { message } = AntApp.useApp();

  const [loading, setLoading] = useState(true);
  const [fy, setFy] = useState(taxService.currentFY());
  const [quarter, setQuarter] = useState(currentQuarter(fy));
  const [challans, setChallans] = useState([]);
  const [annexureI, setAnnexureI] = useState([]);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    challan_date: dayjs().format('YYYY-MM-DD'),
    bsr_code: '',
    challan_serial: '',
    amount: 0,
    total_tax: 0, surcharge: 0, cess: 0, interest: 0, fee: 0,
    notes: '',
  });

  const load = async () => {
    if (!schoolCode) return;
    try {
      setLoading(true);
      const [ch, annI] = await Promise.all([
        taxService.listChallans(schoolCode, fy, null),
        taxService.exportAnnexureI(schoolCode, fy, quarter),
      ]);
      setChallans(ch);
      setAnnexureI(annI);
    } catch (e) {
      message.error(e.message || 'Failed to load 24Q data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [schoolCode, fy, quarter]);

  const challansForQuarter = useMemo(
    () => challans.filter((c) => c.quarter === quarter),
    [challans, quarter],
  );

  const totals = useMemo(() => ({
    challanTotal: challansForQuarter.reduce((s, c) => s + Number(c.amount || 0), 0),
    deducteeTotal: annexureI.reduce((s, r) => s + Number(r.tds_deducted || 0), 0),
    deducteeCount: annexureI.length,
    grossPaid: annexureI.reduce((s, r) => s + Number(r.total_paid || 0), 0),
  }), [challansForQuarter, annexureI]);

  const reconciliation = totals.deducteeTotal - totals.challanTotal;

  const handleAddChallan = async () => {
    if (!form.bsr_code || form.bsr_code.length !== 7) return message.warning('BSR code must be 7 digits');
    if (!form.challan_serial) return message.warning('Challan serial is required');
    if (!form.amount || form.amount <= 0) return message.warning('Amount must be > 0');
    try {
      setBusy(true);
      await taxService.addChallan({
        school_code: schoolCode,
        financial_year: fy,
        quarter,
        challan_date: form.challan_date,
        bsr_code: form.bsr_code,
        challan_serial: form.challan_serial,
        amount: Number(form.amount),
        total_tax: Number(form.total_tax || 0),
        surcharge: Number(form.surcharge || 0),
        cess: Number(form.cess || 0),
        interest: Number(form.interest || 0),
        fee: Number(form.fee || 0),
        notes: form.notes || null,
      });
      message.success('Challan added');
      setAddOpen(false);
      setForm({
        challan_date: dayjs().format('YYYY-MM-DD'),
        bsr_code: '', challan_serial: '', amount: 0,
        total_tax: 0, surcharge: 0, cess: 0, interest: 0, fee: 0, notes: '',
      });
      load();
    } catch (e) {
      message.error(e.message || 'Failed to add');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteChallan = async (id) => {
    try {
      await taxService.deleteChallan(id);
      message.success('Challan deleted');
      load();
    } catch (e) {
      message.error(e.message);
    }
  };

  const exportAnnIcsv = () => {
    if (annexureI.length === 0) return message.info('No deductee data for this quarter');
    const rows = [
      ['Sr.No.', 'Employee Code', 'Employee Name', 'PAN', 'Section', 'Total Paid (INR)', 'TDS Deducted (INR)', 'Date of Last Payment'],
      ...annexureI.map((r, i) => [
        i + 1, r.employee_code, r.employee_name, r.pan_number || '',
        r.section, Number(r.total_paid).toFixed(2), Number(r.tds_deducted).toFixed(2),
        r.last_payment_date ? dayjs(r.last_payment_date).format('DD-MM-YYYY') : '',
      ]),
    ];
    downloadCsv(`24Q_AnnexureI_${fy}_Q${quarter}.csv`, rows);
  };

  const exportAnnIIcsv = async () => {
    try {
      const data = await taxService.exportAnnexureII(schoolCode, fy);
      if (data.length === 0) return message.info('No tax computations available — process payroll first');
      const rows = [
        ['Sr.No.', 'Employee Code', 'Employee Name', 'PAN', 'Regime',
         'Gross Salary', 'HRA Exemption', 'Standard Deduction', 'Professional Tax',
         '80C', '80CCD(1B)', '80CCD(2)', '80D', 'Other Chapter VI-A', '24(b)',
         'Taxable Income', 'Income Tax', 'Surcharge', 'Rebate 87A', 'Cess', 'Total Tax', 'TDS Deducted'],
        ...data.map((r, i) => [
          i + 1, r.employee_code, r.employee_name, r.pan_number || '', r.regime,
          Number(r.gross_salary).toFixed(0), Number(r.hra_exemption).toFixed(0),
          Number(r.standard_deduction).toFixed(0), Number(r.professional_tax).toFixed(0),
          Number(r.total_80c).toFixed(0), Number(r.total_80ccd_1b).toFixed(0),
          Number(r.total_80ccd_2).toFixed(0), Number(r.total_80d).toFixed(0),
          Number(r.total_other_chapter_via).toFixed(0), Number(r.total_24b).toFixed(0),
          Number(r.taxable_income).toFixed(0), Number(r.income_tax).toFixed(0),
          Number(r.surcharge).toFixed(0), Number(r.rebate_87a).toFixed(0),
          Number(r.cess).toFixed(0), Number(r.total_tax).toFixed(0), Number(r.tds_deducted).toFixed(0),
        ]),
      ];
      downloadCsv(`24Q_AnnexureII_${fy}.csv`, rows);
      message.success(`Exported ${data.length} employees`);
    } catch (e) {
      message.error(e.message);
    }
  };

  const exportChallansCsv = () => {
    if (challansForQuarter.length === 0) return message.info('No challans for this quarter');
    const rows = [
      ['Sr.No.', 'BSR Code', 'Challan Serial', 'Date', 'Total Tax', 'Surcharge', 'Cess', 'Interest', 'Fee', 'Total Amount', 'Notes'],
      ...challansForQuarter.map((c, i) => [
        i + 1, c.bsr_code, c.challan_serial, dayjs(c.challan_date).format('DD-MM-YYYY'),
        Number(c.total_tax).toFixed(2), Number(c.surcharge).toFixed(2), Number(c.cess).toFixed(2),
        Number(c.interest).toFixed(2), Number(c.fee).toFixed(2), Number(c.amount).toFixed(2),
        c.notes || '',
      ]),
    ];
    downloadCsv(`24Q_Challans_${fy}_Q${quarter}.csv`, rows);
  };

  return (
    <div className="px-7 py-6 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow={`Form 24Q · FY ${fy}`}
        title="Form 24Q — Quarterly TDS Return"
        subtitle="Challan ledger + deductee-wise summary for upload into the official RPU tool"
        actions={
          <>
            <FYSwitcher fy={fy} onChange={setFy} />
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </>
        }
      />

      {/* Quarter selector */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Quarter</span>
        {QUARTERS.map((q) => (
          <button
            key={q.q}
            onClick={() => setQuarter(q.q)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-all border-2',
              quarter === q.q
                ? 'bg-gradient-to-br from-indigo-600 to-blue-500 text-white border-indigo-600 shadow-md shadow-indigo-500/30'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300',
            )}
          >
            <div>{q.label}</div>
            <div className="text-[10px] font-normal opacity-80">{q.months}</div>
          </button>
        ))}
      </div>

      {/* Reconciliation summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <KpiTile tone="brand" label="Deductees (Q)" value={totals.deducteeCount} icon={<ShieldCheck size={16} />} />
        <KpiTile tone="emerald" label="Gross paid (Q)" value={formatINR(totals.grossPaid)} icon={<Wallet size={16} />} />
        <KpiTile tone="amber" label="TDS deducted (Q)" value={formatINR(totals.deducteeTotal)} icon={<Receipt size={16} />} />
        <KpiTile
          tone={reconciliation === 0 ? 'emerald' : 'rose'}
          label="Reconciliation gap"
          value={formatINR(reconciliation)}
          sub={reconciliation === 0 ? 'Challans match deductee TDS' : reconciliation > 0 ? 'TDS not yet deposited' : 'Over-deposited'}
          icon={reconciliation === 0 ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
        />
      </div>

      {reconciliation > 0 && (
        <AlertBar
          tone="rose"
          className="mb-5"
          icon={<AlertTriangle size={18} className="text-rose-600" />}
          title={`${formatINR(reconciliation)} of TDS deducted but not yet deposited as challan`}
          description="Add the corresponding TDS challan(s) below before filing 24Q. Late deposit attracts interest u/s 201(1A)."
        />
      )}

      {/* Challan ledger */}
      <SectionCard
        tone="brand"
        icon={<Banknote size={14} className="text-indigo-600" />}
        title={`Challans · Q${quarter}`}
        subtitle="TDS deposits made to the government this quarter"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportChallansCsv}>
              <Download size={14} />
              Export
            </Button>
            <Button size="sm" className={BRAND_CTA} onClick={() => setAddOpen(true)}>
              <Plus />
              Add challan
            </Button>
          </div>
        }
        padding="p-0"
        className="mb-5"
      >
        {challansForQuarter.length === 0 ? (
          <EmptyState
            icon={<Banknote size={20} />}
            title={`No challans recorded for Q${quarter}`}
            subtitle="Add a challan after each TDS deposit to government via NSDL/bank challan."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                <TableHead className="pl-5">Date</TableHead>
                <TableHead>BSR code</TableHead>
                <TableHead>Challan serial</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Surcharge</TableHead>
                <TableHead className="text-right">Cess</TableHead>
                <TableHead className="text-right">Interest</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="pr-5"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {challansForQuarter.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-5 text-sm">{dayjs(c.challan_date).format('DD MMM YYYY')}</TableCell>
                  <TableCell className="font-mono text-xs">{c.bsr_code}</TableCell>
                  <TableCell className="font-mono text-xs">{c.challan_serial}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(c.total_tax)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(c.surcharge)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(c.cess)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(c.interest)}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold text-emerald-700">{formatINR(c.amount)}</TableCell>
                  <TableCell className="pr-5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-rose-700 hover:bg-rose-50"
                      onClick={() => handleDeleteChallan(c.id)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      {/* Annexure I deductee summary */}
      <SectionCard
        tone="emerald"
        icon={<FileSpreadsheet size={14} className="text-emerald-600" />}
        title={`Annexure I · Q${quarter} deductees`}
        subtitle="Per-employee TDS for the quarter — paste into RPU tool's Annexure I sheet"
        action={
          <Button variant="outline" size="sm" onClick={exportAnnIcsv}>
            <Download size={14} />
            Export Annexure I (CSV)
          </Button>
        }
        padding="p-0"
        className="mb-5"
      >
        {loading && annexureI.length === 0 ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : annexureI.length === 0 ? (
          <EmptyState
            icon={<FileSpreadsheet size={20} />}
            title="No TDS deducted in this quarter yet"
            subtitle="Process payroll first; employees with TDS > 0 will appear here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                <TableHead className="pl-5">Employee</TableHead>
                <TableHead>PAN</TableHead>
                <TableHead className="text-right">Total paid</TableHead>
                <TableHead className="text-right">TDS deducted</TableHead>
                <TableHead className="pr-5">Last payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {annexureI.map((r) => (
                <TableRow key={r.employee_id}>
                  <TableCell className="pl-5">
                    <div className="font-semibold text-slate-900">{r.employee_name}</div>
                    <div className="text-xs text-slate-500 font-mono">{r.employee_code}</div>
                  </TableCell>
                  <TableCell>
                    {r.pan_number ? (
                      <span className="font-mono text-xs">{r.pan_number}</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 ring-1 ring-rose-100 text-[10px] font-semibold uppercase">missing</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(r.total_paid)}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold text-emerald-700">{formatINR(r.tds_deducted)}</TableCell>
                  <TableCell className="pr-5 text-xs text-slate-500">
                    {r.last_payment_date ? dayjs(r.last_payment_date).format('DD MMM YYYY') : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      {/* Annexure II — Q4 only — annual */}
      {quarter === 4 && (
        <SectionCard
          tone="sky"
          icon={<FileSpreadsheet size={14} className="text-sky-600" />}
          title="Annexure II · Annual salary breakdown (Q4 only)"
          subtitle="One row per TDS-applicable employee with full FY tax computation. File alongside Q4 24Q."
          action={
            <Button variant="outline" size="sm" onClick={exportAnnIIcsv}>
              <Download size={14} />
              Export Annexure II (CSV)
            </Button>
          }
        >
          <p className="text-sm text-slate-600">
            Pulls from each employee's tax computation snapshot ({fy}) — gross, exemptions, chapter VI-A breakdown, slab tax, surcharge, rebate, cess, total tax, and TDS deducted.
          </p>
        </SectionCard>
      )}

      {/* How-to */}
      <SectionCard tone="slate" title="How to file 24Q with this data" className="mt-5">
        <ol className="space-y-2 text-sm text-slate-700 list-decimal pl-5">
          <li>Log into <strong>TIN-NSDL</strong> and download the latest <strong>RPU (Return Preparation Utility)</strong> + <strong>FVU (File Validation Utility)</strong>.</li>
          <li>Open RPU → New 24Q → enter your school's TAN, AY ({fy.split('-')[0] - 0 + 1}-{((fy.split('-')[0] - 0 + 2) % 100).toString().padStart(2, '0')}), and Quarter ({quarter}).</li>
          <li>In <strong>Challan Details</strong>: paste rows from "Challans Q{quarter}" CSV.</li>
          <li>In <strong>Annexure I (Deductee Details)</strong>: paste rows from the Annexure I CSV.</li>
          {quarter === 4 && (
            <li>For Q4 only: in <strong>Annexure II (Salary Details)</strong>, paste rows from the Annexure II CSV.</li>
          )}
          <li>Run <strong>FVU validator</strong> on the output `.txt` file. Fix any errors flagged.</li>
          <li>Upload the validated file at TIN-NSDL or via your TDS filer (CA / consultant).</li>
        </ol>
      </SectionCard>

      {/* Add challan dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add TDS challan · Q{quarter}</DialogTitle>
            <DialogDescription>Record a TDS deposit made to the government this quarter.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Challan date</Label>
                <Input type="date" value={form.challan_date} onChange={(e) => setForm((f) => ({ ...f, challan_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Total amount (₹)</Label>
                <Input type="number" min={0} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value || 0) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>BSR code (7 digits)</Label>
                <Input maxLength={7} value={form.bsr_code} onChange={(e) => setForm((f) => ({ ...f, bsr_code: e.target.value.replace(/\D/g, '') }))} className="font-mono" placeholder="0001234" />
              </div>
              <div className="space-y-1.5">
                <Label>Challan serial</Label>
                <Input value={form.challan_serial} onChange={(e) => setForm((f) => ({ ...f, challan_serial: e.target.value }))} className="font-mono" placeholder="00012" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Tax</Label>
                <Input type="number" min={0} value={form.total_tax} onChange={(e) => setForm((f) => ({ ...f, total_tax: Number(e.target.value || 0) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Surcharge</Label>
                <Input type="number" min={0} value={form.surcharge} onChange={(e) => setForm((f) => ({ ...f, surcharge: Number(e.target.value || 0) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Cess</Label>
                <Input type="number" min={0} value={form.cess} onChange={(e) => setForm((f) => ({ ...f, cess: Number(e.target.value || 0) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Interest</Label>
                <Input type="number" min={0} value={form.interest} onChange={(e) => setForm((f) => ({ ...f, interest: Number(e.target.value || 0) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Fee (234E)</Label>
                <Input type="number" min={0} value={form.fee} onChange={(e) => setForm((f) => ({ ...f, fee: Number(e.target.value || 0) }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={busy}>Cancel</Button>
            <Button className={BRAND_CTA} onClick={handleAddChallan} disabled={busy}>
              <Plus />
              Add challan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FYSwitcher({ fy, onChange }) {
  const current = taxService.currentFY();
  const start = parseInt(current.split('-')[0], 10);
  const options = [start - 2, start - 1, start, start + 1].map((y) => `${y}-${String((y + 1) % 100).padStart(2, '0')}`);
  return (
    <select
      value={fy}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-input bg-white px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {options.map((y) => <option key={y} value={y}>FY {y}</option>)}
    </select>
  );
}

function currentQuarter(fy) {
  const fyStart = parseInt(fy.split('-')[0], 10);
  const today = dayjs();
  const m = today.month() + 1, y = today.year();
  if (y === fyStart && m >= 4 && m <= 6) return 1;
  if (y === fyStart && m >= 7 && m <= 9) return 2;
  if (y === fyStart && m >= 10 && m <= 12) return 3;
  if (y === fyStart + 1 && m >= 1 && m <= 3) return 4;
  // Default if FY is past
  return 1;
}
