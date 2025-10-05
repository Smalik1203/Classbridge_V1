/**
 * Temporary Offline Test Service - Works without user metadata
 * 
 * This is a temporary fix for the offline test modal issues.
 * Use this until user metadata is properly set up.
 */

import { supabase } from '../config/supabaseClient.js';

/**
 * Get test details without RLS restrictions (temporary)
 */
export const getTestDetails = async (testId) => {
  try {
    console.log('🔍 getTestDetails called with testId:', testId);
    
    const { data, error } = await supabase
      .from('tests')
      .select(`
        id,
        title,
        description,
        class_instance_id,
        school_code,
        test_mode,
        test_type,
        created_at
      `)
      .eq('id', testId)
      .eq('test_mode', 'offline')
      .single();

    console.log('📥 Test details response:', { data, error });

    if (error) {
      console.error('❌ Error fetching test details:', error);
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
    console.error('❌ Exception in getTestDetails:', err);
    return {
      success: false,
      error: `Unexpected error: ${err.message}`,
      data: null,
      count: 0
    };
  }
};

/**
 * Get students for class instance without RLS restrictions (temporary)
 */
export const getStudentsForClass = async (classInstanceId) => {
  try {
    console.log('🔍 getStudentsForClass called with classInstanceId:', classInstanceId);
    
    const { data, error } = await supabase
      .from('student')
      .select(`
        id,
        student_code,
        full_name,
        email,
        roll_no,
        school_code,
        class_instance_id
      `)
      .eq('class_instance_id', classInstanceId)
      .order('student_code');

    console.log('📥 Students response:', { data, error, count: data?.length || 0 });

    if (error) {
      console.error('❌ Error fetching students:', error);
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
    console.error('❌ Exception in getStudentsForClass:', err);
    return {
      success: false,
      error: `Unexpected error: ${err.message}`,
      data: null,
      count: 0
    };
  }
};

/**
 * Get test marks without RLS restrictions (temporary)
 */
export const getTestMarks = async (testId) => {
  try {
    console.log('🔍 getTestMarks called with testId:', testId);
    
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

    console.log('📥 Test marks response:', { data, error, count: data?.length || 0 });

    if (error) {
      console.error('❌ Error fetching test marks:', error);
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
    console.error('❌ Exception in getTestMarks:', err);
    return {
      success: false,
      error: `Unexpected error: ${err.message}`,
      data: null,
      count: 0
    };
  }
};

/**
 * Save test marks without RLS restrictions (temporary)
 */
export const saveTestMarks = async (marksData) => {
  try {
    console.log('🔍 saveTestMarks called with marksData:', marksData);
    
    if (!Array.isArray(marksData) || marksData.length === 0) {
      return {
        success: false,
        error: 'No marks data provided',
        data: null,
        count: 0
      };
    }

    // Prepare data for upsert
    const preparedData = marksData.map(mark => ({
      ...mark,
      updated_at: new Date().toISOString()
    }));

    console.log('📤 Prepared data for upsert:', preparedData);

    const { data, error } = await supabase
      .from('test_marks')
      .upsert(preparedData, {
        onConflict: 'test_id,student_id',
        ignoreDuplicates: false
      })
      .select();

    console.log('📥 Save marks response:', { data, error, count: data?.length || 0 });

    if (error) {
      console.error('❌ Error saving test marks:', error);
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
    console.error('❌ Exception in saveTestMarks:', err);
    return {
      success: false,
      error: `Unexpected error: ${err.message}`,
      data: null,
      count: 0
    };
  }
};
