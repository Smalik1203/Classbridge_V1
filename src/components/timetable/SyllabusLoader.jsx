// src/components/timetable/SyllabusLoader.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../../config/supabaseClient';

export const useSyllabusLoader = (classId, schoolCode) => {
  const [chaptersById, setChaptersById] = useState(new Map());
  const [syllabusContentMap, setSyllabusContentMap] = useState(new Map());
  const [loading, setLoading] = useState(false);

  // Fetch chapters index
  const fetchChaptersIndex = async () => {
    console.log('=== SYLLABUS LOADER DEBUG ===');
    console.log('classId:', classId);
    console.log('schoolCode:', schoolCode);
    
    if (!classId || !schoolCode) {
      console.log('❌ Missing classId or schoolCode, clearing data');
      return setChaptersById(new Map());
    }
    
    try {
      setLoading(true);
      console.log('🔄 Fetching syllabi for class:', classId, 'school:', schoolCode);
      
      const { data: syllabi, error: sylErr } = await supabase
        .from('syllabi')
        .select('id, subject_id')
        .eq('class_instance_id', classId)
        .eq('school_code', schoolCode);
      
      console.log('Syllabi query result:', { syllabi, sylErr });
      
      if (sylErr) throw sylErr;
      const ids = (syllabi ?? []).map(s => s.id);
      console.log('Syllabus IDs found:', ids);
      
      if (!ids.length) {
        console.log('❌ No syllabi found for this class');
        return setChaptersById(new Map());
      }

      console.log('🔄 Fetching chapters for syllabus IDs:', ids);
      
      const { data: chapters, error: chErr } = await supabase
        .from('syllabus_chapters')
        .select(`
          id, chapter_no, title, description, syllabus_id,
          syllabus_topics(id, topic_no, title, description)
        `)
        .in('syllabus_id', ids)
        .order('chapter_no');
      
      console.log('Chapters query result:', { chapters, chErr });
      
      if (chErr) throw chErr;

      const byId = new Map();
      const subjBySyl = new Map((syllabi ?? []).map(s => [s.id, s.subject_id]));
      console.log('Subject mapping:', Array.from(subjBySyl.entries()));
      console.log('Available syllabus IDs for mapping:', ids);
      console.log('Chapters with syllabus_id:', chapters?.map(ch => ({ id: ch.id, syllabus_id: ch.syllabus_id })));
      
      console.log('🔄 Processing chapters...');
      let chapterCount = 0;
      let topicCount = 0;
      
      for (const ch of (chapters ?? [])) {
        chapterCount++;
        const subjectId = subjBySyl.get(ch.syllabus_id) || null;
        console.log(`Chapter ${chapterCount}:`, {
          id: ch.id,
          chapter_no: ch.chapter_no,
          title: ch.title,
          syllabus_id: ch.syllabus_id,
          subject_id: subjectId,
          topics_count: ch.syllabus_topics?.length || 0
        });
        console.log(`  Mapping lookup: syllabus_id=${ch.syllabus_id}, found subjectId=${subjectId}`);
        console.log(`  Available mappings:`, Array.from(subjBySyl.entries()));
        
        byId.set(ch.id, {
          unit_no: ch.chapter_no,
          title: ch.title,
          subject_id: subjectId,
          type: 'chapter'
        });
        
        for (const topic of (ch.syllabus_topics ?? [])) {
          topicCount++;
          console.log(`  Topic ${topicCount}:`, {
            id: topic.id,
            topic_no: topic.topic_no,
            title: topic.title,
            subject_id: subjectId
          });
          
          byId.set(topic.id, {
            unit_no: `${ch.chapter_no}.${topic.topic_no}`,
            title: topic.title,
            subject_id: subjectId,
            type: 'topic',
            chapter_id: ch.id
          });
        }
      }
      
      console.log(`📊 Processed ${chapterCount} chapters and ${topicCount} topics`);
      console.log('Final byId map:', Array.from(byId.entries()));
      setChaptersById(byId);
    } catch (e) {
      console.error('Error fetching chapters:', e);
      setChaptersById(new Map());
    } finally {
      setLoading(false);
    }
  };

  // Fetch syllabus content map
  const fetchSyllabusContentMap = async () => {
    console.log('=== SYLLABUS CONTENT MAP DEBUG ===');
    console.log('classId:', classId);
    console.log('schoolCode:', schoolCode);
    
    if (!classId || !schoolCode) {
      console.log('❌ Missing classId or schoolCode, clearing content map');
      return setSyllabusContentMap(new Map());
    }
    
    try {
      console.log('🔄 Fetching syllabi for content map...');
      
      const { data: syllabi, error: sylErr } = await supabase
        .from('syllabi')
        .select('id, subject_id')
        .eq('class_instance_id', classId)
        .eq('school_code', schoolCode);
      
      console.log('Content map syllabi query result:', { syllabi, sylErr });
      
      if (sylErr) throw sylErr;
      const ids = (syllabi ?? []).map(s => s.id);
      console.log('Content map syllabus IDs:', ids);
      
      if (!ids.length) {
        console.log('❌ No syllabi found for content map');
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
      console.log('Content map subject mapping:', Array.from(subjBySyl.entries()));
      console.log('Available syllabus IDs for mapping:', ids);
      console.log('Chapters with syllabus_id:', chapters?.map(ch => ({ id: ch.id, syllabus_id: ch.syllabus_id })));
      
      console.log('🔄 Building content map...');
      let contentChapterCount = 0;
      let contentTopicCount = 0;
      
      (chapters || []).forEach(chapter => {
        contentChapterCount++;
        const subjectId = subjBySyl.get(chapter.syllabus_id);
        console.log(`Content Chapter ${contentChapterCount}:`, {
          id: chapter.id,
          chapter_no: chapter.chapter_no,
          title: chapter.title,
          syllabus_id: chapter.syllabus_id,
          subject_id: subjectId,
          topics_count: chapter.syllabus_topics?.length || 0
        });
        console.log(`  Content mapping lookup: syllabus_id=${chapter.syllabus_id}, found subjectId=${subjectId}`);
        console.log(`  Content available mappings:`, Array.from(subjBySyl.entries()));

        contentMap.set(`chapter_${chapter.id}`, {
          type: 'chapter',
          chapterId: chapter.id,
          chapterNo: chapter.chapter_no,
          title: chapter.title,
          subjectId: subjectId
        });

        (chapter.syllabus_topics || []).forEach(topic => {
          contentTopicCount++;
          console.log(`  Content Topic ${contentTopicCount}:`, {
            id: topic.id,
            topic_no: topic.topic_no,
            title: topic.title,
            subject_id: subjectId
          });
          
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
      
      console.log(`📊 Content map: ${contentChapterCount} chapters, ${contentTopicCount} topics`);
      console.log('Final content map:', Array.from(contentMap.entries()));
      
      setSyllabusContentMap(contentMap);
    } catch (e) {
      console.error('Error fetching syllabus content:', e);
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
