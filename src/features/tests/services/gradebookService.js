import { supabase } from '@/config/supabaseClient';

const ok = (data, count = null) => ({ success: true, data, error: null, count: count ?? (Array.isArray(data) ? data.length : data ? 1 : 0) });
const fail = (msg) => ({ success: false, data: null, error: msg, count: 0 });

export const listExamGroups = async ({
  schoolCode,
  academicYearId = null,
  classInstanceId = null,
  kind = null, // 'assessment' | 'term_report' | null (both)
} = {}) => {
  if (!schoolCode) return fail('school code required');
  let q = supabase
    .from('exam_groups')
    .select('*, exam_group_classes(class_instance_id)')
    .eq('school_code', schoolCode)
    .order('created_at', { ascending: false });
  if (academicYearId) q = q.eq('academic_year_id', academicYearId);
  if (kind) q = q.eq('kind', kind);
  const { data, error } = await q;
  if (error) return fail(error.message);
  let rows = (data || []).map((g) => ({
    ...g,
    class_instance_ids: (g.exam_group_classes || []).map((x) => x.class_instance_id),
  }));
  if (classInstanceId) {
    rows = rows.filter((g) => g.class_instance_ids.includes(classInstanceId));
  }
  return ok(rows);
};

export const getExamGroupClasses = async (examGroupId) => {
  if (!examGroupId) return fail('examGroupId required');
  const { data, error } = await supabase
    .from('exam_group_classes')
    .select('class_instance_id')
    .eq('exam_group_id', examGroupId);
  if (error) return fail(error.message);
  return ok((data || []).map((r) => r.class_instance_id));
};

export const getExamGroup = async (id) => {
  const { data, error } = await supabase
    .from('exam_groups')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return fail(error.message);
  return ok(data);
};

export const createExamGroup = async (payload) => {
  const required = ['school_code', 'academic_year_id', 'name'];
  for (const k of required) if (!payload?.[k]) return fail(`Missing field: ${k}`);
  const classIds = Array.isArray(payload.class_instance_ids) && payload.class_instance_ids.length > 0
    ? payload.class_instance_ids
    : (payload.class_instance_id ? [payload.class_instance_id] : []);
  if (classIds.length === 0) return fail('At least one class is required');

  const row = {
    school_code: payload.school_code,
    academic_year_id: payload.academic_year_id,
    class_instance_id: classIds[0], // legacy "primary" class
    name: payload.name,
    exam_type: payload.exam_type || 'custom',
    weightage: payload.weightage ?? null,
    start_date: payload.start_date || null,
    end_date: payload.end_date || null,
    status: payload.status || 'planned',
    is_pa: !!payload.is_pa,
    kind: payload.kind || 'assessment',
    source_group_ids: payload.source_group_ids ?? null,
    pa_best_of: payload.pa_best_of ?? 2,
    created_by: payload.created_by || null,
  };
  if (payload.grading_scale_id) row.grading_scale_id = payload.grading_scale_id;

  const { data, error } = await supabase
    .from('exam_groups')
    .insert(row)
    .select()
    .single();
  if (error) return fail(error.message);

  const junctionRows = classIds.map((cid) => ({
    exam_group_id: data.id, class_instance_id: cid,
  }));
  const { error: jErr } = await supabase
    .from('exam_group_classes')
    .insert(junctionRows);
  if (jErr) {
    await supabase.from('exam_groups').delete().eq('id', data.id);
    return fail(jErr.message);
  }
  return ok({ ...data, class_instance_ids: classIds });
};

export const updateExamGroup = async (id, patch) => {
  if (!id) return fail('id required');

  // class_instance_ids is a junction-table relationship, not a column on
  // exam_groups. Pull it out and reconcile separately. Also strip school_code
  // and kind since they're immutable on update.
  const { class_instance_ids, school_code, kind, ...colPatch } = patch || {};

  // Pick the legacy "primary" class from the new selection, if provided.
  const classIds = Array.isArray(class_instance_ids) ? class_instance_ids : null;
  if (classIds) {
    if (classIds.length === 0) return fail('At least one class is required');
    colPatch.class_instance_id = classIds[0];
  }

  const { data, error } = await supabase
    .from('exam_groups')
    .update(colPatch)
    .eq('id', id)
    .select()
    .single();
  if (error) return fail(error.message);

  // Reconcile junction rows if classes changed: replace the set wholesale.
  if (classIds) {
    const { data: existing, error: lErr } = await supabase
      .from('exam_group_classes')
      .select('class_instance_id')
      .eq('exam_group_id', id);
    if (lErr) return fail(lErr.message);

    const have = new Set((existing || []).map((r) => r.class_instance_id));
    const want = new Set(classIds);
    const toAdd = classIds.filter((cid) => !have.has(cid));
    const toRemove = [...have].filter((cid) => !want.has(cid));

    if (toAdd.length > 0) {
      const rows = toAdd.map((cid) => ({ exam_group_id: id, class_instance_id: cid }));
      const { error: aErr } = await supabase
        .from('exam_group_classes')
        .upsert(rows, { onConflict: 'exam_group_id,class_instance_id', ignoreDuplicates: true });
      if (aErr) return fail(aErr.message);
    }
    if (toRemove.length > 0) {
      const { error: rErr } = await supabase
        .from('exam_group_classes')
        .delete()
        .eq('exam_group_id', id)
        .in('class_instance_id', toRemove);
      if (rErr) return fail(rErr.message);
    }
  }

  return ok({ ...data, class_instance_ids: classIds || undefined });
};

export const deleteExamGroup = async (id) => {
  const { error } = await supabase.from('exam_groups').delete().eq('id', id);
  if (error) return fail(error.message);
  return ok(true);
};

export const getGroupTests = async (examGroupId, classInstanceId = null) => {
  const { data, error } = await supabase
    .from('exam_group_tests')
    .select(`
      id,
      sequence,
      test_id,
      tests:test_id ( id, title, max_marks, test_date, subject_id, class_instance_id, test_mode, subjects:subject_id ( id, subject_name ) )
    `)
    .eq('exam_group_id', examGroupId)
    .order('sequence', { ascending: true });
  if (error) return fail(error.message);
  let rows = data || [];
  if (classInstanceId) {
    rows = rows.filter((r) => r.tests?.class_instance_id === classInstanceId);
  }
  return ok(rows);
};

export const attachTestsToGroup = async (examGroupId, testIds = []) => {
  if (!examGroupId) return fail('examGroupId required');
  if (!Array.isArray(testIds) || testIds.length === 0) return fail('No tests provided');
  const rows = testIds.map((test_id, idx) => ({ exam_group_id: examGroupId, test_id, sequence: idx }));
  const { data, error } = await supabase
    .from('exam_group_tests')
    .upsert(rows, { onConflict: 'exam_group_id,test_id', ignoreDuplicates: true })
    .select();
  if (error) return fail(error.message);
  return ok(data || []);
};

export const removeTestFromGroup = async (linkId) => {
  const { error } = await supabase.from('exam_group_tests').delete().eq('id', linkId);
  if (error) return fail(error.message);
  return ok(true);
};

export const getAvailableTestsForClass = async ({ schoolCode, classInstanceId }) => {
  if (!schoolCode || !classInstanceId) return fail('schoolCode + classInstanceId required');
  const { data, error } = await supabase
    .from('tests')
    .select('id, title, max_marks, test_date, test_mode, subject_id, subjects:subject_id ( id, subject_name )')
    .eq('school_code', schoolCode)
    .eq('class_instance_id', classInstanceId)
    .eq('test_mode', 'offline')
    .order('test_date', { ascending: false });
  if (error) return fail(error.message);
  return ok(data || []);
};

export const getDefaultGradingScale = async (schoolCode) => {
  if (!schoolCode) return fail('schoolCode required');
  const { data, error } = await supabase
    .from('grading_scales')
    .select('*')
    .eq('school_code', schoolCode)
    .eq('is_default', true)
    .maybeSingle();
  if (error) return fail(error.message);
  return ok(data);
};

export const listGradingScales = async (schoolCode) => {
  const { data, error } = await supabase
    .from('grading_scales')
    .select('*')
    .eq('school_code', schoolCode)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) return fail(error.message);
  return ok(data || []);
};

export const upsertGradingScale = async (payload) => {
  if (!payload?.school_code || !payload?.name || !payload?.scale) return fail('school_code, name, scale required');

  if (payload.is_default) {
    const clearQ = supabase
      .from('grading_scales')
      .update({ is_default: false })
      .eq('school_code', payload.school_code)
      .eq('is_default', true);
    if (payload.id) clearQ.neq('id', payload.id);
    await clearQ;
  }

  const row = {
    id: payload.id,
    school_code: payload.school_code,
    name: payload.name,
    scale: payload.scale,
    is_default: !!payload.is_default,
  };
  const { data, error } = await supabase
    .from('grading_scales')
    .upsert(row)
    .select()
    .single();
  if (error) return fail(error.message);
  return ok(data);
};

export const deleteGradingScale = async (id) => {
  if (!id) return fail('id required');
  const { error } = await supabase.from('grading_scales').delete().eq('id', id);
  if (error) return fail(error.message);
  return ok(true);
};

export const getGradingScale = async (id) => {
  if (!id) return ok(null);
  const { data, error } = await supabase
    .from('grading_scales')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return fail(error.message);
  return ok(data);
};

export const gradeFor = (percentage, scale) => {
  if (percentage == null || !Array.isArray(scale)) return null;
  const band = scale.find((b) => percentage >= Number(b.min) && percentage <= Number(b.max));
  return band ? { grade: band.grade, gpa: band.gpa, description: band.description } : null;
};

export const getSchoolBranding = async (schoolCode) => {
  if (!schoolCode) return fail('schoolCode required');
  const { data, error } = await supabase
    .from('schools')
    .select('school_name, app_name, school_address, school_phone, school_email, logo_url, primary_color, secondary_color, accent_color, tagline, website_url')
    .eq('school_code', schoolCode)
    .maybeSingle();
  if (error) return fail(error.message);
  return ok(data);
};

export const buildReportCardData = async ({ examGroupId, studentId, schoolCode }) => {
  if (!examGroupId || !studentId) return fail('examGroupId + studentId required');

  const groupRes = await getExamGroup(examGroupId);
  if (!groupRes.success) return groupRes;
  const group = groupRes.data;

  // Resolve a friendly academic year label from the exam group's AY id.
  if (group?.academic_year_id) {
    const { data: ay } = await supabase
      .from('academic_years')
      .select('year_start, year_end, start_date, end_date')
      .eq('id', group.academic_year_id)
      .maybeSingle();
    if (ay) {
      if (ay.year_start && ay.year_end) {
        group.academic_year_label = `${ay.year_start}-${ay.year_end}`;
      } else if (ay.start_date && ay.end_date) {
        group.academic_year_label = `${ay.start_date.slice(0, 4)}-${ay.end_date.slice(0, 4)}`;
      }
    }
  }

  const { data: student, error: stErr } = await supabase
    .from('student')
    .select('id, full_name, student_code, class_instance_id, class_instances:class_instance_id(grade, section)')
    .eq('id', studentId)
    .single();
  if (stErr) return fail(stErr.message);

  // For multi-class exam groups, filter tests to this student's class.
  const testsRes = await getGroupTests(examGroupId, student.class_instance_id);
  if (!testsRes.success) return testsRes;
  const groupTests = testsRes.data;
  const testIds = groupTests.map((g) => g.test_id);

  let marks = [];
  if (testIds.length > 0) {
    const { data: m, error: mErr } = await supabase
      .from('test_marks')
      .select('test_id, marks_obtained, max_marks, remarks')
      .eq('student_id', studentId)
      .in('test_id', testIds);
    if (mErr) return fail(mErr.message);
    marks = m || [];
  }

  const subjects = groupTests.map((gt) => {
    const t = gt.tests || {};
    const m = marks.find((x) => x.test_id === gt.test_id);
    const obtained = m?.marks_obtained ?? null;
    const max = m?.max_marks ?? t.max_marks ?? 100;
    const pct = obtained != null && max ? Number(((obtained / max) * 100).toFixed(2)) : null;
    return {
      test_id: gt.test_id,
      sequence: gt.sequence,
      subject_name: t.subjects?.subject_name || t.title || 'Subject',
      title: t.title,
      test_date: t.test_date,
      marks_obtained: obtained,
      max_marks: max,
      percentage: pct,
      remarks: m?.remarks || null,
    };
  });

  const totalMax = subjects.reduce((s, x) => s + Number(x.max_marks || 0), 0);
  const totalObtained = subjects.reduce((s, x) => s + Number(x.marks_obtained || 0), 0);
  const percentage = totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : null;

  let scaleRow = null;
  if (group.grading_scale_id) {
    const r = await getGradingScale(group.grading_scale_id);
    if (r.success) scaleRow = r.data;
  }
  if (!scaleRow) {
    const r = await getDefaultGradingScale(schoolCode || group.school_code);
    if (r.success) scaleRow = r.data;
  }
  const scale = scaleRow?.scale || [];
  const overall = gradeFor(percentage, scale);

  const brandingRes = await getSchoolBranding(schoolCode || group.school_code);
  const branding = brandingRes.success ? brandingRes.data : null;

  return ok({
    group,
    student,
    subjects,
    totals: { obtained: totalObtained, max: totalMax, percentage },
    overall_grade: overall?.grade || null,
    overall_gpa: overall?.gpa || null,
    grading_scale: scale,
    branding,
  });
};

export const listSchoolSubjects = async (schoolCode) => {
  const { data, error } = await supabase
    .from('subjects')
    .select('id, subject_name')
    .eq('school_code', schoolCode)
    .order('subject_name');
  if (error) return fail(error.message);
  return ok(data || []);
};

export const createSubjectTestForGroup = async ({ examGroup, subjectId, title, maxMarks, testDate, createdBy }) => {
  if (!examGroup?.id || !subjectId) return fail('examGroup + subjectId required');

  const classIds = Array.isArray(examGroup.class_instance_ids) && examGroup.class_instance_ids.length > 0
    ? examGroup.class_instance_ids
    : (examGroup.class_instance_id ? [examGroup.class_instance_id] : []);
  if (classIds.length === 0) return fail('Exam group has no classes');

  // One test row per class — marks belong to students within a class.
  const testRows = classIds.map((cid) => ({
    title: title || 'Subject Test',
    class_instance_id: cid,
    subject_id: subjectId,
    school_code: examGroup.school_code,
    test_type: 'manual',
    test_mode: 'offline',
    test_date: testDate || examGroup.start_date || null,
    max_marks: maxMarks || 100,
    status: 'active',
    created_by: createdBy || null,
  }));

  const { data: tests, error } = await supabase
    .from('tests')
    .insert(testRows)
    .select();
  if (error) return fail(error.message);

  const linkRes = await attachTestsToGroup(examGroup.id, tests.map((t) => t.id));
  if (!linkRes.success) return linkRes;
  return ok(tests);
};

export const bulkSaveMarks = async (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return ok([]);
  const prepared = rows.map((r) => ({
    test_id: r.test_id,
    student_id: r.student_id,
    marks_obtained: r.marks_obtained,
    max_marks: r.max_marks,
    remarks: r.remarks ?? null,
    updated_at: new Date().toISOString(),
  }));
  const { data, error } = await supabase
    .from('test_marks')
    .upsert(prepared, { onConflict: 'test_id,student_id', ignoreDuplicates: false })
    .select();
  if (error) return fail(error.message);
  return ok(data || []);
};

export const getMarksForTests = async ({ testIds, studentIds }) => {
  if (!Array.isArray(testIds) || testIds.length === 0) return ok([]);
  let q = supabase.from('test_marks').select('test_id, student_id, marks_obtained, max_marks, remarks').in('test_id', testIds);
  if (Array.isArray(studentIds) && studentIds.length > 0) q = q.in('student_id', studentIds);
  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok(data || []);
};

export const deleteSubjectTest = async (testId) => {
  const { error } = await supabase.from('tests').delete().eq('id', testId);
  if (error) return fail(error.message);
  return ok(true);
};

export const getStudentsForClass = async (classInstanceId) => {
  const { data, error } = await supabase
    .from('student')
    .select('id, full_name, student_code')
    .eq('class_instance_id', classInstanceId)
    .order('student_code');
  if (error) return fail(error.message);
  return ok(data || []);
};

export const publishReportCard = async ({ examGroupId, studentId, schoolCode, issuedBy = null, classTeacherRemarks = null, principalRemarks = null }) => {
  const built = await buildReportCardData({ examGroupId, studentId, schoolCode });
  if (!built.success) return built;
  const d = built.data;

  const row = {
    school_code: schoolCode || d.group.school_code,
    exam_group_id: examGroupId,
    student_id: studentId,
    class_instance_id: d.student.class_instance_id || d.group.class_instance_id,
    total_obtained: d.totals.obtained,
    total_max: d.totals.max,
    percentage: d.totals.percentage,
    overall_grade: d.overall_grade,
    class_teacher_remarks: classTeacherRemarks,
    principal_remarks: principalRemarks,
    snapshot: d,
    status: 'published',
    issued_at: new Date().toISOString(),
    issued_by: issuedBy,
  };

  const { data, error } = await supabase
    .from('report_cards')
    .upsert(row, { onConflict: 'exam_group_id,student_id' })
    .select()
    .single();
  if (error) return fail(error.message);
  return ok(data);
};

export const getPublishedReportCard = async ({ examGroupId, studentId }) => {
  const { data, error } = await supabase
    .from('report_cards')
    .select('*')
    .eq('exam_group_id', examGroupId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) return fail(error.message);
  return ok(data);
};

// ── Term Report publish snapshots ───────────────────────────────────────────

// Snapshot a Term Report's per-(student, subject) totals into
// term_report_subject_totals. Idempotent — calls the publish_term_report RPC
// which uses ON CONFLICT to refresh existing rows. Marks the term_report row
// as published_at = now() for status display.
//
// Returns { rowsWritten } on success.
export const publishTermReport = async (termReportId) => {
  if (!termReportId) return fail('termReportId required');
  const { data, error } = await supabase.rpc('publish_term_report', {
    p_term_report_id: termReportId,
  });
  if (error) return fail(error.message);
  return ok({ rowsWritten: Number(data) || 0 });
};

// Annual Report aggregator (reads snapshots → halves → returns per-cell rows).
// One round-trip regardless of class size.
//
// Each row: { student_id, student_name, student_code, subject_id, subject_name,
//             term_report_id, term_report_name, term_report_sequence,
//             halved_marks, halved_max, has_any_marks, source_published_at }
//
// If a source term_report has no published snapshot, its rows simply won't
// appear in the result (clients should warn user to publish those terms first).
export const generateAnnualReport = async ({ termReportIds, classInstanceId, studentId = null }) => {
  if (!Array.isArray(termReportIds) || termReportIds.length === 0) {
    return fail('Pick at least one term report');
  }
  if (!classInstanceId) return fail('classInstanceId required');
  const { data, error } = await supabase.rpc('generate_annual_report', {
    p_term_report_ids: termReportIds,
    p_class_instance_id: classInstanceId,
    p_student_id: studentId,
  });
  if (error) return fail(error.message);
  return ok(data || []);
};

// ── Term Reports ────────────────────────────────────────────────────────────
//
// A term_report is an exam_groups row with kind='term_report' and a non-null
// source_group_ids array. It owns no tests/marks of its own — the consolidated
// view is computed live by generate_clubbed_report.

// Returns the union of class_instance_ids covered by the given source groups.
// Used at create-time to populate the term_report's own class scope so it can
// be opened on any class its sources cover.
export const getClassesCoveredBySources = async (sourceGroupIds) => {
  if (!Array.isArray(sourceGroupIds) || sourceGroupIds.length === 0) {
    return ok([]);
  }
  const { data, error } = await supabase
    .from('exam_group_classes')
    .select('class_instance_id')
    .in('exam_group_id', sourceGroupIds);
  if (error) return fail(error.message);
  const unique = Array.from(new Set((data || []).map((r) => r.class_instance_id)));
  return ok(unique);
};

// High-level helper: the dialog calls this with name + sources + best-of.
// We resolve covered classes from the sources, then create the row.
export const createTermReport = async (payload) => {
  const required = ['school_code', 'academic_year_id', 'name', 'source_group_ids'];
  for (const k of required) if (!payload?.[k]) return fail(`Missing field: ${k}`);
  const sources = payload.source_group_ids;
  if (!Array.isArray(sources) || sources.length === 0) {
    return fail('Pick at least one source assessment');
  }

  const cRes = await getClassesCoveredBySources(sources);
  if (!cRes.success) return cRes;
  if (cRes.data.length === 0) {
    return fail('Selected assessments have no classes attached');
  }

  return createExamGroup({
    ...payload,
    kind: 'term_report',
    source_group_ids: sources,
    class_instance_ids: cRes.data,
    exam_type: payload.exam_type || 'custom',
  });
};

// Update term_report's source list / best-of / name. Reconciles class scope
// when sources change.
export const updateTermReport = async (id, patch) => {
  if (!id) return fail('id required');
  const out = { ...patch };

  if (Array.isArray(patch.source_group_ids)) {
    if (patch.source_group_ids.length === 0) {
      return fail('Pick at least one source assessment');
    }
    const cRes = await getClassesCoveredBySources(patch.source_group_ids);
    if (!cRes.success) return cRes;
    if (cRes.data.length === 0) {
      return fail('Selected assessments have no classes attached');
    }
    out.class_instance_ids = cRes.data;
  }

  return updateExamGroup(id, out);
};

// Convenience: fetch a term_report along with hydrated source groups (name + is_pa)
// so the editor can render their badges.
export const getTermReportWithSources = async (id) => {
  const { data: tr, error } = await supabase
    .from('exam_groups')
    .select('*, exam_group_classes(class_instance_id)')
    .eq('id', id)
    .eq('kind', 'term_report')
    .maybeSingle();
  if (error) return fail(error.message);
  if (!tr) return fail('Term report not found');

  const sourceIds = Array.isArray(tr.source_group_ids) ? tr.source_group_ids : [];
  let sources = [];
  if (sourceIds.length > 0) {
    const { data: srcRows, error: sErr } = await supabase
      .from('exam_groups')
      .select('id, name, is_pa, exam_type, kind')
      .in('id', sourceIds);
    if (sErr) return fail(sErr.message);
    // Preserve order from source_group_ids
    const byId = new Map((srcRows || []).map((r) => [r.id, r]));
    sources = sourceIds.map((sid) => byId.get(sid)).filter(Boolean);
  }

  return ok({
    ...tr,
    class_instance_ids: (tr.exam_group_classes || []).map((x) => x.class_instance_id),
    sources,
  });
};

// Build report-card data for a Term Report + student.
//
// Two modes, auto-detected from the sources:
//
//  A) "term" mode  — sources are assessments (PA, Unit Test, Half-Yearly).
//     For each subject:
//       bestPA       = the single highest-scoring PA across all picked PAs
//       bestPaScaled = bestPA.marks ÷ 2  (max also halved)
//       term         = sum of all non-PA cells (marks AND maxes summed)
//       total        = bestPaScaled + term
//       percentage   = total.marks / total.max × 100
//
//  B) "annual" mode — sources are themselves term_reports (e.g., Term 1 +
//      Term 2). For each subject:
//       term1_50    = (Term 1 Report subject total) ÷ 2   (so 100 → 50)
//       term2_50    = (Term 2 Report subject total) ÷ 2
//       total_100   = term1_50 + term2_50
//       Renders St George "Term End Report" layout in the report card.
//
// In both modes the service returns a unified subjects[] shape so
// ReportCardPreview can branch on group.kind + presence of term_components.
export const buildTermReportCardData = async ({ termReportId, studentId, schoolCode }) => {
  if (!termReportId || !studentId) return fail('termReportId + studentId required');

  // 1. Resolve the term_report row + sources
  const trRes = await getTermReportWithSources(termReportId);
  if (!trRes.success) return trRes;
  const tr = trRes.data;

  // Pretty academic-year label
  if (tr.academic_year_id) {
    const { data: ay } = await supabase
      .from('academic_years')
      .select('year_start, year_end, start_date, end_date')
      .eq('id', tr.academic_year_id)
      .maybeSingle();
    if (ay) {
      if (ay.year_start && ay.year_end) tr.academic_year_label = `${ay.year_start}-${ay.year_end}`;
      else if (ay.start_date && ay.end_date) {
        tr.academic_year_label = `${ay.start_date.slice(0, 4)}-${ay.end_date.slice(0, 4)}`;
      }
    }
  }

  // 2. Resolve student + class
  const { data: student, error: stErr } = await supabase
    .from('student')
    .select('id, full_name, student_code, class_instance_id, class_instances:class_instance_id(grade, section)')
    .eq('id', studentId)
    .single();
  if (stErr) return fail(stErr.message);
  if (!student.class_instance_id) return fail('Student is not assigned to a class');

  // ── Annual mode detection ────────────────────────────────────────────────
  // If every source row is itself a term_report, switch to St George layout.
  const allSourcesAreTermReports =
    Array.isArray(tr.sources) && tr.sources.length > 0 &&
    tr.sources.every((s) => s?.kind === 'term_report');

  if (allSourcesAreTermReports) {
    return buildAnnualReportCardData({
      tr, student, schoolCode,
    });
  }

  // 3. RPC with paBestOf=1: rank-1 PA per (student, subject) is the only
  //    included PA. Everything else (non-PA) passes through with included=true.
  const rpc = await generateClubbedReport({
    examGroupIds: tr.source_group_ids || [],
    classInstanceId: student.class_instance_id,
    studentId,
    paBestOf: 1,
  });
  if (!rpc.success) return rpc;
  const rows = rpc.data || [];

  // 4. Collapse rows by subject — one node per subject with separated PA + Term buckets.
  const bySubject = new Map();
  rows.forEach((r) => {
    if (!r.subject_id) return;
    if (!bySubject.has(r.subject_id)) {
      bySubject.set(r.subject_id, {
        subject_id: r.subject_id,
        subject_name: r.subject_name,
        components: [],     // every cell, included or dropped (for the pivot/preview)
        bestPa: null,       // { marks, max, exam_group_name } or null
        termObtained: 0,
        termMax: 0,
        anyTermMarks: false,
      });
    }
    const node = bySubject.get(r.subject_id);
    node.components.push({
      exam_group_id: r.exam_group_id,
      exam_group_name: r.exam_group_name,
      is_pa: r.is_pa,
      marks_obtained: Number(r.marks_obtained || 0),
      max_marks: Number(r.max_marks || 0),
      included: r.included,
      drop_reason: r.drop_reason,
      has_any_marks: r.has_any_marks,
      pa_rank: r.pa_rank,
    });

    if (r.is_pa) {
      // The RPC marks the rank-1 PA as included (paBestOf=1). That's the winner.
      if (r.included && r.has_any_marks) {
        node.bestPa = {
          marks: Number(r.marks_obtained || 0),
          max: Number(r.max_marks || 0),
          exam_group_id: r.exam_group_id,
          exam_group_name: r.exam_group_name,
        };
      }
    } else {
      // Non-PA: sum into the term bucket regardless of pa_rank.
      node.termObtained += Number(r.marks_obtained || 0);
      node.termMax += Number(r.max_marks || 0);
      if (r.has_any_marks) node.anyTermMarks = true;
    }
  });

  // Helper: halve and round half-up to nearest 0.5 (so 21 → 10.5, 30 → 15).
  // Using a fixed scale-by-2 keeps the math transparent — the divisor is the
  // CBSE convention "PA out of 40 reported as out of 20".
  const halve = (n) => Math.round((n / 2) * 2) / 2; // exact halves, no floor

  const subjects = Array.from(bySubject.values())
    .map((s) => {
      const bestPaRaw = s.bestPa
        ? { marks: s.bestPa.marks, max: s.bestPa.max,
            exam_group_id: s.bestPa.exam_group_id,
            exam_group_name: s.bestPa.exam_group_name }
        : null;
      const bestPaScaled = bestPaRaw
        ? { marks: halve(bestPaRaw.marks), max: halve(bestPaRaw.max) }
        : null;

      const totalObtained =
        (bestPaScaled?.marks || 0) + (s.anyTermMarks ? s.termObtained : 0);
      const totalMax =
        (bestPaScaled?.max || 0) + s.termMax;
      const anyMarks = !!bestPaRaw || s.anyTermMarks;
      const percentage = totalMax > 0 && anyMarks
        ? Number(((totalObtained / totalMax) * 100).toFixed(2))
        : null;

      return {
        subject_id: s.subject_id,
        subject_name: s.subject_name,
        title: s.subject_name,
        // Detailed buckets
        best_pa_raw: bestPaRaw,                          // { marks, max, exam_group_name } | null
        best_pa: bestPaScaled,                           // halved version | null
        term: s.anyTermMarks
          ? { marks: s.termObtained, max: s.termMax }
          : (s.termMax > 0 ? { marks: 0, max: s.termMax } : null),
        any_marks: anyMarks,
        components: s.components,
        // Compatibility with ReportCardPreview's existing shape so the legacy
        // template still works as a fallback. These already represent the
        // FINAL numbers (post-halving + term sum).
        marks_obtained: anyMarks ? totalObtained : null,
        max_marks: totalMax,
        percentage,
        remarks: null,
      };
    })
    .sort((a, b) => (a.subject_name || '').localeCompare(b.subject_name || ''));

  const totalMax = subjects.reduce((s, x) => s + Number(x.max_marks || 0), 0);
  const totalObtained = subjects.reduce((s, x) => s + Number(x.marks_obtained || 0), 0);
  const percentage = totalMax > 0
    ? Number(((totalObtained / totalMax) * 100).toFixed(2))
    : null;

  // 5. Grading scale
  let scaleRow = null;
  if (tr.grading_scale_id) {
    const r = await getGradingScale(tr.grading_scale_id);
    if (r.success) scaleRow = r.data;
  }
  if (!scaleRow) {
    const r = await getDefaultGradingScale(schoolCode || tr.school_code);
    if (r.success) scaleRow = r.data;
  }
  const scale = scaleRow?.scale || [];
  const overall = gradeFor(percentage, scale);

  // 6. Branding
  const brandingRes = await getSchoolBranding(schoolCode || tr.school_code);
  const branding = brandingRes.success ? brandingRes.data : null;

  return ok({
    group: { ...tr, kind: 'term_report' },
    student,
    subjects,
    totals: { obtained: totalObtained, max: totalMax, percentage },
    overall_grade: overall?.grade || null,
    overall_gpa: overall?.gpa || null,
    grading_scale: scale,
    branding,
  });
};

// ── Annual Term-End Report (St George layout) ───────────────────────────────
//
// Builds the report-card data for a term_report whose sources are themselves
// term_reports (e.g., Annual Report = Term 1 + Term 2).
//
// Reads from term_report_subject_totals snapshots via generate_annual_report
// RPC. One round-trip regardless of source count. Each source term_report
// must have been published — if not, that source's rows are absent and we
// surface a per-row note via has_any_marks=false.
const buildAnnualReportCardData = async ({ tr, student, schoolCode }) => {
  if (!student?.class_instance_id) return fail('Student has no class assigned');

  // 1. One RPC call returns all the per-(subject, source) cells already halved.
  const ar = await generateAnnualReport({
    termReportIds: tr.source_group_ids || [],
    classInstanceId: student.class_instance_id,
    studentId: student.id,
  });
  if (!ar.success) return ar;
  const rows = ar.data || [];

  // 2. Build the source list in the order the user picked, with each source's
  //    pretty name (resolved server-side via term_report row).
  const sourceOrderMap = new Map();
  rows.forEach((r) => {
    if (!sourceOrderMap.has(r.term_report_id)) {
      sourceOrderMap.set(r.term_report_id, {
        id: r.term_report_id,
        name: r.term_report_name,
        sequence: r.term_report_sequence,
        published_at: r.source_published_at,
      });
    }
  });
  // Preserve the original picked order via tr.sources, falling back to RPC sequence
  const sourceOrder = (tr.sources || [])
    .map((s) => sourceOrderMap.get(s.id))
    .filter(Boolean);
  // If RPC returned sources we didn't have in tr.sources, append them
  sourceOrderMap.forEach((s) => {
    if (!sourceOrder.find((x) => x.id === s.id)) sourceOrder.push(s);
  });

  // 3. Group by subject; one term_components cell per source.
  const subjectMap = new Map();
  rows.forEach((r) => {
    if (!r.subject_id) return;
    const key = r.subject_id;
    if (!subjectMap.has(key)) {
      subjectMap.set(key, {
        subject_id: r.subject_id,
        subject_name: r.subject_name,
        term_components: [],
        marks_obtained: 0,
        max_marks: 0,
        any_marks: false,
      });
    }
    const node = subjectMap.get(key);
    node.term_components.push({
      source_id: r.term_report_id,
      source_name: r.term_report_name,
      marks: r.has_any_marks ? Number(r.halved_marks) : null,
      max: Number(r.halved_max),
    });
    if (r.has_any_marks) {
      node.any_marks = true;
      node.marks_obtained += Number(r.halved_marks);
    }
    node.max_marks += Number(r.halved_max);
  });

  // 4. Ensure every (subject × source) cell exists, even when one source
  //    didn't have that subject. Pad with placeholder so columns line up.
  const subjects = Array.from(subjectMap.values())
    .map((s) => {
      // Sort components in source-picked order, padding missing
      const components = sourceOrder.map((src) => {
        const existing = s.term_components.find((c) => c.source_id === src.id);
        if (existing) return existing;
        return {
          source_id: src.id,
          source_name: src.name,
          marks: null,
          max: 0,
        };
      });
      const percentage = s.max_marks > 0 && s.any_marks
        ? Number(((s.marks_obtained / s.max_marks) * 100).toFixed(2))
        : null;
      return {
        subject_id: s.subject_id,
        subject_name: s.subject_name,
        title: s.subject_name,
        term_components: components,
        marks_obtained: s.any_marks ? s.marks_obtained : null,
        max_marks: s.max_marks,
        percentage,
        any_marks: s.any_marks,
        remarks: null,
      };
    })
    .sort((a, b) => (a.subject_name || '').localeCompare(b.subject_name || ''));

  // 4. Totals across subjects
  const totalMax = subjects.reduce((a, x) => a + Number(x.max_marks || 0), 0);
  const totalObtained = subjects.reduce((a, x) => a + Number(x.marks_obtained || 0), 0);
  const percentage = totalMax > 0
    ? Number(((totalObtained / totalMax) * 100).toFixed(2))
    : null;

  // 5. Grading scale (the annual report's own, fall back to school default)
  let scaleRow = null;
  if (tr.grading_scale_id) {
    const r = await getGradingScale(tr.grading_scale_id);
    if (r.success) scaleRow = r.data;
  }
  if (!scaleRow) {
    const r = await getDefaultGradingScale(schoolCode || tr.school_code);
    if (r.success) scaleRow = r.data;
  }
  const scale = scaleRow?.scale || [];
  const overall = gradeFor(percentage, scale);

  // Per-subject grade for the GRADE column
  const subjectsWithGrade = subjects.map((s) => ({
    ...s,
    grade: s.percentage != null ? gradeFor(s.percentage, scale)?.grade || null : null,
  }));

  // 6. Branding
  const brandingRes = await getSchoolBranding(schoolCode || tr.school_code);
  const branding = brandingRes.success ? brandingRes.data : null;

  return ok({
    group: { ...tr, kind: 'term_report', mode: 'annual' },
    student,
    subjects: subjectsWithGrade,
    sources: sourceOrder.map((s) => ({ id: s.id, name: s.name })),
    totals: { obtained: totalObtained, max: totalMax, percentage },
    overall_grade: overall?.grade || null,
    overall_gpa: overall?.gpa || null,
    grading_scale: scale,
    branding,
  });
};

// ── Clubbed (combined) reports ──────────────────────────────────────────────
//
// Pulls marks from multiple exam_groups into one report. For exam_groups
// flagged is_pa, the RPC ranks per (student, subject) and keeps the top
// `paBestOf` (default 2). Non-PA groups always pass through.
//
// Each returned row represents one (student, subject, exam_group) cell:
//   { student_id, student_name, student_code, subject_id, subject_name,
//     exam_group_id, exam_group_name, is_pa, marks_obtained, max_marks,
//     has_any_marks, pa_rank, included, drop_reason }
//
// Dropped PA rows are returned with included=false so the UI can grey them
// out instead of hiding them.
export const generateClubbedReport = async ({
  examGroupIds,
  classInstanceId,
  studentId = null,
  paBestOf = 2,
}) => {
  if (!Array.isArray(examGroupIds) || examGroupIds.length === 0) {
    return fail('Pick at least one assessment');
  }
  if (!classInstanceId) return fail('classInstanceId required');

  const { data, error } = await supabase.rpc('generate_clubbed_report', {
    p_exam_group_ids: examGroupIds,
    p_class_instance_id: classInstanceId,
    p_student_id: studentId,
    p_pa_best_of: paBestOf == null ? 2 : Number(paBestOf),
  });
  if (error) return fail(error.message);
  return ok(data || []);
};
