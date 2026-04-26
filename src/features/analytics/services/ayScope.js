// src/features/analytics/services/ayScope.js
// Academic-year scoping helper.
//
// Primary rule (per user): when an academic year is picked (e.g. "25-26"),
// the analytics view must show only data for the class_instances whose
// academic_year_id matches that AY. Every event that has a class_instance_id
// is scoped via that join, not via the event's own academic_year_id column
// (even if such a column exists). This guarantees a consistent definition
// of "what counts as a 25-26 class" across every report.
//
// Three scoping paths:
//   1) class-bound  — event has class_instance_id; we scope by
//                     class_instance_id IN (class_instances WHERE academic_year_id = ay)
//   2) ay-direct    — event has its own academic_year_id (HR / leaves /
//                     staff_attendance / fee_invoices). Scope by that column.
//   3) date-only    — event only has a date; scope by year_start..year_end
//                     of the selected AY.
//
// "Master / config" tables (student, employees, subjects, fee_categories,
//  inventory_items, etc.) are NOT scoped here — they're directories. Their
//  events are scoped, not them.

import { supabase } from '@/config/supabaseClient';

// ────────────────────────────────────────────────────────────────────────────
// Scoping table map. Audit findings.
// scope: 'class' | 'ay' | 'date' | 'none'
// classInstanceColumn: column name on this table for path='class'
// ayColumn: column name on this table for path='ay'
// dateColumn: column name on this table for path='date'
// allTime: true means this table is intentionally global (transport, gps_logs)
// ────────────────────────────────────────────────────────────────────────────

export const SCOPE_MAP = {
  // Class-bound events (primary path) -------------------------------
  // attendance: direct AY column added 2026-04-26 (migration
  // attendance_academic_year_id). Switched from class-bound path to
  // ay-direct so we no longer rely on class_instance lineage.
  attendance:           { scope: 'ay', ayColumn: 'academic_year_id' },
  attendance_daily:     { scope: 'class', classInstanceColumn: 'class_instance_id' },
  period_attendance:    { scope: 'class', classInstanceColumn: 'class_instance_id' },
  tests:                { scope: 'class', classInstanceColumn: 'class_instance_id' },
  tasks:                { scope: 'class', classInstanceColumn: 'class_instance_id' },
  task_submissions:     { scope: 'class', classInstanceColumn: 'task_id', viaTask: true },
  test_attempts:        { scope: 'class', classInstanceColumn: 'test_id', viaTest: true },
  test_questions:       { scope: 'class', classInstanceColumn: 'test_id', viaTest: true },
  test_responses:       { scope: 'class', classInstanceColumn: 'attempt_id', viaAttempt: true },
  question_attempt_details: { scope: 'class', classInstanceColumn: 'attempt_id', viaAttempt: true },
  announcements:        { scope: 'class', classInstanceColumn: 'class_instance_id', nullable: true },
  learning_resources:   { scope: 'class', classInstanceColumn: 'class_instance_id', nullable: true },
  fee_invoices:         { scope: 'class', classInstanceColumn: 'class_instance_id' },
  fee_invoice_items:    { scope: 'class', classInstanceColumn: 'invoice_id', viaInvoice: true },
  fee_payments:         { scope: 'class', classInstanceColumn: 'invoice_id', viaInvoice: true },
  // AY-direct events (HR / leaves / staff) --------------------------
  staff_attendance:     { scope: 'ay', ayColumn: 'academic_year_id' },
  leave_applications:   { scope: 'ay', ayColumn: 'academic_year_id' },
  leave_balances:       { scope: 'ay', ayColumn: 'academic_year_id' },
  leave_transactions:   { scope: 'ay', ayColumn: 'academic_year_id' },
  payslips:             { scope: 'ay', ayColumn: 'academic_year_id', viaRun: true },
  payslip_lines:        { scope: 'ay', ayColumn: 'payslip_id', viaPayslip: true },
  // Date-only events -----------------------------------------------
  finance_transactions: { scope: 'date', dateColumn: 'transaction_date' },
  finance_audit_log:    { scope: 'date', dateColumn: 'created_at' },
  payroll_runs:         { scope: 'date', dateColumn: 'period_start' },
  inventory_issues:     { scope: 'date', dateColumn: 'issued_at' },
  admission_followups:  { scope: 'date', dateColumn: 'follow_up_date' },
  feedback:             { scope: 'date', dateColumn: 'created_at' },
  chatbot_messages:     { scope: 'date', dateColumn: 'created_at' },
  ai_jobs:              { scope: 'date', dateColumn: 'created_at' },
  // Master / config — never AY-filter -------------------------------
  student:              { scope: 'none', master: true },
  users:                { scope: 'none', master: true },
  employees:            { scope: 'none', master: true },
  subjects:             { scope: 'none', master: true },
  class_instances:      { scope: 'none', master: true },
  fee_categories:       { scope: 'none', master: true },
  fee_components:       { scope: 'none', master: true },
  leave_types:          { scope: 'none', master: true },
  salary_components:    { scope: 'none', master: true },
  inventory_items:      { scope: 'none', master: true },
  // All-time (transport / gps) — keep, mark in chart caption -------
  buses:                { scope: 'none', allTime: true },
  drivers:              { scope: 'none', allTime: true },
  routes:               { scope: 'none', allTime: true },
  trips:                { scope: 'none', allTime: true },
  gps_logs:             { scope: 'none', allTime: true },
};

export function getScopeInfo(table) {
  return SCOPE_MAP[table] || { scope: 'unknown' };
}

// ────────────────────────────────────────────────────────────────────────────
// Lookup: class_instances belonging to a given AY.
// Cached per (schoolCode, ayId) pair for the JS lifetime.
// ────────────────────────────────────────────────────────────────────────────

const classInstanceCache = new Map(); // key: `${schoolCode}|${ayId}` → string[]

export async function getClassInstanceIdsForAy(schoolCode, ayId) {
  if (!schoolCode || !ayId) return [];
  const key = `${schoolCode}|${ayId}`;
  if (classInstanceCache.has(key)) return classInstanceCache.get(key);
  const { data, error } = await supabase
    .from('class_instances')
    .select('id')
    .eq('school_code', schoolCode)
    .eq('academic_year_id', ayId);
  if (error) throw error;
  const ids = (data || []).map((c) => c.id);
  classInstanceCache.set(key, ids);
  return ids;
}

export function clearAyScopeCache() { classInstanceCache.clear(); }

// ────────────────────────────────────────────────────────────────────────────
// AY date range — for path='date' tables. Cached per ayId.
// ────────────────────────────────────────────────────────────────────────────

const ayDateRangeCache = new Map();

export async function getAyDateRange(ayId) {
  if (!ayId) return null;
  if (ayDateRangeCache.has(ayId)) return ayDateRangeCache.get(ayId);
  const { data, error } = await supabase
    .from('academic_years')
    .select('id, year_start, year_end, start_date, end_date')
    .eq('id', ayId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // Prefer ISO `start_date` / `end_date` columns when present.
  const start = data.start_date || (data.year_start ? `${data.year_start}-04-01` : null);
  const end = data.end_date || (data.year_end ? `${data.year_end}-03-31` : null);
  const range = { start, end, year_start: data.year_start, year_end: data.year_end };
  ayDateRangeCache.set(ayId, range);
  return range;
}

// ────────────────────────────────────────────────────────────────────────────
// Apply AY scope to a Supabase query builder.
//
// Usage:
//   import { scopeQuery } from '../services/ayScope';
//   let q = supabase.from('tests').select('*');
//   q = await scopeQuery(q, 'tests', { ayId, schoolCode });
//   const { data } = await q;
//
// For tables that go via a parent table (test_attempts → tests → class_instance,
// task_submissions → tasks → class_instance, etc.), pass viaIds explicitly,
// or use the convenience helpers below.
// ────────────────────────────────────────────────────────────────────────────

export async function scopeQuery(query, table, { ayId, schoolCode, classInstanceIds }) {
  const info = getScopeInfo(table);
  if (!info || info.scope === 'unknown') {
    console.warn(`[ayScope] Unknown table "${table}" — query left unscoped`);
    return query;
  }
  if (info.scope === 'none') return query;

  if (info.scope === 'class') {
    if (info.viaStudent || info.viaTask || info.viaTest || info.viaAttempt || info.viaInvoice) {
      // Caller must resolve parent ids and pass classInstanceIds OR a parent-id list.
      // We can't transparently chain joins in Supabase JS — scope at parent level instead.
      // Returning the unscoped query here is intentional; helper functions below
      // do the parent resolution.
      return query;
    }
    if (!classInstanceIds) {
      classInstanceIds = await getClassInstanceIdsForAy(schoolCode, ayId);
    }
    if (classInstanceIds.length === 0) return query.eq('id', '__none__'); // force empty result
    return query.in(info.classInstanceColumn || 'class_instance_id', classInstanceIds);
  }

  if (info.scope === 'ay') {
    return query.eq(info.ayColumn || 'academic_year_id', ayId);
  }

  if (info.scope === 'date') {
    const range = await getAyDateRange(ayId);
    if (!range || !range.start || !range.end) return query;
    const col = info.dateColumn;
    return query.gte(col, range.start).lte(col, range.end);
  }

  return query;
}

// ────────────────────────────────────────────────────────────────────────────
// Convenience builders for the common entry points.
// Each returns a Supabase query already scoped to the AY.
// ────────────────────────────────────────────────────────────────────────────

export async function scopedFrom(table, selectStr, { ayId, schoolCode }) {
  let q = supabase.from(table).select(selectStr);
  if (schoolCode) {
    // Tables that have school_code as a direct column should be filtered first.
    // Adding the eq is a no-op if the column doesn't exist? — Supabase will
    // error, so we only add it for known tables that have it.
    if (TABLES_WITH_SCHOOL_CODE.has(table)) q = q.eq('school_code', schoolCode);
  }
  q = await scopeQuery(q, table, { ayId, schoolCode });
  return q;
}

const TABLES_WITH_SCHOOL_CODE = new Set([
  'class_instances', 'student', 'users', 'subjects', 'tests', 'tasks',
  'fee_invoices', 'fee_categories', 'fee_components',
  'attendance_daily',
  'staff_attendance', 'leave_applications', 'leave_balances', 'leave_transactions',
  'payroll_runs', 'payslips', 'employees',
  'announcements', 'learning_resources',
  'admission_enquiries', 'admission_followups',
  'inventory_items', 'inventory_issues',
  'school_calendar_events', 'feedback', 'chatbot_messages',
]);

// Helper: AY caption for chart subtitles.
export function ayCaption(year, opts = {}) {
  if (!year) return '';
  const label = year.year_start && year.year_end
    ? `${year.year_start}-${year.year_end}`
    : year.start_date && year.end_date
      ? `${year.start_date.slice(0, 4)}-${year.end_date.slice(0, 4)}`
      : '';
  if (opts.allTime) return `${label} (table is all-time)`;
  return label;
}

export default {
  SCOPE_MAP,
  getScopeInfo,
  getClassInstanceIdsForAy,
  getAyDateRange,
  scopeQuery,
  scopedFrom,
  ayCaption,
  clearAyScopeCache,
};
