// src/features/analytics/services/analyticsService.js
// Unified analytics service. Byte-compatible port of mobile analytics RPCs +
// existing web analytics RPCs. School-scoped via existing RLS.

import { supabase } from '@/config/supabaseClient';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

const IST = 'Asia/Kolkata';
const fmt = (d) => dayjs(d).tz(IST).format('YYYY-MM-DD');

// ────────────────────────────────────────────────────────────────────────────
// Reference data (classes / students / subjects)
// ────────────────────────────────────────────────────────────────────────────

export async function listClasses(schoolCode, academicYearId = null) {
  let q = supabase
    .from('class_instances')
    .select('id, grade, section, school_code, academic_year_id')
    .eq('school_code', schoolCode);
  if (academicYearId) q = q.eq('academic_year_id', academicYearId);
  q = q.order('grade', { ascending: true }).order('section', { ascending: true });
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((c) => ({
    ...c,
    label: `Grade ${c.grade}${c.section ? ` ${c.section}` : ''}`,
  }));
}

export async function listStudents(schoolCode, classInstanceId = null) {
  let q = supabase
    .from('student')
    .select('id, full_name, student_code, class_instance_id, school_code, email')
    .eq('school_code', schoolCode)
    .order('full_name');
  if (classInstanceId) q = q.eq('class_instance_id', classInstanceId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function listSubjects(schoolCode, classInstanceId = null) {
  let q = supabase
    .from('subjects')
    .select('id, name, class_instance_id, school_code')
    .eq('school_code', schoolCode)
    .order('name');
  if (classInstanceId) q = q.eq('class_instance_id', classInstanceId);
  const { data, error } = await q;
  if (error) return [];
  return data || [];
}

export async function getStudentById(studentId) {
  const { data, error } = await supabase
    .from('student')
    .select(`
      id, full_name, student_code, email, class_instance_id, school_code,
      class_instances:class_instance_id (id, grade, section)
    `)
    .eq('id', studentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getClassInstanceById(classInstanceId) {
  const { data, error } = await supabase
    .from('class_instances')
    .select('id, grade, section, school_code, academic_year_id')
    .eq('id', classInstanceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, label: `Grade ${data.grade}${data.section ? ` ${data.section}` : ''}` };
}

// ────────────────────────────────────────────────────────────────────────────
// Mobile-parity analytics RPCs (advanced)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Per-topic accuracy heatmap for a single student. Mirrors mobile
 * useTopicHeatmap → supabase.rpc('get_student_topic_heatmap', …)
 *
 * Returns: TopicHeatmapCell[]
 *   { chapter_id, chapter_title, chapter_no, topic_id, topic_title, topic_no,
 *     total_questions, correct_answers, accuracy_percent, avg_time_seconds,
 *     test_count, last_tested_at }
 */
export async function getStudentTopicHeatmap(studentId, classInstanceId, subjectId) {
  if (!studentId || !classInstanceId || !subjectId) return [];
  const { data, error } = await supabase.rpc('get_student_topic_heatmap', {
    p_student_id: studentId,
    p_class_instance_id: classInstanceId,
    p_subject_id: subjectId,
  });
  if (error) throw error;
  return data || [];
}

/**
 * Class-aggregate weak topics. Mirrors mobile useClassWeakAreas.
 * threshold = 50 | 60 | 70 (default 60).
 *
 * Returns: ClassWeakTopic[]
 *   { chapter_id, chapter_title, chapter_no, topic_id, topic_title, topic_no,
 *     avg_class_accuracy, students_below_threshold, total_students }
 */
export async function getClassWeakTopics(classInstanceId, subjectId, threshold = 60) {
  if (!classInstanceId || !subjectId) return [];
  const { data, error } = await supabase.rpc('get_class_weak_topics', {
    p_class_instance_id: classInstanceId,
    p_subject_id: subjectId,
    p_threshold: threshold,
  });
  if (error) throw error;
  return data || [];
}

/**
 * Per-question misconception analysis for a test. Mirrors mobile
 * useMisconceptionReport.
 *
 * Returns: QuestionMisconceptionData[]
 *   { question_id, question_text, question_type, options, correct_index,
 *     chapter_id, chapter_title, topic_id, topic_title, difficulty_level,
 *     total_answers, correct_count, accuracy_percent, option_distribution }
 */
export async function getQuestionMisconceptionReport(testId) {
  if (!testId) return [];
  const { data, error } = await supabase.rpc('get_question_misconception_report', {
    p_test_id: testId,
  });
  if (error) throw error;
  return data || [];
}

// ────────────────────────────────────────────────────────────────────────────
// Existing web analytics RPCs (kept for parity)
// ────────────────────────────────────────────────────────────────────────────

export async function getAttendanceAnalytics({ startDate, endDate, classId }) {
  const { data, error } = await supabase.rpc('attendance_analytics', {
    p_start: fmt(startDate),
    p_end: fmt(endDate),
    p_class_id: classId && classId !== 'all' ? classId : null,
  });
  if (error) throw error;
  return data;
}

export async function getFeesAnalytics({ startDate, endDate, classId }) {
  const { data, error } = await supabase.rpc('fees_analytics', {
    p_start: fmt(startDate),
    p_end: fmt(endDate),
    p_class_id: classId && classId !== 'all' ? classId : null,
  });
  if (error) throw error;
  return data;
}

export async function getExamsAnalytics({ startDate, endDate, classId, passThreshold = 40 }) {
  const startIST = dayjs(startDate).tz(IST).startOf('day').toISOString();
  const endIST = dayjs(endDate).tz(IST).endOf('day').toISOString();
  const { data, error } = await supabase.rpc('exams_analytics', {
    p_start: startIST,
    p_end: endIST,
    p_class_id: classId && classId !== 'all' ? classId : null,
    p_pass_threshold: passThreshold,
  });
  if (error) throw error;
  return data;
}

export async function getLearningAnalytics({ startDate, endDate, classId }) {
  const startIST = dayjs(startDate).tz(IST).startOf('day').toISOString();
  const endIST = dayjs(endDate).tz(IST).endOf('day').toISOString();
  const { data, error } = await supabase.rpc('learning_analytics', {
    p_start: startIST,
    p_end: endIST,
    p_class_id: classId && classId !== 'all' ? classId : null,
  });
  if (error) throw error;
  return data;
}

// ────────────────────────────────────────────────────────────────────────────
// Test-attempt + attendance queries used to build trend / distribution / status
// charts when no dedicated RPC exists.
// ────────────────────────────────────────────────────────────────────────────

/**
 * All test attempts for one student (joined with test metadata).
 */
export async function getStudentTestAttempts(studentId, { startDate, endDate, subjectId } = {}) {
  if (!studentId) return [];
  let q = supabase
    .from('test_attempts')
    .select(`
      id, test_id, student_id, score, earned_points, total_points,
      status, started_at, completed_at,
      tests:test_id (
        id, title, test_type, test_mode, test_date, subject_id, class_instance_id,
        subjects:subject_id (id, name)
      )
    `)
    .eq('student_id', studentId)
    .order('completed_at', { ascending: true });
  if (startDate) q = q.gte('completed_at', dayjs(startDate).startOf('day').toISOString());
  if (endDate) q = q.lte('completed_at', dayjs(endDate).endOf('day').toISOString());
  const { data, error } = await q;
  if (error) throw error;
  let rows = (data || []).filter((r) => r.completed_at);
  if (subjectId && subjectId !== 'all') {
    rows = rows.filter((r) => r.tests?.subject_id === subjectId);
  }
  return rows.map((r) => ({
    ...r,
    percent: r.total_points ? Math.round(((r.earned_points || 0) / r.total_points) * 1000) / 10 : (r.score ?? 0),
  }));
}

/**
 * All test attempts for one class.
 */
export async function getClassTestAttempts(classInstanceId, { startDate, endDate, subjectId } = {}) {
  if (!classInstanceId) return [];
  let testQ = supabase
    .from('tests')
    .select('id, title, test_type, test_date, subject_id, class_instance_id, subjects:subject_id(id,name)')
    .eq('class_instance_id', classInstanceId);
  if (subjectId && subjectId !== 'all') testQ = testQ.eq('subject_id', subjectId);
  const { data: tests, error: tErr } = await testQ;
  if (tErr) throw tErr;
  const testIds = (tests || []).map((t) => t.id);
  if (testIds.length === 0) return [];

  let q = supabase
    .from('test_attempts')
    .select(`
      id, test_id, student_id, score, earned_points, total_points,
      status, started_at, completed_at
    `)
    .in('test_id', testIds);
  if (startDate) q = q.gte('completed_at', dayjs(startDate).startOf('day').toISOString());
  if (endDate) q = q.lte('completed_at', dayjs(endDate).endOf('day').toISOString());
  const { data, error } = await q;
  if (error) throw error;
  const testMap = new Map((tests || []).map((t) => [t.id, t]));
  return (data || [])
    .filter((r) => r.completed_at)
    .map((r) => ({
      ...r,
      tests: testMap.get(r.test_id) || null,
      percent: r.total_points ? Math.round(((r.earned_points || 0) / r.total_points) * 1000) / 10 : (r.score ?? 0),
    }));
}

/**
 * All test attempts for the school (across classes).
 */
export async function getSchoolTestAttempts(schoolCode, { startDate, endDate, subjectId, classId } = {}) {
  if (!schoolCode) return [];
  let testQ = supabase
    .from('tests')
    .select('id, title, test_type, test_date, subject_id, class_instance_id, subjects:subject_id(id,name), class_instances:class_instance_id(id, grade, section, school_code)')
    .eq('class_instances.school_code', schoolCode);
  if (subjectId && subjectId !== 'all') testQ = testQ.eq('subject_id', subjectId);
  if (classId && classId !== 'all') testQ = testQ.eq('class_instance_id', classId);
  const { data: tests, error: tErr } = await testQ;
  if (tErr) throw tErr;
  const validTests = (tests || []).filter((t) => t.class_instances);
  const testIds = validTests.map((t) => t.id);
  if (testIds.length === 0) return [];
  let q = supabase
    .from('test_attempts')
    .select('id, test_id, student_id, score, earned_points, total_points, status, completed_at')
    .in('test_id', testIds);
  if (startDate) q = q.gte('completed_at', dayjs(startDate).startOf('day').toISOString());
  if (endDate) q = q.lte('completed_at', dayjs(endDate).endOf('day').toISOString());
  const { data, error } = await q;
  if (error) throw error;
  const tMap = new Map(validTests.map((t) => [t.id, t]));
  return (data || [])
    .filter((r) => r.completed_at)
    .map((r) => ({
      ...r,
      tests: tMap.get(r.test_id) || null,
      percent: r.total_points ? Math.round(((r.earned_points || 0) / r.total_points) * 1000) / 10 : (r.score ?? 0),
    }));
}

/**
 * Attendance rows (school / class / student scoped).
 */
export async function getAttendanceRows({ schoolCode, classInstanceId, studentId, startDate, endDate }) {
  let q = supabase
    .from('attendance')
    .select('id, student_id, status, date')
    .gte('date', fmt(startDate))
    .lte('date', fmt(endDate))
    .order('date');
  if (studentId) q = q.eq('student_id', studentId);
  const { data, error } = await q;
  if (error) throw error;
  let rows = data || [];
  if (classInstanceId || schoolCode) {
    // need student → class scoping; lookup students once
    let sQ = supabase.from('student').select('id, class_instance_id, school_code');
    if (schoolCode) sQ = sQ.eq('school_code', schoolCode);
    if (classInstanceId) sQ = sQ.eq('class_instance_id', classInstanceId);
    const { data: students } = await sQ;
    const sIds = new Set((students || []).map((s) => s.id));
    rows = rows.filter((r) => sIds.has(r.student_id));
  }
  return rows;
}

// ────────────────────────────────────────────────────────────────────────────
// Pure aggregators — no Supabase calls. Used by tab components.
// ────────────────────────────────────────────────────────────────────────────

const STATUS_BUCKETS = [
  { key: 'distinction', label: 'Distinction', min: 75, max: 100, color: '#10b981' },
  { key: 'first',       label: 'First Class', min: 60, max: 74.99, color: '#3b82f6' },
  { key: 'second',      label: 'Second Class', min: 45, max: 59.99, color: '#f59e0b' },
  { key: 'pass',        label: 'Pass',        min: 33, max: 44.99, color: '#a855f7' },
  { key: 'fail',        label: 'Fail',        min: 0,  max: 32.99, color: '#ef4444' },
];

export function bucketize(percent) {
  for (const b of STATUS_BUCKETS) if (percent >= b.min && percent <= b.max) return b;
  return STATUS_BUCKETS[STATUS_BUCKETS.length - 1];
}

export function statusDistribution(attempts) {
  const counts = Object.fromEntries(STATUS_BUCKETS.map((b) => [b.key, 0]));
  attempts.forEach((a) => {
    const b = bucketize(a.percent || 0);
    counts[b.key] += 1;
  });
  const total = attempts.length || 1;
  return STATUS_BUCKETS.map((b) => ({
    ...b,
    value: counts[b.key],
    percent: Math.round((counts[b.key] / total) * 1000) / 10,
  }));
}

/**
 * Group attempts by completion-date day, return { date, avg, count }.
 */
export function trendByDay(attempts) {
  const map = new Map();
  attempts.forEach((a) => {
    if (!a.completed_at) return;
    const d = dayjs(a.completed_at).format('YYYY-MM-DD');
    const m = map.get(d) || { date: d, sum: 0, count: 0 };
    m.sum += a.percent || 0;
    m.count += 1;
    map.set(d, m);
  });
  return Array.from(map.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ date: r.date, avg: Math.round((r.sum / r.count) * 10) / 10, count: r.count }));
}

/**
 * Group attempts by subject. Returns [{ subjectId, subjectName, avg, count }].
 */
export function trendBySubject(attempts) {
  const map = new Map();
  attempts.forEach((a) => {
    const sId = a.tests?.subjects?.id || a.tests?.subject_id || 'unknown';
    const sName = a.tests?.subjects?.name || 'Unknown';
    const m = map.get(sId) || { subjectId: sId, subjectName: sName, sum: 0, count: 0 };
    m.sum += a.percent || 0;
    m.count += 1;
    map.set(sId, m);
  });
  return Array.from(map.values()).map((r) => ({
    subjectId: r.subjectId,
    subjectName: r.subjectName,
    avg: Math.round((r.sum / r.count) * 10) / 10,
    count: r.count,
  })).sort((a, b) => b.avg - a.avg);
}

/**
 * Group attendance rows by day → present / absent / late counts.
 */
export function dailyAttendanceTrend(rows, startDate, endDate) {
  const map = new Map();
  rows.forEach((r) => {
    const m = map.get(r.date) || { date: r.date, present: 0, absent: 0, late: 0, total: 0 };
    m.total += 1;
    if (r.status === 'present') m.present += 1;
    else if (r.status === 'absent') m.absent += 1;
    else if (r.status === 'late') m.late += 1;
    map.set(r.date, m);
  });
  // Fill any gaps with zeros so chart x-axis is continuous
  const days = [];
  let cur = dayjs(startDate);
  const end = dayjs(endDate);
  while (cur.isBefore(end) || cur.isSame(end, 'day')) {
    const k = cur.format('YYYY-MM-DD');
    const m = map.get(k) || { date: k, present: 0, absent: 0, late: 0, total: 0 };
    m.rate = m.total ? Math.round((m.present / m.total) * 1000) / 10 : 0;
    days.push(m);
    cur = cur.add(1, 'day');
  }
  return days;
}

/**
 * Joins per-day attendance rate with per-day average test score.
 */
export function attendancePerformanceCorrelation(attendanceRows, attempts) {
  const aMap = new Map();
  attendanceRows.forEach((r) => {
    const w = dayjs(r.date).startOf('week').format('YYYY-MM-DD');
    const m = aMap.get(w) || { week: w, present: 0, total: 0 };
    m.total += 1;
    if (r.status === 'present') m.present += 1;
    aMap.set(w, m);
  });
  const tMap = new Map();
  attempts.forEach((a) => {
    if (!a.completed_at) return;
    const w = dayjs(a.completed_at).startOf('week').format('YYYY-MM-DD');
    const m = tMap.get(w) || { week: w, sum: 0, count: 0 };
    m.sum += a.percent || 0;
    m.count += 1;
    tMap.set(w, m);
  });
  const allWeeks = new Set([...aMap.keys(), ...tMap.keys()]);
  return Array.from(allWeeks)
    .sort()
    .map((w) => {
      const a = aMap.get(w);
      const t = tMap.get(w);
      return {
        week: w,
        attendanceRate: a && a.total ? Math.round((a.present / a.total) * 1000) / 10 : null,
        avgScore: t && t.count ? Math.round((t.sum / t.count) * 10) / 10 : null,
      };
    });
}

/**
 * Compare matrix: students × subjects for a class.
 */
export function studentSubjectMatrix(attempts, students) {
  const subjects = new Map(); // id → name
  attempts.forEach((a) => {
    const sId = a.tests?.subjects?.id || a.tests?.subject_id;
    const sName = a.tests?.subjects?.name || 'Unknown';
    if (sId) subjects.set(sId, sName);
  });
  const sIds = Array.from(subjects.keys());
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const rows = students.map((s) => {
    const row = { studentId: s.id, name: s.full_name, code: s.student_code };
    let total = 0, count = 0;
    sIds.forEach((sId) => {
      const matching = attempts.filter((a) =>
        a.student_id === s.id && (a.tests?.subjects?.id === sId || a.tests?.subject_id === sId)
      );
      if (matching.length) {
        const avg = matching.reduce((acc, x) => acc + (x.percent || 0), 0) / matching.length;
        row[sId] = Math.round(avg * 10) / 10;
        total += avg;
        count += 1;
      } else {
        row[sId] = null;
      }
    });
    row.overall = count ? Math.round((total / count) * 10) / 10 : null;
    return row;
  });
  // sort by overall desc
  rows.sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));
  return { subjects: Array.from(subjects.entries()).map(([id, name]) => ({ id, name })), rows };
}

export const STATUS_BANDS = STATUS_BUCKETS;

/**
 * Top wrong option for a misconception question. Returns { letter, text, percent }
 * or null if no clear misconception (>=20% of responses chose same wrong option).
 */
export function dominantWrongOption(q) {
  if (!q?.option_distribution || !q.options || q.correct_index == null) return null;
  const total = q.total_answers || 0;
  if (!total) return null;
  let best = null;
  Object.entries(q.option_distribution).forEach(([key, count]) => {
    const idx = parseInt(key, 10);
    if (Number.isNaN(idx) || idx === q.correct_index) return;
    const pct = (count / total) * 100;
    if (pct >= 20 && (!best || pct > best.percent)) {
      best = { index: idx, letter: String.fromCharCode(65 + idx), text: q.options[idx], percent: Math.round(pct * 10) / 10, count };
    }
  });
  return best;
}

export default {
  listClasses, listStudents, listSubjects, getStudentById, getClassInstanceById,
  getStudentTopicHeatmap, getClassWeakTopics, getQuestionMisconceptionReport,
  getAttendanceAnalytics, getFeesAnalytics, getExamsAnalytics, getLearningAnalytics,
  getStudentTestAttempts, getClassTestAttempts, getSchoolTestAttempts, getAttendanceRows,
  bucketize, statusDistribution, trendByDay, trendBySubject,
  dailyAttendanceTrend, attendancePerformanceCorrelation, studentSubjectMatrix,
  dominantWrongOption, STATUS_BANDS,
};
