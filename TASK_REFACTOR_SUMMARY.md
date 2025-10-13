# Task Management Refactor Summary

## Overview
Successfully refactored the task management system to use Supabase Storage for attachments, implement server-side filtering/pagination, and ensure academicYearId is passed end-to-end.

## Files Created/Modified

### 1. **AttachmentPreview.jsx** (NEW)
- **Location**: `src/components/AttachmentPreview.jsx`
- **Purpose**: Shared component for rendering attachment previews
- **Features**:
  - Renders previews by MIME type (image/pdf/text/generic)
  - Automatically cleans up object URLs on unmount
  - Optional download button with signed URLs (5-minute TTL)
  - Handles both Supabase Storage files and local file objects
  - Graceful fallback for unsupported file types

### 2. **taskService.js** (UPDATED)
- **Location**: `src/services/taskService.js`
- **New Methods**:
  - `uploadAttachment(file, schoolCode, classInstanceId)`: Uploads files to Supabase Storage with validation
  - `signDownloadURL(metadata, ttl)`: Generates signed URLs for secure downloads
  - `getTasks()` updated with server-side filtering, search, and pagination
- **Key Changes**:
  - File validation: Max 10MB, allowed types (images, PDF, DOC, DOCX, TXT)
  - Storage bucket: `Lms`
  - Storage path: `task-attachments/{school_code}/{class_instance_id}/{filename}`
  - Sanitized attachment metadata (no AntD UploadFile objects in DB)
  - Pagination support with total count
  - Server-side text search on title and description

### 3. **TaskForm.jsx** (REFACTORED)
- **Location**: `src/components/TaskForm.jsx`
- **Key Changes**:
  - File upload validation (size and type) with `beforeUpload`
  - Calls `TaskService.uploadAttachment()` on form submit
  - Uses new `<AttachmentPreview>` component for previews
  - Consistent priority colors shared with TaskList
  - Subject select disabled until class is chosen
  - Allows past assigned dates (for editing historical tasks)
  - Validates due_date >= assigned_date
  - Safe URL cleanup with `revokeObjectURL` on remove and unmount
  - Requires academicYearId (blocks submit if missing)

### 4. **TaskList.jsx** (REFACTORED)
- **Location**: `src/components/TaskList.jsx`
- **Key Changes**:
  - Server-side filtering via `TaskService.getTasks()`
  - 400ms debounced search input
  - Server-side pagination with total count
  - Uses `<AttachmentPreview>` component with signed URLs
  - Consistent priority colors (green/orange/red/red)
  - Improved accessibility (aria-labels on buttons)
  - Removed console.logs
  - Cleaner attachment modal showing list with preview capability

### 5. **TaskManagement.jsx** (REFACTORED)
- **Location**: `src/pages/TaskManagement.jsx`
- **Key Changes**:
  - Fetches academicYearId from active academic year
  - Passes academicYearId to TaskForm and TaskList
  - Shows warning alert if no academic year found
  - Hides "Create Task" if user lacks permission (`hasRole` check)
  - Refreshes statistics after create/update/delete
  - Uses AbortController for cleanup on unmount
  - Better error handling (ignores AbortError)
  - Improved loading states

## Priority Color Scheme
Shared across all components for consistency:
- **Low**: Green (#52c41a)
- **Medium**: Orange (#faad14)
- **High**: Red (#ff4d4f)
- **Urgent**: Red (#ff4d4f)

## Database Changes Required

### Supabase Storage Bucket
The system uses your existing `Lms` storage bucket. Files are stored in the path:
`task-attachments/{school_code}/{class_instance_id}/{filename}`

If you need to set up RLS policies for the bucket (if not already configured):

```sql
-- Set up RLS policies for the Lms bucket
CREATE POLICY "Allow authenticated users to upload task attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'Lms' AND (storage.foldername(name))[1] = 'task-attachments');

CREATE POLICY "Allow authenticated users to read task attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'Lms' AND (storage.foldername(name))[1] = 'task-attachments');

CREATE POLICY "Allow authenticated users to update their task attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'Lms' AND (storage.foldername(name))[1] = 'task-attachments');

CREATE POLICY "Allow authenticated users to delete their task attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'Lms' AND (storage.foldername(name))[1] = 'task-attachments');
```

### Tasks Table Schema
Ensure the `tasks` table has:
- `attachments` column type: `jsonb` (array of metadata objects)
- Each attachment object should have: `{bucket, path, name, size, mime}`

Example attachment structure:
```json
{
  "bucket": "Lms",
  "path": "task-attachments/SCHOOL001/class-id-123/1699999999999_abc123.pdf",
  "name": "homework.pdf",
  "size": 245678,
  "mime": "application/pdf"
}
```

## File Validation Rules

### Allowed File Types
- **Images**: JPEG, JPG, PNG, GIF
- **Documents**: PDF, DOC, DOCX
- **Text**: TXT

### Size Limit
- Maximum 10MB per file

### Upload Behavior
- Files are validated before upload (client-side)
- Files are NOT auto-uploaded by AntD
- Files are uploaded to Supabase Storage on form submit
- Only sanitized metadata is stored in the database

## Server-Side Features

### Filtering
- Academic Year ID (required)
- Class Instance ID
- Subject ID
- Priority
- Date Range (assigned_date and due_date)
- Text Search (title and description)

### Pagination
- Default: 10 items per page
- Configurable page size
- Shows total count
- Quick jump to page
- Shows range info (e.g., "1-10 of 45 tasks")

### Search
- 400ms debounce delay
- Server-side search using PostgreSQL `ilike`
- Searches both title and description fields
- Resets to page 1 on new search

## Migration Notes

### Existing Tasks
If you have existing tasks with old attachment format, you may need to migrate them:

1. **Old format** (AntD UploadFile objects): Contains `uid`, `status`, `url`, `originFileObj`, etc.
2. **New format** (Sanitized metadata): Contains only `bucket`, `path`, `name`, `size`, `mime`

### Migration Script (Optional)
If you have legacy data, you can write a migration script to:
1. Download old attachments from wherever they're stored
2. Upload to Supabase Storage using the new service
3. Update task records with new metadata format

## Testing Checklist

- [ ] Create a new task with attachments
- [ ] Edit an existing task and add/remove attachments
- [ ] Preview different file types (image, PDF, text)
- [ ] Download attachments using signed URLs
- [ ] Test file validation (size > 10MB should fail)
- [ ] Test file validation (unsupported types should fail)
- [ ] Test search with debounce (type quickly, should only trigger once)
- [ ] Test pagination (navigate between pages)
- [ ] Test all filters (class, subject, priority, date range)
- [ ] Test on mobile (responsive design)
- [ ] Verify URL cleanup (check browser memory doesn't leak)
- [ ] Test with missing academicYearId (should show warning)
- [ ] Test permissions (students shouldn't see create button)

## Performance Improvements

1. **Server-side pagination**: Only fetches needed rows
2. **Debounced search**: Reduces unnecessary API calls
3. **Object URL cleanup**: Prevents memory leaks
4. **AbortController**: Cancels pending requests on unmount
5. **Signed URLs**: Secure, time-limited access to files

## Security Improvements

1. **File validation**: Size and type restrictions
2. **Signed URLs**: Time-limited (5 min) download links
3. **RLS policies**: Supabase Storage access control
4. **Sanitized metadata**: No executable code in database
5. **Permission checks**: Role-based access control

## Future Enhancements

- [ ] Add batch upload progress indicator
- [ ] Add drag-and-drop file upload
- [ ] Add file type icons for better visual identification
- [ ] Add compressed thumbnail generation for images
- [ ] Add virus scanning for uploaded files
- [ ] Add student submission attachments (similar pattern)
- [ ] Add attachment versioning
- [ ] Add attachment comments/annotations

## Support

For issues or questions, please check:
1. Supabase Storage bucket is created and has correct RLS policies
2. Academic year is set up and active
3. User has correct role permissions
4. Browser console for detailed error messages
5. Network tab for API request/response details

