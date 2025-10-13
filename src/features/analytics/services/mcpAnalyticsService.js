// src/services/mcpAnalyticsService.js
// Service for fetching analytics data using secure Supabase RPC functions

import { supabase } from '@/config/supabaseClient';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

// Configure dayjs for IST timezone
dayjs.extend(utc);
dayjs.extend(timezone);

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Get attendance analytics data using secure Supabase RPC
 */
export const getAttendanceAnalytics = async ({ startDate, endDate, classId }) => {
  try {
    // Convert dates to IST and format for database queries
    const startIST = dayjs(startDate).tz(IST_TIMEZONE).startOf('day');
    const endIST = dayjs(endDate).tz(IST_TIMEZONE).endOf('day');

    // Call secure RPC function
    const { data, error } = await supabase.rpc('attendance_analytics', {
      p_start: startIST.format('YYYY-MM-DD'),
      p_end: endIST.format('YYYY-MM-DD'),
      p_class_id: classId && classId !== 'all' ? classId : null
    });

    if (error) {
      throw new Error(`RPC error: ${error.message}`);
    }

    return data;

  } catch (error) {
    throw new Error(`Failed to load attendance data: ${error.message}`);
  }
};

/**
 * Get fees analytics data using secure Supabase RPC
 */
export const getFeesAnalytics = async ({ startDate, endDate, classId }) => {
  try {
    // Convert dates to IST
    const startIST = dayjs(startDate).tz(IST_TIMEZONE).startOf('day');
    const endIST = dayjs(endDate).tz(IST_TIMEZONE).endOf('day');

    // Call secure RPC function
    const { data, error } = await supabase.rpc('fees_analytics', {
      p_start: startIST.format('YYYY-MM-DD'),
      p_end: endIST.format('YYYY-MM-DD'),
      p_class_id: classId && classId !== 'all' ? classId : null
    });

    if (error) {
      throw new Error(`RPC error: ${error.message}`);
    }

    return data;

  } catch (error) {
    throw new Error(`Failed to load fees data: ${error.message}`);
  }
};

/**
 * Get exams analytics data using secure Supabase RPC
 */
export const getExamsAnalytics = async ({ startDate, endDate, classId }) => {
  try {
    // Convert dates to IST
    const startIST = dayjs(startDate).tz(IST_TIMEZONE).startOf('day');
    const endIST = dayjs(endDate).tz(IST_TIMEZONE).endOf('day');

    // Call secure RPC function
    const { data, error } = await supabase.rpc('exams_analytics', {
      p_start: startIST.toISOString(),
      p_end: endIST.toISOString(),
      p_class_id: classId && classId !== 'all' ? classId : null,
      p_pass_threshold: 40
    });

    if (error) {
      throw new Error(`RPC error: ${error.message}`);
    }

    return data;

  } catch (error) {
    throw new Error(`Failed to load exams data: ${error.message}`);
  }
};

/**
 * Get learning analytics data using secure Supabase RPC
 */
export const getLearningAnalytics = async ({ startDate, endDate, classId }) => {
  try {
    // Convert dates to IST
    const startIST = dayjs(startDate).tz(IST_TIMEZONE).startOf('day');
    const endIST = dayjs(endDate).tz(IST_TIMEZONE).endOf('day');

    // Call secure RPC function
    const { data, error } = await supabase.rpc('learning_analytics', {
      p_start: startIST.toISOString(),
      p_end: endIST.toISOString(),
      p_class_id: classId && classId !== 'all' ? classId : null
    });

    if (error) {
      throw new Error(`RPC error: ${error.message}`);
    }

    return data;

  } catch (error) {
    throw new Error(`Failed to load learning data: ${error.message}`);
  }
};
