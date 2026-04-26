import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode, getUserRole } from '@/shared/utils/metadata';
import { listClasses } from '../services/feesService';

/**
 * FeesContext — invoice-first lean provider.
 *
 * Replaces the old plan-based provider that read from fee_student_plans /
 * fee_payments and held a global studentPlans Map. The new fees flow uses
 * React Query-style local state inside pages calling feesService directly,
 * so this context just exposes the small shared facts:
 *   - schoolCode, userRole
 *   - active academic year
 *   - class list (for pickers)
 *   - refresh helper
 *
 * The old API surface (loadStudentPlans, addPayment, getStudentPlan, etc.)
 * has been removed because no external feature consumed it; only the fees
 * folder itself imported FeesContext, and it has been rebuilt against
 * fee_invoices / fee_invoice_items / fee_payments.
 */

const FeesContext = createContext(null);

export function FeesProvider({ children }) {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const userRole = getUserRole(user);

  const [academicYear, setAcademicYear] = useState(null);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!schoolCode) return;
    setLoading(true);
    setError(null);
    try {
      const [{ data: ay }, classRows] = await Promise.all([
        supabase
          .from('academic_years')
          .select('id, year_start, year_end, is_active')
          .eq('school_code', schoolCode)
          .eq('is_active', true)
          .maybeSingle(),
        listClasses(schoolCode),
      ]);
      setAcademicYear(ay || null);
      setClasses(classRows || []);
    } catch (err) {
      setError(err?.message || 'Failed to load fees context');
    } finally {
      setLoading(false);
    }
  }, [schoolCode]);

  useEffect(() => {
    if (user && schoolCode) refresh();
  }, [user, schoolCode, refresh]);

  const value = useMemo(() => ({
    schoolCode,
    userRole,
    academicYear,
    classes,
    loading,
    error,
    refresh,
  }), [schoolCode, userRole, academicYear, classes, loading, error, refresh]);

  return <FeesContext.Provider value={value}>{children}</FeesContext.Provider>;
}

export function useFees() {
  const ctx = useContext(FeesContext);
  if (!ctx) throw new Error('useFees must be used within a FeesProvider');
  return ctx;
}

export default FeesContext;
