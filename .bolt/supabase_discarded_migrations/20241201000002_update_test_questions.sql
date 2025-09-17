-- Update test_questions table to include correct_answer and points fields
-- Add correct_answer field (text) for storing the correct answer
ALTER TABLE public.test_questions 
ADD COLUMN IF NOT EXISTS correct_answer text;

-- Add points field for scoring
ALTER TABLE public.test_questions 
ADD COLUMN IF NOT EXISTS points integer DEFAULT 1 CHECK (points > 0);

-- Add order_index field for question ordering
ALTER TABLE public.test_questions 
ADD COLUMN IF NOT EXISTS order_index integer DEFAULT 0;

-- Create index for order_index
CREATE INDEX IF NOT EXISTS idx_test_questions_order ON public.test_questions(test_id, order_index);

-- Update existing questions to have default values
UPDATE public.test_questions 
SET correct_answer = COALESCE(correct_text, ''),
    points = 1,
    order_index = 0
WHERE correct_answer IS NULL OR points IS NULL OR order_index IS NULL;
