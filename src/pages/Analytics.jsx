import React from 'react';
import { useAuth } from '../AuthProvider';
import { getUserRole } from '../utils/metadata';
import AdminAnalytics from './admin/AdminAnalytics';
import StudentAnalytics from './student/StudentAnalytics';
import SuperAdminAnalytics from './superadmin/SuperAdminAnalytics';
import AttendanceAnalyticsEnhanced from '../components/AttendanceAnalyticsEnhanced';

const AnalyticsPage = () => {
  const { user } = useAuth();
  const role = getUserRole(user);

  switch (role) {
    case 'superadmin':
      return <AttendanceAnalyticsEnhanced />;
    case 'admin':
      return <AttendanceAnalyticsEnhanced />;
    case 'student':
      return <AttendanceAnalyticsEnhanced />;
    default:
      return <div>Access Denied</div>;
  }
};

export default AnalyticsPage;
