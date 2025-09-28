-- Create learning_resources table
CREATE TABLE IF NOT EXISTS learning_resources (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    resource_type VARCHAR(50) NOT NULL CHECK (resource_type IN ('video', 'pdf', 'quiz')),
    content_url TEXT NOT NULL,
    file_size BIGINT,
    school_code VARCHAR(50) NOT NULL,
    class_instance_id UUID REFERENCES class_instances(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_learning_resources_school_code ON learning_resources(school_code);
CREATE INDEX IF NOT EXISTS idx_learning_resources_class_instance_id ON learning_resources(class_instance_id);
CREATE INDEX IF NOT EXISTS idx_learning_resources_subject_id ON learning_resources(subject_id);
CREATE INDEX IF NOT EXISTS idx_learning_resources_academic_year_id ON learning_resources(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_learning_resources_resource_type ON learning_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_learning_resources_uploaded_by ON learning_resources(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_learning_resources_created_at ON learning_resources(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE learning_resources ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Policy for superadmins and admins: can do everything for their school
CREATE POLICY "Superadmins and admins can manage resources for their school" ON learning_resources
    FOR ALL
    USING (
        school_code IN (
            SELECT school_code 
            FROM user_school_assignments 
            WHERE user_id = auth.uid() 
            AND role IN ('superadmin', 'admin')
        )
    );

-- Policy for students: can only view resources for their assigned classes
CREATE POLICY "Students can view resources for their classes" ON learning_resources
    FOR SELECT
    USING (
        class_instance_id IN (
            SELECT class_instance_id 
            FROM student_class_assignments 
            WHERE student_id = auth.uid()
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_learning_resources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_learning_resources_updated_at
    BEFORE UPDATE ON learning_resources
    FOR EACH ROW
    EXECUTE FUNCTION update_learning_resources_updated_at();

-- Insert some sample data (optional - remove in production)
INSERT INTO learning_resources (
    title, 
    description, 
    resource_type, 
    content_url, 
    school_code, 
    class_instance_id, 
    subject_id, 
    academic_year_id, 
    uploaded_by
) VALUES 
(
    'Introduction to Algebra',
    'Basic concepts of algebra including variables, equations, and solving for x.',
    'video',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'SCH001',
    (SELECT id FROM class_instances WHERE school_code = 'SCH001' LIMIT 1),
    (SELECT id FROM subjects WHERE name = 'Mathematics' LIMIT 1),
    (SELECT id FROM academic_years WHERE school_code = 'SCH001' LIMIT 1),
    (SELECT id FROM auth.users LIMIT 1)
),
(
    'Physics Fundamentals',
    'Comprehensive guide to basic physics concepts and principles.',
    'pdf',
    'https://example.com/physics-fundamentals.pdf',
    'SCH001',
    (SELECT id FROM class_instances WHERE school_code = 'SCH001' LIMIT 1),
    (SELECT id FROM subjects WHERE name = 'Science' LIMIT 1),
    (SELECT id FROM academic_years WHERE school_code = 'SCH001' LIMIT 1),
    (SELECT id FROM auth.users LIMIT 1)
),
(
    'Math Quiz - Basic Operations',
    'Test your knowledge of basic mathematical operations.',
    'quiz',
    'https://example.com/math-quiz.json',
    'SCH001',
    (SELECT id FROM class_instances WHERE school_code = 'SCH001' LIMIT 1),
    (SELECT id FROM subjects WHERE name = 'Mathematics' LIMIT 1),
    (SELECT id FROM academic_years WHERE school_code = 'SCH001' LIMIT 1),
    (SELECT id FROM auth.users LIMIT 1)
)
ON CONFLICT DO NOTHING;
