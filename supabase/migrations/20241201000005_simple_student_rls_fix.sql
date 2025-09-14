-- Simple fix for student RLS policies
-- This migration ensures admins can update students

-- First, let's see what policies exist
SELECT schemaname, tablename, policyname, cmd, permissive
FROM pg_policies 
WHERE tablename = 'student' AND schemaname = 'public'
ORDER BY policyname;

-- Drop the restrictive SELECT-only policy for admins
DROP POLICY IF EXISTS "student_select_admins" ON public.student;

-- Create a simple policy that allows admins to do everything with students in their school
CREATE POLICY "Admins can manage students" ON public.student
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
      AND school_code = public.student.school_code
    )
  );

-- Also create a policy that checks the users table for role
CREATE POLICY "Users table role check" ON public.student
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
      AND school_code = public.student.school_code
    )
  );
