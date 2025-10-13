import { useState, useEffect } from 'react';
import { getTestDetails } from '@/features/tests/services/testService';
import { useErrorHandler } from './useErrorHandler';

export const useOfflineTest = (testId) => {
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(false);
  const { showError } = useErrorHandler();

  useEffect(() => {
    if (testId) {
      fetchTest();
    }
  }, [testId]);

  const fetchTest = async () => {
    try {
      setLoading(true);
      const testData = await getTestDetails(testId);
      setTest(testData);
    } catch (error) {
      showError('Failed to fetch test details: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return { test, loading, refetch: fetchTest };
};
