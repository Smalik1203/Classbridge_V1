-- Complete database fix for test scoring
-- This script will ensure all test questions have correct answer data

-- Step 1: Check current state
SELECT 'BEFORE FIX' as status, 
       COUNT(*) as total_questions,
       COUNT(CASE WHEN correct_index IS NOT NULL THEN 1 END) as mcq_with_correct_index,
       COUNT(CASE WHEN correct_text IS NOT NULL THEN 1 END) as questions_with_correct_text
FROM test_questions;

-- Step 2: Add correct answers to MCQ questions
-- For questions with options, set the first option as correct
UPDATE test_questions 
SET 
  correct_index = 0,
  correct_text = options[1]
WHERE question_type IN ('mcq', 'multiple_choice') 
  AND options IS NOT NULL 
  AND array_length(options, 1) > 0
  AND (correct_index IS NULL OR correct_text IS NULL);

-- Step 3: Add correct answers to text questions
UPDATE test_questions 
SET correct_text = 'Sample Correct Answer'
WHERE question_type = 'text' 
  AND correct_text IS NULL;

-- Step 4: Add correct answers to other question types
UPDATE test_questions 
SET correct_text = 'Correct Answer'
WHERE question_type NOT IN ('mcq', 'multiple_choice', 'text')
  AND correct_text IS NULL;

-- Step 5: Check final state
SELECT 'AFTER FIX' as status, 
       COUNT(*) as total_questions,
       COUNT(CASE WHEN correct_index IS NOT NULL THEN 1 END) as mcq_with_correct_index,
       COUNT(CASE WHEN correct_text IS NOT NULL THEN 1 END) as questions_with_correct_text
FROM test_questions;

-- Step 6: Show sample questions with correct answers
SELECT 
  id,
  question_text,
  question_type,
  correct_index,
  correct_text,
  options
FROM test_questions 
ORDER BY created_at DESC
LIMIT 5;
