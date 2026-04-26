// Shared invoice helpers used by both Fees and Inventory modules.
// Byte-compatible with mobile services/fees.ts behaviour.
// Tables: fee_invoices, fee_invoice_items, academic_years.
// Imported by: src/features/fees/services/feesService.js
//              src/features/inventory/services/inventoryService.js

import { supabase } from '@/config/supabaseClient';

const todayISO = () => new Date().toISOString().split('T')[0];

export const billingPeriodFor = (academicYear) =>
  `${academicYear.year_start}-${academicYear.year_end}`;

export async function getActiveAcademicYear(schoolCode) {
  const { data, error } = await supabase
    .from('academic_years')
    .select('id, year_start, year_end, is_active')
    .eq('school_code', schoolCode)
    .eq('is_active', true)
    .single();
  if (error) return null;
  return data;
}

// Status enum values exactly match the DB CHECK constraint on fee_invoices.status.
// Mobile (canonical contract) uses uppercase 'DUE' / 'PARTIAL' / 'PAID' — see
// classbridge/src/domain/fees/types.ts InvoiceStatusSchema. Lowercase values
// (which an earlier inventory implementation tried to write) violate
// fee_invoices_status_check.
export const INVOICE_STATUS = Object.freeze({
  DUE: 'DUE',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
});

export function calculateInvoiceStatus(totalAmount, paidAmount) {
  const total = Number(totalAmount) || 0;
  const paid = Number(paidAmount) || 0;
  if (paid <= 0) return INVOICE_STATUS.DUE;
  if (paid >= total && total > 0) return INVOICE_STATUS.PAID;
  return INVOICE_STATUS.PARTIAL;
}

// Normalise any legacy value (lowercase, or alt 'pending') to the canonical
// upper-case enum the DB constraint expects.
export function normaliseInvoiceStatus(value) {
  if (!value) return INVOICE_STATUS.DUE;
  const v = String(value).trim().toUpperCase();
  if (v === 'PENDING') return INVOICE_STATUS.DUE;
  if (v === 'DUE' || v === 'PARTIAL' || v === 'PAID') return v;
  return INVOICE_STATUS.DUE;
}

export function calculateInvoiceTotal(items) {
  return (items || []).reduce(
    (sum, it) => sum + parseFloat(it?.amount?.toString?.() ?? it?.amount ?? 0),
    0,
  );
}

/**
 * Get-or-create the canonical fee_invoice for a student in the active billing
 * period. Returns the invoice id.
 *
 * Defaults on insert mirror mobile/inventory pattern exactly:
 *   total_amount=0, paid_amount=0, due_date=today+1 month.
 */
export async function getOrCreateInvoice({
  schoolCode,
  studentId,
  userId,
  academicYear, // {id, year_start, year_end}
  dueDateOverride = null,
}) {
  if (!academicYear) throw new Error('academicYear is required');
  const billingPeriod = billingPeriodFor(academicYear);

  // Lookup matches the DB unique key exactly: (school_code, student_id, billing_period).
  // Including academic_year_id here would cause a false miss → duplicate insert
  // → fee_invoices_school_code_student_id_billing_period_key violation.
  const { data: existing } = await supabase
    .from('fee_invoices')
    .select('id')
    .eq('school_code', schoolCode)
    .eq('student_id', studentId)
    .eq('billing_period', billingPeriod)
    .maybeSingle();

  if (existing) return existing.id;

  let dueDate = dueDateOverride;
  if (!dueDate) {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    dueDate = d.toISOString().split('T')[0];
  }

  const { data: inserted, error } = await supabase
    .from('fee_invoices')
    .insert({
      school_code: schoolCode,
      student_id: studentId,
      billing_period: billingPeriod,
      academic_year_id: academicYear.id,
      due_date: dueDate,
      total_amount: 0,
      paid_amount: 0,
      created_by: userId,
    })
    .select('id')
    .single();

  if (error) {
    // Race: a concurrent caller (or inventory issuance) inserted the same
    // (school_code, student_id, billing_period) row. Re-read and return.
    if (error.code === '23505') {
      const { data: row } = await supabase
        .from('fee_invoices')
        .select('id')
        .eq('school_code', schoolCode)
        .eq('student_id', studentId)
        .eq('billing_period', billingPeriod)
        .maybeSingle();
      if (row?.id) return row.id;
    }
    throw error;
  }
  return inserted.id;
}

/**
 * Insert items, then recompute and update parent invoice's total_amount + status.
 * Each item: { label, amount }. Amount is in rupees and may be negative
 * (refunds / waivers).
 *
 * Behaviour matches mobile invoiceService.addItems and the inventory
 * addInvoiceItems helper byte-for-byte.
 */
export async function addInvoiceItems(invoiceId, items) {
  if (!items || items.length === 0) return;

  const { error: insertErr } = await supabase
    .from('fee_invoice_items')
    .insert(items.map((it) => ({
      invoice_id: invoiceId,
      label: it.label,
      amount: it.amount,
    })));
  if (insertErr) throw insertErr;

  await recalculateInvoiceTotal(invoiceId);
}

/**
 * Recompute total_amount and status for an invoice from its current
 * fee_invoice_items. Use after any item insert / update / delete.
 */
export async function recalculateInvoiceTotal(invoiceId) {
  const { data: allItems, error: fetchErr } = await supabase
    .from('fee_invoice_items')
    .select('amount')
    .eq('invoice_id', invoiceId);
  if (fetchErr) throw fetchErr;

  const newTotal = calculateInvoiceTotal(allItems);

  const { data: invoice } = await supabase
    .from('fee_invoices')
    .select('paid_amount')
    .eq('id', invoiceId)
    .single();

  const paid = Number(invoice?.paid_amount ?? 0);
  const status = calculateInvoiceStatus(newTotal, paid);

  const { error: updateErr } = await supabase
    .from('fee_invoices')
    .update({ total_amount: newTotal, status })
    .eq('id', invoiceId);
  if (updateErr) throw updateErr;

  return { total: newTotal, paid, status };
}

/**
 * Recompute paid_amount + status from fee_payments. Use after any payment
 * insert / delete (mirrors mobile updateInvoicePaidAmount).
 */
export async function recalculateInvoicePaidAmount(invoiceId) {
  const { data: invoiceData, error } = await supabase
    .from('fee_invoices')
    .select('id, total_amount, payments:fee_payments(amount_inr)')
    .eq('id', invoiceId)
    .single();

  if (error || !invoiceData) throw error || new Error('Invoice not found');

  const totalPaid = (invoiceData.payments || []).reduce(
    (sum, p) => sum + Number(p.amount_inr || 0),
    0,
  );
  const totalAmount = Number(invoiceData.total_amount || 0);
  const status = calculateInvoiceStatus(totalAmount, totalPaid);

  const { error: updateErr } = await supabase
    .from('fee_invoices')
    .update({ paid_amount: totalPaid, status })
    .eq('id', invoiceId);
  if (updateErr) throw updateErr;

  return { total: totalAmount, paid: totalPaid, status };
}

export const _internal = { todayISO };
