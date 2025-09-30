-- =====================================================
-- REVERT: Remove school_code column from fee_student_plan_items
-- =====================================================
-- This script removes the school_code column that was incorrectly added
-- to fee_student_plan_items, keeping the schema normalized
-- =====================================================

-- Step 0: Create helper functions for RLS policies
CREATE OR REPLACE FUNCTION get_user_school_code()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    auth.jwt() ->> 'raw_app_meta_data' ->> 'school_code',
    auth.jwt() ->> 'app_metadata' ->> 'school_code',
    auth.jwt() ->> 'raw_user_meta_data' ->> 'school_code',
    auth.jwt() ->> 'user_metadata' ->> 'school_code'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    auth.jwt() ->> 'raw_app_meta_data' ->> 'role',
    auth.jwt() ->> 'app_metadata' ->> 'role',
    auth.jwt() ->> 'raw_user_meta_data' ->> 'role',
    auth.jwt() ->> 'user_metadata' ->> 'role'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 1: Drop the RLS policy that depends on school_code column
DROP POLICY IF EXISTS "fee_student_plan_items_school_isolation" ON fee_student_plan_items;

-- Step 2: Drop the index on school_code
DROP INDEX IF EXISTS idx_fee_student_plan_items_school_code;

-- Step 3: Remove the school_code column
ALTER TABLE fee_student_plan_items DROP COLUMN IF EXISTS school_code;

-- Step 4: Create the correct RLS policy using joins
CREATE POLICY "fee_student_plan_items_school_isolation" ON fee_student_plan_items
  FOR ALL USING (
    -- Superadmins can see all plan items
    get_user_role() = 'superadmin' OR
    -- All other users can only see plan items from their school
    -- Join through fee_student_plans to get school_code
    EXISTS (
      SELECT 1
      FROM fee_student_plans fsp
      JOIN student s ON s.id = fsp.student_id
      WHERE fsp.id = fee_student_plan_items.plan_id
        AND s.school_code = get_user_school_code()
    )
  );

-- Step 5: Verify the fix
SELECT 'fee_student_plan_items school_code column removed and RLS policy updated' as status;
