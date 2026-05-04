import { useEffect, useMemo, useState } from 'react';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { message } from 'antd';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/shared/ui/Badge';
import { Field } from '@/shared/ui/Field';

import {
  listExamGroups,
  createTermReport,
  updateTermReport,
  getTermReportWithSources,
} from '@/features/tests/services/gradebookService';

/**
 * Dialog for creating / editing a Term Report (kind='term_report').
 *
 * A Term Report:
 *   - has its own name + dates + grading scale
 *   - references other assessments via source_group_ids
 *   - applies best-of-N selection to PAs at view-time
 *   - never holds marks of its own
 */
export default function TermReportEditor({
  open,
  onClose,
  schoolCode,
  academicYearId, // optional default
  years = [],
  gradingScales = [],
  editingId = null,
  onSaved, // (savedRow) => void
}) {
  const [form, setForm] = useState({
    name: '',
    academic_year_id: academicYearId || '',
    source_group_ids: [],
    pa_best_of: 2,
    start_date: '',
    end_date: '',
    grading_scale_id: '',
  });
  const [errors, setErrors] = useState({});
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Hydrate (create vs edit) ─────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (editingId) {
      setLoading(true);
      getTermReportWithSources(editingId).then((r) => {
        setLoading(false);
        if (!r.success) { message.error(r.error || 'Failed to load'); return; }
        const tr = r.data;
        setForm({
          name: tr.name || '',
          academic_year_id: tr.academic_year_id || '',
          source_group_ids: Array.isArray(tr.source_group_ids) ? tr.source_group_ids : [],
          pa_best_of: tr.pa_best_of ?? 2,
          start_date: tr.start_date || '',
          end_date: tr.end_date || '',
          grading_scale_id: tr.grading_scale_id || '',
        });
      });
    } else {
      const defaultScale = gradingScales.find((s) => s.is_default);
      setForm({
        name: '',
        academic_year_id: academicYearId || '',
        source_group_ids: [],
        pa_best_of: 2,
        start_date: '',
        end_date: '',
        grading_scale_id: defaultScale?.id || '',
      });
    }
  }, [open, editingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load available source groups for the picked AY ───────────────────────
  // We list both assessments AND term_reports so an Annual Report can pull
  // Term 1 + Term 2. The user clicks one or the other; a term_report row is
  // visually distinct so they don't accidentally mix levels.
  useEffect(() => {
    if (!open || !schoolCode || !form.academic_year_id) {
      setAvailable([]);
      return;
    }
    listExamGroups({
      schoolCode,
      academicYearId: form.academic_year_id,
    }).then((r) => {
      if (!r.success) return;
      // Filter out the report we're editing (a term_report can't reference itself)
      const rows = (r.data || []).filter((g) => g.id !== editingId);
      setAvailable(rows);
    });
  }, [open, schoolCode, form.academic_year_id, editingId]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const pickedSet = useMemo(() => new Set(form.source_group_ids), [form.source_group_ids]);
  const pickedSources = useMemo(
    () => available.filter((g) => pickedSet.has(g.id)),
    [available, pickedSet],
  );
  const paCount = pickedSources.filter((g) => g.is_pa).length;
  const termReportCount = pickedSources.filter((g) => g.kind === 'term_report').length;
  const assessmentCount = pickedSources.length - termReportCount;
  const nonPaCount = pickedSources.filter((g) => g.kind !== 'term_report').length - paCount;
  const isAnnualMode = pickedSources.length > 0 && termReportCount === pickedSources.length;
  const isMixed = termReportCount > 0 && assessmentCount > 0;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const togglePick = (id) => {
    setForm((f) => {
      const has = f.source_group_ids.includes(id);
      return {
        ...f,
        source_group_ids: has
          ? f.source_group_ids.filter((x) => x !== id)
          : [...f.source_group_ids, id],
      };
    });
  };

  const submit = async () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Required';
    if (!form.academic_year_id) errs.academic_year_id = 'Required';
    if (form.source_group_ids.length === 0) errs.source_group_ids = 'Pick at least one source';
    if (isMixed) errs.source_group_ids = 'Mix not allowed: pick either assessments OR term reports, not both';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    // pa_best_of is fixed to 1 in the new "highest PA, halved" model.
    // The column is preserved on exam_groups for future flexibility, but the
    // editor no longer exposes it.
    const payload = {
      school_code: schoolCode,
      academic_year_id: form.academic_year_id,
      name: form.name.trim(),
      source_group_ids: form.source_group_ids,
      pa_best_of: 1,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      grading_scale_id: form.grading_scale_id || null,
    };

    setSaving(true);
    const r = editingId
      ? await updateTermReport(editingId, payload)
      : await createTermReport(payload);
    setSaving(false);

    if (!r.success) { message.error(r.error || 'Failed to save'); return; }
    message.success(editingId ? 'Term Report updated' : 'Term Report created');
    onSaved?.(r.data);
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="p-0 w-[min(96vw,640px)] max-w-[96vw] sm:max-w-[640px]">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-[color:var(--border)]">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={16} className="text-[color:var(--brand)]" />
            {editingId ? 'Edit Term Report' : 'New Term Report'}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pt-4 pb-4 max-h-[75vh] overflow-auto space-y-4">
          {loading ? (
            <div className="text-[12.5px] text-[color:var(--fg-muted)] py-6 text-center">Loading…</div>
          ) : (
            <>
              <Field label="Report Name" required error={errors.name}>
                <Input
                  placeholder="e.g., Term 1 Report Card"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </Field>

              <Field label="Academic Year" required error={errors.academic_year_id}>
                <Select
                  value={form.academic_year_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, academic_year_id: v, source_group_ids: [] }))}
                  disabled={!!editingId}
                >
                  <SelectTrigger><SelectValue placeholder="Pick year" /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y.id} value={y.id}>{y.year_start}-{y.year_end}{y.is_active ? ' (active)' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editingId && (
                  <div className="text-[11px] text-[color:var(--fg-muted)] mt-1">
                    Academic year is fixed once a term report is created.
                  </div>
                )}
              </Field>

              <Field
                label="Source Assessments"
                required
                error={errors.source_group_ids}
              >
                {available.length === 0 ? (
                  <div className="border border-[color:var(--border)] rounded-md p-3 text-[12.5px] text-[color:var(--fg-muted)] bg-[color:var(--bg-elev)]">
                    No assessments found in this academic year. Create some assessments first.
                  </div>
                ) : (
                  <div className="border border-[color:var(--border)] rounded-md max-h-[240px] overflow-auto bg-[color:var(--bg-elev)] divide-y divide-[color:var(--border)]">
                    {available.map((g) => {
                      const checked = pickedSet.has(g.id);
                      const isTr = g.kind === 'term_report';
                      return (
                        <label
                          key={g.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-[color:var(--bg-subtle)] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePick(g.id)}
                            className="rounded border-[color:var(--border)] accent-[color:var(--brand)]"
                          />
                          <span className="flex-1 text-[13px] text-[color:var(--fg)] truncate">
                            {g.name}
                          </span>
                          {isTr && (
                            <Badge variant="accent" className="text-[10px] uppercase tracking-wider">Term Report</Badge>
                          )}
                          {g.is_pa && (
                            <Badge variant="accent" className="text-[10px] uppercase tracking-wider">PA</Badge>
                          )}
                          {!isTr && (
                            <Badge variant="neutral" className="capitalize text-[10.5px]">
                              {g.exam_type?.replace(/_/g, ' ') || '—'}
                            </Badge>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
                <div className="text-[11.5px] text-[color:var(--fg-muted)] mt-1">
                  {pickedSources.length} selected
                  {termReportCount > 0 && ` · ${termReportCount} term report${termReportCount === 1 ? '' : 's'}`}
                  {paCount > 0 && ` · ${paCount} PA`}
                  {nonPaCount > 0 && ` · ${nonPaCount} non-PA`}
                </div>
              </Field>

              {/* Mode-specific explainer */}
              {isAnnualMode && (
                <div className="px-3 py-2.5 rounded-md border border-[color:var(--brand)]/30 bg-[color:var(--brand)]/5 text-[12px] text-[color:var(--fg-subtle)] leading-snug">
                  <div className="font-medium text-[color:var(--fg)] mb-0.5">Annual Term-End Report</div>
                  Each selected term report's per-subject score is{' '}
                  <span className="font-semibold">halved</span> (so a 100 in Term&nbsp;1 → 50). Halved
                  scores from each term are summed for the final marks. Renders the official Term
                  End Report layout (Term&nbsp;I, Term&nbsp;II, Total, Grade).
                </div>
              )}
              {!isAnnualMode && paCount >= 1 && (
                <div className="px-3 py-2.5 rounded-md border border-[color:var(--border)] bg-[color:var(--brand)]/5 text-[12px] text-[color:var(--fg-subtle)] leading-snug">
                  <div className="font-medium text-[color:var(--fg)] mb-0.5">PA scoring</div>
                  Per subject, the <span className="font-semibold">single highest PA</span> mark is kept and{' '}
                  <span className="font-semibold">halved</span> (PA out of 40 → reported out of 20).
                  Other PAs are dropped. Term exams are added in full.
                </div>
              )}
              {isMixed && (
                <div className="px-3 py-2.5 rounded-md border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] text-[12px] text-[color:var(--danger)] leading-snug">
                  <div className="font-medium mb-0.5">Mix not allowed</div>
                  A term report's sources must be either all assessments (PA, Unit Test, Term exam)
                  for a mid-term report — or all term reports for an annual report. Not both.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Start Date">
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  />
                </Field>
                <Field label="End Date">
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  />
                </Field>
              </div>

              <Field label="Grade Profile">
                <Select
                  value={form.grading_scale_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, grading_scale_id: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="School default" /></SelectTrigger>
                  <SelectContent>
                    {gradingScales.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}{s.is_default ? ' (default)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {pickedSources.length > 0 && (
                <div className="px-3 py-2.5 rounded-md bg-[color:var(--bg-subtle)] border border-[color:var(--border)] flex items-start gap-2">
                  <Sparkles size={14} className="text-[color:var(--brand)] mt-0.5 shrink-0" />
                  <div className="text-[12px] text-[color:var(--fg-subtle)] leading-snug">
                    A Term Report has no marks of its own — it shows a live consolidated view of the
                    selected assessments. You can publish a per-student report card from inside it.
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t border-[color:var(--border)]">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving || loading}>
            {saving ? 'Saving…' : (editingId ? 'Save Changes' : 'Create Term Report')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
