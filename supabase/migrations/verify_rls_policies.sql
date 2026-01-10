-- Verification queries for RLS policies
-- Run these in Supabase SQL Editor after applying the migration

-- ============================================================================
-- 1. CHECK RLS IS ENABLED
-- ============================================================================

SELECT 
  schemaname, 
  tablename, 
  rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE tablename IN ('schools', 'super_admin', 'users')
  AND schemaname = 'public'
ORDER BY tablename;

-- Expected output: All tables should have rowsecurity = true


-- ============================================================================
-- 2. LIST ALL POLICIES
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as "Command (SELECT/INSERT/UPDATE/DELETE)"
FROM pg_policies
WHERE tablename IN ('schools', 'super_admin', 'users')
  AND schemaname = 'public'
ORDER BY tablename, policyname;

-- Expected output: Should see policies for cb_admin and service_role


-- ============================================================================
-- 3. DETAILED POLICY INSPECTION
-- ============================================================================

-- View full policy definitions
SELECT 
  tablename,
  policyname,
  cmd,
  qual as "USING clause",
  with_check as "WITH CHECK clause"
FROM pg_policies
WHERE tablename IN ('schools', 'super_admin', 'users')
  AND schemaname = 'public'
ORDER BY tablename, cmd, policyname;


-- ============================================================================
-- 4. TEST CB ADMIN ACCESS (Run as CB Admin user)
-- ============================================================================

-- Test SELECT on schools
SELECT COUNT(*) as school_count FROM public.schools;

-- Test SELECT on super_admin
SELECT COUNT(*) as super_admin_count FROM public.super_admin;

-- Test SELECT on users (if exists)
SELECT COUNT(*) as user_count FROM public.users WHERE role = 'superadmin';


-- ============================================================================
-- 5. CHECK JWT CLAIMS (Run as logged-in CB Admin)
-- ============================================================================

-- This will show what's in your JWT token
SELECT 
  auth.jwt() ->> 'role' as jwt_role,
  auth.jwt() ->> 'school_code' as jwt_school_code,
  auth.uid() as user_id;

-- Expected output: jwt_role should be 'cb_admin'


-- ============================================================================
-- 6. VERIFY POLICY MATCHES
-- ============================================================================

-- Check if current user matches CB Admin policy
SELECT 
  (auth.jwt() ->> 'role'::text) = 'cb_admin' as "Is CB Admin",
  auth.jwt() ->> 'role' as "Current Role";

-- Expected output: "Is CB Admin" should be true for CB Admin users
