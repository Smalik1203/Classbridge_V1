-- Add school_code columns where missing to avoid runtime errors

ALTER TABLE IF NOT EXISTS student ADD COLUMN IF NOT EXISTS school_code text;
ALTER TABLE IF NOT EXISTS class_instances ADD COLUMN IF NOT EXISTS school_code text;
ALTER TABLE IF NOT EXISTS academic_years ADD COLUMN IF NOT EXISTS school_code text;
ALTER TABLE IF NOT EXISTS fee_student_plans ADD COLUMN IF NOT EXISTS school_code text;
ALTER TABLE IF NOT EXISTS fee_component_types ADD COLUMN IF NOT EXISTS school_code text;
ALTER TABLE IF NOT EXISTS users ADD COLUMN IF NOT EXISTS school_code text;

-- Helpful indexes (no-op if column is mostly null)
CREATE INDEX IF NOT EXISTS idx_student_school_code ON student(school_code);
CREATE INDEX IF NOT EXISTS idx_class_instances_school_code ON class_instances(school_code);
CREATE INDEX IF NOT EXISTS idx_academic_years_school_code ON academic_years(school_code);
CREATE INDEX IF NOT EXISTS idx_fee_student_plans_school_code2 ON fee_student_plans(school_code);
CREATE INDEX IF NOT EXISTS idx_fee_component_types_school_code2 ON fee_component_types(school_code);
CREATE INDEX IF NOT EXISTS idx_users_school_code ON users(school_code);


