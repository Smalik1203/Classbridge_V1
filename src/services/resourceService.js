// src/services/resourceService.js
import { supabase } from '../config/supabaseClient.js';
import { getSchoolCode } from '../utils/metadata.js';

/**
 * Get learning resources with filtering and pagination
 */
export const getLearningResources = async (filters = {}) => {
  try {
    // First check if the table exists by trying a simple query
    const { data: tableCheck, error: tableError } = await supabase
      .from('learning_resources')
      .select('id')
      .limit(1);

    if (tableError && tableError.code === 'PGRST116') {
      // Table doesn't exist, return empty result
      console.warn('learning_resources table does not exist. Please run the migration first.');
      return {
        data: [],
        count: 0
      };
    }

    let query = supabase
      .from('learning_resources')
      .select(`
        *,
        subjects:subject_id (
          id,
          subject_name
        ),
        class_instances:class_instance_id (
          id,
          grade,
          section,
          school_code
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.school_code) {
      query = query.eq('school_code', filters.school_code);
    }
    
    if (filters.class_instance_id) {
      query = query.eq('class_instance_id', filters.class_instance_id);
    }
    
    if (filters.subject_id) {
      query = query.eq('subject_id', filters.subject_id);
    }
    
    if (filters.resource_type) {
      query = query.eq('resource_type', filters.resource_type);
    }
    

    // Search functionality
    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    // Pagination
    if (filters.page && filters.limit) {
      const from = (filters.page - 1) * filters.limit;
      const to = from + filters.limit - 1;
      query = query.range(from, to);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(`Database error: ${error.message}`);
    }
    
    return {
      data: data || [],
      count: count || 0
    };
  } catch (error) {
    console.error('Error fetching learning resources:', error);
    throw error;
  }
};

/**
 * Get a single learning resource by ID
 */
export const getLearningResource = async (id) => {
  try {
    const { data, error } = await supabase
      .from('learning_resources')
      .select(`
        *,
        subjects:subject_id (
          id,
          subject_name
        ),
        class_instances:class_instance_id (
          id,
          grade,
          section,
          school_code
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching learning resource:', error);
    throw error;
  }
};

/**
 * Create a new learning resource
 */
export const createLearningResource = async (resourceData) => {
  try {
    // Check if table exists
    const { data: tableCheck, error: tableError } = await supabase
      .from('learning_resources')
      .select('id')
      .limit(1);

    if (tableError && tableError.code === 'PGRST116') {
      throw new Error('learning_resources table does not exist. Please run the migration first.');
    }


    const { data, error } = await supabase
      .from('learning_resources')
      .insert([resourceData])
      .select()
      .single();

    if (error) {
      console.error('Supabase error details:', error);
      throw new Error(`Database error: ${error.message} (Code: ${error.code})`);
    }
    
    return data;
  } catch (error) {
    console.error('Error creating learning resource:', error);
    throw error;
  }
};

/**
 * Update a learning resource
 */
export const updateLearningResource = async (id, updates) => {
  try {
    const { data, error } = await supabase
      .from('learning_resources')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating learning resource:', error);
    throw error;
  }
};

/**
 * Delete a learning resource
 */
export const deleteLearningResource = async (id) => {
  try {
    const { error } = await supabase
      .from('learning_resources')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting learning resource:', error);
    throw error;
  }
};

/**
 * Get resources for a specific student (based on their class assignments)
 */
export const getStudentResources = async (studentId, filters = {}) => {
  try {
    // Check if learning_resources table exists
    const { data: tableCheck, error: tableError } = await supabase
      .from('learning_resources')
      .select('id')
      .limit(1);

    if (tableError && tableError.code === 'PGRST116') {
      console.warn('learning_resources table does not exist. Please run the migration first.');
      return { data: [], count: 0 };
    }

    // For now, we'll get all resources for the student's school
    // In a more complex setup, you'd have student_class_assignments table
    // For simplicity, we'll just filter by school_code from user metadata
    
    // Get user's school code from auth
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    
    // Use centralized metadata utility
    const schoolCode = getSchoolCode(userData.user);
    if (!schoolCode) {
      return { data: [], count: 0 };
    }

    // Build query for resources
    let query = supabase
      .from('learning_resources')
      .select(`
        *,
        subjects:subject_id (
          id,
          subject_name
        ),
        class_instances:class_instance_id (
          id,
          grade,
          section,
          school_code
        )
      `)
      .eq('school_code', schoolCode)
      .order('created_at', { ascending: false });

    // Apply additional filters
    if (filters.resource_type) {
      query = query.eq('resource_type', filters.resource_type);
    }
    
    if (filters.subject_id) {
      query = query.eq('subject_id', filters.subject_id);
    }

    // Search functionality
    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    // Pagination
    if (filters.page && filters.limit) {
      const from = (filters.page - 1) * filters.limit;
      const to = from + filters.limit - 1;
      query = query.range(from, to);
    }

    const { data, error, count } = await query;

    if (error) throw error;
    
    return {
      data: data || [],
      count: count || 0
    };
  } catch (error) {
    console.error('Error fetching student resources:', error);
    throw error;
  }
};

/**
 * Get resource statistics for analytics
 */
export const getResourceStats = async (schoolCode, academicYearId) => {
  try {
    const { data, error } = await supabase
      .from('learning_resources')
      .select('resource_type, subject_id')
      .eq('school_code', schoolCode)
      .eq('academic_year_id', academicYearId);

    if (error) throw error;

    const stats = {
      total: data.length,
      byType: {},
      bySubject: {}
    };

    data.forEach(resource => {
      // Count by type
      stats.byType[resource.resource_type] = (stats.byType[resource.resource_type] || 0) + 1;
      
      // Count by subject
      stats.bySubject[resource.subject_id] = (stats.bySubject[resource.subject_id] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error('Error fetching resource stats:', error);
    throw error;
  }
};
