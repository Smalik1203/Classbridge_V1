// src/services/schoolService.js
import { supabase } from '../config/supabaseClient.js';

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

/**
 * Update a school's display name
 * @param {string|number} schoolId - Primary key of the school row
 * @param {string} newSchoolName - New school name to set
 * @returns {Promise<object>} Updated school record
 */
export const updateSchoolName = async (schoolId, newSchoolName) => {
  if (!schoolId) throw new Error('schoolId is required');
  const trimmedName = (newSchoolName || '').trim();
  if (!trimmedName) throw new Error('School name cannot be empty');

  try {
    const { data, error } = await supabase
      .from('schools')
      .update({ school_name: trimmedName })
      .eq('id', schoolId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};
