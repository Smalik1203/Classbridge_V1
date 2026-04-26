import React from 'react';
import { useParams } from 'react-router-dom';
import UnifiedAnalytics from './UnifiedAnalytics';

export default function StudentScopedAnalytics() {
  const { studentId } = useParams();
  return <UnifiedAnalytics lockedScope="student" lockedStudentId={studentId} />;
}
