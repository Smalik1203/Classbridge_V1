-- Fix Syllabus Schema Issues
-- This migration fixes the malformed foreign key constraints and adds missing columns

-- 1. Drop existing malformed constraints from syllabi table
ALTER TABLE IF EXISTS syllabi DROP CONSTRAINT IF EXISTS fk_syllabi_ci_school;
ALTER TABLE IF EXISTS syllabi DROP CONSTRAINT IF EXISTS fk_syllabi_subject_school;

-- 2. Add proper foreign key constraints to syllabi table
ALTER TABLE IF EXISTS syllabi 
ADD CONSTRAINT IF NOT EXISTS fk_syllabi_class_instance
FOREIGN KEY (class_instance_id) REFERENCES class_instances (id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS syllabi 
ADD CONSTRAINT IF NOT EXISTS fk_syllabi_subject
FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS syllabi 
ADD CONSTRAINT IF NOT EXISTS fk_syllabi_school_code
FOREIGN KEY (school_code) REFERENCES schools (school_code) ON DELETE CASCADE;

-- 3. Add school_code column to syllabus_items if it doesn't exist
ALTER TABLE IF EXISTS syllabus_items ADD COLUMN IF NOT EXISTS school_code text;

-- 4. Update syllabus_items school_code from related syllabi
UPDATE syllabus_items 
SET school_code = s.school_code
FROM syllabi s
WHERE syllabus_items.syllabus_id = s.id
AND syllabus_items.school_code IS NULL;

-- 5. Make school_code NOT NULL after populating
ALTER TABLE IF EXISTS syllabus_items ALTER COLUMN school_code SET NOT NULL;

-- 6. Add foreign key constraint to syllabus_items
ALTER TABLE IF EXISTS syllabus_items 
ADD CONSTRAINT IF NOT EXISTS fk_syllabus_items_school_code
FOREIGN KEY (school_code) REFERENCES schools (school_code) ON DELETE CASCADE;

-- 7. Drop existing malformed constraints from timetable_slots table
ALTER TABLE IF EXISTS timetable_slots DROP CONSTRAINT IF EXISTS fk_slots_ci_school;
ALTER TABLE IF EXISTS timetable_slots DROP CONSTRAINT IF EXISTS fk_slots_subject_school;

-- 8. Add proper foreign key constraints to timetable_slots table
ALTER TABLE IF EXISTS timetable_slots 
ADD CONSTRAINT IF NOT EXISTS fk_timetable_slots_class_instance
FOREIGN KEY (class_instance_id) REFERENCES class_instances (id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS timetable_slots 
ADD CONSTRAINT IF NOT EXISTS fk_timetable_slots_subject
FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS timetable_slots 
ADD CONSTRAINT IF NOT EXISTS fk_timetable_slots_school_code
FOREIGN KEY (school_code) REFERENCES schools (school_code) ON DELETE CASCADE;

-- 9. Create missing indexes
CREATE INDEX IF NOT EXISTS idx_syllabus_items_school_code ON syllabus_items(school_code);

-- 10. Update RLS policies for syllabus_items to use school_code directly
DROP POLICY IF EXISTS "Users can view syllabus items from their school" ON syllabus_items;
CREATE POLICY "Users can view syllabus items from their school"
  ON syllabus_items FOR SELECT
  TO authenticated
  USING (school_code = (SELECT school_code FROM admin WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage syllabus items" ON syllabus_items;
CREATE POLICY "Admins can manage syllabus items"
  ON syllabus_items FOR ALL
  TO authenticated
  USING (
    school_code = (SELECT school_code FROM admin WHERE id = auth.uid()) AND
    (SELECT role FROM admin WHERE id = auth.uid()) IN ('superadmin', 'admin')
  );

