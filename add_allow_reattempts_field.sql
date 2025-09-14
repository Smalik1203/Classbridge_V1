-- Add allow_reattempts field to tests table
ALTER TABLE public.tests 
ADD COLUMN allow_reattempts BOOLEAN DEFAULT false;

-- Add comment to explain the field
COMMENT ON COLUMN public.tests.allow_reattempts IS 'Whether students are allowed to retake this test multiple times';

-- Update existing tests to have allow_reattempts = false by default
UPDATE public.tests 
SET allow_reattempts = false 
WHERE allow_reattempts IS NULL;
