// src/features/analytics/services/feesAnalyticsService.js
//
// Fees analytics queries — every analytics call goes through a server-side
// RPC. No raw .from() aggregation here (those hit Supabase's silent 1000-row
// default and inflate counts when invoices have multiple payments).
//
// Scoping rule: fee_invoices.academic_year_id is the *billing AY* and is
// authoritative for fees analytics. fee_invoice_items / fee_payments scope
// via the parent invoice. KPI queries are AY-bounded; time-series queries
// are calendar-windowed (caller passes start/end).

import { supabase } from '@/config/supabaseClient';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { getAyDateRange } from './ayScope';

dayjs.extend(utc);
dayjs.extend(timezone);

const IST = 'Asia/Kolkata';
const fmt = (d) => dayjs(d).tz(IST).format('YYYY-MM-DD');

// Date window resolver — caller provides explicit range, or AY full span,
// or last 30 days as a fallback. Mirrors attendance service convention.
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
// 1. Headline KPIs.
// ────────────────────────────────────────────────────────────────────────────
export async function getHeadlineKpis({ schoolCode, ayId, classInstanceId }) {
  if (!schoolCode || !ayId) {
    return {
      totalBilled: 0, totalPaid: 0, totalOutstanding: 0, collectionRate: 0,
      invoiceCount: 0, paidCount: 0, partialCount: 0, dueCount: 0,
      distinctStudents: 0, payingStudents: 0,
    };
  }
  const { data, error } = await supabase.rpc('fees_headline_kpis', {
    p_school_code: schoolCode,
    p_ay_id: ayId,
    p_class_instance_id: classInstanceId && classInstanceId !== 'all' ? classInstanceId : null,
  });
  if (error) throw error;
  const r = (data && data[0]) || {};
  return {
    totalBilled: Number(r.total_billed || 0),
    totalPaid: Number(r.total_paid || 0),
    totalOutstanding: Number(r.total_outstanding || 0),
    collectionRate: r.collection_rate != null ? Number(r.collection_rate) : 0,
    invoiceCount: Number(r.invoice_count || 0),
    paidCount: Number(r.paid_count || 0),
    partialCount: Number(r.partial_count || 0),
    dueCount: Number(r.due_count || 0),
    distinctStudents: Number(r.distinct_students || 0),
    payingStudents: Number(r.paying_students || 0),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Daily collection trend — calendar-windowed.
//    Returns one row per day in [start, end] with zero-fill for empty days.
// ────────────────────────────────────────────────────────────────────────────
export async function getDailyCollection({ schoolCode, ayId, classInstanceId, startDate, endDate }) {
  if (!schoolCode) return [];
  const { start, end } = await resolveDateRange({ ayId, startDate, endDate });

  const { data, error } = await supabase.rpc('fees_daily_collection', {
    p_school_code: schoolCode,
    p_start: start,
    p_end: end,
    p_ay_id: ayId || null,
    p_class_instance_id: classInstanceId && classInstanceId !== 'all' ? classInstanceId : null,
  });
  if (error) throw error;

  const map = new Map((data || []).map((r) => [r.d, r]));
  const days = [];
  let cur = dayjs(start);
  const last = dayjs(end);
  while (cur.isBefore(last) || cur.isSame(last, 'day')) {
    const k = cur.format('YYYY-MM-DD');
    const hit = map.get(k);
    days.push({
      date: k,
      amount: hit ? Number(hit.amount || 0) : 0,
      paymentCount: hit ? Number(hit.payment_count || 0) : 0,
      noData: !hit,
    });
    cur = cur.add(1, 'day');
  }
  return days;
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Aging snapshot — invoice counts + outstanding ₹ per bucket.
// ────────────────────────────────────────────────────────────────────────────
const BUCKET_LABELS = {
  not_yet_due: { label: 'Not yet due', order: 0, color: '#94a3b8' },
  d_0_30:      { label: '0–30 days overdue', order: 1, color: '#f59e0b' },
  d_31_60:     { label: '31–60 days overdue', order: 2, color: '#fb923c' },
  d_61_90:     { label: '61–90 days overdue', order: 3, color: '#f97316' },
  d_90_plus:   { label: '90+ days overdue', order: 4, color: '#ef4444' },
};

export async function getAgingSnapshot({ schoolCode, ayId, asOfDate, classInstanceId }) {
  if (!schoolCode || !ayId) return [];
  const { data, error } = await supabase.rpc('fees_aging_snapshot', {
    p_school_code: schoolCode,
    p_ay_id: ayId,
    p_as_of_date: asOfDate || dayjs().tz(IST).format('YYYY-MM-DD'),
    p_class_instance_id: classInstanceId && classInstanceId !== 'all' ? classInstanceId : null,
  });
  if (error) throw error;

  // Ensure every bucket is present so the chart is stable across days.
  const present = new Map((data || []).map((r) => [r.bucket, r]));
  return Object.entries(BUCKET_LABELS).map(([key, meta]) => {
    const r = present.get(key);
    return {
      key,
      label: meta.label,
      color: meta.color,
      order: meta.order,
      invoiceCount: r ? Number(r.invoice_count || 0) : 0,
      outstanding: r ? Number(r.outstanding || 0) : 0,
    };
  }).sort((a, b) => a.order - b.order);
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Per-class summary.
// ────────────────────────────────────────────────────────────────────────────
export async function getPerClassSummary({ schoolCode, ayId }) {
  if (!schoolCode || !ayId) return [];
  const { data, error } = await supabase.rpc('fees_per_class_summary', {
    p_school_code: schoolCode,
    p_ay_id: ayId,
  });
  if (error) throw error;
  return (data || []).map((r) => ({
    classInstanceId: r.class_instance_id,
    label: r.grade != null ? `Grade ${r.grade}${r.section ? ` ${r.section}` : ''}` : 'Unknown',
    invoiceCount: Number(r.invoice_count || 0),
    studentCount: Number(r.student_count || 0),
    totalBilled: Number(r.total_billed || 0),
    totalPaid: Number(r.total_paid || 0),
    totalOutstanding: Number(r.total_outstanding || 0),
    collectionRate: r.collection_rate != null ? Number(r.collection_rate) : 0,
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Top defaulters.
// ────────────────────────────────────────────────────────────────────────────
export async function getTopDefaulters({ schoolCode, ayId, classInstanceId, limit = 20, asOfDate }) {
  if (!schoolCode || !ayId) return [];
  const { data, error } = await supabase.rpc('fees_top_defaulters', {
    p_school_code: schoolCode,
    p_ay_id: ayId,
    p_limit: limit,
    p_class_instance_id: classInstanceId && classInstanceId !== 'all' ? classInstanceId : null,
    p_as_of_date: asOfDate || dayjs().tz(IST).format('YYYY-MM-DD'),
  });
  if (error) throw error;
  return (data || []).map((r) => ({
    studentId: r.student_id,
    name: r.full_name || 'Student',
    code: r.student_code,
    classLabel: r.grade != null ? `Grade ${r.grade}${r.section ? ` ${r.section}` : ''}` : '—',
    invoiceCount: Number(r.invoice_count || 0),
    totalBilled: Number(r.total_billed || 0),
    totalPaid: Number(r.total_paid || 0),
    outstanding: Number(r.outstanding || 0),
    oldestDueDays: Number(r.oldest_due_days || 0),
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// 6. Distributions (status / payment-method / label) returned together.
// ────────────────────────────────────────────────────────────────────────────
const STATUS_META = {
  PAID:    { label: 'Paid',    color: '#10b981' },
  PARTIAL: { label: 'Partial', color: '#f59e0b' },
  DUE:     { label: 'Due',     color: '#ef4444' },
};

const METHOD_META = {
  cash:          { label: 'Cash',          color: '#10b981' },
  online:        { label: 'Online',        color: '#6366f1' },
  card:          { label: 'Card',          color: '#a855f7' },
  cheque:        { label: 'Cheque',        color: '#06b6d4' },
  upi:           { label: 'UPI',           color: '#3b82f6' },
  bank_transfer: { label: 'Bank transfer', color: '#0ea5e9' },
  unknown:       { label: 'Unknown',       color: '#94a3b8' },
};

export async function getDistributions({ schoolCode, ayId, classInstanceId }) {
  if (!schoolCode || !ayId) return { status: [], method: [], label: [] };
  const { data, error } = await supabase.rpc('fees_distributions', {
    p_school_code: schoolCode,
    p_ay_id: ayId,
    p_class_instance_id: classInstanceId && classInstanceId !== 'all' ? classInstanceId : null,
  });
  if (error) throw error;
  const json = data || {};

  const statusRows = (json.status_dist || []).map((r) => ({
    key: r.status,
    label: STATUS_META[r.status]?.label || r.status,
    color: STATUS_META[r.status]?.color || '#94a3b8',
    invoiceCount: Number(r.invoice_count || 0),
    billed: Number(r.billed || 0),
    paid: Number(r.paid || 0),
  }));
  const totalStatus = statusRows.reduce((a, b) => a + b.invoiceCount, 0) || 1;
  statusRows.forEach((r) => { r.percent = Math.round((r.invoiceCount / totalStatus) * 1000) / 10; });

  const methodRows = (json.method_dist || []).map((r) => ({
    key: r.method,
    label: METHOD_META[r.method]?.label || r.method,
    color: METHOD_META[r.method]?.color || '#94a3b8',
    paymentCount: Number(r.payment_count || 0),
    amount: Number(r.amount || 0),
  }));
  const totalMethod = methodRows.reduce((a, b) => a + b.amount, 0) || 1;
  methodRows.forEach((r) => { r.percent = Math.round((r.amount / totalMethod) * 1000) / 10; });

  const labelRows = (json.label_dist || []).map((r) => ({
    label: r.label || '(blank)',
    itemCount: Number(r.item_count || 0),
    billed: Number(r.billed || 0),
  }));
  const totalLabel = labelRows.reduce((a, b) => a + b.billed, 0) || 1;
  labelRows.forEach((r) => { r.percent = Math.round((r.billed / totalLabel) * 1000) / 10; });

  return { status: statusRows, method: methodRows, label: labelRows };
}

export default {
  getHeadlineKpis,
  getDailyCollection,
  getAgingSnapshot,
  getPerClassSummary,
  getTopDefaulters,
  getDistributions,
};
