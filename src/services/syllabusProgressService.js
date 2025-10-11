import { supabase } from '../config/supabaseClient';

/**
 * Syllabus Progress Service
 *
 * These functions rely on server-side RPCs to ensure secure writes under RLS:
 * - syllabus_progress_for_date(p_school_code text, p_class_instance_id uuid, p_date date)
 * - mark_syllabus_taught(p_school_code text, p_timetable_slot_id uuid, p_class_instance_id uuid, p_date date,
 *                        p_subject_id uuid, p_teacher_id uuid, p_syllabus_chapter_id uuid default null,
 *                        p_syllabus_topic_id uuid default null)
 * - unmark_syllabus_taught(p_school_code text, p_timetable_slot_id uuid)
 */

export async function getProgressForDate(schoolCode, classInstanceId, date) {
  try {
    const { data, error } = await supabase.rpc('syllabus_progress_for_date', {
      p_school_code: schoolCode,
      p_class_instance_id: classInstanceId,
      p_date: date,
    });
    if (error) throw error;
    // Expecting array of rows with at least timetable_slot_id
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('getProgressForDate error:', error);
    throw error;
  }
}

export async function markSlotTaught({
  schoolCode,
  timetableSlotId,
  classInstanceId,
  date,
  subjectId,
  teacherId,
  syllabusChapterId = null,
  syllabusTopicId = null,
}) {
  try {
    const { data, error } = await supabase.rpc('mark_syllabus_taught', {
      p_school_code: schoolCode,
      p_timetable_slot_id: timetableSlotId,
      p_class_instance_id: classInstanceId,
      p_date: date,
      p_subject_id: subjectId,
      p_teacher_id: teacherId,
      p_syllabus_chapter_id: syllabusChapterId,
      p_syllabus_topic_id: syllabusTopicId,
    });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('markSlotTaught error:', error);
    throw error;
  }
}

export async function unmarkSlotTaught({ schoolCode, timetableSlotId }) {
  try {
    const { data, error } = await supabase.rpc('unmark_syllabus_taught', {
      p_school_code: schoolCode,
      p_timetable_slot_id: timetableSlotId,
    });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('unmarkSlotTaught error:', error);
    throw error;
  }
}


