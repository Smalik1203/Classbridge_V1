-- =====================================================
-- QUICK RLS FIX FOR FEE MANAGEMENT ISSUES
-- =====================================================
-- Run this script to immediately fix the cross-school data access issues
-- =====================================================

-- Step 1: Enable RLS on critical tables
ALTER TABLE fee_component_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_student_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_student_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_instances ENABLE ROW LEVEL SECURITY;

-- Step 2: Create helper functions
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

-- Step 3: Create RLS policies for fee tables
-- Fee Component Types
DROP POLICY IF EXISTS "fee_component_types_school_isolation" ON fee_component_types;
CREATE POLICY "fee_component_types_school_isolation" ON fee_component_types
  FOR ALL USING (
    get_user_role() = 'superadmin' OR school_code = get_user_school_code()
  );

-- Fee Student Plans
DROP POLICY IF EXISTS "fee_student_plans_school_isolation" ON fee_student_plans;
CREATE POLICY "fee_student_plans_school_isolation" ON fee_student_plans
  FOR ALL USING (
    get_user_role() = 'superadmin' OR school_code = get_user_school_code()
  );

-- Fee Student Plan Items
DROP POLICY IF EXISTS "fee_student_plan_items_school_isolation" ON fee_student_plan_items;
CREATE POLICY "fee_student_plan_items_school_isolation" ON fee_student_plan_items
  FOR ALL USING (
    get_user_role() = 'superadmin' OR school_code = get_user_school_code()
  );

-- Fee Payments
DROP POLICY IF EXISTS "fee_payments_school_isolation" ON fee_payments;
CREATE POLICY "fee_payments_school_isolation" ON fee_payments
  FOR ALL USING (
    get_user_role() = 'superadmin' OR school_code = get_user_school_code()
  );

-- Student Table
DROP POLICY IF EXISTS "student_school_isolation" ON student;
CREATE POLICY "student_school_isolation" ON student
  FOR ALL USING (
    get_user_role() = 'superadmin' OR school_code = get_user_school_code()
  );

-- Admin Table
DROP POLICY IF EXISTS "admin_school_isolation" ON admin;
CREATE POLICY "admin_school_isolation" ON admin
  FOR ALL USING (
    get_user_role() = 'superadmin' OR 
    (get_user_role() = 'admin' AND school_code = get_user_school_code()) OR
    id = auth.uid()
  );

-- Class Instances
DROP POLICY IF EXISTS "class_instances_school_isolation" ON class_instances;
CREATE POLICY "class_instances_school_isolation" ON class_instances
  FOR ALL USING (
    get_user_role() = 'superadmin' OR school_code = get_user_school_code()
  );

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION get_user_school_code() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;

-- Step 5: Verify setup
SELECT 'RLS Setup Complete' as status;
