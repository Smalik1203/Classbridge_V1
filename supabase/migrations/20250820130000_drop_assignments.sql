-- Rollback migration to remove Assignments feature objects
-- Drops tables, types, triggers, policies, and storage bucket

-- Drop dependent tables first
DROP TABLE IF EXISTS submission_events CASCADE;
DROP TABLE IF EXISTS assignment_comments CASCADE;
DROP TABLE IF EXISTS assignment_submissions CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;

-- Drop helper function if it exists (created by assignments migration)
DO $$ BEGIN
  PERFORM 1 FROM pg_proc WHERE proname = 'set_updated_at';
  IF FOUND THEN
    DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
  END IF;
END $$;

-- Drop custom types if present
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_visibility') THEN
    DROP TYPE assignment_visibility;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'late_policy_type') THEN
    DROP TYPE late_policy_type;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'submission_status') THEN
    DROP TYPE submission_status;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'submission_event_type') THEN
    DROP TYPE submission_event_type;
  END IF;
END $$;

-- Delete storage bucket if present
DELETE FROM storage.buckets WHERE id = 'assignment-submissions';


