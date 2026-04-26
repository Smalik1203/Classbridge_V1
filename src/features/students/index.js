// Students Feature - Public API
//
// Note: AddStudent moved to src/features/users/ as part of the User Management
// consolidation — student account creation is now an "invite" inside /users.
export { default as SubjectFilter } from './components/SubjectFilter';
export { default as ClassDetailView } from './components/ClassDetailView';

export { default as useStudentsByClass } from './hooks/useStudentsByClass';

export { default as StudentAnalyticsPage } from './pages/StudentAnalytics';
export { default as StudentAttendancePage } from './pages/StudentAttendance';
export { default as StudentResultsPage } from './pages/StudentResults';
export { default as DashboardPage } from './pages/Dashboard';

export * as studentService from './services/studentService';
export * as importService from './services/importService';

