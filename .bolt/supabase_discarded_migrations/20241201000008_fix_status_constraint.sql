-- Fix the status constraint to ensure 'completed' is allowed
-- This migration ensures the status constraint includes all valid values

-- Drop the existing constraint
ALTER TABLE public.test_attempts DROP CONSTRAINT IF EXISTS test_attempts_status_check;

-- Add the correct constraint with all valid status values
ALTER TABLE public.test_attempts 
ADD CONSTRAINT test_attempts_status_check 
CHECK (status IN ('in_progress', 'completed', 'abandoned'));

-- Verify the constraint was added correctly
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.test_attempts'::regclass
AND contype = 'c'
AND conname = 'test_attempts_status_check';
