// src/services/subjectService.js
import { supabase } from '@/config/supabaseClient';

/**
 * Get subjects for a school
 */
export const getSubjects = async (schoolCode) => {
  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('school_code', schoolCode)
      .order('subject_name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    throw error;
  }
};
