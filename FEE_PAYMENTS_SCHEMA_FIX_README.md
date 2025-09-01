# Fee Payments Schema Cache Issue - Fix Guide

## Problem Description

You're encountering the error:
```
Could not find the 'component_type_id' column of 'fee_payments' in the schema cache
```

This error occurs when the database schema is out of sync with what the application expects. The `fee_payments` table is missing the `component_type_id` column that the Fee Collections feature requires.

## Root Cause

The issue stems from multiple migration scripts that created different versions of the `fee_payments` table:

1. **Original schema** (`20250803162043_odd_cherry.sql`): Had `fee_structure_id` but no `component_type_id`
2. **New schema** (`20250101000000_fee_collections.sql`): Has `component_type_id` and `plan_id`
3. **Alignment migration** (`20250820141000_fee_payments_align.sql`): Tries to add missing columns

The migrations may not have been applied in the correct order, or there's a schema cache issue.

## Solution Files

I've created three SQL scripts to help you fix this issue:

### 1. `diagnose_fee_payments_schema.sql`
**Purpose**: Diagnostic script to understand the current state of your database
**When to use**: First, to understand what's wrong
**What it does**: 
- Checks if the `fee_payments` table exists
- Shows current schema
- Identifies missing columns
- Provides recommendations

### 2. `safe_fix_fee_payments_schema.sql`
**Purpose**: Safe migration that preserves existing data
**When to use**: If you have existing fee payment data you want to keep
**What it does**:
- Backs up existing data
- Recreates the table with correct schema
- Restores data with proper mapping
- Handles both old and new schema formats

### 3. `fix_fee_payments_schema.sql`
**Purpose**: Clean slate approach
**When to use**: If you don't have important existing data or want a fresh start
**What it does**:
- Drops and recreates the table with correct schema
- No data preservation (clean slate)

## Step-by-Step Fix Process

### Step 1: Diagnose the Issue
1. Open your Supabase SQL Editor
2. Run the `diagnose_fee_payments_schema.sql` script
3. Review the output to understand what's missing

### Step 2: Choose Your Fix Approach

**Option A: Safe Fix (Recommended)**
```sql
-- Run this if you have existing data to preserve
-- Copy and paste the contents of safe_fix_fee_payments_schema.sql
```

**Option B: Clean Slate Fix**
```sql
-- Run this if you don't have important existing data
-- Copy and paste the contents of fix_fee_payments_schema.sql
```

### Step 3: Verify the Fix
After running the fix script, run the diagnostic script again to confirm:
- All required columns exist
- Foreign key constraints are in place
- RLS policies are configured

### Step 4: Clear Application Cache
1. Clear your browser cache
2. Restart your application
3. Try recording a fee payment again

## Required Schema

The correct `fee_payments` table should have these columns:

```sql
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
```

## Key Columns Explained

- **`component_type_id`**: Links to `fee_component_types` table (e.g., "Tuition Fee", "Transport Fee")
- **`plan_id`**: Links to `fee_student_plans` table (optional, for plan-based payments)
- **`amount_paise`**: Payment amount in paise (1 rupee = 100 paise) for precision
- **`student_id`**: Links to the student making the payment
- **`school_code`**: For multi-tenant isolation

## Dependencies

The `fee_payments` table depends on these tables:
- `student` (for student_id foreign key)
- `fee_component_types` (for component_type_id foreign key)
- `fee_student_plans` (for plan_id foreign key)
- `auth.users` (for created_by foreign key)

## Troubleshooting

### If the fix doesn't work:

1. **Check Supabase logs**: Look for any SQL errors in the Supabase dashboard
2. **Verify table creation**: Run `SELECT * FROM information_schema.tables WHERE table_name = 'fee_payments';`
3. **Check column existence**: Run `SELECT column_name FROM information_schema.columns WHERE table_name = 'fee_payments';`
4. **Clear schema cache**: The scripts include `NOTIFY pgrst, 'reload schema';` to clear cache

### Common Issues:

1. **Foreign key constraint errors**: Ensure `fee_component_types` and `fee_student_plans` tables exist
2. **Permission errors**: Make sure you have the right permissions in Supabase
3. **RLS policy issues**: The scripts create permissive policies for testing

## Prevention

To prevent this issue in the future:

1. **Use proper migration ordering**: Ensure migrations run in chronological order
2. **Test migrations**: Always test migrations in a development environment first
3. **Version control**: Keep your migration scripts in version control
4. **Backup data**: Always backup important data before running schema changes

## Support

If you continue to have issues after following this guide:

1. Run the diagnostic script and share the output
2. Check the Supabase logs for specific error messages
3. Verify that all dependent tables exist and have the correct schema
4. Ensure your Supabase client is properly configured

## Files Created

- `diagnose_fee_payments_schema.sql` - Diagnostic script
- `safe_fix_fee_payments_schema.sql` - Safe migration with data preservation
- `fix_fee_payments_schema.sql` - Clean slate migration
- `FEE_PAYMENTS_SCHEMA_FIX_README.md` - This guide
