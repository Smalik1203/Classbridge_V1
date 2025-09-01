-- Syllabus Progress Tracking System
-- Integrates syllabus management with timetable for progress tracking
-- Updated to work with admin-based system instead of teachers

-- Note: This migration assumes the following tables already exist:
-- - admin (id uuid primary key, school_code text not null, ...)
-- - class_instances (id uuid pk, school_code text not null, class_teacher_id uuid references admin(id), academic_year_id uuid references academic_years(id), ...)
-- - subjects (id uuid pk, school_code text not null, subject_name text, ...)
-- - academic_years (id uuid pk, school_code text not null, year_start integer, year_end integer, is_active boolean, ...)
-- - schools (school_code text pk, ...)

-- Ensure academic_years table exists with proper structure
CREATE TABLE IF NOT EXISTS academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_code text NOT NULL,
  year_start integer NOT NULL,
  year_end integer NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_code, year_start, year_end)
);

-- 1. Syllabus table (parent table for each class-subject-academic year combination)
CREATE TABLE IF NOT EXISTS syllabi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_code text NOT NULL,
  class_instance_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  academic_year_id uuid NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES admin(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_code, class_instance_id, subject_id, academic_year_id),
  -- Fixed foreign key constraints
  CONSTRAINT fk_syllabi_class_instance
    FOREIGN KEY (class_instance_id)
    REFERENCES class_instances (id) ON DELETE CASCADE,
  CONSTRAINT fk_syllabi_subject
    FOREIGN KEY (subject_id)
    REFERENCES subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_syllabi_school_code
    FOREIGN KEY (school_code)
    REFERENCES schools (school_code) ON DELETE CASCADE
);

-- 2. Syllabus items table (chapters/units within a syllabus)
CREATE TABLE IF NOT EXISTS syllabus_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_code text NOT NULL,
  syllabus_id uuid NOT NULL REFERENCES syllabi(id) ON DELETE CASCADE,
  unit_no integer NOT NULL,
  title text NOT NULL,
  description text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  completed_by uuid REFERENCES admin(id),
  completed_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(syllabus_id, unit_no),
  CONSTRAINT fk_syllabus_items_school_code
    FOREIGN KEY (school_code)
    REFERENCES schools (school_code) ON DELETE CASCADE
);

-- 3. Timetable slots table (enhanced to link with syllabus items)
CREATE TABLE IF NOT EXISTS timetable_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_code text NOT NULL,
  class_instance_id uuid NOT NULL,
  class_date date NOT NULL,
  period_number integer NOT NULL,
  slot_type text NOT NULL CHECK (slot_type IN ('period', 'break', 'assembly', 'other')),
  name text, -- for break/assembly names
  start_time time NOT NULL,
  end_time time NOT NULL,
  subject_id uuid,
  teacher_id uuid REFERENCES admin(id) ON DELETE SET NULL,
  syllabus_item_id uuid REFERENCES syllabus_items(id) ON DELETE SET NULL,
  plan_text text, -- lesson plan or notes
  status text DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(class_instance_id, class_date, period_number),
  -- Fixed foreign key constraints
  CONSTRAINT fk_timetable_slots_class_instance
    FOREIGN KEY (class_instance_id)
    REFERENCES class_instances (id) ON DELETE CASCADE,
  CONSTRAINT fk_timetable_slots_subject
    FOREIGN KEY (subject_id)
    REFERENCES subjects (id) ON DELETE SET NULL,
  CONSTRAINT fk_timetable_slots_school_code
    FOREIGN KEY (school_code)
    REFERENCES schools (school_code) ON DELETE CASCADE
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_syllabi_school_code ON syllabi(school_code);
CREATE INDEX IF NOT EXISTS idx_syllabi_class_subject ON syllabi(class_instance_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_items_school_code ON syllabus_items(school_code);
CREATE INDEX IF NOT EXISTS idx_syllabus_items_syllabus_id ON syllabus_items(syllabus_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_items_status ON syllabus_items(status);
CREATE INDEX IF NOT EXISTS idx_timetable_slots_class_date ON timetable_slots(class_instance_id, class_date);
CREATE INDEX IF NOT EXISTS idx_timetable_slots_syllabus_item ON timetable_slots(syllabus_item_id);
CREATE INDEX IF NOT EXISTS idx_timetable_slots_status ON timetable_slots(status);

-- 5. Enable RLS on all tables
ALTER TABLE syllabi ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for syllabi
CREATE POLICY "Users can view syllabi from their school"
  ON syllabi FOR SELECT
  TO authenticated
  USING (school_code = (SELECT school_code FROM admin WHERE id = auth.uid()));

CREATE POLICY "Admins can manage syllabi"
  ON syllabi FOR ALL
  TO authenticated
  USING (
    school_code = (SELECT school_code FROM admin WHERE id = auth.uid()) AND
    (SELECT role FROM admin WHERE id = auth.uid()) IN ('superadmin', 'admin')
  );

-- 7. RLS Policies for syllabus_items
CREATE POLICY "Users can view syllabus items from their school"
  ON syllabus_items FOR SELECT
  TO authenticated
  USING (school_code = (SELECT school_code FROM admin WHERE id = auth.uid()));

CREATE POLICY "Assigned admins can update syllabus items"
  ON syllabus_items FOR UPDATE
  TO authenticated
  USING (
    syllabus_id IN (
      SELECT s.id FROM syllabi s
      JOIN class_instances ci ON s.class_instance_id = ci.id
      WHERE s.school_code = (SELECT school_code FROM admin WHERE id = auth.uid())
      AND (
        ci.class_teacher_id = auth.uid() OR
        (SELECT role FROM admin WHERE id = auth.uid()) IN ('superadmin', 'admin')
      )
    )
  );

CREATE POLICY "Admins can manage syllabus items"
  ON syllabus_items FOR ALL
  TO authenticated
  USING (
    school_code = (SELECT school_code FROM admin WHERE id = auth.uid()) AND
    (SELECT role FROM admin WHERE id = auth.uid()) IN ('superadmin', 'admin')
  );

-- 8. RLS Policies for timetable_slots
CREATE POLICY "Users can view timetable slots from their school"
  ON timetable_slots FOR SELECT
  TO authenticated
  USING (school_code = (SELECT school_code FROM admin WHERE id = auth.uid()));

CREATE POLICY "Assigned admins can manage their timetable slots"
  ON timetable_slots FOR ALL
  TO authenticated
  USING (
    school_code = (SELECT school_code FROM admin WHERE id = auth.uid()) AND
    (
      teacher_id = auth.uid() OR
      (SELECT role FROM admin WHERE id = auth.uid()) IN ('superadmin', 'admin')
    )
  );

-- 9. Function to mark syllabus item status
CREATE OR REPLACE FUNCTION mark_syllabus_item_status(
  item_id uuid,
  new_status text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_role text;
  current_user_school text;
  item_syllabus_id uuid;
  syllabus_class_instance_id uuid;
  syllabus_subject_id uuid;
  syllabus_school_code text;
  result json;
BEGIN
  -- Get current user info
  SELECT role, school_code INTO current_user_role, current_user_school
  FROM admin WHERE id = auth.uid();
  
  IF current_user_role IS NULL THEN
    RETURN json_build_object('error', 'User not found');
  END IF;
  
  -- Get syllabus item info
  SELECT si.syllabus_id, s.class_instance_id, s.subject_id, s.school_code
  INTO item_syllabus_id, syllabus_class_instance_id, syllabus_subject_id, syllabus_school_code
  FROM syllabus_items si
  JOIN syllabi s ON si.syllabus_id = s.id
  WHERE si.id = item_id;
  
  IF item_syllabus_id IS NULL THEN
    RETURN json_build_object('error', 'Syllabus item not found');
  END IF;
  
  -- Check school access
  IF syllabus_school_code != current_user_school THEN
    RETURN json_build_object('error', 'Access denied');
  END IF;
  
  -- Check authorization (admin assigned to class or superadmin)
  IF current_user_role NOT IN ('superadmin', 'admin') THEN
    -- Check if admin is assigned to this class
    IF NOT EXISTS (
      SELECT 1 FROM class_instances 
      WHERE id = syllabus_class_instance_id 
      AND class_teacher_id = auth.uid()
    ) THEN
      RETURN json_build_object('error', 'Not authorized to update this syllabus item');
    END IF;
  END IF;
  
  -- Validate status transition
  IF new_status NOT IN ('pending', 'in_progress', 'completed') THEN
    RETURN json_build_object('error', 'Invalid status');
  END IF;
  
  -- Update the syllabus item
  UPDATE syllabus_items 
  SET 
    status = new_status,
    completed_by = CASE WHEN new_status = 'completed' THEN auth.uid() ELSE completed_by END,
    completed_at = CASE WHEN new_status = 'completed' THEN now() ELSE completed_at END,
    updated_at = now()
  WHERE id = item_id;
  
  -- Return success with updated info
  SELECT json_build_object(
    'success', true,
    'item_id', item_id,
    'new_status', new_status,
    'completed_by', CASE WHEN new_status = 'completed' THEN auth.uid() ELSE NULL END,
    'completed_at', CASE WHEN new_status = 'completed' THEN now() ELSE NULL END
  ) INTO result;
  
  RETURN result;
END;
$$;

-- 10. Function to get subject progress
CREATE OR REPLACE FUNCTION get_subject_progress(
  class_instance_id_param uuid,
  subject_id_param uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_school text;
  syllabus_id_found uuid;
  total_items integer;
  completed_items integer;
  in_progress_items integer;
  pending_items integer;
  completion_percentage integer;
  result json;
BEGIN
  -- Get current user school
  SELECT school_code INTO current_user_school
  FROM admin WHERE id = auth.uid();
  
  IF current_user_school IS NULL THEN
    RETURN json_build_object('error', 'User not found');
  END IF;
  
  -- Find the syllabus for this class-subject combination
  SELECT id INTO syllabus_id_found
  FROM syllabi
  WHERE class_instance_id = class_instance_id_param
    AND subject_id = subject_id_param
    AND school_code = current_user_school;
  
  IF syllabus_id_found IS NULL THEN
    RETURN json_build_object(
      'total', 0,
      'completed', 0,
      'in_progress', 0,
      'pending', 0,
      'percentage', 0
    );
  END IF;
  
  -- Get counts
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
    COUNT(*) FILTER (WHERE status = 'pending') as pending
  INTO total_items, completed_items, in_progress_items, pending_items
  FROM syllabus_items
  WHERE syllabus_id = syllabus_id_found;
  
  -- Calculate percentage
  completion_percentage = FLOOR(100 * completed_items / GREATEST(total_items, 1));
  
  -- Return result
  SELECT json_build_object(
    'total', total_items,
    'completed', completed_items,
    'in_progress', in_progress_items,
    'pending', pending_items,
    'percentage', completion_percentage
  ) INTO result;
  
  RETURN result;
END;
$$;

-- 11. View for syllabus progress summary
CREATE OR REPLACE VIEW v_syllabus_progress AS
SELECT 
  s.school_code,
  s.class_instance_id,
  s.subject_id,
  s.academic_year_id,
  sub.subject_name,
  ci.grade,
  ci.section,
  COUNT(si.id) as total_items,
  COUNT(si.id) FILTER (WHERE si.status = 'completed') as completed_items,
  COUNT(si.id) FILTER (WHERE si.status = 'in_progress') as in_progress_items,
  COUNT(si.id) FILTER (WHERE si.status = 'pending') as pending_items,
  FLOOR(100 * COUNT(si.id) FILTER (WHERE si.status = 'completed') / GREATEST(COUNT(si.id), 1)) as completion_percentage
FROM syllabi s
JOIN subjects sub ON s.subject_id = sub.id
JOIN class_instances ci ON s.class_instance_id = ci.id
LEFT JOIN syllabus_items si ON s.id = si.syllabus_id
GROUP BY s.id, s.school_code, s.class_instance_id, s.subject_id, s.academic_year_id, sub.subject_name, ci.grade, ci.section;

-- 12. View for daily timetable progress
CREATE OR REPLACE VIEW v_timetable_progress_day AS
SELECT 
  ts.id as slot_id,
  ts.class_date,
  ts.period_number,
  ts.start_time,
  ts.end_time,
  ts.school_code,
  ts.class_instance_id,
  ts.subject_id,
  ts.teacher_id,
  ts.syllabus_item_id,
  ts.status as slot_status,
  si.unit_no,
  si.title as chapter_title,
  si.status as chapter_status,
  sub.subject_name,
  a.full_name as teacher_name
FROM timetable_slots ts
LEFT JOIN syllabus_items si ON ts.syllabus_item_id = si.id
LEFT JOIN subjects sub ON ts.subject_id = sub.id
LEFT JOIN admin a ON ts.teacher_id = a.id
WHERE ts.slot_type = 'period'
ORDER BY ts.class_date DESC, ts.period_number;

-- 13. Grant permissions
GRANT SELECT ON v_syllabus_progress TO authenticated;
GRANT SELECT ON v_timetable_progress_day TO authenticated;
GRANT EXECUTE ON FUNCTION mark_syllabus_item_status TO authenticated;
GRANT EXECUTE ON FUNCTION get_subject_progress TO authenticated;
