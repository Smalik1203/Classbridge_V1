// Role-based route access matrix and helpers

export type AppRole = 'cb_admin' | 'superadmin' | 'admin' | 'student';

export type RouteKey =
  | 'root'
  | 'login'
  | 'dashboard'
  | 'addSchools'
  | 'addSuperAdmin'
  | 'schoolSetup'
  | 'addAdmin'
  | 'addStudent'
  | 'addSpecificClass'
  | 'timetable'
  | 'addSubjects'
  | 'syllabus'
  | 'assessments'
  | 'testManagement'
  | 'attendance'
  | 'fees'
  | 'feeManage'
  | 'feeCollections'
  | 'analytics'
  | 'learningResources'
  | 'signup'
  | 'unauthorized';

type RouteAccess = Record<RouteKey, AppRole[]>;

// Central access matrix
export const routeAccess: RouteAccess = {
  root: ['cb_admin', 'superadmin', 'admin', 'student'],
  login: ['cb_admin', 'superadmin', 'admin', 'student'],
  dashboard: ['cb_admin', 'superadmin', 'admin', 'student'],

  // Platform-level
  addSchools: ['cb_admin'],
  addSuperAdmin: ['cb_admin'],

  // School owner
  schoolSetup: ['superadmin'],
  addAdmin: ['superadmin'],
  addStudent: ['superadmin', 'admin'],
  addSpecificClass: ['superadmin'],

  // Timetable and syllabus operations within school
  timetable: ['superadmin', 'admin', 'student'],
  addSubjects: ['superadmin', 'admin'],
  syllabus: ['superadmin', 'admin', 'student'],

  // Daily operations
  assessments: ['superadmin', 'admin', 'student'],
  testManagement: ['superadmin', 'admin'],
  attendance: ['superadmin', 'admin', 'student'],
  fees: ['superadmin', 'admin', 'student'],
  feeManage: ['superadmin', 'admin'],
  feeCollections: ['superadmin', 'admin'],
  analytics: ['superadmin', 'admin'],
  learningResources: ['superadmin', 'admin', 'student'],
  

  signup: ['cb_admin', 'superadmin', 'admin', 'student'],
  unauthorized: ['cb_admin', 'superadmin', 'admin', 'student'],
};

export function isRoleAllowed(routeKey: RouteKey, role?: AppRole | null): boolean {
  if (!role) return false;
  return routeAccess[routeKey]?.includes(role) ?? false;
}

export function getUserRole(user: any): AppRole | null {
  // Use comprehensive metadata extraction
  const role = user?.raw_app_meta_data?.role ||
               user?.app_metadata?.role ||
               user?.raw_user_meta_data?.role ||
               user?.user_metadata?.role as AppRole | undefined;
  return role ?? null;
}


