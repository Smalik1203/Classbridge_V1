import { useState, useEffect } from 'react';
import { getStudentsForClassInstance } from '@/features/tests/services/testService';
import { useErrorHandler } from './useErrorHandler';

export const useStudentsByClass = (classInstanceId, schoolCode) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const { showError } = useErrorHandler();

  useEffect(() => {
    if (classInstanceId && schoolCode) {
      fetchStudents();
    }
  }, [classInstanceId, schoolCode]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const studentsData = await getStudentsForClassInstance(classInstanceId, schoolCode);
      setStudents(studentsData);
    } catch (error) {
      showError('Failed to fetch students: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return { students, loading, refetch: fetchStudents };
};
