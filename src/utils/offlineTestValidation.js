/**
 * Offline Test Validation Utilities
 * 
 * Comprehensive validation functions for offline test operations
 */

// =====================================================
// VALIDATION CONSTANTS
// =====================================================

export const VALIDATION_RULES = {
  MARKS: {
    MIN: 0,
    MAX: 1000,
    REQUIRED: true
  },
  MAX_MARKS: {
    MIN: 1,
    MAX: 1000,
    DEFAULT: 100
  },
  REMARKS: {
    MAX_LENGTH: 200
  },
  STUDENT_ID: {
    REQUIRED: true,
    PATTERN: /^[a-zA-Z0-9-_]+$/
  }
};

// =====================================================
// VALIDATION FUNCTIONS
// =====================================================

/**
 * Validates a single test mark
 * @param {Object} mark - Mark data to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export const validateTestMark = (mark, options = {}) => {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!mark.test_id) {
    errors.push('Test ID is required');
  }
  
  if (!mark.student_id) {
    errors.push('Student ID is required');
  } else if (!VALIDATION_RULES.STUDENT_ID.PATTERN.test(mark.student_id)) {
    errors.push('Student ID contains invalid characters');
  }

  if (!mark.school_code) {
    errors.push('School code is required');
  }

  if (!mark.class_instance_id) {
    errors.push('Class instance ID is required');
  }

  // Marks validation
  if (mark.marks_obtained !== null && mark.marks_obtained !== undefined) {
    if (typeof mark.marks_obtained !== 'number') {
      errors.push('Marks obtained must be a number');
    } else if (mark.marks_obtained < VALIDATION_RULES.MARKS.MIN) {
      errors.push(`Marks obtained cannot be less than ${VALIDATION_RULES.MARKS.MIN}`);
    } else if (mark.marks_obtained > VALIDATION_RULES.MARKS.MAX) {
      errors.push(`Marks obtained cannot exceed ${VALIDATION_RULES.MARKS.MAX}`);
    }
  }

  // Max marks validation
  if (mark.max_marks !== null && mark.max_marks !== undefined) {
    if (typeof mark.max_marks !== 'number') {
      errors.push('Maximum marks must be a number');
    } else if (mark.max_marks < VALIDATION_RULES.MAX_MARKS.MIN) {
      errors.push(`Maximum marks cannot be less than ${VALIDATION_RULES.MAX_MARKS.MIN}`);
    } else if (mark.max_marks > VALIDATION_RULES.MAX_MARKS.MAX) {
      errors.push(`Maximum marks cannot exceed ${VALIDATION_RULES.MAX_MARKS.MAX}`);
    }
  }

  // Cross-field validation
  if (mark.marks_obtained !== null && mark.marks_obtained !== undefined && 
      mark.max_marks !== null && mark.max_marks !== undefined) {
    if (mark.marks_obtained > mark.max_marks) {
      errors.push('Marks obtained cannot exceed maximum marks');
    }
  }

  // Absent status validation
  if (typeof mark.is_absent !== 'boolean') {
    errors.push('Absent status must be a boolean');
  }

  // If absent, marks should be 0 or null
  if (mark.is_absent && mark.marks_obtained !== null && mark.marks_obtained !== 0) {
    warnings.push('Absent students should have marks set to 0 or null');
  }

  // Remarks validation
  if (mark.remarks && mark.remarks.length > VALIDATION_RULES.REMARKS.MAX_LENGTH) {
    errors.push(`Remarks cannot exceed ${VALIDATION_RULES.REMARKS.MAX_LENGTH} characters`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Validates an array of test marks
 * @param {Array} marks - Array of mark data to validate
 * @param {Array} validStudentIds - Valid student IDs
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export const validateTestMarks = (marks, validStudentIds = [], options = {}) => {
  const errors = [];
  const warnings = [];
  const invalidRows = [];

  if (!Array.isArray(marks)) {
    return {
      isValid: false,
      errors: ['Marks data must be an array'],
      warnings: [],
      invalidRows: []
    };
  }

  if (marks.length === 0) {
    return {
      isValid: false,
      errors: ['No marks data provided'],
      warnings: [],
      invalidRows: []
    };
  }

  marks.forEach((mark, index) => {
    const validation = validateTestMark(mark, options);
    
    if (!validation.isValid) {
      invalidRows.push(index);
      validation.errors.forEach(error => {
        errors.push(`Row ${index + 1}: ${error}`);
      });
    }

    validation.warnings.forEach(warning => {
      warnings.push(`Row ${index + 1}: ${warning}`);
    });

    // Check if student ID is valid
    if (validStudentIds.length > 0 && !validStudentIds.includes(mark.student_id)) {
      warnings.push(`Row ${index + 1}: Student ID ${mark.marks_obtained} not found in class`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    invalidRows
  };
};

/**
 * Validates CSV data structure
 * @param {string} csvText - CSV text content
 * @param {Array} validStudentIds - Valid student IDs
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export const validateCsvStructure = (csvText, validStudentIds = [], options = {}) => {
  const errors = [];
  const warnings = [];

  if (!csvText || typeof csvText !== 'string') {
    return {
      isValid: false,
      errors: ['CSV content is required'],
      warnings: []
    };
  }

  const lines = csvText.replace(/\r/g, '').split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return {
      isValid: false,
      errors: ['CSV file is empty'],
      warnings: []
    };
  }

  if (lines.length < 2) {
    return {
      isValid: false,
      errors: ['CSV file must have at least a header and one data row'],
      warnings: []
    };
  }

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const requiredColumns = ['student_id', 'marks_obtained'];
  
  // Check required columns
  const missingColumns = requiredColumns.filter(col => !header.includes(col));
  if (missingColumns.length > 0) {
    errors.push(`CSV missing required columns: ${missingColumns.join(', ')}`);
  }

  // Check for duplicate columns
  const duplicateColumns = header.filter((col, index) => header.indexOf(col) !== index);
  if (duplicateColumns.length > 0) {
    warnings.push(`Duplicate columns found: ${duplicateColumns.join(', ')}`);
  }

  // Check data rows
  const dataRows = lines.slice(1);
  const invalidRows = [];

  dataRows.forEach((line, index) => {
    const columns = line.split(',');
    
    if (columns.length !== header.length) {
      errors.push(`Row ${index + 2}: Column count mismatch (expected ${header.length}, got ${columns.length})`);
      invalidRows.push(index + 2);
    }

    const studentId = columns[0]?.trim();
    if (!studentId) {
      errors.push(`Row ${index + 2}: Student ID is required`);
      invalidRows.push(index + 2);
    } else if (validStudentIds.length > 0 && !validStudentIds.includes(studentId)) {
      warnings.push(`Row ${index + 2}: Student ID ${studentId} not found in class`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    invalidRows,
    header,
    dataRowCount: dataRows.length
  };
};

/**
 * Validates test creation data
 * @param {Object} testData - Test data to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export const validateTestCreation = (testData, options = {}) => {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!testData.title || testData.title.trim().length === 0) {
    errors.push('Test title is required');
  } else if (testData.title.length > 200) {
    errors.push('Test title cannot exceed 200 characters');
  }

  if (!testData.class_instance_id) {
    errors.push('Class instance ID is required');
  }

  if (!testData.subject_id) {
    errors.push('Subject ID is required');
  }

  if (!testData.school_code) {
    errors.push('School code is required');
  }

  // Optional fields validation
  if (testData.description && testData.description.length > 500) {
    errors.push('Description cannot exceed 500 characters');
  }

  if (testData.max_marks !== null && testData.max_marks !== undefined) {
    if (typeof testData.max_marks !== 'number') {
      errors.push('Maximum marks must be a number');
    } else if (testData.max_marks < 1) {
      errors.push('Maximum marks must be at least 1');
    } else if (testData.max_marks > 1000) {
      errors.push('Maximum marks cannot exceed 1000');
    }
  }

  // Date validation
  if (testData.test_date) {
    const testDate = new Date(testData.test_date);
    if (isNaN(testDate.getTime())) {
      errors.push('Invalid test date format');
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (testDate < today) {
        warnings.push('Test date is in the past');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Sanitizes test mark data
 * @param {Object} mark - Mark data to sanitize
 * @returns {Object} Sanitized mark data
 */
export const sanitizeTestMark = (mark) => {
  return {
    ...mark,
    marks_obtained: mark.marks_obtained === '' ? null : mark.marks_obtained,
    max_marks: mark.max_marks || 100,
    remarks: (mark.remarks || '').trim().substring(0, VALIDATION_RULES.REMARKS.MAX_LENGTH),
    is_absent: Boolean(mark.is_absent)
  };
};

/**
 * Sanitizes CSV data
 * @param {Array} csvData - CSV data to sanitize
 * @returns {Array} Sanitized CSV data
 */
export const sanitizeCsvData = (csvData) => {
  return csvData.map(mark => sanitizeTestMark(mark));
};

/**
 * Gets validation summary
 * @param {Object} validationResult - Validation result
 * @returns {Object} Summary object
 */
export const getValidationSummary = (validationResult) => {
  return {
    isValid: validationResult.isValid,
    errorCount: validationResult.errors.length,
    warningCount: validationResult.warnings.length,
    hasErrors: validationResult.errors.length > 0,
    hasWarnings: validationResult.warnings.length > 0
  };
};
