-- Migration: Add syllabus structure support to timetable
-- Adds columns for syllabus_chapter_id and syllabus_topic_id to timetable_slots

-- Add new columns to timetable_slots table
ALTER TABLE timetable_slots 
ADD COLUMN IF NOT EXISTS syllabus_chapter_id uuid REFERENCES syllabus_chapters(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS syllabus_topic_id uuid REFERENCES syllabus_topics(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_timetable_slots_syllabus_chapter_id ON timetable_slots(syllabus_chapter_id);
CREATE INDEX IF NOT EXISTS idx_timetable_slots_syllabus_topic_id ON timetable_slots(syllabus_topic_id);

-- Add comments for documentation
COMMENT ON COLUMN timetable_slots.syllabus_chapter_id IS 'References syllabus_chapters.id for new hierarchical syllabus structure';
COMMENT ON COLUMN timetable_slots.syllabus_topic_id IS 'References syllabus_topics.id for new hierarchical syllabus structure';

-- Update RLS policies to include new columns
-- The existing policies should already cover these columns since they're part of the same table
-- But let's ensure they're properly documented

-- Create a view to help with syllabus content resolution
CREATE OR REPLACE VIEW v_timetable_syllabus_content AS
SELECT 
  ts.id,
  ts.class_instance_id,
  ts.class_date,
  ts.period_number,
  ts.subject_id,
  ts.syllabus_item_id,
  ts.syllabus_chapter_id,
  ts.syllabus_topic_id,
  -- Old structure content
  CASE 
    WHEN ts.syllabus_item_id IS NOT NULL THEN 
      CONCAT('Chapter ', si.unit_no, ': ', si.title)
    ELSE NULL
  END as old_structure_content,
  -- New structure content
  CASE 
    WHEN ts.syllabus_topic_id IS NOT NULL THEN 
      CONCAT('Chapter ', sc.chapter_no, ': ', sc.title, ' → Topic ', st.topic_no, ': ', st.title)
    WHEN ts.syllabus_chapter_id IS NOT NULL THEN 
      CONCAT('Chapter ', sc.chapter_no, ': ', sc.title)
    ELSE NULL
  END as new_structure_content,
  -- Combined display content
  CASE 
    WHEN ts.syllabus_topic_id IS NOT NULL THEN 
      CONCAT('Chapter ', sc.chapter_no, ': ', sc.title, ' → Topic ', st.topic_no, ': ', st.title)
    WHEN ts.syllabus_chapter_id IS NOT NULL THEN 
      CONCAT('Chapter ', sc.chapter_no, ': ', sc.title)
    WHEN ts.syllabus_item_id IS NOT NULL THEN 
      CONCAT('Chapter ', si.unit_no, ': ', si.title)
    ELSE NULL
  END as display_content
FROM timetable_slots ts
LEFT JOIN syllabus_items si ON ts.syllabus_item_id = si.id
LEFT JOIN syllabus_chapters sc ON ts.syllabus_chapter_id = sc.id
LEFT JOIN syllabus_topics st ON ts.syllabus_topic_id = st.id;

-- Grant access to the view
GRANT SELECT ON v_timetable_syllabus_content TO authenticated;
