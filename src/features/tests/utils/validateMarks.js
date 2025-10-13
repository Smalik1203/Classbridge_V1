/**
 * Validates marks data
 * @param {Object} marksData - The marks data to validate
 * @param {number} maxMarks - Maximum allowed marks
 * @returns {Object} - Validation result with isValid and errors
 */
export const validateMarks = ({ obtained, max }) => {
  const errors = [];
  
  if (obtained === null || obtained === undefined) {
    return { isValid: true, errors: [] };
  }
  
  const marks = parseFloat(obtained);
  
  if (isNaN(marks)) {
    errors.push('Marks must be a valid number');
  }
  
  if (marks < 0) {
    errors.push('Marks cannot be negative');
  }
  
  if (marks > max) {
    errors.push(`Marks cannot exceed ${max}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validates a batch of marks
 * @param {Array} marksArray - Array of marks objects
 * @param {number} maxMarks - Maximum allowed marks
 * @returns {Object} - Validation result with valid and invalid marks
 */
export const validateMarksBatch = (marksArray, maxMarks) => {
  const validMarks = [];
  const invalidMarks = [];
  
  marksArray.forEach((mark, index) => {
    const validation = validateMarks({ obtained: mark.marks_obtained, max: maxMarks });
    
    if (validation.isValid) {
      validMarks.push(mark);
    } else {
      invalidMarks.push({
        index,
        mark,
        errors: validation.errors
      });
    }
  });
  
  return {
    valid: validMarks,
    invalid: invalidMarks,
    totalValid: validMarks.length,
    totalInvalid: invalidMarks.length
  };
};
