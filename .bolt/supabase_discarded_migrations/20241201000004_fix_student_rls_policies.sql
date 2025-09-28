-- Fix RLS policies for student table to allow admins to update students
-- This migration fixes the issue where admins can only SELECT but not UPDATE students

-- Drop the restrictive admin policy that only allows SELECT
DROP POLICY IF EXISTS "student_select_admins" ON public.student;

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Admins can manage students in their school" ON public.student;
DROP POLICY IF EXISTS "Admins can update students in their school" ON public.student;

-- Create a new policy that allows admins and superadmins to manage students in their school
CREATE POLICY "Admins can manage students in their school" ON public.student
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
      AND school_code = public.student.school_code
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
      AND school_code = public.student.school_code
    )
  );

-- Also create a fallback policy that checks user_metadata for superadmin role
-- (in case the role is stored in user_metadata instead of users table)
CREATE POLICY "Superadmin from user_metadata can manage students" ON public.student
  FOR ALL
  USING (
    (
      (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role'
    ) = 'superadmin'
  )
  WITH CHECK (
    (
      (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role'
    ) = 'superadmin'
  );

-- Create a policy that also checks app_metadata for role
CREATE POLICY "Superadmin from app_metadata can manage students" ON public.student
  FOR ALL
  USING (
    (
      (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role'
    ) = 'superadmin'
  )
  WITH CHECK (
    (
      (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role'
    ) = 'superadmin'
  );

-- Keep the existing teacher policy as is
-- Keep the existing student self-read policy as is
-- Keep the existing superadmin policy as is (it might work for some cases)
