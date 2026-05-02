import { supabase } from '@/config/supabaseClient';

const ok = (data, count = null) => ({ success: true, data, error: null, count: count ?? (Array.isArray(data) ? data.length : data ? 1 : 0) });
const fail = (msg) => ({ success: false, data: null, error: msg, count: 0 });

export const listExamGroups = async ({ schoolCode, academicYearId = null, classInstanceId = null } = {}) => {
  if (!schoolCode) return fail('school code required');
  let q = supabase
    .from('exam_groups')
    .select('*, exam_group_classes(class_instance_id)')
    .eq('school_code', schoolCode)
    .order('created_at', { ascending: false });
  if (academicYearId) q = q.eq('academic_year_id', academicYearId);
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
  const { data, error } = await supabase
    .from('exam_groups')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) return fail(error.message);
  return ok(data);
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
    .select('id, full_name, student_code, class_instance_id')
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
