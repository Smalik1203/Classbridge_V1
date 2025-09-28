-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR CLASSBRIDGE
-- =====================================================
-- This file contains comprehensive RLS policies to ensure
-- data isolation between schools and proper access control
-- =====================================================

-- Enable RLS on all critical tables
ALTER TABLE fee_component_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_student_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_student_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabi ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_resources ENABLE ROW LEVEL SECURITY;

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

-- Function to get current user's student_code from auth metadata
CREATE OR REPLACE FUNCTION get_user_student_code()
RETURNS TEXT AS $$
BEGIN
  -- Try to get student_code from various metadata locations
  RETURN COALESCE(
    auth.jwt() ->> 'raw_app_meta_data' ->> 'student_code',
    auth.jwt() ->> 'app_metadata' ->> 'student_code',
    auth.jwt() ->> 'raw_user_meta_data' ->> 'student_code',
    auth.jwt() ->> 'user_metadata' ->> 'student_code'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FEE-RELATED TABLES RLS POLICIES
-- =====================================================

-- Fee Component Types
DROP POLICY IF EXISTS "fee_component_types_school_isolation" ON fee_component_types;
CREATE POLICY "fee_component_types_school_isolation" ON fee_component_types
  FOR ALL USING (
    -- Superadmins can see all
    get_user_role() = 'superadmin' OR
    -- Others can only see their school's components
    school_code = get_user_school_code()
  );

-- Fee Student Plans
DROP POLICY IF EXISTS "fee_student_plans_school_isolation" ON fee_student_plans;
CREATE POLICY "fee_student_plans_school_isolation" ON fee_student_plans
  FOR ALL USING (
    -- Superadmins can see all
    get_user_role() = 'superadmin' OR
    -- Others can only see their school's plans
    school_code = get_user_school_code()
  );

-- Fee Student Plan Items
DROP POLICY IF EXISTS "fee_student_plan_items_school_isolation" ON fee_student_plan_items;
CREATE POLICY "fee_student_plan_items_school_isolation" ON fee_student_plan_items
  FOR ALL USING (
    -- Superadmins can see all
    get_user_role() = 'superadmin' OR
    -- Others can only see their school's plan items
    school_code = get_user_school_code()
  );

-- Fee Payments
DROP POLICY IF EXISTS "fee_payments_school_isolation" ON fee_payments;
CREATE POLICY "fee_payments_school_isolation" ON fee_payments
  FOR ALL USING (
    -- Superadmins can see all
    get_user_role() = 'superadmin' OR
    -- Others can only see their school's payments
    school_code = get_user_school_code()
  );

-- =====================================================
-- STUDENT-RELATED TABLES RLS POLICIES
-- =====================================================

-- Students
DROP POLICY IF EXISTS "student_school_isolation" ON student;
CREATE POLICY "student_school_isolation" ON student
  FOR ALL USING (
    -- Superadmins can see all
    get_user_role() = 'superadmin' OR
    -- Students can only see their own record
    (get_user_role() = 'student' AND student_code = get_user_student_code()) OR
    -- Admins can see all students in their school
    (get_user_role() = 'admin' AND school_code = get_user_school_code())
  );

-- =====================================================
-- ADMIN-RELATED TABLES RLS POLICIES
-- =====================================================

-- Admins
DROP POLICY IF EXISTS "admin_school_isolation" ON admin;
CREATE POLICY "admin_school_isolation" ON admin
  FOR ALL USING (
    -- Superadmins can see all
    get_user_role() = 'superadmin' OR
    -- Admins can only see admins in their school
    (get_user_role() = 'admin' AND school_code = get_user_school_code()) OR
    -- Users can see their own admin record
    id = auth.uid()
  );

-- =====================================================
-- CLASS AND SUBJECT TABLES RLS POLICIES
-- =====================================================

-- Class Instances
DROP POLICY IF EXISTS "class_instances_school_isolation" ON class_instances;
CREATE POLICY "class_instances_school_isolation" ON class_instances
  FOR ALL USING (
    -- Superadmins can see all
    get_user_role() = 'superadmin' OR
    -- Others can only see their school's classes
    school_code = get_user_school_code()
  );

-- Subjects
DROP POLICY IF EXISTS "subjects_school_isolation" ON subjects;
CREATE POLICY "subjects_school_isolation" ON subjects
  FOR ALL USING (
    -- Superadmins can see all
    get_user_role() = 'superadmin' OR
    -- Others can only see their school's subjects
    school_code = get_user_school_code()
  );

-- =====================================================
-- SYLLABUS AND LEARNING RESOURCES RLS POLICIES
-- =====================================================

-- Syllabi
DROP POLICY IF EXISTS "syllabi_school_isolation" ON syllabi;
CREATE POLICY "syllabi_school_isolation" ON syllabi
  FOR ALL USING (
    -- Superadmins can see all
    get_user_role() = 'superadmin' OR
    -- Others can only see their school's syllabi
    school_code = get_user_school_code()
  );

-- Learning Resources
DROP POLICY IF EXISTS "learning_resources_school_isolation" ON learning_resources;
CREATE POLICY "learning_resources_school_isolation" ON learning_resources
  FOR ALL USING (
    -- Superadmins can see all
    get_user_role() = 'superadmin' OR
    -- Others can only see their school's resources
    school_code = get_user_school_code()
  );

-- =====================================================
-- ATTENDANCE RLS POLICIES
-- =====================================================

-- Attendance
DROP POLICY IF EXISTS "attendance_school_isolation" ON attendance;
CREATE POLICY "attendance_school_isolation" ON attendance
  FOR ALL USING (
    -- Superadmins can see all
    get_user_role() = 'superadmin' OR
    -- Students can only see their own attendance
    (get_user_role() = 'student' AND student_id IN (
      SELECT id FROM student WHERE student_code = get_user_student_code()
    )) OR
    -- Admins can see all attendance in their school
    (get_user_role() = 'admin' AND school_code = get_user_school_code())
  );

-- =====================================================
-- TEST-RELATED TABLES RLS POLICIES
-- =====================================================

-- Tests
DROP POLICY IF EXISTS "tests_school_isolation" ON tests;
CREATE POLICY "tests_school_isolation" ON tests
  FOR ALL USING (
    -- Superadmins can see all
    get_user_role() = 'superadmin' OR
    -- Others can only see their school's tests
    school_code = get_user_school_code()
  );

-- Test Questions
DROP POLICY IF EXISTS "test_questions_school_isolation" ON test_questions;
CREATE POLICY "test_questions_school_isolation" ON test_questions
  FOR ALL USING (
    -- Superadmins can see all
    get_user_role() = 'superadmin' OR
    -- Others can only see questions for their school's tests
    test_id IN (
      SELECT id FROM tests WHERE school_code = get_user_school_code()
    )
  );

-- Test Attempts
DROP POLICY IF EXISTS "test_attempts_school_isolation" ON test_attempts;
CREATE POLICY "test_attempts_school_isolation" ON test_attempts
  FOR ALL USING (
    -- Superadmins can see all
    get_user_role() = 'superadmin' OR
    -- Students can only see their own attempts
    (get_user_role() = 'student' AND student_id IN (
      SELECT id FROM student WHERE student_code = get_user_student_code()
    )) OR
    -- Admins can see all attempts in their school
    (get_user_role() = 'admin' AND school_code = get_user_school_code())
  );

-- Test Responses
DROP POLICY IF EXISTS "test_responses_school_isolation" ON test_responses;
CREATE POLICY "test_responses_school_isolation" ON test_responses
  FOR ALL USING (
    -- Superadmins can see all
    get_user_role() = 'superadmin' OR
    -- Students can only see their own responses
    (get_user_role() = 'student' AND attempt_id IN (
      SELECT ta.id FROM test_attempts ta
      JOIN student s ON ta.student_id = s.id
      WHERE s.student_code = get_user_student_code()
    )) OR
    -- Admins can see all responses in their school
    (get_user_role() = 'admin' AND school_code = get_user_school_code())
  );

-- =====================================================
-- ACADEMIC YEARS RLS POLICIES
-- =====================================================

-- Academic Years
DROP POLICY IF EXISTS "academic_years_school_isolation" ON academic_years;
CREATE POLICY "academic_years_school_isolation" ON academic_years
  FOR ALL USING (
    -- Superadmins can see all
    get_user_role() = 'superadmin' OR
    -- Others can only see their school's academic years
    school_code = get_user_school_code()
  );

-- =====================================================
-- ADDITIONAL SECURITY MEASURES
-- =====================================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Ensure RLS functions are accessible
GRANT EXECUTE ON FUNCTION get_user_school_code() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_student_code() TO authenticated;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Uncomment these to test RLS policies after setup
/*
-- Test 1: Check if RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'fee_component_types', 'fee_student_plans', 'fee_student_plan_items', 
  'fee_payments', 'student', 'admin', 'class_instances', 'subjects',
  'syllabi', 'learning_resources', 'attendance', 'tests', 'test_questions',
  'test_attempts', 'test_responses', 'academic_years'
);

-- Test 2: Check if policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Test 3: Test the helper functions
SELECT 
  get_user_school_code() as school_code,
  get_user_role() as role,
  get_user_student_code() as student_code;
*/
