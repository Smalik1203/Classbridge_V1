# Learning Resources Feature

## Overview

The Learning Resources feature provides a comprehensive platform for managing educational content including videos, PDFs, and interactive quizzes. It supports role-based access control and is designed to work seamlessly with the existing ClassBridge education management system.

## Features

### Resource Types

1. **Videos**
   - Embedded YouTube/Vimeo videos with inline preview
   - External video links that open in new tabs
   - Video player modal with full-screen support

2. **PDFs**
   - In-app PDF preview with embedded viewer
   - Download functionality for offline access
   - File size display and metadata

3. **Quizzes**
   - Interactive quiz interface with multiple choice questions
   - Real-time scoring and progress tracking
   - Timer functionality and completion statistics

### Role-Based Access Control

#### Super Admins & Admins (Teachers/Staff)
- ✅ Create, edit, and delete resources
- ✅ View all resources in their school
- ✅ Filter and search across all content
- ✅ Access to resource management tools

#### Students
- ✅ View resources assigned to their classes/subjects
- ✅ Access to all resource types (videos, PDFs, quizzes)
- ❌ Cannot create, edit, or delete resources
- ❌ Limited to resources for their enrolled classes

### UI/UX Features

- **Search & Filter**: Full-text search with filters by type, subject, and class
- **Pagination**: Efficient loading with configurable page sizes
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Dark/Light Theme**: Consistent with app-wide theme system
- **Resource Cards**: Clean, informative cards with metadata display
- **Tabbed Interface**: Organized by resource type for easy navigation

## Technical Implementation

### Database Schema

The `learning_resources` table includes:
- Resource metadata (title, description, type)
- Content URL and file size
- School and class associations
- Subject and academic year linking
- Upload tracking and timestamps
- Row Level Security (RLS) policies

### Service Layer

`resourceService.js` provides:
- CRUD operations for resources
- Student-specific resource filtering
- Search and pagination support
- Statistics and analytics functions

### Components

1. **LearningResources.jsx** - Main page component
2. **VideoResource.jsx** - Video resource display and preview
3. **PDFResource.jsx** - PDF resource display and viewer
4. **QuizResource.jsx** - Interactive quiz interface

### Security

- Row Level Security (RLS) policies ensure data isolation
- Role-based access control at the UI and database level
- Secure content URL handling
- User authentication and authorization

## Setup Instructions

### 1. Database Migration

Run the migration file to create the necessary tables and policies:

```sql
-- The migration file is located at:
-- supabase/migrations/20241201000000_create_learning_resources.sql
```

### 2. Environment Variables

Ensure your Supabase configuration is properly set up in your environment variables:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Route Configuration

The feature is already integrated into the app routing system:
- Route: `/learning-resources`
- Access: Super Admins, Admins, Students
- Navigation: Added to sidebar menu

## Usage Guide

### For Teachers/Admins

1. **Adding Resources**:
   - Click "Add Resource" button
   - Fill in title, description, and select type
   - Choose subject and class
   - Provide content URL
   - Save the resource

2. **Managing Resources**:
   - Use search and filters to find resources
   - Edit or delete resources using action buttons
   - View resource statistics and usage

### For Students

1. **Accessing Resources**:
   - Navigate to Learning Resources from sidebar
   - Browse by type using tabs
   - Use search to find specific content
   - Click on resources to view/interact

2. **Using Resources**:
   - **Videos**: Click preview to watch inline or open externally
   - **PDFs**: Preview in modal or download for offline use
   - **Quizzes**: Start quiz and answer questions interactively

## API Reference

### Resource Service Functions

```javascript
// Get all resources with filtering
getLearningResources(filters)

// Get resources for a specific student
getStudentResources(studentId, filters)

// Create a new resource
createLearningResource(resourceData)

// Update an existing resource
updateLearningResource(id, updates)

// Delete a resource
deleteLearningResource(id)

// Get resource statistics
getResourceStats(schoolCode, academicYearId)
```

### Filter Parameters

```javascript
{
  page: number,           // Page number for pagination
  limit: number,          // Items per page
  search: string,         // Search term
  resource_type: string,  // 'video', 'pdf', 'quiz'
  subject_id: string,     // Subject ID
  class_instance_id: string, // Class ID
  school_code: string,    // School code
  academic_year_id: string // Academic year ID
}
```

## Customization

### Adding New Resource Types

1. Update the database schema to include new types
2. Create a new component following the existing pattern
3. Add the type to the service layer
4. Update the main page component to handle the new type

### Styling

The components use Ant Design and the app's theme system. Customize by:
- Modifying the theme context
- Overriding component styles
- Adding custom CSS classes

## Troubleshooting

### Common Issues

1. **Resources not loading**: Check RLS policies and user permissions
2. **Video not embedding**: Verify URL format and CORS settings
3. **PDF not previewing**: Ensure PDF URL is accessible and CORS-enabled
4. **Quiz not working**: Check quiz data format and JavaScript errors

### Debug Mode

Enable debug logging by setting:
```javascript
localStorage.setItem('debug', 'learning-resources');
```

## Future Enhancements

- [ ] Resource versioning and history
- [ ] Advanced quiz types (essay, matching, etc.)
- [ ] Resource analytics and usage tracking
- [ ] Bulk upload functionality
- [ ] Resource sharing between schools
- [ ] Offline support for mobile devices
- [ ] Integration with external content providers
- [ ] AI-powered content recommendations

## Support

For technical support or feature requests, please refer to the main project documentation or contact the development team.
