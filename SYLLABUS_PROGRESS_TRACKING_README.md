# Syllabus Progress Tracking System

## Overview

The Syllabus Progress Tracking System integrates syllabus management with the timetable to provide real-time progress tracking for teachers and administrators. Teachers can mark chapters as complete directly from the timetable, and the system automatically calculates completion percentages per subject and class.

## Features

### 🎯 Core Functionality
- **Real-time Progress Tracking**: Mark chapters as pending → in progress → completed
- **Percentage Calculation**: Automatic calculation of completion percentages per subject
- **Audit Trail**: Track who completed what and when
- **Timetable Integration**: One-click status updates from the timetable view
- **Multi-school Support**: Fully scoped by school_code for multi-tenancy

### 📊 Dashboard Features
- **Overall Statistics**: Total, completed, in-progress, and pending chapters
- **Subject-wise Progress**: Detailed breakdown by subject with progress bars
- **Daily Progress View**: See what was taught and completed on specific dates
- **Visual Indicators**: Color-coded status tags and progress bars

### 🔐 Security & Authorization
- **Role-based Access**: Only assigned admins and superadmins can update statuses
- **School Isolation**: All data is scoped to the user's school
- **RLS Policies**: Database-level security with Row Level Security

## Database Schema

### Tables

#### 1. `syllabi` (Parent Table)
```sql
CREATE TABLE syllabi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_code text NOT NULL,
  class_instance_id uuid NOT NULL REFERENCES class_instances(id),
  subject_id uuid NOT NULL REFERENCES subjects(id),
  academic_year_id uuid NOT NULL REFERENCES academic_years(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_code, class_instance_id, subject_id, academic_year_id)
);
```

#### 2. `syllabus_items` (Chapters/Units)
```sql
CREATE TABLE syllabus_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syllabus_id uuid NOT NULL REFERENCES syllabi(id) ON DELETE CASCADE,
  unit_no integer NOT NULL,
  title text NOT NULL,
  description text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  completed_by uuid REFERENCES auth.users(id),
  completed_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(syllabus_id, unit_no)
);
```

#### 3. `timetable_slots` (Enhanced)
```sql
CREATE TABLE timetable_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_code text NOT NULL,
  class_instance_id uuid NOT NULL REFERENCES class_instances(id),
  class_date date NOT NULL,
  period_number integer NOT NULL,
  slot_type text NOT NULL CHECK (slot_type IN ('period', 'break', 'assembly', 'other')),
  name text,
  start_time time NOT NULL,
  end_time time NOT NULL,
  subject_id uuid REFERENCES subjects(id),
  teacher_id uuid REFERENCES auth.users(id),
  syllabus_item_id uuid REFERENCES syllabus_items(id), -- NEW: Links to syllabus items
  plan_text text,
  status text DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(class_instance_id, class_date, period_number)
);
```

### Views

#### 1. `v_syllabus_progress`
Aggregated progress data per subject:
```sql
SELECT 
  s.school_code,
  s.class_instance_id,
  s.subject_id,
  sub.subject_name,
  ci.grade,
  ci.section,
  COUNT(si.id) as total_items,
  COUNT(si.id) FILTER (WHERE si.status = 'completed') as completed_items,
  COUNT(si.id) FILTER (WHERE si.status = 'in_progress') as in_progress_items,
  COUNT(si.id) FILTER (WHERE si.status = 'pending') as pending_items,
  FLOOR(100 * COUNT(si.id) FILTER (WHERE si.status = 'completed') / GREATEST(COUNT(si.id), 1)) as completion_percentage
FROM syllabi s
JOIN subjects sub ON s.subject_id = sub.id
JOIN class_instances ci ON s.class_instance_id = ci.id
LEFT JOIN syllabus_items si ON s.id = si.syllabus_id
GROUP BY s.id, s.school_code, s.class_instance_id, s.subject_id, sub.subject_name, ci.grade, ci.section;
```

#### 2. `v_timetable_progress_day`
Daily timetable with syllabus progress:
```sql
SELECT 
  ts.id as slot_id,
  ts.class_date,
  ts.period_number,
  ts.start_time,
  ts.end_time,
  ts.school_code,
  ts.class_instance_id,
  ts.subject_id,
  ts.teacher_id,
  ts.syllabus_item_id,
  ts.status as slot_status,
  si.unit_no,
  si.title as chapter_title,
  si.status as chapter_status,
  sub.subject_name,
  u.full_name as teacher_name
FROM timetable_slots ts
LEFT JOIN syllabus_items si ON ts.syllabus_item_id = si.id
LEFT JOIN subjects sub ON ts.subject_id = sub.id
LEFT JOIN users u ON ts.teacher_id = u.id
WHERE ts.slot_type = 'period'
ORDER BY ts.class_date DESC, ts.period_number;
```

### Functions

#### 1. `mark_syllabus_item_status(item_id, new_status)`
Updates syllabus item status with authorization checks:
- Validates user permissions
- Enforces status transitions
- Sets completion metadata when marked as completed
- Returns success/error response

#### 2. `get_subject_progress(class_instance_id, subject_id)`
Returns progress statistics for a subject:
- Total, completed, in-progress, pending counts
- Completion percentage
- Handles missing syllabus gracefully

## API Integration

### Service Layer (`src/services/syllabusService.js`)

```javascript
// Mark syllabus item status
await syllabusService.markItemStatus(itemId, newStatus);

// Get subject progress
const progress = await syllabusService.getSubjectProgress(classInstanceId, subjectId);

// Get syllabus progress summary
const summary = await syllabusService.getSyllabusProgress(classInstanceId);

// Get daily progress
const daily = await syllabusService.getDailyProgress(classInstanceId, date);
```

## Components

### 1. `SyllabusProgressIndicator`
Reusable component for displaying syllabus progress:
- Shows subject progress percentage
- Displays chapter status with clickable tags
- Integrates with timetable slots

### 2. `SyllabusProgressDashboard`
Comprehensive dashboard for progress tracking:
- Overall statistics cards
- Subject-wise progress table
- Daily progress view
- Interactive status updates

### 3. Enhanced `ViewTab`
Updated timetable view with progress indicators:
- Syllabus progress indicators in each period
- One-click status updates
- Visual status indicators

## Usage Workflow

### For Admins

1. **View Timetable**: Access the timetable page for their assigned class
2. **See Progress**: Each period shows linked syllabus items with status indicators
3. **Update Status**: Click on status tags to cycle through: pending → in progress → completed
4. **Track Progress**: View completion percentages and progress bars

### For Superadmins

1. **Access Dashboard**: Use the Syllabus Progress Dashboard for comprehensive overview
2. **Monitor Progress**: View overall statistics and subject-wise breakdowns
3. **Daily Tracking**: Check what was completed on specific dates
4. **Audit Trail**: See who completed what and when

## Installation & Setup

### 1. Database Migration
Run the migration file to create the schema:
```sql
-- Run the contents of supabase/migrations/20250101000001_syllabus_progress_tracking.sql
```

### 2. Component Integration
Import and use the components in your application:
```javascript
import SyllabusProgressIndicator from './components/SyllabusProgressIndicator';
import SyllabusProgressDashboard from './components/SyllabusProgressDashboard';
```

### 3. Service Integration
Use the syllabus service for data operations:
```javascript
import { syllabusService } from './services/syllabusService';
```

## Security Considerations

### Row Level Security (RLS)
- All tables have RLS enabled
- Policies ensure school-level data isolation
- Teacher authorization checks for syllabus updates
- Admin override capabilities

### Authorization Flow
1. User authentication via Supabase Auth
2. School code validation from user metadata
3. Role-based permission checks (admin/superadmin)
4. Class assignment validation for admins

## Performance Optimizations

### Indexes
- `idx_syllabi_school_code` - School-based queries
- `idx_syllabi_class_subject` - Class-subject lookups
- `idx_syllabus_items_syllabus_id` - Syllabus item queries
- `idx_syllabus_items_status` - Status-based filtering
- `idx_timetable_slots_class_date` - Daily timetable queries
- `idx_timetable_slots_syllabus_item` - Syllabus item linking

### Views
- Pre-computed aggregations for performance
- Optimized joins for common query patterns
- Materialized view considerations for large datasets

## Future Enhancements

### Planned Features
- **Bulk Status Updates**: Update multiple chapters at once
- **Progress Reports**: Generate PDF reports for parents/administrators
- **Milestone Tracking**: Set and track learning milestones
- **Integration with Assessments**: Link syllabus completion to assessment results
- **Mobile Optimization**: Enhanced mobile experience for teachers

### Analytics
- **Trend Analysis**: Track progress over time
- **Predictive Analytics**: Estimate completion timelines
- **Performance Metrics**: Teacher and class performance analytics

## Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure user has proper role and class assignment
2. **Missing Syllabus**: Create syllabus for class-subject combination first
3. **Progress Not Updating**: Check RLS policies and user school_code
4. **Performance Issues**: Verify indexes are created and queries are optimized

### Debug Queries
```sql
-- Check user permissions
SELECT role, school_code FROM users WHERE id = auth.uid();

-- Verify syllabus exists
SELECT * FROM syllabi WHERE class_instance_id = 'your-class-id' AND subject_id = 'your-subject-id';

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'syllabus_items';
```

## Support

For issues or questions:
1. Check the database logs for RLS policy violations
2. Verify user authentication and role assignments
3. Ensure proper school_code scoping
4. Review the migration file for schema completeness

---

**Note**: This system is designed for multi-tenant school management with proper security isolation. All data operations are scoped to the user's school and validated through RLS policies.
