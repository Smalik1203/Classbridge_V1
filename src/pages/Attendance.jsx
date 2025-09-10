import React from 'react';
import { useAuth } from '../AuthProvider';
import UnifiedAttendance from './UnifiedAttendance';

const AttendancePage = () => {
  const { user } = useAuth();
  const role = user?.app_metadata?.role;

  if (!role) return <div>Access Denied</div>;
  return <UnifiedAttendance />;
};

export default AttendancePage;
