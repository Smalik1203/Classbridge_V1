// Analytics Feature - Public API (unified module)
export { default as AnalyticsKPI } from './components/AnalyticsKPI';

export { default as AnalyticsPage } from './pages/Analytics';
export { default as AnalyticsHub } from './pages/AnalyticsHub';
export { default as AttendanceAnalytics } from './pages/AttendanceAnalytics';
export { default as FeesAnalytics } from './pages/FeesAnalytics';
export { default as TasksAnalytics } from './pages/TasksAnalytics';
export { default as SyllabusAnalytics } from './pages/SyllabusAnalytics';
export { default as AcademicAnalytics } from './pages/AcademicAnalytics';
export { default as HrAnalytics } from './pages/HrAnalytics';

export { default as StudentScopedAnalytics } from './pages/StudentScopedAnalytics';
export { default as ClassScopedAnalytics } from './pages/ClassScopedAnalytics';
export { default as StudentSelfAnalytics } from './pages/StudentSelfAnalytics';

export { AcademicYearProvider, useAcademicYear } from './context/AcademicYearContext';

export * as analyticsService from './services/analyticsService';
export * as attendanceAnalyticsService from './services/attendanceAnalyticsService';
export * as mcpAnalyticsService from './services/mcpAnalyticsService';
export * as ayScope from './services/ayScope';
