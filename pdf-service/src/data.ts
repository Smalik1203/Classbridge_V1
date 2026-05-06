import type { SupabaseClient } from '@supabase/supabase-js';

// ── Shared types ────────────────────────────────────────────────────────────

export interface BrandingShape {
  school_name?: string;
  tagline?: string;
  school_address?: string;
  school_phone?: string;
  logo_url?: string;
  primary_color?: string;
  accent_color?: string;
  // Optional, used by per-school custom templates. Schools without these
  // columns simply render the generic template (the picker falls back).
  affiliation_no?: string;
  watermark_url?: string;
  report_template_key?: string;
}

export interface StudentShape {
  full_name: string;
  student_code: string;
  grade?: number | null;
  section?: string | null;
  // Optional fields used by per-school templates that show a richer profile
  // block (e.g. St. George). When the underlying DB columns don't exist these
  // stay undefined and the template renders a blank line.
  date_of_birth?: string | null;
  father_name?: string | null;
  contact_no?: string | null;
}

export interface TermReportContext {
  group: { name: string; academic_year_label?: string };
  student: StudentShape;
  branding: BrandingShape;
  // school_code: surfaced for the per-school template router (same as Annual).
  school_code: string;
  primary_color: string;
  accent_color: string;
  subjects: Array<{
    subject_name: string;
    pa_marks: number | null;
    pa_max: number;
    term_marks: number | null;
    term_max: number;
    total_marks: number | null;
    total_max: number;
    percentage: number | null;
    grade?: string | null;
  }>;
  pa_max_per_subject: number;
  term_max_per_subject: number;
  total_per_subject: number;
  totals: { obtained: number; max: number; percentage: number | null };
  overall_grade?: string | null;
  result?: 'PASS' | 'FAIL' | null;
  // Optional extras — populated by per-school templates (e.g. St. George
  // shows CCA + working days + height/weight on its term reports too).
  promoted_to_grade?: number | null;
  cca_areas?: string[];
  cca_grades?: Record<string, string>;
  health?: { height_cm: number | null; weight_kg: number | null };
  attendance?: { working_days: number | null; days_present: number | null };
}

export interface AnnualReportContext {
  group: { name: string; academic_year_label?: string };
  student: StudentShape;
  branding: BrandingShape;
  // school_code is surfaced so the template router can pick a per-school
  // template (e.g. 'st-george') without re-querying the DB.
  school_code: string;
  primary_color: string;
  accent_color: string;
  sources: Array<{ id: string; name: string; sequence: number }>;
  subjects: Array<{
    subject_name: string;
    components: Array<{ source_id: string; marks: number | null; max: number }>;
    total_marks: number;
    total_max: number;
    percentage: number | null;
    grade?: string | null;
  }>;
  per_subject_max: number;
  per_term_max: number;
  totals: { obtained: number; max: number; percentage: number | null };
  overall_grade?: string | null;
  result?: 'PASS' | 'FAIL' | null;
  promoted_to_grade?: number | null;
  // CCA areas (per-school, ordered) plus the lookup map of per-student
  // grades for this term report. Empty grade map = template renders
  // blank cells, just like before.
  cca_areas: string[];
  cca_grades: Record<string, string>;
  // Per-student physical snapshot (latest values) and attendance roll-up for
  // the term span. Populated by Phase 1 of the St. George wiring; templates
  // that don't show these blocks safely ignore them.
  health: { height_cm: number | null; weight_kg: number | null };
  attendance: { working_days: number | null; days_present: number | null };
}

// Exam (single assessment) report — used for ad-hoc tests like "Unit Test"
// where the exam group has direct test attachments rather than being a
// term_report aggregator. One mark per subject, no PA/Term split.
export interface ExamReportContext {
  group: { name: string; academic_year_label?: string };
  student: StudentShape;
  branding: BrandingShape;
  school_code: string;
  primary_color: string;
  accent_color: string;
  examination_label: string;
  subjects: Array<{
    subject_name: string;
    marks_obtained: number | null;
    max_marks: number;
    percentage: number | null;
    remarks: string | null;
  }>;
  totals: { obtained: number; max: number; percentage: number | null };
  overall_grade?: string | null;
  result?: 'PASS' | 'FAIL' | null;
}

export const CCA_AREAS = [
  'Physical & Health Education',
  'Art & Cultural Education',
  'Value Education & Life Skills',
  'Sports',
  'Library & Daily News Paper',
  'Discipline',
  'Performing Arts',
  'GK',
  'Art & Craft',
];

// ── Helpers ─────────────────────────────────────────────────────────────────

const fetchAcademicYearLabel = async (supabase: SupabaseClient, ayId: string | null) => {
  if (!ayId) return undefined;
  const { data } = await supabase
    .from('academic_years')
    .select('year_start, year_end, start_date, end_date')
    .eq('id', ayId)
    .maybeSingle();
  if (!data) return undefined;
  if (data.year_start && data.year_end) return `${data.year_start}-${data.year_end}`;
  if (data.start_date && data.end_date) return `${data.start_date.slice(0, 4)}-${data.end_date.slice(0, 4)}`;
  return undefined;
};

const fetchBranding = async (supabase: SupabaseClient, schoolCode: string): Promise<BrandingShape> => {
  const { data } = await supabase
    .from('schools')
    .select('school_name, tagline, school_address, school_phone, logo_url, primary_color, accent_color')
    .eq('school_code', schoolCode)
    .maybeSingle();
  return (data || {}) as BrandingShape;
};

// Format a yyyy-mm-dd ISO date to dd/mm/yyyy for Indian school report cards.
const formatDOB = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

const fetchStudent = async (supabase: SupabaseClient, studentId: string): Promise<StudentShape & { class_instance_id: string }> => {
  const { data, error } = await supabase
    .from('student')
    .select('id, full_name, student_code, date_of_birth, father_name, parent_phone_e164, parent_phone, phone, class_instance_id, class_instances:class_instance_id(grade, section)')
    .eq('id', studentId)
    .single();
  if (error) throw error;
  const cls = (data as any).class_instances || {};
  // Contact No. preference: e164 parent phone → raw parent phone → student's own phone.
  // Templates that don't show contact_no simply ignore it.
  const contact_no = data.parent_phone_e164
    || (data.parent_phone != null ? String(data.parent_phone) : null)
    || (data.phone != null ? String(data.phone) : null);
  return {
    full_name: data.full_name,
    student_code: data.student_code,
    date_of_birth: formatDOB(data.date_of_birth),
    father_name: data.father_name ?? null,
    contact_no,
    grade: cls.grade ?? null,
    section: cls.section ?? null,
    class_instance_id: data.class_instance_id,
  };
};

// Per-school CCA areas + a student's grades for one term report.
// Returns the ordered list of areas the school evaluates plus a grade
// lookup map keyed by area name. Falls back to the hardcoded CCA_AREAS
// list if the school hasn't configured any (so legacy schools keep
// working without seeding the new table).
const fetchCca = async (
  supabase: SupabaseClient,
  args: { schoolCode: string; termReportId: string; studentId: string },
): Promise<{ cca_areas: string[]; cca_grades: Record<string, string> }> => {
  const [areasRes, gradesRes] = await Promise.all([
    supabase
      .from('report_card_cca_areas')
      .select('area, sequence')
      .eq('school_code', args.schoolCode)
      .eq('is_active', true)
      .order('sequence', { ascending: true }),
    supabase
      .from('report_card_cca_grades')
      .select('area, grade')
      .eq('term_report_id', args.termReportId)
      .eq('student_id', args.studentId),
  ]);

  const areasFromDb = (areasRes.data || []).map((r: any) => r.area);
  const cca_areas = areasFromDb.length > 0 ? areasFromDb : CCA_AREAS;

  const cca_grades: Record<string, string> = {};
  for (const r of gradesRes.data || []) {
    if (r.grade) cca_grades[r.area] = r.grade;
  }
  return { cca_areas, cca_grades };
};

// Latest height/weight snapshot for a student. Single row per student in
// student_health (no history table), so we just fetch the row.
const fetchHealth = async (
  supabase: SupabaseClient,
  studentId: string,
): Promise<{ height_cm: number | null; weight_kg: number | null }> => {
  const { data } = await supabase
    .from('student_health')
    .select('height_cm, weight_kg')
    .eq('student_id', studentId)
    .maybeSingle();
  return {
    height_cm: data?.height_cm != null ? Number(data.height_cm) : null,
    weight_kg: data?.weight_kg != null ? Number(data.weight_kg) : null,
  };
};

// Compute working days + days present for a student in a date range.
//   working_days = distinct dates in range with ≥1 attendance record for the
//                  student's CLASS, minus dates falling on a holiday
//   days_present = subset where this student was present for ≥1 period
//
// Attendance is stored per-period (timetable_slot_id), so we collapse to
// distinct dates. Holidays come from school_calendar_events with event_type
// matching 'holiday' case-insensitively. Returns nulls if range is missing.
const fetchAttendanceSummary = async (
  supabase: SupabaseClient,
  args: {
    schoolCode: string;
    classInstanceId: string;
    studentId: string;
    startDate: string | null;
    endDate: string | null;
  },
): Promise<{ working_days: number | null; days_present: number | null }> => {
  if (!args.startDate || !args.endDate) {
    return { working_days: null, days_present: null };
  }

  // Holidays in range, expanded to individual dates.
  const { data: events } = await supabase
    .from('school_calendar_events')
    .select('start_date, end_date, event_type')
    .eq('school_code', args.schoolCode)
    .lte('start_date', args.endDate)
    .gte('end_date', args.startDate);
  const holidays = new Set<string>();
  for (const ev of events || []) {
    if (!ev.event_type || String(ev.event_type).toLowerCase() !== 'holiday') continue;
    const s = new Date(ev.start_date);
    const e = new Date(ev.end_date || ev.start_date);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      holidays.add(d.toISOString().slice(0, 10));
    }
  }

  // Distinct dates in range where the class has any attendance row.
  const { data: classRows } = await supabase
    .from('attendance')
    .select('date')
    .eq('school_code', args.schoolCode)
    .eq('class_instance_id', args.classInstanceId)
    .gte('date', args.startDate)
    .lte('date', args.endDate);
  const classDates = new Set<string>(
    (classRows || []).map((r: any) => String(r.date).slice(0, 10)),
  );
  const workingDates = [...classDates].filter((d) => !holidays.has(d));

  // Days the student was 'present' for ≥1 period.
  const { data: studentRows } = await supabase
    .from('attendance')
    .select('date, status')
    .eq('school_code', args.schoolCode)
    .eq('student_id', args.studentId)
    .gte('date', args.startDate)
    .lte('date', args.endDate);
  const presentDates = new Set<string>();
  for (const r of studentRows || []) {
    if (String(r.status).toLowerCase() === 'present') {
      presentDates.add(String(r.date).slice(0, 10));
    }
  }
  const daysPresent = workingDates.filter((d) => presentDates.has(d)).length;

  return { working_days: workingDates.length, days_present: daysPresent };
};

const lookupGrade = (percentage: number | null, scale: any[] | null): string | null => {
  if (percentage == null || !Array.isArray(scale)) return null;
  const band = scale.find((b: any) => percentage >= Number(b.min) && percentage <= Number(b.max));
  return band ? band.grade : null;
};

// ── Term Report data (mid-term: PA + Term layout) ──────────────────────────
//
// Reads from term_report_subject_totals snapshot. The frontend's ReportCardPreview
// shows the same numbers; we just re-fetch them here for an identical PDF.

export const fetchTermReportData = async ({
  supabase, termReportId, studentId,
}: {
  supabase: SupabaseClient; termReportId: string; studentId: string;
}): Promise<TermReportContext> => {
  // Term report row
  const { data: tr, error: trErr } = await supabase
    .from('exam_groups')
    .select('id, name, academic_year_id, grading_scale_id, school_code, start_date, end_date')
    .eq('id', termReportId)
    .single();
  if (trErr) throw trErr;

  const [ayLabel, branding, student] = await Promise.all([
    fetchAcademicYearLabel(supabase, tr.academic_year_id),
    fetchBranding(supabase, tr.school_code),
    fetchStudent(supabase, studentId),
  ]);

  // Attendance + health + CCA are looked up in parallel — only the St.
  // George template displays them, but we always attach them so any
  // per-school template can opt in without changing the fetcher signature.
  const [health, attendance, cca] = await Promise.all([
    fetchHealth(supabase, studentId),
    fetchAttendanceSummary(supabase, {
      schoolCode: tr.school_code,
      classInstanceId: student.class_instance_id,
      studentId,
      startDate: tr.start_date,
      endDate: tr.end_date,
    }),
    fetchCca(supabase, {
      schoolCode: tr.school_code,
      termReportId,
      studentId,
    }),
  ]);

  // Snapshot rows for this (term, student)
  const { data: snap, error: sErr } = await supabase
    .from('term_report_subject_totals')
    .select('subject_id, best_pa_halved_marks, best_pa_halved_max, term_marks, term_max, total_marks, total_max, percentage, grade, has_any_marks, subjects:subject_id(subject_name)')
    .eq('term_report_id', termReportId)
    .eq('student_id', studentId);
  if (sErr) throw sErr;

  const subjects = (snap || []).map((r: any) => ({
    subject_name: r.subjects?.subject_name || 'Subject',
    pa_marks: r.has_any_marks ? Number(r.best_pa_halved_marks) : null,
    pa_max: Number(r.best_pa_halved_max),
    term_marks: r.has_any_marks ? Number(r.term_marks) : null,
    term_max: Number(r.term_max),
    total_marks: r.has_any_marks ? Number(r.total_marks) : null,
    total_max: Number(r.total_max),
    percentage: r.percentage != null ? Number(r.percentage) : null,
    grade: r.grade,
  })).sort((a, b) => a.subject_name.localeCompare(b.subject_name));

  // Per-subject max in headers (assumes uniform across subjects, like CBSE schools)
  const firstWithPa = subjects.find((s) => s.pa_max > 0);
  const firstWithTerm = subjects.find((s) => s.term_max > 0);
  const pa_max_per_subject = firstWithPa?.pa_max || 0;
  const term_max_per_subject = firstWithTerm?.term_max || 0;
  const total_per_subject = pa_max_per_subject + term_max_per_subject;

  // Grand totals
  const obtained = subjects.reduce((a, s) => a + (s.total_marks || 0), 0);
  const max = subjects.reduce((a, s) => a + s.total_max, 0);
  const percentage = max > 0 ? Number(((obtained / max) * 100).toFixed(2)) : null;

  // Grade scale
  let scale: any[] = [];
  if (tr.grading_scale_id) {
    const { data: gs } = await supabase.from('grading_scales').select('scale').eq('id', tr.grading_scale_id).maybeSingle();
    if (gs) scale = gs.scale;
  }
  if (!scale.length) {
    const { data: gs } = await supabase.from('grading_scales').select('scale').eq('school_code', tr.school_code).eq('is_default', true).maybeSingle();
    if (gs) scale = gs.scale;
  }
  const overall_grade = lookupGrade(percentage, scale);
  const result = percentage == null ? null : (percentage >= 33 ? 'PASS' : 'FAIL');

  return {
    group: { name: tr.name, academic_year_label: ayLabel },
    student,
    branding,
    school_code: tr.school_code,
    primary_color: branding.primary_color || '#6B3FA0',
    accent_color: branding.accent_color || '#F59E0B',
    subjects,
    pa_max_per_subject,
    term_max_per_subject,
    total_per_subject,
    totals: { obtained, max, percentage },
    overall_grade,
    result,
    promoted_to_grade: student.grade != null ? Number(student.grade) + 1 : null,
    cca_areas: cca.cca_areas,
    cca_grades: cca.cca_grades,
    health,
    attendance,
  };
};

// ── Exam Report data (single assessment / Unit Test layout) ────────────────
//
// Reads tests attached to the exam group, then per-student test_marks.
// Mirrors gradebookService.buildReportCardData but server-side via JWT.

export const fetchExamReportData = async ({
  supabase, examGroupId, studentId,
}: {
  supabase: SupabaseClient; examGroupId: string; studentId: string;
}): Promise<ExamReportContext> => {
  // Exam group row — note we accept any kind here (not just term_report)
  const { data: eg, error: egErr } = await supabase
    .from('exam_groups')
    .select('id, name, kind, academic_year_id, grading_scale_id, school_code')
    .eq('id', examGroupId)
    .single();
  if (egErr) throw egErr;

  const [ayLabel, branding, student] = await Promise.all([
    fetchAcademicYearLabel(supabase, eg.academic_year_id),
    fetchBranding(supabase, eg.school_code),
    fetchStudent(supabase, studentId),
  ]);

  // Tests attached to this exam group, scoped to student's class
  const { data: groupTests, error: gtErr } = await supabase
    .from('exam_group_tests')
    .select('test_id, sequence, tests:test_id(id, title, max_marks, class_instance_id, subjects:subject_id(subject_name))')
    .eq('exam_group_id', examGroupId);
  if (gtErr) throw gtErr;

  // Filter to this student's class (multi-class exam groups attach tests for many classes)
  const myTests = (groupTests || []).filter(
    (gt: any) => !gt.tests?.class_instance_id || gt.tests.class_instance_id === student.class_instance_id
  );
  const testIds = myTests.map((gt: any) => gt.test_id);

  let marks: any[] = [];
  if (testIds.length > 0) {
    const { data: m, error: mErr } = await supabase
      .from('test_marks')
      .select('test_id, marks_obtained, max_marks, remarks')
      .eq('student_id', studentId)
      .in('test_id', testIds);
    if (mErr) throw mErr;
    marks = m || [];
  }

  const subjects = myTests.map((gt: any) => {
    const t = gt.tests || {};
    const m = marks.find((x: any) => x.test_id === gt.test_id);
    const obtained = m?.marks_obtained ?? null;
    const max = m?.max_marks ?? t.max_marks ?? 100;
    const pct = obtained != null && max ? Number(((obtained / max) * 100).toFixed(2)) : null;
    return {
      subject_name: t.subjects?.subject_name || t.title || 'Subject',
      marks_obtained: obtained,
      max_marks: Number(max),
      percentage: pct,
      remarks: m?.remarks || null,
    };
  }).sort((a, b) => a.subject_name.localeCompare(b.subject_name));

  const obtained = subjects.reduce((a, s) => a + Number(s.marks_obtained || 0), 0);
  const max = subjects.reduce((a, s) => a + s.max_marks, 0);
  const percentage = max > 0 ? Number(((obtained / max) * 100).toFixed(2)) : null;

  // Grade scale resolution mirrors term/annual fetchers
  let scale: any[] = [];
  if (eg.grading_scale_id) {
    const { data: gs } = await supabase.from('grading_scales').select('scale').eq('id', eg.grading_scale_id).maybeSingle();
    if (gs) scale = gs.scale;
  }
  if (!scale.length) {
    const { data: gs } = await supabase.from('grading_scales').select('scale').eq('school_code', eg.school_code).eq('is_default', true).maybeSingle();
    if (gs) scale = gs.scale;
  }
  const overall_grade = lookupGrade(percentage, scale);
  const result = percentage == null ? null : (percentage >= 33 ? 'PASS' : 'FAIL');

  return {
    group: { name: eg.name, academic_year_label: ayLabel },
    student,
    branding,
    school_code: eg.school_code,
    primary_color: branding.primary_color || '#6B3FA0',
    accent_color: branding.accent_color || '#F59E0B',
    examination_label: eg.name,
    subjects,
    totals: { obtained, max, percentage },
    overall_grade,
    result,
  };
};

// ── Annual Report data (St George layout) ──────────────────────────────────
//
// Calls generate_annual_report RPC which reads from the snapshot table.

export const fetchAnnualReportData = async ({
  supabase, termReportId, studentId,
}: {
  supabase: SupabaseClient; termReportId: string; studentId: string;
}): Promise<AnnualReportContext> => {
  // Annual term_report row + its sources
  const { data: tr, error: trErr } = await supabase
    .from('exam_groups')
    .select('id, name, academic_year_id, grading_scale_id, school_code, source_group_ids, start_date, end_date')
    .eq('id', termReportId)
    .single();
  if (trErr) throw trErr;

  const [ayLabel, branding, student] = await Promise.all([
    fetchAcademicYearLabel(supabase, tr.academic_year_id),
    fetchBranding(supabase, tr.school_code),
    fetchStudent(supabase, studentId),
  ]);

  // Term span used for the attendance roll-up — prefer the source term
  // reports' actual date range (min start → max end), fall back to the
  // annual report's own dates, and finally to the academic year span.
  let termStart: string | null = null;
  let termEnd: string | null = null;
  if (Array.isArray(tr.source_group_ids) && tr.source_group_ids.length > 0) {
    const { data: srcDates } = await supabase
      .from('exam_groups')
      .select('start_date, end_date')
      .in('id', tr.source_group_ids);
    const starts = (srcDates || []).map((s: any) => s.start_date).filter(Boolean).sort();
    const ends = (srcDates || []).map((s: any) => s.end_date).filter(Boolean).sort();
    if (starts.length) termStart = starts[0];
    if (ends.length) termEnd = ends[ends.length - 1];
  }
  if (!termStart) termStart = tr.start_date || null;
  if (!termEnd) termEnd = tr.end_date || null;
  if ((!termStart || !termEnd) && tr.academic_year_id) {
    const { data: ay } = await supabase
      .from('academic_years')
      .select('start_date, end_date')
      .eq('id', tr.academic_year_id)
      .maybeSingle();
    if (ay) {
      termStart = termStart || ay.start_date || null;
      termEnd = termEnd || ay.end_date || null;
    }
  }

  // Now that we have the date range and the student's class, kick off the
  // health + attendance + CCA lookups in parallel — they're independent
  // of the RPC.
  const [health, attendance, cca] = await Promise.all([
    fetchHealth(supabase, studentId),
    fetchAttendanceSummary(supabase, {
      schoolCode: tr.school_code,
      classInstanceId: student.class_instance_id,
      studentId,
      startDate: termStart,
      endDate: termEnd,
    }),
    fetchCca(supabase, {
      schoolCode: tr.school_code,
      termReportId,
      studentId,
    }),
  ]);

  // Single RPC call — already returns halved marks per (subject, source)
  const { data: rows, error: rErr } = await supabase.rpc('generate_annual_report', {
    p_term_report_ids: tr.source_group_ids || [],
    p_class_instance_id: student.class_instance_id,
    p_student_id: studentId,
  });
  if (rErr) throw rErr;

  // Build sources list in picked order
  const sourceMap = new Map<string, { id: string; name: string; sequence: number }>();
  (rows || []).forEach((r: any) => {
    if (!sourceMap.has(r.term_report_id)) {
      sourceMap.set(r.term_report_id, {
        id: r.term_report_id,
        name: r.term_report_name,
        sequence: r.term_report_sequence,
      });
    }
  });
  const sources = Array.from(sourceMap.values()).sort((a, b) => a.sequence - b.sequence);

  // Group by subject; pad missing source cells
  const subjMap = new Map<string, any>();
  (rows || []).forEach((r: any) => {
    if (!r.subject_id) return;
    if (!subjMap.has(r.subject_id)) {
      subjMap.set(r.subject_id, {
        subject_id: r.subject_id,
        subject_name: r.subject_name,
        components_by_source: new Map<string, any>(),
        total_marks: 0,
        total_max: 0,
        any_marks: false,
      });
    }
    const node = subjMap.get(r.subject_id);
    node.components_by_source.set(r.term_report_id, {
      source_id: r.term_report_id,
      marks: r.has_any_marks ? Number(r.halved_marks) : null,
      max: Number(r.halved_max),
    });
    if (r.has_any_marks) {
      node.any_marks = true;
      node.total_marks += Number(r.halved_marks);
    }
    node.total_max += Number(r.halved_max);
  });

  // Per-subject max heads (uniform across subjects assumed)
  const allSubjects = Array.from(subjMap.values());
  const firstSubj = allSubjects[0];
  const per_term_max = firstSubj
    ? Math.max(...sources.map((s) => firstSubj.components_by_source.get(s.id)?.max || 0))
    : 0;
  const per_subject_max = sources.length * per_term_max;

  // Grade scale
  let scale: any[] = [];
  if (tr.grading_scale_id) {
    const { data: gs } = await supabase.from('grading_scales').select('scale').eq('id', tr.grading_scale_id).maybeSingle();
    if (gs) scale = gs.scale;
  }
  if (!scale.length) {
    const { data: gs } = await supabase.from('grading_scales').select('scale').eq('school_code', tr.school_code).eq('is_default', true).maybeSingle();
    if (gs) scale = gs.scale;
  }

  const subjects = allSubjects
    .map((s) => {
      const components = sources.map((src) =>
        s.components_by_source.get(src.id) || { source_id: src.id, marks: null, max: per_term_max }
      );
      const percentage = s.total_max > 0 && s.any_marks
        ? Number(((s.total_marks / s.total_max) * 100).toFixed(2))
        : null;
      const grade = lookupGrade(percentage, scale);
      return {
        subject_name: s.subject_name,
        components,
        total_marks: s.any_marks ? s.total_marks : 0,
        total_max: s.total_max,
        percentage,
        grade,
      };
    })
    .sort((a, b) => a.subject_name.localeCompare(b.subject_name));

  const obtained = subjects.reduce((a, s) => a + (s.total_marks || 0), 0);
  const max = subjects.reduce((a, s) => a + s.total_max, 0);
  const percentage = max > 0 ? Number(((obtained / max) * 100).toFixed(2)) : null;
  const overall_grade = lookupGrade(percentage, scale);
  const result = percentage == null ? null : (percentage >= 33 ? 'PASS' : 'FAIL');
  const promoted_to_grade = student.grade != null ? Number(student.grade) + 1 : null;

  return {
    group: { name: tr.name, academic_year_label: ayLabel },
    student,
    branding,
    school_code: tr.school_code,
    primary_color: branding.primary_color || '#6B3FA0',
    accent_color: branding.accent_color || '#F59E0B',
    sources,
    subjects,
    per_subject_max,
    per_term_max,
    totals: { obtained, max, percentage },
    overall_grade,
    result,
    promoted_to_grade,
    cca_areas: cca.cca_areas,
    cca_grades: cca.cca_grades,
    health,
    attendance,
  };
};
