import React, { useEffect, useMemo, useState } from 'react';
import { App as AntApp } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  Search, RefreshCw, FileText, AlertTriangle, Wallet, ShieldCheck,
  BadgeCheck, Calculator, Settings2,
} from 'lucide-react';

import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/config/supabaseClient';

import { taxService } from '../services/taxService';
import HrDocumentViewer from '../components/HrDocumentViewer';
import {
  PageHeader, KpiTile, SectionCard, EmptyState, StatusPill, AlertBar,
} from '../components/visuals';
import { cn } from '@/lib/utils';

const formatINR = (v) =>
  '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function Form16Generation() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const navigate = useNavigate();
  const { message } = AntApp.useApp();

  const [loading, setLoading] = useState(true);
  const [fy, setFy] = useState(taxService.currentFY());
  const [coverage, setCoverage] = useState([]);
  const [search, setSearch] = useState('');
  const [school, setSchool] = useState(null);
  const [viewer, setViewer] = useState({ open: false, employee: null });

  const load = async () => {
    if (!schoolCode) return;
    try {
      setLoading(true);
      const [list, schoolRow] = await Promise.all([
        taxService.listForm16Coverage(schoolCode, fy),
        supabase.from('schools').select('school_code, school_name, tan_number, pan_number, tax_responsible_name, tax_responsible_designation').eq('school_code', schoolCode).maybeSingle().then((r) => r.data),
      ]);
      setCoverage(list);
      setSchool(schoolRow);
    } catch (e) {
      message.error(e.message || 'Failed to load Form 16 data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [schoolCode, fy]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return coverage;
    return coverage.filter((e) => {
      const blob = `${e.full_name} ${e.employee_code} ${e.department} ${e.pan_number || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [coverage, search]);

  const stats = useMemo(() => {
    const tdsApplicable = coverage.filter((e) => e.is_tds_applicable);
    const withComputation = tdsApplicable.filter((e) => !!e.computation);
    const totalTdsPaid = coverage.reduce((s, e) => s + (e.tds_paid_so_far || 0), 0);
    const totalGross = coverage.reduce((s, e) => s + (e.gross_paid_so_far || 0), 0);
    const missingPan = coverage.filter((e) => e.is_tds_applicable && !e.pan_number).length;
    return {
      total: coverage.length,
      tdsApplicable: tdsApplicable.length,
      withComputation: withComputation.length,
      totalTdsPaid,
      totalGross,
      missingPan,
    };
  }, [coverage]);

  const generate = (emp) => setViewer({ open: true, employee: emp });

  const configMissing = !school?.tan_number || !school?.pan_number || !school?.tax_responsible_name;

  return (
    <div className="px-7 py-6 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow={`Form 16 · FY ${fy}`}
        title="Form 16 — Part B Generation"
        subtitle="Annual TDS certificate (Annexure to Form 16). Part A is downloaded from TRACES separately."
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

      {configMissing && (
        <AlertBar
          tone="amber"
          className="mb-5"
          icon={<AlertTriangle size={18} className="text-amber-600" />}
          title="School tax identifiers not configured"
          description={
            <span>
              Form 16 cannot be filed without the school's <strong>TAN</strong>, <strong>PAN</strong>,
              and the name of the person responsible for tax deduction.
              <span className="block text-[11px] mt-1 opacity-80">
                Missing: {[
                  !school?.tan_number && 'TAN',
                  !school?.pan_number && 'PAN',
                  !school?.tax_responsible_name && 'Responsible person',
                ].filter(Boolean).join(', ')}
              </span>
            </span>
          }
          action={
            <Button size="sm" variant="outline" onClick={() => navigate('/hr/tax/settings')}>
              <Settings2 />
              Configure
            </Button>
          }
        />
      )}

      {stats.missingPan > 0 && (
        <AlertBar
          tone="rose"
          className="mb-5"
          icon={<AlertTriangle size={18} className="text-rose-600" />}
          title={`${stats.missingPan} TDS-applicable employee${stats.missingPan > 1 ? 's' : ''} missing PAN`}
          description="Without PAN, TDS gets deducted at the higher of 20% or applicable rate per Section 206AA."
        />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <KpiTile tone="brand" label="Total active staff" value={stats.total} icon={<ShieldCheck size={16} />} />
        <KpiTile tone="amber" label="TDS applicable" value={stats.tdsApplicable} icon={<FileText size={16} />} />
        <KpiTile tone="emerald" label="Computed (ready)" value={stats.withComputation} icon={<BadgeCheck size={16} />} />
        <KpiTile tone="sky" label="Total TDS paid (FYTD)" value={formatINR(stats.totalTdsPaid)} icon={<Wallet size={16} />} />
      </div>

      <SectionCard padding="p-0">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search employee / code / department / PAN"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {loading && coverage.length === 0 ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FileText size={20} />}
            title={coverage.length === 0 ? 'No active staff' : 'No matches'}
            subtitle={coverage.length === 0 ? 'Add employees to start generating Form 16' : null}
          />
        ) : (
          <Table className="table-fixed">
            <colgroup>
              <col />
              <col className="w-[110px]" />
              <col className="w-[80px]" />
              <col className="w-[140px]" />
              <col className="w-[140px]" />
              <col className="w-[120px]" />
              <col className="w-[140px]" />
            </colgroup>
            <TableHeader>
              <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                <TableHead className="pl-5">Employee</TableHead>
                <TableHead>PAN</TableHead>
                <TableHead>TDS</TableHead>
                <TableHead className="text-right">Gross paid (FYTD)</TableHead>
                <TableHead className="text-right">TDS paid (FYTD)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const ready = !!r.computation && r.is_tds_applicable;
                const hasPan = !!r.pan_number;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="pl-5 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="size-8 ring-1 ring-slate-200">
                          <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-blue-500 text-white text-xs">
                            {(r.full_name || '?').split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{r.full_name}</div>
                          <div className="text-xs text-slate-500 truncate">
                            <span className="font-mono">{r.employee_code}</span>
                            <span className="mx-1">·</span>
                            {r.designation}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {hasPan ? (
                        <span className="font-mono text-xs">{r.pan_number}</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 ring-1 ring-rose-100 text-[10px] font-semibold uppercase">
                          missing
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.is_tds_applicable ? (
                        <StatusPill tone="amber">Yes</StatusPill>
                      ) : (
                        <StatusPill tone="slate">No</StatusPill>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatINR(r.gross_paid_so_far)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-bold text-emerald-700">
                      {formatINR(r.tds_paid_so_far)}
                    </TableCell>
                    <TableCell>
                      {!r.is_tds_applicable ? (
                        <StatusPill tone="slate">N/A</StatusPill>
                      ) : ready ? (
                        <StatusPill tone="emerald">Ready</StatusPill>
                      ) : (
                        <StatusPill tone="amber">Run payroll first</StatusPill>
                      )}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <Button
                        size="sm"
                        variant={ready ? 'default' : 'outline'}
                        disabled={!ready}
                        onClick={() => generate(r)}
                        className={ready
                          ? 'bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 text-white border-0'
                          : ''}
                      >
                        <FileText size={13} />
                        Form 16 (B)
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      {/* How-to-Form-16 banner */}
      <SectionCard
        tone="sky"
        icon={<Calculator size={14} className="text-sky-600" />}
        title="How Form 16 works"
        className="mt-5"
      >
        <ol className="space-y-2 text-sm text-slate-700 list-decimal pl-5">
          <li><strong>Part A</strong> is auto-generated by the IT department on TRACES portal after you file Form 24Q quarterly returns. Download it from TRACES, get it digitally signed, and upload here for employees to access.</li>
          <li><strong>Part B</strong> (this tab) is generated by us from your payroll data — gross paid, exemptions, deductions, tax computation, and TDS deducted month-wise.</li>
          <li>Both parts are issued to employees by <strong>15 June</strong> following the FY end (i.e., FY 2025-26 → by 15 Jun 2026).</li>
          <li>Your employees can also see/download Form 16 from <em>My HR → Tax Declaration → Past FYs</em>.</li>
        </ol>
      </SectionCard>

      <HrDocumentViewer
        open={viewer.open}
        onClose={() => setViewer({ open: false, employee: null })}
        title="Form 16 — Part B"
        employeeName={viewer.employee?.full_name}
        loadFn={async () => {
          if (!viewer.employee) return { html_content: '', meta: {} };
          return taxService.generateForm16PartB(viewer.employee.id, fy);
        }}
      />
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
