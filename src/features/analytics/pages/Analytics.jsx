import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AnalyticsShell from './AnalyticsShell';
import AnalyticsHub from './AnalyticsHub';
import AttendanceAnalytics from './AttendanceAnalytics';
import FeesAnalytics from './FeesAnalytics';
import TasksAnalytics from './TasksAnalytics';
import SyllabusAnalytics from './SyllabusAnalytics';
import AcademicAnalytics from './AcademicAnalytics';
import HrAnalytics from './HrAnalytics';
import StudentScopedAnalytics from './StudentScopedAnalytics';
import ClassScopedAnalytics from './ClassScopedAnalytics';

// Legacy URL → new-IA redirects so old links don't 404.
const legacyToFeature = {
  '/analytics/daily-trends':         '/analytics/attendance',
  '/analytics/student-performance':  '/analytics/academic',
  '/analytics/class-comparison':     '/analytics/academic',
  '/analytics/status-distribution':  '/analytics/academic',
  '/analytics/weak-areas':           '/analytics/academic?view=weak-areas',
  '/analytics/topic-heatmap':        '/analytics/academic?view=heatmap',
  '/analytics/misconception-report': '/analytics/academic?view=misconceptions',
};

const LegacyRedirect = ({ to }) => <Navigate to={to} replace />;

export default function AnalyticsRouter() {
  return (
      <Routes>
        <Route element={<AnalyticsShell />}>
          <Route path="/" element={<AnalyticsHub />} />
          <Route path="/attendance" element={<AttendanceAnalytics />} />
          <Route path="/fees" element={<FeesAnalytics />} />
          <Route path="/tasks" element={<TasksAnalytics />} />
          <Route path="/syllabus" element={<SyllabusAnalytics />} />
          <Route path="/academic" element={<AcademicAnalytics />} />
          <Route path="/hr" element={<HrAnalytics />} />
        </Route>

        {/* Detail drill-down pages render their own header (legacy UnifiedAnalytics) */}
        <Route path="/student/:studentId" element={<StudentScopedAnalytics />} />
        <Route path="/class/:classInstanceId" element={<ClassScopedAnalytics />} />

        {/* Legacy URLs */}
        {Object.entries(legacyToFeature).map(([from, to]) => (
          <Route key={from} path={from.replace('/analytics', '')} element={<LegacyRedirect to={to} />} />
        ))}
        <Route path="/hub" element={<Navigate to="/analytics" replace />} />
        <Route path="/admin" element={<Navigate to="/analytics" replace />} />
        <Route path="/superadmin" element={<Navigate to="/analytics" replace />} />
        <Route path="/student" element={<Navigate to="/analytics" replace />} />
        <Route path="*" element={<Navigate to="/analytics" replace />} />
      </Routes>
  );
}
