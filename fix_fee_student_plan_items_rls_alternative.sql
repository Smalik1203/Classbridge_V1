-- =====================================================
-- ALTERNATIVE FIX: Update RLS policies without adding school_code column
-- =====================================================
-- This script updates the RLS policies to work with the existing schema
-- by using joins to access school_code from fee_student_plans table
-- =====================================================

-- Step 1: Drop existing policies
DROP POLICY IF EXISTS "fee_student_plan_items_school_isolation" ON fee_student_plan_items;

-- Step 2: Create new policy that uses JOIN to access school_code
CREATE POLICY "fee_student_plan_items_school_isolation" ON fee_student_plan_items
  FOR ALL USING (
    -- Superadmins can see all plan items
    get_user_role() = 'superadmin' OR
    -- All other users can only see plan items from their school
    EXISTS (
      SELECT 1 FROM fee_student_plans fsp 
      WHERE fsp.id = fee_student_plan_items.plan_id 
      AND fsp.school_code = get_user_school_code()
    )
  );

-- Step 3: Verify the fix
SELECT 'fee_student_plan_items RLS policy updated successfully' as status;
