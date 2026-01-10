-- Migration: Add RLS policies for CB Admin to access schools and super_admin tables
-- Created: 2026-01-09
-- Purpose: Allow CB Admin role to view and manage schools and super admins

-- ============================================================================
-- SCHOOLS TABLE RLS POLICIES
-- ============================================================================

-- Enable RLS on schools table
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- Policy: CB Admin can view all schools
CREATE POLICY "cb_admin_select_schools" ON public.schools
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'role'::text) = 'cb_admin'
  );

-- Policy: CB Admin can insert schools
CREATE POLICY "cb_admin_insert_schools" ON public.schools
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role'::text) = 'cb_admin'
  );

-- Policy: CB Admin can update schools
CREATE POLICY "cb_admin_update_schools" ON public.schools
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role'::text) = 'cb_admin'
  )
  WITH CHECK (
    (auth.jwt() ->> 'role'::text) = 'cb_admin'
  );

-- Policy: CB Admin can delete schools
CREATE POLICY "cb_admin_delete_schools" ON public.schools
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role'::text) = 'cb_admin'
  );

-- ============================================================================
-- SUPER_ADMIN TABLE RLS POLICIES
-- ============================================================================

-- Enable RLS on super_admin table
ALTER TABLE public.super_admin ENABLE ROW LEVEL SECURITY;

-- Policy: CB Admin can view all super admins
CREATE POLICY "cb_admin_select_super_admin" ON public.super_admin
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'role'::text) = 'cb_admin'
  );

-- Policy: CB Admin can insert super admins (via Edge Function)
CREATE POLICY "cb_admin_insert_super_admin" ON public.super_admin
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role'::text) = 'cb_admin'
  );

-- Policy: CB Admin can update super admins
CREATE POLICY "cb_admin_update_super_admin" ON public.super_admin
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role'::text) = 'cb_admin'
  )
  WITH CHECK (
    (auth.jwt() ->> 'role'::text) = 'cb_admin'
  );

-- Policy: CB Admin can delete super admins
CREATE POLICY "cb_admin_delete_super_admin" ON public.super_admin
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role'::text) = 'cb_admin'
  );

-- ============================================================================
-- USERS TABLE RLS POLICIES (if exists)
-- ============================================================================

-- Enable RLS on users table (if it exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'users'
  ) THEN
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    
    -- Policy: CB Admin can view all users
    CREATE POLICY "cb_admin_select_users" ON public.users
      FOR SELECT
      TO authenticated
      USING (
        (auth.jwt() ->> 'role'::text) = 'cb_admin'
      );
  END IF;
END $$;

-- ============================================================================
-- SERVICE ROLE BYPASS POLICIES
-- ============================================================================

-- Service role bypass for super_admin table (for Edge Functions)
CREATE POLICY "service_role_all_super_admin" ON public.super_admin
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role bypass for schools table (for Edge Functions if needed)
CREATE POLICY "service_role_all_schools" ON public.schools
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these queries after migration to verify policies are created:

-- Check RLS is enabled
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE tablename IN ('schools', 'super_admin', 'users');

-- Check all policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE tablename IN ('schools', 'super_admin', 'users')
-- ORDER BY tablename, policyname;
