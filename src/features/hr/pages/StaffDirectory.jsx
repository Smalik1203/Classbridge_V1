import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as AntApp } from 'antd';
import {
  Plus, RefreshCw, Search, Mail, Phone, User, Pencil, ChevronRight, Users,
} from 'lucide-react';
import dayjs from 'dayjs';

import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { hrService } from '../services/hrService';
import EmployeeFormModal from '../components/EmployeeFormModal';
import {
  PageHeader, StatusPill, KpiTile, EmptyState, SectionCard,
} from '../components/visuals';
import { BRAND_CTA } from '../components/tokens';
import { cn } from '@/lib/utils';

const STATUS_TONES = {
  active: 'emerald',
  on_notice: 'amber',
  inactive: 'slate',
  terminated: 'rose',
};

const STATUS_LABELS = {
  active: 'Active',
  on_notice: 'On Notice',
  inactive: 'Inactive',
  terminated: 'Terminated',
};

export default function StaffDirectory() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const navigate = useNavigate();
  const { message } = AntApp.useApp();

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    if (!schoolCode) return;
    try {
      setLoading(true);
      const data = await hrService.listEmployees(schoolCode);
      setEmployees(data);
    } catch (e) {
      message.error(e.message || 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [schoolCode]);

  const departments = useMemo(() => {
    const set = new Set(employees.map((e) => e.department).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [employees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (departmentFilter !== 'all' && e.department !== departmentFilter) return false;
      if (q) {
        const blob = `${e.full_name} ${e.employee_code} ${e.designation} ${e.department} ${e.phone ?? ''} ${e.email ?? ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [employees, search, statusFilter, departmentFilter]);

  const counts = useMemo(() => ({
    all: employees.length,
    active: employees.filter((e) => e.status === 'active').length,
    on_notice: employees.filter((e) => e.status === 'on_notice').length,
    inactive: employees.filter((e) => e.status === 'inactive').length,
  }), [employees]);

  const SEGMENTS = [
    { key: 'all', label: 'All', count: counts.all, tone: 'brand' },
    { key: 'active', label: 'Active', count: counts.active, tone: 'emerald' },
    { key: 'on_notice', label: 'On notice', count: counts.on_notice, tone: 'amber' },
    { key: 'inactive', label: 'Inactive', count: counts.inactive, tone: 'slate' },
  ];

  return (
    <div className="px-7 py-6 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="People"
        title="Staff Directory"
        subtitle={loading ? 'Loading…' : `${filtered.length} of ${employees.length} staff shown`}
        actions={
          <>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button className={BRAND_CTA} onClick={() => { setEditing(null); setModalOpen(true); }}>
              <Plus />
              Add Employee
            </Button>
          </>
        }
      />

      {/* Counters strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <KpiTile tone="brand" label="Total" value={counts.all} icon={<Users size={16} />} />
        <KpiTile tone="emerald" label="Active" value={counts.active} icon={<User size={16} />} />
        <KpiTile tone="amber" label="On notice" value={counts.on_notice} icon={<User size={16} />} />
        <KpiTile tone="slate" label="Inactive" value={counts.inactive} icon={<User size={16} />} />
      </div>

      <SectionCard padding="p-0" className="overflow-visible">
        {/* Filter bar */}
        <div className="px-5 py-4 border-b border-slate-100 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[260px] max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search name, code, designation, phone, email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100">
              {SEGMENTS.map((s) => {
                const active = statusFilter === s.key;
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
                      {s.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {departments.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">Department</span>
              {departments.map((d) => (
                <button
                  key={d}
                  onClick={() => setDepartmentFilter(d)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium ring-1 transition-colors',
                    departmentFilter === d
                      ? 'bg-indigo-600 text-white ring-indigo-600 shadow-sm shadow-indigo-500/25'
                      : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300 hover:bg-slate-50',
                  )}
                >
                  {d === 'all' ? 'All departments' : d}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users size={20} />}
            title={employees.length === 0 ? 'No staff yet' : 'No matches'}
            subtitle={employees.length === 0 ? 'Add your first employee to get started' : 'Try a different search or filter'}
            action={employees.length === 0 ? (
              <Button className={BRAND_CTA} onClick={() => { setEditing(null); setModalOpen(true); }}>
                <Plus />
                Add Employee
              </Button>
            ) : null}
          />
        ) : (
          <TooltipProvider delayDuration={200}>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                  <TableHead className="pl-5 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Employee</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Department</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Designation</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Status</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Joined</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Contact</TableHead>
                  <TableHead className="pr-5 text-right text-[11px] uppercase tracking-wider text-slate-500 font-semibold"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-indigo-50/30 group"
                    onClick={() => navigate(`/hr/staff/${r.id}`)}
                  >
                    <TableCell className="pl-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9 ring-2 ring-white shadow-sm">
                          <AvatarImage src={r.photo_url} alt={r.full_name} />
                          <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-blue-500 text-white text-xs">
                            {(r.full_name || '?').split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{r.full_name}</div>
                          <div className="text-xs text-slate-500 font-mono">{r.employee_code}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-700 text-sm">{r.department || '—'}</TableCell>
                    <TableCell className="text-slate-700 text-sm">{r.designation || '—'}</TableCell>
                    <TableCell>
                      <StatusPill tone={STATUS_TONES[r.status] || 'slate'}>
                        {STATUS_LABELS[r.status] || r.status}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {r.join_date ? dayjs(r.join_date).format('DD MMM YYYY') : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {r.phone && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a href={`tel:${r.phone}`} className="grid place-items-center size-7 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 ring-1 ring-emerald-100 transition-colors">
                                <Phone size={13} />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>{r.phone}</TooltipContent>
                          </Tooltip>
                        )}
                        {r.email && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a href={`mailto:${r.email}`} className="grid place-items-center size-7 rounded-md bg-sky-50 text-sky-600 hover:bg-sky-100 ring-1 ring-sky-100 transition-colors">
                                <Mail size={13} />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>{r.email}</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => { setEditing(r); setModalOpen(true); }}
                        >
                          <Pencil size={14} />
                        </Button>
                        <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TooltipProvider>
        )}
      </SectionCard>

      <EmployeeFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        schoolCode={schoolCode}
        employee={editing}
        onSaved={() => load()}
      />
    </div>
  );
}
