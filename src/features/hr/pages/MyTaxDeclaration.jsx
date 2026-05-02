import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as AntApp } from 'antd';
import {
  ArrowLeft, Save, Send, Plus, Trash2, Info, AlertTriangle, CheckCircle2,
  ShieldCheck, Sparkles, Wallet, Home, Heart, BookOpen, PiggyBank, Building2,
  Receipt, FileText, FileCheck2,
} from 'lucide-react';
import dayjs from 'dayjs';

import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

import { hrService } from '../services/hrService';
import { taxService } from '../services/taxService';
import HrDocumentViewer from '../components/HrDocumentViewer';
import {
  PageHeader, KpiTile, SectionCard, EmptyState, StatusPill, AlertBar,
} from '../components/visuals';
import { BRAND_CTA } from '../components/tokens';
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

const COMMON_80C_HEADS = [
  'EPF', 'PPF', 'LIC Premium', 'ELSS Mutual Fund', 'Sukanya Samriddhi',
  'NSC', 'Tax-saving FD', "Children's School Fees (tuition)",
  'Home Loan Principal Repayment', 'Senior Citizen Savings Scheme', 'Other',
];

const debounce = (fn, ms) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

export default function MyTaxDeclaration() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const navigate = useNavigate();
  const { message } = AntApp.useApp();

  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState(null);
  const [fy, setFy] = useState(taxService.currentFY());
  const [decl, setDecl] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [regime, setRegime] = useState('new');
  const [hra, setHra] = useState({ rent: 0, landlord_name: '', landlord_pan: '', is_metro: false, city: '' });
  const [s80c, setS80c] = useState([]); // [{head, amount}]
  const [s80ccd1b, setS80ccd1b] = useState(0);
  const [s80ccd2, setS80ccd2] = useState(0);
  const [s80d, setS80d] = useState({ self: 0, self_senior: false, parents: 0, parents_senior: false });
  const [s80e, setS80e] = useState(0);
  const [s80g, setS80g] = useState(0);
  const [s80tta, setS80tta] = useState(0);
  const [s80ttb, setS80ttb] = useState(0);
  const [s24b, setS24b] = useState({ amount: 0, lender_name: '', lender_pan: '' });
  const [otherIncome, setOtherIncome] = useState(0);
  const [prevEmp, setPrevEmp] = useState({ gross: 0, tds: 0, pf: 0 });
  const [notes, setNotes] = useState('');

  // Preview (computed)
  const [annualGross, setAnnualGross] = useState(0);
  const [annualBasic, setAnnualBasic] = useState(0);
  const [annualHraComp, setAnnualHraComp] = useState(0);
  const [previewOld, setPreviewOld] = useState(null);
  const [previewNew, setPreviewNew] = useState(null);
  const [previewing, setPreviewing] = useState(false);

  // Form 15G/H + Form 16
  const [form15ghList, setForm15ghList] = useState([]);
  const [form15ghOpen, setForm15ghOpen] = useState(false);
  const [form15ghForm, setForm15ghForm] = useState({
    form_type: '15G',
    declared_income: 0,
    estimated_total_income: 0,
  });
  const [form16Open, setForm16Open] = useState(false);

  const isLocked = decl?.status === 'verified' || decl?.status === 'locked';
  const isSenior = useMemo(() => {
    if (!employee?.date_of_birth) return false;
    const fyEnd = dayjs(`${parseInt(fy.split('-')[0], 10) + 1}-03-31`);
    return fyEnd.diff(dayjs(employee.date_of_birth), 'year') >= 60;
  }, [employee?.date_of_birth, fy]);

  // ── load employee + declaration + structure ────────────────────────────
  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const emp = await hrService.getEmployeeByUserId(user.id);
      setEmployee(emp);
      if (!emp) { setLoading(false); return; }

      const [d, structure, list15gh] = await Promise.all([
        taxService.getDeclaration(emp.id, fy),
        hrService.getActiveSalaryStructure(emp.id).catch(() => null),
        taxService.listForm15GH(emp.id, fy).catch(() => []),
      ]);
      setForm15ghList(list15gh);

      // Hydrate form from declaration if it exists
      if (d) {
        setDecl(d);
        setRegime(d.regime);
        setHra({
          rent: Number(d.hra_monthly_rent || 0),
          landlord_name: d.hra_landlord_name || '',
          landlord_pan: d.hra_landlord_pan || '',
          is_metro: !!d.hra_is_metro,
          city: d.hra_city || '',
        });
        const items = Array.isArray(d.section_80c) ? d.section_80c : [];
        setS80c(items.map((x) => ({ head: x.head || 'Other', amount: Number(x.amount || 0) })));
        setS80ccd1b(Number(d.section_80ccd_1b || 0));
        setS80ccd2(Number(d.section_80ccd_2 || 0));
        setS80d({
          self: Number(d.section_80d_self || 0),
          self_senior: !!d.section_80d_self_senior,
          parents: Number(d.section_80d_parents || 0),
          parents_senior: !!d.section_80d_parents_senior,
        });
        setS80e(Number(d.section_80e || 0));
        setS80g(Number(d.section_80g || 0));
        setS80tta(Number(d.section_80tta || 0));
        setS80ttb(Number(d.section_80ttb || 0));
        setS24b({
          amount: Number(d.section_24b || 0),
          lender_name: d.section_24b_lender_name || '',
          lender_pan: d.section_24b_lender_pan || '',
        });
        setOtherIncome(Number(d.other_income || 0));
        setPrevEmp({
          gross: Number(d.prev_employer_gross || 0),
          tds: Number(d.prev_employer_tds || 0),
          pf: Number(d.prev_employer_pf || 0),
        });
        setNotes(d.notes || '');
      } else {
        setDecl(null);
      }

      // Structure → annual gross, basic, hra components
      if (structure) {
        const sumByMatch = (matcher) => structure.lines
          .filter((l) => l.component?.type === 'earning' && matcher(String(l.component?.name || '')))
          .reduce((s, l) => s + Number(l.monthly_amount || 0) * 12, 0);

        setAnnualGross(sumByMatch(() => true));
        setAnnualBasic(sumByMatch((n) => /basic/i.test(n)));
        setAnnualHraComp(sumByMatch((n) => /hra|house rent/i.test(n)));
      } else {
        setAnnualGross(0); setAnnualBasic(0); setAnnualHraComp(0);
      }
    } catch (e) {
      message.error(e.message || 'Failed to load tax declaration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, [user?.id, fy]);

  // ── Build inputs object for live preview ────────────────────────────────
  const buildInputs = () => {
    const total80c = s80c.reduce((s, x) => s + Number(x.amount || 0), 0);
    return {
      annual_gross: Number(annualGross || 0),
      annual_basic: Number(annualBasic || 0),
      annual_hra: Number(annualHraComp || 0),
      hra_monthly_rent: Number(hra.rent || 0),
      hra_is_metro: !!hra.is_metro,
      is_senior: isSenior,
      section_80c: total80c,
      section_80ccd_1b: Number(s80ccd1b || 0),
      section_80ccd_2: Number(s80ccd2 || 0),
      section_80d_self: Number(s80d.self || 0),
      section_80d_self_senior: !!s80d.self_senior,
      section_80d_parents: Number(s80d.parents || 0),
      section_80d_parents_senior: !!s80d.parents_senior,
      section_80e: Number(s80e || 0),
      section_80g: Number(s80g || 0),
      section_80tta: Number(s80tta || 0),
      section_80ttb: Number(s80ttb || 0),
      section_24b: Number(s24b.amount || 0),
      other_income: Number(otherIncome || 0),
      prev_employer_gross: Number(prevEmp.gross || 0),
      prev_employer_tds: Number(prevEmp.tds || 0),
    };
  };

  // ── Live preview (debounced) — both regimes side-by-side ────────────────
  const refreshPreview = useMemo(() => debounce(async (inputs, year) => {
    try {
      setPreviewing(true);
      const [oldR, newR] = await Promise.all([
        taxService.previewFromInputs(inputs, year, 'old'),
        taxService.previewFromInputs(inputs, year, 'new'),
      ]);
      setPreviewOld(oldR);
      setPreviewNew(newR);
    } catch (e) {
      // Don't toast on every keystroke — silent
    } finally {
      setPreviewing(false);
    }
  }, 350), []);

  useEffect(() => {
    if (!annualGross && !decl) return;
    refreshPreview(buildInputs(), fy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annualGross, annualBasic, annualHraComp, hra, s80c, s80ccd1b, s80ccd2, s80d, s80e, s80g, s80tta, s80ttb, s24b, otherIncome, prevEmp, fy]);

  // ── 80C helpers ──────────────────────────────────────────────────────────
  const add80c = () => setS80c((arr) => [...arr, { head: 'Other', amount: 0 }]);
  const update80c = (idx, field, val) => setS80c((arr) => arr.map((x, i) => i === idx ? { ...x, [field]: val } : x));
  const remove80c = (idx) => setS80c((arr) => arr.filter((_, i) => i !== idx));

  // ── Save / Submit ────────────────────────────────────────────────────────
  const buildPayload = () => ({
    employee_id: employee.id,
    school_code: schoolCode,
    financial_year: fy,
    regime,
    status: decl?.status === 'rejected' ? 'draft' : (decl?.status || 'draft'),
    hra_monthly_rent: Number(hra.rent || 0),
    hra_landlord_name: hra.landlord_name || null,
    hra_landlord_pan: (hra.landlord_pan || '').toUpperCase() || null,
    hra_is_metro: !!hra.is_metro,
    hra_city: hra.city || null,
    section_80c: s80c.filter((x) => Number(x.amount) > 0).map((x) => ({ head: x.head, amount: Number(x.amount) })),
    section_80ccd_1b: Number(s80ccd1b || 0),
    section_80ccd_2: Number(s80ccd2 || 0),
    section_80d_self: Number(s80d.self || 0),
    section_80d_self_senior: !!s80d.self_senior,
    section_80d_parents: Number(s80d.parents || 0),
    section_80d_parents_senior: !!s80d.parents_senior,
    section_80e: Number(s80e || 0),
    section_80g: Number(s80g || 0),
    section_80tta: Number(s80tta || 0),
    section_80ttb: Number(s80ttb || 0),
    section_24b: Number(s24b.amount || 0),
    section_24b_lender_name: s24b.lender_name || null,
    section_24b_lender_pan: (s24b.lender_pan || '').toUpperCase() || null,
    other_income: Number(otherIncome || 0),
    prev_employer_gross: Number(prevEmp.gross || 0),
    prev_employer_tds: Number(prevEmp.tds || 0),
    prev_employer_pf: Number(prevEmp.pf || 0),
    notes: notes || null,
  });

  const validateForSubmit = () => {
    if (regime === 'old' && hra.rent * 12 > 100000 && !hra.landlord_pan) {
      return 'Landlord PAN is required when annual rent exceeds ₹1,00,000';
    }
    if (s24b.amount > 0 && !s24b.lender_name) {
      return 'Lender name is required when claiming 24(b) home loan interest';
    }
    return null;
  };

  const handleSaveDraft = async () => {
    if (!employee) return;
    try {
      setSaving(true);
      const saved = await taxService.upsertDeclaration({ ...buildPayload(), id: decl?.id });
      setDecl(saved);
      message.success('Draft saved');
    } catch (e) {
      message.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!employee) return;
    const err = validateForSubmit();
    if (err) { message.warning(err); return; }
    try {
      setSaving(true);
      let saved = decl;
      if (!saved) {
        saved = await taxService.upsertDeclaration({ ...buildPayload() });
      } else {
        saved = await taxService.upsertDeclaration({ ...buildPayload(), id: decl.id });
      }
      const submitted = await taxService.submitDeclaration(saved.id);
      setDecl(submitted);
      message.success('Declaration submitted to HR for verification');
    } catch (e) {
      message.error(e.message || 'Failed to submit');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="px-7 py-6 max-w-[1300px] mx-auto space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-48" />)}
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
          <h2 className="text-lg font-bold text-slate-900">No HR record linked to your account</h2>
          <p className="text-sm text-slate-500 mt-1">Contact your school administrator.</p>
        </SectionCard>
      </div>
    );
  }

  const oldTax = previewOld?.annual_tax ?? 0;
  const newTax = previewNew?.annual_tax ?? 0;
  const cheaperRegime = oldTax < newTax ? 'old' : oldTax > newTax ? 'new' : null;
  const savings = Math.abs(oldTax - newTax);

  // Disable inputs if locked / verified
  const allowEdit = !isLocked;

  // Hide 80c-rich sections if employee has chosen new regime (UX-only; backend
  // still respects regime — we just don't ask for old-regime-only data).
  const showOldSections = regime === 'old';

  return (
    <div className="px-7 py-6 max-w-[1300px] mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate('/hr/my')} className="-ml-2 mb-3 text-slate-600">
        <ArrowLeft />
        My HR
      </Button>

      <PageHeader
        eyebrow={`Income Tax · FY ${fy}`}
        title="Form 12BB — Tax Declaration"
        subtitle="Declare your investments and claims so HR can compute the right monthly TDS."
        actions={
          <>
            <FYSwitcher fy={fy} onChange={setFy} />
            {decl?.status && <StatusPill tone={STATUS_TONE[decl.status]}>{decl.status}</StatusPill>}
          </>
        }
      />

      {decl?.status === 'rejected' && decl?.rejected_reason && (
        <AlertBar
          tone="rose"
          className="mb-5"
          icon={<AlertTriangle size={18} className="text-rose-600" />}
          title="HR rejected your declaration"
          description={decl.rejected_reason}
        />
      )}

      {decl?.status === 'verified' && (
        <AlertBar
          tone="emerald"
          className="mb-5"
          icon={<CheckCircle2 size={18} className="text-emerald-600" />}
          title="Declaration verified"
          description="HR has verified your declaration. Monthly TDS will use these values."
        />
      )}

      {/* Tax preview hero — both regimes side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <RegimeCompareCard
          label="Old regime"
          tone={cheaperRegime === 'old' ? 'emerald' : 'slate'}
          isCheaper={cheaperRegime === 'old'}
          isSelected={regime === 'old'}
          tax={oldTax}
          taxable={previewOld?.taxable_income ?? 0}
          monthly={Math.round(oldTax / 12)}
          onSelect={() => allowEdit && setRegime('old')}
          subtitle="Allows HRA, 80C, 80D, 24(b) etc."
          previewing={previewing}
        />
        <RegimeCompareCard
          label="New regime"
          tone={cheaperRegime === 'new' ? 'emerald' : 'slate'}
          isCheaper={cheaperRegime === 'new'}
          isSelected={regime === 'new'}
          tax={newTax}
          taxable={previewNew?.taxable_income ?? 0}
          monthly={Math.round(newTax / 12)}
          onSelect={() => allowEdit && setRegime('new')}
          subtitle="Lower slabs but no chapter VI-A"
          previewing={previewing}
        />
      </div>

      {savings > 0 && (
        <AlertBar
          tone="brand"
          className="mb-5"
          icon={<Sparkles size={18} className="text-indigo-600" />}
          title={`${cheaperRegime === 'old' ? 'Old' : 'New'} regime saves you ${formatINR(savings)} this year`}
          description="You can change your selection until you submit. Selection becomes final once HR verifies."
        />
      )}

      {/* Annual gross summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <KpiTile tone="brand" label="Annual gross" value={formatINR(annualGross)} icon={<Wallet size={16} />} />
        <KpiTile tone="sky" label="Annual basic" value={formatINR(annualBasic)} icon={<Receipt size={16} />} />
        <KpiTile tone="emerald" label="Annual HRA" value={formatINR(annualHraComp)} icon={<Home size={16} />} />
        <KpiTile
          tone={cheaperRegime === regime ? 'emerald' : 'amber'}
          label={`Monthly TDS (${regime})`}
          value={formatINR(Math.round((regime === 'old' ? oldTax : newTax) / 12))}
          icon={<ShieldCheck size={16} />}
        />
      </div>

      {/* HRA — old regime only */}
      {showOldSections && (
        <SectionCard
          tone="emerald"
          icon={<Home size={14} className="text-emerald-600" />}
          title="HRA exemption (Section 10(13A))"
          subtitle={`Exemption = min(actual HRA received, rent − 10% of basic, ${hra.is_metro ? '50%' : '40%'} of basic)`}
          className="mb-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Monthly rent paid (₹)">
              <NumberInput value={hra.rent} onChange={(v) => setHra((h) => ({ ...h, rent: v }))} disabled={!allowEdit} />
            </Field>
            <Field label="City">
              <Input
                value={hra.city}
                onChange={(e) => setHra((h) => ({ ...h, city: e.target.value }))}
                disabled={!allowEdit}
                placeholder="e.g. Bengaluru"
              />
            </Field>
            <Field label="Landlord name">
              <Input
                value={hra.landlord_name}
                onChange={(e) => setHra((h) => ({ ...h, landlord_name: e.target.value }))}
                disabled={!allowEdit}
              />
            </Field>
            <Field
              label={
                <span>
                  Landlord PAN
                  {hra.rent * 12 > 100000 && <span className="text-rose-600 ml-1 text-xs">required (rent &gt; ₹1L/yr)</span>}
                </span>
              }
            >
              <Input
                value={hra.landlord_pan}
                onChange={(e) => setHra((h) => ({ ...h, landlord_pan: e.target.value.toUpperCase() }))}
                disabled={!allowEdit}
                placeholder="ABCDE1234F"
                className="font-mono uppercase"
              />
            </Field>
            <div className="md:col-span-2 flex items-center gap-2">
              <input
                id="metro"
                type="checkbox"
                checked={hra.is_metro}
                onChange={(e) => setHra((h) => ({ ...h, is_metro: e.target.checked }))}
                disabled={!allowEdit}
                className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <Label htmlFor="metro" className="cursor-pointer">
                Metro city (Mumbai, Delhi, Kolkata, Chennai) — 50% of basic exemption limit
              </Label>
            </div>
          </div>
          {previewOld && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-emerald-50 ring-1 ring-emerald-100 text-sm text-emerald-800">
              <Info size={14} className="inline mr-1.5" />
              HRA exemption (this regime): <span className="font-bold tabular-nums">{formatINR(previewOld.hra_exemption)}</span>
            </div>
          )}
        </SectionCard>
      )}

      {/* 80C / 80CCD(1B) — old only */}
      {showOldSections && (
        <SectionCard
          tone="brand"
          icon={<PiggyBank size={14} className="text-indigo-600" />}
          title="Section 80C + 80CCD(1B)"
          subtitle="80C cap ₹1,50,000 · 80CCD(1B) NPS extra cap ₹50,000"
          className="mb-4"
          action={allowEdit && (
            <Button variant="outline" size="sm" onClick={add80c}>
              <Plus />
              Add item
            </Button>
          )}
        >
          {s80c.length === 0 ? (
            <EmptyState
              icon={<PiggyBank size={20} />}
              title="No 80C investments declared"
              subtitle="Add EPF, PPF, LIC, ELSS, school fees, home loan principal, etc."
              action={allowEdit && <Button onClick={add80c} className={BRAND_CTA}><Plus />Add 80C item</Button>}
            />
          ) : (
            <div className="space-y-2">
              {s80c.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_140px_40px] gap-2 items-end">
                  <Field label={idx === 0 ? 'Investment head' : null}>
                    <select
                      value={item.head}
                      onChange={(e) => update80c(idx, 'head', e.target.value)}
                      disabled={!allowEdit}
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
                    >
                      {COMMON_80C_HEADS.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </Field>
                  <Field label={idx === 0 ? 'Amount (₹)' : null}>
                    <NumberInput value={item.amount} onChange={(v) => update80c(idx, 'amount', v)} disabled={!allowEdit} />
                  </Field>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove80c(idx)}
                    disabled={!allowEdit}
                    className="text-rose-700 hover:bg-rose-50 mb-1"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-sm">
                <span className="text-slate-500">
                  Declared total: <span className="font-bold text-slate-900 tabular-nums">
                    {formatINR(s80c.reduce((s, x) => s + Number(x.amount || 0), 0))}
                  </span>
                </span>
                <span className="text-slate-500">
                  Allowed (cap ₹1,50,000): <span className={cn(
                    'font-bold tabular-nums',
                    s80c.reduce((s, x) => s + Number(x.amount || 0), 0) > 150000
                      ? 'text-amber-700' : 'text-emerald-700',
                  )}>
                    {formatINR(Math.min(s80c.reduce((s, x) => s + Number(x.amount || 0), 0), 150000))}
                  </span>
                </span>
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-100">
            <Field label="80CCD(1B) — NPS additional contribution (cap ₹50,000)">
              <NumberInput value={s80ccd1b} onChange={setS80ccd1b} disabled={!allowEdit} />
            </Field>
          </div>
        </SectionCard>
      )}

      {/* 80D — old only */}
      {showOldSections && (
        <SectionCard
          tone="rose"
          icon={<Heart size={14} className="text-rose-600" />}
          title="Section 80D — Medical insurance premiums"
          subtitle="Self/family ₹25K (₹50K if senior) · Parents ₹25K (₹50K if senior)"
          className="mb-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Field label="Premium for self & family (₹/yr)">
                <NumberInput value={s80d.self} onChange={(v) => setS80d((s) => ({ ...s, self: v }))} disabled={!allowEdit} />
              </Field>
              <CheckboxRow
                checked={s80d.self_senior}
                onChange={(c) => setS80d((s) => ({ ...s, self_senior: c }))}
                disabled={!allowEdit}
                label="I am a senior citizen (≥ 60)"
              />
            </div>
            <div>
              <Field label="Premium for parents (₹/yr)">
                <NumberInput value={s80d.parents} onChange={(v) => setS80d((s) => ({ ...s, parents: v }))} disabled={!allowEdit} />
              </Field>
              <CheckboxRow
                checked={s80d.parents_senior}
                onChange={(c) => setS80d((s) => ({ ...s, parents_senior: c }))}
                disabled={!allowEdit}
                label="My parent(s) are senior citizens (≥ 60)"
              />
            </div>
          </div>
        </SectionCard>
      )}

      {/* 80E / 80G / 80TTA-TTB — old only */}
      {showOldSections && (
        <SectionCard
          tone="amber"
          icon={<BookOpen size={14} className="text-amber-600" />}
          title="Other deductions (80E, 80G, 80TTA/TTB)"
          className="mb-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="80E — Education loan interest (no cap)">
              <NumberInput value={s80e} onChange={setS80e} disabled={!allowEdit} />
            </Field>
            <Field label="80G — Donations (50% / 100% as applicable)">
              <NumberInput value={s80g} onChange={setS80g} disabled={!allowEdit} />
            </Field>
            <Field label={isSenior ? '80TTB — Savings interest (cap ₹50,000)' : '80TTA — Savings interest (cap ₹10,000)'}>
              <NumberInput
                value={isSenior ? s80ttb : s80tta}
                onChange={isSenior ? setS80ttb : setS80tta}
                disabled={!allowEdit}
              />
            </Field>
          </div>
        </SectionCard>
      )}

      {/* 24(b) — old only */}
      {showOldSections && (
        <SectionCard
          tone="sky"
          icon={<Home size={14} className="text-sky-600" />}
          title="Section 24(b) — Home loan interest"
          subtitle="Self-occupied cap ₹2,00,000"
          className="mb-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Annual interest paid (₹)">
              <NumberInput value={s24b.amount} onChange={(v) => setS24b((s) => ({ ...s, amount: v }))} disabled={!allowEdit} />
            </Field>
            <Field label="Lender name">
              <Input
                value={s24b.lender_name}
                onChange={(e) => setS24b((s) => ({ ...s, lender_name: e.target.value }))}
                disabled={!allowEdit}
              />
            </Field>
            <Field label="Lender PAN">
              <Input
                value={s24b.lender_pan}
                onChange={(e) => setS24b((s) => ({ ...s, lender_pan: e.target.value.toUpperCase() }))}
                disabled={!allowEdit}
                className="font-mono uppercase"
              />
            </Field>
          </div>
        </SectionCard>
      )}

      {/* 80CCD(2) + Other income + Prev employer — both regimes */}
      <SectionCard
        tone="brand"
        icon={<Building2 size={14} className="text-indigo-600" />}
        title="Always-applicable items"
        subtitle="80CCD(2) employer NPS, other income, previous employer (mid-year joiner)"
        className="mb-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="80CCD(2) — Employer NPS contribution (annual)">
            <NumberInput value={s80ccd2} onChange={setS80ccd2} disabled={!allowEdit} />
          </Field>
          <Field label="Other income (interest, dividends — annual)">
            <NumberInput value={otherIncome} onChange={setOtherIncome} disabled={!allowEdit} />
          </Field>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="text-sm font-semibold text-slate-700 mb-2">Previous employer (current FY only)</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Gross salary (₹)">
              <NumberInput value={prevEmp.gross} onChange={(v) => setPrevEmp((p) => ({ ...p, gross: v }))} disabled={!allowEdit} />
            </Field>
            <Field label="TDS already deducted (₹)">
              <NumberInput value={prevEmp.tds} onChange={(v) => setPrevEmp((p) => ({ ...p, tds: v }))} disabled={!allowEdit} />
            </Field>
            <Field label="PF contribution (₹)">
              <NumberInput value={prevEmp.pf} onChange={(v) => setPrevEmp((p) => ({ ...p, pf: v }))} disabled={!allowEdit} />
            </Field>
          </div>
        </div>

        <div className="mt-4">
          <Field label="Notes for HR (optional)">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!allowEdit}
              rows={2}
              placeholder="Anything HR should know about this declaration"
            />
          </Field>
        </div>
      </SectionCard>

      {/* Form 16 — view current FY (only if computation exists) */}
      <SectionCard
        tone="emerald"
        icon={<FileText size={14} className="text-emerald-600" />}
        title="Form 16 — Part B"
        subtitle="Your annual TDS certificate (annexure). Available after HR runs payroll and computes your tax."
        className="mb-4"
        action={
          <Button variant="outline" onClick={() => setForm16Open(true)}>
            <FileText />
            View / print
          </Button>
        }
      >
        <p className="text-sm text-slate-600">
          Form 16 Part A (TRACES download) is shared by HR separately. Part B is generated from your payroll data.
        </p>
      </SectionCard>

      {/* Form 15G / 15H */}
      <SectionCard
        tone="sky"
        icon={<FileCheck2 size={14} className="text-sky-600" />}
        title="Form 15G / 15H — Nil TDS declaration"
        subtitle="If your total income for the year is below taxable limit, file 15G (under 60) or 15H (60+) so TDS isn't deducted from your interest income."
        className="mb-4"
        action={
          <Button variant="outline" onClick={() => {
            setForm15ghForm({
              form_type: isSenior ? '15H' : '15G',
              declared_income: 0,
              estimated_total_income: 0,
            });
            setForm15ghOpen(true);
          }}>
            <Plus />
            File new
          </Button>
        }
      >
        {form15ghList.length === 0 ? (
          <div className="text-sm text-slate-500">No 15G/H filed for this FY.</div>
        ) : (
          <div className="space-y-2">
            {form15ghList.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50/80 ring-1 ring-slate-200/60">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 ring-1 ring-sky-100 text-xs font-bold">
                    {f.form_type}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-slate-700">
                      {formatINR(f.declared_income)} declared income
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Filed {dayjs(f.declared_at).format('DD MMM YYYY')}
                      {f.filed_with_it && <span className="ml-2 px-1.5 py-px rounded bg-emerald-50 text-emerald-700 text-[10px]">acknowledged by IT</span>}
                    </div>
                  </div>
                </div>
                {!f.filed_with_it && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-700"
                    onClick={async () => {
                      try {
                        await taxService.deleteForm15GH(f.id);
                        message.success('Withdrawn');
                        loadData();
                      } catch (e) {
                        message.error(e.message);
                      }
                    }}
                  >
                    <Trash2 size={13} />
                    Withdraw
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* 15G/H dialog */}
      <Dialog open={form15ghOpen} onOpenChange={setForm15ghOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>File Form {form15ghForm.form_type}</DialogTitle>
            <DialogDescription>
              Submit to your bank/employer to claim no-TDS on interest income, valid only if your total income is below the taxable limit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Form type</Label>
              <div className="flex gap-2">
                {['15G', '15H'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm15ghForm((f) => ({ ...f, form_type: t }))}
                    className={cn(
                      'px-4 py-2 rounded-md text-sm font-semibold transition-colors flex-1',
                      form15ghForm.form_type === t
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    )}
                  >
                    {t}
                    <div className="text-[10px] font-normal opacity-80 mt-0.5">
                      {t === '15G' ? 'Under 60' : '60 and above'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <Field label="Declared income (₹)">
              <NumberInput
                value={form15ghForm.declared_income}
                onChange={(v) => setForm15ghForm((f) => ({ ...f, declared_income: v }))}
              />
            </Field>
            <Field label="Estimated total income for the FY (₹)">
              <NumberInput
                value={form15ghForm.estimated_total_income}
                onChange={(v) => setForm15ghForm((f) => ({ ...f, estimated_total_income: v }))}
              />
            </Field>
            {form15ghForm.estimated_total_income > 0 && form15ghForm.estimated_total_income > (form15ghForm.form_type === '15G' ? 250000 : 300000) && (
              <AlertBar
                tone="amber"
                icon={<AlertTriangle size={16} className="text-amber-600" />}
                title="Above the basic exemption limit"
                description={`${form15ghForm.form_type} cannot be filed if your total income exceeds the basic exemption limit (${form15ghForm.form_type === '15G' ? '₹2,50,000' : '₹3,00,000 for seniors'}).`}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm15ghOpen(false)}>Cancel</Button>
            <Button
              className={BRAND_CTA}
              onClick={async () => {
                try {
                  if (!employee?.pan_number) return message.error('Your PAN must be on file before filing 15G/H. Contact HR.');
                  await taxService.addForm15GH({
                    employee_id: employee.id,
                    school_code: schoolCode,
                    financial_year: fy,
                    form_type: form15ghForm.form_type,
                    declared_income: form15ghForm.declared_income,
                    estimated_total_income: form15ghForm.estimated_total_income,
                    pan_number: employee.pan_number,
                  });
                  message.success(`Form ${form15ghForm.form_type} filed`);
                  setForm15ghOpen(false);
                  loadData();
                } catch (e) {
                  message.error(e.message || 'Failed to file');
                }
              }}
            >
              <Send />
              File declaration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form 16 viewer */}
      <HrDocumentViewer
        open={form16Open}
        onClose={() => setForm16Open(false)}
        title={`Form 16 — Part B · FY ${fy}`}
        employeeName={employee?.full_name}
        loadFn={async () => {
          if (!employee) return { html_content: '', meta: {} };
          return taxService.generateForm16PartB(employee.id, fy);
        }}
      />

      {/* Sticky action bar */}
      <div className="sticky bottom-4 z-10 mt-6 mx-auto max-w-3xl">
        <div className="rounded-xl bg-white border border-slate-200 shadow-lg shadow-slate-500/10 px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Estimated annual tax ({regime})
            </div>
            <div className="text-xl font-bold tabular-nums text-slate-900">
              {formatINR(regime === 'old' ? oldTax : newTax)}
              {previewing && <span className="ml-2 text-xs font-normal text-slate-400">computing…</span>}
            </div>
          </div>
          <Button variant="outline" onClick={handleSaveDraft} disabled={saving || !allowEdit}>
            <Save />
            Save draft
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !allowEdit} className={BRAND_CTA}>
            <Send />
            {decl?.status === 'submitted' ? 'Resubmit' : 'Submit to HR'}
          </Button>
        </div>
      </div>
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

function RegimeCompareCard({ label, tone, isCheaper, isSelected, tax, taxable, monthly, onSelect, subtitle, previewing }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative rounded-2xl p-5 text-left transition-all overflow-hidden',
        'border-2',
        isSelected
          ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 to-blue-50 shadow-md'
          : 'border-slate-200 bg-white hover:border-slate-300',
      )}
    >
      {isCheaper && (
        <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 text-[11px] font-semibold">
          Cheaper
        </span>
      )}
      <div className="flex items-center gap-2">
        <div className={cn(
          'grid place-items-center size-8 rounded-lg ring-1',
          isSelected ? 'bg-indigo-500 text-white ring-indigo-600' : 'bg-slate-100 text-slate-500 ring-slate-200',
        )}>
          {isSelected ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />}
        </div>
        <div className="font-semibold text-slate-900">{label}</div>
      </div>
      <div className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-slate-900">
        {formatINR(tax)}
        {previewing && <span className="ml-2 text-xs font-normal text-slate-400">…</span>}
      </div>
      <div className="text-xs text-slate-500 mt-1">
        Annual tax · monthly {formatINR(monthly)} · taxable {formatINR(taxable)}
      </div>
      <div className="text-xs text-slate-400 mt-1.5">{subtitle}</div>
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      {label && <Label className="text-xs">{label}</Label>}
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, disabled }) {
  return (
    <Input
      type="number"
      min={0}
      step={1}
      value={value || ''}
      onChange={(e) => onChange(Number(e.target.value || 0))}
      disabled={disabled}
      className="tabular-nums"
    />
  );
}

function CheckboxRow({ checked, onChange, disabled, label }) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
      <span className="text-sm text-slate-600">{label}</span>
    </div>
  );
}
