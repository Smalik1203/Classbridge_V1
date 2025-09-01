-- Weekly Period Management Database Setup
-- This script sets up the necessary tables and functions for managing weekly periods

-- 1. Ensure the periods table exists (if not already created)
CREATE TABLE IF NOT EXISTS public.periods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  class_instance_id uuid NOT NULL,
  period_number integer NOT NULL,
  start_time time WITHOUT TIME ZONE NOT NULL,
  end_time time WITHOUT TIME ZONE NOT NULL,
  CONSTRAINT periods_pkey PRIMARY KEY (id),
  CONSTRAINT periods_class_instance_id_period_number_key UNIQUE (class_instance_id, period_number),
  CONSTRAINT periods_class_instance_id_fkey FOREIGN KEY (class_instance_id) REFERENCES class_instances(id) ON DELETE CASCADE,
  CONSTRAINT periods_period_number_check CHECK ((period_number >= 1))
) TABLESPACE pg_default;

-- 2. Ensure the timetable table exists (if not already created)
CREATE TABLE IF NOT EXISTS public.timetable (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  class_instance_id uuid NOT NULL,
  class_date date NOT NULL,
  period_number integer NOT NULL,
  subject_id uuid,
  admin_id uuid,
  school_code text NOT NULL,
  start_time time WITHOUT TIME ZONE NOT NULL,
  end_time time WITHOUT TIME ZONE NOT NULL,
  created_by text NOT NULL,
  created_at timestamp WITH TIME ZONE DEFAULT now(),
  CONSTRAINT timetable_pkey PRIMARY KEY (id),
  CONSTRAINT timetable_class_instance_id_class_date_period_number_key UNIQUE (class_instance_id, class_date, period_number),
  CONSTRAINT timetable_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES admin(id) ON DELETE CASCADE,
  CONSTRAINT timetable_class_instance_id_fkey FOREIGN KEY (class_instance_id) REFERENCES class_instances(id) ON DELETE CASCADE,
  CONSTRAINT timetable_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- 3. Student table (essential for fee management and other features)
CREATE TABLE IF NOT EXISTS public.student (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text UNIQUE,
  phone text,
  student_code text UNIQUE NOT NULL,
  class_instance_id uuid REFERENCES class_instances(id) ON DELETE SET NULL,
  school_code text,
  date_of_birth date,
  gender text CHECK (gender IN ('male', 'female', 'other')),
  address text,
  parent_name text,
  parent_phone text,
  parent_email text,
  emergency_contact text,
  blood_group text,
  admission_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'transferred')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Create indexes for student table
CREATE INDEX IF NOT EXISTS idx_student_school_code ON student(school_code);
CREATE INDEX IF NOT EXISTS idx_student_class_instance_id ON student(class_instance_id);
CREATE INDEX IF NOT EXISTS idx_student_student_code ON student(student_code);

-- 5. Enable RLS on student table
ALTER TABLE student ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for student table
CREATE POLICY IF NOT EXISTS "Users can view students from their school"
  ON student FOR SELECT
  TO authenticated
  USING (
    school_code = (SELECT school_code FROM users WHERE id = auth.uid())
  );

CREATE POLICY IF NOT EXISTS "Admins can manage students"
  ON student FOR ALL
  TO authenticated
  USING (
    school_code = (SELECT school_code FROM users WHERE id = auth.uid()) AND
    (SELECT role FROM users WHERE id = auth.uid()) IN ('superadmin', 'admin')
  );

CREATE POLICY IF NOT EXISTS "Students can view their own data"
  ON student FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- 7. Function to automatically set school_code when class_instance_id is set
CREATE OR REPLACE FUNCTION set_student_school_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.class_instance_id IS NOT NULL THEN
    SELECT school_code INTO NEW.school_code
    FROM class_instances
    WHERE id = NEW.class_instance_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Trigger to automatically set school_code
DROP TRIGGER IF EXISTS trigger_set_student_school_code ON student;
CREATE TRIGGER trigger_set_student_school_code
  BEFORE INSERT OR UPDATE ON student
  FOR EACH ROW
  EXECUTE FUNCTION set_student_school_code();

-- 9. Fee Component Types table (for FeeComponents.jsx)
CREATE TABLE IF NOT EXISTS public.fee_component_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_code text NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  default_amount_paise integer,
  is_recurring boolean DEFAULT true,
  period text DEFAULT 'annual',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fee_component_types_pkey PRIMARY KEY (id),
  CONSTRAINT fee_component_types_school_code_code_key UNIQUE (school_code, code)
) TABLESPACE pg_default;

-- 10. Fee Student Plans table (for FeeManage.jsx)
CREATE TABLE IF NOT EXISTS public.fee_student_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_code text NOT NULL,
  student_id uuid NOT NULL,
  class_instance_id uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fee_student_plans_pkey PRIMARY KEY (id),
  CONSTRAINT fee_student_plans_student_id_class_instance_id_key UNIQUE (student_id, class_instance_id),
  CONSTRAINT fee_student_plans_student_id_fkey FOREIGN KEY (student_id) REFERENCES student(id) ON DELETE CASCADE,
  CONSTRAINT fee_student_plans_class_instance_id_fkey FOREIGN KEY (class_instance_id) REFERENCES class_instances(id) ON DELETE CASCADE,
  CONSTRAINT fee_student_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- 11. Fee Student Plan Items table (for FeeManage.jsx)
CREATE TABLE IF NOT EXISTS public.fee_student_plan_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  component_type_id uuid NOT NULL,
  amount_paise integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fee_student_plan_items_pkey PRIMARY KEY (id),
  CONSTRAINT fee_student_plan_items_plan_id_component_type_id_key UNIQUE (plan_id, component_type_id),
  CONSTRAINT fee_student_plan_items_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES fee_student_plans(id) ON DELETE CASCADE,
  CONSTRAINT fee_student_plan_items_component_type_id_fkey FOREIGN KEY (component_type_id) REFERENCES fee_component_types(id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- 12. Enable Row Level Security on fee tables
ALTER TABLE fee_component_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_student_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_student_plan_items ENABLE ROW LEVEL SECURITY;

-- 13. RLS Policies for fee_component_types
CREATE POLICY IF NOT EXISTS "Users can view fee components from their school"
  ON fee_component_types FOR SELECT
  TO authenticated
  USING (school_code = (SELECT school_code FROM users WHERE id = auth.uid()));

CREATE POLICY IF NOT EXISTS "Admins can manage fee components"
  ON fee_component_types FOR ALL
  TO authenticated
  USING (
    school_code = (SELECT school_code FROM users WHERE id = auth.uid()) AND
    (SELECT role FROM users WHERE id = auth.uid()) IN ('superadmin', 'admin')
  );

-- 14. RLS Policies for fee_student_plans
CREATE POLICY IF NOT EXISTS "Users can view fee plans from their school"
  ON fee_student_plans FOR SELECT
  TO authenticated
  USING (school_code = (SELECT school_code FROM users WHERE id = auth.uid()));

CREATE POLICY IF NOT EXISTS "Admins can manage fee plans"
  ON fee_student_plans FOR ALL
  TO authenticated
  USING (
    school_code = (SELECT school_code FROM users WHERE id = auth.uid()) AND
    (SELECT role FROM users WHERE id = auth.uid()) IN ('superadmin', 'admin')
  );

-- 15. RLS Policies for fee_student_plan_items
CREATE POLICY IF NOT EXISTS "Users can view fee plan items from their school"
  ON fee_student_plan_items FOR SELECT
  TO authenticated
  USING (
    plan_id IN (
      SELECT id FROM fee_student_plans 
      WHERE school_code = (SELECT school_code FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY IF NOT EXISTS "Admins can manage fee plan items"
  ON fee_student_plan_items FOR ALL
  TO authenticated
  USING (
    plan_id IN (
      SELECT id FROM fee_student_plans 
      WHERE school_code = (SELECT school_code FROM users WHERE id = auth.uid()) AND
      (SELECT role FROM users WHERE id = auth.uid()) IN ('superadmin', 'admin')
    )
  );

-- 16. Create indexes for fee tables
CREATE INDEX IF NOT EXISTS idx_fee_component_types_school_code ON fee_component_types(school_code);
CREATE INDEX IF NOT EXISTS idx_fee_student_plans_school_code ON fee_student_plans(school_code);
CREATE INDEX IF NOT EXISTS idx_fee_student_plans_student_id ON fee_student_plans(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_student_plans_class_instance_id ON fee_student_plans(class_instance_id);
CREATE INDEX IF NOT EXISTS idx_fee_student_plan_items_plan_id ON fee_student_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_fee_student_plan_items_component_type_id ON fee_student_plan_items(component_type_id);

-- 17. Update existing students to have school_code based on their class_instance
UPDATE student 
SET school_code = (
  SELECT ci.school_code 
  FROM class_instances ci 
  WHERE ci.id = student.class_instance_id
)
WHERE school_code IS NULL AND class_instance_id IS NOT NULL;

-- 18. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON student TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fee_component_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fee_student_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fee_student_plan_items TO authenticated;

-- 19. Add comments for documentation
COMMENT ON TABLE student IS 'Student records with school association through class_instance_id';
COMMENT ON COLUMN student.school_code IS 'School code derived from class_instance_id';
COMMENT ON COLUMN student.class_instance_id IS 'Reference to class_instance which contains school_code';
COMMENT ON TABLE fee_component_types IS 'Fee component types (e.g., Tuition, Transport, Library) for each school';
COMMENT ON TABLE fee_student_plans IS 'Fee plans for individual students in specific classes';
COMMENT ON TABLE fee_student_plan_items IS 'Individual fee components within a student plan';

-- 11. Create a function to apply weekly periods to a date range
CREATE OR REPLACE FUNCTION apply_weekly_periods_to_date_range(
  p_class_instance_id uuid,
  p_start_date date,
  p_end_date date,
  p_school_code text,
  p_created_by text
) RETURNS void AS $$
DECLARE
  period_record RECORD;
  current_date date;
  day_of_week integer;
BEGIN
  -- Delete existing timetable entries for the date range
  DELETE FROM timetable 
  WHERE class_instance_id = p_class_instance_id 
    AND class_date >= p_start_date 
    AND class_date <= p_end_date;
  
  -- Loop through each date in the range
  current_date := p_start_date;
  WHILE current_date <= p_end_date LOOP
    -- Get day of week (0 = Sunday, 6 = Saturday)
    day_of_week := EXTRACT(DOW FROM current_date);
    
    -- Only apply periods on weekdays (Monday = 1, Tuesday = 2, ..., Friday = 5)
    IF day_of_week BETWEEN 1 AND 5 THEN
      -- Loop through all periods for this class
      FOR period_record IN 
        SELECT * FROM periods 
        WHERE class_instance_id = p_class_instance_id 
        ORDER BY period_number
      LOOP
        -- Insert timetable entry for this period on this date
        INSERT INTO timetable (
          class_instance_id,
          class_date,
          period_number,
          subject_id,
          admin_id,
          school_code,
          start_time,
          end_time,
          created_by
        ) VALUES (
          p_class_instance_id,
          current_date,
          period_record.period_number,
          NULL, -- subject_id will be assigned later
          NULL, -- admin_id will be assigned later
          p_school_code,
          period_record.start_time,
          period_record.end_time,
          p_created_by
        );
      END LOOP;
    END IF;
    
    current_date := current_date + INTERVAL '1 day';
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 12. Create a function to get school days in a date range
CREATE OR REPLACE FUNCTION get_school_days_in_range(
  p_start_date date,
  p_end_date date
) RETURNS TABLE(school_date date) AS $$
DECLARE
  current_date date;
  day_of_week integer;
BEGIN
  current_date := p_start_date;
  WHILE current_date <= p_end_date LOOP
    day_of_week := EXTRACT(DOW FROM current_date);
    IF day_of_week BETWEEN 1 AND 5 THEN
      school_date := current_date;
      RETURN NEXT;
    END IF;
    current_date := current_date + INTERVAL '1 day';
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 13. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_periods_class_instance_id ON periods(class_instance_id);
CREATE INDEX IF NOT EXISTS idx_periods_period_number ON periods(period_number);
CREATE INDEX IF NOT EXISTS idx_timetable_class_instance_id ON timetable(class_instance_id);
CREATE INDEX IF NOT EXISTS idx_timetable_class_date ON timetable(class_date);
CREATE INDEX IF NOT EXISTS idx_timetable_period_number ON timetable(period_number);

-- 14. Create a view for easy period management
CREATE OR REPLACE VIEW period_summary AS
SELECT 
  p.id,
  p.class_instance_id,
  ci.grade,
  ci.section,
  p.period_number,
  p.start_time,
  p.end_time,
  EXTRACT(EPOCH FROM (p.end_time - p.start_time))/60 as duration_minutes
FROM periods p
JOIN class_instances ci ON p.class_instance_id = ci.id
ORDER BY ci.grade, ci.section, p.period_number;

-- 15. Create a view for timetable summary
CREATE OR REPLACE VIEW timetable_summary AS
SELECT 
  t.id,
  t.class_instance_id,
  ci.grade,
  ci.section,
  t.class_date,
  t.period_number,
  s.subject_name,
  a.full_name as teacher_name,
  t.start_time,
  t.end_time,
  t.school_code
FROM timetable t
JOIN class_instances ci ON t.class_instance_id = ci.id
LEFT JOIN subjects s ON t.subject_id = s.id
LEFT JOIN admin a ON t.admin_id = a.id
ORDER BY t.class_date, t.period_number;

-- 16. Add comments for documentation
COMMENT ON TABLE periods IS 'Stores the weekly period schedule for each class';
COMMENT ON TABLE timetable IS 'Stores the actual timetable entries for specific dates';
COMMENT ON TABLE fee_component_types IS 'Stores fee component types (e.g., Tuition, Transport) for each school';
COMMENT ON TABLE fee_student_plans IS 'Stores fee plans for individual students in specific classes';
COMMENT ON TABLE fee_student_plan_items IS 'Stores individual fee components within a student plan';
COMMENT ON FUNCTION apply_weekly_periods_to_date_range IS 'Applies weekly periods to a date range, excluding weekends';
COMMENT ON FUNCTION get_school_days_in_range IS 'Returns all school days (weekdays) in a given date range';
COMMENT ON VIEW period_summary IS 'Summary view of all periods with class information';
COMMENT ON VIEW timetable_summary IS 'Summary view of all timetable entries with class, subject, and teacher information'; 