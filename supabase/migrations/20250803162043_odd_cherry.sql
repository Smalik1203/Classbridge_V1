/*
  # Complete ClassBridge Database Schema

  1. New Tables
    - `assessments` - Store assessment/exam information
    - `assessment_results` - Store individual student results
    - `fee_structures` - Define fee structures for classes
    - `fee_payments` - Track student fee payments
    - `fee_component_types` - Fee component types (Tuition, Transport, etc.)
    - `fee_student_plans` - Individual student fee plans
    - `fee_student_plan_items` - Items within student fee plans
    - `activity_logs` - System activity tracking
    - `user_profiles` - Extended user profile information
    - `permissions` - Role-based permissions

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for each role

  3. Relationships
    - Proper foreign key constraints
    - Indexes for performance
*/

-- Assessments table
CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subject text NOT NULL,
  class_id uuid REFERENCES classes(id),
  class_instance_id uuid REFERENCES class_instances(id),
  exam_type text NOT NULL,
  total_marks integer NOT NULL,
  duration integer NOT NULL, -- in minutes
  exam_date date NOT NULL,
  description text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'ongoing', 'completed', 'graded')),
  created_by uuid REFERENCES auth.users(id),
  school_code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Assessment results table
CREATE TABLE IF NOT EXISTS assessment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid REFERENCES assessments(id) ON DELETE CASCADE,
  student_id uuid REFERENCES student(id),
  marks_obtained integer NOT NULL,
  max_marks integer NOT NULL,
  percentage decimal(5,2) GENERATED ALWAYS AS (ROUND((marks_obtained::decimal / max_marks::decimal) * 100, 2)) STORED,
  grade text,
  rank integer,
  remarks text,
  school_code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Fee structures table
CREATE TABLE IF NOT EXISTS fee_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  class_id uuid REFERENCES classes(id),
  academic_year_id uuid REFERENCES academic_years(id),
  components jsonb NOT NULL, -- Array of fee components with name, amount, type
  total_amount decimal(10,2) NOT NULL,
  due_date date NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  school_code text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Fee payments table
CREATE TABLE IF NOT EXISTS fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES student(id),
  fee_structure_id uuid REFERENCES fee_structures(id),
  amount decimal(10,2) NOT NULL,
  paid_amount decimal(10,2) DEFAULT 0,
  pending_amount decimal(10,2) GENERATED ALWAYS AS (amount - paid_amount) STORED,
  payment_date date,
  due_date date NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
  payment_method text,
  transaction_id text,
  remarks text,
  school_code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Fee Component Types table (for FeeComponents.jsx)
CREATE TABLE IF NOT EXISTS fee_component_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_code text NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  default_amount_paise integer,
  is_recurring boolean DEFAULT true,
  period text DEFAULT 'annual',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fee_component_types_school_code_code_key UNIQUE (school_code, code)
);

-- Fee Student Plans table (for FeeManage.jsx)
CREATE TABLE IF NOT EXISTS fee_student_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_code text NOT NULL,
  student_id uuid NOT NULL,
  class_instance_id uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fee_student_plans_student_id_class_instance_id_key UNIQUE (student_id, class_instance_id),
  CONSTRAINT fee_student_plans_student_id_fkey FOREIGN KEY (student_id) REFERENCES student(id) ON DELETE CASCADE,
  CONSTRAINT fee_student_plans_class_instance_id_fkey FOREIGN KEY (class_instance_id) REFERENCES class_instances(id) ON DELETE CASCADE,
  CONSTRAINT fee_student_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Fee Student Plan Items table (for FeeManage.jsx)
CREATE TABLE IF NOT EXISTS fee_student_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  component_type_id uuid NOT NULL,
  amount_paise integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fee_student_plan_items_plan_id_component_type_id_key UNIQUE (plan_id, component_type_id),
  CONSTRAINT fee_student_plan_items_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES fee_student_plans(id) ON DELETE CASCADE,
  CONSTRAINT fee_student_plan_items_component_type_id_fkey FOREIGN KEY (component_type_id) REFERENCES fee_component_types(id) ON DELETE CASCADE
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  description text,
  entity_type text, -- 'student', 'class', 'assessment', etc.
  entity_id uuid,
  metadata jsonb,
  school_code text,
  created_at timestamptz DEFAULT now()
);

-- User profiles table (extended user information)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  avatar_url text,
  role text NOT NULL,
  school_code text,
  permissions jsonb DEFAULT '[]'::jsonb,
  preferences jsonb DEFAULT '{}'::jsonb,
  last_login timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  category text,
  created_at timestamptz DEFAULT now()
);

-- Role permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  permission_id uuid REFERENCES permissions(id),
  school_code text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role, permission_id, school_code)
);

-- Enable RLS on all tables
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_component_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_student_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_student_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assessments
CREATE POLICY "Users can view assessments from their school"
  ON assessments FOR SELECT
  TO authenticated
  USING (school_code = (SELECT school_code FROM users WHERE id = auth.uid()));

CREATE POLICY "Teachers and admins can create assessments"
  ON assessments FOR INSERT
  TO authenticated
  WITH CHECK (
    school_code = (SELECT school_code FROM users WHERE id = auth.uid()) AND
    (SELECT role FROM users WHERE id = auth.uid()) IN ('superadmin', 'admin', 'teacher')
  );

CREATE POLICY "Teachers and admins can update their assessments"
  ON assessments FOR UPDATE
  TO authenticated
  USING (
    school_code = (SELECT school_code FROM users WHERE id = auth.uid()) AND
    (SELECT role FROM users WHERE id = auth.uid()) IN ('superadmin', 'admin', 'teacher')
  );

-- RLS Policies for assessment_results
CREATE POLICY "Users can view results from their school"
  ON assessment_results FOR SELECT
  TO authenticated
  USING (school_code = (SELECT school_code FROM users WHERE id = auth.uid()));

CREATE POLICY "Teachers and admins can manage results"
  ON assessment_results FOR ALL
  TO authenticated
  USING (
    school_code = (SELECT school_code FROM users WHERE id = auth.uid()) AND
    (SELECT role FROM users WHERE id = auth.uid()) IN ('superadmin', 'admin', 'teacher')
  );

-- RLS Policies for fee_structures
CREATE POLICY "Users can view fee structures from their school"
  ON fee_structures FOR SELECT
  TO authenticated
  USING (school_code = (SELECT school_code FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can manage fee structures"
  ON fee_structures FOR ALL
  TO authenticated
  USING (
    school_code = (SELECT school_code FROM users WHERE id = auth.uid()) AND
    (SELECT role FROM users WHERE id = auth.uid()) IN ('superadmin', 'admin')
  );

-- RLS Policies for fee_payments
CREATE POLICY "Users can view fee payments from their school"
  ON fee_payments FOR SELECT
  TO authenticated
  USING (school_code = (SELECT school_code FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can manage fee payments"
  ON fee_payments FOR ALL
  TO authenticated
  USING (
    school_code = (SELECT school_code FROM users WHERE id = auth.uid()) AND
    (SELECT role FROM users WHERE id = auth.uid()) IN ('superadmin', 'admin')
  );

-- RLS Policies for fee_component_types
CREATE POLICY "Users can view fee components from their school"
  ON fee_component_types FOR SELECT
  TO authenticated
  USING (school_code = (SELECT school_code FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can manage fee components"
  ON fee_component_types FOR ALL
  TO authenticated
  USING (
    school_code = (SELECT school_code FROM users WHERE id = auth.uid()) AND
    (SELECT role FROM users WHERE id = auth.uid()) IN ('superadmin', 'admin')
  );

-- RLS Policies for fee_student_plans
CREATE POLICY "Users can view student plans from their school"
  ON fee_student_plans FOR SELECT
  TO authenticated
  USING (school_code = (SELECT school_code FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can manage student plans"
  ON fee_student_plans FOR ALL
  TO authenticated
  USING (
    school_code = (SELECT school_code FROM users WHERE id = auth.uid()) AND
    (SELECT role FROM users WHERE id = auth.uid()) IN ('superadmin', 'admin')
  );

-- RLS Policies for fee_student_plan_items
CREATE POLICY "Users can view plan items from their school"
  ON fee_student_plan_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM fee_student_plans fsp 
      WHERE fsp.id = fee_student_plan_items.plan_id 
      AND fsp.school_code = (SELECT school_code FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Admins can manage plan items"
  ON fee_student_plan_items FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('superadmin', 'admin') AND
    EXISTS (
      SELECT 1 FROM fee_student_plans fsp 
      WHERE fsp.id = fee_student_plan_items.plan_id 
      AND fsp.school_code = (SELECT school_code FROM users WHERE id = auth.uid())
    )
  );

-- RLS Policies for activity_logs
CREATE POLICY "Users can view activity logs from their school"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (school_code = (SELECT school_code FROM users WHERE id = auth.uid()));

CREATE POLICY "All authenticated users can create activity logs"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for user_profiles
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- RLS Policies for permissions
CREATE POLICY "All authenticated users can view permissions"
  ON permissions FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for role_permissions
CREATE POLICY "Users can view role permissions from their school"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (school_code = (SELECT school_code FROM users WHERE id = auth.uid()));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assessments_school_code ON assessments(school_code);
CREATE INDEX IF NOT EXISTS idx_assessments_class_instance ON assessments(class_instance_id);
CREATE INDEX IF NOT EXISTS idx_assessments_created_by ON assessments(created_by);
CREATE INDEX IF NOT EXISTS idx_assessments_exam_date ON assessments(exam_date);

CREATE INDEX IF NOT EXISTS idx_assessment_results_assessment ON assessment_results(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_results_student ON assessment_results(student_id);
CREATE INDEX IF NOT EXISTS idx_assessment_results_school_code ON assessment_results(school_code);

CREATE INDEX IF NOT EXISTS idx_fee_structures_school_code ON fee_structures(school_code);
CREATE INDEX IF NOT EXISTS idx_fee_structures_class ON fee_structures(class_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_academic_year ON fee_structures(academic_year_id);

CREATE INDEX IF NOT EXISTS idx_fee_payments_student ON fee_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_fee_structure ON fee_payments(fee_structure_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_school_code ON fee_payments(school_code);
CREATE INDEX IF NOT EXISTS idx_fee_payments_status ON fee_payments(status);
CREATE INDEX IF NOT EXISTS idx_fee_payments_due_date ON fee_payments(due_date);

CREATE INDEX IF NOT EXISTS idx_fee_component_types_school_code ON fee_component_types(school_code);
CREATE INDEX IF NOT EXISTS idx_fee_component_types_code ON fee_component_types(code);
CREATE INDEX IF NOT EXISTS idx_fee_student_plans_school_code ON fee_student_plans(school_code);
CREATE INDEX IF NOT EXISTS idx_fee_student_plans_student_id ON fee_student_plans(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_student_plans_class_instance_id ON fee_student_plans(class_instance_id);
CREATE INDEX IF NOT EXISTS idx_fee_student_plan_items_plan_id ON fee_student_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_fee_student_plan_items_component_type_id ON fee_student_plan_items(component_type_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_school_code ON activity_logs(school_code);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_user_profiles_school_code ON user_profiles(school_code);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Insert default permissions
INSERT INTO permissions (name, description, category) VALUES
  ('view_assessments', 'View assessments and results', 'assessments'),
  ('create_assessments', 'Create new assessments', 'assessments'),
  ('edit_assessments', 'Edit existing assessments', 'assessments'),
  ('delete_assessments', 'Delete assessments', 'assessments'),
  ('grade_assessments', 'Grade student assessments', 'assessments'),
  ('view_fees', 'View fee information', 'fees'),
  ('manage_fees', 'Manage fee structures and payments', 'fees'),
  ('process_payments', 'Process fee payments', 'fees'),
  ('view_students', 'View student information', 'students'),
  ('manage_students', 'Add, edit, and manage students', 'students'),
  ('view_attendance', 'View attendance records', 'attendance'),
  ('mark_attendance', 'Mark student attendance', 'attendance'),
  ('view_reports', 'View system reports', 'reports'),
  ('manage_school', 'Manage school settings', 'administration')
ON CONFLICT (name) DO NOTHING;

-- Insert default role permissions
INSERT INTO role_permissions (role, permission_id, school_code) 
SELECT 'superadmin', id, 'ALL' FROM permissions
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id, school_code)
SELECT 'admin', id, 'ALL' FROM permissions 
WHERE category IN ('assessments', 'fees', 'students', 'attendance', 'reports')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id, school_code)
SELECT 'teacher', id, 'ALL' FROM permissions 
WHERE name IN ('view_assessments', 'create_assessments', 'edit_assessments', 'grade_assessments', 'view_students', 'mark_attendance')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id, school_code)
SELECT 'student', id, 'ALL' FROM permissions 
WHERE name IN ('view_assessments', 'view_fees')
ON CONFLICT DO NOTHING;

-- Create function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, full_name, phone, role, school_code)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'role',
    NEW.raw_user_meta_data->>'school_code'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create user profile
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
CREATE TRIGGER create_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile();

-- Create function to log activities
CREATE OR REPLACE FUNCTION log_activity(
  p_action text,
  p_description text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO activity_logs (user_id, action, description, entity_type, entity_id, metadata, school_code)
  VALUES (
    auth.uid(),
    p_action,
    p_description,
    p_entity_type,
    p_entity_id,
    p_metadata,
    (SELECT school_code FROM users WHERE id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;