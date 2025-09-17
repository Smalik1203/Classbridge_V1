-- Create test_attempts table for student test taking functionality
CREATE TABLE IF NOT EXISTS public.test_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.student(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}', -- {questionId: "answer" or "optionIndex"}
  score integer CHECK (score >= 0 AND score <= 100),
  earned_points integer DEFAULT 0,
  total_points integer DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_test_attempts_test_id ON public.test_attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_student_id ON public.test_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_status ON public.test_attempts(status);
CREATE INDEX IF NOT EXISTS idx_test_attempts_completed_at ON public.test_attempts(completed_at);

-- Create unique constraint to prevent multiple in_progress attempts for same test by same student
CREATE UNIQUE INDEX IF NOT EXISTS idx_test_attempts_unique_in_progress 
ON public.test_attempts(test_id, student_id) 
WHERE status = 'in_progress';

-- Enable RLS
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Students can only see their own attempts
CREATE POLICY "Students can view their own test attempts" ON public.test_attempts
  FOR SELECT USING (
    student_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
      AND school_code = (
        SELECT school_code FROM public.tests 
        WHERE id = test_attempts.test_id
      )
    )
  );

-- Students can insert their own attempts
CREATE POLICY "Students can create their own test attempts" ON public.test_attempts
  FOR INSERT WITH CHECK (
    student_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.student 
      WHERE id = auth.uid() 
      AND school_code = (
        SELECT school_code FROM public.tests 
        WHERE id = test_attempts.test_id
      )
    )
  );

-- Students can update their own in_progress attempts
CREATE POLICY "Students can update their own in_progress attempts" ON public.test_attempts
  FOR UPDATE USING (
    student_id = auth.uid() AND status = 'in_progress'
  );

-- Admins can view all attempts in their school
CREATE POLICY "Admins can view all test attempts in their school" ON public.test_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
      AND school_code = (
        SELECT school_code FROM public.tests 
        WHERE id = test_attempts.test_id
      )
    )
  );

-- Admins can update attempts in their school
CREATE POLICY "Admins can update test attempts in their school" ON public.test_attempts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
      AND school_code = (
        SELECT school_code FROM public.tests 
        WHERE id = test_attempts.test_id
      )
    )
  );
