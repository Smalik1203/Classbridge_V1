// src/hooks/useFeesAnalytics.js
// Container hook for fees analytics with percentage normalization

import { useState, useEffect } from 'react';
import { supabase } from '@/config/supabaseClient';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

// Configure dayjs for IST timezone
dayjs.extend(utc);
dayjs.extend(timezone);

const IST_TIMEZONE = 'Asia/Kolkata';

// Helper function to format currency in INR
const formatINR = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export const useFeesAnalytics = ({ startDate, endDate, classId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchFeesData = async () => {
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

        // Get fees data using secure RPC
        const { getFeesAnalytics } = await import('@/features/analytics/services/mcpAnalyticsService');
        const feesData = await getFeesAnalytics({
          startDate: startIST.format('YYYY-MM-DD'),
          endDate: endIST.format('YYYY-MM-DD'),
          classId
        });

        // Data is already processed by the RPC function
        setData(feesData);

      } catch (err) {
        setError(err.message || 'Failed to load fees data');
      } finally {
        setLoading(false);
      }
    };

    fetchFeesData();
  }, [startDate, endDate, classId]);

  return { loading, error, data };
};
