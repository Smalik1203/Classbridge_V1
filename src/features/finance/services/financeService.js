import { supabase } from '@/config/supabaseClient';

/**
 * Finance service — direct port of mobile `src/services/finance.ts`.
 *
 * Cash-basis accounting (single-entry, type=income|expense, amount>0).
 * Schema: finance_accounts (cash/bank/virtual), finance_categories
 * (income/expense), finance_transactions, finance_transaction_links.
 * RPCs: log_finance_operation, detect_finance_inconsistencies.
 *
 * Web UI rebuilt with AntD; this layer is byte-compatible with mobile so a
 * transaction posted from web vs mobile is indistinguishable downstream
 * (fee→finance auto-posting, audit log, inconsistency detection all work).
 *
 * Auth model: super-admin only. Mobile uses a `super_admin` table to resolve
 * the user's school_code; web prefers metadata but falls back to the same
 * table for parity.
 */

// ── Enum helpers ─────────────────────────────────────────────────────────────

export const ACCOUNT_TYPES = [
  { label: 'Cash',    value: 'cash'    },
  { label: 'Bank',    value: 'bank'    },
  { label: 'Virtual', value: 'virtual' },
];

export const CATEGORY_TYPES = [
  { label: 'Income',  value: 'income'  },
  { label: 'Expense', value: 'expense' },
];

export const TXN_TYPES = ['income', 'expense'];

// ── Auth / school resolution (mirrors mobile getSuperAdminSchoolCode) ────────

export async function resolveSchoolCode(user) {
  if (!user) throw new Error('Not authenticated');

  // Prefer the metadata path used everywhere else on web.
  const meta = (
    user.raw_app_meta_data?.school_code ||
    user.app_metadata?.school_code ||
    user.raw_user_meta_data?.school_code ||
    user.user_metadata?.school_code ||
    null
  );
  if (meta) return meta;

  // Fallback: super_admin lookup, identical to mobile finance.ts.
  const { data, error } = await supabase
    .from('super_admin')
    .select('school_code')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data?.school_code) throw new Error('Super admin not found or missing school_code');
  return data.school_code;
}

// ── Audit log (best-effort; never blocks the write) ──────────────────────────

async function logFinanceOperation({
  schoolCode, eventType, resourceType, resourceId, userId, userRole, details,
}) {
  try {
    const { error } = await supabase.rpc('log_finance_operation', {
      p_school_code:   schoolCode,
      p_event_type:    eventType,
      p_resource_type: resourceType,
      p_resource_id:   resourceId,
      p_user_id:       userId,
      p_user_role:     userRole,
      p_action_details: details || {},
      p_ip_address:    undefined,
      p_user_agent:    undefined,
    });
    if (error) console.warn('[finance] audit log failed', error.message);
  } catch (err) {
    console.warn('[finance] audit log threw', err);
  }
}

// ── Accounts ─────────────────────────────────────────────────────────────────

export const financeAccountsService = {
  async list(schoolCode, { includeInactive = false } = {}) {
    let q = supabase
      .from('finance_accounts')
      .select('id, school_code, name, type, is_active, created_at, updated_at, created_by')
      .eq('school_code', schoolCode)
      .order('name');
    if (!includeInactive) q = q.eq('is_active', true);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('finance_accounts')
      .select('id, school_code, name, type, is_active, created_at, updated_at, created_by')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create({ schoolCode, name, type, userId, userRole }) {
    if (!name?.trim()) throw new Error('Account name is required');
    if (!['cash', 'bank', 'virtual'].includes(type)) throw new Error('Invalid account type');
    const { data, error } = await supabase
      .from('finance_accounts')
      .insert({
        school_code: schoolCode,
        name: name.trim(),
        type,
        is_active: true,
        created_by: userId,
      })
      .select('id, school_code, name, type, is_active, created_at, updated_at, created_by')
      .single();
    if (error) throw error;
    await logFinanceOperation({
      schoolCode, eventType: 'create', resourceType: 'account',
      resourceId: data.id, userId, userRole, details: { name, type },
    });
    return data;
  },

  async update({ id, schoolCode, name, type, isActive, userId, userRole }) {
    const patch = {};
    if (name !== undefined)     patch.name = name.trim();
    if (type !== undefined)     patch.type = type;
    if (isActive !== undefined) patch.is_active = isActive;
    patch.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('finance_accounts')
      .update(patch)
      .eq('id', id)
      .select('id, school_code, name, type, is_active, created_at, updated_at, created_by')
      .single();
    if (error) throw error;
    await logFinanceOperation({
      schoolCode, eventType: 'update', resourceType: 'account',
      resourceId: id, userId, userRole, details: patch,
    });
    return data;
  },

  async deactivate({ id, schoolCode, userId, userRole }) {
    return this.update({ id, schoolCode, isActive: false, userId, userRole });
  },

  /**
   * Mirror mobile ensureDefaultAccounts — get-or-create Cash / Bank Account / UPI.
   * Same names so fee→finance auto-posting (mobile) keeps working.
   */
  async ensureDefaults(schoolCode, userId) {
    const ensure = async (name, type) => {
      const { data: existing } = await supabase
        .from('finance_accounts')
        .select('id')
        .eq('school_code', schoolCode)
        .eq('name', name)
        .maybeSingle();
      if (existing) return existing.id;
      const { data, error } = await supabase
        .from('finance_accounts')
        .insert({ school_code: schoolCode, name, type, is_active: true, created_by: userId })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    };
    const [cash, bank, online] = await Promise.all([
      ensure('Cash', 'cash'),
      ensure('Bank Account', 'bank'),
      ensure('UPI', 'virtual'),
    ]);
    return { cash, bank, online };
  },
};

// ── Categories ───────────────────────────────────────────────────────────────

export const financeCategoriesService = {
  async list(schoolCode, { type, includeInactive = false } = {}) {
    let q = supabase
      .from('finance_categories')
      .select('id, school_code, name, type, is_active, created_at, updated_at, created_by')
      .eq('school_code', schoolCode)
      .order('name');
    if (!includeInactive) q = q.eq('is_active', true);
    if (type) q = q.eq('type', type);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async create({ schoolCode, name, type, userId, userRole }) {
    if (!name?.trim()) throw new Error('Category name is required');
    if (!['income', 'expense'].includes(type)) throw new Error('Invalid category type');
    const { data, error } = await supabase
      .from('finance_categories')
      .insert({
        school_code: schoolCode,
        name: name.trim(),
        type,
        is_active: true,
        created_by: userId,
      })
      .select('id, school_code, name, type, is_active, created_at, updated_at, created_by')
      .single();
    if (error) throw error;
    await logFinanceOperation({
      schoolCode, eventType: 'create', resourceType: 'category',
      resourceId: data.id, userId, userRole, details: { name, type },
    });
    return data;
  },

  async update({ id, schoolCode, name, type, isActive, userId, userRole }) {
    const patch = {};
    if (name !== undefined)     patch.name = name.trim();
    if (type !== undefined)     patch.type = type;
    if (isActive !== undefined) patch.is_active = isActive;
    patch.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('finance_categories')
      .update(patch)
      .eq('id', id)
      .select('id, school_code, name, type, is_active, created_at, updated_at, created_by')
      .single();
    if (error) throw error;
    await logFinanceOperation({
      schoolCode, eventType: 'update', resourceType: 'category',
      resourceId: id, userId, userRole, details: patch,
    });
    return data;
  },

  async deactivate({ id, schoolCode, userId, userRole }) {
    return this.update({ id, schoolCode, isActive: false, userId, userRole });
  },

  async ensureFeesCategory(schoolCode, userId) {
    const { data: existing } = await supabase
      .from('finance_categories')
      .select('id')
      .eq('school_code', schoolCode)
      .eq('name', 'Fees')
      .eq('type', 'income')
      .maybeSingle();
    if (existing) return existing.id;
    const { data, error } = await supabase
      .from('finance_categories')
      .insert({ school_code: schoolCode, name: 'Fees', type: 'income', is_active: true, created_by: userId })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  },
};

// ── Transactions ─────────────────────────────────────────────────────────────

const TXN_SELECT = `
  id, school_code, txn_date, amount, type, category_id, account_id,
  description, created_by, created_at, updated_at, deleted_at,
  category:finance_categories(id, name, type),
  account:finance_accounts(id, name, type)
`;

export const financeTransactionsService = {
  async list({
    schoolCode, startDate, endDate, type, categoryId, accountId,
    search, limit = 200, offset = 0, includeDeleted = false,
  }) {
    let q = supabase
      .from('finance_transactions')
      .select(TXN_SELECT, { count: 'exact' })
      .eq('school_code', schoolCode)
      .order('txn_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (!includeDeleted) q = q.is('deleted_at', null);
    if (startDate)       q = q.gte('txn_date', startDate);
    if (endDate)         q = q.lte('txn_date', endDate);
    if (type)            q = q.eq('type', type);
    if (categoryId)      q = q.eq('category_id', categoryId);
    if (accountId)       q = q.eq('account_id', accountId);
    if (search?.trim())  q = q.ilike('description', `%${search.trim()}%`);
    if (limit)           q = q.range(offset, offset + limit - 1);

    const { data, error, count } = await q;
    if (error) throw error;
    return { data: data || [], total: count || 0 };
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('finance_transactions')
      .select(TXN_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  /**
   * Source links (used to detect fee_payment-derived rows that must stay read-only).
   */
  async getLinks(transactionId) {
    const { data, error } = await supabase
      .from('finance_transaction_links')
      .select('id, finance_transaction_id, source_type, source_id, created_at')
      .eq('finance_transaction_id', transactionId);
    if (error) throw error;
    return data || [];
  },

  /**
   * Create a single income or expense transaction. Mirrors mobile
   * createTransaction including idempotency-by-source and the
   * transaction-rollback-if-link-fails path.
   */
  async create({
    schoolCode, txnDate, amount, type, categoryId, accountId, description,
    sourceType = 'manual', sourceId, userId, userRole,
  }) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) throw new Error('Amount must be greater than 0');
    if (!['income', 'expense'].includes(type)) throw new Error('Type must be income or expense');
    if (!txnDate)    throw new Error('Date is required');
    if (!categoryId) throw new Error('Category is required');
    if (!accountId)  throw new Error('Account is required');

    // Validate category belongs to same school + type matches.
    const { data: cat, error: catErr } = await supabase
      .from('finance_categories')
      .select('school_code, type')
      .eq('id', categoryId)
      .single();
    if (catErr || !cat) throw new Error('Category not found');
    if (cat.school_code !== schoolCode) throw new Error('Category school mismatch');
    if (cat.type !== type) {
      throw new Error(`Category type (${cat.type}) does not match transaction type (${type})`);
    }
    const { data: acc, error: accErr } = await supabase
      .from('finance_accounts')
      .select('school_code')
      .eq('id', accountId)
      .single();
    if (accErr || !acc) throw new Error('Account not found');
    if (acc.school_code !== schoolCode) throw new Error('Account school mismatch');

    // Idempotency.
    const effectiveSourceType = sourceType || 'manual';
    const effectiveSourceId   = sourceId   || (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    const { data: existingLink } = await supabase
      .from('finance_transaction_links')
      .select('id, finance_transaction_id')
      .eq('source_type', effectiveSourceType)
      .eq('source_id', effectiveSourceId)
      .maybeSingle();
    if (existingLink) return { id: existingLink.finance_transaction_id, deduped: true };

    const { data: txn, error: txnErr } = await supabase
      .from('finance_transactions')
      .insert({
        school_code: schoolCode,
        txn_date: txnDate,
        amount: amt,
        type,
        category_id: categoryId,
        account_id: accountId,
        description: description?.trim() || null,
        created_by: userId,
      })
      .select('id')
      .single();
    if (txnErr) throw txnErr;

    const { error: linkErr } = await supabase
      .from('finance_transaction_links')
      .insert({
        finance_transaction_id: txn.id,
        source_type: effectiveSourceType,
        source_id:   effectiveSourceId,
      });
    if (linkErr) {
      // Rollback (soft) — same recovery as mobile.
      await supabase
        .from('finance_transactions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', txn.id);
      throw linkErr;
    }

    await logFinanceOperation({
      schoolCode, eventType: 'create', resourceType: 'transaction',
      resourceId: txn.id, userId, userRole,
      details: { amount: amt, type, category_id: categoryId, account_id: accountId,
        source_type: effectiveSourceType, source_id: effectiveSourceId },
    });
    return { id: txn.id, deduped: false };
  },

  /**
   * Edit a manual transaction. Fee-derived rows (fee_payment) cannot be edited
   * because they would diverge from the underlying receipt.
   */
  async update({ id, schoolCode, patch, userId, userRole }) {
    const links = await this.getLinks(id);
    if (links.some(l => l.source_type === 'fee_payment')) {
      throw new Error('Cannot edit fee-derived income transactions');
    }
    if (links.some(l => l.source_type === 'salary')) {
      throw new Error('Cannot edit payroll-derived expense transactions');
    }
    const allowed = {};
    if (patch.txn_date    !== undefined) allowed.txn_date    = patch.txn_date;
    if (patch.amount      !== undefined) {
      const amt = Number(patch.amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error('Amount must be greater than 0');
      allowed.amount = amt;
    }
    if (patch.category_id !== undefined) allowed.category_id = patch.category_id;
    if (patch.account_id  !== undefined) allowed.account_id  = patch.account_id;
    if (patch.type        !== undefined) allowed.type        = patch.type;
    if (patch.description !== undefined) allowed.description = patch.description?.trim() || null;
    allowed.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('finance_transactions')
      .update(allowed)
      .eq('id', id)
      .select(TXN_SELECT)
      .single();
    if (error) throw error;

    await logFinanceOperation({
      schoolCode, eventType: 'update', resourceType: 'transaction',
      resourceId: id, userId, userRole, details: allowed,
    });
    return data;
  },

  /**
   * Soft-delete (mirrors mobile). Fee-derived rows cannot be removed.
   */
  async softDelete({ id, schoolCode, userId, userRole, reason }) {
    const links = await this.getLinks(id);
    if (links.some(l => l.source_type === 'fee_payment')) {
      throw new Error('Cannot delete fee-derived income transactions');
    }
    const { error } = await supabase
      .from('finance_transactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await logFinanceOperation({
      schoolCode, eventType: 'delete', resourceType: 'transaction',
      resourceId: id, userId, userRole, details: { soft_delete: true, reason: reason || null },
    });
  },

  /**
   * Restore a soft-deleted transaction (web-native; mobile has no UI for it).
   */
  async restore({ id, schoolCode, userId, userRole }) {
    const { error } = await supabase
      .from('finance_transactions')
      .update({ deleted_at: null })
      .eq('id', id);
    if (error) throw error;
    await logFinanceOperation({
      schoolCode, eventType: 'update', resourceType: 'transaction',
      resourceId: id, userId, userRole, details: { restored: true },
    });
  },

  /**
   * Bulk insert (web-native — used by CSV/XLSX import for opening balances and
   * historical entries). Each row goes through the same single-row create path
   * to preserve validation, idempotency, and audit logging.
   */
  async bulkCreate({ schoolCode, rows, userId, userRole, onProgress }) {
    const results = { ok: 0, failed: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        await this.create({
          schoolCode,
          txnDate: r.txn_date,
          amount: r.amount,
          type: r.type,
          categoryId: r.category_id,
          accountId: r.account_id,
          description: r.description,
          sourceType: r.source_type || 'manual',
          sourceId:   r.source_id   || undefined,
          userId, userRole,
        });
        results.ok++;
      } catch (err) {
        results.failed++;
        results.errors.push({ row: i + 1, message: err.message || String(err) });
      }
      onProgress?.(i + 1, rows.length);
    }
    return results;
  },
};

// ── Reports ──────────────────────────────────────────────────────────────────

export const financeReportsService = {
  async incomeVsExpense({ schoolCode, startDate, endDate }) {
    const { data, error } = await supabase
      .from('finance_transactions')
      .select('amount, type')
      .eq('school_code', schoolCode)
      .gte('txn_date', startDate)
      .lte('txn_date', endDate)
      .is('deleted_at', null);
    if (error) throw error;
    let income = 0, expense = 0;
    (data || []).forEach(r => {
      const a = Number(r.amount);
      if (r.type === 'income') income += a; else expense += a;
    });
    return {
      total_income:  income,
      total_expense: expense,
      net_income:    income - expense,
      period_start:  startDate,
      period_end:    endDate,
    };
  },

  async monthlySummary({ schoolCode, startDate, endDate }) {
    const { data, error } = await supabase
      .from('finance_transactions')
      .select('txn_date, amount, type')
      .eq('school_code', schoolCode)
      .gte('txn_date', startDate)
      .lte('txn_date', endDate)
      .is('deleted_at', null)
      .order('txn_date');
    if (error) throw error;
    const map = new Map();
    (data || []).forEach(r => {
      const m = r.txn_date.substring(0, 7);
      if (!map.has(m)) map.set(m, { month: m, total_income: 0, total_expense: 0, net_income: 0, transaction_count: 0 });
      const row = map.get(m);
      const amt = Number(r.amount);
      if (r.type === 'income') row.total_income += amt; else row.total_expense += amt;
      row.transaction_count++;
    });
    const out = Array.from(map.values()).map(r => ({ ...r, net_income: r.total_income - r.total_expense }));
    out.sort((a, b) => a.month.localeCompare(b.month));
    return out;
  },

  /**
   * P&L report — income vs expense grouped by category.
   */
  async profitAndLoss({ schoolCode, startDate, endDate }) {
    const { data, error } = await supabase
      .from('finance_transactions')
      .select('amount, type, category:finance_categories(id, name, type)')
      .eq('school_code', schoolCode)
      .gte('txn_date', startDate)
      .lte('txn_date', endDate)
      .is('deleted_at', null);
    if (error) throw error;
    const incomeMap = new Map();
    const expenseMap = new Map();
    (data || []).forEach(r => {
      const cat = r.category || { id: 'unknown', name: 'Uncategorized', type: r.type };
      const map = r.type === 'income' ? incomeMap : expenseMap;
      if (!map.has(cat.id)) map.set(cat.id, { id: cat.id, name: cat.name, total: 0, count: 0 });
      const row = map.get(cat.id);
      row.total += Number(r.amount);
      row.count++;
    });
    const income  = Array.from(incomeMap.values()).sort((a, b) => b.total - a.total);
    const expense = Array.from(expenseMap.values()).sort((a, b) => b.total - a.total);
    const totalIncome  = income.reduce((s, r) => s + r.total, 0);
    const totalExpense = expense.reduce((s, r) => s + r.total, 0);
    return {
      income, expense,
      total_income: totalIncome,
      total_expense: totalExpense,
      net_income: totalIncome - totalExpense,
      period_start: startDate,
      period_end: endDate,
    };
  },

  /**
   * Trial Balance / Account Activity — totals per finance account
   * (cash-basis, so closing balance = sum income - sum expense per account
   * within the period, plus opening balance prior to start_date).
   */
  async trialBalance({ schoolCode, startDate, endDate }) {
    const accounts = await financeAccountsService.list(schoolCode, { includeInactive: true });
    const openingByAccount = new Map();
    if (startDate) {
      const { data: openings, error: oerr } = await supabase
        .from('finance_transactions')
        .select('amount, type, account_id')
        .eq('school_code', schoolCode)
        .lt('txn_date', startDate)
        .is('deleted_at', null);
      if (oerr) throw oerr;
      (openings || []).forEach(r => {
        const cur = openingByAccount.get(r.account_id) || 0;
        openingByAccount.set(r.account_id, cur + (r.type === 'income' ? Number(r.amount) : -Number(r.amount)));
      });
    }
    const { data: period, error } = await supabase
      .from('finance_transactions')
      .select('amount, type, account_id')
      .eq('school_code', schoolCode)
      .gte('txn_date', startDate)
      .lte('txn_date', endDate)
      .is('deleted_at', null);
    if (error) throw error;
    const movement = new Map();
    (period || []).forEach(r => {
      if (!movement.has(r.account_id)) movement.set(r.account_id, { income: 0, expense: 0 });
      const row = movement.get(r.account_id);
      if (r.type === 'income') row.income += Number(r.amount); else row.expense += Number(r.amount);
    });
    return accounts.map(a => {
      const opening = openingByAccount.get(a.id) || 0;
      const m = movement.get(a.id) || { income: 0, expense: 0 };
      const closing = opening + m.income - m.expense;
      return {
        account_id: a.id,
        account_name: a.name,
        account_type: a.type,
        opening,
        income: m.income,
        expense: m.expense,
        closing,
      };
    });
  },

  /**
   * General Ledger for one account over a date range, with running balance.
   */
  async accountLedger({ schoolCode, accountId, startDate, endDate }) {
    let opening = 0;
    if (startDate) {
      const { data: priors, error: perr } = await supabase
        .from('finance_transactions')
        .select('amount, type')
        .eq('school_code', schoolCode)
        .eq('account_id', accountId)
        .lt('txn_date', startDate)
        .is('deleted_at', null);
      if (perr) throw perr;
      (priors || []).forEach(r => {
        opening += r.type === 'income' ? Number(r.amount) : -Number(r.amount);
      });
    }
    const { data, error } = await supabase
      .from('finance_transactions')
      .select(TXN_SELECT)
      .eq('school_code', schoolCode)
      .eq('account_id', accountId)
      .gte('txn_date', startDate)
      .lte('txn_date', endDate)
      .is('deleted_at', null)
      .order('txn_date', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    let running = opening;
    const lines = (data || []).map(r => {
      const delta = r.type === 'income' ? Number(r.amount) : -Number(r.amount);
      running += delta;
      return { ...r, delta, running_balance: running };
    });
    return { opening_balance: opening, lines, closing_balance: running };
  },

  /**
   * Category Ledger — every transaction touching a specific category.
   */
  async categoryLedger({ schoolCode, categoryId, startDate, endDate }) {
    const { data, error } = await supabase
      .from('finance_transactions')
      .select(TXN_SELECT)
      .eq('school_code', schoolCode)
      .eq('category_id', categoryId)
      .gte('txn_date', startDate)
      .lte('txn_date', endDate)
      .is('deleted_at', null)
      .order('txn_date', { ascending: false });
    if (error) throw error;
    const total = (data || []).reduce((s, r) => s + Number(r.amount), 0);
    return { lines: data || [], total };
  },

  /**
   * Daily aggregation for charts.
   */
  async dailySeries({ schoolCode, startDate, endDate }) {
    const { data, error } = await supabase
      .from('finance_transactions')
      .select('txn_date, amount, type')
      .eq('school_code', schoolCode)
      .gte('txn_date', startDate)
      .lte('txn_date', endDate)
      .is('deleted_at', null)
      .order('txn_date');
    if (error) throw error;
    const map = new Map();
    (data || []).forEach(r => {
      if (!map.has(r.txn_date)) map.set(r.txn_date, { date: r.txn_date, income: 0, expense: 0 });
      const row = map.get(r.txn_date);
      const amt = Number(r.amount);
      if (r.type === 'income') row.income += amt; else row.expense += amt;
    });
    return Array.from(map.values())
      .map(r => ({ ...r, net: r.income - r.expense }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
};

// ── Inconsistencies / Audit ─────────────────────────────────────────────────

export const financeAuditService = {
  async detectInconsistencies({ schoolCode, startDate, endDate }) {
    const { data, error } = await supabase.rpc('detect_finance_inconsistencies', {
      p_school_code: schoolCode,
      p_start_date:  startDate,
      p_end_date:    endDate,
    });
    if (error) throw error;
    return (data || []).map(r => ({
      inconsistency_type: r.inconsistency_type,
      description:        r.description,
      severity:           r.severity,
      affected_count:     Number(r.affected_count),
      details:            r.details || [],
    }));
  },

  /**
   * Pull recent audit entries (best-effort — table may not be readable
   * depending on RLS; in that case we surface a quiet empty list).
   */
  async listRecent({ schoolCode, limit = 50, resourceType, resourceId }) {
    let q = supabase
      .from('finance_audit_log')
      .select('id, school_code, event_type, resource_type, resource_id, user_id, user_role, action_details, created_at')
      .eq('school_code', schoolCode)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (resourceType) q = q.eq('resource_type', resourceType);
    if (resourceId)   q = q.eq('resource_id', resourceId);
    const { data, error } = await q;
    if (error) {
      console.warn('[finance] audit log read failed', error.message);
      return [];
    }
    return data || [];
  },

  logExport({ schoolCode, exportType, startDate, endDate, userId, userRole }) {
    return logFinanceOperation({
      schoolCode, eventType: 'export', resourceType: 'report',
      resourceId: null, userId, userRole,
      details: { export_type: exportType, start_date: startDate, end_date: endDate },
    });
  },
};

// ── Re-exports for convenience ─────────────────────────────────────────────

export const financeService = {
  resolveSchoolCode,
  accounts:    financeAccountsService,
  categories:  financeCategoriesService,
  transactions: financeTransactionsService,
  reports:     financeReportsService,
  audit:       financeAuditService,
};

export default financeService;
