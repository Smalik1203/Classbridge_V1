-- Fee Collections Migration Script
-- Run this in your Supabase SQL Editor

-- Fee payments table (tracks individual payments)
CREATE TABLE IF NOT EXISTS fee_payments (
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
CREATE TABLE IF NOT EXISTS fee_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES fee_payments(id) ON DELETE CASCADE,
  receipt_number text UNIQUE NOT NULL,
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  student_name text NOT NULL,
  student_code text NOT NULL,
  class_name text NOT NULL,
  component_name text NOT NULL,
  amount_paise integer NOT NULL,
  amount_inr text NOT NULL, -- Formatted amount for receipt
  payment_method text NOT NULL,
  collected_by text NOT NULL,
  school_code text NOT NULL,
  created_at timestamptz DEFAULT now()
);



-- Enable RLS on fee collections tables
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_receipts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fee_payments
CREATE POLICY "Users can view fee payments from their school"
  ON fee_payments FOR SELECT
  TO authenticated
  USING (
    school_code = (
      SELECT school_code 
      FROM users 
      WHERE id = auth.uid() 
      AND school_code IS NOT NULL
    )
  );

CREATE POLICY "Admins can manage fee payments"
  ON fee_payments FOR ALL
  TO authenticated
  USING (
    school_code = (
      SELECT school_code 
      FROM users 
      WHERE id = auth.uid() 
      AND school_code IS NOT NULL
    ) AND
    (SELECT role FROM users WHERE id = auth.uid()) IN ('superadmin', 'admin')
  );

-- RLS Policies for fee_receipts
CREATE POLICY "Users can view fee receipts from their school"
  ON fee_receipts FOR SELECT
  TO authenticated
  USING (
    school_code = (
      SELECT school_code 
      FROM users 
      WHERE id = auth.uid() 
      AND school_code IS NOT NULL
    )
  );

CREATE POLICY "Admins can manage fee receipts"
  ON fee_receipts FOR ALL
  TO authenticated
  USING (
    school_code = (
      SELECT school_code 
      FROM users 
      WHERE id = auth.uid() 
      AND school_code IS NOT NULL
    ) AND
    (SELECT role FROM users WHERE id = auth.uid()) IN ('superadmin', 'admin')
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_fee_payments_student_id ON fee_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_component_type_id ON fee_payments(component_type_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_payment_date ON fee_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_fee_payments_school_code ON fee_payments(school_code);
CREATE INDEX IF NOT EXISTS idx_fee_payments_receipt_number ON fee_payments(receipt_number);

CREATE INDEX IF NOT EXISTS idx_fee_receipts_payment_id ON fee_receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_fee_receipts_receipt_number ON fee_receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_fee_receipts_school_code ON fee_receipts(school_code);

-- Fee collection summary view (for reporting)
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
WHERE s.school_code = (
  SELECT school_code 
  FROM users 
  WHERE id = auth.uid() 
  AND school_code IS NOT NULL
)
GROUP BY s.id, s.full_name, s.student_code, ci.grade, ci.section, ci.id, fsp.id, fct.id, fct.name, fspi.amount_paise;

-- Function to generate receipt number
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS text AS $$
DECLARE
  receipt_num text;
  school_code text;
  year text;
BEGIN
  -- Get school code and current year
  SELECT school_code INTO school_code FROM users WHERE id = auth.uid() AND school_code IS NOT NULL;
  
  -- Check if user has a school code
  IF school_code IS NULL THEN
    RAISE EXCEPTION 'User does not have a school code assigned';
  END IF;
  
  year := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  
  -- Generate receipt number: SCHOOLCODE/YEAR/SEQUENCE
  SELECT 
    school_code || '/' || year || '/' || 
    LPAD(COALESCE(MAX(SUBSTRING(receipt_number FROM '[0-9]+$')::integer), 0) + 1::text, 6, '0')
  INTO receipt_num
  FROM fee_receipts 
  WHERE receipt_number LIKE school_code || '/' || year || '/%';
  
  -- If no existing receipts for this year, start with 000001
  IF receipt_num IS NULL THEN
    receipt_num := school_code || '/' || year || '/000001';
  END IF;
  
  RETURN receipt_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create receipt when payment is inserted
CREATE OR REPLACE FUNCTION create_fee_receipt()
RETURNS TRIGGER AS $$
DECLARE
  student_rec RECORD;
  class_rec RECORD;
  component_rec RECORD;
  user_rec RECORD;
BEGIN
  -- Get student information
  SELECT s.full_name, s.student_code, ci.grade, ci.section
  INTO student_rec
  FROM student s
  JOIN class_instances ci ON s.class_instance_id = ci.id
  WHERE s.id = NEW.student_id;
  
  -- Get component information
  SELECT name INTO component_rec
  FROM fee_component_types
  WHERE id = NEW.component_type_id;
  
  -- Get user information
  SELECT full_name INTO user_rec
  FROM users
  WHERE id = NEW.created_by;
  
  -- Create receipt
  INSERT INTO fee_receipts (
    payment_id,
    receipt_number,
    receipt_date,
    student_name,
    student_code,
    class_name,
    component_name,
    amount_paise,
    amount_inr,
    payment_method,
    collected_by,
    school_code
  ) VALUES (
    NEW.id,
    generate_receipt_number(),
    NEW.payment_date,
    student_rec.full_name,
    student_rec.student_code,
    'Grade ' || student_rec.grade || ' - ' || student_rec.section,
    component_rec.name,
    NEW.amount_paise,
    (NEW.amount_paise / 100.0)::text,
    NEW.payment_method,
    user_rec.full_name,
    NEW.school_code
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create receipt when payment is inserted
DROP TRIGGER IF EXISTS trigger_create_fee_receipt ON fee_payments;
CREATE TRIGGER trigger_create_fee_receipt
  AFTER INSERT ON fee_payments
  FOR EACH ROW
  EXECUTE FUNCTION create_fee_receipt();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON fee_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fee_receipts TO authenticated;
GRANT SELECT ON fee_collection_summary TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE fee_payments IS 'Tracks individual fee payments made by students';
COMMENT ON TABLE fee_receipts IS 'Generated receipts for fee payments';
COMMENT ON VIEW fee_collection_summary IS 'Summary view showing collection progress for each student and component';
COMMENT ON FUNCTION generate_receipt_number IS 'Generates unique receipt numbers in format SCHOOLCODE/YEAR/SEQUENCE';
COMMENT ON FUNCTION create_fee_receipt IS 'Automatically creates receipt when payment is inserted';

-- Optional: Add constraint to ensure users have school codes (uncomment if needed)
-- ALTER TABLE users ADD CONSTRAINT users_school_code_not_null CHECK (school_code IS NOT NULL);

-- Success message
SELECT 'Fee Collections migration completed successfully!' as status;
