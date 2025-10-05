// src/services/calendarIntegrationService.js
import { supabase } from '../config/supabaseClient';

/**
 * Calendar Integration Service
 * Handles integration between calendar, timetable, and tests
 */

// Get timetable data for a specific date and class
export const getTimetableForDate = async (classInstanceId, date, schoolCode) => {
  try {
    const { data, error } = await supabase
      .from('timetable_slots')
      .select(`
        id,
        class_date,
        period_number,
        slot_type,
        name,
        start_time,
        end_time,
        subject_id,
        teacher_id,
        syllabus_chapter_id,
        syllabus_topic_id,
        plan_text,
        subjects!inner(subject_name),
        admin!inner(full_name)
      `)
      .eq('class_instance_id', classInstanceId)
      .eq('class_date', date)
      .eq('school_code', schoolCode)
      .order('start_time', { ascending: true })
      .order('period_number', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching timetable for date:', error);
    throw error;
  }
};

// Get tests for a specific date
export const getTestsForDate = async (date, schoolCode, classInstanceId = null) => {
  try {
    let query = supabase
      .from('tests')
      .select(`
        id,
        title,
        description,
        test_type,
        test_mode,
        test_date,
        time_limit_seconds,
        allow_reattempts,
        status,
        subject_id,
        class_instance_id,
        subjects!inner(subject_name),
        class_instances!inner(grade, section)
      `)
      .eq('test_date', date)
      .eq('school_code', schoolCode)
      .eq('status', 'active');

    if (classInstanceId) {
      query = query.eq('class_instance_id', classInstanceId);
    }

    const { data, error } = await query.order('test_date', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching tests for date:', error);
    throw error;
  }
};

// Get all calendar events for a date range
export const getCalendarEventsForDateRange = async (startDate, endDate, schoolCode, classInstanceId = null) => {
  try {
    let query = supabase
      .from('school_calendar_events')
      .select('*')
      .eq('school_code', schoolCode)
      .eq('is_active', true)
      .gte('start_date', startDate)
      .lte('start_date', endDate);

    if (classInstanceId) {
      query = query.or(`class_instance_id.eq.${classInstanceId},class_instance_id.is.null`);
    }

    const { data, error } = await query.order('start_date', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error;
  }
};

// Get comprehensive day data (timetable + tests + events) using database function
export const getDayData = async (date, schoolCode, classInstanceId = null) => {
  try {
    const dateStr = date.format('YYYY-MM-DD');
    
    // Use the integrated database function for better performance and consistency
    const { data, error } = await supabase
      .rpc('get_day_data_integrated', {
        p_school_code: schoolCode,
        p_date: dateStr,
        p_class_instance_id: classInstanceId
      });

    if (error) throw error;

    const result = data?.[0] || {};
    
    return {
      date: dateStr,
      timetable: result.timetable_slots || [],
      tests: result.tests || [],
      events: result.calendar_events || [],
      hasData: (result.timetable_slots?.length > 0) || (result.tests?.length > 0) || (result.calendar_events?.length > 0)
    };
  } catch (error) {
    console.error('Error fetching day data:', error);
    throw error;
  }
};

// Get classes for a school
export const getClassesForSchool = async (schoolCode) => {
  try {
    const { data, error } = await supabase
      .from('class_instances')
      .select('id, grade, section')
      .eq('school_code', schoolCode)
      .order('grade', { ascending: true })
      .order('section', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching classes:', error);
    throw error;
  }
};

// Create a test event in calendar when test is created
export const createTestCalendarEvent = async (testData, schoolCode) => {
  try {
    if (!testData.test_date) return null; // No date, no calendar event

    const eventData = {
      school_code: schoolCode,
      title: `${testData.title} (${testData.test_type})`,
      description: testData.description || `Test for ${testData.subject_name || 'Subject'}`,
      event_type: 'exam',
      start_date: testData.test_date,
      end_date: testData.test_date,
      is_all_day: true,
      color: '#faad14', // Orange for exams
      is_active: true,
      created_by: testData.created_by,
      class_instance_id: testData.class_instance_id
    };

    const { data, error } = await supabase
      .from('school_calendar_events')
      .insert(eventData)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating test calendar event:', error);
    throw error;
  }
};

// Update test calendar event when test is updated
export const updateTestCalendarEvent = async (testId, testData, schoolCode) => {
  try {
    if (!testData.test_date) return null;

    // Find existing calendar event for this test
    const { data: existingEvent, error: findError } = await supabase
      .from('school_calendar_events')
      .select('id')
      .eq('school_code', schoolCode)
      .eq('event_type', 'exam')
      .eq('start_date', testData.test_date)
      .eq('class_instance_id', testData.class_instance_id)
      .ilike('title', `%${testData.title}%`)
      .single();

    if (findError && findError.code !== 'PGRST116') throw findError;

    const eventData = {
      title: `${testData.title} (${testData.test_type})`,
      description: testData.description || `Test for ${testData.subject_name || 'Subject'}`,
      start_date: testData.test_date,
      end_date: testData.test_date,
      class_instance_id: testData.class_instance_id
    };

    if (existingEvent) {
      // Update existing event
      const { data, error } = await supabase
        .from('school_calendar_events')
        .update(eventData)
        .eq('id', existingEvent.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Create new event
      return await createTestCalendarEvent(testData, schoolCode);
    }
  } catch (error) {
    console.error('Error updating test calendar event:', error);
    throw error;
  }
};

// Delete test calendar event when test is deleted
export const deleteTestCalendarEvent = async (testId, testData, schoolCode) => {
  try {
    const { error } = await supabase
      .from('school_calendar_events')
      .delete()
      .eq('school_code', schoolCode)
      .eq('event_type', 'exam')
      .eq('start_date', testData.test_date)
      .eq('class_instance_id', testData.class_instance_id)
      .ilike('title', `%${testData.title}%`);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting test calendar event:', error);
    throw error;
  }
};

// Get student-specific calendar data
export const getStudentCalendarData = async (studentId, schoolCode, startDate, endDate) => {
  try {
    // Get student's class
    const { data: student, error: studentError } = await supabase
      .from('student')
      .select('class_instance_id')
      .eq('id', studentId)
      .eq('school_code', schoolCode)
      .single();

    if (studentError) throw studentError;
    if (!student?.class_instance_id) return { timetable: [], tests: [], events: [] };

    const [timetableData, testsData, eventsData] = await Promise.all([
      getTimetableForDate(student.class_instance_id, startDate, schoolCode),
      getTestsForDate(startDate, schoolCode, student.class_instance_id),
      getCalendarEventsForDateRange(startDate, endDate, schoolCode, student.class_instance_id)
    ]);

    return {
      timetable: timetableData,
      tests: testsData,
      events: eventsData
    };
  } catch (error) {
    console.error('Error fetching student calendar data:', error);
    throw error;
  }
};

// Refresh calendar events for a school (clean up orphaned events)
export const refreshCalendarEvents = async (schoolCode) => {
  try {
    const { error } = await supabase
      .rpc('refresh_calendar_events', {
        p_school_code: schoolCode
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error refreshing calendar events:', error);
    throw error;
  }
};
