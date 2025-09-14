-- Check and fix RLS policies for student table
-- This migration ensures proper RLS policies are in place for student updates

-- First, let's check if RLS is enabled on the student table
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'student' AND schemaname = 'public';

-- Check existing policies on student table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'student' AND schemaname = 'public';

-- If RLS is enabled but there are no policies, or if policies are too restrictive,
-- we need to create appropriate policies

-- Drop existing policies if they exist (be careful in production)
-- DROP POLICY IF EXISTS "Students can view their own data" ON public.student;
-- DROP POLICY IF EXISTS "Admins can manage students in their school" ON public.student;

-- Create a policy that allows admins and superadmins to update students in their school
CREATE POLICY "Admins can manage students in their school" ON public.student
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
      AND school_code = public.student.school_code
    )
  );

-- Create a policy that allows students to view their own data
CREATE POLICY "Students can view their own data" ON public.student
  FOR SELECT
  USING (
    id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
      AND school_code = public.student.school_code
    )
  );

-- If the above policies already exist, this will fail gracefully
-- The important thing is that admins can update students in their school
