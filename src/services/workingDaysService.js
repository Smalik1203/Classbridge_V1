import { supabase } from '../config/supabaseClient';
import dayjs from 'dayjs';
import CalendarService from './calendarService';

/**
 * Working Days Service - Calculates working days vs holidays for attendance analytics
 */
export class WorkingDaysService {
  
  /**
   * Calculate working days and holidays for a date range
   * @param {string} schoolCode - School code
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @param {string} classInstanceId - Optional class instance ID
   * @returns {Promise<Object>} - Object with working days and holidays count
   */
  static async calculateWorkingDaysAndHolidays(schoolCode, startDate, endDate, classInstanceId = null) {
    try {
      const start = dayjs(startDate);
      const end = dayjs(endDate);
      let workingDays = 0;
      let holidays = 0;
      let sundays = 0;
      let explicitHolidays = 0;

      // Iterate through each day in the range
      let current = start;
      while (current.isBefore(end) || current.isSame(end, 'day')) {
        const dateStr = current.format('YYYY-MM-DD');
        
        // Check if it's a Sunday
        if (current.day() === 0) {
          sundays++;
          holidays++;
        } else {
          // Check if it's an explicit holiday
          const isHoliday = await CalendarService.isHolidayDate(schoolCode, dateStr, classInstanceId);
          if (isHoliday) {
            explicitHolidays++;
            holidays++;
          } else {
            workingDays++;
          }
        }
        
        current = current.add(1, 'day');
      }

      return {
        workingDays,
        holidays,
        sundays,
        explicitHolidays,
        totalDays: workingDays + holidays
      };
    } catch (error) {
      console.error('Error calculating working days:', error);
      return {
        workingDays: 0,
        holidays: 0,
        sundays: 0,
        explicitHolidays: 0,
        totalDays: 0
      };
    }
  }

  /**
   * Get detailed breakdown of days in a date range
   * @param {string} schoolCode - School code
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @param {string} classInstanceId - Optional class instance ID
   * @returns {Promise<Array>} - Array of day objects with type and details
   */
  static async getDaysBreakdown(schoolCode, startDate, endDate, classInstanceId = null) {
    try {
      const start = dayjs(startDate);
      const end = dayjs(endDate);
      const days = [];

      let current = start;
      while (current.isBefore(end) || current.isSame(end, 'day')) {
        const dateStr = current.format('YYYY-MM-DD');
        const dayOfWeek = current.day();
        
        let dayType = 'working';
        let reason = null;
        
        // Check if it's a Sunday
        if (dayOfWeek === 0) {
          dayType = 'holiday';
          reason = 'Sunday';
        } else {
          // Check if it's an explicit holiday
          const isHoliday = await CalendarService.isHolidayDate(schoolCode, dateStr, classInstanceId);
          if (isHoliday) {
            dayType = 'holiday';
            const holidayInfo = await CalendarService.getHolidayInfo(schoolCode, dateStr, classInstanceId);
            reason = holidayInfo ? holidayInfo.title : 'Holiday';
          }
        }

        days.push({
          date: dateStr,
          dayOfWeek: dayOfWeek,
          dayName: current.format('dddd'),
          type: dayType,
          reason: reason
        });
        
        current = current.add(1, 'day');
      }

      return days;
    } catch (error) {
      console.error('Error getting days breakdown:', error);
      return [];
    }
  }

  /**
   * Calculate attendance metrics using working days
   * @param {Array} attendanceRecords - Array of attendance records
   * @param {Object} workingDaysData - Working days calculation result
   * @returns {Object} - Attendance metrics with working days context
   */
  static calculateAttendanceMetrics(attendanceRecords, workingDaysData) {
    const totalStudents = attendanceRecords.length;
    
    // Calculate total student-days for working days
    const totalWorkingStudentDays = totalStudents * workingDaysData.workingDays;
    const totalHolidayStudentDays = totalStudents * workingDaysData.holidays;
    
    // Calculate actual attendance on working days
    const presentOnWorkingDays = attendanceRecords.reduce((sum, student) => sum + student.present_days, 0);
    const absentOnWorkingDays = attendanceRecords.reduce((sum, student) => sum + student.absent_days, 0);
    
    // Calculate working day attendance rate
    const workingDayAttendanceRate = totalWorkingStudentDays > 0 
      ? (presentOnWorkingDays / totalWorkingStudentDays) * 100 
      : 0;

    return {
      totalStudents,
      workingDays: workingDaysData.workingDays,
      holidays: workingDaysData.holidays,
      sundays: workingDaysData.sundays,
      explicitHolidays: workingDaysData.explicitHolidays,
      totalWorkingStudentDays,
      totalHolidayStudentDays,
      presentOnWorkingDays,
      absentOnWorkingDays,
      workingDayAttendanceRate,
      // Legacy metrics for compatibility
      presentCount: presentOnWorkingDays,
      absentCount: absentOnWorkingDays
    };
  }
}
