-- =====================================================
-- FEE MANAGEMENT RLS POLICIES - IMMEDIATE FIX
-- =====================================================
-- This file contains RLS policies specifically for fee-related tables
-- to prevent cross-school data access issues
-- =====================================================

-- Enable RLS on fee tables (if not already enabled)
ALTER TABLE fee_component_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_student_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_student_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTIONS FOR RLS
-- =====================================================

-- Function to get current user's school_code from auth metadata
CREATE OR REPLACE FUNCTION get_user_school_code()
RETURNS TEXT AS $$
BEGIN
  -- Try to get school_code from various metadata locations
  RETURN COALESCE(
    auth.jwt() ->> 'raw_app_meta_data' ->> 'school_code',
    auth.jwt() ->> 'app_metadata' ->> 'school_code',
    auth.jwt() ->> 'raw_user_meta_data' ->> 'school_code',
    auth.jwt() ->> 'user_metadata' ->> 'school_code'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's role from auth metadata
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
  -- Try to get role from various metadata locations
  RETURN COALESCE(
    auth.jwt() ->> 'raw_app_meta_data' ->> 'role',
    auth.jwt() ->> 'app_metadata' ->> 'role',
    auth.jwt() ->> 'raw_user_meta_data' ->> 'role',
    auth.jwt() ->> 'user_metadata' ->> 'role'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FEE COMPONENT TYPES RLS POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "fee_component_types_school_isolation" ON fee_component_types;
DROP POLICY IF EXISTS "fee_component_types_policy" ON fee_component_types;

-- Create comprehensive policy for fee_component_types
CREATE POLICY "fee_component_types_school_isolation" ON fee_component_types
  FOR ALL USING (
    -- Superadmins can see all components
    get_user_role() = 'superadmin' OR
    -- All other users can only see components from their school
    school_code = get_user_school_code()
  );

-- =====================================================
-- FEE STUDENT PLANS RLS POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "fee_student_plans_school_isolation" ON fee_student_plans;
DROP POLICY IF EXISTS "fee_student_plans_policy" ON fee_student_plans;

-- Create comprehensive policy for fee_student_plans
CREATE POLICY "fee_student_plans_school_isolation" ON fee_student_plans
  FOR ALL USING (
    -- Superadmins can see all plans
    get_user_role() = 'superadmin' OR
    -- All other users can only see plans from their school
    school_code = get_user_school_code()
  );

-- =====================================================
-- FEE STUDENT PLAN ITEMS RLS POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "fee_student_plan_items_school_isolation" ON fee_student_plan_items;
DROP POLICY IF EXISTS "fee_student_plan_items_policy" ON fee_student_plan_items;

-- Create comprehensive policy for fee_student_plan_items
CREATE POLICY "fee_student_plan_items_school_isolation" ON fee_student_plan_items
  FOR ALL USING (
    -- Superadmins can see all plan items
    get_user_role() = 'superadmin' OR
    -- All other users can only see plan items from their school
    school_code = get_user_school_code()
  );

-- =====================================================
-- FEE PAYMENTS RLS POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "fee_payments_school_isolation" ON fee_payments;
DROP POLICY IF EXISTS "fee_payments_policy" ON fee_payments;

-- Create comprehensive policy for fee_payments
CREATE POLICY "fee_payments_school_isolation" ON fee_payments
  FOR ALL USING (
    -- Superadmins can see all payments
    get_user_role() = 'superadmin' OR
    -- All other users can only see payments from their school
    school_code = get_user_school_code()
  );

-- =====================================================
-- STUDENT TABLE RLS POLICIES (for fee context)
-- =====================================================

-- Enable RLS on student table if not already enabled
ALTER TABLE student ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "student_school_isolation" ON student;
DROP POLICY IF EXISTS "student_policy" ON student;

-- Create comprehensive policy for student table
CREATE POLICY "student_school_isolation" ON student
  FOR ALL USING (
    -- Superadmins can see all students
    get_user_role() = 'superadmin' OR
    -- All other users can only see students from their school
    school_code = get_user_school_code()
  );

-- =====================================================
-- ADMIN TABLE RLS POLICIES (for fee context)
-- =====================================================

-- Enable RLS on admin table if not already enabled
ALTER TABLE admin ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "admin_school_isolation" ON admin;
DROP POLICY IF EXISTS "admin_policy" ON admin;

-- Create comprehensive policy for admin table
CREATE POLICY "admin_school_isolation" ON admin
  FOR ALL USING (
    -- Superadmins can see all admins
    get_user_role() = 'superadmin' OR
    -- Admins can see admins from their school
    (get_user_role() = 'admin' AND school_code = get_user_school_code()) OR
    -- Users can see their own admin record
    id = auth.uid()
  );

-- =====================================================
-- CLASS INSTANCES RLS POLICIES (for fee context)
-- =====================================================

-- Enable RLS on class_instances table if not already enabled
ALTER TABLE class_instances ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "class_instances_school_isolation" ON class_instances;
DROP POLICY IF EXISTS "class_instances_policy" ON class_instances;

-- Create comprehensive policy for class_instances table
CREATE POLICY "class_instances_school_isolation" ON class_instances
  FOR ALL USING (
    -- Superadmins can see all classes
    get_user_role() = 'superadmin' OR
    -- All other users can only see classes from their school
    school_code = get_user_school_code()
  );

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fee_component_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fee_student_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fee_student_plan_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fee_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON student TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON admin TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON class_instances TO authenticated;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION get_user_school_code() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if RLS is enabled on fee tables
SELECT 
  tablename, 
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity THEN '✅ RLS Enabled' 
    ELSE '❌ RLS Disabled' 
  END as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'fee_component_types', 
  'fee_student_plans', 
  'fee_student_plan_items', 
  'fee_payments',
  'student',
  'admin',
  'class_instances'
)
ORDER BY tablename;

-- Check if policies exist for fee tables
SELECT 
  tablename, 
  policyname, 
  permissive,
  cmd as command,
  CASE 
    WHEN policyname IS NOT NULL THEN '✅ Policy Exists' 
    ELSE '❌ No Policy' 
  END as status
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN (
  'fee_component_types', 
  'fee_student_plans', 
  'fee_student_plan_items', 
  'fee_payments',
  'student',
  'admin',
  'class_instances'
)
ORDER BY tablename, policyname;

-- Test the helper functions (run this as an authenticated user)
-- SELECT 
--   get_user_school_code() as school_code,
--   get_user_role() as role;
