# Student Test Taking System

A comprehensive test taking system that allows students to take tests, track their progress, and view their results.

## Features

### 🎯 **Core Functionality**
- **Available Tests**: Students can see all tests assigned to their class
- **Test Taking**: Interactive test interface with different question types
- **Progress Tracking**: Real-time progress tracking and auto-save
- **Timer Support**: Optional time limits with automatic submission
- **Test History**: View completed tests and scores
- **Resume Tests**: Continue incomplete tests from where you left off

### 📝 **Question Types Supported**
- **Multiple Choice**: Select one correct answer from options
- **One Word**: Short text answer input
- **Long Answer**: Detailed text response with textarea

### ⏱️ **Test Features**
- **Auto-save**: Answers are automatically saved as you type
- **Navigation**: Previous/Next question navigation
- **Progress Bar**: Visual progress indicator
- **Timer**: Countdown timer for timed tests
- **Auto-submit**: Automatic submission when time expires

## Database Schema

### Test Attempts Table
```sql
CREATE TABLE public.test_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}', -- {questionId: "answer"}
  score integer CHECK (score >= 0 AND score <= 100),
  earned_points integer DEFAULT 0,
  total_points integer DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Updated Test Questions Table
```sql
-- Additional fields for test taking
ALTER TABLE public.test_questions 
ADD COLUMN correct_answer text,
ADD COLUMN points integer DEFAULT 1,
ADD COLUMN order_index integer DEFAULT 0;
```

## File Structure

```
src/
├── pages/
│   └── TestTaking.jsx              # Main test taking page
├── services/
│   └── testTakingService.js        # API service for test taking
├── supabase/migrations/
│   ├── 20241201000001_create_test_attempts.sql
│   └── 20241201000002_update_test_questions.sql
└── sample_student_test_data.sql    # Sample test data
```

## API Endpoints

### `getAvailableTests(studentId, schoolCode)`
- Fetches tests available for a student's class
- Excludes already completed tests
- Returns test details with questions

### `getTestForTaking(testId, studentId)`
- Gets test details for taking
- Checks for existing in-progress attempts
- Returns test with questions and existing attempt (if any)

### `startTestAttempt(testId, studentId)`
- Creates a new test attempt
- Sets status to 'in_progress'
- Initializes empty answers object

### `saveTestAnswer(attemptId, questionId, answer)`
- Saves individual answer
- Updates the answers JSONB field
- Auto-saves as student types

### `submitTestAttempt(attemptId, answers)`
- Calculates final score
- Updates attempt status to 'completed'
- Sets completion timestamp

### `getTestHistory(studentId, schoolCode)`
- Fetches completed test attempts
- Returns test details and scores
- Ordered by completion date

## User Interface

### 🏠 **Main Dashboard**
- **Available Tests**: List of tests to take
- **Test History**: Completed tests with scores
- **Test Cards**: Show test details, time limits, question counts

### 📝 **Test Taking Interface**
- **Header**: Test title, progress bar, timer
- **Question Display**: Current question with options
- **Navigation**: Previous/Next buttons
- **Answer Input**: Type-specific input fields
- **Submit Button**: Final submission

### 📊 **Results Screen**
- **Score Display**: Percentage and points earned
- **Pass/Fail Status**: Based on passing score
- **Test Summary**: Total questions, time taken
- **Navigation**: Back to test list

## Security & Permissions

### Row Level Security (RLS)
- Students can only see their own test attempts
- Students can only create attempts for their assigned tests
- Students can only update their own in-progress attempts
- Admins can view all attempts in their school

### Data Validation
- Answer validation based on question type
- Time limit enforcement
- Duplicate attempt prevention
- Score calculation validation

## Usage Flow

1. **Student Login**: Student logs in and navigates to "Take Tests"
2. **View Available Tests**: See all tests assigned to their class
3. **Start Test**: Click "Start Test" to begin
4. **Answer Questions**: Navigate through questions, answers auto-save
5. **Submit Test**: Click submit or auto-submit when time expires
6. **View Results**: See score, pass/fail status, and detailed results
7. **Test History**: View all completed tests and scores

## Sample Data

The `sample_student_test_data.sql` file contains:
- Sample math quiz with 5 questions
- Sample science quiz with 3 questions
- Various question types (MCQ, one-word, long-answer)
- Different point values and time limits

## Error Handling

- **Network Errors**: Graceful handling of API failures
- **Validation Errors**: Client-side validation for answers
- **Time Expiry**: Automatic submission when time runs out
- **Session Management**: Resume incomplete tests
- **Data Integrity**: Prevents duplicate submissions

## Performance Optimizations

- **Lazy Loading**: Questions loaded as needed
- **Auto-save**: Efficient answer saving
- **Indexing**: Database indexes for fast queries
- **Caching**: Client-side caching of test data
- **Pagination**: Efficient data loading for large test lists

## Future Enhancements

- **Question Review**: Review all answers before submission
- **Partial Scoring**: Partial credit for partially correct answers
- **Question Feedback**: Immediate feedback on answers
- **Test Analytics**: Detailed performance analytics
- **Offline Support**: Take tests without internet connection
- **Mobile Optimization**: Better mobile experience
- **Accessibility**: Screen reader and keyboard navigation support
