// src/features/analytics/services/academicAnalyticsService.js
//
// Academic / assessments analytics. Pulls data from:
//   - tests             (offline + online metadata)
//   - test_marks        (offline grade entries)
//   - test_attempts     (online attempts with earned/total points)
//   - subjects          (subject_name)
//   - student / class_instances (display metadata)
//
// Scope follows the AY rule: tests.class_instance_id ∈ class_instances of the
// chosen AY. For per-student drill-down we mirror the mobile useStudentProgress
// hook so the data shape (subjects, recent_tests, stats) is identical.

import { supabase } from '@/config/supabaseClient';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { getClassInstanceIdsForAy, getAyDateRange } from './ayScope';

dayjs.extend(utc);
dayjs.extend(timezone);

const IST = 'Asia/Kolkata';
const fmt = (d) => dayjs(d).tz(IST).format('YYYY-MM-DD');

const PAGE = 1000;
async function fetchAll(builder, label = 'rows') {
  let from = 0;
  let all = [];
  while (true) {
    const { data, error } = await builder.range(from, from + PAGE - 1);
    if (error) {
      console.warn(`[academicAnalytics] ${label} fetch error`, error);
      return all;
    }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
    if (from > 100000) break;
  }
  return all;
}

async function resolveDateRange({ ayId, startDate, endDate }) {
  if (startDate && endDate) return { start: fmt(startDate), end: fmt(endDate) };
  if (ayId) {
    const r = await getAyDateRange(ayId);
    if (r?.start && r?.end) return { start: r.start, end: r.end };
  }
  const today = dayjs().tz(IST);
  return { start: today.subtract(29, 'day').format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') };
}

// ────────────────────────────────────────────────────────────────────────────
// Tests in scope.
// ────────────────────────────────────────────────────────────────────────────
async function fetchTestsInScope({ schoolCode, ayId, classInstanceId, subjectId }) {
  const classIds = (classInstanceId && classInstanceId !== 'all')
    ? [classInstanceId]
    : await getClassInstanceIdsForAy(schoolCode, ayId);
  if (classIds.length === 0) return { classIds: [], tests: [] };

  let q = supabase
    .from('tests')
    .select('id, title, test_date, test_mode, max_marks, subject_id, class_instance_id, school_code')
    .eq('school_code', schoolCode)
    .in('class_instance_id', classIds);
  if (subjectId && subjectId !== 'all') q = q.eq('subject_id', subjectId);
  const tests = await fetchAll(q, 'tests');
  return { classIds, tests };
}

// Pull marks (offline) + attempts (online) for a list of test ids and merge
// into per-(student, test) percentage rows. Each test counted once per student.
async function fetchScoresForTests(testIds) {
  if (!testIds || testIds.length === 0) return [];
  const out = [];
  const CHUNK = 200;
  for (let i = 0; i < testIds.length; i += CHUNK) {
    const slice = testIds.slice(i, i + CHUNK);
    const [marksRes, attemptsRes] = await Promise.all([
      fetchAll(
        supabase
          .from('test_marks')
          .select('id, test_id, student_id, marks_obtained, max_marks, created_at')
          .in('test_id', slice),
        'test_marks',
      ),
      fetchAll(
        supabase
          .from('test_attempts')
          .select('id, test_id, student_id, earned_points, total_points, status, completed_at')
          .in('test_id', slice)
          .eq('status', 'completed'),
        'test_attempts',
      ),
    ]);
    marksRes.forEach((m) => {
      const max = Number(m.max_marks || 0);
      const got = Number(m.marks_obtained || 0);
      const pct = max > 0 ? (got / max) * 100 : 0;
      out.push({
        testId: m.test_id, studentId: m.student_id,
        marksObtained: got, maxMarks: max, pct,
        completedAt: m.created_at, mode: 'offline',
      });
    });
    attemptsRes.forEach((a) => {
      const max = Number(a.total_points || 0);
      const got = Number(a.earned_points || 0);
      const pct = max > 0 ? (got / max) * 100 : 0;
      out.push({
        testId: a.test_id, studentId: a.student_id,
        marksObtained: got, maxMarks: max, pct,
        completedAt: a.completed_at, mode: 'online',
      });
    });
  }
  // Dedup by (student_id, test_id) — keep the most recent
  const map = new Map();
  out.forEach((r) => {
    const k = `${r.studentId}|${r.testId}`;
    const cur = map.get(k);
    if (!cur || (r.completedAt && r.completedAt > (cur.completedAt || ''))) map.set(k, r);
  });
  return Array.from(map.values());
}

// ────────────────────────────────────────────────────────────────────────────
// 1. Headline KPIs
//    school/class scope: avg %, tests, attempts, pass rate, distinction rate,
//                        students assessed, distinct subjects.
//    student scope:      mirrors mobile useStudentProgress.stats —
//                        total_tests, overall_average, highest, lowest,
//                        tests_this_month, improvement_rate.
// ────────────────────────────────────────────────────────────────────────────
export async function getHeadlineKpis({ schoolCode, ayId, classInstanceId, subjectId, studentId }) {
  const empty = {
    scope: studentId ? 'student' : (classInstanceId && classInstanceId !== 'all' ? 'class' : 'school'),
    avgPct: 0, totalTests: 0, totalAttempts: 0,
    passPct: 0, distinctionPct: 0,
    studentsAssessed: 0, distinctSubjects: 0,
    highest: 0, lowest: 0, testsThisMonth: 0, improvementRate: 0,
  };
  if (!schoolCode || !ayId) return empty;

  const { tests } = await fetchTestsInScope({ schoolCode, ayId, classInstanceId, subjectId });
  if (tests.length === 0) return empty;

  const testIds = tests.map((t) => t.id);
  let scores = await fetchScoresForTests(testIds);
  if (studentId) scores = scores.filter((s) => s.studentId === studentId);
  if (scores.length === 0) {
    return { ...empty, totalTests: studentId ? 0 : tests.length };
  }

  const sum = scores.reduce((a, b) => a + b.pct, 0);
  const avgPct = Math.round((sum / scores.length) * 10) / 10;
  const passes = scores.filter((s) => s.pct >= 33).length;
  const distinctions = scores.filter((s) => s.pct >= 75).length;
  const studentsAssessed = new Set(scores.map((s) => s.studentId)).size;

  const today = dayjs().tz(IST);
  const thisMonth = scores.filter((s) => s.completedAt && dayjs(s.completedAt).isSame(today, 'month'));
  const lastMonthStart = today.subtract(1, 'month').startOf('month');
  const lastMonthEnd = today.subtract(1, 'month').endOf('month');
  const lastMonth = scores.filter((s) => {
    if (!s.completedAt) return false;
    const d = dayjs(s.completedAt);
    return d.isAfter(lastMonthStart) && d.isBefore(lastMonthEnd);
  });

  const thisMonthAvg = thisMonth.length > 0 ? thisMonth.reduce((a, b) => a + b.pct, 0) / thisMonth.length : 0;
  const lastMonthAvg = lastMonth.length > 0 ? lastMonth.reduce((a, b) => a + b.pct, 0) / lastMonth.length : 0;
  const improvementRate = lastMonthAvg > 0 && lastMonth.length >= 2 && thisMonth.length >= 2
    ? Math.round(((thisMonthAvg - lastMonthAvg) / lastMonthAvg) * 1000) / 10
    : 0;

  // count tests with at least one score
  const testsWithScores = new Set(scores.map((s) => s.testId)).size;
  const distinctSubjects = new Set(
    tests.filter((t) => scores.some((s) => s.testId === t.id)).map((t) => t.subject_id),
  ).size;

  return {
    scope: studentId ? 'student' : (classInstanceId && classInstanceId !== 'all' ? 'class' : 'school'),
    avgPct,
    totalTests: studentId ? scores.length : testsWithScores,
    totalAttempts: scores.length,
    passPct: Math.round((passes / scores.length) * 1000) / 10,
    distinctionPct: Math.round((distinctions / scores.length) * 1000) / 10,
    studentsAssessed,
    distinctSubjects,
    highest: Math.round(Math.max(...scores.map((s) => s.pct)) * 10) / 10,
    lowest: Math.round(Math.min(...scores.map((s) => s.pct)) * 10) / 10,
    testsThisMonth: studentId ? thisMonth.length : new Set(thisMonth.map((s) => s.testId)).size,
    improvementRate,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Daily score trend — avg % per day in [start, end]. Calendar-windowed.
// ────────────────────────────────────────────────────────────────────────────
export async function getDailyTrend({ schoolCode, ayId, classInstanceId, subjectId, studentId, startDate, endDate }) {
  if (!schoolCode || !ayId) return [];
  const { start, end } = await resolveDateRange({ ayId, startDate, endDate });
  const { tests } = await fetchTestsInScope({ schoolCode, ayId, classInstanceId, subjectId });
  if (tests.length === 0) return fillEmptyDays(start, end);

  let scores = await fetchScoresForTests(tests.map((t) => t.id));
  if (studentId) scores = scores.filter((s) => s.studentId === studentId);
  // Filter to window using completed_at (or test_date as fallback)
  const testDateById = new Map(tests.map((t) => [t.id, t.test_date]));
  const inWindow = scores.filter((s) => {
    const d = s.completedAt || testDateById.get(s.testId);
    if (!d) return false;
    const ds = dayjs(d).format('YYYY-MM-DD');
    return ds >= start && ds <= end;
  });

  const map = new Map();
  inWindow.forEach((s) => {
    const d = s.completedAt || testDateById.get(s.testId);
    const key = dayjs(d).format('YYYY-MM-DD');
    const m = map.get(key) || { date: key, sum: 0, count: 0, attempts: 0 };
    m.sum += s.pct;
    m.count += 1;
    m.attempts += 1;
    map.set(key, m);
  });

  const days = [];
  let cur = dayjs(start);
  const last = dayjs(end);
  while (cur.isBefore(last) || cur.isSame(last, 'day')) {
    const k = cur.format('YYYY-MM-DD');
    const hit = map.get(k);
    days.push({
      date: k,
      avg: hit ? Math.round((hit.sum / hit.count) * 10) / 10 : null,
      attempts: hit ? hit.attempts : 0,
      noData: !hit,
    });
    cur = cur.add(1, 'day');
  }
  return days;
}

function fillEmptyDays(start, end) {
  const days = [];
  let cur = dayjs(start);
  const last = dayjs(end);
  while (cur.isBefore(last) || cur.isSame(last, 'day')) {
    days.push({ date: cur.format('YYYY-MM-DD'), avg: null, attempts: 0, noData: true });
    cur = cur.add(1, 'day');
  }
  return days;
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Per-class summary
// ────────────────────────────────────────────────────────────────────────────
export async function getPerClassSummary({ schoolCode, ayId, subjectId }) {
  if (!schoolCode || !ayId) return [];
  const { classIds, tests } = await fetchTestsInScope({ schoolCode, ayId, classInstanceId: null, subjectId });
  if (tests.length === 0 || classIds.length === 0) return [];

  const scores = await fetchScoresForTests(tests.map((t) => t.id));
  const testCidById = new Map(tests.map((t) => [t.id, t.class_instance_id]));

  const { data: classRows } = await supabase
    .from('class_instances')
    .select('id, grade, section')
    .in('id', classIds);
  const classMap = new Map((classRows || []).map((c) => [c.id, c]));

  const byClass = new Map();
  scores.forEach((s) => {
    const cid = testCidById.get(s.testId);
    if (!cid) return;
    const m = byClass.get(cid) || {
      classInstanceId: cid, sum: 0, count: 0, students: new Set(),
      passes: 0, distinctions: 0, fails: 0,
    };
    m.sum += s.pct;
    m.count += 1;
    m.students.add(s.studentId);
    if (s.pct >= 75) m.distinctions += 1;
    if (s.pct >= 33) m.passes += 1;
    if (s.pct < 33) m.fails += 1;
    byClass.set(cid, m);
  });

  return Array.from(byClass.values()).map((c) => {
    const meta = classMap.get(c.classInstanceId);
    return {
      classInstanceId: c.classInstanceId,
      label: meta ? `Grade ${meta.grade}${meta.section ? ` ${meta.section}` : ''}` : 'Unknown',
      avgPct: c.count > 0 ? Math.round((c.sum / c.count) * 10) / 10 : 0,
      attempts: c.count,
      students: c.students.size,
      passPct: c.count > 0 ? Math.round((c.passes / c.count) * 1000) / 10 : 0,
      distinctionPct: c.count > 0 ? Math.round((c.distinctions / c.count) * 1000) / 10 : 0,
    };
  }).sort((a, b) => b.avgPct - a.avgPct);
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Per-subject summary
// ────────────────────────────────────────────────────────────────────────────
export async function getPerSubjectSummary({ schoolCode, ayId, classInstanceId, studentId }) {
  if (!schoolCode || !ayId) return [];
  const { tests } = await fetchTestsInScope({ schoolCode, ayId, classInstanceId, subjectId: null });
  if (tests.length === 0) return [];

  let scores = await fetchScoresForTests(tests.map((t) => t.id));
  if (studentId) scores = scores.filter((s) => s.studentId === studentId);

  const subjectIds = Array.from(new Set(tests.map((t) => t.subject_id).filter(Boolean)));
  const { data: subjRows } = await supabase
    .from('subjects')
    .select('id, subject_name')
    .in('id', subjectIds.length > 0 ? subjectIds : ['__none__']);
  const subjMap = new Map((subjRows || []).map((s) => [s.id, s.subject_name]));
  const testSubjectById = new Map(tests.map((t) => [t.id, t.subject_id]));

  const bySubject = new Map();
  scores.forEach((s) => {
    const subId = testSubjectById.get(s.testId);
    if (!subId) return;
    const m = bySubject.get(subId) || {
      subjectId: subId, sum: 0, count: 0, tests: new Set(), pcts: [],
    };
    m.sum += s.pct;
    m.count += 1;
    m.tests.add(s.testId);
    m.pcts.push({ pct: s.pct, at: s.completedAt });
    bySubject.set(subId, m);
  });

  // Trend: compare recent half vs older half (parity with mobile getTrend).
  const trendOf = (pcts) => {
    if (pcts.length < 3) return 'stable';
    const sorted = [...pcts].sort((a, b) => (a.at || '').localeCompare(b.at || ''));
    const mid = Math.ceil(sorted.length / 2);
    const olderAvg = avgOf(sorted.slice(0, mid).map((p) => p.pct));
    const recentAvg = avgOf(sorted.slice(mid).map((p) => p.pct));
    const diff = recentAvg - olderAvg;
    if (diff > 5) return 'up';
    if (diff < -5) return 'down';
    return 'stable';
  };

  return Array.from(bySubject.values()).map((s) => ({
    subjectId: s.subjectId,
    subjectName: subjMap.get(s.subjectId) || 'Unknown',
    avgPct: s.count > 0 ? Math.round((s.sum / s.count) * 10) / 10 : 0,
    attempts: s.count,
    testCount: s.tests.size,
    trend: trendOf(s.pcts),
  })).sort((a, b) => b.avgPct - a.avgPct);
}

function avgOf(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Status mix (distinction / first / second / pass / fail)
// ────────────────────────────────────────────────────────────────────────────
const BANDS = [
  { key: 'distinction', label: 'Distinction', min: 75, max: 100,    color: '#10b981' },
  { key: 'first',       label: 'First class', min: 60, max: 74.99,  color: '#3b82f6' },
  { key: 'second',      label: 'Second class',min: 45, max: 59.99,  color: '#f59e0b' },
  { key: 'pass',        label: 'Pass',        min: 33, max: 44.99,  color: '#a855f7' },
  { key: 'fail',        label: 'Fail',        min: 0,  max: 32.99,  color: '#ef4444' },
];

export async function getStatusMix({ schoolCode, ayId, classInstanceId, subjectId, studentId }) {
  if (!schoolCode || !ayId) return [];
  const { tests } = await fetchTestsInScope({ schoolCode, ayId, classInstanceId, subjectId });
  if (tests.length === 0) return [];
  let scores = await fetchScoresForTests(tests.map((t) => t.id));
  if (studentId) scores = scores.filter((s) => s.studentId === studentId);
  if (scores.length === 0) return [];
  const total = scores.length;
  return BANDS.map((b) => {
    const value = scores.filter((s) => s.pct >= b.min && s.pct <= b.max).length;
    return { ...b, value, percent: Math.round((value / total) * 1000) / 10 };
  }).filter((b) => b.value > 0);
}

// ────────────────────────────────────────────────────────────────────────────
// 6. Top performers + chronic strugglers
// ────────────────────────────────────────────────────────────────────────────
export async function getStudentLeaderboard({ schoolCode, ayId, classInstanceId, subjectId, limit = 10 }) {
  if (!schoolCode || !ayId) return { top: [], bottom: [] };
  const { tests } = await fetchTestsInScope({ schoolCode, ayId, classInstanceId, subjectId });
  if (tests.length === 0) return { top: [], bottom: [] };
  const scores = await fetchScoresForTests(tests.map((t) => t.id));

  const byStudent = new Map();
  scores.forEach((s) => {
    const m = byStudent.get(s.studentId) || { studentId: s.studentId, sum: 0, count: 0 };
    m.sum += s.pct;
    m.count += 1;
    byStudent.set(s.studentId, m);
  });

  const studentIds = Array.from(byStudent.keys());
  if (studentIds.length === 0) return { top: [], bottom: [] };
  const { data: students } = await supabase
    .from('student')
    .select('id, full_name, student_code, class_instance_id, class_instances:class_instance_id (id, grade, section)')
    .in('id', studentIds);
  const stMap = new Map((students || []).map((s) => [s.id, s]));

  const rows = Array.from(byStudent.values())
    .filter((r) => r.count >= 1)
    .map((r) => {
      const st = stMap.get(r.studentId);
      const ci = st?.class_instances;
      return {
        studentId: r.studentId,
        name: st?.full_name || 'Student',
        code: st?.student_code || '',
        classLabel: ci ? `Grade ${ci.grade}${ci.section ? ` ${ci.section}` : ''}` : '—',
        avgPct: Math.round((r.sum / r.count) * 10) / 10,
        attempts: r.count,
      };
    });

  return {
    top: [...rows].sort((a, b) => b.avgPct - a.avgPct).slice(0, limit),
    bottom: [...rows].sort((a, b) => a.avgPct - b.avgPct).slice(0, limit),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 7. Recent tests (student scope) — mirrors mobile recent_tests shape.
// ────────────────────────────────────────────────────────────────────────────
export async function getRecentTestsForStudent({ schoolCode, ayId, studentId, classInstanceId, subjectId, limit = 12 }) {
  if (!schoolCode || !ayId || !studentId) return [];
  const { tests } = await fetchTestsInScope({ schoolCode, ayId, classInstanceId, subjectId });
  if (tests.length === 0) return [];
  const scores = (await fetchScoresForTests(tests.map((t) => t.id)))
    .filter((s) => s.studentId === studentId);
  if (scores.length === 0) return [];

  const subjectIds = Array.from(new Set(tests.map((t) => t.subject_id).filter(Boolean)));
  const { data: subjRows } = subjectIds.length > 0 ? await supabase
    .from('subjects')
    .select('id, subject_name')
    .in('id', subjectIds) : { data: [] };
  const subjMap = new Map((subjRows || []).map((s) => [s.id, s.subject_name]));
  const testById = new Map(tests.map((t) => [t.id, t]));

  return scores
    .map((s) => {
      const t = testById.get(s.testId);
      const date = s.completedAt || t?.test_date;
      return {
        id: s.testId,
        title: t?.title || 'Test',
        date,
        subjectName: subjMap.get(t?.subject_id) || 'Unknown',
        marksObtained: s.marksObtained,
        maxMarks: s.maxMarks,
        percentage: Math.round(s.pct * 10) / 10,
        mode: s.mode,
        grade: gradeFor(s.pct),
      };
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, limit);
}

// ────────────────────────────────────────────────────────────────────────────
// 8. Subject × student matrix (class scope)
// ────────────────────────────────────────────────────────────────────────────
export async function getStudentSubjectMatrix({ schoolCode, ayId, classInstanceId, limit = 30 }) {
  if (!schoolCode || !ayId || !classInstanceId || classInstanceId === 'all') {
    return { rows: [], subjects: [] };
  }
  const { tests } = await fetchTestsInScope({ schoolCode, ayId, classInstanceId, subjectId: null });
  if (tests.length === 0) return { rows: [], subjects: [] };
  const scores = await fetchScoresForTests(tests.map((t) => t.id));

  const subjectIds = Array.from(new Set(tests.map((t) => t.subject_id).filter(Boolean)));
  const studentIds = Array.from(new Set(scores.map((s) => s.studentId)));

  const [subjRows, studentRows] = await Promise.all([
    subjectIds.length > 0
      ? supabase.from('subjects').select('id, subject_name').in('id', subjectIds).then((r) => r.data || [])
      : Promise.resolve([]),
    studentIds.length > 0
      ? supabase.from('student').select('id, full_name, student_code').in('id', studentIds).then((r) => r.data || [])
      : Promise.resolve([]),
  ]);
  const subjMap = new Map(subjRows.map((s) => [s.id, s.subject_name]));
  const stMap = new Map(studentRows.map((s) => [s.id, s]));
  const testSubjById = new Map(tests.map((t) => [t.id, t.subject_id]));

  const cellSums = new Map(); // `${studentId}|${subjectId}` -> { sum, count }
  scores.forEach((s) => {
    const subId = testSubjById.get(s.testId);
    if (!subId) return;
    const k = `${s.studentId}|${subId}`;
    const m = cellSums.get(k) || { sum: 0, count: 0 };
    m.sum += s.pct;
    m.count += 1;
    cellSums.set(k, m);
  });

  const rows = studentIds.map((sid) => {
    const meta = stMap.get(sid);
    const row = { studentId: sid, name: meta?.full_name || '—', code: meta?.student_code || '' };
    let total = 0; let count = 0;
    subjectIds.forEach((subId) => {
      const c = cellSums.get(`${sid}|${subId}`);
      if (c && c.count > 0) {
        const avg = Math.round((c.sum / c.count) * 10) / 10;
        row[subId] = avg;
        total += avg; count += 1;
      } else {
        row[subId] = null;
      }
    });
    row.overall = count > 0 ? Math.round((total / count) * 10) / 10 : null;
    return row;
  })
    .sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1))
    .slice(0, limit);

  return {
    rows,
    subjects: subjectIds.map((id) => ({ id, name: subjMap.get(id) || 'Unknown' })),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
export function gradeFor(pct) {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
}

export const STATUS_BANDS = BANDS;

export default {
  getHeadlineKpis,
  getDailyTrend,
  getPerClassSummary,
  getPerSubjectSummary,
  getStatusMix,
  getStudentLeaderboard,
  getRecentTestsForStudent,
  getStudentSubjectMatrix,
  STATUS_BANDS,
  gradeFor,
};
