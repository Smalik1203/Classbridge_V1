import { supabase } from '@/config/supabaseClient';

/**
 * Tax compliance service — Form 12BB declarations, regime choice, computation.
 * Talks to schema introduced in migration `tax_compliance_phase_1_1_schema`
 * and the RPCs `compute_employee_tax` + `_compute_tax_from_inputs`.
 */
export const taxService = {
  // ── financial year helper ────────────────────────────────────────────────
  // Indian FY runs Apr→Mar. Today=2026-04-29 → FY '2026-27'.
  currentFY(d = new Date()) {
    const y = d.getFullYear();
    const m = d.getMonth() + 1; // 1-12
    const startYear = m >= 4 ? y : y - 1;
    const endShort = String((startYear + 1) % 100).padStart(2, '0');
    return `${startYear}-${endShort}`;
  },

  // ── regime choice ────────────────────────────────────────────────────────
  async getRegime(employeeId, financialYear) {
    const { data, error } = await supabase
      .from('employee_tax_regime')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('financial_year', financialYear)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async setRegime({ employeeId, schoolCode, financialYear, regime }) {
    const { data, error } = await supabase
      .from('employee_tax_regime')
      .upsert(
        { employee_id: employeeId, school_code: schoolCode, financial_year: financialYear, regime, declared_at: new Date().toISOString() },
        { onConflict: 'employee_id,financial_year' },
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ── declarations (Form 12BB) ─────────────────────────────────────────────
  async getDeclaration(employeeId, financialYear) {
    const { data, error } = await supabase
      .from('employee_tax_declarations')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('financial_year', financialYear)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async upsertDeclaration(payload) {
    const { data, error } = await supabase
      .from('employee_tax_declarations')
      .upsert(
        { ...payload, updated_at: new Date().toISOString() },
        { onConflict: 'employee_id,financial_year' },
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async submitDeclaration(declarationId) {
    const { data, error } = await supabase
      .from('employee_tax_declarations')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', declarationId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async verifyDeclaration(declarationId, verifiedBy) {
    const { data, error } = await supabase
      .from('employee_tax_declarations')
      .update({
        status: 'verified',
        verified_at: new Date().toISOString(),
        verified_by: verifiedBy,
        rejected_reason: null,
      })
      .eq('id', declarationId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async rejectDeclaration(declarationId, reason) {
    const { data, error } = await supabase
      .from('employee_tax_declarations')
      .update({
        status: 'rejected',
        rejected_reason: reason ?? null,
      })
      .eq('id', declarationId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async listDeclarationsForSchool(schoolCode, financialYear) {
    const { data, error } = await supabase
      .from('employee_tax_declarations')
      .select('*, employees(id, full_name, employee_code, department, designation, pan_number)')
      .eq('school_code', schoolCode)
      .eq('financial_year', financialYear)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  // ── proofs ───────────────────────────────────────────────────────────────
  async listProofs(declarationId) {
    const { data, error } = await supabase
      .from('employee_tax_proofs')
      .select('*')
      .eq('declaration_id', declarationId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async addProof({ declarationId, schoolCode, head, amountProof, fileUrl }) {
    const { data, error } = await supabase
      .from('employee_tax_proofs')
      .insert({
        declaration_id: declarationId,
        school_code: schoolCode,
        head,
        amount_proof: amountProof,
        file_url: fileUrl,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async reviewProof({ proofId, status, reviewedBy, notes }) {
    const { data, error } = await supabase
      .from('employee_tax_proofs')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy,
        notes: notes ?? null,
      })
      .eq('id', proofId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ── computation ──────────────────────────────────────────────────────────
  /**
   * Compute tax using saved declaration + active salary structure.
   * Persisted nowhere; caller decides if/when to snapshot to employee_tax_computation.
   */
  async computeForEmployee(employeeId, financialYear, basis = 'declared') {
    const { data, error } = await supabase.rpc('compute_employee_tax', {
      p_employee_id: employeeId,
      p_financial_year: financialYear,
      p_basis: basis,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Compute tax from raw inputs — used by the live "what-if" preview while the
   * employee is still drafting their declaration. Doesn't touch DB.
   *
   * inputs jsonb shape — see _compute_tax_from_inputs in DB.
   */
  async previewFromInputs(inputs, financialYear, regime) {
    const { data, error } = await supabase.rpc('_compute_tax_from_inputs', {
      p_inputs: inputs,
      p_financial_year: financialYear,
      p_regime: regime,
    });
    if (error) throw error;
    return data;
  },

  // ── 15G/H ────────────────────────────────────────────────────────────────
  async listForm15GH(employeeId, financialYear) {
    const { data, error } = await supabase
      .from('form_15g_h_declarations')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('financial_year', financialYear)
      .order('declared_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async addForm15GH(payload) {
    const { data, error } = await supabase
      .from('form_15g_h_declarations')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ── Form 16 ──────────────────────────────────────────────────────────────
  /**
   * Generate Form 16 Part B for an employee. Pulls taxable-income breakdown
   * from employee_tax_computation snapshot and quarterly TDS from payslips.
   * Returns { html_content, meta } shaped for HrDocumentViewer.
   */
  async generateForm16PartB(employeeId, financialYear) {
    const { data, error } = await supabase.rpc('generate_form_16_part_b', {
      p_employee_id: employeeId,
      p_financial_year: financialYear,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Form 16 status across all employees for a given FY — used for the HR
   * coverage table. Joins employees + computation snapshot + payslip totals.
   */
  async listForm16Coverage(schoolCode, financialYear) {
    const fyStart = parseInt(financialYear.split('-')[0], 10);

    const [{ data: employees, error: empErr }, { data: computations, error: compErr }, { data: payslips, error: psErr }] = await Promise.all([
      supabase
        .from('employees')
        .select('id, full_name, employee_code, designation, department, pan_number, is_tds_applicable, status')
        .eq('school_code', schoolCode)
        .eq('status', 'active')
        .order('full_name'),
      supabase
        .from('employee_tax_computation')
        .select('employee_id, regime, annual_tax, monthly_tds_projected, computed_at')
        .eq('school_code', schoolCode)
        .eq('financial_year', financialYear)
        .eq('computation_basis', 'declared'),
      supabase
        .from('payslips')
        .select('employee_id, tds_amount, gross_earnings, payroll_run_id, payroll_runs!inner(month, year)')
        .eq('school_code', schoolCode)
        .eq('financial_year', financialYear),
    ]);

    if (empErr) throw empErr;
    if (compErr) throw compErr;
    if (psErr) throw psErr;

    const compByEmp = new Map((computations || []).map((c) => [c.employee_id, c]));
    const tdsByEmp = new Map();
    const grossByEmp = new Map();
    (payslips || []).forEach((p) => {
      tdsByEmp.set(p.employee_id, (tdsByEmp.get(p.employee_id) || 0) + Number(p.tds_amount || 0));
      grossByEmp.set(p.employee_id, (grossByEmp.get(p.employee_id) || 0) + Number(p.gross_earnings || 0));
    });

    return (employees || []).map((e) => ({
      ...e,
      computation: compByEmp.get(e.id) || null,
      tds_paid_so_far: tdsByEmp.get(e.id) || 0,
      gross_paid_so_far: grossByEmp.get(e.id) || 0,
    }));
  },

  // ── 15G/H delete (employee can withdraw before HR files) ─────────────────
  async deleteForm15GH(id) {
    const { error } = await supabase.from('form_15g_h_declarations').delete().eq('id', id);
    if (error) throw error;
  },

  async markForm15GHFiled(id) {
    const { data, error } = await supabase
      .from('form_15g_h_declarations')
      .update({ filed_with_it: true })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async unmarkForm15GHFiled(id) {
    const { data, error } = await supabase
      .from('form_15g_h_declarations')
      .update({ filed_with_it: false })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async setForm15GHUin(id, uin) {
    const { data, error } = await supabase
      .from('form_15g_h_declarations')
      .update({ uin: uin || null })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async listForm15GHForSchool(schoolCode, financialYear) {
    const { data, error } = await supabase
      .from('form_15g_h_declarations')
      .select(`
        *,
        employees:employee_id (
          id, full_name, employee_code, designation, department,
          pan_number, date_of_birth
        )
      `)
      .eq('school_code', schoolCode)
      .eq('financial_year', financialYear)
      .order('declared_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  // ── Form 24Q ─────────────────────────────────────────────────────────────
  async listChallans(schoolCode, financialYear, quarter) {
    let q = supabase
      .from('tds_challans')
      .select('*')
      .eq('school_code', schoolCode)
      .eq('financial_year', financialYear)
      .order('challan_date', { ascending: false });
    if (quarter) q = q.eq('quarter', quarter);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async addChallan(payload) {
    const { data, error } = await supabase
      .from('tds_challans')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteChallan(id) {
    const { error } = await supabase.from('tds_challans').delete().eq('id', id);
    if (error) throw error;
  },

  async exportAnnexureI(schoolCode, financialYear, quarter) {
    const { data, error } = await supabase.rpc('export_form_24q_annexure_i', {
      p_school_code: schoolCode,
      p_financial_year: financialYear,
      p_quarter: quarter,
    });
    if (error) throw error;
    return data ?? [];
  },

  async exportAnnexureII(schoolCode, financialYear) {
    const { data, error } = await supabase.rpc('export_form_24q_annexure_ii', {
      p_school_code: schoolCode,
      p_financial_year: financialYear,
    });
    if (error) throw error;
    return data ?? [];
  },

  // ── tax config (read-only for UI) ────────────────────────────────────────
  async getConfig(financialYear, regime) {
    const { data, error } = await supabase
      .from('tax_config')
      .select('*')
      .eq('financial_year', financialYear)
      .eq('regime', regime)
      .single();
    if (error) throw error;
    return data;
  },
};
