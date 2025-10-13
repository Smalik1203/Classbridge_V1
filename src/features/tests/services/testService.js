// src/services/testService.js
import { supabase } from '@/config/supabaseClient';
import { createTestCalendarEvent, updateTestCalendarEvent, deleteTestCalendarEvent } from '@/features/calendar/services/calendarIntegrationService';

/**
 * Get all tests for a school
 */
export const getTests = async (schoolCode) => {
  try {
    // Get tests with relationships
    const { data: tests, error } = await supabase
      .from('tests')
      .select(`
        *,
        class_instances(grade, section, school_code),
        subjects(subject_name, school_code)
      `)
      .eq('school_code', schoolCode)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!tests || tests.length === 0) {
      return [];
    }

    // Get question counts for each test and marks info for offline tests
    const testsWithCounts = await Promise.all(
      tests.map(async (test) => {
        try {
          let question_count = 0;
          let marks_uploaded = 0;
          let total_students = 0;

          if (test.test_mode === 'online') {
            // For online tests, get question count
            const { count, error: countError } = await supabase
              .from('test_questions')
              .select('*', { count: 'exact', head: true })
              .eq('test_id', test.id);

            if (!countError) {
              question_count = count || 0;
            }
          } else if (test.test_mode === 'offline') {
            // For offline tests, get marks info
            const { count: marksCount, error: marksError } = await supabase
              .from('test_marks')
              .select('*', { count: 'exact', head: true })
              .eq('test_id', test.id);

            if (!marksError) {
              marks_uploaded = marksCount || 0;
            }

            // Get total students in the class
            const { count: studentsCount, error: studentsError } = await supabase
              .from('student')
              .select('*', { count: 'exact', head: true })
              .eq('class_instance_id', test.class_instance_id);

            if (!studentsError) {
              total_students = studentsCount || 0;
            }
          }

          return { 
            ...test, 
            question_count,
            marks_uploaded,
            total_students,
            class_name: test.class_instances ? `Grade ${test.class_instances.grade} ${test.class_instances.section}` : 'Unknown',
            subject_name: test.subjects ? test.subjects.subject_name : 'Unknown'
          };
        } catch (error) {
          return { 
            ...test, 
            question_count: 0, 
            marks_uploaded: 0, 
            total_students: 0,
            class_name: test.class_instances ? `Grade ${test.class_instances.grade} ${test.class_instances.section}` : 'Unknown',
            subject_name: test.subjects ? test.subjects.subject_name : 'Unknown'
          };
        }
      })
    );

    return testsWithCounts;
  } catch (error) {
    throw error;
  }
};

/**
 * Create a new test
 */
export const createTest = async (testData) => {
  try {
    const { data, error } = await supabase
      .from('tests')
      .insert([testData])
      .select()
      .single();

    if (error) throw error;

    // Calendar event will be created automatically by database trigger
    // Trigger frontend refresh
    window.dispatchEvent(new CustomEvent('calendarRefresh'));

    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Update an existing test
 */
export const updateTest = async (testId, testData) => {
  try {
    // Get the original test data first
    const { data: originalTest, error: fetchError } = await supabase
      .from('tests')
      .select('*')
      .eq('id', testId)
      .single();

    if (fetchError) throw fetchError;

    const { data, error } = await supabase
      .from('tests')
      .update(testData)
      .eq('id', testId)
      .select()
      .single();

    if (error) throw error;

    // Calendar event will be updated automatically by database trigger
    // Trigger frontend refresh
    window.dispatchEvent(new CustomEvent('calendarRefresh'));

    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Delete a test
 */
export const deleteTest = async (testId) => {
  try {
    // Get the test data first to delete calendar event
    const { data: testData, error: fetchError } = await supabase
      .from('tests')
      .select('*')
      .eq('id', testId)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from('tests')
      .delete()
      .eq('id', testId);

    if (error) throw error;

    // Calendar event will be deleted automatically by database trigger
    // Trigger frontend refresh
    window.dispatchEvent(new CustomEvent('calendarRefresh'));

    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Get class instances for a school
 */
export const getClassInstances = async (schoolCode) => {
  try {
    const { data, error } = await supabase
      .from('class_instances')
      .select('id, grade, section, school_code')
      .eq('school_code', schoolCode)
      .order('grade', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    throw error;
  }
};

/**
 * Get subjects for a school
 */
export const getSubjects = async (schoolCode) => {
  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('id, subject_name, school_code')
      .eq('school_code', schoolCode)
      .order('subject_name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    throw error;
  }
};

/**
 * Get students for a class instance
 */
export const getStudentsForClass = async (classInstanceId) => {
  try {
    const { data, error } = await supabase
      .from('student')
      .select('id, student_code, full_name, email')
      .eq('class_instance_id', classInstanceId)
      .order('full_name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    throw error;
  }
};

/**
 * Get test marks for an offline test
 * @deprecated Use offlineTestService.getTestMarks instead
 */
export const getTestMarks = async (testId) => {
  try {
    const { data, error } = await supabase
      .from('test_marks')
      .select(`
        *,
        student:student_id(id, student_code, full_name, email)
      `)
      .eq('test_id', testId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    throw error;
  }
};

/**
 * Upload marks for offline test
 * @deprecated Use offlineTestService.saveTestMarks or bulkSaveTestMarks instead
 */
export const uploadTestMarks = async (testId, marksData) => {
  try {
    // Use upsert instead of delete + insert to avoid data loss

    const { data, error } = await supabase
      .from('test_marks')
      .upsert(marksData, { 
        onConflict: 'test_id,student_id',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    throw error;
  }
};

/**
 * Update individual test mark
 */
export const updateTestMark = async (markId, markData) => {
  try {
    const { data, error } = await supabase
      .from('test_marks')
      .update({
        ...markData,
        updated_at: new Date().toISOString()
      })
      .eq('id', markId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Delete test mark
 */
export const deleteTestMark = async (markId) => {
  try {
    const { error } = await supabase
      .from('test_marks')
      .delete()
      .eq('id', markId);

    if (error) throw error;
    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Get available tests for students (active tests that haven't passed their test date)
 */
export const getAvailableTestsForStudents = async (classInstanceId, schoolCode) => {
  try {
    // Use IST date for comparisons to avoid UTC day shifts
    const dayjs = (await import('dayjs')).default;
    const tz = (await import('dayjs/plugin/timezone')).default;
    const utc = (await import('dayjs/plugin/utc')).default;
    dayjs.extend(utc);
    dayjs.extend(tz);
    const today = dayjs().tz('Asia/Kolkata').format('YYYY-MM-DD');
    
    const { data: tests, error } = await supabase
      .from('tests')
      .select(`
        *,
        class_instances(grade, section, school_code),
        subjects(subject_name, school_code),
        syllabus_chapters(id, chapter_no, title, description)
      `)
      .eq('class_instance_id', classInstanceId)
      .eq('school_code', schoolCode)
      .eq('status', 'active')
      .or(`test_date.is.null,test_date.gte.${today}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return tests || [];
  } catch (error) {
    throw error;
  }
};

/**
 * Get students for a specific class instance
 */
export const getStudentsForClassInstance = async (classInstanceId, schoolCode) => {
  try {
    const { data: students, error } = await supabase
      .from('student')
      .select('id, student_code, full_name, email, phone')
      .eq('class_instance_id', classInstanceId)
      .eq('school_code', schoolCode)
      .order('student_code');

    if (error) throw error;
    return students || [];
  } catch (error) {
    throw error;
  }
};

/**
 * Get test details with max marks
 */
export const getTestDetails = async (testId) => {
  try {
    const { data: test, error } = await supabase
      .from('tests')
      .select('*')
      .eq('id', testId)
      .single();

    if (error) throw error;
    return test;
  } catch (error) {
    throw error;
  }
};

/**
 * Bulk upsert test marks with chunked operations
 */
export const bulkUpsertTestMarks = async (marksData, chunkSize = 50) => {
  try {
    const chunks = [];
    for (let i = 0; i < marksData.length; i += chunkSize) {
      chunks.push(marksData.slice(i, i + chunkSize));
    }

    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      const { data, error } = await supabase
        .from('test_marks')
        .upsert(chunk, { 
          onConflict: 'test_id,student_id',
          ignoreDuplicates: false 
        })
        .select();

      if (error) {
        throw error;
      }
      
      results.push(...(data || []));
    }

    return { data: results, error: null };
  } catch (error) {
    throw error;
  }
};
