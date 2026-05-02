import React, { useEffect, useMemo, useState } from 'react';
import { App as AntApp } from 'antd';
import {
  Save, ShieldCheck, Building2, User, FileCheck2, AlertTriangle, CheckCircle2, RefreshCw,
} from 'lucide-react';

import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/config/supabaseClient';

import {
  PageHeader, KpiTile, SectionCard, AlertBar,
} from '../components/visuals';
import { BRAND_CTA } from '../components/tokens';
import { cn } from '@/lib/utils';

/* ─── Validators (Indian govt formats) ──────────────────────────────────── */
const PAN_RE   = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const TAN_RE   = /^[A-Z]{4}[0-9]{5}[A-Z]{1}$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const isValid = (re) => (v) => !v || re.test(String(v).toUpperCase());

export default function TaxSettings() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const { message } = AntApp.useApp();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [school, setSchool] = useState(null);

  // form state
  const [tan, setTan] = useState('');
  const [pan, setPan] = useState('');
  const [gstin, setGstin] = useState('');
  const [respName, setRespName] = useState('');
  const [respDesignation, setRespDesignation] = useState('');
  const [respPan, setRespPan] = useState('');

  const load = async () => {
    if (!schoolCode) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('schools')
        .select('school_code, school_name, school_address, tan_number, pan_number, gstin, tax_responsible_name, tax_responsible_designation, tax_responsible_pan')
        .eq('school_code', schoolCode)
        .maybeSingle();
      if (error) throw error;
      setSchool(data);
      setTan(data?.tan_number || '');
      setPan(data?.pan_number || '');
      setGstin(data?.gstin || '');
      setRespName(data?.tax_responsible_name || '');
      setRespDesignation(data?.tax_responsible_designation || '');
      setRespPan(data?.tax_responsible_pan || '');
    } catch (e) {
      message.error(e.message || 'Failed to load school settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [schoolCode]);

  const tanValid   = isValid(TAN_RE)(tan);
  const panValid   = isValid(PAN_RE)(pan);
  const gstinValid = isValid(GSTIN_RE)(gstin);
  const respPanValid = isValid(PAN_RE)(respPan);

  const completeness = useMemo(() => {
    const required = [
      { k: 'TAN', v: tan && tanValid },
      { k: 'PAN', v: pan && panValid },
      { k: 'Responsible person', v: !!respName },
      { k: 'Designation', v: !!respDesignation },
    ];
    const done = required.filter((r) => r.v).length;
    return { done, total: required.length, missing: required.filter((r) => !r.v).map((r) => r.k) };
  }, [tan, tanValid, pan, panValid, respName, respDesignation]);

  const allReady = completeness.done === completeness.total;

  const handleSave = async () => {
    if (tan && !tanValid) return message.warning('TAN format is invalid (e.g. BLRA12345B)');
    if (pan && !panValid) return message.warning('PAN format is invalid (e.g. AABCS1234C)');
    if (gstin && !gstinValid) return message.warning('GSTIN format is invalid (15 chars)');
    if (respPan && !respPanValid) return message.warning('Responsible person PAN format is invalid');
    try {
      setSaving(true);
      const { error } = await supabase
        .from('schools')
        .update({
          tan_number: tan ? tan.toUpperCase() : null,
          pan_number: pan ? pan.toUpperCase() : null,
          gstin: gstin ? gstin.toUpperCase() : null,
          tax_responsible_name: respName || null,
          tax_responsible_designation: respDesignation || null,
          tax_responsible_pan: respPan ? respPan.toUpperCase() : null,
        })
        .eq('school_code', schoolCode);
      if (error) throw error;
      message.success('Tax settings saved');
      load();
    } catch (e) {
      message.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="px-7 py-6 max-w-[900px] mx-auto space-y-4">
        <Skeleton className="h-12" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="px-7 py-6 max-w-[900px] mx-auto">
      <PageHeader
        eyebrow="Tax compliance · setup"
        title="Tax Settings"
        subtitle="Configure your school's TDS deductor identifiers. Required for Form 16, Form 24Q, and TDS challans."
        actions={
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        }
      />

      {/* Completeness summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <KpiTile
          tone={allReady ? 'emerald' : 'amber'}
          label="Configuration"
          value={`${completeness.done} / ${completeness.total}`}
          sub={allReady ? 'All set' : `${completeness.total - completeness.done} missing`}
          icon={allReady ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
        />
        <KpiTile tone={tan && tanValid ? 'emerald' : 'rose'} label="TAN" value={tan && tanValid ? 'Set' : '—'} icon={<ShieldCheck size={16} />} />
        <KpiTile tone={pan && panValid ? 'emerald' : 'rose'} label="PAN" value={pan && panValid ? 'Set' : '—'} icon={<FileCheck2 size={16} />} />
        <KpiTile tone={respName ? 'emerald' : 'amber'} label="Responsible person" value={respName ? 'Set' : '—'} icon={<User size={16} />} />
      </div>

      {!allReady && (
        <AlertBar
          tone="amber"
          className="mb-5"
          icon={<AlertTriangle size={18} className="text-amber-600" />}
          title="Form 16 / 24Q cannot be filed without these"
          description={`Missing: ${completeness.missing.join(', ')}. Form 16 will print placeholder text until configured.`}
        />
      )}

      {/* School identity */}
      <SectionCard
        tone="brand"
        icon={<Building2 size={14} className="text-indigo-600" />}
        title="School details"
        subtitle="Read-only — managed in school setup"
        className="mb-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <RO label="School name" value={school?.school_name} />
          <RO label="School code" value={school?.school_code} />
          <div className="md:col-span-2"><RO label="Registered address" value={school?.school_address} /></div>
        </div>
      </SectionCard>

      {/* Deductor identifiers */}
      <SectionCard
        tone="emerald"
        icon={<ShieldCheck size={14} className="text-emerald-600" />}
        title="Deductor identifiers"
        subtitle="Issued by the Income Tax Department. Required on every TDS document."
        className="mb-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="TAN — Tax Deduction Account Number"
            hint="10 chars: 4 letters + 5 digits + 1 letter (e.g. BLRA12345B)"
            error={tan && !tanValid ? 'Invalid TAN format' : null}
          >
            <Input
              value={tan}
              onChange={(e) => setTan(e.target.value.toUpperCase().slice(0, 10))}
              placeholder="BLRA12345B"
              maxLength={10}
              className="font-mono uppercase tracking-wider"
            />
          </Field>
          <Field
            label="PAN — Permanent Account Number (school)"
            hint="10 chars: 5 letters + 4 digits + 1 letter (e.g. AABCS1234C)"
            error={pan && !panValid ? 'Invalid PAN format' : null}
          >
            <Input
              value={pan}
              onChange={(e) => setPan(e.target.value.toUpperCase().slice(0, 10))}
              placeholder="AABCS1234C"
              maxLength={10}
              className="font-mono uppercase tracking-wider"
            />
          </Field>
          <div className="md:col-span-2">
            <Field
              label="GSTIN (optional)"
              hint="15 chars — only required if school is GST-registered"
              error={gstin && !gstinValid ? 'Invalid GSTIN format' : null}
            >
              <Input
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase().slice(0, 15))}
                placeholder="29AABCS1234C1Z5"
                maxLength={15}
                className="font-mono uppercase tracking-wider"
              />
            </Field>
          </div>
        </div>
      </SectionCard>

      {/* Person responsible for TDS */}
      <SectionCard
        tone="sky"
        icon={<User size={14} className="text-sky-600" />}
        title="Person responsible for tax deduction"
        subtitle="Their name and designation print on Form 16 and 24Q. Usually the Principal, Head of Finance, or Director."
        className="mb-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Full name" hint="As recorded with the IT Department">
            <Input
              value={respName}
              onChange={(e) => setRespName(e.target.value)}
              placeholder="e.g. Rajesh Kumar"
            />
          </Field>
          <Field label="Designation" hint="Their role in the school">
            <Input
              value={respDesignation}
              onChange={(e) => setRespDesignation(e.target.value)}
              placeholder="e.g. Principal"
            />
          </Field>
          <div className="md:col-span-2">
            <Field
              label="Their PAN (optional)"
              hint="Used in Form 24Q if different from school PAN"
              error={respPan && !respPanValid ? 'Invalid PAN format' : null}
            >
              <Input
                value={respPan}
                onChange={(e) => setRespPan(e.target.value.toUpperCase().slice(0, 10))}
                placeholder="AABCD1234E"
                maxLength={10}
                className="font-mono uppercase tracking-wider"
              />
            </Field>
          </div>
        </div>
      </SectionCard>

      {/* Sticky save bar */}
      <div className="sticky bottom-4 z-10 mx-auto max-w-3xl">
        <div className="rounded-xl bg-white border border-slate-200 shadow-lg shadow-slate-500/10 px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Configuration status
            </div>
            <div className={cn(
              'text-sm font-bold',
              allReady ? 'text-emerald-700' : 'text-amber-700',
            )}>
              {allReady ? 'All required fields set' : `${completeness.total - completeness.done} required field(s) missing`}
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className={BRAND_CTA}>
            <Save />
            Save settings
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, error, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {error
        ? <div className="text-[11px] text-rose-600 flex items-center gap-1"><AlertTriangle size={11} />{error}</div>
        : hint && <div className="text-[11px] text-slate-400">{hint}</div>}
    </div>
  );
}

function RO({ label, value }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-400">{label}</Label>
      <div className="px-3 py-2 rounded-md bg-slate-50 ring-1 ring-slate-200 text-sm text-slate-700 min-h-[36px] flex items-center">
        {value || <span className="text-slate-400">—</span>}
      </div>
    </div>
  );
}
