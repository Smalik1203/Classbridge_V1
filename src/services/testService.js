// src/services/testService.js
import { supabase } from '../config/supabaseClient.js';

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
        subjects(subject_name, school_code),
        syllabus_chapters(id, chapter_no, title, description)
      `)
      .eq('school_code', schoolCode)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get question counts for each test
    const testsWithCounts = await Promise.all(
      (tests || []).map(async (test) => {
        try {
          const { count, error: countError } = await supabase
            .from('test_questions')
            .select('*', { count: 'exact', head: true })
            .eq('test_id', test.id);

          if (countError) {
            console.error(`Error getting question count for test ${test.id}:`, countError);
            return { ...test, question_count: 0 };
          }

          return { ...test, question_count: count || 0 };
        } catch (error) {
          console.error(`Error processing test ${test.id}:`, error);
          return { ...test, question_count: 0 };
        }
      })
    );

    return testsWithCounts;
  } catch (error) {
    console.error('Error fetching tests:', error);
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
    return data;
  } catch (error) {
    console.error('Error creating test:', error);
    throw error;
  }
};

/**
 * Update an existing test
 */
export const updateTest = async (testId, testData) => {
  try {
    const { data, error } = await supabase
      .from('tests')
      .update(testData)
      .eq('id', testId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating test:', error);
    throw error;
  }
};

/**
 * Delete a test
 */
export const deleteTest = async (testId) => {
  try {
    const { error } = await supabase
      .from('tests')
      .delete()
      .eq('id', testId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting test:', error);
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
      .select('*')
      .eq('school_code', schoolCode)
      .order('grade', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching class instances:', error);
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
      .select('*')
      .eq('school_code', schoolCode)
      .order('subject_name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching subjects:', error);
    throw error;
  }
};
