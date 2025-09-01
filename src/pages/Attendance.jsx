import React from 'react';
import { useAuth } from '../AuthProvider';
import AdminAttendance from './admin/AdminAttendance';
import StudentAnalytics from './student/StudentAnalytics';
import SuperAdminAttendance from './superadmin/SuperAdminAttendance';

const AttendancePage = () => {
  const { user } = useAuth();
  const role = user?.app_metadata?.role;

  switch (role) {
    case 'superadmin':
      return <SuperAdminAttendance />;
    case 'admin':
      return <AdminAttendance />;
    case 'student':
      return <StudentAnalytics />;
    default:
      return <div>Access Denied</div>;
  }
};

export default AttendancePage;
