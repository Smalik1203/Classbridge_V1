// src/services/importService.js
import { createQuestion } from './questionService';

/**
 * Find correct answer index with flexible matching
 * Handles common formatting differences like spaces, symbols, case
 */
const findCorrectAnswerIndex = (options, correctAnswer) => {
  if (!correctAnswer || !options || options.length === 0) return -1;
  
  const normalizeText = (text) => {
    return text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[×*]/g, 'x') // Replace × and * with x
      .replace(/[^\w\s\-\.]/g, '') // Remove special characters except word chars, spaces, hyphens, dots
      .trim();
  };
  
  const normalizedCorrect = normalizeText(correctAnswer);
  
  // First try exact match (case-insensitive)
  let index = options.findIndex(opt => 
    opt.trim().toLowerCase() === correctAnswer.trim().toLowerCase()
  );
  
  if (index !== -1) return index;
  
  // Then try normalized match
  index = options.findIndex(opt => 
    normalizeText(opt) === normalizedCorrect
  );
  
  if (index !== -1) return index;
  
  // Finally try partial match (contains)
  index = options.findIndex(opt => 
    normalizeText(opt).includes(normalizedCorrect) || 
    normalizedCorrect.includes(normalizeText(opt))
  );
  
  return index;
};

/**
 * Parse CSV content and convert to questions format
 */
export const parseCSVQuestions = (csvContent) => {
  const lines = csvContent.split('\n').filter(line => line.trim());
  const questions = [];
  
  // Skip header row if it exists
  const startIndex = lines[0].toLowerCase().includes('question') ? 1 : 0;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Split by comma, but handle quoted fields
    const fields = parseCSVLine(line);
    
    if (fields.length < 3) continue; // Minimum: question, type, correct_answer
    
    const question = {
      question_text: fields[0]?.trim() || '',
      question_type: fields[1]?.trim().toLowerCase() || 'mcq',
      correct_text: fields[2]?.trim() || '',
      options: [],
      correct_index: null
    };
    
    // Handle different question types
    if (question.question_type === 'mcq') {
      // For MCQ, options are in fields 3 onwards
      question.options = fields.slice(3).filter(opt => opt.trim());
      
      // Find correct answer index with flexible matching
      const correctAnswer = question.correct_text;
      question.correct_index = findCorrectAnswerIndex(question.options, correctAnswer);
      
      if (question.correct_index === -1) {
        question.correct_index = 0; // Default to first option
      }
    }
    
    questions.push(question);
  }
  
  return questions;
};

/**
 * Parse JSON content and convert to questions format
 */
export const parseJSONQuestions = (jsonContent) => {
  try {
    const data = JSON.parse(jsonContent);
    const questions = [];
    
    // Handle array of questions
    const questionsArray = Array.isArray(data) ? data : data.questions || [];
    
    questionsArray.forEach(item => {
      const question = {
        question_text: item.question_text || item.question || '',
        question_type: item.question_type || 'mcq',
        correct_text: item.correct_text || item.correct_answer || '',
        options: item.options || [],
        correct_index: item.correct_index || null
      };
      
      // For MCQ, ensure correct_index is set
      if (question.question_type === 'mcq' && question.options.length > 0) {
        if (question.correct_index === null || question.correct_index === undefined) {
          // Try to find correct answer by text
          const correctAnswer = question.correct_text;
          question.correct_index = question.options.findIndex(opt => 
            opt.trim().toLowerCase() === correctAnswer.toLowerCase()
          );
          if (question.correct_index === -1) {
            question.correct_index = 0;
          }
        }
      }
      
      questions.push(question);
    });
    
    return questions;
  } catch (error) {
    throw new Error('Invalid JSON format');
  }
};

/**
 * Parse simple text format (one question per line with special markers)
 */
export const parseTextQuestions = (textContent) => {
  const lines = textContent.split('\n').filter(line => line.trim());
  const questions = [];
  let currentQuestion = null;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.startsWith('Q:')) {
      // Save previous question
      if (currentQuestion) {
        // Set correct_index for MCQ before saving
        if (currentQuestion.question_type === 'mcq' && currentQuestion.options.length > 0) {
          const correctAnswer = currentQuestion.correct_text;
          currentQuestion.correct_index = currentQuestion.options.findIndex(opt => 
            opt.trim().toLowerCase() === correctAnswer.toLowerCase()
          );
          if (currentQuestion.correct_index === -1) {
            currentQuestion.correct_index = 0;
          }
        }
        questions.push(currentQuestion);
      }
      
      // Start new question
      currentQuestion = {
        question_text: trimmedLine.substring(2).trim(),
        question_type: 'mcq',
        options: [],
        correct_text: '',
        correct_index: null
      };
    } else if (trimmedLine.startsWith('A:')) {
      // Correct answer
      if (currentQuestion) {
        currentQuestion.correct_text = trimmedLine.substring(2).trim();
      }
    } else if (trimmedLine.startsWith('O:')) {
      // Option
      if (currentQuestion) {
        currentQuestion.options.push(trimmedLine.substring(2).trim());
      }
    } else if (trimmedLine.startsWith('T:')) {
      // Question type
      if (currentQuestion) {
        currentQuestion.question_type = trimmedLine.substring(2).trim().toLowerCase();
      }
    }
  }
  
  // Add last question
  if (currentQuestion) {
    // Set correct_index for MCQ
    if (currentQuestion.question_type === 'mcq' && currentQuestion.options.length > 0) {
      const correctAnswer = currentQuestion.correct_text;
      currentQuestion.correct_index = currentQuestion.options.findIndex(opt => 
        opt.trim().toLowerCase() === correctAnswer.toLowerCase()
      );
      if (currentQuestion.correct_index === -1) {
        currentQuestion.correct_index = 0;
      }
    }
    questions.push(currentQuestion);
  }
  
  return questions;
};

/**
 * Parse CSV line handling quoted fields
 */
const parseCSVLine = (line) => {
  const fields = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  fields.push(current.trim());
  return fields;
};

/**
 * Validate questions before import
 */
export const validateQuestions = (questions) => {
  const errors = [];
  
  questions.forEach((question, index) => {
    if (!question.question_text || question.question_text.trim() === '') {
      errors.push(`Question ${index + 1}: Question text is required`);
    }
    
    if (!['mcq', 'one_word', 'long_answer'].includes(question.question_type)) {
      errors.push(`Question ${index + 1}: Invalid question type. Must be mcq, one_word, or long_answer`);
    }
    
    if (question.question_type === 'mcq') {
      if (!question.options || question.options.length < 2) {
        errors.push(`Question ${index + 1}: MCQ must have at least 2 options`);
      }
      
      if (question.correct_index === null || question.correct_index === undefined) {
        errors.push(`Question ${index + 1}: MCQ must have a correct answer selected`);
      }
      
      if (question.correct_index >= question.options.length) {
        errors.push(`Question ${index + 1}: Correct answer index is out of range`);
      }
      
      // Check if correct answer matches any option
      if (question.correct_text && question.options && question.options.length > 0) {
        const correctAnswer = question.correct_text.trim();
        const hasMatch = question.options.some(opt => 
          opt.trim().toLowerCase() === correctAnswer.toLowerCase()
        );
        
        if (!hasMatch) {
          errors.push(`Question ${index + 1}: Correct answer "${correctAnswer}" does not exactly match any option. Available options: ${question.options.map(opt => `"${opt.trim()}"`).join(', ')}`);
        }
      }
    }
  });
  
  return errors;
};

/**
 * Import questions to a test
 */
export const importQuestionsToTest = async (testId, questions) => {
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };
  
  for (let i = 0; i < questions.length; i++) {
    try {
      const questionData = {
        test_id: testId,
        question_text: questions[i].question_text,
        question_type: questions[i].question_type,
        options: questions[i].question_type === 'mcq' ? questions[i].options : null,
        correct_index: questions[i].question_type === 'mcq' ? questions[i].correct_index : null,
        correct_text: questions[i].question_type !== 'mcq' ? questions[i].correct_text : null
      };
      
      await createQuestion(questionData);
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push(`Question ${i + 1}: ${error.message}`);
    }
  }
  
  return results;
};

/**
 * Generate CSV template with improved examples
 */
export const generateCSVTemplate = () => {
  const headers = [
    'Question Text',
    'Question Type',
    'Correct Answer',
    'Option 1',
    'Option 2',
    'Option 3',
    'Option 4'
  ];
  
  const samples = [
    [
      'What is the capital of France?',
      'mcq',
      'Paris',
      'Paris',
      'London',
      'Berlin',
      'Madrid'
    ],
    [
      'Which planet is known as the Red Planet?',
      'mcq',
      'Mars',
      'Venus',
      'Mars',
      'Jupiter',
      'Saturn'
    ],
    [
      'What is the speed of light in vacuum?',
      'mcq',
      '3 x 10^8 m/s',
      '3 x 10^8 m/s',
      '3 x 10^6 m/s',
      '3 x 10^9 m/s',
      '3 x 10^7 m/s'
    ]
  ];
  
  const csvRows = [headers, ...samples].map(row => 
    row.map(field => `"${field}"`).join(',')
  );
  
  // Add helpful comment at the top
  const comment = '# IMPORTANT: The Correct Answer must EXACTLY match one of the options (including spaces, symbols, and formatting)';
  
  return comment + '\n' + csvRows.join('\n');
};

/**
 * Generate JSON template with improved examples
 */
export const generateJSONTemplate = () => {
  const template = {
    comment: "IMPORTANT: The correct_text must EXACTLY match one of the options (including spaces, symbols, and formatting)",
    examples: [
    {
      question_text: "What is the capital of France?",
      question_type: "mcq",
      correct_text: "Paris",
      options: ["Paris", "London", "Berlin", "Madrid"],
      correct_index: 0
    },
    {
      question_text: "Which planet is known as the Red Planet?",
      question_type: "mcq",
      correct_text: "Mars",
      options: ["Venus", "Mars", "Jupiter", "Saturn"],
      correct_index: 1
    },
    {
      question_text: "What is the speed of light in vacuum?",
      question_type: "mcq",
      correct_text: "3 x 10^8 m/s",
      options: ["3 x 10^8 m/s", "3 x 10^6 m/s", "3 x 10^9 m/s", "3 x 10^7 m/s"],
      correct_index: 0
    }
    ]
  };
  
  return JSON.stringify(template, null, 2);
};

/**
 * Generate text template with improved examples
 */
export const generateTextTemplate = () => {
  return `# IMPORTANT: The Correct Answer (A:) must EXACTLY match one of the options (O:) including spaces, symbols, and formatting

Q: What is the capital of France?
T: mcq
A: Paris
O: Paris
O: London
O: Berlin
O: Madrid

Q: Which planet is known as the Red Planet?
T: mcq
A: Mars
O: Venus
O: Mars
O: Jupiter
O: Saturn

Q: What is the speed of light in vacuum?
T: mcq
A: 3 x 10^8 m/s
O: 3 x 10^8 m/s
O: 3 x 10^6 m/s
O: 3 x 10^9 m/s
O: 3 x 10^7 m/s`;
};
