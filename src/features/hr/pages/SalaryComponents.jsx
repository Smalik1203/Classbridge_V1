import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as AntApp } from 'antd';
import {
  Plus, RefreshCw, Search, Pencil, Wallet, TrendingUp, TrendingDown, Building2,
} from 'lucide-react';

import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

import { hrService } from '../services/hrService';
import SalaryComponentForm from '../components/SalaryComponentForm';
import {
  PageHeader, KpiTile, SectionCard, EmptyState, StatusPill,
} from '../components/visuals';
import { BRAND_CTA } from '../components/tokens';
import { cn } from '@/lib/utils';

const TYPE_TONE = {
  earning: 'emerald',
  deduction: 'rose',
  employer_contribution: 'sky',
};

const TYPE_LABEL = {
  earning: 'Earning',
  deduction: 'Deduction',
  employer_contribution: 'Employer',
};

export default function SalaryComponents() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const navigate = useNavigate();
  const { message } = AntApp.useApp();

  const [loading, setLoading] = useState(true);
  const [components, setComponents] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    if (!schoolCode) return;
    try {
      setLoading(true);
      const data = await hrService.listSalaryComponents(schoolCode);
      setComponents(data);
    } catch (e) {
      message.error(e.message || 'Failed to load components');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [schoolCode]);

  const counts = useMemo(() => ({
    all: components.length,
    earning: components.filter((c) => c.type === 'earning').length,
    deduction: components.filter((c) => c.type === 'deduction').length,
    employer_contribution: components.filter((c) => c.type === 'employer_contribution').length,
  }), [components]);

  const q = search.trim().toLowerCase();
  const filtered = components.filter((c) => {
    if (typeFilter !== 'all' && c.type !== typeFilter) return false;
    if (q && !`${c.name} ${c.formula ?? ''}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const SEGMENTS = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'earning', label: 'Earnings', count: counts.earning },
    { key: 'deduction', label: 'Deductions', count: counts.deduction },
    { key: 'employer_contribution', label: 'Employer', count: counts.employer_contribution },
  ];

  return (
    <div className="px-7 py-6 max-w-[1200px] mx-auto">
      <PageHeader
        eyebrow="Compensation · setup"
        title="Salary Components"
        subtitle="Define earnings, deductions, and employer contributions used in salary structures."
        actions={
          <>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button className={BRAND_CTA} onClick={() => { setEditing(null); setEditorOpen(true); }}>
              <Plus />
              Add component
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <KpiTile tone="brand" label="Total" value={counts.all} icon={<Wallet size={16} />} />
        <KpiTile tone="emerald" label="Earnings" value={counts.earning} icon={<TrendingUp size={16} />} />
        <KpiTile tone="rose" label="Deductions" value={counts.deduction} icon={<TrendingDown size={16} />} />
        <KpiTile tone="sky" label="Employer" value={counts.employer_contribution} icon={<Building2 size={16} />} />
      </div>

      <SectionCard padding="p-0">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by name or formula"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100">
            {SEGMENTS.map((s) => {
              const active = typeFilter === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setTypeFilter(s.key)}
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
                    {s.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {loading && components.length === 0 ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Wallet size={20} />}
            title={components.length === 0 ? 'No components yet' : 'No matches'}
            subtitle={components.length === 0 ? 'Add the first component to get started' : 'Try a different search or filter'}
            action={components.length === 0 ? (
              <Button className={BRAND_CTA} onClick={() => { setEditing(null); setEditorOpen(true); }}>
                <Plus />
                Add component
              </Button>
            ) : null}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                <TableHead className="pl-5">Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Order</TableHead>
                <TableHead>Fixed</TableHead>
                <TableHead>Formula</TableHead>
                <TableHead>Taxable</TableHead>
                <TableHead>PT basis</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="pr-5 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-5 font-medium text-slate-900">{r.name}</TableCell>
                  <TableCell>
                    <StatusPill tone={TYPE_TONE[r.type] || 'slate'}>
                      {TYPE_LABEL[r.type] || r.type}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-slate-600">{r.display_order}</TableCell>
                  <TableCell className="text-sm text-slate-600">{r.is_fixed ? 'Yes' : 'No'}</TableCell>
                  <TableCell className="text-sm">
                    {r.formula ? (
                      <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">{r.formula}</span>
                    ) : <span className="text-slate-300">—</span>}
                  </TableCell>
                  <TableCell>
                    {r.is_taxable ? <StatusPill tone="amber">Tax</StatusPill> : <span className="text-slate-300 text-sm">—</span>}
                  </TableCell>
                  <TableCell>
                    {r.is_pt_basis ? <StatusPill tone="brand">PT</StatusPill> : <span className="text-slate-300 text-sm">—</span>}
                  </TableCell>
                  <TableCell>
                    {r.is_active
                      ? <StatusPill tone="emerald">Active</StatusPill>
                      : <StatusPill tone="slate">Inactive</StatusPill>}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => { setEditing(r); setEditorOpen(true); }}
                    >
                      <Pencil size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <SalaryComponentForm
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        schoolCode={schoolCode}
        component={editing}
        onSaved={load}
      />
    </div>
  );
}
