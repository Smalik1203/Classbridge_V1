// src/services/resourceService.js
import { supabase } from '../config/supabaseClient.js';
import { getSchoolCode } from '../utils/metadata.js';
import { 
  getCurrentUserWithValidation, 
  createSecureFilters,
  enforceTenantIsolation,
  TenantSecurityError 
} from '../utils/tenantSecurity.js';

// Helper function for secure filters
const secureFilters = (filters) => createSecureFilters(filters);

/**
 * Get learning resources with filtering and pagination
 * ENHANCED: Includes tenant isolation security validation
 */
export const getLearningResources = async (filters = {}) => {
  try {
    // SECURITY: Validate current user and enforce tenant isolation
    const currentUser = await getCurrentUserWithValidation();
    
    // Create secure filters that include school_code validation
    const secureFilters = createSecureFilters(filters, currentUser);
    
    // First check if the table exists by trying a simple query
    const { data: tableCheck, error: tableError } = await supabase
      .from('learning_resources')
      .select('id')
      .eq('school_code', secureFilters.school_code)
      .limit(1);

    if (tableError && tableError.code === 'PGRST116') {
      // Table doesn't exist, return empty result
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
      .eq('school_code', secureFilters.school_code) // SECURITY: Always filter by user's school
      .order('created_at', { ascending: false });

    // Apply additional filters (school_code is already applied securely)
    if (secureFilters.class_instance_id) {
      query = query.eq('class_instance_id', secureFilters.class_instance_id);
    }
    
    if (secureFilters.subject_id) {
      query = query.eq('subject_id', secureFilters.subject_id);
    }
    
    if (secureFilters.resource_type) {
      query = query.eq('resource_type', secureFilters.resource_type);
    }
    

    // Search functionality
    if (secureFilters.search) {
      query = query.or(`title.ilike.%${secureFilters.search}%,description.ilike.%${secureFilters.search}%`);
    }

    // Pagination
    if (secureFilters.page && secureFilters.limit) {
      const from = (secureFilters.page - 1) * secureFilters.limit;
      const to = from + secureFilters.limit - 1;
      query = query.range(from, to);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    return {
      data: data || [],
      count: count || 0
    };
  } catch (error) {
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
      throw new Error(`Database error: ${error.message} (Code: ${error.code})`);
    }
    
    return data;
  } catch (error) {
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
    throw error;
  }
};

/**
 * Get resources for a specific student (based on their class assignments)
 * ENHANCED: Includes tenant isolation security validation
 */
export const getStudentResources = async (studentId, filters = {}) => {
  try {
    // SECURITY: Validate current user and enforce tenant isolation
    const currentUser = await getCurrentUserWithValidation();
    
    // Check if learning_resources table exists
    const { data: tableCheck, error: tableError } = await supabase
      .from('learning_resources')
      .select('id')
      .eq('school_code', currentUser.validatedSchoolCode)
      .limit(1);

    if (tableError && tableError.code === 'PGRST116') {
      return { data: [], count: 0 };
    }

    // SECURITY: Use validated school code from current user
    const schoolCode = currentUser.validatedSchoolCode;

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
    if (secureFilters.search) {
      query = query.or(`title.ilike.%${secureFilters.search}%,description.ilike.%${secureFilters.search}%`);
    }

    // Pagination
    if (secureFilters.page && secureFilters.limit) {
      const from = (secureFilters.page - 1) * secureFilters.limit;
      const to = from + secureFilters.limit - 1;
      query = query.range(from, to);
    }

    const { data, error, count } = await query;

    if (error) throw error;
    
    return {
      data: data || [],
      count: count || 0
    };
  } catch (error) {
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
    throw error;
  }
};
