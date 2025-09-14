// src/services/questionService.js
import { supabase } from '../config/supabaseClient.js';

/**
 * Get all questions for a specific test
 */
export const getQuestionsForTest = async (testId) => {
  try {
    const { data, error } = await supabase
      .from('test_questions')
      .select('*')
      .eq('test_id', testId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching questions:', error);
    throw error;
  }
};

/**
 * Create a new question
 */
export const createQuestion = async (questionData) => {
  try {
    const { data, error } = await supabase
      .from('test_questions')
      .insert([questionData])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating question:', error);
    throw error;
  }
};

/**
 * Update an existing question
 */
export const updateQuestion = async (questionId, questionData) => {
  try {
    const { data, error } = await supabase
      .from('test_questions')
      .update(questionData)
      .eq('id', questionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating question:', error);
    throw error;
  }
};

/**
 * Delete a question
 */
export const deleteQuestion = async (questionId) => {
  try {
    const { error } = await supabase
      .from('test_questions')
      .delete()
      .eq('id', questionId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting question:', error);
    throw error;
  }
};

/**
 * Get all tests for a school (for ManageQuestionsPage)
 */
export const getTestsForQuestions = async (schoolCode) => {
  try {
    const { data, error } = await supabase
      .from('tests')
      .select(`
        id,
        title,
        description,
        test_type,
        time_limit_seconds,
        created_at,
        class_instances!inner(id, grade, section),
        subjects!inner(id, subject_name)
      `)
      .eq('school_code', schoolCode)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching tests for questions:', error);
    throw error;
  }
};
