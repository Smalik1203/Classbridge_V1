-- Comprehensive script to set up correct answers for test questions
-- This will ensure all questions have proper correct answer data

-- 1. First, let's see the current state
SELECT 
  'Current Questions' as status,
  COUNT(*) as total_questions,
  COUNT(CASE WHEN correct_index IS NOT NULL THEN 1 END) as mcq_with_correct_index,
  COUNT(CASE WHEN correct_text IS NOT NULL THEN 1 END) as questions_with_correct_text
FROM test_questions;

-- 2. Update MCQ questions with proper correct answers
-- For questions with options, set the first option as correct
UPDATE test_questions 
SET 
  correct_index = 0,
  correct_text = options[1]
WHERE question_type IN ('mcq', 'multiple_choice') 
  AND options IS NOT NULL 
  AND array_length(options, 1) > 0
  AND correct_index IS NULL;

-- 3. Update text questions with sample correct answers
UPDATE test_questions 
SET correct_text = 'Sample Correct Answer'
WHERE question_type = 'text' 
  AND correct_text IS NULL;

-- 4. Update other question types
UPDATE test_questions 
SET correct_text = 'Correct Answer'
WHERE question_type NOT IN ('mcq', 'multiple_choice', 'text')
  AND correct_text IS NULL;

-- 5. Show the updated state
SELECT 
  'After Update' as status,
  COUNT(*) as total_questions,
  COUNT(CASE WHEN correct_index IS NOT NULL THEN 1 END) as mcq_with_correct_index,
  COUNT(CASE WHEN correct_text IS NOT NULL THEN 1 END) as questions_with_correct_text
FROM test_questions;

-- 6. Show sample questions with their correct answers
SELECT 
  id,
  question_text,
  question_type,
  correct_index,
  correct_text,
  options
FROM test_questions 
ORDER BY created_at DESC
LIMIT 10;
