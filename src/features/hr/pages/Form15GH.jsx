import React, { useEffect, useMemo, useState } from 'react';
import { App as AntApp } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  Search, RefreshCw, Download, FileCheck2, Hourglass, BadgeCheck, ShieldCheck,
  FileText, CheckCircle2, RotateCcw, Pencil,
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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

import { taxService } from '../services/taxService';
import {
  PageHeader, KpiTile, SectionCard, EmptyState, StatusPill,
} from '../components/visuals';
import { cn } from '@/lib/utils';

const formatINR = (v) =>
  '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const SEGMENTS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending filing', tone: 'amber' },
  { key: 'filed', label: 'Filed with IT', tone: 'emerald' },
  { key: '15G', label: '15G only' },
  { key: '15H', label: '15H only' },
];

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

const ageOnFY = (dob, fy) => {
  if (!dob) return null;
  const fyEnd = dayjs(`${parseInt(fy.split('-')[0], 10) + 1}-03-31`);
  return fyEnd.diff(dayjs(dob), 'year');
};

export default function Form15GH() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const navigate = useNavigate();
  const { message } = AntApp.useApp();

  const [loading, setLoading] = useState(true);
  const [fy, setFy] = useState(taxService.currentFY());
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('pending');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [uinDraft, setUinDraft] = useState('');

  const load = async () => {
    if (!schoolCode) return;
    try {
      setLoading(true);
      const data = await taxService.listForm15GHForSchool(schoolCode, fy);
      setItems(data);
    } catch (e) {
      message.error(e.message || 'Failed to load 15G/H declarations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [schoolCode, fy]);

  const counts = useMemo(() => ({
    all: items.length,
    pending: items.filter((x) => !x.filed_with_it).length,
    filed: items.filter((x) => x.filed_with_it).length,
    '15G': items.filter((x) => x.form_type === '15G').length,
    '15H': items.filter((x) => x.form_type === '15H').length,
  }), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((x) => {
      if (filter === 'pending' && x.filed_with_it) return false;
      if (filter === 'filed' && !x.filed_with_it) return false;
      if (filter === '15G' && x.form_type !== '15G') return false;
      if (filter === '15H' && x.form_type !== '15H') return false;
      if (q) {
        const blob = `${x.employees?.full_name || ''} ${x.employees?.employee_code || ''} ${x.employees?.department || ''} ${x.pan_number || x.employees?.pan_number || ''} ${x.uin || ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, filter]);

  const handleMarkFiled = async (item) => {
    try {
      setBusy(true);
      await taxService.markForm15GHFiled(item.id);
      message.success(`Marked ${item.form_type} for ${item.employees?.full_name} as filed`);
      load();
    } catch (e) {
      message.error(e.message || 'Failed to update');
    } finally {
      setBusy(false);
    }
  };

  const handleUnmarkFiled = async (item) => {
    try {
      setBusy(true);
      await taxService.unmarkForm15GHFiled(item.id);
      message.success('Reverted to pending');
      load();
    } catch (e) {
      message.error(e.message || 'Failed to update');
    } finally {
      setBusy(false);
    }
  };

  const openUinEditor = (item) => {
    setEditing(item);
    setUinDraft(item.uin || '');
  };

  const saveUin = async () => {
    if (!editing) return;
    try {
      setBusy(true);
      await taxService.setForm15GHUin(editing.id, uinDraft.trim());
      message.success('UIN saved');
      setEditing(null);
      setUinDraft('');
      load();
    } catch (e) {
      message.error(e.message || 'Failed to save UIN');
    } finally {
      setBusy(false);
    }
  };

  const exportConsolidated = () => {
    const rows = [[
      'Sl. No.', 'Form Type', 'Employee Code', 'Employee Name', 'Department',
      'PAN', 'Age (yrs)', 'Declared Income (₹)', 'Estimated Total Income (₹)',
      'Declared On', 'UIN', 'Filed with IT',
    ]];
    filtered.forEach((r, i) => {
      rows.push([
        i + 1,
        r.form_type,
        r.employees?.employee_code || '',
        r.employees?.full_name || '',
        r.employees?.department || '',
        r.pan_number || r.employees?.pan_number || '',
        ageOnFY(r.employees?.date_of_birth, fy) ?? '',
        Number(r.declared_income || 0),
        Number(r.estimated_total_income || 0),
        r.declared_at ? dayjs(r.declared_at).format('YYYY-MM-DD') : '',
        r.uin || '',
        r.filed_with_it ? 'Yes' : 'No',
      ]);
    });
    downloadCsv(`Form15GH_${fy}_${dayjs().format('YYYYMMDD')}.csv`, rows);
  };

  return (
    <div className="px-7 py-6 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow={`Tax compliance · FY ${fy}`}
        title="Form 15G / 15H Register"
        subtitle={`${counts.pending} pending filing · ${counts.filed} filed with IT · ${counts['15G']} × 15G + ${counts['15H']} × 15H`}
        actions={
          <>
            <FYSwitcher fy={fy} onChange={setFy} />
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => navigate('/hr/tax')}>
              <FileText />
              12BB
            </Button>
            <Button variant="outline" onClick={() => navigate('/hr/tax/form-16')}>
              <FileText />
              Form 16
            </Button>
            <Button variant="outline" onClick={() => navigate('/hr/tax/form-24q')}>
              <FileText />
              Form 24Q
            </Button>
            <Button onClick={exportConsolidated} disabled={filtered.length === 0}>
              <Download />
              Export CSV
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <KpiTile tone="brand" label="Total declarations" value={counts.all} icon={<FileCheck2 size={16} />} />
        <KpiTile tone="amber" label="Pending filing" value={counts.pending} icon={<Hourglass size={16} />} />
        <KpiTile tone="emerald" label="Filed with IT" value={counts.filed} icon={<BadgeCheck size={16} />} />
        <KpiTile tone="sky" label="Form 15G" value={counts['15G']} icon={<ShieldCheck size={16} />} />
        <KpiTile tone="slate" label="Form 15H" value={counts['15H']} icon={<ShieldCheck size={16} />} />
      </div>

      <SectionCard padding="p-0">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search name / code / department / PAN / UIN"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100">
            {SEGMENTS.map((s) => {
              const active = filter === s.key;
              const count = counts[s.key];
              return (
                <button
                  key={s.key}
                  onClick={() => setFilter(s.key)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                    active
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  {s.label}
                  <span className={cn(
                    'ml-1.5 px-1.5 py-px rounded-full text-[10px] tabular-nums',
                    active ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500',
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {loading && items.length === 0 ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FileCheck2 size={20} />}
            title={items.length === 0 ? 'No 15G/H filed for this FY yet' : 'No matches'}
            subtitle={items.length === 0
              ? 'Employees can file 15G (under 60) or 15H (60+) from My HR → Tax Declaration'
              : 'Try a different filter'}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                <TableHead className="pl-5">Employee</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>PAN</TableHead>
                <TableHead className="text-right">Declared income</TableHead>
                <TableHead className="text-right">Total income</TableHead>
                <TableHead>UIN</TableHead>
                <TableHead>Declared</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const pan = r.pan_number || r.employees?.pan_number || '—';
                const exemptionLimit = r.form_type === '15H' ? 300000 : 250000;
                const overLimit = Number(r.estimated_total_income || 0) > exemptionLimit;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="pl-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8 ring-1 ring-slate-200">
                          <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-blue-500 text-white text-xs">
                            {(r.employees?.full_name || '?').split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-slate-900">{r.employees?.full_name || 'Unknown'}</div>
                          <div className="text-xs text-slate-500 font-mono">{r.employees?.employee_code}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        'px-2 py-0.5 rounded-md text-xs font-bold',
                        r.form_type === '15H'
                          ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-100'
                          : 'bg-sky-50 text-sky-700 ring-1 ring-sky-100',
                      )}>
                        {r.form_type}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{pan}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(r.declared_income)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className={overLimit ? 'text-rose-700 font-semibold' : ''}>
                        {formatINR(r.estimated_total_income)}
                      </span>
                      {overLimit && (
                        <div className="text-[10px] text-rose-600 mt-0.5">over limit</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.uin ? (
                        <span className="font-mono text-xs">{r.uin}</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {r.declared_at ? dayjs(r.declared_at).format('DD MMM YYYY') : '—'}
                    </TableCell>
                    <TableCell>
                      {r.filed_with_it ? (
                        <StatusPill tone="emerald">filed</StatusPill>
                      ) : (
                        <StatusPill tone="amber">pending</StatusPill>
                      )}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openUinEditor(r)} disabled={busy}>
                          <Pencil />
                          UIN
                        </Button>
                        {r.filed_with_it ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnmarkFiled(r)}
                            disabled={busy}
                          >
                            <RotateCcw />
                            Revert
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                            onClick={() => handleMarkFiled(r)}
                            disabled={busy}
                          >
                            <CheckCircle2 />
                            Mark filed
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setUinDraft(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>UIN for {editing?.employees?.full_name}</DialogTitle>
            <DialogDescription>
              The Unique Identification Number is generated by the income tax portal after the
              quarterly 15G/H file is uploaded. Save it here to keep the audit trail complete.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>UIN</Label>
            <Input
              value={uinDraft}
              onChange={(e) => setUinDraft(e.target.value)}
              placeholder="e.g. 123ABCDEF456"
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setUinDraft(''); }} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={saveUin} disabled={busy}>Save UIN</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FYSwitcher({ fy, onChange }) {
  const current = taxService.currentFY();
  const start = parseInt(current.split('-')[0], 10);
  const options = [start - 1, start, start + 1].map((y) => `${y}-${String((y + 1) % 100).padStart(2, '0')}`);
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
