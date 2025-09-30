import { supabase } from '../config/supabaseClient';

export const chapterService = {
  // Get chapters for a specific class and subject
  async getChaptersForClassSubject(classInstanceId, subjectId) {
    try {
      // First get the syllabus for this class-subject pair
      const { data: syllabus, error: syllabusError } = await supabase
        .from('syllabi')
        .select('id')
        .eq('class_instance_id', classInstanceId)
        .eq('subject_id', subjectId)
        .maybeSingle();

      if (syllabusError) {
        console.error('Error fetching syllabus:', syllabusError);
        return [];
      }

      if (!syllabus) {
        return [];
      }

      // Get chapters for this syllabus
      const { data: chapters, error: chaptersError } = await supabase
        .from('syllabus_chapters')
        .select('id, chapter_no, title, description, ref_code')
        .eq('syllabus_id', syllabus.id)
        .order('chapter_no', { ascending: true });

      if (chaptersError) {
        console.error('Error fetching chapters:', chaptersError);
        return [];
      }

      return chapters || [];
    } catch (error) {
      console.error('Error in getChaptersForClassSubject:', error);
      return [];
    }
  },

  // Get chapters for multiple subjects (for bulk operations)
  async getChaptersForSubjects(classInstanceId, subjectIds) {
    try {
      const chaptersMap = new Map();
      
      for (const subjectId of subjectIds) {
        const chapters = await this.getChaptersForClassSubject(classInstanceId, subjectId);
        chaptersMap.set(subjectId, chapters);
      }
      
      return chaptersMap;
    } catch (error) {
      console.error('Error in getChaptersForSubjects:', error);
      return new Map();
    }
  },

  // Get all chapters for a class (across all subjects)
  async getAllChaptersForClass(classInstanceId) {
    try {
      // Get all syllabi for this class
      const { data: syllabi, error: syllabiError } = await supabase
        .from('syllabi')
        .select(`
          id,
          subject_id,
          subjects(id, subject_name)
        `)
        .eq('class_instance_id', classInstanceId);

      if (syllabiError) {
        console.error('Error fetching syllabi:', syllabiError);
        return [];
      }

      if (!syllabi || syllabi.length === 0) {
        return [];
      }

      // Get chapters for all syllabi
      const syllabusIds = syllabi.map(s => s.id);
      const { data: chapters, error: chaptersError } = await supabase
        .from('syllabus_chapters')
        .select(`
          id,
          chapter_no,
          title,
          description,
          ref_code,
          syllabus_id
        `)
        .in('syllabus_id', syllabusIds)
        .order('chapter_no', { ascending: true });

      if (chaptersError) {
        console.error('Error fetching chapters:', chaptersError);
        return [];
      }

      // Map chapters with their subject information
      const subjectMap = new Map(syllabi.map(s => [s.id, s.subjects]));
      return (chapters || []).map(chapter => ({
        ...chapter,
        subject: subjectMap.get(chapter.syllabus_id)
      }));
    } catch (error) {
      console.error('Error in getAllChaptersForClass:', error);
      return [];
    }
  },

  // Search chapters by text (for autocomplete)
  async searchChapters(classInstanceId, searchText) {
    try {
      const { data, error } = await supabase
        .from('syllabi')
        .select(`
          id,
          subject_id,
          subjects(id, subject_name),
          syllabus_chapters!inner(
            id, chapter_no, title, description, ref_code
          )
        `)
        .eq('class_instance_id', classInstanceId)
        .ilike('syllabus_chapters.title', `%${searchText}%`);

      if (error) {
        console.error('Error searching chapters:', error);
        return [];
      }

      // Flatten results
      const results = [];
      (data || []).forEach(syllabus => {
        syllabus.syllabus_chapters.forEach(chapter => {
          results.push({
            ...chapter,
            subject: syllabus.subjects,
            display: `${syllabus.subjects.subject_name} - Ch ${chapter.chapter_no}: ${chapter.title}`
          });
        });
      });

      return results;
    } catch (error) {
      console.error('Error in searchChapters:', error);
      return [];
    }
  }
};
