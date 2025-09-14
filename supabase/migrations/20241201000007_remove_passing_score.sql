-- Remove passing_score column from tests table
-- This migration removes the passing_score column since we're now using correct answers instead

-- Drop the column
ALTER TABLE public.tests DROP COLUMN IF EXISTS passing_score;

-- Update any existing tests to remove passing_score references
-- (This is handled by dropping the column above)

-- Verify the column was removed
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'tests' 
AND table_schema = 'public'
AND column_name = 'passing_score';
