-- Fix test_questions with sample correct answers for testing
-- This script will add correct answers to existing questions

-- First, let's see what we have
SELECT 
  id, 
  question_text, 
  question_type, 
  correct_index, 
  correct_text, 
  options
FROM test_questions 
WHERE test_id IN (
  SELECT id FROM tests ORDER BY created_at DESC LIMIT 1
)
LIMIT 5;

-- Update MCQ questions with correct answers
UPDATE test_questions 
SET 
  correct_index = 0,  -- First option is correct
  correct_text = CASE 
    WHEN options IS NOT NULL AND array_length(options, 1) > 0 
    THEN options[1] 
    ELSE 'Option A' 
  END
WHERE question_type IN ('mcq', 'multiple_choice') 
  AND correct_index IS NULL 
  AND options IS NOT NULL 
  AND array_length(options, 1) > 0;

-- Update text questions with correct answers
UPDATE test_questions 
SET correct_text = 'Correct Answer'
WHERE question_type = 'text' 
  AND correct_text IS NULL;

-- Show updated data
SELECT 
  id, 
  question_text, 
  question_type, 
  correct_index, 
  correct_text, 
  options
FROM test_questions 
WHERE test_id IN (
  SELECT id FROM tests ORDER BY created_at DESC LIMIT 1
)
LIMIT 5;
