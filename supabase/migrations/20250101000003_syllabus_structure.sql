-- Migration: Syllabus Structure Management
-- Creates hierarchical syllabus structure with chapters and topics
-- No progress tracking - that's handled in Timetable

-- Drop existing syllabus tables if they exist (clean slate)
DROP TABLE IF EXISTS syllabus_items CASCADE;
DROP TABLE IF EXISTS syllabi CASCADE;

-- Create syllabi table (parent)
CREATE TABLE syllabi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_code text NOT NULL,
  class_instance_id uuid NOT NULL REFERENCES class_instances(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure one syllabus per class-subject pair
  UNIQUE(class_instance_id, subject_id)
);

-- Create syllabus_chapters table
CREATE TABLE syllabus_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syllabus_id uuid NOT NULL REFERENCES syllabi(id) ON DELETE CASCADE,
  chapter_no integer NOT NULL CHECK (chapter_no > 0),
  title text NOT NULL CHECK (length(title) <= 200),
  description text,
  ref_code text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure unique chapter numbers within a syllabus
  UNIQUE(syllabus_id, chapter_no)
);

-- Create syllabus_topics table
CREATE TABLE syllabus_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES syllabus_chapters(id) ON DELETE CASCADE,
  topic_no integer NOT NULL CHECK (topic_no > 0),
  title text NOT NULL CHECK (length(title) <= 200),
  description text,
  ref_code text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure unique topic numbers within a chapter
  UNIQUE(chapter_id, topic_no)
);

-- Indexes for performance
CREATE INDEX idx_syllabi_school_code ON syllabi(school_code);
CREATE INDEX idx_syllabi_class_subject ON syllabi(class_instance_id, subject_id);
CREATE INDEX idx_syllabus_chapters_syllabus_no ON syllabus_chapters(syllabus_id, chapter_no);
CREATE INDEX idx_syllabus_topics_chapter_no ON syllabus_topics(chapter_id, topic_no);

-- RLS Policies
ALTER TABLE syllabi ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_topics ENABLE ROW LEVEL SECURITY;

-- RLS: Read access for all authenticated users in same school
CREATE POLICY "Users can read syllabi of their school" ON syllabi
  FOR SELECT USING (
    school_code = (SELECT school_code FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can read chapters of their school" ON syllabus_chapters
  FOR SELECT USING (
    syllabus_id IN (
      SELECT id FROM syllabi 
      WHERE school_code = (SELECT school_code FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can read topics of their school" ON syllabus_topics
  FOR SELECT USING (
    chapter_id IN (
      SELECT sc.id FROM syllabus_chapters sc
      JOIN syllabi s ON sc.syllabus_id = s.id
      WHERE s.school_code = (SELECT school_code FROM users WHERE id = auth.uid())
    )
  );

-- RLS: Write access only for admin/superadmin
CREATE POLICY "Admins can manage syllabi" ON syllabi
  FOR ALL USING (
    school_code = (SELECT school_code FROM users WHERE id = auth.uid()) AND
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'superadmin')
  );

CREATE POLICY "Admins can manage chapters" ON syllabus_chapters
  FOR ALL USING (
    syllabus_id IN (
      SELECT id FROM syllabi 
      WHERE school_code = (SELECT school_code FROM users WHERE id = auth.uid())
    ) AND
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'superadmin')
  );

CREATE POLICY "Admins can manage topics" ON syllabus_topics
  FOR ALL USING (
    chapter_id IN (
      SELECT sc.id FROM syllabus_chapters sc
      JOIN syllabi s ON sc.syllabus_id = s.id
      WHERE s.school_code = (SELECT school_code FROM users WHERE id = auth.uid())
    ) AND
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'superadmin')
  );

-- Helper function to get syllabus tree (for API)
CREATE OR REPLACE FUNCTION get_syllabus_tree(p_class_instance_id uuid, p_subject_id uuid)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'syllabus_id', s.id,
    'chapters', COALESCE(
      json_agg(
        json_build_object(
          'id', sc.id,
          'chapter_no', sc.chapter_no,
          'title', sc.title,
          'description', sc.description,
          'ref_code', sc.ref_code,
          'topics', COALESCE(
            (SELECT json_agg(
              json_build_object(
                'id', st.id,
                'topic_no', st.topic_no,
                'title', st.title,
                'description', st.description,
                'ref_code', st.ref_code
              ) ORDER BY st.topic_no
            ) FROM syllabus_topics st WHERE st.chapter_id = sc.id),
            '[]'::json
          )
        ) ORDER BY sc.chapter_no
      ),
      '[]'::json
    )
  ) INTO result
  FROM syllabi s
  LEFT JOIN syllabus_chapters sc ON s.id = sc.syllabus_id
  WHERE s.class_instance_id = p_class_instance_id 
    AND s.subject_id = p_subject_id
    AND s.school_code = (SELECT school_code FROM users WHERE id = auth.uid());
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to reorder chapters
CREATE OR REPLACE FUNCTION reorder_chapters(p_syllabus_id uuid, p_ordered_ids uuid[])
RETURNS void AS $$
DECLARE
  i integer;
  chapter_id uuid;
BEGIN
  -- Validate syllabus belongs to user's school
  IF NOT EXISTS (
    SELECT 1 FROM syllabi 
    WHERE id = p_syllabus_id 
    AND school_code = (SELECT school_code FROM users WHERE id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Syllabus not found or access denied';
  END IF;
  
  -- Update chapter numbers
  FOR i IN 1..array_length(p_ordered_ids, 1) LOOP
    chapter_id := p_ordered_ids[i];
    UPDATE syllabus_chapters 
    SET chapter_no = i, updated_at = now()
    WHERE id = chapter_id AND syllabus_id = p_syllabus_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to reorder topics
CREATE OR REPLACE FUNCTION reorder_topics(p_chapter_id uuid, p_ordered_ids uuid[])
RETURNS void AS $$
DECLARE
  i integer;
  topic_id uuid;
BEGIN
  -- Validate chapter belongs to user's school
  IF NOT EXISTS (
    SELECT 1 FROM syllabus_chapters sc
    JOIN syllabi s ON sc.syllabus_id = s.id
    WHERE sc.id = p_chapter_id 
    AND s.school_code = (SELECT school_code FROM users WHERE id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Chapter not found or access denied';
  END IF;
  
  -- Update topic numbers
  FOR i IN 1..array_length(p_ordered_ids, 1) LOOP
    topic_id := p_ordered_ids[i];
    UPDATE syllabus_topics 
    SET topic_no = i, updated_at = now()
    WHERE id = topic_id AND chapter_id = p_chapter_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to resolve syllabus item names
CREATE OR REPLACE FUNCTION resolve_syllabus_item(p_item_id uuid, p_item_type text)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  IF p_item_type = 'chapter' THEN
    SELECT json_build_object(
      'chapter_id', sc.id,
      'chapter_no', sc.chapter_no,
      'chapter_title', sc.title,
      'topic_id', null,
      'topic_no', null,
      'topic_title', null,
      'path', 'Ch ' || sc.chapter_no || ' • ' || sc.title
    ) INTO result
    FROM syllabus_chapters sc
    JOIN syllabi s ON sc.syllabus_id = s.id
    WHERE sc.id = p_item_id 
    AND s.school_code = (SELECT school_code FROM users WHERE id = auth.uid());
  ELSIF p_item_type = 'topic' THEN
    SELECT json_build_object(
      'chapter_id', sc.id,
      'chapter_no', sc.chapter_no,
      'chapter_title', sc.title,
      'topic_id', st.id,
      'topic_no', st.topic_no,
      'topic_title', st.title,
      'path', 'Ch ' || sc.chapter_no || ' • ' || sc.title || ' → T' || st.topic_no || ' • ' || st.title
    ) INTO result
    FROM syllabus_topics st
    JOIN syllabus_chapters sc ON st.chapter_id = sc.id
    JOIN syllabi s ON sc.syllabus_id = s.id
    WHERE st.id = p_item_id 
    AND s.school_code = (SELECT school_code FROM users WHERE id = auth.uid());
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
