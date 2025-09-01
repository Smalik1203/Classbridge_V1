-- Align fee_payments schema with application expectations
-- Safely add missing columns and constraints without breaking existing data

-- 1) Add columns if missing
ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS plan_id uuid;
ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS component_type_id uuid;
ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS amount_paise integer;
ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS transaction_id text;
ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS receipt_number text;
ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS remarks text;
ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS school_code text;
ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS payment_date date;

-- 2) Backfill amount_paise from decimal amount, when present
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fee_payments' AND column_name = 'amount'
  ) THEN
    UPDATE fee_payments SET amount_paise = COALESCE(amount_paise, (amount * 100)::int);
  END IF;
END $$;

-- 3) Create indexes if missing
CREATE INDEX IF NOT EXISTS idx_fee_payments_plan_id ON fee_payments(plan_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_component_type_id ON fee_payments(component_type_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_payment_date ON fee_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_fee_payments_school_code2 ON fee_payments(school_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_payments_receipt_number_unique ON fee_payments(receipt_number);

-- 4) Add foreign keys if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_fee_payments_plan'
  ) THEN
    ALTER TABLE fee_payments
      ADD CONSTRAINT fk_fee_payments_plan
      FOREIGN KEY (plan_id) REFERENCES fee_student_plans(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_fee_payments_component_type'
  ) THEN
    ALTER TABLE fee_payments
      ADD CONSTRAINT fk_fee_payments_component_type
      FOREIGN KEY (component_type_id) REFERENCES fee_component_types(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_fee_payments_created_by'
  ) THEN
    ALTER TABLE fee_payments
      ADD CONSTRAINT fk_fee_payments_created_by
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5) Optional: ensure payment_method matches allowed values when present
-- Skip adding CHECK to avoid breaking existing data; enforce in app/UI


