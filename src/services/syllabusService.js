import { supabase } from '../config/supabaseClient';

export const syllabusService = {
  // Mark syllabus item status
  async markItemStatus(itemId, newStatus) {
    try {
      const { data, error } = await supabase.rpc('mark_syllabus_item_status', {
        item_id: itemId,
        new_status: newStatus
      });

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Error marking syllabus item status:', error);
      throw error;
    }
  },

  // Get subject progress
  async getSubjectProgress(classInstanceId, subjectId) {
    try {
      const { data, error } = await supabase.rpc('get_subject_progress', {
        class_instance_id_param: classInstanceId,
        subject_id_param: subjectId
      });

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Error getting subject progress:', error);
      throw error;
    }
  },

  // Get syllabus progress summary for a class
  async getSyllabusProgress(classInstanceId) {
    try {
      const { data, error } = await supabase
        .from('v_syllabus_progress')
        .select('*')
        .eq('class_instance_id', classInstanceId);

      if (error) {
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error('Error getting syllabus progress:', error);
      throw error;
    }
  },

  // Get daily timetable progress
  async getDailyProgress(classInstanceId, date) {
    try {
      const { data, error } = await supabase
        .from('v_timetable_progress_day')
        .select('*')
        .eq('class_instance_id', classInstanceId)
        .eq('class_date', date)
        .order('period_number');

      if (error) {
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error('Error getting daily progress:', error);
      throw error;
    }
  },

  // Get syllabus items for a subject
  async getSyllabusItems(classInstanceId, subjectId) {
    try {
      // First get the syllabus
      const { data: syllabus, error: syllabusError } = await supabase
        .from('syllabi')
        .select('id')
        .eq('class_instance_id', classInstanceId)
        .eq('subject_id', subjectId)
        .maybeSingle();

      if (syllabusError) {
        throw new Error(syllabusError.message);
      }

      if (!syllabus) {
        return [];
      }

      // Get syllabus items
      const { data: items, error: itemsError } = await supabase
        .from('syllabus_items')
        .select(`
          id,
          unit_no,
          title,
          description,
          status,
          completed_by,
          completed_at,
          created_at,
          updated_at,
          admin!syllabus_items_completed_by_fkey(full_name)
        `)
        .eq('syllabus_id', syllabus.id)
        .order('unit_no');

      if (itemsError) {
        throw new Error(itemsError.message);
      }

      return items || [];
    } catch (error) {
      console.error('Error getting syllabus items:', error);
      throw error;
    }
  },

  // Create or update syllabus item
  async upsertSyllabusItem(syllabusId, itemData) {
    try {
      const { data, error } = await supabase
        .from('syllabus_items')
        .upsert({
          syllabus_id: syllabusId,
          unit_no: itemData.unit_no,
          title: itemData.title,
          description: itemData.description,
          status: itemData.status || 'pending',
          created_by: itemData.created_by
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Error upserting syllabus item:', error);
      throw error;
    }
  },

  // Create syllabus if it doesn't exist
  async ensureSyllabus(classInstanceId, subjectId, createdBy) {
    try {
      // First get the academic year from the class
      const { data: classInstance, error: classError } = await supabase
        .from('class_instances')
        .select('academic_year_id')
        .eq('id', classInstanceId)
        .single();

      if (classError) {
        throw new Error('Class not found');
      }

      if (!classInstance.academic_year_id) {
        throw new Error('Class does not have an academic year assigned');
      }

      const { data, error } = await supabase
        .from('syllabi')
        .upsert({
          class_instance_id: classInstanceId,
          subject_id: subjectId,
          academic_year_id: classInstance.academic_year_id,
          created_by: createdBy
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Error ensuring syllabus exists:', error);
      throw error;
    }
  }
};
