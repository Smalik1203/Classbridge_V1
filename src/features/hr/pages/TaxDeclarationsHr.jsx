import React, { useEffect, useMemo, useState } from 'react';
import { App as AntApp } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  Search, RefreshCw, Check, X, FileCheck2, Hourglass, BadgeCheck, XCircle, Calculator,
  Eye, ShieldCheck, FileText, Settings2,
} from 'lucide-react';
import dayjs from 'dayjs';

import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
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

const STATUS_TONE = {
  draft: 'slate',
  submitted: 'amber',
  verified: 'emerald',
  rejected: 'rose',
  locked: 'sky',
};

const SEGMENTS = [
  { key: 'all', label: 'All' },
  { key: 'submitted', label: 'Pending', tone: 'amber' },
  { key: 'verified', label: 'Verified', tone: 'emerald' },
  { key: 'rejected', label: 'Rejected', tone: 'rose' },
  { key: 'draft', label: 'Drafts', tone: 'slate' },
];

export default function TaxDeclarationsHr() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const navigate = useNavigate();
  const { message } = AntApp.useApp();

  const [loading, setLoading] = useState(true);
  const [fy, setFy] = useState(taxService.currentFY());
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [viewing, setViewing] = useState(null);
  const [computation, setComputation] = useState(null);
  const [computing, setComputing] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!schoolCode) return;
    try {
      setLoading(true);
      const data = await taxService.listDeclarationsForSchool(schoolCode, fy);
      setItems(data);
    } catch (e) {
      message.error(e.message || 'Failed to load declarations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [schoolCode, fy]);

  const counts = useMemo(() => ({
    all: items.length,
    submitted: items.filter((x) => x.status === 'submitted').length,
    verified: items.filter((x) => x.status === 'verified').length,
    rejected: items.filter((x) => x.status === 'rejected').length,
    draft: items.filter((x) => x.status === 'draft').length,
  }), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((x) => {
      if (statusFilter !== 'all' && x.status !== statusFilter) return false;
      if (q) {
        const blob = `${x.employees?.full_name || ''} ${x.employees?.employee_code || ''} ${x.employees?.department || ''} ${x.employees?.pan_number || ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, statusFilter]);

  const openView = async (item) => {
    setViewing(item);
    setComputation(null);
    setComputing(true);
    try {
      const result = await taxService.computeForEmployee(item.employee_id, fy, 'declared');
      setComputation(result);
    } catch (e) {
      message.error(e.message || 'Failed to compute tax');
    } finally {
      setComputing(false);
    }
  };

  const handleVerify = async () => {
    if (!viewing) return;
    try {
      setBusy(true);
      await taxService.verifyDeclaration(viewing.id, user.id);
      message.success('Declaration verified');
      setViewing(null);
      load();
    } catch (e) {
      message.error(e.message || 'Failed to verify');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!viewing || !rejectReason.trim()) return;
    try {
      setBusy(true);
      await taxService.rejectDeclaration(viewing.id, rejectReason);
      message.success('Declaration rejected');
      setRejectOpen(false);
      setRejectReason('');
      setViewing(null);
      load();
    } catch (e) {
      message.error(e.message || 'Failed to reject');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-7 py-6 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow={`Tax compliance · FY ${fy}`}
        title="Tax Declarations (Form 12BB)"
        subtitle={`${counts.submitted} pending verification · ${counts.verified} verified · ${counts.draft} still drafting`}
        actions={
          <>
            <FYSwitcher fy={fy} onChange={setFy} />
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => navigate('/hr/tax/form-16')}>
              <FileText />
              Form 16
            </Button>
            <Button variant="outline" onClick={() => navigate('/hr/tax/form-24q')}>
              <FileText />
              Form 24Q
            </Button>
            <Button variant="outline" onClick={() => navigate('/hr/tax/form-15gh')}>
              <FileText />
              Form 15G/H
            </Button>
            <Button variant="outline" onClick={() => navigate('/hr/tax/settings')}>
              <Settings2 />
              Settings
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <KpiTile tone="brand" label="Total" value={counts.all} icon={<FileCheck2 size={16} />} />
        <KpiTile tone="amber" label="Pending" value={counts.submitted} icon={<Hourglass size={16} />} />
        <KpiTile tone="emerald" label="Verified" value={counts.verified} icon={<BadgeCheck size={16} />} />
        <KpiTile tone="rose" label="Rejected" value={counts.rejected} icon={<XCircle size={16} />} />
        <KpiTile tone="slate" label="Drafts" value={counts.draft} icon={<Hourglass size={16} />} />
      </div>

      <SectionCard padding="p-0">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search name / code / department / PAN"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100">
            {SEGMENTS.map((s) => {
              const active = statusFilter === s.key;
              const count = counts[s.key];
              return (
                <button
                  key={s.key}
                  onClick={() => setStatusFilter(s.key)}
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
            title={items.length === 0 ? 'No declarations for this FY yet' : 'No matches'}
            subtitle={items.length === 0 ? 'Employees will see them in My HR → Tax Declaration' : 'Try a different filter'}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                <TableHead className="pl-5">Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Regime</TableHead>
                <TableHead>PAN</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="pr-5 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => openView(r)}>
                  <TableCell className="pl-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8 ring-1 ring-slate-200">
                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-blue-500 text-white text-xs">
                          {(r.employees?.full_name || '?').split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold text-slate-900">{r.employees?.full_name}</div>
                        <div className="text-xs text-slate-500 font-mono">{r.employees?.employee_code}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{r.employees?.department}</TableCell>
                  <TableCell>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold uppercase">
                      {r.regime}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.employees?.pan_number || '—'}</TableCell>
                  <TableCell><StatusPill tone={STATUS_TONE[r.status] || 'slate'}>{r.status}</StatusPill></TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {r.submitted_at ? dayjs(r.submitted_at).format('DD MMM YYYY') : '—'}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openView(r); }}>
                      <Eye />
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      {/* Review dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewing?.employees?.full_name} · {viewing?.employees?.employee_code}
            </DialogTitle>
            <DialogDescription>
              {viewing?.employees?.designation} · {viewing?.employees?.department}
              {' · '}
              <span className="font-mono">{viewing?.employees?.pan_number || 'PAN missing'}</span>
              {' · regime '}
              <span className="font-semibold uppercase">{viewing?.regime}</span>
            </DialogDescription>
          </DialogHeader>

          {viewing && (
            <div className="space-y-4">
              {/* Computation result */}
              <SectionCard
                tone="brand"
                icon={<Calculator size={14} className="text-indigo-600" />}
                title="Computed tax"
                subtitle={computing ? 'Computing…' : 'Based on declared values + active salary structure'}
              >
                {computing ? (
                  <Skeleton className="h-20 w-full" />
                ) : computation ? (
                  <ComputationDetails computation={computation} />
                ) : (
                  <div className="text-sm text-slate-500">No computation available.</div>
                )}
              </SectionCard>

              {/* Declaration breakdown */}
              <DeclarationDetails decl={viewing} />
            </div>
          )}

          <DialogFooter className="sticky bottom-0 bg-white border-t border-slate-200 -mx-6 -mb-6 px-6 py-4">
            <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
            {viewing?.status === 'submitted' && (
              <>
                <Button
                  variant="outline"
                  className="text-rose-700 border-rose-200 hover:bg-rose-50"
                  onClick={() => setRejectOpen(true)}
                  disabled={busy}
                >
                  <X />
                  Reject
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                  onClick={handleVerify}
                  disabled={busy}
                >
                  <Check />
                  Verify
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject declaration</DialogTitle>
            <DialogDescription>
              Tell {viewing?.employees?.full_name} what needs to change. They'll be able to edit and resubmit.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Landlord PAN missing — required since rent > ₹1L/year"
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={busy}>Cancel</Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white border-0"
              onClick={handleReject}
              disabled={busy || !rejectReason.trim()}
            >
              <X />
              Reject and notify
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

function ComputationDetails({ computation }) {
  const t = computation?.tax || {};
  const d = computation?.deductions || {};
  const i = computation?.inputs || {};
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiTile tone="brand" label="Annual gross" value={formatINR(i.annual_gross)} />
        <KpiTile tone="sky" label="Taxable" value={formatINR(t.taxable_income)} />
        <KpiTile tone="amber" label="Annual tax" value={formatINR(t.annual_tax)} />
        <KpiTile tone="emerald" label="Monthly TDS" value={formatINR(t.monthly_tds)} />
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-slate-500 hover:text-slate-700 font-medium">Show full breakdown</summary>
        <div className="mt-2 grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-md">
          <KV k="Annual basic" v={formatINR(i.annual_basic)} />
          <KV k="Annual HRA component" v={formatINR(i.annual_hra)} />
          <KV k="Other income" v={formatINR(i.other_income)} />
          <KV k="Prev employer TDS" v={formatINR(i.prev_employer_tds)} />
          <KV k="HRA exemption" v={formatINR(d.hra_exemption)} />
          <KV k="Standard deduction" v={formatINR(d.standard_deduction)} />
          <KV k="Chapter VI-A total" v={formatINR(d.chapter_via_total)} />
          <KV k="Section 24(b)" v={formatINR(d.section_24b)} />
          <KV k="Slab tax" v={formatINR(t.slab_tax)} />
          <KV k="Surcharge" v={formatINR(t.surcharge)} />
          <KV k="87A rebate" v={formatINR(t.rebate_87a)} />
          <KV k="Health & Edu cess" v={formatINR(t.cess)} />
        </div>
      </details>
    </div>
  );
}

function DeclarationDetails({ decl }) {
  const total80c = (Array.isArray(decl.section_80c) ? decl.section_80c : [])
    .reduce((s, x) => s + Number(x.amount || 0), 0);
  return (
    <SectionCard tone="slate" icon={<ShieldCheck size={14} className="text-slate-500" />} title="Declared values">
      <div className="space-y-3 text-sm">
        {decl.regime === 'old' && (
          <>
            <Row label="HRA — monthly rent">
              {formatINR(decl.hra_monthly_rent)} {decl.hra_is_metro && <span className="ml-1 px-1.5 py-px rounded bg-emerald-50 text-emerald-700 text-[10px]">METRO</span>}
            </Row>
            <Row label="HRA — landlord">
              {decl.hra_landlord_name || '—'} {decl.hra_landlord_pan && <span className="font-mono text-xs ml-1">({decl.hra_landlord_pan})</span>}
            </Row>
            {(Array.isArray(decl.section_80c) && decl.section_80c.length > 0) && (
              <Row label="80C breakdown">
                <div className="space-y-1 mt-1">
                  {decl.section_80c.map((x, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span>{x.head}</span>
                      <span className="tabular-nums">{formatINR(x.amount)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-xs font-bold border-t border-slate-200 pt-1">
                    <span>Total 80C declared</span>
                    <span className="tabular-nums">{formatINR(total80c)}</span>
                  </div>
                </div>
              </Row>
            )}
            <Row label="80CCD(1B) NPS extra">{formatINR(decl.section_80ccd_1b)}</Row>
            <Row label="80D self / parents">
              {formatINR(decl.section_80d_self)} {decl.section_80d_self_senior && <span className="text-[10px] ml-1">(senior)</span>}
              {' / '}
              {formatINR(decl.section_80d_parents)} {decl.section_80d_parents_senior && <span className="text-[10px] ml-1">(senior)</span>}
            </Row>
            <Row label="80E education loan">{formatINR(decl.section_80e)}</Row>
            <Row label="80G donations">{formatINR(decl.section_80g)}</Row>
            <Row label="80TTA savings interest">{formatINR(decl.section_80tta)}</Row>
            <Row label="80TTB savings interest (senior)">{formatINR(decl.section_80ttb)}</Row>
            <Row label="24(b) home loan interest">
              {formatINR(decl.section_24b)}
              {decl.section_24b_lender_name && <span className="text-xs text-slate-500 ml-2">via {decl.section_24b_lender_name}</span>}
            </Row>
          </>
        )}
        <Row label="80CCD(2) employer NPS">{formatINR(decl.section_80ccd_2)}</Row>
        <Row label="Other income">{formatINR(decl.other_income)}</Row>
        <Row label="Prev employer gross / TDS">
          {formatINR(decl.prev_employer_gross)} / {formatINR(decl.prev_employer_tds)}
        </Row>
        {decl.notes && (
          <div className="mt-3 px-3 py-2 rounded bg-amber-50 ring-1 ring-amber-100 text-xs text-amber-800 italic">
            "{decl.notes}"
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-3 items-baseline">
      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{label}</div>
      <div className="text-slate-800">{children}</div>
    </div>
  );
}

function KV({ k, v }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{k}</span>
      <span className="font-semibold tabular-nums">{v}</span>
    </div>
  );
}
