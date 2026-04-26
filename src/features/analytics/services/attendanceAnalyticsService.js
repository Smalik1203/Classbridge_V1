// src/features/analytics/services/attendanceAnalyticsService.js
//
// Attendance analytics queries.
//
// Almost everything goes through server-side RPCs that do per-student-per-day
// rollup before aggregating. This avoids two coupled bugs we found in the
// client-side aggregator approach:
//   1. period rows inflated counts (a student with 7 periods looked like 7
//      attendance entries),
//   2. Supabase's 1000-row default limit silently truncated big AYs.
//
// All RPCs share the same status-priority rule: late > present > absent
// > leave > holiday. Rate = (students_present + students_late) / students_marked
// where students_marked excludes holiday.

import { supabase } from '@/config/supabaseClient';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { getClassInstanceIdsForAy, getAyDateRange } from './ayScope';

dayjs.extend(utc);
dayjs.extend(timezone);

const IST = 'Asia/Kolkata';

// Always format dates in IST so web & mobile produce identical YYYY-MM-DD
// for the same moment in time. Mobile is hard-coded to IST.
const fmt = (d) => dayjs(d).tz(IST).format('YYYY-MM-DD');

// ────────────────────────────────────────────────────────────────────────────
// Date range to apply: caller-provided OR full AY range OR last 60 days.
// ────────────────────────────────────────────────────────────────────────────
async function resolveDateRange({ ayId, startDate, endDate }) {
  if (startDate && endDate) return { start: fmt(startDate), end: fmt(endDate) };
  if (ayId) {
    const r = await getAyDateRange(ayId);
    if (r?.start && r?.end) return { start: r.start, end: r.end };
  }
  const today = dayjs().tz(IST);
  return { start: today.subtract(60, 'day').format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') };
}

// ────────────────────────────────────────────────────────────────────────────
// 1. Daily attendance trend.
// Calendar-anchored — fetches across AY boundaries when needed.
// ────────────────────────────────────────────────────────────────────────────
export async function getDailyAttendanceTrend({ schoolCode, classInstanceId, studentId, startDate, endDate, ayId }) {
  if (!schoolCode) return [];
  const { start, end } = await resolveDateRange({ ayId, startDate, endDate });

  const { data, error } = await supabase.rpc('attendance_daily_summary', {
    p_school_code: schoolCode,
    p_start: start,
    p_end: end,
    p_class_instance_id: classInstanceId && classInstanceId !== 'all' ? classInstanceId : null,
    p_student_id: studentId || null,
  });
  if (error) throw error;

  const rows = (data || []).map((r) => {
    const present = Number(r.students_present || 0);
    const absent = Number(r.students_absent || 0);
    const late = Number(r.students_late || 0);
    const holiday = Number(r.students_holiday || 0);
    const leave = Number(r.students_leave || 0);
    const marked = Number(r.students_marked || 0);
    const total = marked + holiday;
    return {
      date: r.date,
      present, absent, late, holiday, leave, total,
      rate: marked ? Math.round(((present + late) / marked) * 1000) / 10 : null,
    };
  });
  return fillGapsAndFlagNoData(rows, start, end);
}

function fillGapsAndFlagNoData(rows, start, end) {
  const map = new Map(rows.map((r) => [r.date, r]));
  const days = [];
  let cur = dayjs(start);
  const last = dayjs(end);
  while (cur.isBefore(last) || cur.isSame(last, 'day')) {
    const k = cur.format('YYYY-MM-DD');
    const hit = map.get(k);
    if (hit) {
      days.push({ ...hit, noData: hit.rate == null });
    } else {
      days.push({
        date: k, present: 0, absent: 0, late: 0, holiday: 0, leave: 0, total: 0,
        rate: null, noData: true,
      });
    }
    cur = cur.add(1, 'day');
  }
  return days;
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Per-class attendance summary — RPC, deduped per-student-per-day.
// ────────────────────────────────────────────────────────────────────────────
export async function getPerClassSummary({ schoolCode, ayId, startDate, endDate }) {
  if (!schoolCode || !ayId) return [];
  const { start, end } = await resolveDateRange({ ayId, startDate, endDate });

  const { data, error } = await supabase.rpc('attendance_per_class_summary', {
    p_school_code: schoolCode,
    p_ay_id: ayId,
    p_start: start,
    p_end: end,
  });
  if (error) throw error;

  return (data || []).map((r) => ({
    classInstanceId: r.class_instance_id,
    label: `Grade ${r.grade}${r.section ? ` ${r.section}` : ''}`,
    present: Number(r.students_present || 0),
    absent: Number(r.students_absent || 0),
    late: Number(r.students_late || 0),
    holiday: Number(r.students_holiday || 0),
    leave: Number(r.students_leave || 0),
    total: Number(r.students_marked || 0),
    rate: r.rate_pct != null ? Number(r.rate_pct) : 0,
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Top absentees — RPC, deduped, joined with student + class.
// ────────────────────────────────────────────────────────────────────────────
export async function getTopAbsentees({ schoolCode, ayId, classInstanceId, startDate, endDate, limit = 20 }) {
  if (!schoolCode || !ayId) return [];
  const { start, end } = await resolveDateRange({ ayId, startDate, endDate });

  const { data, error } = await supabase.rpc('attendance_top_absentees', {
    p_school_code: schoolCode,
    p_ay_id: ayId,
    p_start: start,
    p_end: end,
    p_class_instance_id: classInstanceId && classInstanceId !== 'all' ? classInstanceId : null,
    p_limit: limit,
  });
  if (error) throw error;

  return (data || []).map((r) => ({
    studentId: r.student_id,
    name: r.full_name || 'Student',
    code: r.student_code,
    classLabel: r.grade ? `Grade ${r.grade}${r.section ? ` ${r.section}` : ''}` : '',
    absences: Number(r.absences || 0),
    present: Number(r.present_days || 0),
    total: Number(r.total_days || 0),
    rate: r.rate_pct != null ? Number(r.rate_pct) : 0,
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Status distribution — RPC, deduped.
// ────────────────────────────────────────────────────────────────────────────
export async function getStatusDistribution({ schoolCode, ayId, classInstanceId, studentId, startDate, endDate }) {
  if (!schoolCode || !ayId) return [];
  const { start, end } = await resolveDateRange({ ayId, startDate, endDate });

  const { data, error } = await supabase.rpc('attendance_status_distribution', {
    p_school_code: schoolCode,
    p_ay_id: ayId,
    p_start: start,
    p_end: end,
    p_class_instance_id: classInstanceId && classInstanceId !== 'all' ? classInstanceId : null,
    p_student_id: studentId || null,
  });
  if (error) throw error;

  // RPC returns a single row — re-shape into the donut format.
  const row = (data && data[0]) || {};
  const total = Number(row.students_total || 0) || 1;
  const buckets = [
    { key: 'present', label: 'Present', value: Number(row.students_present || 0), color: '#10b981' },
    { key: 'late',    label: 'Late',    value: Number(row.students_late    || 0), color: '#f59e0b' },
    { key: 'absent',  label: 'Absent',  value: Number(row.students_absent  || 0), color: '#ef4444' },
    { key: 'leave',   label: 'Leave',   value: Number(row.students_leave   || 0), color: '#3b82f6' },
    { key: 'holiday', label: 'Holiday', value: Number(row.students_holiday || 0), color: '#a855f7' },
  ];
  return buckets
    .filter((b) => b.value > 0)
    .map((b) => ({ ...b, percent: Math.round((b.value / total) * 1000) / 10 }));
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Period-level attendance heatmap (subject × day-of-week).
// period_attendance still has no direct AY column — scope via class_instance_id.
// Caller is expected to keep the date range modest (one AY).
// ────────────────────────────────────────────────────────────────────────────
export async function getPeriodHeatmap({ schoolCode, ayId, classInstanceId, startDate, endDate }) {
  if (!schoolCode || !ayId) return { rows: [], subjects: [], days: [] };
  const classIds = (classInstanceId && classInstanceId !== 'all')
    ? [classInstanceId]
    : await getClassInstanceIdsForAy(schoolCode, ayId);
  if (classIds.length === 0) return { rows: [], subjects: [], days: [] };
  const { start, end } = await resolveDateRange({ ayId, startDate, endDate });

  // We page through to defeat the 1000-row default. Period rows tend to
  // be voluminous (one row per student per period per day).
  const PAGE = 1000;
  let from = 0;
  let allRows = [];
  while (true) {
    const { data, error } = await supabase
      .from('period_attendance')
      .select(`
        id, status, date, subject_id, class_instance_id,
        subjects:subject_id (id, name)
      `)
      .gte('date', start).lte('date', end)
      .in('class_instance_id', classIds)
      .range(from, from + PAGE - 1);
    if (error && error.code !== 'PGRST116') {
      return { rows: [], subjects: [], days: [], unavailable: true };
    }
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
    if (from > 50000) break; // hard guard
  }

  const cell = new Map();
  const subjects = new Map();
  allRows.forEach((r) => {
    const sId = r.subject_id;
    if (!sId) return;
    const sName = r.subjects?.name || 'Unknown';
    subjects.set(sId, sName);
    const dow = dayjs(r.date).day();
    const key = `${sId}|${dow}`;
    const m = cell.get(key) || { subjectId: sId, subjectName: sName, day: dow, present: 0, absent: 0, total: 0 };
    m.total += 1;
    const s = (r.status || '').toLowerCase();
    if (s === 'present' || s === 'late') m.present += 1;
    else if (s === 'absent') m.absent += 1;
    cell.set(key, m);
  });
  return {
    subjects: Array.from(subjects.entries()).map(([id, name]) => ({ id, name })),
    days: [0, 1, 2, 3, 4, 5, 6],
    rows: Array.from(cell.values()).map((m) => ({
      ...m,
      rate: m.total ? Math.round((m.present / m.total) * 1000) / 10 : 0,
    })),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 6. Monthly heatmap (calendar grid). Reuses attendance_daily_summary so
//    each student counts ONCE per day; rate is the school/class/student-day
//    rate for that calendar day.
// ────────────────────────────────────────────────────────────────────────────
export async function getMonthlyCalendar({ schoolCode, ayId, classInstanceId, studentId, startDate, endDate }) {
  if (!schoolCode || !ayId) return [];
  const { start, end } = await resolveDateRange({ ayId, startDate, endDate });

  const { data, error } = await supabase.rpc('attendance_daily_summary', {
    p_school_code: schoolCode,
    p_start: start,
    p_end: end,
    p_class_instance_id: classInstanceId && classInstanceId !== 'all' ? classInstanceId : null,
    p_student_id: studentId || null,
  });
  if (error) throw error;

  return (data || []).map((r) => {
    const d = dayjs(r.date);
    const present = Number(r.students_present || 0);
    const late = Number(r.students_late || 0);
    const absent = Number(r.students_absent || 0);
    const marked = Number(r.students_marked || 0);
    return {
      date: r.date,
      year: d.year(), month: d.month() + 1, day: d.date(),
      present, absent, total: marked,
      rate: marked ? Math.round(((present + late) / marked) * 1000) / 10 : null,
    };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 7. Staff attendance summary. Path: ay-direct (staff_attendance).
// ────────────────────────────────────────────────────────────────────────────
export async function getStaffAttendanceSummary({ schoolCode, ayId, startDate, endDate }) {
  if (!schoolCode || !ayId) return [];
  // Page to defeat 1000-row default.
  const PAGE = 1000;
  let from = 0;
  let allRows = [];
  while (true) {
    let q = supabase
      .from('staff_attendance')
      .select(`
        id, employee_id, status, date, in_time, out_time, late_minutes,
        academic_year_id, school_code,
        employees:employee_id (id, full_name, department, designation)
      `)
      .eq('school_code', schoolCode)
      .eq('academic_year_id', ayId)
      .range(from, from + PAGE - 1);
    if (startDate) q = q.gte('date', startDate);
    if (endDate)   q = q.lte('date', endDate);
    const { data, error } = await q;
    if (error) {
      console.warn('[attendance] staff_attendance query error', error);
      return [];
    }
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
    if (from > 100000) break;
  }
  const byEmp = new Map();
  allRows.forEach((r) => {
    const e = byEmp.get(r.employee_id) || {
      employee_id: r.employee_id,
      full_name: r.employees?.full_name,
      department: r.employees?.department,
      designation: r.employees?.designation,
      present_days: 0, absent_days: 0, half_day_count: 0, leave_days: 0,
      late_count: 0, total_marked: 0,
    };
    const s = (r.status || '').toLowerCase();
    e.total_marked += 1;
    if (s === 'present') e.present_days += 1;
    else if (s === 'absent') e.absent_days += 1;
    else if (s === 'half_day' || s === 'halfday') { e.half_day_count += 1; e.present_days += 0.5; }
    else if (s === 'on_leave' || s === 'leave') e.leave_days += 1;
    else if (s === 'late') { e.late_count += 1; e.present_days += 1; }
    byEmp.set(r.employee_id, e);
  });
  return Array.from(byEmp.values()).map((e) => ({
    ...e,
    attendance_pct: e.total_marked
      ? Math.round((e.present_days / (e.total_marked - e.leave_days || e.total_marked)) * 1000) / 10
      : null,
  })).sort((a, b) => (b.attendance_pct ?? 0) - (a.attendance_pct ?? 0));
}

// ────────────────────────────────────────────────────────────────────────────
// 8. Headline KPIs — RPC, deduped, correctly named.
//    Returned shape:
//      rate          — % student-days present (excluding holiday)
//      presentDays   — student-days present + late
//      absentDays    — student-days absent
//      totalMarked   — student-days marked (excludes holiday)
//      distinctStudents
//      distinctDays
// ────────────────────────────────────────────────────────────────────────────
export async function getHeadlineKpis({ schoolCode, ayId, classInstanceId, studentId, startDate, endDate }) {
  if (!schoolCode || !ayId) {
    return { rate: 0, presentDays: 0, absentDays: 0, totalMarked: 0, distinctStudents: 0, distinctDays: 0 };
  }
  const { start, end } = await resolveDateRange({ ayId, startDate, endDate });

  const { data, error } = await supabase.rpc('attendance_headline_kpis', {
    p_school_code: schoolCode,
    p_ay_id: ayId,
    p_start: start,
    p_end: end,
    p_class_instance_id: classInstanceId && classInstanceId !== 'all' ? classInstanceId : null,
    p_student_id: studentId || null,
  });
  if (error) throw error;
  const row = (data && data[0]) || {};
  return {
    rate: row.rate_pct != null ? Number(row.rate_pct) : 0,
    presentDays: Number(row.present_days || 0),
    absentDays: Number(row.absent_days || 0),
    totalMarked: Number(row.total_marked || 0),
    distinctStudents: Number(row.distinct_students || 0),
    distinctDays: Number(row.distinct_days || 0),
  };
}

export default {
  getDailyAttendanceTrend,
  getPerClassSummary,
  getTopAbsentees,
  getStatusDistribution,
  getPeriodHeatmap,
  getMonthlyCalendar,
  getStaffAttendanceSummary,
  getHeadlineKpis,
};
