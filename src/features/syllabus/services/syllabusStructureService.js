import { supabase } from '@/config/supabaseClient';

export const syllabusStructureService = {
  // Get complete syllabus tree for a class-subject pair
  async getSyllabusTree(classInstanceId, subjectId) {
    try {
      const { data, error } = await supabase.rpc('get_syllabus_tree', {
        p_class_instance_id: classInstanceId,
        p_subject_id: subjectId
      });

      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  },

  // Get simple list of chapters for a syllabus
  async getChapters(syllabusId) {
    try {
      const { data, error } = await supabase
        .from('syllabus_chapters')
        .select('id, chapter_no, title')
        .eq('syllabus_id', syllabusId)
        .order('chapter_no', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw error;
    }
  },

  // Get simple list of topics for a chapter
  async getTopics(chapterId) {
    try {
      const { data, error } = await supabase
        .from('syllabus_topics')
        .select('id, topic_no, title')
        .eq('chapter_id', chapterId)
        .order('topic_no', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw error;
    }
  },

  // Resolve syllabus item names by ID (for Timetable/Reports)
  async resolveSyllabusItem(itemId, itemType) {
    try {
      const { data, error } = await supabase.rpc('resolve_syllabus_item', {
        p_item_id: itemId,
        p_item_type: itemType
      });

      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  },

  // Get syllabus ID for a class-subject pair
  async getSyllabusId(classInstanceId, subjectId) {
    try {
      const { data, error } = await supabase
        .from('syllabi')
        .select('id')
        .eq('class_instance_id', classInstanceId)
        .eq('subject_id', subjectId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No syllabus found
        }
        throw error;
      }
      return data?.id;
    } catch (error) {
      throw error;
    }
  },

  // Get all chapters with their topics for a syllabus (flat structure)
  async getChaptersWithTopics(syllabusId) {
    try {
      const { data, error } = await supabase
        .from('syllabus_chapters')
        .select(`
          id, chapter_no, title, description, ref_code,
          syllabus_topics(id, topic_no, title, description, ref_code)
        `)
        .eq('syllabus_id', syllabusId)
        .order('chapter_no', { ascending: true });

      if (error) throw error;
      
      // Sort topics within each chapter
      return (data || []).map(chapter => ({
        ...chapter,
        syllabus_topics: (chapter.syllabus_topics || []).sort((a, b) => a.topic_no - b.topic_no)
      }));
    } catch (error) {
      throw error;
    }
  },

  // Search syllabus items by text (for autocomplete)
  async searchSyllabusItems(classInstanceId, subjectId, searchText) {
    try {
      const { data, error } = await supabase
        .from('syllabi')
        .select(`
          id,
          syllabus_chapters!inner(
            id, chapter_no, title,
            syllabus_topics(id, topic_no, title)
          )
        `)
        .eq('class_instance_id', classInstanceId)
        .eq('subject_id', subjectId)
        .or(`syllabus_chapters.title.ilike.%${searchText}%,syllabus_chapters.syllabus_topics.title.ilike.%${searchText}%`);

      if (error) throw error;
      
      // Flatten results for easy consumption
      const results = [];
      (data || []).forEach(syllabus => {
        syllabus.syllabus_chapters.forEach(chapter => {
          // Add chapter as option
          results.push({
            id: chapter.id,
            type: 'chapter',
            chapter_no: chapter.chapter_no,
            chapter_title: chapter.title,
            topic_no: null,
            topic_title: null,
            display: `Ch ${chapter.chapter_no} • ${chapter.title}`
          });
          
          // Add topics as options
          chapter.syllabus_topics.forEach(topic => {
            results.push({
              id: topic.id,
              type: 'topic',
              chapter_no: chapter.chapter_no,
              chapter_title: chapter.title,
              topic_no: topic.topic_no,
              topic_title: topic.title,
              display: `Ch ${chapter.chapter_no} • ${chapter.title} → T${topic.topic_no} • ${topic.title}`
            });
          });
        });
      });
      
      return results;
    } catch (error) {
      throw error;
    }
  },

  // Reorder chapters
  async reorderChapters(syllabusId, orderedIds) {
    try {
      const { error } = await supabase.rpc('reorder_chapters', {
        p_syllabus_id: syllabusId,
        p_ordered_ids: orderedIds
      });

      if (error) throw error;
    } catch (error) {
      throw error;
    }
  },

  // Reorder topics
  async reorderTopics(chapterId, orderedIds) {
    try {
      const { error } = await supabase.rpc('reorder_topics', {
        p_chapter_id: chapterId,
        p_ordered_ids: orderedIds
      });

      if (error) throw error;
    } catch (error) {
      throw error;
    }
  }
};
