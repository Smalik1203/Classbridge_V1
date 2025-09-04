# Timetable Syllabus Integration

## Overview

This update integrates the new hierarchical syllabus structure (chapters and topics) with the timetable system, allowing teachers to select specific chapters and subtopics when creating timetable periods.

## Changes Made

### 1. Database Schema Updates

**New Migration**: `20250101000004_add_syllabus_structure_to_timetable.sql`
- Added `syllabus_chapter_id` column to `timetable_slots` table
- Added `syllabus_topic_id` column to `timetable_slots` table
- Created indexes for performance
- Added a view `v_timetable_syllabus_content` for easy content resolution

### 2. Frontend Updates

#### ManageTab Component (`src/components/timetable/ManageTab.jsx`)
- **New Syllabus Loading**: Replaced old `loadChapterOptions` with `loadSyllabusOptions`
- **Hierarchical Selection**: Added dropdown that shows both chapters and topics in a tree structure
- **Enhanced Form**: Added fields for `syllabus_chapter_id` and `syllabus_topic_id`
- **Smart Display**: Shows actual chapter and topic names instead of just IDs
- **Backward Compatibility**: Still supports old `syllabus_item_id` structure

#### ViewTab Component (`src/components/timetable/ViewTab.jsx`)
- **Enhanced Display**: Shows chapter and topic names with proper formatting
- **Visual Indicators**: Uses colored tags to distinguish between chapters and topics
- **Backward Compatibility**: Falls back to old structure when new fields are not available

#### Main Timetable Component (`src/pages/Timetable.jsx`)
- **New State**: Added `syllabusContentMap` for resolving content names
- **Enhanced Data Fetching**: Updated queries to include new syllabus fields
- **Prop Passing**: Passes syllabus content map to child components

### 3. User Experience Improvements

#### Syllabus Content Selection
- **Tree Structure**: Chapters and topics are displayed hierarchically
- **Clear Formatting**: 
  - Chapters: `Chapter 1: Introduction to Mathematics`
  - Topics: `  └─ Topic 1.1: Basic Arithmetic`
- **Search Support**: Users can search through chapters and topics
- **Auto-creation**: Syllabus is automatically created if it doesn't exist

#### Display Enhancements
- **Visual Tags**: 
  - Green tags for chapters
  - Blue tags for topics
- **Descriptive Text**: Shows full chapter and topic names
- **Fallback Support**: Gracefully handles missing data

### 4. Data Structure

#### New Fields in `timetable_slots`
```sql
syllabus_chapter_id uuid REFERENCES syllabus_chapters(id)
syllabus_topic_id uuid REFERENCES syllabus_topics(id)
```

#### Content Resolution Map
```javascript
Map<content_key, {
  type: 'chapter' | 'topic',
  chapterId: uuid,
  topicId?: uuid,
  chapterNo: number,
  topicNo?: number,
  title: string
}>
```

## Usage

### For Teachers/Admins

1. **Creating a Period**:
   - Select subject from dropdown
   - Syllabus content automatically loads
   - Choose either a chapter or specific topic
   - Add description and other details

2. **Viewing Schedule**:
   - See clear chapter/topic names in timetable
   - Visual indicators show content type
   - Progress tracking still works for old structure

### For Students

- View their schedule with clear syllabus content
- See what chapters and topics are being covered
- No changes to existing functionality

## Backward Compatibility

The system maintains full backward compatibility:
- Old `syllabus_item_id` entries continue to work
- Existing timetables are not affected
- Gradual migration to new structure is supported

## Database Migration

To apply these changes:

1. Run the migration: `20250101000004_add_syllabus_structure_to_timetable.sql`
2. The new columns will be added to existing `timetable_slots` table
3. Existing data remains unchanged
4. New entries can use either old or new structure

## Future Enhancements

- Progress tracking for new syllabus structure
- Bulk syllabus content assignment
- Syllabus content analytics
- Integration with assessment system
