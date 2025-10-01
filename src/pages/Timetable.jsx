// src/pages/Timetable.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Card, DatePicker, Select, Space, Typography, Tabs, message, Tag, Button } from 'antd';
import { LeftOutlined, RightOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { supabase } from '../config/supabaseClient';
import ManageTab from '../components/timetable/ManageTab.jsx';
import ViewTab from '../components/timetable/ViewTab.jsx';
import EmptyState from '../ui/EmptyState';
import { getSchoolCode, getUserRole } from '../utils/metadata';

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
            role: userRow?.role || getUserRole(auth.user) || null,
            school_code: userRow?.school_code || getSchoolCode(auth.user) || null,
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
            data = data.map(slot => {
              const extended = extendedData.find(e => e.id === slot.id);
              const merged = {
                ...slot,
                syllabus_chapter_id: extended?.syllabus_chapter_id || null,
                syllabus_topic_id: extended?.syllabus_topic_id || null,
              };
              // if (extended?.syllabus_chapter_id) {
              // }
              return merged;
            });
          }
        } catch (extendedErr) {
          // New columns don't exist yet, continue with basic data
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

      // Get chapters with their topics using the new structure
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
        setChaptersById(new Map());
        return; 
      }

      const byId = new Map();
      const subjBySyl = new Map((syllabi ?? []).map(s => [s.id, s.subject_id]));
      
      // Process chapters
      for (const ch of (chapters ?? [])) {
        byId.set(ch.id, {
          unit_no: ch.chapter_no,
          title: ch.title,
          status: 'pending', // Default status for chapters
          subject_id: subjBySyl.get(ch.syllabus_id) || null,
          type: 'chapter'
        });
        
        // Process topics within chapters
        for (const topic of (ch.syllabus_topics ?? [])) {
          byId.set(topic.id, {
            unit_no: `${ch.chapter_no}.${topic.topic_no}`,
            title: topic.title,
            status: 'pending', // Default status for topics
            subject_id: subjBySyl.get(ch.syllabus_id) || null,
            type: 'topic',
            chapter_id: ch.id
          });
        }
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
    <div style={{ padding: 16, background: '#fafafa', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12
          }}>
            <div>
              <h1 style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 600,
                color: '#262626',
                marginBottom: 2
              }}>
                {me?.role === 'student' ? 'My Timetable' : 'Timetable'}
              </h1>
              <p style={{ margin: 0, color: '#8c8c8c', fontSize: 13 }}>
                {me?.role === 'student' ? 'Daily schedule' : me?.role === 'admin' ? 'Manage schedules' : 'View & manage schedules'}
              </p>
            </div>
            {me?.role === 'student' && classId && (
              <Tag color="blue" style={{
                padding: '4px 12px',
                fontSize: 13,
                borderRadius: 4
              }}>
                {classOptions.find(opt => opt.value === classId)?.label || 'Your Class'}
              </Tag>
            )}
          </div>
        </div>

        <Card
          style={{
            marginBottom: 12,
            borderRadius: 8
          }}
          bodyStyle={{ padding: 12 }}
        >
          <div style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            {ctx}
            {me?.role !== 'student' && (
              <div style={{ flex: 1, minWidth: 220 }}>
                <Text strong style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#595959' }}>Class</Text>
                <Select
                  style={{ width: '100%' }}
                  showSearch
                  placeholder="Select class"
                  value={classId || undefined}
                  options={classOptions}
                  onChange={setClassId}
                  optionFilterProp="label"
                  size="middle"
                />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 250 }}>
              <Text strong style={{ display: 'block', marginBottom: 8, color: '#475569' }}>Date</Text>
              {me?.role === 'student' ? (
                <Space.Compact style={{ width: '100%' }}>
                  <Button
                    icon={<LeftOutlined />}
                    onClick={() => setDate(date.subtract(1, 'day'))}
                    size="middle"
                  />
                  <DatePicker
                    value={date}
                    onChange={(d) => setDate(d || dayjs())}
                    style={{ flex: 1 }}
                    format="DD MMM YYYY"
                    placeholder="Select date"
                    allowClear={false}
                    suffixIcon={<CalendarOutlined />}
                    size="middle"
                  />
                  <Button
                    icon={<RightOutlined />}
                    onClick={() => setDate(date.add(1, 'day'))}
                    size="middle"
                  />
                </Space.Compact>
              ) : (
                <DatePicker
                  value={date}
                  onChange={(d) => setDate(d || dayjs())}
                  style={{ width: '100%' }}
                  format="DD MMM YYYY"
                  placeholder="Select date"
                  allowClear={false}
                  size="middle"
                />
              )}
            </div>
          </div>
        </Card>

        <Card
          style={{
            borderRadius: 8
          }}
          bodyStyle={{ padding: 16 }}
        >
          <Tabs
            defaultActiveKey={me?.role === 'student' ? 'view' : 'manage'}
            items={tabs}
            size="middle"
          />
        </Card>
      </div>
    </div>
  );
}
