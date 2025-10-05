/**
 * Debug utility for user metadata and RLS issues
 * Use this to troubleshoot server errors related to user session
 */

import { getSchoolCode, getUserRole, getStudentCode } from './metadata.js';
import { supabase } from '../config/supabaseClient.js';

/**
 * Debug user metadata structure
 * @param {Object} user - Supabase auth user object
 * @returns {Object} Debug information
 */
export function debugUserMetadata(user) {
  if (!user) {
    return {
      error: 'User is null or undefined',
      hasUser: false
    };
  }

  const debug = {
    hasUser: true,
    userId: user.id,
    email: user.email,
    
    // Check all metadata locations
    metadata: {
      raw_app_meta_data: user.raw_app_meta_data,
      app_metadata: user.app_metadata,
      raw_user_meta_data: user.raw_user_meta_data,
      user_metadata: user.user_metadata
    },
    
    // Extract specific values using our functions
    extracted: {
      role: getUserRole(user),
      schoolCode: getSchoolCode(user),
      studentCode: getStudentCode(user)
    },
    
    // Check if required fields exist
    validation: {
      hasRole: !!getUserRole(user),
      hasSchoolCode: !!getSchoolCode(user),
      hasStudentCode: !!getStudentCode(user),
      isAdmin: ['admin', 'superadmin', 'cb_admin'].includes(getUserRole(user)),
      isStudent: getUserRole(user) === 'student'
    }
  };

  return debug;
}

/**
 * Log user metadata to console for debugging
 * @param {Object} user - Supabase auth user object
 * @param {string} context - Context for the log (e.g., 'Login', 'Test Access')
 */
export function logUserMetadata(user, context = 'Debug') {
  const debug = debugUserMetadata(user);
  
  console.group(`🔍 ${context} - User Metadata Debug`);
  console.log('User ID:', debug.userId);
  console.log('Email:', debug.email);
  console.log('Role:', debug.extracted.role);
  console.log('School Code:', debug.extracted.schoolCode);
  console.log('Student Code:', debug.extracted.studentCode);
  console.log('Validation:', debug.validation);
  console.log('Full Metadata:', debug.metadata);
  console.groupEnd();
  
  return debug;
}

/**
 * Check if user has required metadata for offline test operations
 * @param {Object} user - Supabase auth user object
 * @returns {Object} Validation result
 */
export function validateUserForOfflineTests(user) {
  const debug = debugUserMetadata(user);
  
  if (!debug.hasUser) {
    return {
      isValid: false,
      error: 'User is not authenticated',
      missing: ['user']
    };
  }
  
  const missing = [];
  const warnings = [];
  
  // Required for all operations
  if (!debug.validation.hasRole) {
    missing.push('role');
  }
  
  // Required for admin operations
  if (debug.validation.isAdmin && !debug.validation.hasSchoolCode) {
    missing.push('school_code');
  }
  
  // Required for student operations
  if (debug.validation.isStudent && !debug.validation.hasStudentCode) {
    missing.push('student_code');
  }
  
  // Warnings for potential issues
  if (debug.extracted.role && !['admin', 'superadmin', 'cb_admin', 'student'].includes(debug.extracted.role)) {
    warnings.push(`Unknown role: ${debug.extracted.role}`);
  }
  
  return {
    isValid: missing.length === 0,
    error: missing.length > 0 ? `Missing required fields: ${missing.join(', ')}` : null,
    missing,
    warnings,
    debug
  };
}

/**
 * Test RLS access for test_marks table
 * @param {Object} user - Supabase auth user object
 * @returns {Promise<Object>} Test result
 */
export async function testRLSAccess(user) {
  const validation = validateUserForOfflineTests(user);
  
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error,
      canAccess: false
    };
  }
  
  try {
    // Test basic Supabase connection
    const { data, error } = await supabase
      .from('test_marks')
      .select('id')
      .limit(1);
    
    if (error) {
      return {
        success: false,
        error: `RLS Error: ${error.message}`,
        canAccess: false,
        errorCode: error.code,
        errorDetails: error
      };
    }
    
    return {
      success: true,
      canAccess: true,
      data: data || []
    };
  } catch (err) {
    return {
      success: false,
      error: `Connection Error: ${err.message}`,
      canAccess: false
    };
  }
}

/**
 * Generate user metadata fix suggestions
 * @param {Object} user - Supabase auth user object
 * @returns {Array} Array of fix suggestions
 */
export function generateMetadataFixSuggestions(user) {
  const validation = validateUserForOfflineTests(user);
  const suggestions = [];
  
  if (!validation.isValid) {
    if (validation.missing.includes('role')) {
      suggestions.push({
        type: 'role',
        message: 'User is missing role in metadata',
        fix: 'Add role to user metadata: user.user_metadata.role = "admin" or "student"'
      });
    }
    
    if (validation.missing.includes('school_code')) {
      suggestions.push({
        type: 'school_code',
        message: 'Admin user is missing school_code',
        fix: 'Add school_code to user metadata: user.app_metadata.school_code = "your_school_code"'
      });
    }
    
    if (validation.missing.includes('student_code')) {
      suggestions.push({
        type: 'student_code',
        message: 'Student user is missing student_code',
        fix: 'Add student_code to user metadata: user.user_metadata.student_code = "STU001"'
      });
    }
  }
  
  return suggestions;
}
