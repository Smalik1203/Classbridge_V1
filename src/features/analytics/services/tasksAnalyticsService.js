// src/features/analytics/services/tasksAnalyticsService.js
//
// Tasks analytics queries — every call goes through a server-side RPC.
// No raw .from() aggregation here (silent 1000-row truncation + multi-row inflation risk).
//
// Scoping: AY-direct via tasks.academic_year_id (populated 100% of rows).
// KPI / distribution queries are AY-bounded.
// Trend query is calendar-windowed (caller passes start/end).
//
// Completion definition: status IN ('submitted','graded').
// On-time: (submitted_at IST)::date <= due_date.
// Missed:  no submission AND due_date < today.
// Denominator: current class roster (student.class_instance_id = task.class_instance_id).

import { supabase } from '@/config/supabaseClient';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { getAyDateRange } from './ayScope';

dayjs.extend(utc);
dayjs.extend(timezone);

const IST = 'Asia/Kolkata';
const fmt = (d) => dayjs(d).tz(IST).format('YYYY-MM-DD');

async function resolveDateRange({ ayId, startDate, endDate }) {
  if (startDate && endDate) return { start: fmt(startDate), end: fmt(endDate) };
  if (ayId) {
    const r = await getAyDateRange(ayId);
    if (r?.start && r?.end) return { start: r.start, end: r.end };
  }
  const today = dayjs().tz(IST);
  return { start: today.subtract(29, 'day').format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Headline KPIs (AY-bounded)
// ─────────────────────────────────────────────────────────────────────────────
export async function getHeadlineKpis({ schoolCode, ayId, classInstanceId }) {
  const empty = {
    totalTasks: 0, expectedSubmissions: 0, submittedCount: 0,
    completionRate: 0, onTimeRate: 0, lateCount: 0, missedCount: 0,
    overdueTaskCount: 0, distinctStudents: 0, activeStudents: 0,
  };
  if (!schoolCode || !ayId) return empty;

  const { data, error } = await supabase.rpc('tasks_headline_kpis', {
    p_school_code: schoolCode,
    p_ay_id: ayId,
    p_class_instance_id: classInstanceId && classInstanceId !== 'all' ? classInstanceId : null,
  });
  if (error) throw error;
  const r = (data && data[0]) || {};
  return {
    totalTasks:          Number(r.total_tasks || 0),
    expectedSubmissions: Number(r.expected_submissions || 0),
    submittedCount:      Number(r.submitted_count || 0),
    completionRate:      r.completion_rate != null ? Number(r.completion_rate) : 0,
    onTimeRate:          r.on_time_rate != null ? Number(r.on_time_rate) : 0,
    lateCount:           Number(r.late_count || 0),
    missedCount:         Number(r.missed_count || 0),
    overdueTaskCount:    Number(r.overdue_task_count || 0),
    distinctStudents:    Number(r.distinct_students || 0),
    activeStudents:      Number(r.active_students || 0),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Daily submissions trend (calendar-windowed, zero-filled)
// ─────────────────────────────────────────────────────────────────────────────
export async function getDailySubmissions({ schoolCode, ayId, classInstanceId, startDate, endDate }) {
  if (!schoolCode) return [];
  const { start, end } = await resolveDateRange({ ayId, startDate, endDate });

  const { data, error } = await supabase.rpc('tasks_daily_submissions', {
    p_school_code: schoolCode,
    p_start: start,
    p_end: end,
    p_ay_id: ayId || null,
    p_class_instance_id: classInstanceId && classInstanceId !== 'all' ? classInstanceId : null,
  });
  if (error) throw error;

  // Zero-fill every day in [start, end]
  const map = new Map((data || []).map((r) => [r.d, r]));
  const days = [];
  let cur = dayjs(start);
  const last = dayjs(end);
  while (cur.isBefore(last) || cur.isSame(last, 'day')) {
    const k = cur.format('YYYY-MM-DD');
    const hit = map.get(k);
    days.push({
      date: k,
      submissionCount: hit ? Number(hit.submission_count || 0) : 0,
      onTimeCount:     hit ? Number(hit.on_time_count || 0) : 0,
      lateCount:       hit ? Number(hit.late_count || 0) : 0,
      noData:          !hit,
    });
    cur = cur.add(1, 'day');
  }
  return days;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Per-class completion summary (school scope)
// ─────────────────────────────────────────────────────────────────────────────
export async function getPerClassSummary({ schoolCode, ayId }) {
  if (!schoolCode || !ayId) return [];
  const { data, error } = await supabase.rpc('tasks_per_class_summary', {
    p_school_code: schoolCode,
    p_ay_id: ayId,
  });
  if (error) throw error;
  return (data || []).map((r) => ({
    classInstanceId: r.class_instance_id,
    label: r.grade != null ? `Grade ${r.grade}${r.section ? ` ${r.section}` : ''}` : 'Unknown',
    taskCount:       Number(r.task_count || 0),
    rosterCount:     Number(r.roster_count || 0),
    expected:        Number(r.expected || 0),
    submittedCount:  Number(r.submitted_count || 0),
    completionRate:  r.completion_rate != null ? Number(r.completion_rate) : 0,
    onTimeRate:      r.on_time_rate != null ? Number(r.on_time_rate) : 0,
    missedCount:     Number(r.missed_count || 0),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Per-subject completion summary
// ─────────────────────────────────────────────────────────────────────────────
export async function getPerSubjectSummary({ schoolCode, ayId, classInstanceId }) {
  if (!schoolCode || !ayId) return [];
  const { data, error } = await supabase.rpc('tasks_per_subject_summary', {
    p_school_code: schoolCode,
    p_ay_id: ayId,
    p_class_instance_id: classInstanceId && classInstanceId !== 'all' ? classInstanceId : null,
  });
  if (error) throw error;
  return (data || []).map((r) => ({
    subjectId:      r.subject_id,
    subjectName:    r.subject_name || '(No subject)',
    taskCount:      Number(r.task_count || 0),
    expected:       Number(r.expected || 0),
    submittedCount: Number(r.submitted_count || 0),
    completionRate: r.completion_rate != null ? Number(r.completion_rate) : 0,
    onTimeRate:     r.on_time_rate != null ? Number(r.on_time_rate) : 0,
    missedCount:    Number(r.missed_count || 0),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. On-time / late / missed distribution
// ─────────────────────────────────────────────────────────────────────────────
const DIST_META = {
  on_time: { label: 'On time',  color: '#10b981' },
  late:    { label: 'Late',     color: '#f59e0b' },
  missed:  { label: 'Missed',   color: '#ef4444' },
};

export async function getDistributions({ schoolCode, ayId, classInstanceId }) {
  if (!schoolCode || !ayId) return [];
  const { data, error } = await supabase.rpc('tasks_distributions', {
    p_school_code: schoolCode,
    p_ay_id: ayId,
    p_class_instance_id: classInstanceId && classInstanceId !== 'all' ? classInstanceId : null,
  });
  if (error) throw error;
  return (data || []).map((r) => ({
    segment: r.segment,
    label:   DIST_META[r.segment]?.label || r.segment,
    color:   DIST_META[r.segment]?.color || '#94a3b8',
    count:   Number(r.count || 0),
    percent: Number(r.percent || 0),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Top non-submitters (student leaderboard)
// ─────────────────────────────────────────────────────────────────────────────
export async function getTopNonSubmitters({ schoolCode, ayId, classInstanceId, limit = 20 }) {
  if (!schoolCode || !ayId) return [];
  const { data, error } = await supabase.rpc('tasks_top_non_submitters', {
    p_school_code: schoolCode,
    p_ay_id: ayId,
    p_class_instance_id: classInstanceId && classInstanceId !== 'all' ? classInstanceId : null,
    p_limit: limit,
  });
  if (error) throw error;
  return (data || []).map((r) => ({
    studentId:      r.student_id,
    name:           r.full_name || 'Student',
    code:           r.student_code,
    classLabel:     r.grade != null ? `Grade ${r.grade}${r.section ? ` ${r.section}` : ''}` : '—',
    assignedCount:  Number(r.assigned_count || 0),
    submittedCount: Number(r.submitted_count || 0),
    missedCount:    Number(r.missed_count || 0),
    onTimeCount:    Number(r.on_time_count || 0),
    onTimeRate:     Number(r.on_time_rate || 0),
  }));
}

export default {
  getHeadlineKpis,
  getDailySubmissions,
  getPerClassSummary,
  getPerSubjectSummary,
  getDistributions,
  getTopNonSubmitters,
};
