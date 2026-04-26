// School Feature - Public API
//
// Note: AddAdmin, AddSuperAdmin, SignUpUser, SuperAdminCounter, and AddStudent
// were moved to src/features/users/ as part of the User Management consolidation.
export { default as AddSpecificClass } from './components/AddSpecificClass';
export { default as AddSubjects } from './components/AddSubjects';

export { default as AddSchoolsPage } from './pages/AddSchools';
export { default as SetupSchoolPage } from './pages/SetupSchool';
export { default as AdminDashboardPage } from './pages/AdminDashboard';
export { default as CBAdminDashboardPage } from './pages/CBAdminDashboard';

export * as schoolService from './services/schoolService';
export * as subjectService from './services/subjectService';

