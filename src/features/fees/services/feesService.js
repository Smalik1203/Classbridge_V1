// Invoice-First Fees Service.
// JS port of mobile src/services/fees.ts (invoiceService).
// Tables: fee_invoices, fee_invoice_items, fee_payments.
// Edge functions: generate-invoice-document, send-fee-notification.
//
// Method names mirror mobile invoiceService exactly so they read 1:1 with the
// canonical TypeScript service.

import { supabase } from '@/config/supabaseClient';
import {
  getActiveAcademicYear,
  billingPeriodFor,
  calculateInvoiceStatus,
  calculateInvoiceTotal,
  addInvoiceItems,
  recalculateInvoiceTotal,
  recalculateInvoicePaidAmount,
} from './invoiceHelpers';

const PAYMENT_METHODS = ['cash', 'card', 'online', 'cheque', 'bank_transfer', 'upi'];

const todayISO = () => new Date().toISOString().split('T')[0];

async function getCurrentAuthUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('users')
    .select('id, role, school_code')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) return { id: user.id, role: null, school_code: null };
  return profile;
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function getByClass(classInstanceId, schoolCode, academicYearId = null) {
  if (!classInstanceId || !schoolCode) return [];

  const { data: classInstance, error: classErr } = await supabase
    .from('class_instances')
    .select('academic_year_id')
    .eq('id', classInstanceId)
    .eq('school_code', schoolCode)
    .single();
  if (classErr) throw classErr;
  if (!classInstance) return [];

  const filterAcademicYearId = academicYearId || classInstance.academic_year_id;

  const { data: students, error: studErr } = await supabase
    .from('student')
    .select('id')
    .eq('class_instance_id', classInstanceId)
    .eq('school_code', schoolCode);
  if (studErr) throw studErr;
  if (!students?.length) return [];

  const studentIds = students.map((s) => s.id);

  let query = supabase
    .from('fee_invoices')
    .select(`
      id, school_code, student_id, billing_period, total_amount, paid_amount,
      status, notes, academic_year_id, due_date, created_at,
      student:student_id (id, full_name, student_code)
    `)
    .eq('school_code', schoolCode)
    .in('student_id', studentIds);

  if (filterAcademicYearId) query = query.eq('academic_year_id', filterAcademicYearId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getAllForSchool(schoolCode, academicYearId = null) {
  if (!schoolCode) return [];

  let query = supabase
    .from('fee_invoices')
    .select(`
      id, school_code, student_id, billing_period, total_amount, paid_amount,
      status, notes, academic_year_id, due_date, created_at,
      student:student_id (id, full_name, student_code, class_instance_id),
      class:student!inner(class_instance_id)
    `)
    .eq('school_code', schoolCode)
    .order('created_at', { ascending: false });

  if (academicYearId) query = query.eq('academic_year_id', academicYearId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getByStudent(studentId, schoolCode, academicYearId = null) {
  if (!studentId || !schoolCode) return [];

  let query = supabase
    .from('fee_invoices')
    .select(`
      id, school_code, student_id, billing_period, total_amount, paid_amount,
      status, notes, academic_year_id, due_date, created_at,
      student:student_id (id, full_name, student_code),
      items:fee_invoice_items (id, invoice_id, label, amount, created_at),
      payments:fee_payments (
        id, invoice_id, invoice_item_id, amount_inr, payment_method,
        payment_date, receipt_number, remarks, recorded_by_user_id, recorded_at
      )
    `)
    .eq('student_id', studentId)
    .eq('school_code', schoolCode);

  if (academicYearId) query = query.eq('academic_year_id', academicYearId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getDetail(invoiceId) {
  if (!invoiceId) return null;

  const { data, error } = await supabase
    .from('fee_invoices')
    .select(`
      id, school_code, student_id, billing_period, total_amount, paid_amount,
      status, notes, academic_year_id, due_date, created_at,
      student:student_id (id, full_name, student_code, class_instance_id),
      items:fee_invoice_items (id, invoice_id, label, amount, created_at),
      payments:fee_payments (
        id, invoice_id, invoice_item_id, amount_inr, payment_method,
        payment_date, receipt_number, remarks, recorded_by_user_id, recorded_at
      )
    `)
    .eq('id', invoiceId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    return null;
  }
  if (!data) return null;

  const userIds = [...new Set(
    (data.payments || [])
      .map((p) => p.recorded_by_user_id)
      .filter(Boolean),
  )];

  const userMap = new Map();
  if (userIds.length) {
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', userIds);
    (users || []).forEach((u) => u.full_name && userMap.set(u.id, u.full_name));
  }

  const payments = (data.payments || [])
    .map((p) => ({ ...p, recorded_by_name: userMap.get(p.recorded_by_user_id) || null }))
    .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

  return {
    ...data,
    items: data.items || [],
    payments,
  };
}

// ─── Writes ──────────────────────────────────────────────────────────────────

export async function createInvoice(input) {
  const {
    school_code, student_id, billing_period, academic_year_id,
    due_date, items = [], notes = null,
  } = input;

  if (!school_code) throw new Error('school_code is required');
  if (!student_id) throw new Error('student_id is required');
  if (!billing_period) throw new Error('billing_period is required');
  if (!academic_year_id) throw new Error('academic_year_id is required');
  if (!due_date) throw new Error('due_date is required');
  if (!items.length) throw new Error('At least one line item is required');

  for (const it of items) {
    if (!it.label || it.label.trim() === '') throw new Error('Every item needs a label');
    if (it.amount === undefined || it.amount === null) throw new Error('Every item needs an amount');
  }

  const totalAmount = calculateInvoiceTotal(items);
  const status = calculateInvoiceStatus(totalAmount, 0);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Uniqueness on (school_code, student_id, billing_period) — append items to
  // an existing invoice if the student already has one for this period
  // (matches mobile inventory get-or-create behaviour).
  const { data: existing } = await supabase
    .from('fee_invoices')
    .select('id')
    .eq('school_code', school_code)
    .eq('student_id', student_id)
    .eq('billing_period', billing_period)
    .maybeSingle();

  if (existing?.id) {
    await addInvoiceItems(existing.id, items);
    if (notes || due_date) {
      await supabase
        .from('fee_invoices')
        .update({
          ...(due_date ? { due_date } : {}),
          ...(notes !== undefined ? { notes: notes || null } : {}),
        })
        .eq('id', existing.id);
    }
    return { id: existing.id, merged: true };
  }

  const { data: invoice, error } = await supabase
    .from('fee_invoices')
    .insert({
      school_code,
      student_id,
      billing_period,
      academic_year_id,
      due_date,
      notes: notes || null,
      total_amount: totalAmount,
      paid_amount: 0,
      status,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error) {
    // Race: a concurrent insert won. Fall back to merging into the existing row.
    if (error.code === '23505') {
      const { data: row } = await supabase
        .from('fee_invoices')
        .select('id')
        .eq('school_code', school_code)
        .eq('student_id', student_id)
        .eq('billing_period', billing_period)
        .maybeSingle();
      if (row?.id) {
        await addInvoiceItems(row.id, items);
        return { id: row.id, merged: true };
      }
    }
    throw error;
  }

  const { error: itemsErr } = await supabase
    .from('fee_invoice_items')
    .insert(items.map((it) => ({
      invoice_id: invoice.id,
      label: it.label,
      amount: it.amount,
    })));
  if (itemsErr) throw itemsErr;

  return { id: invoice.id };
}

/**
 * Bulk-create invoices for every student in a class.
 * Skips students that already have an invoice for this billing period.
 * One due_date for the whole batch (mirrors mobile contract).
 */
export async function generateForClass({
  classInstanceId,
  schoolCode,
  billingPeriod,
  items,
  academicYearId,
  dueDate,
}) {
  if (!classInstanceId || !schoolCode || !billingPeriod || !academicYearId || !dueDate) {
    throw new Error('Missing required parameters');
  }
  if (!items?.length) throw new Error('At least one fee item is required');

  const { data: { user } } = await supabase.auth.getUser();

  const { data: classInstance, error: classErr } = await supabase
    .from('class_instances')
    .select('academic_year_id')
    .eq('id', classInstanceId)
    .eq('school_code', schoolCode)
    .single();
  if (classErr) throw classErr;
  if (!classInstance) throw new Error('Class not found');

  const { data: students, error: studErr } = await supabase
    .from('student')
    .select('id')
    .eq('class_instance_id', classInstanceId)
    .eq('school_code', schoolCode);
  if (studErr) throw studErr;
  if (!students?.length) return { created: 0, skipped: 0 };

  const studentIds = students.map((s) => s.id);

  // DB unique constraint is (school_code, student_id, billing_period) — does
  // NOT include academic_year_id. Match the constraint exactly so we don't
  // try to double-insert and trip fee_invoices_school_code_student_id_billing_period_key.
  const { data: existing } = await supabase
    .from('fee_invoices')
    .select('id, student_id')
    .eq('school_code', schoolCode)
    .eq('billing_period', billingPeriod)
    .in('student_id', studentIds);

  const existingByStudent = new Map((existing || []).map((e) => [e.student_id, e.id]));
  const newStudents = students.filter((s) => !existingByStudent.has(s.id));

  // Append items to invoices that already exist for this period (mirrors the
  // mobile/inventory get-or-create pattern).
  let merged = 0;
  for (const studentId of existingByStudent.keys()) {
    const invoiceId = existingByStudent.get(studentId);
    try {
      await addInvoiceItems(invoiceId, items);
      merged += 1;
    } catch (err) {
      // Surface but do not abort the whole batch — one student's RLS issue
      // shouldn't block 30 others.
      console.warn('[fees] generateForClass: failed to merge into', invoiceId, err?.message);
    }
  }

  if (newStudents.length === 0) {
    return { created: 0, skipped: students.length - merged, merged };
  }

  const total = calculateInvoiceTotal(items);
  const status = calculateInvoiceStatus(total, 0);

  // Race guard: if a concurrent call inserts the same row, ignore the duplicate
  // and merge into it via the loop below.
  const { data: invoices, error: invErr } = await supabase
    .from('fee_invoices')
    .upsert(
      newStudents.map((s) => ({
        school_code: schoolCode,
        student_id: s.id,
        billing_period: billingPeriod,
        academic_year_id: academicYearId,
        due_date: dueDate,
        total_amount: total,
        paid_amount: 0,
        status,
        created_by: user?.id,
      })),
      { onConflict: 'school_code,student_id,billing_period', ignoreDuplicates: true },
    )
    .select('id, student_id');
  if (invErr) throw invErr;

  // Resolve any rows the upsert ignored (concurrent insert won) so we can
  // still attach items to them.
  const insertedStudentIds = new Set((invoices || []).map((i) => i.student_id));
  const raceLost = newStudents.filter((s) => !insertedStudentIds.has(s.id));
  let resolvedRaces = [];
  if (raceLost.length) {
    const { data: rows } = await supabase
      .from('fee_invoices')
      .select('id, student_id')
      .eq('school_code', schoolCode)
      .eq('billing_period', billingPeriod)
      .in('student_id', raceLost.map((s) => s.id));
    resolvedRaces = rows || [];
  }

  // Items: insert for the newly-created rows
  if (invoices?.length && items.length) {
    const allItems = invoices.flatMap((inv) =>
      items.map((it) => ({
        invoice_id: inv.id,
        label: it.label,
        amount: it.amount,
      })),
    );
    const { error: itemsErr } = await supabase
      .from('fee_invoice_items')
      .insert(allItems);
    if (itemsErr) throw itemsErr;
  }

  // Items: merge into rows we lost the race on
  for (const r of resolvedRaces) {
    try { await addInvoiceItems(r.id, items); merged += 1; } catch { /* swallow */ }
  }

  // Async notification — non-blocking
  if (invoices?.length) {
    queueMicrotask(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        await supabase.functions.invoke('send-fee-notification', {
          body: {
            type: 'invoice_generated',
            invoice_ids: invoices.map((i) => i.id),
          },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      } catch {
        /* swallow */
      }
    });
  }

  const created = (invoices || []).length;
  return { created, merged, skipped: students.length - created - merged };
}

export async function recordPayment(input) {
  const {
    invoice_id,
    invoice_item_id = null,
    amount,
    method,
    receipt_number = null,
    remarks = null,
  } = input;

  if (!invoice_id) throw new Error('invoice_id is required');
  if (!(amount > 0)) throw new Error('Payment amount must be greater than 0');
  if (!PAYMENT_METHODS.includes(method)) throw new Error(`Invalid payment method: ${method}`);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Validate against current balance
  const { data: invoice, error: invErr } = await supabase
    .from('fee_invoices')
    .select('id, school_code, student_id, total_amount, paid_amount')
    .eq('id', invoice_id)
    .single();
  if (invErr || !invoice) throw new Error('Invoice not found');

  const total = Number(invoice.total_amount || 0);
  const paid = Number(invoice.paid_amount || 0);
  const remaining = total - paid;
  if (amount > remaining + 0.001) {
    throw new Error(`Payment amount (₹${amount}) exceeds remaining balance (₹${remaining.toFixed(2)})`);
  }

  const paymentDate = todayISO();
  const recordedAt = new Date().toISOString();

  const { data: payment, error } = await supabase
    .from('fee_payments')
    .insert({
      invoice_id,
      invoice_item_id,
      student_id: invoice.student_id,
      school_code: invoice.school_code,
      amount_inr: amount,
      payment_method: method,
      payment_date: paymentDate,
      receipt_number,
      remarks,
      recorded_by_user_id: user.id,
      recorded_at: recordedAt,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error) throw error;

  await recalculateInvoicePaidAmount(invoice_id);

  // Auto-post to Finance GL (matches mobile fees.ts:574-606).
  // Only for super admin to mirror mobile's role gate.
  try {
    const me = await getCurrentAuthUser();
    if (me?.role === 'superadmin' && invoice.school_code) {
      const finance = await import('@/features/finance/services/financeService');
      const fns = finance?.financeService || finance?.default || finance;
      if (fns?.ensureDefaultAccounts && fns?.ensureFeesCategory && fns?.createTransaction) {
        const accounts = await fns.ensureDefaultAccounts(invoice.school_code, me.id);
        const feesCategoryId = await fns.ensureFeesCategory(invoice.school_code, me.id);
        const accountType = fns.mapPaymentMethodToAccount
          ? fns.mapPaymentMethodToAccount(method)
          : 'cash';
        const accountId = accounts?.[accountType] || accounts?.cash;

        await fns.createTransaction({
          school_code: invoice.school_code,
          txn_date: paymentDate,
          amount,
          type: 'income',
          category_id: feesCategoryId,
          account_id: accountId,
          description: `Fee payment - Invoice ${invoice_id}`,
          source_type: 'fee_payment',
          source_id: payment.id,
        });
      }
    }
  } catch (err) {
    // Don't fail the payment recording if finance auto-posting fails
    console.warn('[fees] finance auto-post failed:', err?.message || err);
  }

  // Async notification — non-blocking
  queueMicrotask(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.functions.invoke('send-fee-notification', {
        body: { type: 'payment_received', invoice_id, payment_amount: amount },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    } catch {
      /* swallow */
    }
  });

  return { id: payment.id };
}

export async function recordItemPayment(input) {
  if (!input.invoice_item_id) throw new Error('invoice_item_id is required for item-level payments');

  const { data: item, error: itemErr } = await supabase
    .from('fee_invoice_items')
    .select('id, amount, invoice_id')
    .eq('id', input.invoice_item_id)
    .single();
  if (itemErr || !item) throw new Error('Invoice item not found');
  if (item.invoice_id !== input.invoice_id) throw new Error('Invoice item does not belong to the specified invoice');

  const { data: existing } = await supabase
    .from('fee_payments')
    .select('amount_inr')
    .eq('invoice_item_id', input.invoice_item_id);

  const totalPaid = (existing || []).reduce((s, p) => s + Number(p.amount_inr || 0), 0);
  const remaining = Number(item.amount) - totalPaid;
  if (input.amount > remaining + 0.001) {
    throw new Error(`Payment amount (₹${input.amount}) exceeds item remaining balance (₹${remaining.toFixed(2)})`);
  }
  return recordPayment(input);
}

export async function addItems(invoiceId, items) {
  if (!items?.length) throw new Error('At least one item is required');
  for (const it of items) {
    if (!it.label || it.label.trim() === '') throw new Error('Every item needs a label');
    if (it.amount === undefined || it.amount === null) throw new Error('Every item needs an amount');
  }
  await addInvoiceItems(invoiceId, items);
}

export async function removeItems(invoiceId, itemIds) {
  if (!itemIds?.length) throw new Error('At least one item id is required');

  const { error: deleteErr } = await supabase
    .from('fee_invoice_items')
    .delete()
    .in('id', itemIds)
    .eq('invoice_id', invoiceId);
  if (deleteErr) throw deleteErr;

  await recalculateInvoiceTotal(invoiceId);
}

export async function updateItem(itemId, updates) {
  const { data: item, error: itemErr } = await supabase
    .from('fee_invoice_items')
    .select('invoice_id')
    .eq('id', itemId)
    .single();
  if (itemErr || !item) throw new Error('Invoice item not found');

  const updateData = {};
  if (updates.label !== undefined) updateData.label = updates.label;
  if (updates.amount !== undefined) updateData.amount = updates.amount;

  const { error } = await supabase
    .from('fee_invoice_items')
    .update(updateData)
    .eq('id', itemId);
  if (error) throw error;

  await recalculateInvoiceTotal(item.invoice_id);
}

export async function updateInvoice(invoiceId, updates) {
  const updateData = {};
  if (updates.due_date !== undefined) updateData.due_date = updates.due_date;
  if (updates.notes !== undefined) updateData.notes = updates.notes;

  const { error } = await supabase
    .from('fee_invoices')
    .update(updateData)
    .eq('id', invoiceId);
  if (error) throw error;
}

export async function deleteInvoice(invoiceId) {
  const { data: payments, error: paymentsErr } = await supabase
    .from('fee_payments')
    .select('id')
    .eq('invoice_id', invoiceId)
    .limit(1);
  if (paymentsErr) throw paymentsErr;
  if (payments?.length) {
    throw new Error('Cannot delete an invoice that already has payments. Void or refund the payments first.');
  }

  const { error: itemsErr } = await supabase
    .from('fee_invoice_items')
    .delete()
    .eq('invoice_id', invoiceId);
  if (itemsErr) throw itemsErr;

  const { error: invErr } = await supabase
    .from('fee_invoices')
    .delete()
    .eq('id', invoiceId);
  if (invErr) throw invErr;
}

// ─── Documents & notifications ───────────────────────────────────────────────

export async function generateInvoiceDocument(invoiceId, forceRegenerate = false) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('generate-invoice-document', {
    body: { invoice_id: invoiceId, force_regenerate: forceRegenerate },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Failed to generate invoice document');
  return data;
}

export async function sendPaymentReminder(invoiceId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('send-fee-notification', {
    body: { type: 'payment_reminder', invoice_id: invoiceId },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) {
    let msg = error.message;
    try {
      const body = await error.context?.json?.();
      if (body?.details || body?.error) msg = body.details ?? body.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return { success: true, ...(data || {}) };
}

export async function sendBulkReminders(invoiceIds) {
  const results = { sent: 0, failed: 0, errors: [] };
  for (const id of invoiceIds) {
    try {
      await sendPaymentReminder(id);
      results.sent += 1;
    } catch (err) {
      results.failed += 1;
      results.errors.push({ id, error: err?.message || String(err) });
    }
  }
  return results;
}

// ─── Reference data ──────────────────────────────────────────────────────────

export async function listClasses(schoolCode) {
  const { data, error } = await supabase
    .from('class_instances')
    .select('id, grade, section, academic_year_id, academic_years(year_start, year_end, is_active)')
    .eq('school_code', schoolCode)
    .order('grade')
    .order('section');
  if (error) throw error;
  return data || [];
}

export async function listStudents(schoolCode, classInstanceId = null) {
  let query = supabase
    .from('student')
    .select('id, full_name, student_code, class_instance_id')
    .eq('school_code', schoolCode)
    .order('full_name');
  if (classInstanceId) query = query.eq('class_instance_id', classInstanceId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function resolveStudentForUser(authUserId) {
  // Mirrors mobile auth → student lookup. Tries auth_user_id, then user_id.
  const tries = [
    { col: 'auth_user_id', val: authUserId },
    { col: 'user_id', val: authUserId },
  ];
  for (const t of tries) {
    const { data } = await supabase
      .from('student')
      .select('id, full_name, student_code, school_code, class_instance_id')
      .eq(t.col, t.val)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

// ─── Aggregations / analytics ────────────────────────────────────────────────

/**
 * Compute aged-receivables (0–30 / 31–60 / 61–90 / 90+) from invoices.
 * Pure JS — runs on the result of getByClass / getAllForSchool.
 */
export function ageReceivables(invoices) {
  const buckets = { current: 0, b0_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0 };
  const today = new Date();
  for (const inv of invoices || []) {
    const total = Number(inv.total_amount || 0);
    const paid = Number(inv.paid_amount || 0);
    const balance = Math.max(0, total - paid);
    if (balance <= 0) continue;
    const due = inv.due_date ? new Date(inv.due_date) : null;
    if (!due) {
      buckets.current += balance;
      continue;
    }
    const days = Math.floor((today - due) / (1000 * 60 * 60 * 24));
    if (days <= 0) buckets.current += balance;
    else if (days <= 30) buckets.b0_30 += balance;
    else if (days <= 60) buckets.b31_60 += balance;
    else if (days <= 90) buckets.b61_90 += balance;
    else buckets.b90_plus += balance;
  }
  return buckets;
}

export function summariseInvoices(invoices) {
  let total = 0, paid = 0, overdueCount = 0, paidCount = 0, partialCount = 0, dueCount = 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (const inv of invoices || []) {
    const t = Number(inv.total_amount || 0);
    const p = Number(inv.paid_amount || 0);
    total += t;
    paid += p;
    const balance = Math.max(0, t - p);
    if (p >= t && t > 0) paidCount += 1;
    else if (p > 0) partialCount += 1;
    else dueCount += 1;
    if (balance > 0 && inv.due_date) {
      const due = new Date(inv.due_date);
      if (due < today) overdueCount += 1;
    }
  }
  return {
    total,
    collected: paid,
    outstanding: total - paid,
    invoiceCount: (invoices || []).length,
    paidCount,
    partialCount,
    dueCount,
    overdueCount,
    collectionRate: total > 0 ? (paid / total) * 100 : 0,
  };
}

// ─── Default export (object form for ergonomic imports) ──────────────────────

export const feesService = {
  getByClass,
  getAllForSchool,
  getByStudent,
  getDetail,
  createInvoice,
  generateForClass,
  recordPayment,
  recordItemPayment,
  addItems,
  removeItems,
  updateItem,
  updateInvoice,
  deleteInvoice,
  generateInvoiceDocument,
  sendPaymentReminder,
  sendBulkReminders,
  listClasses,
  listStudents,
  resolveStudentForUser,
  getActiveAcademicYear,
  billingPeriodFor,
  calculateInvoiceStatus,
  calculateInvoiceTotal,
  ageReceivables,
  summariseInvoices,
};

export default feesService;
