-- Quizzes minimal schema with RLS

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quiz_visibility') THEN
    CREATE TYPE quiz_visibility AS ENUM ('draft','active','archived');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quiz_attempt_status') THEN
    CREATE TYPE quiz_attempt_status AS ENUM ('in_progress','submitted','graded');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_code text NOT NULL,
  class_instance_id uuid NOT NULL REFERENCES class_instances(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  time_limit_minutes integer CHECK (time_limit_minutes IS NULL OR time_limit_minutes > 0),
  total_points numeric,
  visibility quiz_visibility NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  type text NOT NULL CHECK (type IN ('mcq','msq','short')),
  options jsonb DEFAULT '[]'::jsonb,
  correct_answer jsonb,
  points numeric NOT NULL DEFAULT 1,
  order_index integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  started_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  score numeric,
  status quiz_attempt_status NOT NULL DEFAULT 'in_progress'
);

CREATE TABLE IF NOT EXISTS quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  answer jsonb,
  is_correct boolean,
  points_awarded numeric
);

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION current_user_school_code()
RETURNS text AS $$ SELECT school_code FROM users WHERE id = auth.uid(); $$ LANGUAGE sql STABLE;

-- Quizzes policies
DROP POLICY IF EXISTS quizzes_select ON quizzes;
CREATE POLICY quizzes_select ON quizzes
  FOR SELECT TO authenticated
  USING (school_code = current_user_school_code());

DROP POLICY IF EXISTS quizzes_insert ON quizzes;
CREATE POLICY quizzes_insert ON quizzes
  FOR INSERT TO authenticated
  WITH CHECK (
    school_code = current_user_school_code() AND
    (SELECT role FROM users WHERE id = auth.uid()) IN ('superadmin','admin','teacher')
  );

DROP POLICY IF EXISTS quizzes_update ON quizzes;
CREATE POLICY quizzes_update ON quizzes
  FOR UPDATE TO authenticated
  USING (school_code = current_user_school_code())
  WITH CHECK (
    school_code = current_user_school_code() AND
    (SELECT role FROM users WHERE id = auth.uid()) IN ('superadmin','admin','teacher')
  );

-- Questions follow parent quiz scope
DROP POLICY IF EXISTS quiz_questions_all ON quiz_questions;
CREATE POLICY quiz_questions_all ON quiz_questions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quizzes q
      WHERE q.id = quiz_questions.quiz_id
      AND q.school_code = current_user_school_code()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quizzes q
      WHERE q.id = quiz_questions.quiz_id
      AND q.school_code = current_user_school_code()
    )
  );

-- Attempts: read/write within school; students limited by student_id = auth.uid()
DROP POLICY IF EXISTS quiz_attempts_select ON quiz_attempts;
CREATE POLICY quiz_attempts_select ON quiz_attempts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quizzes q
      WHERE q.id = quiz_attempts.quiz_id
      AND q.school_code = current_user_school_code()
    ) AND (
      (SELECT role FROM users WHERE id = auth.uid()) IN ('superadmin','admin','teacher')
      OR quiz_attempts.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS quiz_attempts_insert ON quiz_attempts;
CREATE POLICY quiz_attempts_insert ON quiz_attempts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quizzes q
      WHERE q.id = quiz_attempts.quiz_id
      AND q.school_code = current_user_school_code()
    ) AND (
      (SELECT role FROM users WHERE id = auth.uid()) IN ('superadmin','admin','teacher')
      OR quiz_attempts.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS quiz_attempts_update ON quiz_attempts;
CREATE POLICY quiz_attempts_update ON quiz_attempts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quizzes q
      WHERE q.id = quiz_attempts.quiz_id
      AND q.school_code = current_user_school_code()
    ) AND (
      (SELECT role FROM users WHERE id = auth.uid()) IN ('superadmin','admin','teacher')
      OR quiz_attempts.student_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quizzes q
      WHERE q.id = quiz_attempts.quiz_id
      AND q.school_code = current_user_school_code()
    )
  );

-- Answers follow attempt scope
DROP POLICY IF EXISTS quiz_answers_all ON quiz_answers;
CREATE POLICY quiz_answers_all ON quiz_answers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
      WHERE a.id = quiz_answers.attempt_id
      AND q.school_code = current_user_school_code()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
      WHERE a.id = quiz_answers.attempt_id
      AND q.school_code = current_user_school_code()
    )
  );

CREATE INDEX IF NOT EXISTS idx_quizzes_school ON quizzes(school_code);
CREATE INDEX IF NOT EXISTS idx_quizzes_visibility ON quizzes(visibility);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);


