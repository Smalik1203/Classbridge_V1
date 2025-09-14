-- Add chapter_id field to tests table for syllabus integration
-- This allows tests to be associated with specific chapters from the syllabus

-- Add chapter_id column to tests table
ALTER TABLE public.tests 
ADD COLUMN chapter_id UUID REFERENCES public.syllabus_chapters(id) ON DELETE SET NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_tests_chapter_id ON public.tests(chapter_id);

-- Add comment to document the field
COMMENT ON COLUMN public.tests.chapter_id IS 'Optional reference to syllabus chapter for better test organization';

-- Update existing tests to have NULL chapter_id (they can be updated later)
-- This is safe as the column allows NULL values
