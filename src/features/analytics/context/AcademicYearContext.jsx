import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';

const AcademicYearContext = createContext(null);

const STORAGE_KEY = 'analytics_selected_ay_id';
const COMPARE_STORAGE_KEY = 'analytics_compare_ay_id';

export function AcademicYearProvider({ children }) {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);

  const [years, setYears] = useState([]);
  const [activeAyId, setActiveAyId] = useState(null);
  const [selectedAyId, setSelectedAyId] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || null; } catch { return null; }
  });
  const [compareAyId, setCompareAyId] = useState(() => {
    try { return localStorage.getItem(COMPARE_STORAGE_KEY) || null; } catch { return null; }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!schoolCode) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error: e } = await supabase
        .from('academic_years')
        .select('id, year_start, year_end, start_date, end_date, is_active, school_code')
        .eq('school_code', schoolCode)
        .order('year_start', { ascending: false });
      if (e) throw e;
      const list = data || [];
      setYears(list);
      const active = list.find((y) => y.is_active) || list[0] || null;
      setActiveAyId(active?.id || null);
      setSelectedAyId((cur) => {
        if (cur && list.some((y) => y.id === cur)) return cur;
        return active?.id || null;
      });
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [schoolCode]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    try {
      if (selectedAyId) localStorage.setItem(STORAGE_KEY, selectedAyId);
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }, [selectedAyId]);

  useEffect(() => {
    try {
      if (compareAyId) localStorage.setItem(COMPARE_STORAGE_KEY, compareAyId);
      else localStorage.removeItem(COMPARE_STORAGE_KEY);
    } catch { /* ignore */ }
  }, [compareAyId]);

  const value = useMemo(() => {
    const selected = years.find((y) => y.id === selectedAyId) || null;
    const compare = years.find((y) => y.id === compareAyId) || null;
    const active = years.find((y) => y.id === activeAyId) || null;
    return {
      loading,
      error,
      years,
      activeAyId,
      activeYear: active,
      selectedAyId,
      selectedYear: selected,
      compareAyId,
      compareYear: compare,
      setSelectedAyId,
      setCompareAyId,
      clearCompare: () => setCompareAyId(null),
      reload: load,
      formatYearLabel: (y) => {
        if (!y) return '';
        if (y.year_start && y.year_end) return `${y.year_start}-${y.year_end}`;
        if (y.start_date && y.end_date) return `${y.start_date.slice(0, 4)}-${y.end_date.slice(0, 4)}`;
        return y.id?.slice(0, 6) || '';
      },
    };
  }, [years, selectedAyId, compareAyId, activeAyId, loading, error, load]);

  return (
    <AcademicYearContext.Provider value={value}>
      {children}
    </AcademicYearContext.Provider>
  );
}

export function useAcademicYear() {
  const ctx = useContext(AcademicYearContext);
  if (!ctx) {
    throw new Error('useAcademicYear must be used within AcademicYearProvider');
  }
  return ctx;
}
