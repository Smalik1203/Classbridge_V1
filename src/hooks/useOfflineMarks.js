import { useState, useEffect, useCallback } from 'react';
import { getTestMarks, bulkUpsertTestMarks } from '../services/testService';
import { useErrorHandler } from './useErrorHandler';

export const useOfflineMarks = (testId) => {
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showError, showSuccess } = useErrorHandler();

  useEffect(() => {
    if (testId) {
      fetchMarks();
    }
  }, [testId]);

  const fetchMarks = async () => {
    try {
      setLoading(true);
      const marksData = await getTestMarks(testId);
      setMarks(marksData);
    } catch (error) {
      showError('Failed to fetch marks: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const saveMarks = useCallback(async (marksData, chunkSize = 200) => {
    try {
      setSaving(true);
      const result = await bulkUpsertTestMarks(marksData, chunkSize);
      showSuccess('Marks saved successfully');
      return result;
    } catch (error) {
      showError('Failed to save marks: ' + error.message);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [showError, showSuccess]);

  const updateMarks = useCallback((newMarks) => {
    setMarks(newMarks);
  }, []);

  return { 
    marks, 
    loading, 
    saving, 
    refetch: fetchMarks, 
    saveMarks, 
    updateMarks 
  };
};
