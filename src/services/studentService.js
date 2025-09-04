// src/services/studentService.js
import { supabase } from '../config/supabaseClient.js';

/**
 * Get students for a specific school and class
 */
export const getStudents = async (schoolCode, filters = {}) => {
  try {
    let query = supabase
      .from('student')
      .select(`
        id,
        full_name,
        student_code,
        class_instance:class_instances(
          id,
          grade,
          section
        )
      `)
      .eq('school_code', schoolCode);

    // Apply filters
    if (filters.classInstanceId) {
      query = query.eq('class_instance_id', filters.classInstanceId);
    }
    if (filters.isActive !== undefined) {
      query = query.eq('status', filters.isActive ? 'active' : 'inactive');
    }

    const { data, error } = await query.order('student_code', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching students:', error);
    throw error;
  }
};

/**
 * Get a single student by ID
 */
export const getStudent = async (studentId) => {
  try {
    const { data, error } = await supabase
      .from('student')
      .select(`
        id,
        full_name,
        student_code,
        class_instance:class_instances(
          id,
          grade,
          section
        )
      `)
      .eq('id', studentId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching student:', error);
    throw error;
  }
};

/**
 * Get students by class
 */
export const getStudentsByClass = async (classInstanceId) => {
  try {
    const { data, error } = await supabase
      .from('student')
      .select(`
        id,
        full_name,
        student_code
      `)
      .eq('class_instance_id', classInstanceId)
      .eq('status', 'active')
      .order('student_code', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching students by class:', error);
    throw error;
  }
};

/**
 * Search students by name or roll number
 */
export const searchStudents = async (schoolCode, searchTerm, filters = {}) => {
  try {
    let query = supabase
      .from('student')
      .select(`
        id,
        full_name,
        student_code,
        class_instance:class_instances(
          id,
          grade,
          section
        )
      `)
      .eq('school_code', schoolCode)
      .or(`full_name.ilike.%${searchTerm}%,student_code.ilike.%${searchTerm}%`);

    // Apply additional filters
    if (filters.classInstanceId) {
      query = query.eq('class_instance_id', filters.classInstanceId);
    }
    if (filters.isActive !== undefined) {
      query = query.eq('status', filters.isActive ? 'active' : 'inactive');
    }

    const { data, error } = await query.order('student_code', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error searching students:', error);
    throw error;
  }
};
