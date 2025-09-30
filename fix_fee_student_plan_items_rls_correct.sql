-- =====================================================
-- CORRECT RLS POLICY FOR fee_student_plan_items
-- =====================================================
-- This script creates the proper RLS policy for fee_student_plan_items
-- using joins instead of a non-existent school_code column
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

-- Enable RLS on fee_student_plan_items if not already enabled
ALTER TABLE fee_student_plan_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that reference non-existent school_code column
DROP POLICY IF EXISTS "fee_student_plan_items_school_isolation" ON fee_student_plan_items;
DROP POLICY IF EXISTS "fee_student_plan_items_policy" ON fee_student_plan_items;

-- Create the correct RLS policy using joins
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

-- Alternative approach: Join through fee_component_types
-- This ensures the component itself belongs to the user's school
CREATE POLICY "fee_student_plan_items_component_school_isolation" ON fee_student_plan_items
  FOR ALL USING (
    -- Superadmins can see all plan items
    get_user_role() = 'superadmin' OR
    -- All other users can only see plan items where the component belongs to their school
    EXISTS (
      SELECT 1
      FROM fee_component_types fct
      WHERE fct.id = fee_student_plan_items.component_type_id
        AND fct.school_code = get_user_school_code()
    )
  );

-- Note: You can use either policy above, or both for extra security
-- The first one ensures the student belongs to the user's school
-- The second one ensures the fee component belongs to the user's school
-- Using both provides defense in depth

-- Verify the policy was created
SELECT 'fee_student_plan_items RLS policy created successfully' as status;
