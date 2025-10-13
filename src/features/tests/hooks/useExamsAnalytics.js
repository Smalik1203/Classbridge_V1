// src/hooks/useExamsAnalytics.js
// Container hook for exams analytics with percentage normalization

import { useState, useEffect } from 'react';
import { supabase } from '@/config/supabaseClient';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

// Configure dayjs for IST timezone
dayjs.extend(utc);
dayjs.extend(timezone);

const IST_TIMEZONE = 'Asia/Kolkata';

export const useExamsAnalytics = ({ startDate, endDate, classId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchExamsData = async () => {
      if (!startDate || !endDate) {
        setData(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Convert dates to IST
        const startIST = dayjs(startDate).tz(IST_TIMEZONE).startOf('day');
        const endIST = dayjs(endDate).tz(IST_TIMEZONE).endOf('day');

        // Get tests data using secure RPC
        const { getExamsAnalytics } = await import('@/features/analytics/services/mcpAnalyticsService');
        const testsData = await getExamsAnalytics({
          startDate: startIST.toISOString(),
          endDate: endIST.toISOString(),
          classId
        });

        // Data is already processed by the RPC function
        setData(testsData);

      } catch (err) {
        setError(err.message || 'Failed to load exams data');
      } finally {
        setLoading(false);
      }
    };

    fetchExamsData();
  }, [startDate, endDate, classId]);

  return { loading, error, data };
};
