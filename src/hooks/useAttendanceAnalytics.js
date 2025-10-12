// src/hooks/useAttendanceAnalytics.js
// Container hook for attendance analytics with percentage normalization using MCP

import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

// Configure dayjs for IST timezone
dayjs.extend(utc);
dayjs.extend(timezone);

const IST_TIMEZONE = 'Asia/Kolkata';

export const useAttendanceAnalytics = ({ startDate, endDate, classId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchAttendanceData = async () => {
      if (!startDate || !endDate) {
        setData(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Convert dates to IST and format for database queries
        const startIST = dayjs(startDate).tz(IST_TIMEZONE).startOf('day');
        const endIST = dayjs(endDate).tz(IST_TIMEZONE).endOf('day');

        // Get attendance data using secure RPC
        const { getAttendanceAnalytics } = await import('../services/mcpAnalyticsService');
        const attendance = await getAttendanceAnalytics({
          startDate: startIST.format('YYYY-MM-DD'),
          endDate: endIST.format('YYYY-MM-DD'),
          classId
        });

        // Data is already processed by the RPC function
        setData(attendance);

      } catch (err) {
        setError(err.message || 'Failed to load attendance data');
      } finally {
        setLoading(false);
      }
    };

    fetchAttendanceData();
  }, [startDate, endDate, classId]);

  return { loading, error, data };
};
