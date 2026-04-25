import { supabase } from '@/config/supabaseClient';

/**
 * Inventory service — direct port of mobile `src/services/inventory.ts`.
 * Same Supabase tables (inventory_items, inventory_issues, fee_invoices,
 * fee_invoice_items, academic_years), same join shapes, same defaults.
 * Web UI rebuilt with AntD; this layer must stay byte-compatible with mobile
 * so an item issued from web vs mobile produces identical fee rows.
 */

// ── Constants (mirror mobile UI choices) ─────────────────────────────────────

export const ISSUE_TO_OPTIONS = [
  { label: 'Student', value: 'student' },
  { label: 'Staff',   value: 'staff' },
  { label: 'Both',    value: 'both' },
];

export const CHARGE_TYPES = [
  { label: 'One-time charge',     value: 'one_time' },
  { label: 'Refundable deposit', value: 'deposit' },
];

export const FEE_CATEGORIES = [
  { label: 'Books',   value: 'books' },
  { label: 'Uniform', value: 'uniform' },
  { label: 'Misc',    value: 'misc' },
];

export const ISSUE_STATUSES = ['issued', 'returned', 'overdue', 'lost'];

export const ITEM_SELECT =
  'id, school_code, name, category, description, track_quantity, current_quantity, low_stock_threshold, track_serially, can_be_issued, issue_to, must_be_returned, return_duration_days, is_chargeable, charge_type, charge_amount, auto_add_to_fees, fee_category, unit_cost, allow_price_override, internal_notes, is_active, created_at, updated_at, created_by';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTodayISO() {
  // Use IST date — mirrors mobile getTodayIST() behavior.
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 - now.getTimezoneOffset()) * 60000);
  return ist.toISOString().split('T')[0];
}

export function getStockStatus(item) {
  if (!item.track_quantity || item.current_quantity === null || item.current_quantity === undefined) {
    return 'untracked';
  }
  const qty = Number(item.current_quantity);
  const threshold = item.low_stock_threshold ?? 5;
  if (qty <= 0) return 'critical';
  if (qty <= threshold) return 'low';
  return 'healthy';
}

// ── Items ────────────────────────────────────────────────────────────────────

export const inventoryItemsService = {
  async list(schoolCode, options = {}) {
    const limit = Math.min(options.limit ?? 200, 500);
    const offset = options.offset ?? 0;

    const [countResult, dataResult] = await Promise.all([
      supabase
        .from('inventory_items')
        .select('id', { count: 'exact', head: true })
        .eq('school_code', schoolCode)
        .eq('is_active', true),
      supabase
        .from('inventory_items')
        .select(ITEM_SELECT)
        .eq('school_code', schoolCode)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
    ]);

    if (dataResult.error) throw dataResult.error;
    return {
      data: dataResult.data || [],
      total: countResult.count ?? (dataResult.data?.length ?? 0),
    };
  },

  async getById(itemId, schoolCode) {
    const { data, error } = await supabase
      .from('inventory_items')
      .select(ITEM_SELECT)
      .eq('id', itemId)
      .eq('school_code', schoolCode)
      .eq('is_active', true)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  },

  async create(schoolCode, userId, input) {
    const payload = {
      school_code: schoolCode,
      name: input.name,
      category: input.category,
      description: input.description || null,
      track_quantity: !!input.track_quantity,
      current_quantity: input.current_quantity ?? null,
      low_stock_threshold: input.low_stock_threshold ?? null,
      track_serially: !!input.track_serially,
      can_be_issued: !!input.can_be_issued,
      issue_to: input.issue_to || null,
      must_be_returned: !!input.must_be_returned,
      return_duration_days: input.return_duration_days ?? null,
      is_chargeable: !!input.is_chargeable,
      charge_type: input.charge_type || null,
      charge_amount: input.charge_amount ?? null,
      auto_add_to_fees: !!input.auto_add_to_fees,
      fee_category: input.fee_category || null,
      unit_cost: input.unit_cost ?? null,
      allow_price_override: !!input.allow_price_override,
      internal_notes: input.internal_notes || null,
      is_active: input.is_active !== false,
      created_by: userId,
    };

    const { data, error } = await supabase
      .from('inventory_items')
      .insert(payload)
      .select('id')
      .single();

    if (error) throw error;
    return { id: data.id };
  },

  async update(itemId, schoolCode, updates) {
    const { error } = await supabase
      .from('inventory_items')
      .update(updates)
      .eq('id', itemId)
      .eq('school_code', schoolCode);
    if (error) throw error;
  },

  async softDelete(itemId, schoolCode) {
    return this.update(itemId, schoolCode, { is_active: false });
  },

  async setStock(itemId, schoolCode, newQuantity) {
    return this.update(itemId, schoolCode, { current_quantity: newQuantity });
  },
};

// ── Invoice helpers (replicates mobile fees.invoiceService.addItems behaviour) ──

async function addInvoiceItems(invoiceId, items) {
  // Insert
  const { error: insertErr } = await supabase
    .from('fee_invoice_items')
    .insert(items.map(it => ({
      invoice_id: invoiceId,
      label: it.label,
      amount: it.amount,
    })));
  if (insertErr) throw insertErr;

  // Recalculate total
  const { data: allItems, error: fetchErr } = await supabase
    .from('fee_invoice_items')
    .select('amount')
    .eq('invoice_id', invoiceId);
  if (fetchErr) throw fetchErr;

  const newTotal = (allItems || []).reduce(
    (sum, it) => sum + parseFloat(it.amount?.toString?.() ?? it.amount ?? 0),
    0
  );

  // Get paid_amount to recompute status
  const { data: invoice } = await supabase
    .from('fee_invoices')
    .select('paid_amount')
    .eq('id', invoiceId)
    .single();

  const paid = Number(invoice?.paid_amount ?? 0);
  let status = 'pending';
  if (paid >= newTotal && newTotal > 0) status = 'paid';
  else if (paid > 0) status = 'partial';

  const { error: updateErr } = await supabase
    .from('fee_invoices')
    .update({ total_amount: newTotal, status })
    .eq('id', invoiceId);
  if (updateErr) throw updateErr;
}

// ── Issuance ─────────────────────────────────────────────────────────────────

export const inventoryIssuesService = {
  /**
   * Issue an item. Mirrors mobile inventoryItemsService.issue exactly:
   *  - validates capability + issue_to constraints
   *  - decrements stock if tracked
   *  - on auto_add_to_fees + chargeable + student → upsert invoice for active
   *    academic year billing period and add an item with same label format
   */
  async issue(schoolCode, userId, input) {
    // 1) load item (active scope)
    const item = await inventoryItemsService.getById(input.inventory_item_id, schoolCode);
    if (!item) throw new Error('Inventory item not found');

    if (!item.can_be_issued) throw new Error('This item cannot be issued');

    if (item.issue_to === 'student' && input.issued_to_type !== 'student') {
      throw new Error('This item can only be issued to students');
    }
    if (item.issue_to === 'staff' && input.issued_to_type !== 'staff') {
      throw new Error('This item can only be issued to staff');
    }

    if (item.track_quantity && item.current_quantity !== null && item.current_quantity !== undefined) {
      if (Number(item.current_quantity) < input.quantity) {
        throw new Error(`Insufficient quantity. Available: ${item.current_quantity}`);
      }
    }

    // 2) compute charge
    let chargeAmount = null;
    let chargeType = null;
    if (item.is_chargeable) {
      chargeAmount = input.charge_amount_override ?? item.charge_amount;
      chargeType = item.charge_type;
      if (!chargeAmount || chargeAmount <= 0) {
        throw new Error('Charge amount is required for chargeable items');
      }
    }

    // 3) expected return date
    let expectedReturnDate = null;
    if (item.must_be_returned && item.return_duration_days) {
      const d = new Date();
      d.setDate(d.getDate() + item.return_duration_days);
      expectedReturnDate = d.toISOString().split('T')[0];
    }

    // 4) insert issue row
    const { data: issue, error: issueError } = await supabase
      .from('inventory_issues')
      .insert({
        school_code: schoolCode,
        inventory_item_id: input.inventory_item_id,
        issued_to_type: input.issued_to_type,
        issued_to_id: input.issued_to_id,
        quantity: input.quantity,
        serial_number: input.serial_number || null,
        issue_date: getTodayISO(),
        expected_return_date: expectedReturnDate,
        charge_amount: chargeAmount,
        charge_type: chargeType,
        status: 'issued',
        issued_by: userId,
      })
      .select('id')
      .single();
    if (issueError) throw issueError;

    // 5) decrement stock
    if (item.track_quantity && item.current_quantity !== null && item.current_quantity !== undefined) {
      await inventoryItemsService.update(input.inventory_item_id, schoolCode, {
        current_quantity: Number(item.current_quantity) - input.quantity,
      });
    }

    // 6) auto-add to fees (mirror mobile path exactly)
    let feeInvoiceItemId = null;
    if (
      item.auto_add_to_fees &&
      item.is_chargeable &&
      input.issued_to_type === 'student' &&
      chargeAmount
    ) {
      try {
        const { data: academicYear } = await supabase
          .from('academic_years')
          .select('id, year_start, year_end')
          .eq('school_code', schoolCode)
          .eq('is_active', true)
          .single();

        if (academicYear) {
          const billingPeriod = `${academicYear.year_start}-${academicYear.year_end}`;

          const { data: existingInvoice } = await supabase
            .from('fee_invoices')
            .select('id')
            .eq('student_id', input.issued_to_id)
            .eq('school_code', schoolCode)
            .eq('billing_period', billingPeriod)
            .eq('academic_year_id', academicYear.id)
            .maybeSingle();

          let invoiceId;
          if (existingInvoice) {
            invoiceId = existingInvoice.id;
          } else {
            const dueDate = new Date();
            dueDate.setMonth(dueDate.getMonth() + 1);

            const { data: newInvoice, error: invError } = await supabase
              .from('fee_invoices')
              .insert({
                school_code: schoolCode,
                student_id: input.issued_to_id,
                billing_period: billingPeriod,
                academic_year_id: academicYear.id,
                due_date: dueDate.toISOString().split('T')[0],
                total_amount: 0,
                paid_amount: 0,
                created_by: userId,
              })
              .select('id')
              .single();
            if (!invError && newInvoice) invoiceId = newInvoice.id;
          }

          if (invoiceId) {
            const label = `${item.name}${input.quantity > 1 ? ` (x${input.quantity})` : ''}`;
            await addInvoiceItems(invoiceId, [{
              label,
              amount: chargeAmount * input.quantity,
            }]);

            const { data: invoiceItem } = await supabase
              .from('fee_invoice_items')
              .select('id')
              .eq('invoice_id', invoiceId)
              .eq('label', label)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (invoiceItem) {
              feeInvoiceItemId = invoiceItem.id;
              await supabase
                .from('inventory_issues')
                .update({ fee_invoice_item_id: feeInvoiceItemId })
                .eq('id', issue.id);
            }
          }
        }
      } catch {
        // matches mobile: don't throw — issue is still recorded
      }
    }

    return { id: issue.id, fee_invoice_item_id: feeInvoiceItemId || undefined };
  },

  async listIssues(schoolCode, filters = {}, options = {}) {
    const limit = Math.min(options.limit ?? 200, 500);
    const offset = options.offset ?? 0;

    let query = supabase
      .from('inventory_issues')
      .select(
        `id, school_code, inventory_item_id, issued_to_type, issued_to_id, quantity, serial_number, issue_date, expected_return_date, returned_date, status, charge_amount, charge_type, fee_invoice_item_id, return_notes, created_at, updated_at,
         inventory_item:inventory_item_id(id, name, category, must_be_returned, return_duration_days, charge_type, charge_amount, is_chargeable)`,
        { count: 'exact' }
      )
      .eq('school_code', schoolCode)
      .order('issue_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.inventory_item_id) query = query.eq('inventory_item_id', filters.inventory_item_id);
    if (filters.issued_to_type) query = query.eq('issued_to_type', filters.issued_to_type);
    if (filters.issued_to_id) query = query.eq('issued_to_id', filters.issued_to_id);

    const { data, error, count } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return { data: [], total: count ?? 0 };

    // Resolve student / staff names (mobile parity)
    const studentIds = [...new Set(data.filter(i => i.issued_to_type === 'student').map(i => i.issued_to_id))];
    const staffIds   = [...new Set(data.filter(i => i.issued_to_type === 'staff').map(i => i.issued_to_id))];

    const studentNames = new Map();
    const staffNames = new Map();

    if (studentIds.length) {
      const { data: students } = await supabase
        .from('student')
        .select('id, full_name, student_code')
        .in('id', studentIds);
      students?.forEach(s => studentNames.set(s.id, s));
    }
    if (staffIds.length) {
      const { data: staff } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', staffIds)
        .eq('school_code', schoolCode);
      staff?.forEach(s => staffNames.set(s.id, s));
    }

    const mapped = data.map(issue => {
      let issued_to_name = issue.issued_to_type === 'student' ? 'Unknown Student' : 'Unknown Staff';
      if (issue.issued_to_type === 'student' && studentNames.has(issue.issued_to_id)) {
        const s = studentNames.get(issue.issued_to_id);
        issued_to_name = s.student_code ? `${s.full_name} (${s.student_code})` : s.full_name;
      } else if (issue.issued_to_type === 'staff' && staffNames.has(issue.issued_to_id)) {
        issued_to_name = staffNames.get(issue.issued_to_id).full_name;
      }
      return { ...issue, issued_to_name };
    });

    return { data: mapped, total: count ?? 0 };
  },

  /**
   * Return / mark-as-lost — mirrors mobile returnIssue behaviour byte-for-byte:
   *  - update issue status, returned_date, return_notes
   *  - reverse stock if tracked
   *  - reverse fees: deposits → negative refund line, one-time → delete row
   *    (or fallback by label match), then recalc invoice total
   */
  async returnIssue(schoolCode, issueId, options = {}) {
    const { data: issue, error: issueError } = await supabase
      .from('inventory_issues')
      .select(`*, inventory_item:inventory_item_id(*)`)
      .eq('id', issueId)
      .eq('school_code', schoolCode)
      .single();

    if (issueError || !issue) throw new Error('Inventory issue not found');
    if (issue.status === 'returned') throw new Error('This item has already been returned');

    const item = issue.inventory_item;
    if (!item) throw new Error('Inventory item not found');

    const newStatus = options.mark_as_lost ? 'lost' : 'returned';
    const { error: updateError } = await supabase
      .from('inventory_issues')
      .update({
        status: newStatus,
        returned_date: newStatus === 'returned' ? getTodayISO() : null,
        return_notes: options.return_notes || null,
      })
      .eq('id', issueId)
      .eq('school_code', schoolCode);
    if (updateError) throw updateError;

    if (item.track_quantity && item.current_quantity !== null && item.current_quantity !== undefined) {
      await inventoryItemsService.update(issue.inventory_item_id, schoolCode, {
        current_quantity: Number(item.current_quantity) + issue.quantity,
      });
    }

    const chargeAmount = issue.charge_amount || 0;
    const chargeType = issue.charge_type;

    if (chargeAmount > 0 && chargeType && issue.issued_to_type === 'student') {
      try {
        let invoiceItemId = issue.fee_invoice_item_id;
        let invoiceId = null;

        if (invoiceItemId) {
          const { data: invoiceItem } = await supabase
            .from('fee_invoice_items')
            .select('invoice_id, amount')
            .eq('id', invoiceItemId)
            .maybeSingle();
          if (invoiceItem) invoiceId = invoiceItem.invoice_id;
        }

        if (!invoiceId && issue.issued_to_id) {
          const { data: academicYear } = await supabase
            .from('academic_years')
            .select('id, year_start, year_end')
            .eq('school_code', schoolCode)
            .eq('is_active', true)
            .single();

          if (academicYear) {
            const billingPeriod = `${academicYear.year_start}-${academicYear.year_end}`;
            const { data: invoice } = await supabase
              .from('fee_invoices')
              .select('id')
              .eq('student_id', issue.issued_to_id)
              .eq('school_code', schoolCode)
              .eq('billing_period', billingPeriod)
              .eq('academic_year_id', academicYear.id)
              .maybeSingle();

            if (invoice) {
              invoiceId = invoice.id;
              const itemLabel = `${item.name}${issue.quantity > 1 ? ` (x${issue.quantity})` : ''}`;
              const { data: matchingItem } = await supabase
                .from('fee_invoice_items')
                .select('id')
                .eq('invoice_id', invoiceId)
                .eq('label', itemLabel)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              if (matchingItem) invoiceItemId = matchingItem.id;
            }
          }
        }

        if (invoiceId) {
          if (chargeType === 'deposit') {
            await addInvoiceItems(invoiceId, [{
              label: `Refund: ${item.name}${issue.quantity > 1 ? ` (x${issue.quantity})` : ''} - Returned`,
              amount: -Math.abs(chargeAmount) * issue.quantity,
            }]);
          } else {
            // one-time → delete the line; fallback to label match; finally fallback to negative line
            if (invoiceItemId) {
              const { error } = await supabase
                .from('fee_invoice_items')
                .delete()
                .eq('id', invoiceItemId);
              if (error) throw error;
            } else {
              const itemLabel = `${item.name}${issue.quantity > 1 ? ` (x${issue.quantity})` : ''}`;
              const { data: matchingItems } = await supabase
                .from('fee_invoice_items')
                .select('id')
                .eq('invoice_id', invoiceId)
                .eq('label', itemLabel);
              if (matchingItems && matchingItems.length > 0) {
                const { error } = await supabase
                  .from('fee_invoice_items')
                  .delete()
                  .eq('id', matchingItems[0].id);
                if (error) throw error;
              } else {
                await addInvoiceItems(invoiceId, [{
                  label: `Refund: ${item.name}${issue.quantity > 1 ? ` (x${issue.quantity})` : ''} - Returned`,
                  amount: -Math.abs(chargeAmount) * issue.quantity,
                }]);
              }
            }

            // Recalc total after raw delete
            const { data: remainingItems } = await supabase
              .from('fee_invoice_items')
              .select('amount')
              .eq('invoice_id', invoiceId);
            if (remainingItems) {
              const newTotal = remainingItems.reduce(
                (sum, it) => sum + parseFloat(it.amount?.toString?.() ?? it.amount ?? 0),
                0
              );
              await supabase
                .from('fee_invoices')
                .update({ total_amount: newTotal })
                .eq('id', invoiceId);
            }
          }
        }
      } catch (feeError) {
        throw new Error(`Failed to reverse charge: ${feeError.message || 'Unknown error'}`);
      }
    }
  },
};

// ── Web-native bulk operations ───────────────────────────────────────────────

export const inventoryBulkService = {
  async bulkSoftDelete(schoolCode, ids) {
    if (!ids?.length) return;
    const { error } = await supabase
      .from('inventory_items')
      .update({ is_active: false })
      .in('id', ids)
      .eq('school_code', schoolCode);
    if (error) throw error;
  },

  /**
   * Issue an item to many recipients at once. For each recipient, reuses
   * inventoryIssuesService.issue so fee linkage stays identical to the
   * single-issue path. Returns per-recipient success/error.
   */
  async batchIssue(schoolCode, userId, input) {
    const results = [];
    for (const recipient of input.recipients) {
      try {
        const r = await inventoryIssuesService.issue(schoolCode, userId, {
          inventory_item_id: input.inventory_item_id,
          issued_to_type: input.issued_to_type,
          issued_to_id: recipient.id,
          quantity: input.quantity,
          serial_number: recipient.serial_number,
          charge_amount_override: input.charge_amount_override,
        });
        results.push({ id: recipient.id, name: recipient.name, ok: true, issue_id: r.id });
      } catch (e) {
        results.push({ id: recipient.id, name: recipient.name, ok: false, error: e.message || 'Failed' });
      }
    }
    return results;
  },
};

// ── Reference data ───────────────────────────────────────────────────────────

export const inventoryRefService = {
  async listClasses(schoolCode) {
    const { data, error } = await supabase
      .from('class_instances')
      .select('id, grade, section')
      .eq('school_code', schoolCode)
      .order('grade')
      .order('section');
    if (error) throw error;
    return data || [];
  },

  async listStudentsByClass(schoolCode, classId) {
    let query = supabase
      .from('student')
      .select('id, full_name, student_code, class_instance_id')
      .eq('school_code', schoolCode)
      .order('full_name');
    if (classId) query = query.eq('class_instance_id', classId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async listStaff(schoolCode) {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, role')
      .eq('school_code', schoolCode)
      .in('role', ['admin', 'teacher', 'cb_admin', 'superadmin'])
      .order('full_name');
    if (error) throw error;
    return data || [];
  },
};
