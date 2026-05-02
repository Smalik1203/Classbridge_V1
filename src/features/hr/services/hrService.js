import { supabase } from '@/config/supabaseClient';

/**
 * HR service — direct port of mobile `~/Desktop/classbridge/src/services/hr.ts`.
 * Same Supabase tables, same RPC names, same payload shapes.
 * Web UI is rebuilt with AntD; this layer must stay byte-compatible with mobile.
 */
export const hrService = {
  // ── employees ──────────────────────────────────────────────────────────────
  async listEmployees(schoolCode) {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('school_code', schoolCode)
      .order('department')
      .order('full_name');
    if (error) throw error;
    return data ?? [];
  },

  async getEmployee(employeeId) {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single();
    if (error) throw error;
    return data;
  },

  async getEmployeeByUserId(userId) {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async createEmployee(payload) {
    const { data, error } = await supabase
      .from('employees')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateEmployee(employeeId, payload) {
    const { data, error } = await supabase
      .from('employees')
      .update(payload)
      .eq('id', employeeId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ── payroll ────────────────────────────────────────────────────────────────
  async listPayrollRuns(schoolCode) {
    const { data, error } = await supabase
      .from('payroll_runs')
      .select('*')
      .eq('school_code', schoolCode)
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async listPayslipsForRun(runId) {
    const { data, error } = await supabase
      .from('payslips')
      .select('id, employee_id, financial_year, paid_days, working_days, gross_earnings, total_deductions, net_pay, pdf_url, employees(full_name, employee_code, designation, department)')
      .eq('payroll_run_id', runId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async listPayslipsForEmployee(employeeId, financialYear) {
    let q = supabase
      .from('payslips')
      .select('*, payroll_runs(month, year, status)')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });
    if (financialYear) q = q.eq('financial_year', financialYear);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r) => ({
      ...r,
      run_month: r.payroll_runs?.month,
      run_year: r.payroll_runs?.year,
      run_status: r.payroll_runs?.status,
    }));
  },

  async createPayrollRun({ school_code, month, year, financial_year }) {
    const { data, error } = await supabase
      .from('payroll_runs')
      .insert({ school_code, month, year, financial_year, status: 'draft' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async processPayrollRun(runId) {
    const { data, error } = await supabase.rpc('process_payroll_run', { p_run_id: runId });
    if (error) throw error;
    return data ?? [];
  },

  async lockPayrollRun(runId) {
    const { error } = await supabase.rpc('lock_payroll_run', { p_run_id: runId });
    if (error) throw error;
  },

  // ── leave types ────────────────────────────────────────────────────────────
  async listLeaveTypes(schoolCode) {
    const { data, error } = await supabase
      .from('leave_types')
      .select('*')
      .eq('school_code', schoolCode)
      .order('code');
    if (error) throw error;
    return data ?? [];
  },

  async createLeaveType(payload) {
    const { data, error } = await supabase
      .from('leave_types')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateLeaveType(id, payload) {
    const { data, error } = await supabase
      .from('leave_types')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ── salary ─────────────────────────────────────────────────────────────────
  async listSalaryComponents(schoolCode) {
    const { data, error } = await supabase
      .from('salary_components')
      .select('*')
      .eq('school_code', schoolCode)
      .eq('is_active', true)
      .order('display_order');
    if (error) throw error;
    return data ?? [];
  },

  async createSalaryComponent(payload) {
    const { data, error } = await supabase
      .from('salary_components')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getActiveSalaryStructure(employeeId) {
    const { data: structure, error } = await supabase
      .from('salary_structures')
      .select('*')
      .eq('employee_id', employeeId)
      .is('effective_to', null)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!structure) return null;

    const { data: lines, error: linesErr } = await supabase
      .from('salary_structure_lines')
      .select('*, salary_components(*)')
      .eq('salary_structure_id', structure.id);
    if (linesErr) throw linesErr;

    return {
      structure,
      lines: (lines ?? []).map((l) => ({ ...l, component: l.salary_components })),
    };
  },

  async setSalaryStructure({ school_code, employee_id, effective_from, ctc, lines }) {
    await supabase
      .from('salary_structures')
      .update({ effective_to: effective_from })
      .eq('employee_id', employee_id)
      .is('effective_to', null);

    const { data: newStruct, error } = await supabase
      .from('salary_structures')
      .insert({ school_code, employee_id, effective_from, ctc })
      .select()
      .single();
    if (error) throw error;

    if (lines.length > 0) {
      const { error: linesErr } = await supabase
        .from('salary_structure_lines')
        .insert(
          lines.map((l) => ({
            salary_structure_id: newStruct.id,
            component_id: l.component_id,
            monthly_amount: l.monthly_amount,
          }))
        );
      if (linesErr) throw linesErr;
    }
  },

  // ── leave ──────────────────────────────────────────────────────────────────
  async getLeaveBalance(employeeId, academicYearId) {
    const { data, error } = await supabase.rpc('get_leave_balance', {
      p_employee_id: employeeId,
      p_academic_year_id: academicYearId,
    });
    if (error) throw error;
    return data ?? [];
  },

  async listLeaveApplications(employeeId) {
    const { data, error } = await supabase
      .from('leave_applications')
      .select('*, leave_types(code, name)')
      .eq('employee_id', employeeId)
      .order('applied_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async listPendingLeaveApplications(schoolCode) {
    const { data, error } = await supabase
      .from('leave_applications')
      .select('*, employees(full_name, employee_code, designation), leave_types(code, name)')
      .eq('school_code', schoolCode)
      .eq('status', 'pending')
      .order('applied_at');
    if (error) throw error;
    return data ?? [];
  },

  async applyForLeave(payload) {
    const { data, error } = await supabase
      .from('leave_applications')
      .insert({ ...payload, status: 'pending' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async cancelLeaveApplication(applicationId) {
    const { error } = await supabase
      .from('leave_applications')
      .update({ status: 'cancelled' })
      .eq('id', applicationId);
    if (error) throw error;
  },

  async approveLeave(applicationId, reviewNote) {
    const { error } = await supabase.rpc('approve_leave', {
      p_application_id: applicationId,
      p_review_note: reviewNote ?? null,
    });
    if (error) throw error;
  },

  async rejectLeave(applicationId, reviewNote) {
    const { error } = await supabase.rpc('reject_leave', {
      p_application_id: applicationId,
      p_review_note: reviewNote ?? null,
    });
    if (error) throw error;
  },

  // ── attendance ─────────────────────────────────────────────────────────────
  async getAttendanceSummary(schoolCode, year, month) {
    const { data, error } = await supabase.rpc('get_staff_attendance_summary', {
      p_school_code: schoolCode,
      p_year: year,
      p_month: month,
    });
    if (error) throw error;
    return data ?? [];
  },

  async getEmployeeAttendance(employeeId, year, month) {
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const to = new Date(year, month, 0).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('staff_attendance')
      .select('date, status, in_time, out_time, late_minutes, half_day_slot, note')
      .eq('employee_id', employeeId)
      .gte('date', from)
      .lte('date', to)
      .order('date');
    if (error) throw error;
    return data ?? [];
  },

  /**
   * Day-level attendance for the school: returns one row per active employee with
   * today's punch (or null if not yet marked). Used by the marking UI.
   */
  async getDayAttendance(schoolCode, date) {
    const [{ data: emps, error: e1 }, { data: marks, error: e2 }] = await Promise.all([
      supabase
        .from('employees')
        .select('id, full_name, employee_code, designation, department')
        .eq('school_code', schoolCode)
        .eq('status', 'active')
        .order('full_name'),
      supabase
        .from('staff_attendance')
        .select('id, employee_id, status, in_time, out_time, late_minutes, half_day_slot, source, note')
        .eq('school_code', schoolCode)
        .eq('date', date),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    const byEmp = new Map((marks || []).map((m) => [m.employee_id, m]));
    return (emps || []).map((e) => ({ ...e, mark: byEmp.get(e.id) || null }));
  },

  /**
   * Bulk upsert staff attendance for a single date. Each row in `marks` must include
   * employee_id and status; in_time/out_time/late_minutes/half_day_slot/note optional.
   * Source defaults to 'manual'. Uses (employee_id, date) unique key for upsert.
   */
  async upsertStaffAttendance({ schoolCode, date, marks, markedBy, source = 'manual', biometricImportId = null }) {
    const ay = await this.getActiveAcademicYearId(schoolCode);
    if (!ay?.id) throw new Error('No active academic year found for this school.');
    const rows = marks.map((m) => ({
      school_code: schoolCode,
      employee_id: m.employee_id,
      academic_year_id: ay.id,
      date,
      status: m.status,
      in_time: m.in_time || null,
      out_time: m.out_time || null,
      late_minutes: m.late_minutes ?? 0,
      half_day_slot: m.half_day_slot || null,
      source,
      biometric_import_id: biometricImportId,
      note: m.note || null,
      marked_by: markedBy || null,
      updated_at: new Date().toISOString(),
    }));
    if (rows.length === 0) return [];
    const { data, error } = await supabase
      .from('staff_attendance')
      .upsert(rows, { onConflict: 'employee_id,date' })
      .select();
    if (error) throw error;
    return data ?? [];
  },

  /**
   * Lookup map of employee_code → id for resolving CSV rows.
   */
  async getEmployeeCodeMap(schoolCode) {
    const { data, error } = await supabase
      .from('employees')
      .select('id, employee_code, full_name')
      .eq('school_code', schoolCode)
      .eq('status', 'active');
    if (error) throw error;
    const byCode = new Map();
    (data || []).forEach((e) => { byCode.set((e.employee_code || '').trim().toLowerCase(), e); });
    return byCode;
  },

  // ── academic year (helper, since web doesn't have a global academic-year context) ─
  async getActiveAcademicYearId(schoolCode) {
    const { data, error } = await supabase
      .from('academic_years')
      .select('id, year_start, year_end')
      .eq('school_code', schoolCode)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
    // fallback: most recent
    const { data: any, error: anyErr } = await supabase
      .from('academic_years')
      .select('id, year_start, year_end')
      .eq('school_code', schoolCode)
      .order('year_start', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (anyErr) throw anyErr;
    return any;
  },

  // ── document generation (Edge Function) ────────────────────────────────────
  async generateDocument(docType, employeeId, payslipId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase.functions.invoke('generate-hr-document', {
      body: {
        doc_type: docType,
        employee_id: employeeId,
        payslip_id: payslipId ?? null,
      },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error ?? 'Failed to generate document');
    return data;
  },
};

// ── small formatters used across HR screens ───────────────────────────────────
export const formatINR = (n) => {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
};

export const financialYearForMonth = (year, month) => {
  // Indian FY: Apr–Mar. If month >= 4 → year/year+1, else year-1/year
  const start = month >= 4 ? year : year - 1;
  const end = start + 1;
  return `${start}-${String(end).slice(2)}`;
};
