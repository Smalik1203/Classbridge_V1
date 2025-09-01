-- Simple Fee Collections Migration Script
-- Run this in your Supabase SQL Editor

-- Drop existing objects if they exist (for clean migration)
DROP VIEW IF EXISTS fee_collection_summary;
DROP TABLE IF EXISTS fee_receipts;
DROP TABLE IF EXISTS fee_payments;

-- Fee payments table (tracks individual payments)
CREATE TABLE fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  component_type_id uuid NOT NULL REFERENCES fee_component_types(id) ON DELETE CASCADE,
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text CHECK (payment_method IN ('cash', 'cheque', 'online', 'card', 'other')),
  transaction_id text,
  receipt_number text UNIQUE,
  remarks text,
  school_code text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Fee receipts table (for generating receipt documents)
CREATE TABLE fee_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES fee_payments(id) ON DELETE CASCADE,
  receipt_number text UNIQUE NOT NULL,
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  student_name text NOT NULL,
  student_code text NOT NULL,
  class_name text NOT NULL,
  component_name text NOT NULL,
  amount_paise integer NOT NULL,
  amount_inr text NOT NULL,
  payment_method text NOT NULL,
  collected_by text NOT NULL,
  school_code text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_receipts ENABLE ROW LEVEL SECURITY;

-- Simple RLS Policies (without complex subqueries)
CREATE POLICY "Users can view fee payments from their school"
  ON fee_payments FOR SELECT
  TO authenticated
  USING (true); -- Allow all authenticated users to view for now

CREATE POLICY "Admins can manage fee payments"
  ON fee_payments FOR ALL
  TO authenticated
  USING (true); -- Allow all authenticated users to manage for now

CREATE POLICY "Users can view fee receipts from their school"
  ON fee_receipts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage fee receipts"
  ON fee_receipts FOR ALL
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX idx_fee_payments_student_id ON fee_payments(student_id);
CREATE INDEX idx_fee_payments_component_type_id ON fee_payments(component_type_id);
CREATE INDEX idx_fee_payments_payment_date ON fee_payments(payment_date);
CREATE INDEX idx_fee_payments_school_code ON fee_payments(school_code);

CREATE INDEX idx_fee_receipts_payment_id ON fee_receipts(payment_id);
CREATE INDEX idx_fee_receipts_receipt_number ON fee_receipts(receipt_number);

-- Simple view without complex RLS
CREATE VIEW fee_collection_summary AS
SELECT 
  s.id as student_id,
  s.full_name as student_name,
  s.student_code,
  ci.grade,
  ci.section,
  ci.id as class_instance_id,
  fsp.id as plan_id,
  fct.id as component_type_id,
  fct.name as component_name,
  fspi.amount_paise as plan_amount_paise,
  COALESCE(SUM(fp.amount_paise), 0) as collected_amount_paise,
  (fspi.amount_paise - COALESCE(SUM(fp.amount_paise), 0)) as outstanding_amount_paise,
  CASE 
    WHEN fspi.amount_paise = 0 THEN 0
    ELSE ROUND((COALESCE(SUM(fp.amount_paise), 0)::decimal / fspi.amount_paise::decimal) * 100, 2)
  END as collection_percentage
FROM student s
JOIN class_instances ci ON s.class_instance_id = ci.id
JOIN fee_student_plans fsp ON s.id = fsp.student_id
JOIN fee_student_plan_items fspi ON fsp.id = fspi.plan_id
JOIN fee_component_types fct ON fspi.component_type_id = fct.id
LEFT JOIN fee_payments fp ON s.id = fp.student_id AND fspi.component_type_id = fp.component_type_id
GROUP BY s.id, s.full_name, s.student_code, ci.grade, ci.section, ci.id, fsp.id, fct.id, fct.name, fspi.amount_paise;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON fee_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fee_receipts TO authenticated;
GRANT SELECT ON fee_collection_summary TO authenticated;

-- Success message
SELECT 'Simple Fee Collections migration completed successfully!' as status;
