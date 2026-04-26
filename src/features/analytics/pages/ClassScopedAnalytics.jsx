import React from 'react';
import { useParams } from 'react-router-dom';
import UnifiedAnalytics from './UnifiedAnalytics';

export default function ClassScopedAnalytics() {
  const { classInstanceId } = useParams();
  return <UnifiedAnalytics lockedScope="class" lockedClassId={classInstanceId} />;
}
