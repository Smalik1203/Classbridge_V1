/**
 * Production-Grade Offline Test Service
 * 
 * This service provides RLS-safe operations for offline test management
 * with comprehensive error handling, validation, and transaction safety.
 */

import { supabase } from '../config/supabaseClient.js';
import { getSchoolCode } from '../utils/metadata.js';

// =====================================================
// TYPES AND INTERFACES
// =====================================================

/**
 * @typedef {Object} TestMark
 * @property {string} test_id - Test ID
 * @property {string} student_id - Student ID
 * @property {number|null} marks_obtained - Marks obtained (null if not entered)
 * @property {number} max_marks - Maximum marks for the test
 * @property {string} remarks - Optional remarks
 * @property {boolean} is_absent - Whether student was absent
 * @property {string} created_by - User who created the record
 * @property {string} school_code - School code for RLS
 * @property {string} class_instance_id - Class instance ID
 */

/**
 * @typedef {Object} TestDetails
 * @property {string} id - Test ID
 * @property {string} title - Test title
 * @property {string} description - Test description
 * @property {number} max_marks - Maximum marks
 * @property {string} class_instance_id - Class instance ID
 * @property {string} school_code - School code
 */

/**
 * @typedef {Object} Student
 * @property {string} id - Student ID
 * @property {string} student_code - Student code
 * @property {string} full_name - Student full name
 * @property {string} email - Student email
 * @property {string} roll_no - Roll number
 */

/**
 * @typedef {Object} ServiceResult
 * @property {boolean} success - Whether the operation succeeded
 * @property {any} data - Result data
 * @property {string|null} error - Error message if any
 * @property {number} count - Number of records affected
 */

// =====================================================
// VALIDATION FUNCTIONS
// =====================================================

/**
 * Validates test mark data
 * @param {TestMark} mark - Mark data to validate
 * @returns {Object} Validation result
 */
const validateTestMark = (mark) => {
  const errors = [];
  
  if (!mark.test_id) errors.push('Test ID is required');
  if (!mark.student_id) errors.push('Student ID is required');
  if (!mark.school_code) errors.push('School code is required');
  if (!mark.class_instance_id) errors.push('Class instance ID is required');
  
  if (mark.marks_obtained !== null && mark.marks_obtained !== undefined) {
    if (typeof mark.marks_obtained !== 'number' || mark.marks_obtained < 0) {
      errors.push('Marks obtained must be a non-negative number');
    }
    if (mark.marks_obtained > mark.max_marks) {
      errors.push('Marks obtained cannot exceed maximum marks');
    }
  }
  
  if (typeof mark.max_marks !== 'number' || mark.max_marks <= 0) {
    errors.push('Maximum marks must be a positive number');
  }
  
  if (typeof mark.is_absent !== 'boolean') {
    errors.push('is_absent must be a boolean');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validates CSV data
 * @param {Array} csvData - CSV data to validate
 * @param {Array} validStudentIds - Valid student IDs
 * @returns {Object} Validation result
 */
const validateCsvData = (csvData, validStudentIds) => {
  const errors = [];
  const warnings = [];
  
  if (!Array.isArray(csvData) || csvData.length === 0) {
    errors.push('CSV data is empty or invalid');
    return { isValid: false, errors, warnings };
  }
  
  csvData.forEach((row, index) => {
    if (!row.student_id) {
      errors.push(`Row ${index + 1}: Student ID is required`);
    } else if (!validStudentIds.includes(row.student_id)) {
      warnings.push(`Row ${index + 1}: Student ID ${row.student_id} not found in class`);
    }
    
    if (row.marks_obtained !== null && row.marks_obtained !== undefined) {
      if (typeof row.marks_obtained !== 'number' || row.marks_obtained < 0) {
        errors.push(`Row ${index + 1}: Marks obtained must be a non-negative number`);
      }
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

// =====================================================
// CORE SERVICE FUNCTIONS
// =====================================================

/**
 * Get test details with RLS safety
 * @param {string} testId - Test ID
 * @param {Object} user - Current user
 * @returns {Promise<ServiceResult>}
 */
export const getTestDetails = async (testId, user) => {
  try {
    const schoolCode = getSchoolCode(user);
    if (!schoolCode) {
      return {
        success: false,
        error: 'School code not found in user session',
        data: null,
        count: 0
      };
    }

    const { data, error } = await supabase
      .from('tests')
      .select(`
        id,
        title,
        description,
        max_marks,
        class_instance_id,
        school_code,
        test_mode,
        created_at,
        updated_at
      `)
      .eq('id', testId)
      .eq('school_code', schoolCode)
      .eq('test_mode', 'offline')
      .single();

    if (error) {
      console.error('Error fetching test details:', error);
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
        error: 'Test not found or access denied',
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
    console.error('Exception in getTestDetails:', err);
    return {
      success: false,
      error: `Unexpected error: ${err.message}`,
      data: null,
      count: 0
    };
  }
};

/**
 * Get students for a class instance with RLS safety
 * @param {string} classInstanceId - Class instance ID
 * @param {Object} user - Current user
 * @returns {Promise<ServiceResult>}
 */
export const getStudentsForClass = async (classInstanceId, user) => {
  try {
    const schoolCode = getSchoolCode(user);
    if (!schoolCode) {
      return {
        success: false,
        error: 'School code not found in user session',
        data: null,
        count: 0
      };
    }

    const { data, error } = await supabase
      .from('student')
      .select(`
        id,
        student_code,
        full_name,
        email,
        roll_no,
        class_instance_id
      `)
      .eq('class_instance_id', classInstanceId)
      .eq('school_code', schoolCode)
      .order('roll_no', { ascending: true, nullsLast: true })
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Error fetching students:', error);
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
    console.error('Exception in getStudentsForClass:', err);
    return {
      success: false,
      error: `Unexpected error: ${err.message}`,
      data: null,
      count: 0
    };
  }
};

/**
 * Get existing test marks with RLS safety
 * @param {string} testId - Test ID
 * @param {Object} user - Current user
 * @returns {Promise<ServiceResult>}
 */
export const getTestMarks = async (testId, user) => {
  try {
    const schoolCode = getSchoolCode(user);
    if (!schoolCode) {
      return {
        success: false,
        error: 'School code not found in user session',
        data: null,
        count: 0
      };
    }

    const { data, error } = await supabase
      .from('test_marks')
      .select(`
        id,
        test_id,
        student_id,
        marks_obtained,
        max_marks,
        remarks,
        is_absent,
        created_at,
        updated_at,
        student:student_id(
          id,
          student_code,
          full_name,
          email,
          roll_no
        )
      `)
      .eq('test_id', testId)
      .eq('school_code', schoolCode)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching test marks:', error);
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
    console.error('Exception in getTestMarks:', err);
    return {
      success: false,
      error: `Unexpected error: ${err.message}`,
      data: null,
      count: 0
    };
  }
};

/**
 * Save test marks with transaction safety and validation
 * @param {Array<TestMark>} marksData - Array of mark data
 * @param {Object} user - Current user
 * @param {Object} options - Options for saving
 * @returns {Promise<ServiceResult>}
 */
export const saveTestMarks = async (marksData, user, options = {}) => {
  try {
    const schoolCode = getSchoolCode(user);
    if (!schoolCode) {
      return {
        success: false,
        error: 'School code not found in user session',
        data: null,
        count: 0
      };
    }

    if (!Array.isArray(marksData) || marksData.length === 0) {
      return {
        success: false,
        error: 'No marks data provided',
        data: null,
        count: 0
      };
    }

    // Validate all marks data
    const validationErrors = [];
    marksData.forEach((mark, index) => {
      const validation = validateTestMark(mark);
      if (!validation.isValid) {
        validationErrors.push(`Row ${index + 1}: ${validation.errors.join(', ')}`);
      }
    });

    if (validationErrors.length > 0) {
      return {
        success: false,
        error: `Validation failed: ${validationErrors.join('; ')}`,
        data: null,
        count: 0
      };
    }

    // Prepare data with RLS fields
    const preparedData = marksData.map(mark => ({
      ...mark,
      school_code: schoolCode,
      created_by: user.id,
      updated_at: new Date().toISOString()
    }));

    // Use upsert for transaction safety
    const { data, error } = await supabase
      .from('test_marks')
      .upsert(preparedData, {
        onConflict: 'test_id,student_id',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('Error saving test marks:', error);
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
    console.error('Exception in saveTestMarks:', err);
    return {
      success: false,
      error: `Unexpected error: ${err.message}`,
      data: null,
      count: 0
    };
  }
};

/**
 * Bulk save test marks with chunking for large datasets
 * @param {Array<TestMark>} marksData - Array of mark data
 * @param {Object} user - Current user
 * @param {Object} options - Options for saving
 * @returns {Promise<ServiceResult>}
 */
export const bulkSaveTestMarks = async (marksData, user, options = {}) => {
  try {
    const chunkSize = options.chunkSize || 100;
    const schoolCode = getSchoolCode(user);
    
    if (!schoolCode) {
      return {
        success: false,
        error: 'School code not found in user session',
        data: null,
        count: 0
      };
    }

    if (!Array.isArray(marksData) || marksData.length === 0) {
      return {
        success: false,
        error: 'No marks data provided',
        data: null,
        count: 0
      };
    }

    // Validate all marks data
    const validationErrors = [];
    marksData.forEach((mark, index) => {
      const validation = validateTestMark(mark);
      if (!validation.isValid) {
        validationErrors.push(`Row ${index + 1}: ${validation.errors.join(', ')}`);
      }
    });

    if (validationErrors.length > 0) {
      return {
        success: false,
        error: `Validation failed: ${validationErrors.join('; ')}`,
        data: null,
        count: 0
      };
    }

    // Prepare data with RLS fields
    const preparedData = marksData.map(mark => ({
      ...mark,
      school_code: schoolCode,
      created_by: user.id,
      updated_at: new Date().toISOString()
    }));

    // Process in chunks
    const chunks = [];
    for (let i = 0; i < preparedData.length; i += chunkSize) {
      chunks.push(preparedData.slice(i, i + chunkSize));
    }

    const results = [];
    let totalCount = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Processing chunk ${i + 1}/${chunks.length} with ${chunk.length} items`);

      const { data, error } = await supabase
        .from('test_marks')
        .upsert(chunk, {
          onConflict: 'test_id,student_id',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        console.error(`Error in chunk ${i + 1}:`, error);
        return {
          success: false,
          error: `Failed to save chunk ${i + 1}: ${error.message}`,
          data: null,
          count: totalCount
        };
      }

      results.push(...(data || []));
      totalCount += data?.length || 0;
    }

    return {
      success: true,
      data: results,
      error: null,
      count: totalCount
    };
  } catch (err) {
    console.error('Exception in bulkSaveTestMarks:', err);
    return {
      success: false,
      error: `Unexpected error: ${err.message}`,
      data: null,
      count: 0
    };
  }
};

/**
 * Parse CSV data for test marks
 * @param {string} csvText - CSV text content
 * @param {Array<string>} validStudentIds - Valid student IDs
 * @param {number} defaultMaxMarks - Default maximum marks
 * @returns {Promise<ServiceResult>}
 */
export const parseCsvData = async (csvText, validStudentIds, defaultMaxMarks = 100) => {
  try {
    const lines = csvText.replace(/\r/g, '').split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return {
        success: false,
        error: 'CSV file is empty',
        data: null,
        count: 0
      };
    }

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredColumns = ['student_id', 'marks_obtained'];
    
    // Check for required columns
    for (const col of requiredColumns) {
      if (!header.includes(col)) {
        return {
          success: false,
          error: `CSV missing required column: ${col}`,
          data: null,
          count: 0
        };
      }
    }

    const columnIndex = Object.fromEntries(header.map((h, i) => [h, i]));
    const parsedData = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const columns = line.split(',');
      
      const studentId = columns[columnIndex.student_id]?.trim();
      if (!studentId) continue;

      const marksObtained = columns[columnIndex.marks_obtained]?.trim();
      const maxMarks = columnIndex.max_marks !== undefined ? 
        columns[columnIndex.max_marks]?.trim() : null;
      const remarks = columnIndex.remarks !== undefined ? 
        columns[columnIndex.remarks]?.trim() : '';
      const isAbsent = columnIndex.is_absent !== undefined ? 
        columns[columnIndex.is_absent]?.trim() : '';

      const isAbsentBool = ['1', 'true', 'yes', 'y'].includes(isAbsent.toLowerCase());
      
      parsedData.push({
        student_id: studentId,
        marks_obtained: isAbsentBool ? 0 : (marksObtained === '' ? null : Number(marksObtained)),
        max_marks: maxMarks ? Number(maxMarks) : defaultMaxMarks,
        remarks: remarks || '',
        is_absent: isAbsentBool
      });
    }

    // Validate parsed data
    const validation = validateCsvData(parsedData, validStudentIds);
    
    return {
      success: validation.isValid,
      data: parsedData,
      error: validation.isValid ? null : validation.errors.join('; '),
      count: parsedData.length,
      warnings: validation.warnings
    };
  } catch (err) {
    console.error('Exception in parseCsvData:', err);
    return {
      success: false,
      error: `Failed to parse CSV: ${err.message}`,
      data: null,
      count: 0
    };
  }
};

/**
 * Export test marks to CSV format
 * @param {Array<TestMark>} marksData - Marks data to export
 * @param {Array<Student>} students - Student data for reference
 * @returns {Promise<ServiceResult>}
 */
export const exportTestMarksToCsv = async (marksData, students) => {
  try {
    const csvHeader = 'student_id,student_code,student_name,marks_obtained,max_marks,remarks,is_absent';
    const csvLines = [csvHeader];

    marksData.forEach(mark => {
      const student = students.find(s => s.id === mark.student_id);
      const line = [
        mark.student_id,
        student?.student_code || '',
        student?.full_name || '',
        mark.marks_obtained || '',
        mark.max_marks,
        mark.remarks || '',
        mark.is_absent ? '1' : '0'
      ].join(',');
      csvLines.push(line);
    });

    const csvContent = csvLines.join('\n');
    
    return {
      success: true,
      data: csvContent,
      error: null,
      count: marksData.length
    };
  } catch (err) {
    console.error('Exception in exportTestMarksToCsv:', err);
    return {
      success: false,
      error: `Failed to export CSV: ${err.message}`,
      data: null,
      count: 0
    };
  }
};

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Get test statistics
 * @param {string} testId - Test ID
 * @param {Object} user - Current user
 * @returns {Promise<ServiceResult>}
 */
export const getTestStatistics = async (testId, user) => {
  try {
    const schoolCode = getSchoolCode(user);
    if (!schoolCode) {
      return {
        success: false,
        error: 'School code not found in user session',
        data: null,
        count: 0
      };
    }

    const { data, error } = await supabase
      .from('test_marks')
      .select('marks_obtained, is_absent, max_marks')
      .eq('test_id', testId)
      .eq('school_code', schoolCode);

    if (error) {
      console.error('Error fetching test statistics:', error);
      return {
        success: false,
        error: `Failed to fetch test statistics: ${error.message}`,
        data: null,
        count: 0
      };
    }

    const stats = {
      totalStudents: data?.length || 0,
      presentStudents: data?.filter(m => !m.is_absent).length || 0,
      absentStudents: data?.filter(m => m.is_absent).length || 0,
      marksEntered: data?.filter(m => m.marks_obtained !== null && m.marks_obtained !== undefined).length || 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0
    };

    if (stats.marksEntered > 0) {
      const scores = data
        .filter(m => m.marks_obtained !== null && m.marks_obtained !== undefined)
        .map(m => m.marks_obtained);
      
      stats.averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      stats.highestScore = Math.max(...scores);
      stats.lowestScore = Math.min(...scores);
    }

    return {
      success: true,
      data: stats,
      error: null,
      count: 1
    };
  } catch (err) {
    console.error('Exception in getTestStatistics:', err);
    return {
      success: false,
      error: `Unexpected error: ${err.message}`,
      data: null,
      count: 0
    };
  }
};
