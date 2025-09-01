-- Student Fee Access Policies
-- This script adds Row Level Security policies to ensure students can only see their own fee information
-- Run this in your Supabase SQL Editor

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

-- 6. Create a view for students to see their fee summary
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

-- 10. Verify the policies are working
DO $$
BEGIN
  RAISE NOTICE 'Student fee access policies have been applied successfully!';
  RAISE NOTICE 'Students can now only view their own fee information.';
END $$;
