
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Divider, Input, List, Select,
  Space, Typography, Popconfirm, Modal, Form, message, Skeleton,
  Row, Col, Tag, Tooltip, Collapse, notification, Upload, Table
} from 'antd';
import { 
  PlusOutlined, DeleteOutlined, EditOutlined,
  BookOutlined, FileTextOutlined, SettingOutlined,
  InfoCircleOutlined, CopyOutlined, EyeOutlined,
  UploadOutlined, DownloadOutlined, FileExcelOutlined
} from '@ant-design/icons';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../AuthProvider';
import { getSchoolCode, getUserRole } from '../utils/metadata';
import * as XLSX from 'xlsx';
import EmptyState from '../ui/EmptyState';

const { Title, Text } = Typography;


const { TextArea } = Input;
const { Panel } = Collapse;

function byText(field) {
  return (a, b) => String(a[field]).localeCompare(String(b[field]));
}

export default function SyllabusPage() {
  const [msg, ctx] = message.useMessage();
  const { user } = useAuth();

  // Use centralized metadata utilities
  const school_code = getSchoolCode(user);
  const role = getUserRole(user);

  // Query params
  const params = new URLSearchParams(window.location.search);
  const qpSubjectId = params.get('subjectId');
  const qpClassInstanceId = params.get('classInstanceId');

  // State
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [subjects, setSubjects] = useState([]);
  const [classInstances, setClassInstances] = useState([]);
  const [subjectId, setSubjectId] = useState(qpSubjectId || undefined);
  const [classInstanceId, setClassInstanceId] = useState(qpClassInstanceId || undefined);

  const [syllabus, setSyllabus] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [expandedChapters, setExpandedChapters] = useState(new Set()); // Start empty - no chapters expanded by default

  // Modal states
  const [chapterModal, setChapterModal] = useState({ visible: false, editing: null });
  const [topicModal, setTopicModal] = useState({ visible: false, editing: null, chapterId: null });
  const [importModal, setImportModal] = useState({ visible: false, data: [], loading: false });
  const [copyModal, setCopyModal] = useState({ visible: false, loading: false });
  const [chapterForm] = Form.useForm();
  const [topicForm] = Form.useForm();
  const [copyForm] = Form.useForm();

  const canEdit = role === 'admin' || role === 'superadmin';

  // Bootstrap
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        
        if (!user) {
          throw new Error('Not signed in');
        }

        if (!school_code) {
          throw new Error('School information not found. Please ensure you are properly logged in.');
        }

        // Set me object with extracted data
        setMe({
          id: user.id,
          role: role,
          school_code: school_code
        });

        const [{ data: subs, error: subErr }, { data: cis, error: ciErr }] = await Promise.all([
          supabase
            .from('subjects')
            .select('id, subject_name')
            .eq('school_code', school_code)
            .order('subject_name', { ascending: true }),
          supabase
            .from('class_instances')
            .select('id, grade, section, academic_years(year_start, year_end)')
            .eq('school_code', school_code)
            .order('grade', { ascending: true })
            .order('section', { ascending: true }),
        ]);
        if (subErr) throw subErr;
        if (ciErr) throw ciErr;

        setSubjects(subs || []);
        setClassInstances(cis || []);
      } catch (e) {
        setError(e?.message || 'Failed to initialize');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, school_code, role]);

  // Reset syllabus when subject/class changes (but don't auto-load)
  useEffect(() => {
    if (!school_code || !subjectId || !classInstanceId) {
      setSyllabus(null); 
      setChapters([]); 
      setExpandedChapters(new Set());
      return;
    }
    // Reset syllabus when subject/class changes - user must click "Load Syllabus" to load new one
    setSyllabus(null);
    setChapters([]);
    setExpandedChapters(new Set());
  }, [subjectId, classInstanceId, school_code]);

  const loadSyllabusTree = async () => {
    try {
      setBusy(true); 
      setError(null);
      
      // Validate required parameters
      if (!subjectId || !classInstanceId) {
        throw new Error('Please select both subject and class before loading syllabus');
      }
      
      // First ensure syllabus exists
      const { data: syl, error: se } = await supabase
        .from('syllabi')
        .select('id, subject_id, class_instance_id')
        .eq('school_code', school_code)
        .eq('subject_id', subjectId)
        .eq('class_instance_id', classInstanceId)
        .maybeSingle();
      
      if (se) throw se;
      
      if (!syl) {
        // Create syllabus if it doesn't exist
        const { data: newSyl, error: createErr } = await supabase
          .from('syllabi')
          .insert({
            school_code: school_code,
            subject_id: subjectId,
            class_instance_id: classInstanceId,
            created_by: user.id
          })
          .select('id, subject_id, class_instance_id')
          .single();
        
        if (createErr) {
          if (createErr.code === '23505') {
            // Race condition - reload
            const { data: existing } = await supabase
              .from('syllabi')
              .select('id, subject_id, class_instance_id')
              .eq('school_code', school_code)
              .eq('subject_id', subjectId)
              .eq('class_instance_id', classInstanceId)
              .single();
            setSyllabus(existing);
          } else throw createErr;
        } else {
          setSyllabus(newSyl);
          notification.success({
            message: 'Syllabus Created',
            description: 'New syllabus structure created for this subject and class.',
            placement: 'topRight'
          });
        }
      } else {
        setSyllabus(syl);
      }

      // Load chapters with topics
      const { data: chaps, error: chErr } = await supabase
        .from('syllabus_chapters')
        .select(`
          id, chapter_no, title, description, ref_code,
          syllabus_topics(id, topic_no, title, description, ref_code)
        `)
        .eq('syllabus_id', syl?.id)
        .order('chapter_no', { ascending: true });
      
      if (chErr) throw chErr;
      
      // Sort topics within each chapter
      const sortedChapters = (chaps || []).map(chapter => ({
        ...chapter,
        syllabus_topics: (chapter.syllabus_topics || []).sort((a, b) => a.topic_no - b.topic_no)
      }));
      
      setChapters(sortedChapters);
      
      // Keep chapters collapsed by default - users can expand as needed
    } catch (e) {
      setError(e?.message || 'Failed to load syllabus');
    } finally {
      setBusy(false);
    }
  };

  const subjectOptions = useMemo(
    () => subjects.map(s => ({ label: s.subject_name, value: s.id })).sort(byText('label')),
    [subjects]
  );
  
  const classInstanceOptions = useMemo(
    () => classInstances.map(c => {
      const year = c.academic_years ? `${c.academic_years.year_start}-${c.academic_years.year_end}` : '';
      return { 
        label: `Grade ${c.grade ?? ''}${c.section ? '-' + c.section : ''}${year ? ` (${year})` : ''}`, 
        value: c.id 
      };
    }).sort(byText('label')),
    [classInstances]
  );

  // Validation helpers
  const validateChapterTitle = (title, excludeId = null) => {
    const existing = chapters.find(ch => 
      ch.title.toLowerCase() === title.toLowerCase() && ch.id !== excludeId
    );
    return existing ? 'Chapter title already exists' : null;
  };

  const validateTopicTitle = (title, chapterId, excludeId = null) => {
    const chapter = chapters.find(ch => ch.id === chapterId);
    if (!chapter) return null;
    
    const existing = chapter.syllabus_topics?.find(topic => 
      topic.title.toLowerCase() === title.toLowerCase() && topic.id !== excludeId
    );
    return existing ? 'Topic title already exists in this chapter' : null;
  };

  // Chapter CRUD
  const openChapterModal = (chapter = null) => {
    setChapterModal({ visible: true, editing: chapter });
    if (chapter) {
      chapterForm.setFieldsValue({
        title: chapter.title,
        description: chapter.description,
        ref_code: chapter.ref_code
      });
    } else {
      chapterForm.resetFields();
    }
  };

  const saveChapter = async () => {
    try {
      const values = await chapterForm.validateFields();
      
      // Validate unique title
      const titleError = validateChapterTitle(values.title, chapterModal.editing?.id);
      if (titleError) {
        chapterForm.setFields([{ name: 'title', errors: [titleError] }]);
        return;
      }
      
      if (chapterModal.editing) {
        // Update existing chapter
        const { error } = await supabase
          .from('syllabus_chapters')
          .update({
            title: values.title,
            description: values.description || null,
            ref_code: values.ref_code || null
          })
          .eq('id', chapterModal.editing.id);
        
        if (error) throw error;
        
        notification.success({
          message: 'Chapter Updated',
          description: `"${values.title}" has been updated successfully.`,
          placement: 'topRight'
        });
      } else {
        // Create new chapter
        const nextChapterNo = Math.max(0, ...chapters.map(c => c.chapter_no)) + 1;
        const { data, error } = await supabase
          .from('syllabus_chapters')
          .insert({
            syllabus_id: syllabus.id,
            chapter_no: nextChapterNo,
            title: values.title,
            description: values.description || null,
            ref_code: values.ref_code || null,
            created_by: user.id
          })
          .select('id, chapter_no, title, description, ref_code, syllabus_topics(*)')
          .single();
        
        if (error) throw error;
        
        notification.success({
          message: 'Chapter Created',
          description: `"${values.title}" has been added to your syllabus.`,
          placement: 'topRight'
        });
      }
      
      setChapterModal({ visible: false, editing: null });
      chapterForm.resetFields();
      loadSyllabusTree();
    } catch (e) {
      notification.error({
        message: 'Error',
        description: e?.message || 'Failed to save chapter',
        placement: 'topRight'
      });
    }
  };

  const deleteChapter = async (chapterId, chapterTitle) => {
    try {
      const { error } = await supabase
        .from('syllabus_chapters')
        .delete()
        .eq('id', chapterId);
      
      if (error) throw error;
      
      notification.success({
        message: 'Chapter Deleted',
        description: `"${chapterTitle}" and all its topics have been removed.`,
        placement: 'topRight'
      });
      
      loadSyllabusTree();
    } catch (e) {
      notification.error({
        message: 'Error',
        description: e?.message || 'Failed to delete chapter',
        placement: 'topRight'
      });
    }
  };

  // Topic CRUD
  const openTopicModal = (chapterId, topic = null) => {
    setTopicModal({ visible: true, editing: topic, chapterId });
    if (topic) {
      topicForm.setFieldsValue({
        title: topic.title,
        description: topic.description,
        ref_code: topic.ref_code
      });
    } else {
      topicForm.resetFields();
    }
  };

  const saveTopic = async () => {
    try {
      const values = await topicForm.validateFields();
      
      // Validate unique title
      const titleError = validateTopicTitle(values.title, topicModal.chapterId, topicModal.editing?.id);
      if (titleError) {
        topicForm.setFields([{ name: 'title', errors: [titleError] }]);
        return;
      }
      
      if (topicModal.editing) {
        // Update existing topic
        const { error } = await supabase
          .from('syllabus_topics')
          .update({
            title: values.title,
            description: values.description || null,
            ref_code: values.ref_code || null
          })
          .eq('id', topicModal.editing.id);
        
        if (error) throw error;
        
        notification.success({
          message: 'Topic Updated',
          description: `"${values.title}" has been updated successfully.`,
          placement: 'topRight'
        });
      } else {
        // Create new topic
        const chapter = chapters.find(c => c.id === topicModal.chapterId);
        const nextTopicNo = Math.max(0, ...(chapter?.syllabus_topics || []).map(t => t.topic_no)) + 1;
        const { error } = await supabase
          .from('syllabus_topics')
          .insert({
            chapter_id: topicModal.chapterId,
            topic_no: nextTopicNo,
            title: values.title,
            description: values.description || null,
            ref_code: values.ref_code || null,
            created_by: user.id
          });
        
        if (error) throw error;
        
        notification.success({
          message: 'Topic Created',
          description: `"${values.title}" has been added to the chapter.`,
          placement: 'topRight'
        });
      }
      
      setTopicModal({ visible: false, editing: null, chapterId: null });
      topicForm.resetFields();
      loadSyllabusTree();
    } catch (e) {
      notification.error({
        message: 'Error',
        description: e?.message || 'Failed to save topic',
        placement: 'topRight'
      });
    }
  };

  const deleteTopic = async (topicId, topicTitle) => {
    try {
      const { error } = await supabase
        .from('syllabus_topics')
        .delete()
        .eq('id', topicId);
      
      if (error) throw error;
      
      notification.success({
        message: 'Topic Deleted',
        description: `"${topicTitle}" has been removed.`,
        placement: 'topRight'
      });
      
      loadSyllabusTree();
    } catch (e) {
      notification.error({
        message: 'Error',
        description: e?.message || 'Failed to delete topic',
        placement: 'topRight'
      });
    }
  };

  const toggleChapterExpansion = (chapterId) => {
    const newExpanded = new Set(expandedChapters);
    if (newExpanded.has(chapterId)) {
      newExpanded.delete(chapterId);
    } else {
      newExpanded.add(chapterId);
    }
    setExpandedChapters(newExpanded);
  };

  // Download template
  const downloadTemplate = () => {
    const templateData = [
      {
        'Chapter Number': 1,
        'Chapter Title': 'Introduction to Algebra',
        'Chapter Description': 'Basic concepts of algebra including variables, expressions, and equations',
        'Chapter Ref Code': 'CH01',
        'Topic Number': 1,
        'Topic Title': 'Variables and Expressions',
        'Topic Description': 'Understanding variables, constants, and algebraic expressions',
        'Topic Ref Code': 'T1.1'
      },
      {
        'Chapter Number': 1,
        'Chapter Title': 'Introduction to Algebra',
        'Chapter Description': 'Basic concepts of algebra including variables, expressions, and equations',
        'Chapter Ref Code': 'CH01',
        'Topic Number': 2,
        'Topic Title': 'Order of Operations',
        'Topic Description': 'PEMDAS rules and evaluating expressions',
        'Topic Ref Code': 'T1.2'
      },
      {
        'Chapter Number': 2,
        'Chapter Title': 'Linear Equations',
        'Chapter Description': 'Solving linear equations in one and two variables',
        'Chapter Ref Code': 'CH02',
        'Topic Number': 1,
        'Topic Title': 'One-Variable Linear Equations',
        'Topic Description': 'Solving equations with one variable',
        'Topic Ref Code': 'T2.1'
      },
      {
        'Chapter Number': 2,
        'Chapter Title': 'Linear Equations',
        'Chapter Description': 'Solving linear equations in one and two variables',
        'Chapter Ref Code': 'CH02',
        'Topic Number': 2,
        'Topic Title': 'Two-Variable Linear Equations',
        'Topic Description': 'Systems of linear equations',
        'Topic Ref Code': 'T2.2'
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(wb, ws, 'Syllabus Template');

    XLSX.writeFile(wb, 'Syllabus_Import_Template.xlsx');

    notification.success({
      message: 'Template Downloaded',
      description: 'Syllabus import template downloaded successfully.',
      placement: 'topRight'
    });
  };

  // Export functionality
  const exportSyllabus = () => {
    if (!syllabus || chapters.length === 0) {
      notification.warning({
        message: 'No Data to Export',
        description: 'Please create some chapters and topics before exporting.',
        placement: 'topRight'
      });
      return;
    }

    const exportData = [];
    
    chapters.forEach(chapter => {
      if (chapter.syllabus_topics && chapter.syllabus_topics.length > 0) {
        chapter.syllabus_topics.forEach(topic => {
          exportData.push({
            'Chapter Number': chapter.chapter_no,
            'Chapter Title': chapter.title,
            'Chapter Description': chapter.description || '',
            'Chapter Ref Code': chapter.ref_code || '',
            'Topic Number': topic.topic_no,
            'Topic Title': topic.title,
            'Topic Description': topic.description || '',
            'Topic Ref Code': topic.ref_code || ''
          });
        });
      } else {
        // Chapter without topics
        exportData.push({
          'Chapter Number': chapter.chapter_no,
          'Chapter Title': chapter.title,
          'Chapter Description': chapter.description || '',
          'Chapter Ref Code': chapter.ref_code || '',
          'Topic Number': '',
          'Topic Title': '',
          'Topic Description': '',
          'Topic Ref Code': ''
        });
      }
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, 'Syllabus');

    // Generate filename
    const subjectName = getSelectedSubjectName().replace(/[^a-zA-Z0-9]/g, '_');
    const className = getSelectedClassName().replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Syllabus_${subjectName}_${className}_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Download file
    XLSX.writeFile(wb, filename);

    notification.success({
      message: 'Export Successful',
      description: `Syllabus exported as ${filename}`,
      placement: 'topRight'
    });
  };

  // Import functionality
  const handleFileUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Validate and parse the data
        const parsedData = parseImportData(jsonData);
        setImportModal({ visible: true, data: parsedData, loading: false });
      } catch (error) {
        notification.error({
          message: 'Import Error',
          description: 'Failed to parse the file. Please check the format.',
          placement: 'topRight'
        });
      }
    };
    reader.readAsArrayBuffer(file);
    return false; // Prevent default upload
  };

  const parseImportData = (jsonData) => {
    const chaptersMap = new Map();
    
    jsonData.forEach((row, index) => {
      // Validate required fields
      if (!row['Chapter Number'] || !row['Chapter Title']) {
        throw new Error(`Row ${index + 2}: Chapter Number and Chapter Title are required`);
      }

      const chapterKey = `${row['Chapter Number']}-${row['Chapter Title']}`;
      
      if (!chaptersMap.has(chapterKey)) {
        chaptersMap.set(chapterKey, {
          chapter_no: parseInt(row['Chapter Number']),
          title: row['Chapter Title'],
          description: row['Chapter Description'] || '',
          ref_code: row['Chapter Ref Code'] || '',
          topics: []
        });
      }

      // Add topic if it exists
      if (row['Topic Number'] && row['Topic Title']) {
        chaptersMap.get(chapterKey).topics.push({
          topic_no: parseInt(row['Topic Number']),
          title: row['Topic Title'],
          description: row['Topic Description'] || '',
          ref_code: row['Topic Ref Code'] || ''
        });
      }
    });

    return Array.from(chaptersMap.values()).sort((a, b) => a.chapter_no - b.chapter_no);
  };

  const importSyllabus = async () => {
    if (!syllabus || importModal.data.length === 0) return;

    try {
      setImportModal(prev => ({ ...prev, loading: true }));

      // Delete existing chapters (cascade will delete topics)
      await supabase
        .from('syllabus_chapters')
        .delete()
        .eq('syllabus_id', syllabus.id);

      // Import new chapters and topics
      for (const chapterData of importModal.data) {
        // Create chapter
        const { data: newChapter, error: chapterError } = await supabase
          .from('syllabus_chapters')
          .insert({
            syllabus_id: syllabus.id,
            chapter_no: chapterData.chapter_no,
            title: chapterData.title,
            description: chapterData.description || null,
            ref_code: chapterData.ref_code || null,
            created_by: user.id
          })
          .select('id')
          .single();

        if (chapterError) throw chapterError;

        // Create topics for this chapter
        if (chapterData.topics && chapterData.topics.length > 0) {
          const topicsData = chapterData.topics.map(topic => ({
            chapter_id: newChapter.id,
            topic_no: topic.topic_no,
            title: topic.title,
            description: topic.description || null,
            ref_code: topic.ref_code || null,
            created_by: user.id
          }));

          const { error: topicsError } = await supabase
            .from('syllabus_topics')
            .insert(topicsData);

          if (topicsError) throw topicsError;
        }
      }

      setImportModal({ visible: false, data: [], loading: false });
      
      notification.success({
        message: 'Import Successful',
        description: `Imported ${importModal.data.length} chapters with topics.`,
        placement: 'topRight'
      });

      loadSyllabusTree();
    } catch (error) {
      setImportModal(prev => ({ ...prev, loading: false }));
      notification.error({
        message: 'Import Error',
        description: error?.message || 'Failed to import syllabus data',
        placement: 'topRight'
      });
    }
  };

  // Copy syllabus functionality
  const openCopyModal = () => {
    setCopyModal({ visible: true, loading: false });
    copyForm.resetFields();
  };

  const copySyllabus = async () => {
    try {
      const values = await copyForm.validateFields();
      setCopyModal(prev => ({ ...prev, loading: true }));

      // Get the source syllabus
      const { data: sourceSyllabus, error: sourceError } = await supabase
        .from('syllabi')
        .select('id')
        .eq('school_code', school_code)
        .eq('subject_id', values.sourceSubjectId)
        .eq('class_instance_id', values.sourceClassInstanceId)
        .single();

      if (sourceError || !sourceSyllabus) {
        throw new Error('Source syllabus not found');
      }

      // Get source chapters and topics
      const { data: sourceChapters, error: chaptersError } = await supabase
        .from('syllabus_chapters')
        .select(`
          chapter_no,
          title,
          description,
          ref_code,
          syllabus_topics (
            topic_no,
            title,
            description,
            ref_code
          )
        `)
        .eq('syllabus_id', sourceSyllabus.id)
        .order('chapter_no');

      if (chaptersError) throw chaptersError;

      // Delete existing chapters in target syllabus (cascade will delete topics)
      await supabase
        .from('syllabus_chapters')
        .delete()
        .eq('syllabus_id', syllabus.id);

      // Copy chapters and topics
      for (const chapter of sourceChapters || []) {
        // Create chapter
        const { data: newChapter, error: chapterError } = await supabase
          .from('syllabus_chapters')
          .insert({
            syllabus_id: syllabus.id,
            chapter_no: chapter.chapter_no,
            title: chapter.title,
            description: chapter.description,
            ref_code: chapter.ref_code,
            created_by: user.id
          })
          .select('id')
          .single();

        if (chapterError) throw chapterError;

        // Copy topics
        if (chapter.syllabus_topics && chapter.syllabus_topics.length > 0) {
          const topicsData = chapter.syllabus_topics.map(topic => ({
            chapter_id: newChapter.id,
            topic_no: topic.topic_no,
            title: topic.title,
            description: topic.description,
            ref_code: topic.ref_code,
            created_by: user.id
          }));

          const { error: topicsError } = await supabase
            .from('syllabus_topics')
            .insert(topicsData);

          if (topicsError) throw topicsError;
        }
      }

      setCopyModal({ visible: false, loading: false });
      
      notification.success({
        message: 'Syllabus Copied Successfully',
        description: `Copied ${sourceChapters?.length || 0} chapters with topics from the selected class.`,
        placement: 'topRight'
      });

      loadSyllabusTree();
    } catch (error) {
      setCopyModal(prev => ({ ...prev, loading: false }));
      notification.error({
        message: 'Copy Failed',
        description: error?.message || 'Failed to copy syllabus',
        placement: 'topRight'
      });
    }
  };

  const getSelectedSubjectName = () => {
    return subjects.find(s => s.id === subjectId)?.subject_name || '';
  };

  const getSelectedClassName = () => {
    const selected = classInstances.find(c => c.id === classInstanceId);
    if (!selected) return '';
    const year = selected.academic_years ? `${selected.academic_years.year_start}-${selected.academic_years.year_end}` : '';
    return `Grade ${selected.grade ?? ''}${selected.section ? '-' + selected.section : ''}${year ? ` (${year})` : ''}`;
  };

  return (
    <div style={{ 
      padding: '24px', 
      minHeight: '100vh',
      background: '#f8fafc'
    }}>
      <div style={{ 
        maxWidth: '1400px', 
        margin: '0 auto',
        width: '100%'
      }}>
        {ctx}
      
      {/* Header */}
      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={2} style={{ 
              margin: 0, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 12,
              fontSize: '28px',
              lineHeight: '1.3'
            }}>
              <BookOutlined style={{ color: '#1890ff', fontSize: '24px' }} />
              Syllabus Structure
            </Title>
            <Text type="secondary" style={{ 
              fontSize: '16px',
              lineHeight: '1.5',
              display: 'block',
              marginTop: '8px'
            }}>
              Create and manage chapters and topics for your subjects
            </Text>
          </div>

          {error && (
            <Alert 
              type="error" 
              showIcon 
              message="Error" 
              description={error} 
              action={
                <Button size="small" onClick={loadSyllabusTree}>
                  Retry
                </Button>
              }
            />
          )}

          {/* Subject and Class Selectors */}
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ 
                display: 'block', 
                marginBottom: 8,
                fontSize: '16px',
                lineHeight: '1.4'
              }}>
                Select Subject & Class to View Syllabus
              </Text>
              <Text type="secondary" style={{ 
                fontSize: '14px',
                lineHeight: '1.5',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <InfoCircleOutlined style={{ fontSize: '14px' }} />
                Choose a subject and class combination to create or edit the syllabus structure
              </Text>
            </div>
            
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <div>
                  <Text strong style={{ 
                    display: 'block', 
                    marginBottom: 8,
                    fontSize: '14px'
                  }}>Subject</Text>
                  <Select 
                    style={{ width: '100%' }} 
                    showSearch 
                    placeholder="Choose a subject"
                    value={subjectId} 
                    onChange={setSubjectId}
                    options={subjectOptions} 
                    optionFilterProp="label"
                    size="large"
                  />
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <div>
                  <Text strong style={{ 
                    display: 'block', 
                    marginBottom: 8,
                    fontSize: '14px'
                  }}>Class</Text>
                  <Select 
                    style={{ width: '100%' }} 
                    showSearch 
                    placeholder="Choose a class"
                    value={classInstanceId} 
                    onChange={setClassInstanceId}
                    options={classInstanceOptions} 
                    optionFilterProp="label"
                    size="large"
                  />
                </div>
              </Col>
            </Row>

            {/* Load Syllabus Button */}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <Button 
                type="primary" 
                size="large"
                disabled={!subjectId || !classInstanceId}
                onClick={loadSyllabusTree}
                loading={busy}
                style={{ 
                  fontSize: '14px', 
                  height: '40px',
                  minWidth: '120px'
                }}
              >
                Load Syllabus
              </Button>
            </div>

            {/* Context Display */}
            {syllabus && (
              <div style={{ 
                marginTop: 16, 
                padding: 12, 
                background: '#f6ffed', 
                border: '1px solid #b7eb8f', 
                borderRadius: 6 
              }}>
                <Space>
                  <EyeOutlined style={{ color: '#52c41a' }} />
                  <Text strong style={{ color: '#389e0d' }}>
                    Viewing syllabus for: {getSelectedSubjectName()} • {getSelectedClassName()}
                  </Text>
                </Space>
              </div>
            )}
          </div>
        </Space>
      </Card>

      {/* Syllabus Content */}
      {busy && <Skeleton active paragraph={{ rows: 6 }} />}

      {syllabus && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <Title level={4} style={{ 
                margin: 0,
                fontSize: '20px',
                lineHeight: '1.3',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <BookOutlined style={{ fontSize: '18px' }} />
                Chapters & Topics
              </Title>
              <Text type="secondary" style={{
                fontSize: '14px',
                lineHeight: '1.5',
                display: 'block',
                marginTop: '4px'
              }}>
                {chapters.length} chapter{chapters.length !== 1 ? 's' : ''} • {' '}
                {chapters.reduce((total, ch) => total + (ch.syllabus_topics?.length || 0), 0)} topics
              </Text>
            </div>
            {canEdit && (
              <Space wrap>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />} 
                  onClick={() => openChapterModal()}
                  size="large"
                  style={{ 
                    fontSize: '14px', 
                    height: '40px',
                    minWidth: '120px'
                  }}
                >
                  Add Chapter
                </Button>
                <Button 
                  icon={<CopyOutlined />}
                  onClick={openCopyModal}
                  size="large"
                  style={{ 
                    fontSize: '14px', 
                    height: '40px',
                    minWidth: '140px'
                  }}
                >
                  Copy from Existing Class
                </Button>
                <Button 
                  icon={<DownloadOutlined />} 
                  onClick={exportSyllabus}
                  size="large"
                  style={{ 
                    fontSize: '14px', 
                    height: '40px',
                    minWidth: '100px'
                  }}
                >
                  Export
                </Button>
                <Upload
                  accept=".xlsx,.xls,.csv"
                  beforeUpload={handleFileUpload}
                  showUploadList={false}
                >
                  <Button 
                    icon={<UploadOutlined />} 
                    size="large"
                    style={{ 
                      fontSize: '14px', 
                      height: '40px',
                      minWidth: '100px'
                    }}
                  >
                    Import
                  </Button>
                </Upload>
                <Tooltip title="Download import template">
                  <Button 
                    icon={<FileExcelOutlined />} 
                    onClick={downloadTemplate}
                    size="large"
                    style={{ 
                      fontSize: '14px', 
                      height: '40px',
                      minWidth: '100px'
                    }}
                  >
                    Template
                  </Button>
                </Tooltip>
              </Space>
            )}
          </div>

          {chapters.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <EmptyState
                type="syllabus"
                onAction={() => openChapterModal()}
              />
            </div>
          ) : (
            <Collapse 
              activeKey={Array.from(expandedChapters)}
              onChange={(keys) => setExpandedChapters(new Set(keys))}
              ghost
            >
              {chapters.map((chapter) => (
                <Panel
                  key={chapter.id}
                  header={
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 12,
                      flexWrap: 'wrap',
                      minHeight: '40px'
                    }}>
                      <Tag color="blue" style={{ margin: 0, fontSize: '12px' }}>
                        Chapter {chapter.chapter_no}
                      </Tag>
                      <Title level={5} style={{ 
                        margin: 0, 
                        fontWeight: 600,
                        fontSize: '16px',
                        lineHeight: '1.4',
                        wordBreak: 'break-word'
                      }}>
                        {chapter.title}
                      </Title>
                      {chapter.ref_code && (
                        <Tag color="geekblue" style={{ fontSize: '12px' }}>
                          {chapter.ref_code}
                        </Tag>
                      )}
                      <Text type="secondary" style={{ fontSize: '13px' }}>
                        ({chapter.syllabus_topics?.length || 0} topics)
                      </Text>
                    </div>
                  }
                  extra={
                    canEdit && (
                      <Space onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Add Topic">
                          <Button
                            size="small"
                            icon={<PlusOutlined />}
                            onClick={() => openTopicModal(chapter.id)}
                          >
                            Add Topic
                          </Button>
                        </Tooltip>
                        <Tooltip title="Edit Chapter">
                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => openChapterModal(chapter)}
                          />
                        </Tooltip>
                        <Popconfirm
                          title="Delete this chapter and all its topics?"
                          description="This action cannot be undone. All topics in this chapter will also be deleted."
                          onConfirm={() => deleteChapter(chapter.id, chapter.title)}
                          okText="Delete"
                          cancelText="Cancel"
                          okButtonProps={{ danger: true }}
                        >
                          <Tooltip title="Delete Chapter">
                            <Button
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                            />
                          </Tooltip>
                        </Popconfirm>
                      </Space>
                    )
                  }
                >
                  {chapter.description && (
                    <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 6 }}>
                      <Text type="secondary">{chapter.description}</Text>
                    </div>
                  )}
                  
                  {chapter.syllabus_topics?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {chapter.syllabus_topics.map(topic => (
                        <div 
                          key={topic.id}
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            padding: '12px 16px',
                            background: 'white',
                            borderRadius: 6,
                            border: '1px solid #f0f0f0'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <Space align="baseline">
                              <Tag color="green" style={{ margin: 0 }}>
                                Topic {topic.topic_no}
                              </Tag>
                              <Text strong style={{ fontSize: '14px' }}>
                                {topic.title}
                              </Text>
                              {topic.ref_code && (
                                <Tag color="lime">{topic.ref_code}</Tag>
                              )}
                            </Space>
                            {topic.description && (
                              <div style={{ marginTop: 4 }}>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                  {topic.description}
                                </Text>
                              </div>
                            )}
                          </div>
                          
                          {canEdit && (
                            <Space>
                              <Tooltip title="Edit Topic">
                                <Button
                                  size="small"
                                  icon={<EditOutlined />}
                                  onClick={() => openTopicModal(chapter.id, topic)}
                                />
                              </Tooltip>
                              <Popconfirm
                                title="Delete this topic?"
                                description="This action cannot be undone."
                                onConfirm={() => deleteTopic(topic.id, topic.title)}
                                okText="Delete"
                                cancelText="Cancel"
                                okButtonProps={{ danger: true }}
                              >
                                <Tooltip title="Delete Topic">
                                  <Button
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                  />
                                </Tooltip>
                              </Popconfirm>
                            </Space>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '20px',
                      background: '#fafafa',
                      borderRadius: 6
                    }}>
                      <FileTextOutlined style={{ color: '#d9d9d9', marginBottom: 8 }} />
                      <div>
                        <Text type="secondary">No topics yet</Text>
                        {canEdit && (
                          <div style={{ marginTop: 8 }}>
                            <Button
                              size="small"
                              type="dashed"
                              icon={<PlusOutlined />}
                              onClick={() => openTopicModal(chapter.id)}
                            >
                              Add First Topic
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Panel>
              ))}
            </Collapse>
          )}
        </Card>
      )}

      {/* Chapter Modal */}
      <Modal
        title={
          <Space>
            <BookOutlined />
            {chapterModal.editing ? 'Edit Chapter' : 'Add Chapter'}
          </Space>
        }
        open={chapterModal.visible}
        onCancel={() => {
          setChapterModal({ visible: false, editing: null });
          chapterForm.resetFields();
        }}
        onOk={saveChapter}
        okText="Save Chapter"
        width={600}
      >
        <Form form={chapterForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label="Chapter Title"
            rules={[
              { required: true, message: 'Please enter chapter title' },
              { max: 200, message: 'Title must be less than 200 characters' }
            ]}
          >
            <Input 
              placeholder="e.g., Introduction to Algebra" 
              maxLength={200}
              size="large"
            />
          </Form.Item>
          <Form.Item
            name="description"
            label="Description (optional)"
          >
            <TextArea 
              placeholder="Brief description of the chapter content"
              rows={3}
            />
          </Form.Item>
          <Form.Item
            name="ref_code"
            label="Reference Code (optional)"
          >
            <Input placeholder="e.g., CH01, TEXT-1.1" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Topic Modal */}
      <Modal
        title={
          <Space>
            <FileTextOutlined />
            {topicModal.editing ? 'Edit Topic' : 'Add Topic'}
          </Space>
        }
        open={topicModal.visible}
        onCancel={() => {
          setTopicModal({ visible: false, editing: null, chapterId: null });
          topicForm.resetFields();
        }}
        onOk={saveTopic}
        okText="Save Topic"
        width={600}
      >
        <Form form={topicForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label="Topic Title"
            rules={[
              { required: true, message: 'Please enter topic title' },
              { max: 200, message: 'Title must be less than 200 characters' }
            ]}
          >
            <Input 
              placeholder="e.g., Linear Equations" 
              maxLength={200}
              size="large"
            />
          </Form.Item>
          <Form.Item
            name="description"
            label="Description (optional)"
          >
            <TextArea 
              placeholder="Brief description of the topic content"
              rows={3}
            />
          </Form.Item>
          <Form.Item
            name="ref_code"
            label="Reference Code (optional)"
          >
            <Input placeholder="e.g., T01, EX-1.1" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Import Preview Modal */}
      <Modal
        title={
          <Space>
            <FileExcelOutlined />
            Import Syllabus Preview
          </Space>
        }
        open={importModal.visible}
        onCancel={() => setImportModal({ visible: false, data: [], loading: false })}
        onOk={importSyllabus}
        okText="Import Syllabus"
        cancelText="Cancel"
        width={800}
        confirmLoading={importModal.loading}
      >
        <div style={{ marginBottom: 16 }}>
          <Alert
            message="Import Preview"
            description="Review the data below before importing. This will replace all existing chapters and topics."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Text strong>
            Found {importModal.data.length} chapters with{' '}
            {importModal.data.reduce((total, ch) => total + (ch.topics?.length || 0), 0)} topics
          </Text>
        </div>

        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {importModal.data.map((chapter, index) => (
            <Card key={index} size="small" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <Tag color="blue">Chapter {chapter.chapter_no}</Tag>
                <Text strong>{chapter.title}</Text>
                {chapter.ref_code && <Tag color="geekblue">{chapter.ref_code}</Tag>}
              </div>
              
              {chapter.description && (
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  {chapter.description}
                </Text>
              )}

              {chapter.topics && chapter.topics.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Topics ({chapter.topics.length}):
                  </Text>
                  <div style={{ marginTop: 4 }}>
                    {chapter.topics.map((topic, topicIndex) => (
                      <div key={topicIndex} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 8, 
                        marginBottom: 4,
                        padding: '4px 8px',
                        background: '#fafafa',
                        borderRadius: 4
                      }}>
                        <Tag color="green" style={{ margin: 0 }}>
                          Topic {topic.topic_no}
                        </Tag>
                        <Text style={{ fontSize: '12px' }}>{topic.title}</Text>
                        {topic.ref_code && <Tag color="lime" style={{ margin: 0 }}>{topic.ref_code}</Tag>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      </Modal>

      {/* Copy Syllabus Modal */}
      <Modal
        title={
          <Space>
            <CopyOutlined />
            Copy Syllabus from Existing Class
          </Space>
        }
        open={copyModal.visible}
        onCancel={() => setCopyModal({ visible: false, loading: false })}
        onOk={copySyllabus}
        okText="Copy Syllabus"
        cancelText="Cancel"
        confirmLoading={copyModal.loading}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Alert
            message="Copy Syllabus Structure"
            description="Select a subject and class to copy the complete syllabus structure (chapters and topics) to the current syllabus. This will replace all existing content."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        </div>

        <Form form={copyForm} layout="vertical">
          <Form.Item
            name="sourceSubjectId"
            label="Source Subject"
            rules={[{ required: true, message: 'Please select a subject' }]}
          >
            <Select 
              placeholder="Choose source subject"
              options={subjectOptions}
              optionFilterProp="label"
              showSearch
            />
          </Form.Item>

          <Form.Item
            name="sourceClassInstanceId"
            label="Source Class"
            rules={[{ required: true, message: 'Please select a class' }]}
          >
            <Select 
              placeholder="Choose source class"
              options={classInstanceOptions}
              optionFilterProp="label"
              showSearch
            />
          </Form.Item>
        </Form>

        <div style={{ 
          marginTop: 16, 
          padding: 12, 
          background: '#fff7e6', 
          border: '1px solid #ffd591', 
          borderRadius: 6 
        }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            <InfoCircleOutlined style={{ marginRight: 4 }} />
            This will copy all chapters and topics from the selected class and replace the current syllabus content.
          </Text>
        </div>
      </Modal>
      </div>
    </div>
  );
}