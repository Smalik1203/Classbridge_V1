/**
 * Utility functions for consistent user metadata extraction
 * Handles all possible metadata locations in Supabase auth user objects
 */

/**
 * Extract role from user object, checking all possible locations
 * @param {Object} user - Supabase auth user object
 * @returns {string|null} - User role or null if not found
 */
export function getUserRole(user) {
  if (!user) return null;
  
  return (
    user.raw_app_meta_data?.role ||
    user.app_metadata?.role ||
    user.raw_user_meta_data?.role ||
    user.user_metadata?.role ||
    null
  );
}

/**
 * Extract school code from user object, checking all possible locations
 * @param {Object} user - Supabase auth user object
 * @returns {string|null} - School code or null if not found
 */
export function getSchoolCode(user) {
  if (!user) return null;
  
  return (
    user.raw_app_meta_data?.school_code ||
    user.app_metadata?.school_code ||
    user.raw_user_meta_data?.school_code ||
    user.user_metadata?.school_code ||
    null
  );
}

/**
 * Extract school name from user object, checking all possible locations
 * @param {Object} user - Supabase auth user object
 * @returns {string|null} - School name or null if not found
 */
export function getSchoolName(user) {
  if (!user) return null;
  
  return (
    user.raw_app_meta_data?.school_name ||
    user.app_metadata?.school_name ||
    user.raw_user_meta_data?.school_name ||
    user.user_metadata?.school_name ||
    null
  );
}

/**
 * Extract school ID from user object, checking all possible locations
 * @param {Object} user - Supabase auth user object
 * @returns {string|null} - School ID or null if not found
 */
export function getSchoolId(user) {
  if (!user) return null;
  
  return (
    user.raw_app_meta_data?.school_id ||
    user.app_metadata?.school_id ||
    user.raw_user_meta_data?.school_id ||
    user.user_metadata?.school_id ||
    null
  );
}

/**
 * Extract super admin code from user object, checking all possible locations
 * @param {Object} user - Supabase auth user object
 * @returns {string|null} - Super admin code or null if not found
 */
export function getSuperAdminCode(user) {
  if (!user) return null;
  
  return (
    user.raw_app_meta_data?.super_admin_code ||
    user.app_metadata?.super_admin_code ||
    user.raw_user_meta_data?.super_admin_code ||
    user.user_metadata?.super_admin_code ||
    null
  );
}

/**
 * Extract student code from user object, checking all possible locations
 * @param {Object} user - Supabase auth user object
 * @returns {string|null} - Student code or null if not found
 */
export function getStudentCode(user) {
  if (!user) return null;
  
  return (
    user.raw_app_meta_data?.student_code ||
    user.app_metadata?.student_code ||
    user.raw_user_meta_data?.student_code ||
    user.user_metadata?.student_code ||
    null
  );
}

/**
 * Extract full name from user object, checking all possible locations
 * @param {Object} user - Supabase auth user object
 * @returns {string|null} - Full name or null if not found
 */
export function getFullName(user) {
  if (!user) return null;
  
  return (
    user.raw_app_meta_data?.full_name ||
    user.app_metadata?.full_name ||
    user.raw_user_meta_data?.full_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.fullName ||
    null
  );
}

/**
 * Extract phone number from user object, checking all possible locations
 * @param {Object} user - Supabase auth user object
 * @returns {string|null} - Phone number or null if not found
 */
export function getPhone(user) {
  if (!user) return null;
  
  return (
    user.raw_app_meta_data?.phone ||
    user.app_metadata?.phone ||
    user.raw_user_meta_data?.phone ||
    user.user_metadata?.phone ||
    null
  );
}

/**
 * Get normalized user metadata object with all common fields
 * @param {Object} user - Supabase auth user object
 * @returns {Object} - Normalized metadata object
 */
export function getNormalizedUserMetadata(user) {
  if (!user) return null;
  
  return {
    role: getUserRole(user),
    schoolCode: getSchoolCode(user),
    schoolName: getSchoolName(user),
    schoolId: getSchoolId(user),
    superAdminCode: getSuperAdminCode(user),
    studentCode: getStudentCode(user),
    fullName: getFullName(user),
    phone: getPhone(user),
    email: user.email,
    id: user.id
  };
}

/**
 * Check if user has required role
 * @param {Object} user - Supabase auth user object
 * @param {string|Array} requiredRoles - Required role(s)
 * @returns {boolean} - Whether user has required role
 */
export function hasRole(user, requiredRoles) {
  const userRole = getUserRole(user);
  if (!userRole) return false;
  
  if (Array.isArray(requiredRoles)) {
    return requiredRoles.includes(userRole);
  }
  
  return userRole === requiredRoles;
}

/**
 * Check if user is admin (admin or superadmin)
 * @param {Object} user - Supabase auth user object
 * @returns {boolean} - Whether user is admin
 */
export function isAdmin(user) {
  return hasRole(user, ['admin', 'superadmin']);
}

/**
 * Check if user is student
 * @param {Object} user - Supabase auth user object
 * @returns {boolean} - Whether user is student
 */
export function isStudent(user) {
  return hasRole(user, 'student');
}

/**
 * Check if user is superadmin
 * @param {Object} user - Supabase auth user object
 * @returns {boolean} - Whether user is superadmin
 */
export function isSuperAdmin(user) {
  return hasRole(user, 'superadmin');
}

/**
 * Check if user is cb_admin
 * @param {Object} user - Supabase auth user object
 * @returns {boolean} - Whether user is cb_admin
 */
export function isCBAdmin(user) {
  return hasRole(user, 'cb_admin');
}
