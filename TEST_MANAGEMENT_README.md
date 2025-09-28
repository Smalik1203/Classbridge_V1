# Test Management System

## Overview

The Test Management system is a comprehensive solution for creating, managing, and administering various types of tests in the ClassBridge education management platform. It supports multiple test types including quizzes, unit tests, assignments, exams, and practice tests.

## Features

### ✅ Implemented Features

1. **Test Management Dashboard**
   - View all tests in a paginated table
   - Statistics cards showing test counts by type
   - Search and filter capabilities
   - Responsive design with modern UI

2. **Test Creation & Editing**
   - Create new tests with comprehensive form
   - Edit existing tests
   - Support for all test types: quiz, unit_test, assignment, exam, practice
   - Class and subject selection from dropdowns
   - Optional time limits and passing scores
   - Form validation and error handling

3. **Test Types Support**
   - **Quiz**: Quick assessments with multiple choice questions
   - **Unit Test**: Chapter or unit-based evaluations
   - **Assignment**: Project-based or homework assignments
   - **Exam**: Formal examinations with time limits
   - **Practice**: Self-study and practice materials

4. **Role-Based Access Control**
   - Super Admin: Full access to all test management features
   - Admin: Full access to test management features
   - Students: View-only access (future enhancement)

### 🔄 Future Enhancements

1. **Question Builder**
   - Add/edit questions for each test
   - Support for multiple question types:
     - Multiple Choice Questions (MCQ)
     - One-word answers
     - Long-form answers
   - Question bank management
   - Question randomization

2. **Student Test Interface**
   - Take tests with timer
   - Submit answers
   - View results and feedback
   - Progress tracking

3. **Grading & Analytics**
   - Automatic grading for MCQ and one-word questions
   - Manual grading for long-form answers
   - Performance analytics
   - Grade distribution reports

## Database Schema

### Tests Table
```sql
CREATE TABLE public.tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  class_instance_id uuid NOT NULL REFERENCES public.class_instances(id),
  subject_id uuid NOT NULL REFERENCES public.subjects(id),
  school_code text NOT NULL REFERENCES public.schools(school_code),
  test_type text NOT NULL CHECK (test_type IN ('quiz','unit_test','assignment','exam','practice')),
  time_limit_seconds integer,
  passing_score integer CHECK (passing_score >= 0 AND passing_score <= 100),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
```

### Test Questions Table
```sql
CREATE TABLE public.test_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('mcq','one_word','long_answer')),
  options text[], -- for MCQ
  correct_index integer,
  correct_text text,
  created_at timestamptz DEFAULT now()
);
```

### Test Attempts Table
```sql
CREATE TABLE public.test_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.student(id),
  answers jsonb NOT NULL, -- {questionId: "answer" or "optionIndex"}
  score integer,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','evaluated')),
  evaluated_by uuid REFERENCES auth.users(id),
  completed_at timestamptz DEFAULT now()
);
```

## File Structure

```
src/
├── pages/
│   └── TestManagement.jsx          # Main test management page
├── services/
│   └── testService.js              # API service for test operations
├── components/
│   └── resources/                  # Future: Question builder components
└── routeAccess.ts                  # Updated with testManagement route
```

## API Endpoints

### Test Service Functions

- `getTests(schoolCode)` - Fetch all tests for a school
- `createTest(testData)` - Create a new test
- `updateTest(testId, testData)` - Update an existing test
- `deleteTest(testId)` - Delete a test
- `getClassInstances(schoolCode)` - Get available classes
- `getSubjects(schoolCode)` - Get available subjects

## Usage

### Accessing Test Management

1. Navigate to the sidebar menu
2. Click on "Test Management" (visible to Super Admin and Admin roles)
3. The dashboard will load with all existing tests

### Creating a New Test

1. Click the "Create Test" button
2. Fill in the required fields:
   - **Title**: Test name
   - **Description**: Optional description
   - **Test Type**: Select from dropdown
   - **Class**: Select target class
   - **Subject**: Select subject
   - **Time Limit**: Optional time in seconds
   - **Passing Score**: Optional passing percentage
3. Click "Create Test"

### Editing a Test

1. Click the edit icon (pencil) next to any test
2. Modify the fields as needed
3. Click "Update Test"

### Deleting a Test

1. Click the delete icon (trash) next to any test
2. Confirm the deletion in the popup

## UI/UX Features

- **Modern Design**: Clean, professional interface using Ant Design
- **Responsive Layout**: Works on desktop, tablet, and mobile devices
- **Dark/Light Theme**: Supports theme switching
- **Statistics Dashboard**: Visual overview of test distribution
- **Form Validation**: Real-time validation with helpful error messages
- **Loading States**: Proper loading indicators during API calls
- **Confirmation Dialogs**: Safe deletion with confirmation prompts

## Technical Implementation

### Dependencies
- React 18.3.1
- Ant Design 5.26.6
- Supabase 2.53.0
- React Router DOM 7.7.0

### Key Components
- **Table**: Displays tests with sorting and pagination
- **Modal**: Create/edit form with validation
- **Statistics Cards**: Visual data representation
- **Form**: Comprehensive test creation/editing
- **Confirmation**: Safe deletion with user confirmation

### State Management
- Local state for UI interactions
- Supabase for data persistence
- Form state management with Ant Design Form

## Security

- Role-based access control
- School-level data isolation
- User authentication required
- Secure API endpoints with proper validation

## Performance

- Paginated table for large datasets
- Optimized queries with proper joins
- Lazy loading of form options
- Efficient state updates

## Future Roadmap

1. **Phase 2**: Question Builder implementation
2. **Phase 3**: Student test-taking interface
3. **Phase 4**: Advanced analytics and reporting
4. **Phase 5**: Mobile app integration
5. **Phase 6**: AI-powered question generation

## Contributing

When adding new features to the Test Management system:

1. Follow the existing code patterns
2. Update the route access configuration
3. Add proper error handling
4. Include loading states
5. Test with different user roles
6. Update this documentation

## Support

For issues or questions regarding the Test Management system, please refer to the main project documentation or contact the development team.
