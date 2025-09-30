-- =====================================================
-- FIX: Add school_code column to fee_student_plan_items table
-- =====================================================
-- This script adds the missing school_code column to fee_student_plan_items
-- and populates it with data from the related fee_student_plans table
-- =====================================================

-- Step 1: Add school_code column to fee_student_plan_items
ALTER TABLE fee_student_plan_items 
ADD COLUMN IF NOT EXISTS school_code VARCHAR(50);

-- Step 2: Populate school_code from fee_student_plans table
UPDATE fee_student_plan_items 
SET school_code = fsp.school_code
FROM fee_student_plans fsp
WHERE fee_student_plan_items.plan_id = fsp.id
AND fee_student_plan_items.school_code IS NULL;

-- Step 3: Make school_code NOT NULL after populating
ALTER TABLE fee_student_plan_items 
ALTER COLUMN school_code SET NOT NULL;

-- Step 4: Add index for better performance
CREATE INDEX IF NOT EXISTS idx_fee_student_plan_items_school_code 
ON fee_student_plan_items(school_code);

-- Step 5: Update RLS policies to use the new column
DROP POLICY IF EXISTS "fee_student_plan_items_school_isolation" ON fee_student_plan_items;
CREATE POLICY "fee_student_plan_items_school_isolation" ON fee_student_plan_items
  FOR ALL USING (
    -- Superadmins can see all plan items
    get_user_role() = 'superadmin' OR
    -- All other users can only see plan items from their school
    school_code = get_user_school_code()
  );

-- Step 6: Verify the fix
SELECT 'fee_student_plan_items school_code column added successfully' as status;
