// src/hooks/useLearningAnalytics.js
// Container hook for learning analytics with percentage normalization

import { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

// Configure dayjs for IST timezone
dayjs.extend(utc);
dayjs.extend(timezone);

const IST_TIMEZONE = 'Asia/Kolkata';

export const useLearningAnalytics = ({ startDate, endDate, classId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchLearningData = async () => {
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

        // Get learning resources data using secure RPC
        const { getLearningAnalytics } = await import('../services/mcpAnalyticsService');
        const learningData = await getLearningAnalytics({
          startDate: startIST.toISOString(),
          endDate: endIST.toISOString(),
          classId
        });

        // Data is already processed by the RPC function
        setData(learningData);


      } catch (err) {
        setError(err.message || 'Failed to load learning data');
      } finally {
        setLoading(false);
      }
    };

    fetchLearningData();
  }, [startDate, endDate, classId]);

  return { loading, error, data };
};
