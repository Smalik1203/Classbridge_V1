-- Fix test_type constraint to allow custom test types
-- This removes the restrictive constraint that only allows predefined test types

-- Drop the existing constraint
ALTER TABLE public.tests DROP CONSTRAINT IF EXISTS tests_test_type_check;

-- Optional: Add a more flexible constraint that just ensures test_type is not empty
-- ALTER TABLE public.tests ADD CONSTRAINT tests_test_type_not_empty CHECK (test_type IS NOT NULL AND test_type != '');

-- Note: The above constraint is commented out to allow maximum flexibility
-- If you want to ensure test_type is never empty, uncomment the line above
