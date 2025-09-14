-- Final fix for student RLS policies
-- This migration ensures admins can update students by modifying existing policies

-- Drop the restrictive SELECT-only policy for admins
DROP POLICY IF EXISTS "student_select_admins" ON public.student;

-- The existing "superdmin can manage students" policy should work for superadmins
-- But we need to ensure admins can also manage students

-- Create a policy specifically for admins to manage students in their school
CREATE POLICY "Admins can manage students in school" ON public.student
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'admin'
      AND school_code = public.student.school_code
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'admin'
      AND school_code = public.student.school_code
    )
  );

-- Also create a policy that checks if the user is a superadmin from the users table
CREATE POLICY "Superadmins from users table can manage students" ON public.student
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'superadmin'
      AND school_code = public.student.school_code
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'superadmin'
      AND school_code = public.student.school_code
    )
  );
