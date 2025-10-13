// src/components/timetable/SyllabusLoader.jsx
import { useEffect, useState } from 'react';
import { supabase } from '@/config/supabaseClient';

export const useSyllabusLoader = (classId, schoolCode) => {
  const [chaptersById, setChaptersById] = useState(new Map());
  const [syllabusContentMap, setSyllabusContentMap] = useState(new Map());
  const [loading, setLoading] = useState(false);

  // Fetch chapters index
  const fetchChaptersIndex = async () => {
    if (!classId || !schoolCode) {
      return setChaptersById(new Map());
    }
    try {
      setLoading(true);
      const { data: syllabi, error: sylErr } = await supabase
        .from('syllabi')
        .select('id, subject_id')
        .eq('class_instance_id', classId)
        .eq('school_code', schoolCode);
      if (sylErr) throw sylErr;
      const ids = (syllabi ?? []).map(s => s.id);
      if (!ids.length) {
        return setChaptersById(new Map());
      }
      const { data: chapters, error: chErr } = await supabase
        .from('syllabus_chapters')
        .select(`
          id, chapter_no, title, description, syllabus_id,
          syllabus_topics(id, topic_no, title, description)
        `)
        .in('syllabus_id', ids)
        .order('chapter_no');
      if (chErr) throw chErr;

      const byId = new Map();
      const subjBySyl = new Map((syllabi ?? []).map(s => [s.id, s.subject_id]));
      for (const ch of (chapters ?? [])) {
        const subjectId = subjBySyl.get(ch.syllabus_id) || null;
        byId.set(ch.id, {
          unit_no: ch.chapter_no,
          title: ch.title,
          subject_id: subjectId,
          type: 'chapter'
        });
        for (const topic of (ch.syllabus_topics ?? [])) {
          byId.set(topic.id, {
            unit_no: `${ch.chapter_no}.${topic.topic_no}`,
            title: topic.title,
            subject_id: subjectId,
            type: 'topic',
            chapter_id: ch.id
          });
        }
      }
      setChaptersById(byId);
    } catch (e) {
      setChaptersById(new Map());
    } finally {
      setLoading(false);
    }
  };

  // Fetch syllabus content map
  const fetchSyllabusContentMap = async () => {
    if (!classId || !schoolCode) {
      return setSyllabusContentMap(new Map());
    }
    try {
      const { data: syllabi, error: sylErr } = await supabase
        .from('syllabi')
        .select('id, subject_id')
        .eq('class_instance_id', classId)
        .eq('school_code', schoolCode);
      if (sylErr) throw sylErr;
      const ids = (syllabi ?? []).map(s => s.id);
      if (!ids.length) {
        return setSyllabusContentMap(new Map());
      }
      const { data: chapters, error: chErr } = await supabase
        .from('syllabus_chapters')
        .select(`
          id, chapter_no, title, description, syllabus_id,
          syllabus_topics(id, topic_no, title, description)
        `)
        .in('syllabus_id', ids)
        .order('chapter_no');
      if (chErr) throw chErr;

      const contentMap = new Map();
      const subjBySyl = new Map((syllabi ?? []).map(s => [s.id, s.subject_id]));
      (chapters || []).forEach(chapter => {
        const subjectId = subjBySyl.get(chapter.syllabus_id);
        contentMap.set(`chapter_${chapter.id}`, {
          type: 'chapter',
          chapterId: chapter.id,
          chapterNo: chapter.chapter_no,
          title: chapter.title,
          subjectId: subjectId
        });
        (chapter.syllabus_topics || []).forEach(topic => {
          contentMap.set(`topic_${topic.id}`, {
            type: 'topic',
            chapterId: chapter.id,
            topicId: topic.id,
            chapterNo: chapter.chapter_no,
            topicNo: topic.topic_no,
            title: topic.title,
            chapterTitle: chapter.title,
            subjectId: subjectId
          });
        });
      });
      setSyllabusContentMap(contentMap);
    } catch (e) {
      setSyllabusContentMap(new Map());
    }
  };

  // Load data when classId or schoolCode changes
  useEffect(() => {
    if (!classId || !schoolCode) return;
    fetchChaptersIndex();
    fetchSyllabusContentMap();
  }, [classId, schoolCode]);

  return {
    chaptersById,
    syllabusContentMap,
    loading,
    refetch: () => {
      fetchChaptersIndex();
      fetchSyllabusContentMap();
    }
  };
};
