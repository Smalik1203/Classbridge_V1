/**
 * Correct Offline Test Service - Based on Actual Database Schema
 * 
 * This service uses the actual database structure and proper queries
 */

import { supabase } from '../config/supabaseClient.js';

/**
 * Get test details - using actual database columns
 */
export const getTestDetails = async (testId) => {
  try {
    
    const { data, error } = await supabase
      .from('tests')
      .select(`
        id,
        title,
        description,
        test_mode,
        test_type,
        class_instance_id,
        school_code,
        test_date,
        status,
        created_at
      `)
      .eq('id', testId)
      .eq('test_mode', 'offline')
      .single();

    if (error) {
      return {
        success: false,
        error: `Failed to fetch test details: ${error.message}`,
        data: null,
        count: 0
      };
    }

    if (!data) {
      return {
        success: false,
        error: 'Test not found',
        data: null,
        count: 0
      };
    }

    return {
      success: true,
      data,
      error: null,
      count: 1
    };
  } catch (err) {
    return {
      success: false,
      error: `Unexpected error: ${err.message}`,
      data: null,
      count: 0
    };
  }
};

/**
 * Get students for class instance - using actual database columns
 */
export const getStudentsForClass = async (classInstanceId) => {
  try {
    
    const { data, error } = await supabase
      .from('student')
      .select(`
        id,
        student_code,
        full_name,
        email,
        phone,
        school_code,
        class_instance_id,
        created_at
      `)
      .eq('class_instance_id', classInstanceId)
      .order('student_code');

    if (error) {
      return {
        success: false,
        error: `Failed to fetch students: ${error.message}`,
        data: null,
        count: 0
      };
    }

    return {
      success: true,
      data: data || [],
      error: null,
      count: data?.length || 0
    };
  } catch (err) {
    return {
      success: false,
      error: `Unexpected error: ${err.message}`,
      data: null,
      count: 0
    };
  }
};

/**
 * Get test marks - using actual database columns
 */
export const getTestMarks = async (testId) => {
  try {
    
    const { data, error } = await supabase
      .from('test_marks')
      .select(`
        id,
        test_id,
        student_id,
        marks_obtained,
        max_marks,
        remarks,
        created_at,
        updated_at
      `)
      .eq('test_id', testId);

    if (error) {
      return {
        success: false,
        error: `Failed to fetch test marks: ${error.message}`,
        data: null,
        count: 0
      };
    }

    return {
      success: true,
      data: data || [],
      error: null,
      count: data?.length || 0
    };
  } catch (err) {
    return {
      success: false,
      error: `Unexpected error: ${err.message}`,
      data: null,
      count: 0
    };
  }
};

/**
 * Save test marks - using actual database columns
 */
export const saveTestMarks = async (marksData) => {
  try {
    
    if (!Array.isArray(marksData) || marksData.length === 0) {
      return {
        success: false,
        error: 'No marks data provided',
        data: null,
        count: 0
      };
    }

    // Prepare data for upsert - only include fields that exist in the database
    const preparedData = marksData.map(mark => ({
      test_id: mark.test_id,
      student_id: mark.student_id,
      marks_obtained: mark.marks_obtained,
      max_marks: mark.max_marks,
      remarks: mark.remarks || null,
      created_by: mark.created_by || null,
      updated_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('test_marks')
      .upsert(preparedData, {
        onConflict: 'test_id,student_id',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      return {
        success: false,
        error: `Failed to save test marks: ${error.message}`,
        data: null,
        count: 0
      };
    }

    return {
      success: true,
      data: data || [],
      error: null,
      count: data?.length || 0
    };
  } catch (err) {
    return {
      success: false,
      error: `Unexpected error: ${err.message}`,
      data: null,
      count: 0
    };
  }
};

/**
 * Get test with students and marks in one query
 */
export const getTestWithStudentsAndMarks = async (testId) => {
  try {
    
    // First get test details
    const testResult = await getTestDetails(testId);
    if (!testResult.success) {
      return testResult;
    }

    // Then get students for the class
    const studentsResult = await getStudentsForClass(testResult.data.class_instance_id);
    if (!studentsResult.success) {
      return studentsResult;
    }

    // Then get existing marks
    const marksResult = await getTestMarks(testId);
    if (!marksResult.success) {
      return marksResult;
    }

    // Combine the data
    const studentsWithMarks = studentsResult.data.map(student => {
      const existingMark = marksResult.data.find(m => m.student_id === student.id);
      return {
        ...student,
        marks_obtained: existingMark?.marks_obtained || null,
        max_marks: existingMark?.max_marks || 100, // Default max marks
        remarks: existingMark?.remarks || '',
        has_marks: !!existingMark
      };
    });

    return {
      success: true,
      data: {
        test: testResult.data,
        students: studentsWithMarks,
        existing_marks: marksResult.data
      },
      error: null,
      count: studentsWithMarks.length
    };
  } catch (err) {
    return {
      success: false,
      error: `Unexpected error: ${err.message}`,
      data: null,
      count: 0
    };
  }
};
