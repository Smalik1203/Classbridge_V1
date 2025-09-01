// src/services/resultsService.js
// Results Management API Service

import { supabase } from '../config/supabaseClient.js';

// ==========================================
// EXAM MANAGEMENT
// ==========================================

/**
 * Get all exams for a school
 */
export const getExams = async (schoolCode, filters = {}) => {
  try {
    let query = supabase
      .from('exams')
      .select(`
        *,
        class_instance:class_instances(grade, section),
        exam_subjects(
          *,
          subject:subjects(subject_name)
        ),
        created_by_user:users!exams_created_by_fkey(full_name)
      `)
      .eq('school_code', schoolCode)
      .order('exam_date', { ascending: false });

    // Apply filters
    if (filters.classInstanceId) {
      query = query.eq('class_instance_id', filters.classInstanceId);
    }
    if (filters.examType) {
      query = query.eq('exam_type', filters.examType);
    }
    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }
    if (filters.dateFrom) {
      query = query.gte('exam_date', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('exam_date', filters.dateTo);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching exams:', error);
    throw error;
  }
};

/**
 * Get a single exam by ID
 */
export const getExam = async (examId) => {
  try {
    const { data, error } = await supabase
      .from('exams')
      .select(`
        *,
        class_instance:class_instances(grade, section),
        exam_subjects(
          *,
          subject:subjects(subject_name)
        ),
        created_by_user:users!exams_created_by_fkey(full_name)
      `)
      .eq('id', examId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching exam:', error);
    throw error;
  }
};

/**
 * Create a new exam
 */
export const createExam = async (examData) => {
  try {
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .insert(examData)
      .select()
      .single();

    if (examError) throw examError;

    // Add exam subjects if provided
    if (examData.subjects && examData.subjects.length > 0) {
      const examSubjects = examData.subjects.map(subject => ({
        exam_id: exam.id,
        subject_id: subject.subject_id,
        max_marks: subject.max_marks,
        passing_marks: subject.passing_marks,
        weightage: subject.weightage || 1.00
      }));

      const { error: subjectsError } = await supabase
        .from('exam_subjects')
        .insert(examSubjects);

      if (subjectsError) throw subjectsError;
    }

    return exam;
  } catch (error) {
    console.error('Error creating exam:', error);
    throw error;
  }
};

/**
 * Update an exam
 */
export const updateExam = async (examId, examData) => {
  try {
    const { data, error } = await supabase
      .from('exams')
      .update(examData)
      .eq('id', examId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating exam:', error);
    throw error;
  }
};

/**
 * Delete an exam
 */
export const deleteExam = async (examId) => {
  try {
    const { error } = await supabase
      .from('exams')
      .delete()
      .eq('id', examId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting exam:', error);
    throw error;
  }
};

// ==========================================
// RESULTS MANAGEMENT
// ==========================================

/**
 * Get all results for an exam
 */
export const getExamResults = async (examId) => {
  try {
    const { data, error } = await supabase
      .from('student_results')
      .select(`
        *,
        student:student(
          full_name,
          student_code,
          class_instance:class_instances(grade, section)
        ),
        subject_results(
          *,
          exam_subject:exam_subjects(
            *,
            subject:subjects(subject_name)
          )
        ),
        created_by_user:users!student_results_created_by_fkey(full_name)
      `)
      .eq('exam_id', examId)
      .order('class_rank', { ascending: true });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching exam results:', error);
    throw error;
  }
};

/**
 * Get results for a specific student
 */
export const getStudentResults = async (studentId, filters = {}) => {
  try {
    let query = supabase
      .from('student_results')
      .select(`
        *,
        exam:exams(
          exam_name,
          exam_type,
          exam_date,
          total_marks
        ),
        subject_results(
          *,
          exam_subject:exam_subjects(
            *,
            subject:subjects(subject_name)
          )
        )
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.isPublished !== undefined) {
      query = query.eq('is_published', filters.isPublished);
    }
    if (filters.examType) {
      query = query.eq('exam.exam_type', filters.examType);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching student results:', error);
    throw error;
  }
};

/**
 * Create a new result
 */
export const createResult = async (resultData) => {
  try {
    // Start a transaction
    const { data: studentResult, error: resultError } = await supabase
      .from('student_results')
      .insert({
        exam_id: resultData.exam_id,
        student_id: resultData.student_id,
        total_obtained_marks: resultData.total_obtained_marks,
        total_max_marks: resultData.total_max_marks,
        remarks: resultData.remarks,
        is_published: resultData.is_published || false
      })
      .select()
      .single();

    if (resultError) throw resultError;

    // Add subject results if provided
    if (resultData.subject_results && resultData.subject_results.length > 0) {
      const subjectResults = resultData.subject_results.map(subject => ({
        student_result_id: studentResult.id,
        exam_subject_id: subject.exam_subject_id,
        obtained_marks: subject.obtained_marks,
        max_marks: subject.max_marks,
        remarks: subject.remarks
      }));

      const { error: subjectsError } = await supabase
        .from('subject_results')
        .insert(subjectResults);

      if (subjectsError) throw subjectsError;
    }

    return studentResult;
  } catch (error) {
    console.error('Error creating result:', error);
    throw error;
  }
};

/**
 * Update a result
 */
export const updateResult = async (resultId, resultData) => {
  try {
    const { data, error } = await supabase
      .from('student_results')
      .update(resultData)
      .eq('id', resultId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating result:', error);
    throw error;
  }
};

/**
 * Delete a result
 */
export const deleteResult = async (resultId) => {
  try {
    const { error } = await supabase
      .from('student_results')
      .delete()
      .eq('id', resultId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting result:', error);
    throw error;
  }
};

/**
 * Publish/unpublish results
 */
export const toggleResultPublish = async (resultId, isPublished) => {
  try {
    const { data, error } = await supabase
      .from('student_results')
      .update({
        is_published: isPublished,
        published_at: isPublished ? new Date().toISOString() : null
      })
      .eq('id', resultId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error toggling result publish:', error);
    throw error;
  }
};

// ==========================================
// ANALYTICS AND REPORTS
// ==========================================

/**
 * Get exam summary statistics
 */
export const getExamSummary = async (schoolCode, filters = {}) => {
  try {
    let query = supabase
      .from('exam_summary')
      .select('*')
      .eq('school_code', schoolCode)
      .order('exam_date', { ascending: false });

    // Apply filters
    if (filters.grade) {
      query = query.eq('grade', filters.grade);
    }
    if (filters.examType) {
      query = query.eq('exam_type', filters.examType);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching exam summary:', error);
    throw error;
  }
};

/**
 * Get student performance analytics
 */
export const getStudentPerformance = async (studentId, filters = {}) => {
  try {
    let query = supabase
      .from('student_performance')
      .select('*')
      .eq('student_id', studentId)
      .order('exam_date', { ascending: false });

    // Apply filters
    if (filters.examType) {
      query = query.eq('exam_type', filters.examType);
    }
    if (filters.dateFrom) {
      query = query.gte('exam_date', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('exam_date', filters.dateTo);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching student performance:', error);
    throw error;
  }
};

/**
 * Get subject performance analytics
 */
export const getSubjectPerformance = async (examId) => {
  try {
    const { data, error } = await supabase
      .from('subject_performance')
      .select('*')
      .eq('exam_id', examId)
      .order('average_percentage', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching subject performance:', error);
    throw error;
  }
};

/**
 * Get class performance analytics
 */
export const getClassPerformance = async (classInstanceId, examId) => {
  try {
    const { data, error } = await supabase
      .from('student_results')
      .select(`
        *,
        student:student(
          full_name,
          student_code
        )
      `)
      .eq('exam_id', examId)
      .order('class_rank', { ascending: true });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching class performance:', error);
    throw error;
  }
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Calculate grade based on percentage
 */
export const calculateGrade = (percentage) => {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C+';
  if (percentage >= 40) return 'C';
  if (percentage >= 35) return 'D';
  return 'F';
};

/**
 * Get grade color for UI
 */
export const getGradeColor = (grade) => {
  const colors = {
    'A+': 'green',
    'A': 'green',
    'B+': 'blue',
    'B': 'blue',
    'C+': 'orange',
    'C': 'orange',
    'D': 'red',
    'F': 'red'
  };
  return colors[grade] || 'default';
};

/**
 * Get rank suffix
 */
export const getRankSuffix = (rank) => {
  if (rank === 1) return 'st';
  if (rank === 2) return 'nd';
  if (rank === 3) return 'rd';
  return 'th';
};

/**
 * Export results to CSV
 */
export const exportResultsToCSV = (results) => {
  if (!results || results.length === 0) {
    return '';
  }

  const headers = [
    'Student Name',
    'Roll Number',
    'Class',
    'Exam Name',
    'Exam Date',
    'Total Marks',
    'Obtained Marks',
    'Percentage',
    'Grade',
    'Rank',
    'Remarks'
  ];

  const csvContent = [
    headers.join(','),
    ...results.map(result => [
      result.student.full_name,
      result.student.student_code,
      `${result.student.class_instance.grade} - ${result.student.class_instance.section}`,
      result.exam.exam_name,
      new Date(result.exam.exam_date).toLocaleDateString('en-IN'),
      result.total_max_marks,
      result.total_obtained_marks,
      result.percentage,
      result.overall_grade,
      result.class_rank,
      result.remarks || ''
    ].join(','))
  ].join('\n');

  return csvContent;
};
