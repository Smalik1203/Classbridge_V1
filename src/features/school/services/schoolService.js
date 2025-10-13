// src/services/schoolService.js
import { supabase } from '@/config/supabaseClient';

/**
 * Get classes for a school
 */
export const getClassInstances = async (schoolCode) => {
  try {
    const { data, error } = await supabase
      .from('class_instances')
      .select('*')
      .eq('school_code', schoolCode)
      .order('grade', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    throw error;
  }
};
