import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode, getUserRole } from '@/shared/utils/metadata';
import { listClasses } from '../services/feesService';

/**
 * FeesContext — invoice-first lean provider.
 *
 * Exposes:
 *   - schoolCode, userRole
 *   - academicYears: full list for the school (active first)
 *   - activeAcademicYear: the school's flagged active year
 *   - selectedAcademicYear / setSelectedAcademicYearId — current filter
 *     (null = "All years")
 *   - classes (for pickers)
 *   - refresh helper
 */

const FeesContext = createContext(null);

export function FeesProvider({ children }) {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const userRole = getUserRole(user);

  const [academicYears, setAcademicYears] = useState([]);
  const [activeAcademicYear, setActiveAcademicYear] = useState(null);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState(null);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!schoolCode) return;
    setLoading(true);
    setError(null);
    try {
      const [{ data: ays }, classRows] = await Promise.all([
        supabase
          .from('academic_years')
          .select('id, year_start, year_end, is_active')
          .eq('school_code', schoolCode)
          .order('year_start', { ascending: false }),
        listClasses(schoolCode),
      ]);
      const list = ays || [];
      setAcademicYears(list);
      const active = list.find((a) => a.is_active) || list[0] || null;
      setActiveAcademicYear(active);
      // Default the picker to the active year on first load only.
      setSelectedAcademicYearId((curr) => curr === null && active ? active.id : curr);
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

  const selectedAcademicYear = useMemo(
    () => academicYears.find((a) => a.id === selectedAcademicYearId) || null,
    [academicYears, selectedAcademicYearId],
  );

  const value = useMemo(() => ({
    schoolCode,
    userRole,
    academicYears,
    activeAcademicYear,
    selectedAcademicYear,
    selectedAcademicYearId,
    setSelectedAcademicYearId,
    // Back-compat: components that previously read `academicYear` get the
    // currently selected one (or the active year if "All years" is picked,
    // since invoice creation always needs a concrete AY).
    academicYear: selectedAcademicYear || activeAcademicYear,
    classes,
    loading,
    error,
    refresh,
  }), [
    schoolCode, userRole, academicYears, activeAcademicYear,
    selectedAcademicYear, selectedAcademicYearId,
    classes, loading, error, refresh,
  ]);

  return <FeesContext.Provider value={value}>{children}</FeesContext.Provider>;
}

export function useFees() {
  const ctx = useContext(FeesContext);
  if (!ctx) throw new Error('useFees must be used within a FeesProvider');
  return ctx;
}

export default FeesContext;
