-- Diagnostic script for fee_payments schema issues
-- Run this in your Supabase SQL Editor to understand the current state

-- 1. Check if fee_payments table exists
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fee_payments') 
        THEN 'fee_payments table EXISTS'
        ELSE 'fee_payments table DOES NOT EXIST'
    END as table_status;

-- 2. If table exists, show its current schema
DO $$
DECLARE
    col_record RECORD;
    col_count INTEGER := 0;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fee_payments') THEN
        RAISE NOTICE '=== CURRENT fee_payments SCHEMA ===';
        FOR col_record IN 
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'fee_payments' 
            ORDER BY ordinal_position
        LOOP
            col_count := col_count + 1;
            RAISE NOTICE '%: % % (nullable: %, default: %)', 
                col_count, 
                col_record.column_name, 
                col_record.data_type, 
                col_record.is_nullable, 
                COALESCE(col_record.column_default, 'NULL');
        END LOOP;
        RAISE NOTICE 'Total columns: %', col_count;
    ELSE
        RAISE NOTICE 'fee_payments table does not exist';
    END IF;
END $$;

-- 3. Check for specific required columns
SELECT 
    'component_type_id' as required_column,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_payments' AND column_name = 'component_type_id')
        THEN 'EXISTS'
        ELSE 'MISSING'
    END as status
UNION ALL
SELECT 
    'plan_id' as required_column,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_payments' AND column_name = 'plan_id')
        THEN 'EXISTS'
        ELSE 'MISSING'
    END as status
UNION ALL
SELECT 
    'amount_paise' as required_column,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_payments' AND column_name = 'amount_paise')
        THEN 'EXISTS'
        ELSE 'MISSING'
    END as status
UNION ALL
SELECT 
    'student_id' as required_column,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_payments' AND column_name = 'student_id')
        THEN 'EXISTS'
        ELSE 'MISSING'
    END as status;

-- 4. Check for old schema columns that might conflict
SELECT 
    'fee_structure_id' as old_column,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_payments' AND column_name = 'fee_structure_id')
        THEN 'EXISTS (OLD SCHEMA)'
        ELSE 'NOT FOUND'
    END as status
UNION ALL
SELECT 
    'amount' as old_column,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_payments' AND column_name = 'amount')
        THEN 'EXISTS (OLD SCHEMA)'
        ELSE 'NOT FOUND'
    END as status;

-- 5. Check foreign key constraints
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'fee_payments';

-- 6. Check indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'fee_payments';

-- 7. Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'fee_payments';

-- 8. Check if fee_component_types table exists (required for component_type_id FK)
SELECT 
    'fee_component_types' as required_table,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fee_component_types')
        THEN 'EXISTS'
        ELSE 'MISSING - This will cause FK constraint issues'
    END as status;

-- 9. Check if fee_student_plans table exists (required for plan_id FK)
SELECT 
    'fee_student_plans' as required_table,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fee_student_plans')
        THEN 'EXISTS'
        ELSE 'MISSING - This will cause FK constraint issues'
    END as status;

-- 10. Summary and recommendations
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== DIAGNOSIS SUMMARY ===';
    
    -- Check if table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fee_payments') THEN
        RAISE NOTICE '❌ fee_payments table does not exist';
        RAISE NOTICE '💡 SOLUTION: Run the fee collections migration script';
    ELSE
        RAISE NOTICE '✅ fee_payments table exists';
        
        -- Check for required columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_payments' AND column_name = 'component_type_id') THEN
            RAISE NOTICE '❌ component_type_id column is missing';
            RAISE NOTICE '💡 SOLUTION: Run the schema alignment migration';
        ELSE
            RAISE NOTICE '✅ component_type_id column exists';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_payments' AND column_name = 'plan_id') THEN
            RAISE NOTICE '❌ plan_id column is missing';
            RAISE NOTICE '💡 SOLUTION: Run the schema alignment migration';
        ELSE
            RAISE NOTICE '✅ plan_id column exists';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_payments' AND column_name = 'amount_paise') THEN
            RAISE NOTICE '❌ amount_paise column is missing';
            RAISE NOTICE '💡 SOLUTION: Run the schema alignment migration';
        ELSE
            RAISE NOTICE '✅ amount_paise column exists';
        END IF;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== NEXT STEPS ===';
    RAISE NOTICE '1. If table is missing: Run fix_fee_payments_schema.sql';
    RAISE NOTICE '2. If columns are missing: Run safe_fix_fee_payments_schema.sql';
    RAISE NOTICE '3. After fixing: Clear browser cache and restart your application';
END $$;
