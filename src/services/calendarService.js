import { supabase } from '../config/supabaseClient';
import dayjs from 'dayjs';

/**
 * Calendar Service - Handles calendar events and holiday checking
 */
export class CalendarService {
  
  /**
   * Check if a specific date is a holiday
   * @param {string} schoolCode - School code
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} classInstanceId - Optional class instance ID
   * @returns {Promise<boolean>} - True if the date is a holiday
   */
  static async isHolidayDate(schoolCode, date, classInstanceId = null) {
    try {
      const currentDate = dayjs(date);
      
      // Check if it's a Sunday
      const isSunday = currentDate.day() === 0;
      if (isSunday) {
        return true;
      }
      
      // Check for explicit holiday events
      let query = supabase
        .from('school_calendar_events')
        .select('id')
        .eq('school_code', schoolCode)
        .ilike('event_type', 'holiday')
        .eq('is_active', true)
        .or(`start_date.eq.${date},and(start_date.lte.${date},end_date.gte.${date})`);
      
      // Add class-based filtering
      if (classInstanceId) {
        // Include events for this specific class OR events for all classes (class_instance_id IS NULL)
        query = query.or(`class_instance_id.eq.${classInstanceId},class_instance_id.is.null`);
      } else {
        // If no class specified, only include events for all classes
        query = query.is('class_instance_id', null);
      }
      
      const { data, error } = await query.limit(1);
      
      if (error) throw error;
      
      // Return true if there's an explicit holiday event
      return data && data.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get events for a specific date
   * @param {string} schoolCode - School code
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Array>} - Array of events for the date
   */
  static async getEventsForDate(schoolCode, date) {
    try {
      const { data, error } = await supabase
        .from('school_calendar_events')
        .select('*')
        .eq('school_code', schoolCode)
        .eq('is_active', true)
        .or(`start_date.eq.${date},and(start_date.lte.${date},end_date.gte.${date})`)
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get events for a date range
   * @param {string} schoolCode - School code
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @param {string} academicYearId - Optional academic year ID
   * @returns {Promise<Array>} - Array of events in the date range
   */
  static async getEventsForDateRange(schoolCode, startDate, endDate, academicYearId = null) {
    try {
      let query = supabase
        .from('school_calendar_events')
        .select('*')
        .eq('school_code', schoolCode)
        .eq('is_active', true)
        .gte('start_date', startDate)
        .lte('start_date', endDate)
        .order('start_date', { ascending: true });

      if (academicYearId) {
        query = query.or(`academic_year_id.eq.${academicYearId},academic_year_id.is.null`);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get holiday information for a specific date
   * @param {string} schoolCode - School code
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} classInstanceId - Optional class instance ID
   * @returns {Promise<Object|null>} - Holiday information or null
   */
  static async getHolidayInfo(schoolCode, date, classInstanceId = null) {
    try {
      const currentDate = dayjs(date);
      
      // Check if it's a Sunday
      const isSunday = currentDate.day() === 0;
      if (isSunday) {
        return {
          title: 'Sunday',
          description: 'Sunday is a weekend day. No timetable can be scheduled.',
          event_type: 'holiday'
        };
      }
      
      // Check for explicit holiday events
      let query = supabase
        .from('school_calendar_events')
        .select('*')
        .eq('school_code', schoolCode)
        .ilike('event_type', 'holiday')
        .eq('is_active', true)
        .or(`start_date.eq.${date},and(start_date.lte.${date},end_date.gte.${date})`);
      
      // Add class-based filtering
      if (classInstanceId) {
        // Include events for this specific class OR events for all classes (class_instance_id IS NULL)
        query = query.or(`class_instance_id.eq.${classInstanceId},class_instance_id.is.null`);
      } else {
        // If no class specified, only include events for all classes
        query = query.is('class_instance_id', null);
      }
      
      const { data, error } = await query.limit(1).single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No holiday found
          return null;
        }
        throw error;
      }
      return data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Create a new calendar event
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} - Created event
   */
  static async createEvent(eventData) {
    try {
      const { data, error } = await supabase
        .from('school_calendar_events')
        .insert([eventData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update an existing calendar event
   * @param {string} eventId - Event ID
   * @param {Object} eventData - Updated event data
   * @returns {Promise<Object>} - Updated event
   */
  static async updateEvent(eventId, eventData) {
    try {
      const { data, error } = await supabase
        .from('school_calendar_events')
        .update(eventData)
        .eq('id', eventId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete a calendar event
   * @param {string} eventId - Event ID
   * @returns {Promise<void>}
   */
  static async deleteEvent(eventId) {
    try {
      const { error } = await supabase
        .from('school_calendar_events')
        .delete()
        .eq('id', eventId);
      
      if (error) throw error;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all event types with their colors
   * @returns {Array} - Array of event types with colors
   */
  static getEventTypes() {
    return [
      { value: 'holiday', label: 'Holiday', color: '#ff4d4f' },
      { value: 'assembly', label: 'Assembly', color: '#1890ff' },
      { value: 'exam', label: 'Exam', color: '#faad14' },
      { value: 'ptm', label: 'PTM', color: '#52c41a' },
      { value: 'sports_day', label: 'Sports Day', color: '#722ed1' },
      { value: 'cultural_event', label: 'Cultural Event', color: '#eb2f96' },
      { value: 'other', label: 'Other', color: '#8c8c8c' }
    ];
  }
}

export default CalendarService;
