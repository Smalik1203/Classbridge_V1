import React from 'react';
import { useAuth } from '../AuthProvider';
import { getUserRole } from '../utils/metadata';
import AdminAnalytics from './admin/AdminAnalytics';
import StudentAnalytics from './student/StudentAnalytics';
import SuperAdminAnalytics from './superadmin/SuperAdminAnalytics';

const AnalyticsPage = () => {
  const { user } = useAuth();
  const role = getUserRole(user);

  switch (role) {
    case 'superadmin':
      return <SuperAdminAnalytics />;
    case 'admin':
      return <AdminAnalytics />;
    case 'student':
      return <StudentAnalytics />;
    default:
      return <div>Access Denied</div>;
  }
};

export default AnalyticsPage;
