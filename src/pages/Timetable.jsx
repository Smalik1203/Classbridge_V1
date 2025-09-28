// src/pages/Timetable.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Card, DatePicker, Select, Space, Typography, Tabs, message, Tag, Button } from 'antd';
import { LeftOutlined, RightOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { supabase } from '../config/supabaseClient';
import ManageTab from '../components/timetable/ManageTab.jsx';
import ViewTab from '../components/timetable/ViewTab.jsx';
import EmptyState from '../ui/EmptyState';

const { Text } = Typography;

export default function Timetable() {
  const [msg, ctx] = message.useMessage();

  // auth context
  const [me, setMe] = useState(null);

  // filters
  const [classId, setClassId] = useState(null);
  const [date, setDate] = useState(dayjs());
  const dateStr = useMemo(() => date?.format('YYYY-MM-DD'), [date]);

  // lists
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [admins, setAdmins] = useState([]);

  // date-based timetable slots (periods & breaks)
  const [daySlots, setDaySlots] = useState([]);
  // chapter index: Map<syllabus_item_id, { unit_no, title, status, subject_id }>
  const [chaptersById, setChaptersById] = useState(new Map());
  // syllabus content map: Map<content_key, { type, chapterId, topicId, chapterNo, topicNo, title }>
  const [syllabusContentMap, setSyllabusContentMap] = useState(new Map());

  // bootstrap
  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) throw new Error('Not signed in');
        
        // Try admin table first; fallback to users table for superadmins without admin row
        let meRow = null;
        const { data: adminRow, error: adminErr } = await supabase
          .from('admin').select('id, role, school_code').eq('id', auth.user.id).maybeSingle();
        if (adminRow) {
          meRow = adminRow;
        } else {
          const { data: userRow, error: userErr } = await supabase
            .from('users').select('role, school_code').eq('id', auth.user.id).maybeSingle();
          if (userErr) throw userErr;
          meRow = {
            id: auth.user.id,
            role: userRow?.role || auth.user.raw_app_meta_data?.role || auth.user.app_metadata?.role || auth.user.raw_user_meta_data?.role || auth.user.user_metadata?.role || null,
            school_code: userRow?.school_code || auth.user.raw_app_meta_data?.school_code || auth.user.app_metadata?.school_code || auth.user.raw_user_meta_data?.school_code || auth.user.user_metadata?.school_code || null,
          };
        }
        if (!meRow?.school_code) throw new Error('No school context found for your account');
        setMe(meRow);
        


        // Role-based class fetching
        let classQuery = supabase.from('class_instances')
          .select('id, grade, section')
          .eq('school_code', meRow.school_code)
          .order('grade')
          .order('section');

        // For students, only show classes they are enrolled in
        if (meRow.role === 'student') {
          // Get student's enrolled class - try by email first, then by student_code
          const studentCode = auth.user.user_metadata?.student_code;
          
          let studentData = null;
          
          // Try multiple approaches to find the student
          if (studentCode) {
            // First try: student_code + school_code
            const { data, error } = await supabase
              .from('student')
              .select('class_instance_id, school_code, student_code, email')
              .eq('student_code', studentCode)
              .eq('school_code', meRow.school_code)
              .maybeSingle();
            
            if (!error && data) {
              studentData = data;
            } else {
              // Second try: student_code only
              const { data: data2, error: error2 } = await supabase
                .from('student')
                .select('class_instance_id, school_code, student_code, email')
                .eq('student_code', studentCode)
                .maybeSingle();
              
              if (!error2 && data2) {
                studentData = data2;
                if (data2.school_code !== meRow.school_code) {
                  msg.error('Student record found but school mismatch. Please contact your administrator.');
                  return;
                }
              }
            }
          }
          
          // If still not found, try email
          if (!studentData && auth.user.email) {
            const { data, error } = await supabase
              .from('student')
              .select('class_instance_id, school_code, student_code, email')
              .eq('email', auth.user.email)
              .eq('school_code', meRow.school_code)
              .maybeSingle();
            
            if (!error && data) {
              studentData = data;
            } else {
              // Try email only
              const { data: data2, error: error2 } = await supabase
                .from('student')
                .select('class_instance_id, school_code, student_code, email')
                .eq('email', auth.user.email)
                .maybeSingle();
              
              if (!error2 && data2) {
                studentData = data2;
                if (data2.school_code !== meRow.school_code) {
                  msg.error('Student record found but school mismatch. Please contact your administrator.');
                  return;
                }
              }
            }
          }
          
          if (!studentData) {
            msg.error('Could not find your student record. Please contact your administrator.');
            return;
          }

          if (!studentData.class_instance_id) {
            msg.warning('You are not enrolled in any class. Please contact your administrator.');
            setClasses([]);
            setSubjects([]);
            setTeachers([]);
            return;
          }

          // Filter classes to only show student's enrolled class
          const { data: ci, error: ciErr } = await classQuery.eq('id', studentData.class_instance_id);
          if (ciErr) throw ciErr;
          setClasses(ci ?? []);
          
          // Auto-select the student's class
          setClassId(studentData.class_instance_id);
        } else if (meRow.role === 'admin') {
          // Admins: only classes assigned to them (class_teacher_id = admin id)
          const { data: ci, error: ciErr } = await classQuery.eq('class_teacher_id', meRow.id);
          if (ciErr) throw ciErr;
          setClasses(ci ?? []);
        } else {
          // Superadmin: all classes in their school
          const { data: ci, error: ciErr } = await classQuery;
          if (ciErr) throw ciErr;
          setClasses(ci ?? []);
        }

        // Fetch subjects and admins (same for all roles)
        const [{ data: subs }, { data: staff }] = await Promise.all([
          supabase.from('subjects')
            .select('id, subject_name').eq('school_code', meRow.school_code)
            .order('subject_name'),
          supabase.from('admin')
            .select('id, full_name').eq('school_code', meRow.school_code)
            .order('full_name'),
        ]);

        setSubjects(subs ?? []);
        setAdmins(staff ?? []);
      } catch (e) {
        console.error('Timetable initialization error:', e);
        msg.error('Timetable feature requires additional database tables. Please contact your administrator.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fetch day slots (periods + breaks) for classId/dateStr
  async function fetchDaySlots() {
    if (!classId || !dateStr) return setDaySlots([]);
    try {
      // First try with new columns, fallback to basic columns if they don't exist
      let { data, error } = await supabase
        .from('timetable_slots')
        .select(`
          id, class_instance_id, class_date, period_number,
          slot_type, name, start_time, end_time,
          subject_id, teacher_id, syllabus_item_id, plan_text, status
        `)
        .eq('class_instance_id', classId)
        .eq('class_date', dateStr)
        .order('start_time', { ascending: true })
        .order('period_number', { ascending: true });

      // If the basic query works, try to get the new columns separately
      if (!error && data) {
        try {
          const { data: extendedData, error: extendedError } = await supabase
            .from('timetable_slots')
            .select(`id, syllabus_chapter_id, syllabus_topic_id`)
            .eq('class_instance_id', classId)
            .eq('class_date', dateStr);
          
          if (!extendedError && extendedData) {
            // Merge the extended data
            // console.log('Extended data from DB:', extendedData);
            data = data.map(slot => {
              const extended = extendedData.find(e => e.id === slot.id);
              const merged = {
                ...slot,
                syllabus_chapter_id: extended?.syllabus_chapter_id || null,
                syllabus_topic_id: extended?.syllabus_topic_id || null,
              };
              // if (extended?.syllabus_chapter_id) {
              //   console.log(`Merged slot ${slot.id}:`, merged);
              // }
              return merged;
            });
          }
        } catch (extendedErr) {
          // New columns don't exist yet, continue with basic data
          // console.log('New syllabus columns not available yet:', extendedErr.message);
        }
      }
      if (error) { 
        console.error('timetable_slots table error:', error);
        msg.error('Timetable slots table not available');
        return; 
      }
      setDaySlots(data ?? []);
    } catch (e) {
      console.error('fetchDaySlots error:', e);
      setDaySlots([]);
    }
  }

  // build chapters index for class (so we can resolve chapter name in tables)
  async function fetchChaptersIndex() {
    if (!classId) return setChaptersById(new Map());
    try {
      const { data: syllabi, error: sylErr } = await supabase
        .from('syllabi').select('id, subject_id').eq('class_instance_id', classId);
      if (sylErr) { 
        console.error('syllabi table error:', sylErr);
        setChaptersById(new Map());
        return; 
      }
      const ids = (syllabi ?? []).map(s => s.id);
      if (!ids.length) return setChaptersById(new Map());

      const { data: items, error: itErr } = await supabase
        .from('syllabus_items')
        .select('id, syllabus_id, unit_no, title, status')
        .in('syllabus_id', ids);
      if (itErr) { 
        console.error('syllabus_items table error:', itErr);
        setChaptersById(new Map());
        return; 
      }

      const byId = new Map();
      const subjBySyl = new Map((syllabi ?? []).map(s => [s.id, s.subject_id]));
      for (const ch of (items ?? [])) {
        byId.set(ch.id, {
          unit_no: ch.unit_no,
          title: ch.title,
          status: ch.status,
          subject_id: subjBySyl.get(ch.syllabus_id) || null,
        });
      }
      setChaptersById(byId);
    } catch (e) {
      console.error('fetchChaptersIndex error:', e);
      setChaptersById(new Map());
    }
  }

  // build syllabus content map for new structure (chapters and topics)
  async function fetchSyllabusContentMap() {
    if (!classId) return setSyllabusContentMap(new Map());
    try {
      const { data: syllabi, error: sylErr } = await supabase
        .from('syllabi').select('id, subject_id').eq('class_instance_id', classId);
      if (sylErr) { 
        console.error('syllabi table error:', sylErr);
        setSyllabusContentMap(new Map());
        return; 
      }
      const ids = (syllabi ?? []).map(s => s.id);
      if (!ids.length) return setSyllabusContentMap(new Map());

      // Get chapters with their topics
      const { data: chapters, error: chErr } = await supabase
        .from('syllabus_chapters')
        .select(`
          id, chapter_no, title, description,
          syllabus_topics(id, topic_no, title, description)
        `)
        .in('syllabus_id', ids)
        .order('chapter_no');
      
      if (chErr) { 
        console.error('syllabus_chapters table error:', chErr);
        setSyllabusContentMap(new Map());
        return; 
      }

      const contentMap = new Map();
      (chapters || []).forEach(chapter => {
        // Add chapter to map
        contentMap.set(`chapter_${chapter.id}`, {
          type: 'chapter',
          chapterId: chapter.id,
          chapterNo: chapter.chapter_no,
          title: chapter.title
        });
        
        // Add topics to map
        (chapter.syllabus_topics || []).forEach(topic => {
          contentMap.set(`topic_${topic.id}`, {
            type: 'topic',
            chapterId: chapter.id,
            topicId: topic.id,
            chapterNo: chapter.chapter_no,
            topicNo: topic.topic_no,
            title: topic.title,
            chapterTitle: chapter.title
          });
        });
      });
      
      setSyllabusContentMap(contentMap);
    } catch (e) {
      console.error('fetchSyllabusContentMap error:', e);
      setSyllabusContentMap(new Map());
    }
  }

  // refresh on class/date change
  useEffect(() => {
    if (!classId || !dateStr) return;
    fetchDaySlots();
    fetchChaptersIndex();
    fetchSyllabusContentMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, dateStr]);

  // realtime for the selected day (disabled if tables don't exist)
  useEffect(() => {
    if (!classId || !dateStr) return;
    // Only enable realtime if timetable_slots table exists
    try {
      const ch = supabase.channel(`tt-day-${classId}-${dateStr}`)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'timetable_slots', filter: `class_instance_id=eq.${classId}` },
          (payload) => {
            const row = payload.new || payload.old;
            if (!row || row.class_date !== dateStr) return;
            fetchDaySlots();
          }
        ).subscribe();
      return () => supabase.removeChannel(ch);
    } catch (e) {
      console.error('Realtime subscription error:', e);
      return () => {};
    }
  }, [classId, dateStr]);

  const classOptions = useMemo(
    () => (classes ?? []).map(c => ({
      label: `Grade ${c.grade ?? ''}${c.section ? '-' + c.section : ''}`,
      value: c.id
    })), [classes]
  );

  // Role-based tabs configuration
  const tabs = useMemo(() => {
    const baseTabs = [];
    
    // Only show Manage tab for superadmin and admin
    if (me?.role !== 'student') {
      baseTabs.push({
        key: 'manage',
        label: 'Manage',
        children: (
          <ManageTab
            classId={classId}
            date={date}
            subjects={subjects}
            admins={admins}
            daySlots={daySlots}
            chaptersById={chaptersById}
            syllabusContentMap={syllabusContentMap}
            refreshDay={fetchDaySlots}
          />
        ),
      });
    }
    
    // View tab for all roles
    baseTabs.push({
      key: 'view',
      label: me?.role === 'student' ? 'Today\'s Schedule' : 'View',
      children: (
        <ViewTab
          classId={classId}
          date={date}
          subjects={subjects}
          admins={admins}
          daySlots={daySlots}
          chaptersById={chaptersById}
          syllabusContentMap={syllabusContentMap}
          onSyllabusStatusChange={(itemId, newStatus) => {
            // Update the chaptersById map when status changes
            const updatedChapter = chaptersById.get(itemId);
            if (updatedChapter) {
              updatedChapter.status = newStatus;
              setChaptersById(new Map(chaptersById));
            }
          }}
        />
      ),
    });
    
    return baseTabs;
  }, [me?.role, classId, date, subjects, admins, daySlots, chaptersById, syllabusContentMap, fetchDaySlots]);

  return (
    <Card
        title={
          <Space align="center">
            <span style={{ fontSize: '18px', fontWeight: 600 }}>
              {me?.role === 'student' ? 'My Timetable' : 'Timetable'}
            </span>
            {me?.role === 'student' && classId && (
              <Tag color="blue" style={{ marginLeft: 8 }}>
                {classOptions.find(opt => opt.value === classId)?.label || 'Your Class'}
              </Tag>
            )}
          </Space>
        }
        extra={
          <Space wrap align="center">
            {ctx}
            {me?.role !== 'student' && (
              <Space>
                <Text strong>Class</Text>
                <Select
                  style={{ width: 280 }}
                  showSearch
                  placeholder="Select class"
                  value={classId || undefined}
                  options={classOptions}
                  onChange={setClassId}
                  optionFilterProp="label"
                />
              </Space>
            )}
            <Space>
              <Text strong>Date</Text>
              {me?.role === 'student' && (
                <Space>
                  <Button 
                    icon={<LeftOutlined />} 
                    onClick={() => setDate(date.subtract(1, 'day'))}
                    size="small"
                  />
                  <DatePicker 
                    value={date} 
                    onChange={(d) => setDate(d || dayjs())}
                    style={{ width: 140 }}
                    format="DD/MM/YYYY"
                    placeholder="Select date"
                    allowClear={false}
                    suffixIcon={<CalendarOutlined />}
                  />
                  <Button 
                    icon={<RightOutlined />} 
                    onClick={() => setDate(date.add(1, 'day'))}
                    size="small"
                  />
                </Space>
              )}
              {me?.role !== 'student' && (
                <DatePicker 
                  value={date} 
                  onChange={(d) => setDate(d || dayjs())}
                  style={{ width: 140 }}
                  format="DD/MM/YYYY"
                  placeholder="Select date"
                  allowClear={false}
                />
              )}
            </Space>
          </Space>
        }
      >
        <Tabs 
          defaultActiveKey={me?.role === 'student' ? 'view' : 'manage'} 
          items={tabs} 
        />
      </Card>
  );
}
