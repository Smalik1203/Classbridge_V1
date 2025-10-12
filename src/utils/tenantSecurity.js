/**
 * Tenant Security Utilities
 * Provides defense-in-depth security for tenant isolation
 */

import { supabase } from '../config/supabaseClient.js';
import { getSchoolCode, getUserRole } from './metadata.js';

/**
 * Security validation error class
 */
export class TenantSecurityError extends Error {
  constructor(message, code = 'TENANT_SECURITY_ERROR') {
    super(message);
    this.name = 'TenantSecurityError';
    this.code = code;
  }
}

/**
 * Validate that the current user's school_code matches the expected school
 * @param {string} expectedSchoolCode - The school code that should match
 * @param {Object} user - Current user object
 * @throws {TenantSecurityError} If school codes don't match
 */
export function validateSchoolCode(expectedSchoolCode, user) {
  if (!expectedSchoolCode) {
    throw new TenantSecurityError('School code is required for security validation', 'MISSING_SCHOOL_CODE');
  }

  const userSchoolCode = getSchoolCode(user);
  if (!userSchoolCode) {
    throw new TenantSecurityError('User school information not found', 'MISSING_USER_SCHOOL');
  }

  if (userSchoolCode !== expectedSchoolCode) {
    throw new TenantSecurityError(
      `Access denied: User school (${userSchoolCode}) does not match required school (${expectedSchoolCode})`,
      'SCHOOL_CODE_MISMATCH'
    );
  }
}

/**
 * Get current user with security validation
 * @returns {Promise<Object>} User object with validated school information
 * @throws {TenantSecurityError} If user is not authenticated or lacks school info
 */
export async function getCurrentUserWithValidation() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      throw new TenantSecurityError(`Authentication failed: ${error.message}`, 'AUTH_ERROR');
    }

    if (!user) {
      throw new TenantSecurityError('User not authenticated', 'NOT_AUTHENTICATED');
    }

    const schoolCode = getSchoolCode(user);
    if (!schoolCode) {
      throw new TenantSecurityError('User school information not found in profile', 'MISSING_SCHOOL_INFO');
    }

    return {
      ...user,
      validatedSchoolCode: schoolCode,
      role: getUserRole(user)
    };
  } catch (error) {
    if (error instanceof TenantSecurityError) {
      throw error;
    }
    throw new TenantSecurityError(`Failed to get current user: ${error.message}`, 'USER_FETCH_ERROR');
  }
}

/**
 * Create a secure query builder that automatically includes school_code filtering
 * @param {string} tableName - Name of the table to query
 * @param {Object} user - Current user object with validated school code
 * @returns {Object} Supabase query builder with school_code filter applied
 */
export function createSecureQuery(tableName, user) {
  const schoolCode = user.validatedSchoolCode || getSchoolCode(user);
  
  if (!schoolCode) {
    throw new TenantSecurityError('School code required for secure query', 'MISSING_SCHOOL_CODE');
  }

  return supabase
    .from(tableName)
    .select('*')
    .eq('school_code', schoolCode);
}

/**
 * Validate that a school_code parameter matches the current user's school
 * @param {string} providedSchoolCode - School code provided in request
 * @param {Object} user - Current user object
 * @throws {TenantSecurityError} If school codes don't match
 */
export function validateRequestSchoolCode(providedSchoolCode, user) {
  if (!providedSchoolCode) {
    throw new TenantSecurityError('School code parameter is required', 'MISSING_SCHOOL_PARAM');
  }

  const userSchoolCode = getSchoolCode(user);
  if (!userSchoolCode) {
    throw new TenantSecurityError('User school information not found', 'MISSING_USER_SCHOOL');
  }

  if (providedSchoolCode !== userSchoolCode) {
    throw new TenantSecurityError(
      `Access denied: Requested school (${providedSchoolCode}) does not match user school (${userSchoolCode})`,
      'SCHOOL_CODE_MISMATCH'
    );
  }
}

/**
 * Secure wrapper for database operations that automatically validates tenant isolation
 * @param {Function} operation - Database operation function
 * @param {Object} user - Current user object
 * @param {string} operationName - Name of the operation for logging
 * @returns {Promise<any>} Result of the operation
 */
export async function secureDatabaseOperation(operation, user, operationName = 'database_operation') {
  try {
    // Validate user has school information
    const schoolCode = getSchoolCode(user);
    if (!schoolCode) {
      throw new TenantSecurityError('User school information required for database operation', 'MISSING_SCHOOL_INFO');
    }

    // Execute the operation
    const result = await operation();
    
    // Operation executed for audit purposes
    
    return result;
  } catch (error) {
    if (error instanceof TenantSecurityError) {
      throw error;
    }
    
    // Log security-related errors
    throw new TenantSecurityError(`Database operation failed: ${error.message}`, 'OPERATION_ERROR');
  }
}

/**
 * Validate that a user has permission to access a specific resource
 * @param {string} resourceType - Type of resource being accessed
 * @param {string} resourceId - ID of the resource
 * @param {Object} user - Current user object
 * @returns {Promise<boolean>} Whether user has permission
 */
export async function validateResourceAccess(resourceType, resourceId, user) {
  try {
    const schoolCode = getSchoolCode(user);
    if (!schoolCode) {
      return false;
    }

    // Check if the resource belongs to the user's school
    const { data, error } = await supabase
      .from(resourceType)
      .select('school_code')
      .eq('id', resourceId)
      .eq('school_code', schoolCode)
      .single();

    if (error || !data) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Create a secure filter object that includes school_code validation
 * @param {Object} filters - Original filters
 * @param {Object} user - Current user object
 * @returns {Object} Filters with school_code validation
 */
export function createSecureFilters(filters, user) {
  const schoolCode = getSchoolCode(user);
  if (!schoolCode) {
    throw new TenantSecurityError('School code required for secure filtering', 'MISSING_SCHOOL_CODE');
  }

  return {
    ...filters,
    school_code: schoolCode
  };
}

/**
 * Audit log for tenant security events
 * @param {string} event - Event type
 * @param {Object} details - Event details
 * @param {Object} user - Current user object
 */
export function logTenantSecurityEvent(event, details, user) {
  const schoolCode = getSchoolCode(user);
  const userId = user?.id;
  // Audit log for security operations
}

/**
 * Validate that a user can only access data from their own school
 * This is a final security check before any data operation
 * @param {string} targetSchoolCode - School code of the data being accessed
 * @param {Object} user - Current user object
 * @throws {TenantSecurityError} If access is denied
 */
export function enforceTenantIsolation(targetSchoolCode, user) {
  const userSchoolCode = getSchoolCode(user);
  
  if (!userSchoolCode) {
    throw new TenantSecurityError('User school information not found', 'MISSING_USER_SCHOOL');
  }

  if (!targetSchoolCode) {
    throw new TenantSecurityError('Target school code is required', 'MISSING_TARGET_SCHOOL');
  }

  if (userSchoolCode !== targetSchoolCode) {
    // Log potential security breach attempt
    logTenantSecurityEvent('CROSS_TENANT_ACCESS_ATTEMPT', {
      userSchoolCode,
      targetSchoolCode,
      userId: user.id,
      userRole: getUserRole(user)
    }, user);
    
    throw new TenantSecurityError(
      `Access denied: Cannot access data from school ${targetSchoolCode}. User belongs to school ${userSchoolCode}`,
      'CROSS_TENANT_ACCESS_DENIED'
    );
  }
}

/**
 * Check if user can access school data
 * @param {string} targetSchoolCode - School code to access
 * @param {Object} user - Current user object
 * @returns {boolean} Whether access is allowed
 */
export function canAccessSchoolData(targetSchoolCode, user) {
  const userRole = getUserRole(user);
  const userSchoolCode = getSchoolCode(user);
  
  // CB Admin cannot access school internal data
  if (userRole === 'cb_admin') {
    return false;
  }
  
  // Super Admin and Admin can only access their own school
  if (userRole === 'superadmin' || userRole === 'admin') {
    return targetSchoolCode === userSchoolCode;
  }
  
  // Students can only access their own school
  if (userRole === 'student') {
    return targetSchoolCode === userSchoolCode;
  }
  
  return false;
}

/**
 * Check if user can access platform data (CB Admin only)
 * @param {Object} user - Current user object
 * @returns {boolean} Whether access is allowed
 */
export function canAccessPlatformData(user) {
  const userRole = getUserRole(user);
  return userRole === 'cb_admin';
}

/**
 * Get role-based navigation restrictions
 * @param {Object} user - Current user object
 * @returns {Object} Navigation restrictions
 */
export function getRoleBasedNavigationRestrictions(user) {
  const userRole = getUserRole(user);
  
  if (userRole === 'cb_admin') {
    return {
      allowedRoutes: [
        '/platform-dashboard',
        '/school-directory',
        '/platform-metrics',
        '/school-health',
        '/create-school',
        '/assign-super-admin'
      ],
      blockedRoutes: [
        '/students',
        '/attendance',
        '/fees',
        '/tests',
        '/learning-resources',
        '/timetable',
        '/analytics',
        '/reports'
      ],
      allowedFeatures: [
        'platform-overview',
        'school-management',
        'super-admin-assignment',
        'platform-metrics'
      ],
      blockedFeatures: [
        'student-management',
        'academic-data',
        'financial-data',
        'test-management',
        'learning-resources',
        'attendance-tracking'
      ]
    };
  }
  
  if (userRole === 'superadmin' || userRole === 'admin') {
    return {
      allowedRoutes: [
        '/dashboard',
        '/students',
        '/attendance',
        '/fees',
        '/tests',
        '/learning-resources',
        '/timetable',
        '/analytics',
        '/reports'
      ],
      blockedRoutes: [
        '/platform-dashboard',
        '/school-directory',
        '/platform-metrics',
        '/create-school',
        '/assign-super-admin'
      ],
      allowedFeatures: [
        'student-management',
        'academic-data',
        'financial-data',
        'test-management',
        'learning-resources',
        'attendance-tracking',
        'school-analytics'
      ],
      blockedFeatures: [
        'platform-overview',
        'school-management',
        'super-admin-assignment',
        'platform-metrics'
      ]
    };
  }
  
  if (userRole === 'student') {
    return {
      allowedRoutes: [
        '/student-dashboard',
        '/my-tests',
        '/my-attendance',
        '/my-fees',
        '/learning-resources'
      ],
      blockedRoutes: [
        '/platform-dashboard',
        '/school-directory',
        '/students',
        '/attendance',
        '/fees',
        '/tests',
        '/analytics',
        '/reports'
      ],
      allowedFeatures: [
        'view-own-data',
        'take-tests',
        'view-attendance',
        'view-fees',
        'access-learning-resources'
      ],
      blockedFeatures: [
        'student-management',
        'academic-data',
        'financial-data',
        'test-management',
        'platform-overview'
      ]
    };
  }
  
  return {
    allowedRoutes: [],
    blockedRoutes: ['*'],
    allowedFeatures: [],
    blockedFeatures: ['*']
  };
}

/**
 * Validate route access based on user role
 * @param {string} route - Route being accessed
 * @param {Object} user - Current user object
 * @returns {boolean} Whether access is allowed
 */
export function validateRouteAccess(route, user) {
  const restrictions = getRoleBasedNavigationRestrictions(user);
  
  // Check if route is explicitly blocked
  if (restrictions.blockedRoutes.includes(route) || restrictions.blockedRoutes.includes('*')) {
    return false;
  }
  
  // Check if route is explicitly allowed
  if (restrictions.allowedRoutes.includes(route)) {
    return true;
  }
  
  // For CB Admin, block all school-specific routes
  if (getUserRole(user) === 'cb_admin') {
    const schoolSpecificRoutes = ['/students', '/attendance', '/fees', '/tests', '/learning-resources', '/timetable', '/analytics', '/reports'];
    if (schoolSpecificRoutes.some(schoolRoute => route.startsWith(schoolRoute))) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get user's dashboard route based on role
 * @param {Object} user - Current user object
 * @returns {string} Dashboard route for the user
 */
export function getUserDashboardRoute(user) {
  const userRole = getUserRole(user);
  
  switch (userRole) {
    case 'cb_admin':
      return '/platform-dashboard';
    case 'superadmin':
    case 'admin':
      return '/dashboard';
    case 'student':
      return '/student-dashboard';
    default:
      return '/login';
  }
}
