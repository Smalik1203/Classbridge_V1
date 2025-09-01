-- ==========================================
-- RESULTS MANAGEMENT SYSTEM DATABASE SCHEMA
-- ==========================================

-- Enable Row Level Security
ALTER TABLE IF EXISTS exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS exam_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS student_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subject_results ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- EXAMS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS exams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_code TEXT NOT NULL,
    class_instance_id UUID NOT NULL REFERENCES class_instances(id),
    exam_name TEXT NOT NULL,
    exam_type TEXT NOT NULL CHECK (exam_type IN ('unit_test', 'monthly_test', 'mid_term', 'final_exam', 'assignment', 'project')),
    exam_date DATE NOT NULL,
    total_marks INTEGER NOT NULL DEFAULT 0,
    passing_marks INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(school_code, class_instance_id, exam_name, exam_date)
);

-- ==========================================
-- EXAM SUBJECTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS exam_subjects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id),
    max_marks INTEGER NOT NULL,
    passing_marks INTEGER NOT NULL,
    weightage DECIMAL(5,2) DEFAULT 1.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(exam_id, subject_id)
);

-- ==========================================
-- STUDENT RESULTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS student_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
    total_obtained_marks INTEGER NOT NULL,
    total_max_marks INTEGER NOT NULL DEFAULT 0,
    percentage DECIMAL(5,2),
    overall_grade TEXT,
    class_rank INTEGER,
    section_rank INTEGER,
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(exam_id, student_id)
);

-- ==========================================
-- SUBJECT RESULTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS subject_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_result_id UUID NOT NULL REFERENCES student_results(id) ON DELETE CASCADE,
    exam_subject_id UUID NOT NULL REFERENCES exam_subjects(id),
    obtained_marks INTEGER NOT NULL,
    max_marks INTEGER NOT NULL,
    percentage DECIMAL(5,2),
    grade TEXT,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_result_id, exam_subject_id)
);

-- ==========================================
-- STUDENT USER LINKS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS student_user_links (
    student_id UUID PRIMARY KEY REFERENCES student(id) ON DELETE CASCADE,
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_exams_school_code ON exams(school_code);
CREATE INDEX IF NOT EXISTS idx_exams_class_instance ON exams(class_instance_id);
CREATE INDEX IF NOT EXISTS idx_exams_date ON exams(exam_date);
CREATE INDEX IF NOT EXISTS idx_exam_subjects_exam_id ON exam_subjects(exam_id);
CREATE INDEX IF NOT EXISTS idx_student_results_exam_id ON student_results(exam_id);
CREATE INDEX IF NOT EXISTS idx_student_results_student_id ON student_results(student_id);
CREATE INDEX IF NOT EXISTS idx_subject_results_student_result_id ON subject_results(student_result_id);
CREATE INDEX IF NOT EXISTS idx_student_user_links_user_id ON student_user_links(user_id);

-- ==========================================
-- ROW LEVEL SECURITY POLICIES
-- ==========================================

-- Exams policies
CREATE POLICY "Users can view exams for their school" ON exams
    FOR SELECT USING (
        school_code IN (
            SELECT school_code FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can create exams" ON exams
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'superadmin')
            AND school_code = exams.school_code
        )
    );

CREATE POLICY "Admins can update exams" ON exams
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'superadmin')
            AND school_code = exams.school_code
        )
    );

CREATE POLICY "Admins can delete exams" ON exams
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'superadmin')
            AND school_code = exams.school_code
        )
    );

-- Exam subjects policies
CREATE POLICY "Users can view exam subjects" ON exam_subjects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM exams e
            JOIN users u ON e.school_code = u.school_code
            WHERE e.id = exam_subjects.exam_id
            AND u.id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage exam subjects" ON exam_subjects
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM exams e
            JOIN users u ON e.school_code = u.school_code
            WHERE e.id = exam_subjects.exam_id
            AND u.id = auth.uid()
            AND u.role IN ('admin', 'superadmin')
        )
    );

-- Student results policies
CREATE POLICY "Users can view results for their school" ON student_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM exams e
            JOIN users u ON e.school_code = u.school_code
            WHERE e.id = student_results.exam_id
            AND u.id = auth.uid()
        )
    );

CREATE POLICY "Students can view their own results" ON student_results
    FOR SELECT USING (
        student_id IN (
            SELECT student_id FROM student_user_links WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage results" ON student_results
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM exams e
            JOIN users u ON e.school_code = u.school_code
            WHERE e.id = student_results.exam_id
            AND u.id = auth.uid()
            AND u.role IN ('admin', 'superadmin', 'teacher')
        )
    );

-- Subject results policies
CREATE POLICY "Users can view subject results" ON subject_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM student_results sr
            JOIN exams e ON sr.exam_id = e.id
            JOIN users u ON e.school_code = u.school_code
            WHERE sr.id = subject_results.student_result_id
            AND u.id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage subject results" ON subject_results
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM student_results sr
            JOIN exams e ON sr.exam_id = e.id
            JOIN users u ON e.school_code = u.school_code
            WHERE sr.id = subject_results.student_result_id
            AND u.id = auth.uid()
            AND u.role IN ('admin', 'superadmin', 'teacher')
        )
    );

-- Student user links policies
CREATE POLICY "Users can view their own student links" ON student_user_links
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage student user links" ON student_user_links
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM student s
            JOIN users u ON s.school_code = u.school_code
            WHERE s.id = student_user_links.student_id
            AND u.id = auth.uid()
            AND u.role IN ('admin', 'superadmin')
        )
    );

-- ==========================================
-- FUNCTIONS AND TRIGGERS
-- ==========================================

-- Function to calculate percentage and grade
CREATE OR REPLACE FUNCTION calculate_subject_result_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Set max_marks from exam_subjects if not provided
    IF NEW.max_marks = 0 OR NEW.max_marks IS NULL THEN
        SELECT es.max_marks INTO NEW.max_marks
        FROM exam_subjects es
        WHERE es.id = NEW.exam_subject_id;
    END IF;
    
    -- Calculate percentage
    NEW.percentage = ROUND((NEW.obtained_marks::DECIMAL / NEW.max_marks::DECIMAL) * 100, 2);
    
    -- Calculate grade based on percentage
    NEW.grade = CASE
        WHEN NEW.percentage >= 90 THEN 'A+'
        WHEN NEW.percentage >= 80 THEN 'A'
        WHEN NEW.percentage >= 70 THEN 'B+'
        WHEN NEW.percentage >= 60 THEN 'B'
        WHEN NEW.percentage >= 50 THEN 'C+'
        WHEN NEW.percentage >= 40 THEN 'C'
        WHEN NEW.percentage >= 35 THEN 'D'
        ELSE 'F'
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate subject result stats
CREATE TRIGGER trigger_calculate_subject_result_stats
    BEFORE INSERT OR UPDATE ON subject_results
    FOR EACH ROW
    EXECUTE FUNCTION calculate_subject_result_stats();

-- Function to calculate student result stats
CREATE OR REPLACE FUNCTION calculate_student_result_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Set total_max_marks if 0 from sum of exam subjects
    IF NEW.total_max_marks = 0 OR NEW.total_max_marks IS NULL THEN
        SELECT COALESCE(SUM(es.max_marks), 0) INTO NEW.total_max_marks
        FROM exam_subjects es
        WHERE es.exam_id = NEW.exam_id;
    END IF;
    
    -- Calculate percentage
    NEW.percentage = ROUND((NEW.total_obtained_marks::DECIMAL / NEW.total_max_marks::DECIMAL) * 100, 2);
    
    -- Calculate grade based on percentage
    NEW.overall_grade = CASE
        WHEN NEW.percentage >= 90 THEN 'A+'
        WHEN NEW.percentage >= 80 THEN 'A'
        WHEN NEW.percentage >= 70 THEN 'B+'
        WHEN NEW.percentage >= 60 THEN 'B'
        WHEN NEW.percentage >= 50 THEN 'C+'
        WHEN NEW.percentage >= 40 THEN 'C'
        WHEN NEW.percentage >= 35 THEN 'D'
        ELSE 'F'
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate student result stats
CREATE TRIGGER trigger_calculate_student_result_stats
    BEFORE INSERT OR UPDATE ON student_results
    FOR EACH ROW
    EXECUTE FUNCTION calculate_student_result_stats();

-- Function to update ranks
CREATE OR REPLACE FUNCTION update_result_ranks()
RETURNS TRIGGER AS $$
BEGIN
    -- Update class rank and section rank
    UPDATE student_results 
    SET 
        class_rank = rank_data.rank,
        section_rank = rank_data.rank
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY exam_id 
                ORDER BY percentage DESC, total_obtained_marks DESC
            ) as rank
        FROM student_results
        WHERE exam_id = NEW.exam_id
    ) rank_data
    WHERE student_results.id = rank_data.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update ranks
CREATE TRIGGER trigger_update_result_ranks
    AFTER INSERT OR UPDATE ON student_results
    FOR EACH ROW
    EXECUTE FUNCTION update_result_ranks();

-- Function to update exam total_marks when exam_subjects change
CREATE OR REPLACE FUNCTION update_exam_total_marks()
RETURNS TRIGGER AS $$
BEGIN
    -- Update total_marks for the affected exam
    UPDATE exams 
    SET total_marks = (
        SELECT COALESCE(SUM(max_marks), 0)
        FROM exam_subjects
        WHERE exam_id = COALESCE(NEW.exam_id, OLD.exam_id)
    )
    WHERE id = COALESCE(NEW.exam_id, OLD.exam_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update exam total_marks
CREATE TRIGGER trigger_update_exam_total_marks
    AFTER INSERT OR UPDATE OR DELETE ON exam_subjects
    FOR EACH ROW
    EXECUTE FUNCTION update_exam_total_marks();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trigger_update_exams_updated_at
    BEFORE UPDATE ON exams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_exam_subjects_updated_at
    BEFORE UPDATE ON exam_subjects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_student_results_updated_at
    BEFORE UPDATE ON student_results
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- VIEWS FOR ANALYTICS
-- ==========================================

-- View for exam summary
CREATE OR REPLACE VIEW exam_summary AS
SELECT 
    e.id as exam_id,
    e.exam_name,
    e.exam_type,
    e.exam_date,
    e.total_marks,
    ci.grade,
    ci.section,
    COUNT(sr.id) as total_students,
    COUNT(CASE WHEN sr.is_published = true THEN 1 END) as published_results,
    AVG(sr.percentage) as average_percentage,
    MIN(sr.percentage) as min_percentage,
    MAX(sr.percentage) as max_percentage
FROM exams e
JOIN class_instances ci ON e.class_instance_id = ci.id
LEFT JOIN student_results sr ON e.id = sr.exam_id
GROUP BY e.id, e.exam_name, e.exam_type, e.exam_date, e.total_marks, ci.grade, ci.section;

-- View for student performance
CREATE OR REPLACE VIEW student_performance AS
SELECT 
    s.id as student_id,
    s.full_name,
    s.student_code,
    s.email,
    ci.grade,
    ci.section,
    sr.exam_id,
    e.exam_name,
    e.exam_type,
    e.exam_date,
    sr.total_obtained_marks,
    sr.total_max_marks,
    sr.percentage,
    sr.overall_grade,
    sr.class_rank,
    sr.section_rank
FROM student s
JOIN class_instances ci ON s.class_instance_id = ci.id
JOIN student_results sr ON s.id = sr.student_id
JOIN exams e ON sr.exam_id = e.id
WHERE sr.is_published = true;

-- View for subject performance
CREATE OR REPLACE VIEW subject_performance AS
SELECT 
    e.id as exam_id,
    e.exam_name,
    sub.subject_name,
    es.max_marks,
    AVG(sr.obtained_marks) as average_marks,
    AVG(sr.percentage) as average_percentage,
    MIN(sr.percentage) as min_percentage,
    MAX(sr.percentage) as max_percentage,
    COUNT(sr.id) as total_students
FROM exams e
JOIN exam_subjects es ON e.id = es.exam_id
JOIN subjects sub ON es.subject_id = sub.id
LEFT JOIN subject_results sr ON es.id = sr.exam_subject_id
GROUP BY e.id, e.exam_name, sub.subject_name, es.max_marks;
