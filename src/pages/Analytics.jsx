import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { getUserRole } from '../utils/metadata';
import AdminAnalytics from './admin/AdminAnalytics';
import StudentAnalytics from './student/StudentAnalytics';
import SuperAdminAnalytics from './superadmin/SuperAdminAnalytics';
import AttendanceOverview from './analytics/AttendanceOverview';
import ClassComparison from './analytics/ClassComparison';
import StudentComparison from './analytics/StudentComparison';
import AnalyticsHub from './analytics/AnalyticsHub';

const AnalyticsPage = () => {
  const { user } = useAuth();
  const role = getUserRole(user);

  // Role-based access control
  const canAccessAttendanceAnalytics = ['superadmin', 'admin', 'student'].includes(role);
  const canAccessClassComparison = ['superadmin', 'admin'].includes(role);
  const canAccessStudentComparison = ['superadmin', 'admin'].includes(role);
  const canAccessAnalyticsHub = ['superadmin', 'admin', 'student'].includes(role);

  return (
    <Routes>
      {/* Default redirect based on role */}
      <Route 
        path="/" 
        element={
          <Navigate 
            to={role === 'student' ? '/analytics/attendance/overview' : '/analytics/hub'} 
            replace 
          />
        } 
      />
      
      {/* Analytics Hub */}
      {canAccessAnalyticsHub && (
        <Route path="/hub" element={<AnalyticsHub />} />
      )}
      
      {/* Attendance Analytics Routes */}
      {canAccessAttendanceAnalytics && (
        <>
          <Route path="/attendance/overview" element={<AttendanceOverview />} />
        </>
      )}
      
      {canAccessClassComparison && (
        <Route path="/attendance/classes" element={<ClassComparison />} />
      )}
      
      {canAccessStudentComparison && (
        <Route path="/attendance/students" element={<StudentComparison />} />
      )}

      {/* Legacy Analytics Routes */}
      <Route path="/admin" element={<AdminAnalytics />} />
      <Route path="/student" element={<StudentAnalytics />} />
      <Route path="/superadmin" element={<SuperAdminAnalytics />} />
      
      {/* Fallback */}
      <Route path="*" element={<div>Page not found</div>} />
    </Routes>
  );
};

export default AnalyticsPage;
