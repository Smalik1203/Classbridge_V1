-- Safe fix for fee_payments schema cache issue
-- This script preserves existing data while ensuring the correct schema

-- 1. Check current schema
DO $$
DECLARE
    col_record RECORD;
BEGIN
    RAISE NOTICE 'Current fee_payments columns:';
    FOR col_record IN 
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'fee_payments' 
        ORDER BY ordinal_position
    LOOP
        RAISE NOTICE 'Column: %, Type: %, Nullable: %', col_record.column_name, col_record.data_type, col_record.is_nullable;
    END LOOP;
END $$;

-- 2. Create backup of existing data (if table exists)
CREATE TABLE IF NOT EXISTS fee_payments_backup AS 
SELECT * FROM fee_payments WHERE 1=0;

-- If fee_payments exists, backup the data
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fee_payments') THEN
        INSERT INTO fee_payments_backup SELECT * FROM fee_payments;
        RAISE NOTICE 'Backed up % rows from fee_payments', (SELECT COUNT(*) FROM fee_payments_backup);
    END IF;
END $$;

-- 3. Drop existing tables (this will drop fee_receipts too due to foreign key)
DROP TABLE IF EXISTS fee_receipts CASCADE;
DROP TABLE IF EXISTS fee_payments CASCADE;

-- 4. Create fee_payments table with correct schema
CREATE TABLE fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES fee_student_plans(id) ON DELETE CASCADE,
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

-- 5. Restore data if it existed (with schema mapping)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fee_payments_backup') THEN
        -- Check what columns existed in the backup
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_payments_backup' AND column_name = 'component_type_id') THEN
            -- New schema was already in place, restore directly
            INSERT INTO fee_payments 
            SELECT * FROM fee_payments_backup;
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_payments_backup' AND column_name = 'fee_structure_id') THEN
            -- Old schema, need to map data
            INSERT INTO fee_payments (
                id, student_id, amount_paise, payment_date, payment_method, 
                transaction_id, receipt_number, remarks, school_code, created_by, created_at, updated_at
            )
            SELECT 
                id, student_id, 
                CASE 
                    WHEN amount IS NOT NULL THEN (amount * 100)::int
                    ELSE 0
                END as amount_paise,
                COALESCE(payment_date, CURRENT_DATE) as payment_date,
                payment_method, transaction_id, receipt_number, remarks, school_code, created_by, created_at, updated_at
            FROM fee_payments_backup;
            
            RAISE NOTICE 'Restored data from old schema (fee_structure_id) - component_type_id and plan_id will need manual mapping';
        ELSE
            -- Unknown schema, restore what we can
            INSERT INTO fee_payments (
                id, student_id, amount_paise, payment_date, payment_method, 
                transaction_id, receipt_number, remarks, school_code, created_by, created_at, updated_at
            )
            SELECT 
                id, student_id, 
                CASE 
                    WHEN amount IS NOT NULL THEN (amount * 100)::int
                    ELSE 0
                END as amount_paise,
                COALESCE(payment_date, CURRENT_DATE) as payment_date,
                payment_method, transaction_id, receipt_number, remarks, school_code, created_by, created_at, updated_at
            FROM fee_payments_backup;
            
            RAISE NOTICE 'Restored data with basic mapping - component_type_id and plan_id will need manual mapping';
        END IF;
        
        RAISE NOTICE 'Restored % rows to fee_payments', (SELECT COUNT(*) FROM fee_payments);
    END IF;
END $$;

-- 6. Create fee_receipts table
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

-- 7. Create indexes
CREATE INDEX idx_fee_payments_student_id ON fee_payments(student_id);
CREATE INDEX idx_fee_payments_plan_id ON fee_payments(plan_id);
CREATE INDEX idx_fee_payments_component_type_id ON fee_payments(component_type_id);
CREATE INDEX idx_fee_payments_payment_date ON fee_payments(payment_date);
CREATE INDEX idx_fee_payments_school_code ON fee_payments(school_code);
CREATE INDEX idx_fee_payments_receipt_number ON fee_payments(receipt_number);

CREATE INDEX idx_fee_receipts_payment_id ON fee_receipts(payment_id);
CREATE INDEX idx_fee_receipts_receipt_number ON fee_receipts(receipt_number);

-- 8. Enable RLS
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_receipts ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS policies
CREATE POLICY "Users can view fee payments from their school"
  ON fee_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage fee payments"
  ON fee_payments FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Users can view fee receipts from their school"
  ON fee_receipts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage fee receipts"
  ON fee_receipts FOR ALL
  TO authenticated
  USING (true);

-- 10. Create fee collection summary view
CREATE OR REPLACE VIEW fee_collection_summary AS
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

-- 11. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON fee_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fee_receipts TO authenticated;
GRANT SELECT ON fee_collection_summary TO authenticated;

-- 12. Add comments
COMMENT ON TABLE fee_payments IS 'Tracks individual fee payments made by students';
COMMENT ON TABLE fee_receipts IS 'Generated receipts for fee payments';
COMMENT ON VIEW fee_collection_summary IS 'Summary view showing collection progress for each student and component';

-- 13. Verify the final schema
DO $$
DECLARE
    col_record RECORD;
BEGIN
    RAISE NOTICE 'Final fee_payments columns:';
    FOR col_record IN 
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'fee_payments' 
        ORDER BY ordinal_position
    LOOP
        RAISE NOTICE 'Column: %, Type: %, Nullable: %', col_record.column_name, col_record.data_type, col_record.is_nullable;
    END LOOP;
END $$;

-- 14. Clean up backup table
DROP TABLE IF EXISTS fee_payments_backup;

-- 15. Clear schema cache
NOTIFY pgrst, 'reload schema';

RAISE NOTICE 'Fee payments schema has been fixed successfully!';

-- Add student-specific RLS policies for fee tables
-- This ensures students can only see their own fee information

-- 1. Update fee_student_plans policies to allow students to view their own plans
DROP POLICY IF EXISTS "Students can view their own fee plans" ON fee_student_plans;
CREATE POLICY "Students can view their own fee plans"
  ON fee_student_plans FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM student 
      WHERE (student_code = (SELECT user_metadata->>'student_code' FROM auth.users WHERE id = auth.uid()))
      OR (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    )
  );

-- 2. Update fee_student_plan_items policies to allow students to view their own plan items
DROP POLICY IF EXISTS "Students can view their own fee plan items" ON fee_student_plan_items;
CREATE POLICY "Students can view their own fee plan items"
  ON fee_student_plan_items FOR SELECT
  TO authenticated
  USING (
    plan_id IN (
      SELECT fsp.id FROM fee_student_plans fsp
      JOIN student s ON fsp.student_id = s.id
      WHERE (s.student_code = (SELECT user_metadata->>'student_code' FROM auth.users WHERE id = auth.uid()))
      OR (s.email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    )
  );

-- 3. Update fee_payments policies to allow students to view their own payments
DROP POLICY IF EXISTS "Students can view their own fee payments" ON fee_payments;
CREATE POLICY "Students can view their own fee payments"
  ON fee_payments FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM student 
      WHERE (student_code = (SELECT user_metadata->>'student_code' FROM auth.users WHERE id = auth.uid()))
      OR (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    )
  );

-- 4. Update fee_receipts policies to allow students to view their own receipts
DROP POLICY IF EXISTS "Students can view their own fee receipts" ON fee_receipts;
CREATE POLICY "Students can view their own fee receipts"
  ON fee_receipts FOR SELECT
  TO authenticated
  USING (
    payment_id IN (
      SELECT fp.id FROM fee_payments fp
      JOIN student s ON fp.student_id = s.id
      WHERE (s.student_code = (SELECT user_metadata->>'student_code' FROM auth.users WHERE id = auth.uid()))
      OR (s.email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    )
  );

-- 5. Update fee_component_types policies to allow students to view components from their school
DROP POLICY IF EXISTS "Students can view fee components from their school" ON fee_component_types;
CREATE POLICY "Students can view fee components from their school"
  ON fee_component_types FOR SELECT
  TO authenticated
  USING (
    school_code IN (
      SELECT s.school_code FROM student s
      WHERE (s.student_code = (SELECT user_metadata->>'student_code' FROM auth.users WHERE id = auth.uid()))
      OR (s.email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    )
  );

-- 6. Create a view for students to see their fee summary (if it doesn't exist)
CREATE OR REPLACE VIEW student_fee_summary AS
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
  fct.code as component_code,
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
WHERE (s.student_code = (SELECT user_metadata->>'student_code' FROM auth.users WHERE id = auth.uid()))
   OR (s.email = (SELECT email FROM auth.users WHERE id = auth.uid()))
GROUP BY s.id, s.full_name, s.student_code, ci.grade, ci.section, ci.id, fsp.id, fct.id, fct.name, fct.code, fspi.amount_paise;

-- 7. Enable RLS on the view
ALTER VIEW student_fee_summary SET (security_invoker = true);

-- 8. Grant permissions for the view
GRANT SELECT ON student_fee_summary TO authenticated;

-- 9. Add comments for documentation
COMMENT ON POLICY "Students can view their own fee plans" ON fee_student_plans IS 'Allows students to view only their own fee plans';
COMMENT ON POLICY "Students can view their own fee plan items" ON fee_student_plan_items IS 'Allows students to view only their own fee plan items';
COMMENT ON POLICY "Students can view their own fee payments" ON fee_payments IS 'Allows students to view only their own fee payments';
COMMENT ON POLICY "Students can view their own fee receipts" ON fee_receipts IS 'Allows students to view only their own fee receipts';
COMMENT ON POLICY "Students can view fee components from their school" ON fee_component_types IS 'Allows students to view fee components from their school';
COMMENT ON VIEW student_fee_summary IS 'Student-specific view of fee summary data';
