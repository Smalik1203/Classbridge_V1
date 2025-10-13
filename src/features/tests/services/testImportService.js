// Test Import Service
// Handles parsing and validation of test data from different file formats

/**
 * Parse tests from CSV content
 * Expected format: title,description,test_type,subject_name,time_limit_seconds
 */
export const parseTestsFromCSV = (csvContent) => {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  
  const tests = [];
  const errors = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(',').map(v => v.trim());
    
    if (values.length !== headers.length) {
      errors.push(`Line ${i + 1}: Incorrect number of columns`);
      continue;
    }
    
    const test = {};
    headers.forEach((header, index) => {
      test[header] = values[index];
    });
    
    // Validate required fields
    if (!test.title) {
      errors.push(`Line ${i + 1}: Title is required`);
      continue;
    }
    
    if (!test.test_type) {
      errors.push(`Line ${i + 1}: Test type is required`);
      continue;
    }
    
    if (!test.subject_name) {
      errors.push(`Line ${i + 1}: Subject name is required`);
      continue;
    }
    
    // Convert numeric fields
    if (test.time_limit_seconds && test.time_limit_seconds !== '') {
      const timeLimit = parseInt(test.time_limit_seconds);
      if (isNaN(timeLimit) || timeLimit < 0) {
        errors.push(`Line ${i + 1}: Invalid time limit`);
        continue;
      }
      test.time_limit_seconds = timeLimit;
    } else {
      test.time_limit_seconds = null;
    }
    
    // Passing score removed - using correct answers instead
    
    // Validate test type
    const validTestTypes = ['quiz', 'unit_test', 'assignment', 'exam', 'practice'];
    if (!validTestTypes.includes(test.test_type.toLowerCase())) {
      errors.push(`Line ${i + 1}: Invalid test type. Must be one of: ${validTestTypes.join(', ')}`);
      continue;
    }
    
    tests.push({
      title: test.title,
      description: test.description || '',
      test_type: test.test_type.toLowerCase(),
      subject_name: test.subject_name,
      time_limit_seconds: test.time_limit_seconds
    });
  }
  
  return { tests, errors };
};

/**
 * Parse tests from JSON content
 * Expected format: Array of test objects
 */
export const parseTestsFromJSON = (jsonContent) => {
  const errors = [];
  let tests = [];
  
  try {
    const data = JSON.parse(jsonContent);
    
    if (!Array.isArray(data)) {
      errors.push('JSON must contain an array of test objects');
      return { tests, errors };
    }
    
    data.forEach((test, index) => {
      // Validate required fields
      if (!test.title) {
        errors.push(`Test ${index + 1}: Title is required`);
        return;
      }
      
      if (!test.test_type) {
        errors.push(`Test ${index + 1}: Test type is required`);
        return;
      }
      
      if (!test.subject_name) {
        errors.push(`Test ${index + 1}: Subject name is required`);
        return;
      }
      
      // Validate test type
      const validTestTypes = ['quiz', 'unit_test', 'assignment', 'exam', 'practice'];
      if (!validTestTypes.includes(test.test_type.toLowerCase())) {
        errors.push(`Test ${index + 1}: Invalid test type. Must be one of: ${validTestTypes.join(', ')}`);
        return;
      }
      
      // Validate numeric fields
      if (test.time_limit_seconds !== undefined && test.time_limit_seconds !== null) {
        const timeLimit = parseInt(test.time_limit_seconds);
        if (isNaN(timeLimit) || timeLimit < 0) {
          errors.push(`Test ${index + 1}: Invalid time limit`);
          return;
        }
        test.time_limit_seconds = timeLimit;
      } else {
        test.time_limit_seconds = null;
      }
      
      // Passing score removed - using correct answers instead
      
      tests.push({
        title: test.title,
        description: test.description || '',
        test_type: test.test_type.toLowerCase(),
        subject_name: test.subject_name,
        time_limit_seconds: test.time_limit_seconds
      });
    });
    
  } catch (error) {
    errors.push('Invalid JSON format: ' + error.message);
  }
  
  return { tests, errors };
};

/**
 * Parse tests from plain text content
 * Expected format: Each test separated by double newlines
 * Each test has key-value pairs separated by colons
 */
export const parseTestsFromText = (textContent) => {
  const tests = [];
  const errors = [];
  
  const testBlocks = textContent.split('\n\n').filter(block => block.trim());
  
  testBlocks.forEach((block, index) => {
    const lines = block.trim().split('\n');
    const test = {};
    
    lines.forEach(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) return;
      
      const key = line.substring(0, colonIndex).trim().toLowerCase().replace(/\s+/g, '_');
      const value = line.substring(colonIndex + 1).trim();
      
      test[key] = value;
    });
    
    // Validate required fields
    if (!test.title) {
      errors.push(`Test ${index + 1}: Title is required`);
      return;
    }
    
    if (!test.test_type) {
      errors.push(`Test ${index + 1}: Test type is required`);
      return;
    }
    
    if (!test.subject_name) {
      errors.push(`Test ${index + 1}: Subject name is required`);
      return;
    }
    
    // Validate test type
    const validTestTypes = ['quiz', 'unit_test', 'assignment', 'exam', 'practice'];
    if (!validTestTypes.includes(test.test_type.toLowerCase())) {
      errors.push(`Test ${index + 1}: Invalid test type. Must be one of: ${validTestTypes.join(', ')}`);
      return;
    }
    
    // Convert numeric fields
    if (test.time_limit_seconds && test.time_limit_seconds !== '') {
      const timeLimit = parseInt(test.time_limit_seconds);
      if (isNaN(timeLimit) || timeLimit < 0) {
        errors.push(`Test ${index + 1}: Invalid time limit`);
        return;
      }
      test.time_limit_seconds = timeLimit;
    } else {
      test.time_limit_seconds = null;
    }
    
    // Passing score removed - using correct answers instead
    
    tests.push({
      title: test.title,
      description: test.description || '',
      test_type: test.test_type.toLowerCase(),
      subject_name: test.subject_name,
      time_limit_seconds: test.time_limit_seconds
    });
  });
  
  return { tests, errors };
};

/**
 * Main parsing function that determines format and parses accordingly
 */
export const parseTests = (content, fileType) => {
  if (!content || content.trim() === '') {
    return { tests: [], errors: ['File is empty'] };
  }
  
  switch (fileType.toLowerCase()) {
    case 'csv':
      return parseTestsFromCSV(content);
    case 'json':
      return parseTestsFromJSON(content);
    case 'txt':
    case 'text':
      return parseTestsFromText(content);
    default:
      return { tests: [], errors: ['Unsupported file format'] };
  }
};

/**
 * Generate sample CSV content for template download
 */
export const generateSampleCSV = () => {
  const headers = [
    'title',
    'description', 
    'test_type',
    'subject_name',
    'time_limit_seconds'
  ];
  
  const sampleData = [
    [
      'Math Quiz 1',
      'Basic arithmetic operations quiz',
      'quiz',
      'Mathematics',
      '1800',
      '70'
    ],
    [
      'Science Unit Test',
      'Unit test on photosynthesis',
      'unit_test',
      'Science',
      '3600',
      '80'
    ],
    [
      'English Assignment',
      'Creative writing assignment',
      'assignment',
      'English',
      '',
      '75'
    ]
  ];
  
  return [headers, ...sampleData].map(row => row.join(',')).join('\n');
};

/**
 * Generate sample JSON content for template download
 */
export const generateSampleJSON = () => {
  return JSON.stringify([
    {
      "title": "Math Quiz 1",
      "description": "Basic arithmetic operations quiz",
      "test_type": "quiz",
      "subject_name": "Mathematics",
      "time_limit_seconds": 1800
    },
    {
      "title": "Science Unit Test",
      "description": "Unit test on photosynthesis",
      "test_type": "unit_test",
      "subject_name": "Science",
      "time_limit_seconds": 3600
    },
    {
      "title": "English Assignment",
      "description": "Creative writing assignment",
      "test_type": "assignment",
      "subject_name": "English",
      "time_limit_seconds": null
    }
  ], null, 2);
};

/**
 * Generate sample text content for template download
 */
export const generateSampleText = () => {
  return `Title: Math Quiz 1
Description: Basic arithmetic operations quiz
Test Type: quiz
Subject Name: Mathematics
Time Limit Seconds: 1800
Passing Score: 70

Title: Science Unit Test
Description: Unit test on photosynthesis
Test Type: unit_test
Subject Name: Science
Time Limit Seconds: 3600
Passing Score: 80

Title: English Assignment
Description: Creative writing assignment
Test Type: assignment
Subject Name: English
Time Limit Seconds: 
Passing Score: 75`;
};