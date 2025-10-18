// src/pages/UnifiedTimetable.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { 
  Card, DatePicker, Select, Space, Typography, Tabs, message, Tag, Button, 
  Modal, Form, Input, InputNumber, Popconfirm, Tooltip, Row, Col, Empty,
  Dropdown, Radio, Alert, App, Spin, Skeleton
} from 'antd';
import { 
  LeftOutlined, RightOutlined, CalendarOutlined, ClockCircleOutlined, 
  BookOutlined, TeamOutlined, QuestionCircleOutlined, CheckCircleOutlined,
  PlayCircleOutlined, EditOutlined, DeleteOutlined, PlusOutlined,
  ThunderboltOutlined, CopyOutlined, MoreOutlined, CheckOutlined,
  ExclamationCircleOutlined, SettingOutlined, FileTextOutlined, 
  InfoCircleOutlined, CompressOutlined, ExpandOutlined
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';
import { supabase } from '@/config/supabaseClient';
import { useTheme } from '@/contexts/ThemeContext';
import { getSchoolCode, getUserRole } from '@/shared/utils/metadata';
import { useHolidayCheck } from '@/features/calendar/components/HolidayChecker';
import { useErrorHandler } from '@/shared/hooks/useErrorHandler';
import { useSyllabusLoader } from '../components/SyllabusLoader';
import { getProgressForDate, markSlotTaught, unmarkSlotTaught } from '@/features/syllabus/services/syllabusProgressService';
import EmptyState from '@/shared/ui/EmptyState';

const { Text, Title } = Typography;
const { TextArea } = Input;

// Removed status tracking - no longer needed

// Duration colors will be defined inside the component to use theme colors

export default function UnifiedTimetable() {
  const [, ctx] = message.useMessage();
  const { showError, showSuccess } = useErrorHandler();
  

  // Auth context
  const [me, setMe] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Filters
  const [classId, setClassId] = useState(null);
  const [date, setDate] = useState(dayjs());
  const dateStr = useMemo(() => date?.format('YYYY-MM-DD'), [date]);

  // Data
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [daySlots, setDaySlots] = useState([]);
  const [taughtBySlotId, setTaughtBySlotId] = useState(new Set());
  
  // Syllabus data using custom hook
  const { chaptersById, syllabusContentMap } = useSyllabusLoader(classId, me?.school_code);

  // UI State
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [quickGenerateModalVisible, setQuickGenerateModalVisible] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [form] = Form.useForm();
  const [quickGenerateForm] = Form.useForm();

  // Holiday checking
  const { isHoliday, holidayInfo } = useHolidayCheck(
    me?.school_code, 
    date, 
    classId
  );

  // Bootstrap
  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) throw new Error('Not signed in');
        
        // Try admin table first; fallback to users table for superadmins without admin row
        let meRow = null;
        const { data: adminRow } = await supabase
          .from('admin').select('id, role, school_code').eq('id', auth.user.id).maybeSingle();
        
        if (adminRow) {
          meRow = adminRow;
        } else {
          const { data: userRow } = await supabase
            .from('users').select('id, role, school_code').eq('id', auth.user.id).maybeSingle();
          
          if (userRow && userRow.role === 'superadmin') {
            meRow = userRow;
          }
        }
        
        if (!meRow) {
          // Fallback: try to extract from auth user metadata
          const role = getUserRole(auth.user);
          const schoolCode = getSchoolCode(auth.user);
          
          if (role && schoolCode) {
            meRow = {
              id: auth.user.id,
              role: role,
              school_code: schoolCode
            };
          } else {
            throw new Error('User not found in admin or users table. Please contact your administrator.');
          }
        }
        setMe(meRow);
      } catch (e) {
        console.error('User context error:', e);
        showError(e, { context: { item: 'user authentication' } });
      } finally {
        setAuthLoading(false);
      }
    })();
  }, []);

  // Load initial data
  useEffect(() => {
    if (!me?.school_code) return;
    
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load classes
        const { data: classesData, error: classesError } = await supabase
          .from('class_instances')
          .select('id, grade, section')
          .eq('school_code', me.school_code)
          .order('grade', { ascending: true })
          .order('section', { ascending: true });
        
        if (classesError) throw classesError;
        setClasses(classesData || []);

        // Load subjects
        const { data: subjectsData, error: subjectsError } = await supabase
          .from('subjects')
          .select('id, subject_name')
          .eq('school_code', me.school_code)
          .order('subject_name');
        
        if (subjectsError) throw subjectsError;
        setSubjects(subjectsData || []);

        // Load admins
        const { data: adminsData, error: adminsError } = await supabase
          .from('admin')
          .select('id, full_name')
          .eq('school_code', me.school_code)
          .order('full_name');
        
        if (adminsError) throw adminsError;
        setAdmins(adminsData || []);

      } catch (e) {
        showError(e, { context: { item: 'initial data loading' } });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [me?.school_code]);

  // Fetch day slots
  const fetchDaySlots = async () => {
    if (!classId || !dateStr) return;
    
    try {
      const { data, error } = await supabase
        .from('timetable_slots')
        .select(`
          id, class_instance_id, class_date, period_number,
          slot_type, name, start_time, end_time,
          subject_id, teacher_id, syllabus_item_id, plan_text,
          syllabus_chapter_id, syllabus_topic_id
        `)
        .eq('class_instance_id', classId)
        .eq('class_date', dateStr)
        .order('start_time', { ascending: true })
        .order('period_number', { ascending: true });

      if (error) throw error;
      setDaySlots(data || []);
      // Load taught state for this date
      if (me?.school_code) {
        try {
          const progress = await getProgressForDate(me.school_code, classId, dateStr);
          const taughtIds = new Set((progress || []).map(p => p.timetable_slot_id));
          setTaughtBySlotId(taughtIds);
        } catch (e) {
          // Non-blocking
          console.warn('Failed to load syllabus progress for date', e);
        }
      }
    } catch (e) {
      showError(e, { context: { item: 'timetable slots' } });
      setDaySlots([]);
    }
  };

  // Refresh on class/date change
  useEffect(() => {
    if (!classId || !dateStr) return;
    fetchDaySlots();
  }, [classId, dateStr]);

  // Helper functions
  const subjectName = (id) => {
    if (!id) return '—';
    const subject = subjects.find(s => s.id === id);
    return subject?.subject_name || 'Loading...';
  };
  
  const adminName = (id) => {
    if (!id) return '—';
    const admin = admins.find(a => a.id === id);
    return admin?.full_name || 'Loading...';
  };

  const getSyllabusContent = (slot) => {
    if (slot.syllabus_topic_id) {
      const topicContent = syllabusContentMap.get(`topic_${slot.syllabus_topic_id}`);
      if (topicContent) {
        return `Ch.${topicContent.chapterNo}.${topicContent.topicNo} ${topicContent.title}`;
      }
    }
    if (slot.syllabus_chapter_id) {
      const chapterContent = syllabusContentMap.get(`chapter_${slot.syllabus_chapter_id}`);
      if (chapterContent) {
        return `Ch.${chapterContent.chapterNo} ${chapterContent.title}`;
      }
    }
    return '';
  };


  // Modal handlers
  const openAddModal = (type) => {
    setEditingSlot(null);
    form.resetFields();
    const nextNo = (daySlots.reduce((m, it) => Math.max(m, it.period_number || 0), 0) || 0) + 1;
    form.setFieldsValue({
      slot_type: type,
      period_number: nextNo,
      name: type === 'break' ? 'Break' : undefined,
      start_time: '09:00:00',
      end_time: '09:40:00'
    });
    setEditModalVisible(true);
  };

  const openEditModal = (slot) => {
    setEditingSlot(slot);
    form.setFieldsValue({
      slot_type: slot.slot_type || 'period',
      period_number: slot.period_number,
      start_time: slot.start_time || '',
      end_time: slot.end_time || '',
      name: slot.name || '',
      subject_id: slot.subject_id,
      teacher_id: slot.teacher_id,
      syllabus_chapter_id: slot.syllabus_chapter_id || null,
      syllabus_topic_id: slot.syllabus_topic_id || null,
      plan_text: slot.plan_text || ''
    });
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      
      const payload = {
        school_code: me?.school_code,
        class_instance_id: classId,
        class_date: dateStr,
        period_number: values.slot_type === 'break' ? 0 : values.period_number,
        slot_type: values.slot_type,
        name: values.slot_type === 'break' ? values.name : null,
        subject_id: values.slot_type === 'period' ? values.subject_id : null,
        teacher_id: values.slot_type === 'period' ? values.teacher_id : null,
        syllabus_chapter_id: values.slot_type === 'period' ? values.syllabus_chapter_id : null,
        syllabus_topic_id: values.slot_type === 'period' ? values.syllabus_topic_id : null,
        plan_text: values.slot_type === 'period' ? values.plan_text : null,
        created_by: me?.id,
        start_time: values.start_time || '09:00:00',
        end_time: values.end_time || '09:40:00'
      };

      if (editingSlot) {
        // Handle automatic time adjustment for existing slots
        await handleTimeAdjustment(editingSlot, payload);
        
        const { error } = await supabase
          .from('timetable_slots')
          .update(payload)
          .eq('id', editingSlot.id);
        if (error) throw error;
        showSuccess('Timetable slot updated successfully');
      } else {
        const { error } = await supabase
          .from('timetable_slots')
          .insert(payload);
        if (error) throw error;
        showSuccess('Timetable slot created successfully');
      }

      setEditModalVisible(false);
      fetchDaySlots();
    } catch (e) {
      showError(e, { context: { item: 'timetable slot' } });
    } finally {
      setLoading(false);
    }
  };

  // Handle automatic time adjustment when editing slots
  const handleTimeAdjustment = async (currentSlot, newPayload) => {
    const sortedSlots = [...daySlots].sort((a, b) => {
      const timeA = new Date(`2000-01-01T${a.start_time}`);
      const timeB = new Date(`2000-01-01T${b.start_time}`);
      return timeA - timeB;
    });

    const currentIndex = sortedSlots.findIndex(slot => slot.id === currentSlot.id);
    if (currentIndex === -1) return;

    const updates = [];

    // Check if end time changed and adjust next slot's start time
    if (newPayload.end_time !== currentSlot.end_time) {
      const nextSlot = sortedSlots[currentIndex + 1];
      if (nextSlot) {
        updates.push({
          id: nextSlot.id,
          start_time: newPayload.end_time
        });
      }
    }

    // Check if start time changed and adjust previous slot's end time
    if (newPayload.start_time !== currentSlot.start_time) {
      const prevSlot = sortedSlots[currentIndex - 1];
      if (prevSlot) {
        updates.push({
          id: prevSlot.id,
          end_time: newPayload.start_time
        });
      }
    }

    // Apply all updates
    for (const update of updates) {
      const { error } = await supabase
        .from('timetable_slots')
        .update({ 
          start_time: update.start_time,
          end_time: update.end_time 
        })
        .eq('id', update.id);
      
      if (error) {
        console.warn(`Failed to update slot ${update.id}:`, error);
        // Don't throw error, just log warning
      }
    }
  };

  const handleDelete = async (slot) => {
    try {
      const { error } = await supabase
        .from('timetable_slots')
        .delete()
        .eq('id', slot.id);
      if (error) throw error;
      showSuccess('Timetable slot deleted successfully');
      fetchDaySlots();
    } catch (e) {
      showError(e, { context: { item: 'timetable slot' } });
    }
  };

  // Quick Generate handler - Creates multiple periods with optional breaks
  // Fixes the "Value already taken" error by using sequential period numbers
  // Allows flexible break configuration (when and how long)
  const handleQuickGenerate = async () => {
    try {
      setLoading(true);
      const values = await quickGenerateForm.validateFields();
      
      const { 
        numPeriods, 
        periodDuration, 
        breakConfigurations, 
        startTime 
      } = values;
      
      // Parse start time
      const [startHour, startMinute] = startTime.split(':').map(Number);
      let currentHour = startHour;
      let currentMinute = startMinute;
      
      const slots = [];
      let slotCounter = 1; // For database unique constraint
      let displayPeriodNumber = 1; // For user display
      
      for (let i = 1; i <= numPeriods; i++) {
        // Calculate end time for period
        const endMinute = currentMinute + periodDuration;
        const endHour = currentHour + Math.floor(endMinute / 60);
        const adjustedEndMinute = endMinute % 60;
        
        // Add period
        slots.push({
          school_code: me?.school_code,
          class_instance_id: classId,
          class_date: dateStr,
          period_number: slotCounter, // Database constraint
          slot_type: 'period',
          start_time: `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}:00`,
          end_time: `${String(endHour).padStart(2, '0')}:${String(adjustedEndMinute).padStart(2, '0')}:00`,
          created_by: me?.id
        });
        
        slotCounter++;
        
        // Update current time to end of period
        currentHour = endHour;
        currentMinute = adjustedEndMinute;
        
        // Check if we need to add a break after this period
        const breakConfig = breakConfigurations?.find(config => config.afterPeriod === i);
        if (breakConfig && breakConfig.duration > 0) {
          const breakEndMinute = currentMinute + breakConfig.duration;
          const breakEndHour = currentHour + Math.floor(breakEndMinute / 60);
          const adjustedBreakEndMinute = breakEndMinute % 60;
          
          slots.push({
            school_code: me?.school_code,
            class_instance_id: classId,
            class_date: dateStr,
            period_number: slotCounter, // Database constraint
            slot_type: 'break',
            name: breakConfig.name || 'Break',
            start_time: `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}:00`,
            end_time: `${String(breakEndHour).padStart(2, '0')}:${String(adjustedBreakEndMinute).padStart(2, '0')}:00`,
            created_by: me?.id
          });
          
          slotCounter++;
          currentHour = breakEndHour;
          currentMinute = adjustedBreakEndMinute;
        }
      }
      
      // Insert all slots
      const { error } = await supabase
        .from('timetable_slots')
        .insert(slots);
      
      if (error) throw error;
      
      showSuccess(`Generated ${numPeriods} periods successfully`);
      setQuickGenerateModalVisible(false);
      quickGenerateForm.resetFields();
      fetchDaySlots();
    } catch (e) {
      showError(e, { context: { item: 'quick generate timetable' } });
    } finally {
      setLoading(false);
    }
  };

  // Calendar navigation functions
  const handleDateNavigation = (direction) => {
    if (direction === 'prev') {
      setDate(date.subtract(1, 'day'));
    } else if (direction === 'next') {
      setDate(date.add(1, 'day'));
    } else if (direction === 'today') {
      setDate(dayjs());
    }
  };

  // Class options
  const classOptions = useMemo(
    () => (classes ?? []).map(c => ({
      label: `Grade ${c.grade ?? ''}${c.section ? '-' + c.section : ''}`,
      value: c.id
    })), [classes]
  );

  // Schedule data
  const scheduleData = useMemo(() => {
    // Calculate display period numbers (only for actual periods, not breaks)
    let displayPeriodCounter = 1;
    
    return daySlots.map(slot => {
      const isPeriod = slot.slot_type === 'period';
      const displayPeriodNumber = isPeriod ? displayPeriodCounter++ : null;
      
      return {
        ...slot,
        displayPeriodNumber, // Add display period number for UI
        subjectName: subjectName(slot.subject_id),
        teacherName: adminName(slot.teacher_id),
        syllabusContent: getSyllabusContent(slot),
        isTaught: taughtBySlotId.has(slot.id)
      };
    });
  }, [daySlots, subjects, admins, syllabusContentMap, taughtBySlotId]);

  const taughtCounts = useMemo(() => {
    const totalPeriods = daySlots.filter(s => s.slot_type === 'period').length;
    const taughtPeriods = daySlots.filter(s => s.slot_type === 'period' && taughtBySlotId.has(s.id)).length;
    return { taughtPeriods, totalPeriods };
  }, [daySlots, taughtBySlotId]);

  const handleToggleTaught = async (slot) => {
    if (!me?.school_code) return;
    try {
      const isCurrentlyTaught = taughtBySlotId.has(slot.id);
      if (isCurrentlyTaught) {
        await unmarkSlotTaught({ schoolCode: me.school_code, timetableSlotId: slot.id });
        const next = new Set(taughtBySlotId);
        next.delete(slot.id);
        setTaughtBySlotId(next);
        showSuccess('Marked as not taught');
      } else {
        await markSlotTaught({
          schoolCode: me.school_code,
          timetableSlotId: slot.id,
          classInstanceId: slot.class_instance_id,
          date: slot.class_date,
          subjectId: slot.subject_id,
          teacherId: slot.teacher_id,
          syllabusChapterId: slot.syllabus_chapter_id || null,
          syllabusTopicId: slot.syllabus_topic_id || null,
        });
        const next = new Set(taughtBySlotId);
        next.add(slot.id);
        setTaughtBySlotId(next);
        showSuccess('Marked as taught');
      }
    } catch (e) {
      showError(e, { context: { item: 'syllabus progress' } });
    }
  };

  if (authLoading) {
    return (
      <Card style={{ marginTop: 8, textAlign: 'center', padding: '40px 20px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: '#1890ff' }}>
          <div style={{ fontSize: '16px', marginBottom: '8px' }}>Loading...</div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            Please wait while we load your information.
          </div>
        </div>
      </Card>
    );
  }

  if (!me?.school_code) {
    return (
      <Card style={{ marginTop: 8, textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ color: '#ff4d4f' }}>
          <div style={{ fontSize: '16px', marginBottom: '8px' }}>User Context Missing</div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            Unable to load your user information. Please refresh the page or contact your administrator.
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ 
      background: '#F9FAFB', 
      minHeight: '100vh' 
    }}>
      <App>
        {ctx}
        
        {/* Modern Sticky Toolbar */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            background: '#FFFFFF',
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px'
          }}
        >
          {/* Left: Filters & Progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
            <Select
              placeholder="Select Class"
              value={classId}
              onChange={setClassId}
              options={classOptions}
              style={{ width: 200 }}
              allowClear
              size="default"
            />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Button 
                icon={<LeftOutlined />}
                onClick={() => handleDateNavigation('prev')}
                size="small"
                type="text"
              />
              <DatePicker
                value={date}
                onChange={(selectedDate) => {
                  if (selectedDate) {
                    setDate(selectedDate);
                  }
                }}
                format="MMM DD"
                size="default"
                style={{ width: 120 }}
              />
              <Button 
                icon={<RightOutlined />}
                onClick={() => handleDateNavigation('next')}
                size="small"
                type="text"
              />
            </div>
            
            {scheduleData.length > 0 && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                padding: '4px 12px',
                background: '#F3F4F6',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#6B7280'
              }}>
                <span style={{ fontWeight: '600', color: '#111827' }}>
                  {taughtCounts.taughtPeriods}/{taughtCounts.totalPeriods}
                </span>
                <span>periods taught</span>
              </div>
            )}
          </div>
          
          {/* Right: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button 
              type="text"
              icon={compactMode ? <ExpandOutlined /> : <CompressOutlined />}
              onClick={() => setCompactMode(!compactMode)}
              size="default"
              title={compactMode ? 'Expand view' : 'Compact view'}
            />
            
            {/* Add Actions */}
            {classId && !isHoliday && (
              <>
                <Button 
                  type="default"
                  icon={<PlusOutlined />}
                  onClick={() => openAddModal('break')}
                  size="default"
                  style={{ 
                    border: '1px solid #D1D5DB',
                    color: '#6B7280'
                  }}
                >
                  Add Break
                </Button>
                <Button 
                  type="default"
                  icon={<PlusOutlined />}
                  onClick={() => openAddModal('period')}
                  size="default"
                  style={{ 
                    border: '1px solid #3B82F6',
                    color: '#3B82F6',
                    background: '#EFF6FF'
                  }}
                >
                  Add Period
                </Button>
              </>
            )}
            
            <Button 
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={() => setQuickGenerateModalVisible(true)}
              disabled={!classId || isHoliday}
              size="default"
            >
              Quick Generate
            </Button>
          </div>
        </motion.div>

        {/* Main Content */}
        <div style={{ padding: '24px' }}>
        {/* Holiday Alert */}
        {isHoliday && (
          <Alert
            type="warning"
            message={`${holidayInfo?.title || 'Holiday'}: ${holidayInfo?.title === 'Sunday' ? 'Sunday is a weekend day.' : 'This is a holiday.'}`}
            showIcon
            style={{ marginBottom: 16 }}
            banner
          />
        )}

          {/* Loading State */}
          {loading && (
            <div style={{ padding: '24px' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} active paragraph={{ rows: 1 }} style={{ marginBottom: 16 }} />
              ))}
            </div>
          )}

          {/* Empty State */}
        {!classId ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Please select a class to view and manage its schedule"
            style={{ margin: '40px 0' }}
          >
            <Button type="primary" size="middle">
              Select Class
            </Button>
          </Empty>
        ) : isHoliday ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            background: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
            <div style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              color: '#0c4a6e',
              marginBottom: '8px' 
            }}>
              Holiday – no schedule needed
            </div>
            <div style={{ 
              fontSize: '14px', 
              color: '#64748b',
              marginBottom: '16px' 
            }}>
              {holidayInfo?.title || 'Holiday'} • {date.format('MMMM DD, YYYY')}
            </div>
            <Button 
              type="link" 
              icon={<CalendarOutlined />}
              onClick={() => window.location.href = '/calendar'}
              style={{ color: '#0369a1' }}
            >
              View Calendar
            </Button>
          </div>
        ) : scheduleData.length > 0 ? (
            <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.08)' }}>
              {/* Modern Flat Timeline */}
              <AnimatePresence>
            {scheduleData.map((slot, index) => {
              const isBreak = slot.slot_type === 'break';
              const isLast = index === scheduleData.length - 1;
              
              return (
                    <motion.div
                  key={slot.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                    >
                      {isBreak ? (
                        /* Break as Slim Divider */
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '8px 16px',
                          background: '#FEF3C7',
                          borderLeft: '3px solid #F59E0B',
                          margin: '8px 0'
                        }}>
                          <span style={{ marginRight: '8px', fontSize: '16px' }}>☕</span>
                          <span style={{ 
                            fontSize: '14px', 
                            fontWeight: '500', 
                            color: '#92400E',
                            marginRight: '8px'
                          }}>
                            {slot.name || 'Break'}
                          </span>
                          <span style={{ 
                            fontSize: '12px', 
                            color: '#A16207'
                          }}>
                            {slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}
                          </span>
                        </div>
                      ) : (
                        /* Period as Flat Row */
                        <motion.div
                          whileHover={{ backgroundColor: '#F9FAFB' }}
                  style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '16px',
                            borderBottom: isLast ? 'none' : '1px solid rgba(0,0,0,0.08)',
                            transition: 'background-color 0.2s ease'
                          }}
                        >
                        {/* Time */}
                        <div style={{ 
                          minWidth: '80px', 
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#6B7280',
                            marginRight: '16px'
                        }}>
                          {slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}
                        </div>

                        {/* Period Info */}
                          <div style={{
                            minWidth: '60px',
                            marginRight: '16px'
                          }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              background: '#EFF6FF',
                              color: '#1E40AF',
                              borderRadius: '6px',
                          fontSize: '12px', 
                              fontWeight: '600'
                            }}>
                              Period {slot.displayPeriodNumber}
                            </span>
                          </div>

                          {/* Subject & Teacher */}
                          <div style={{ flex: 1, marginRight: '16px' }}>
                            <div style={{
                              fontSize: '15px',
                              fontWeight: '600',
                              color: '#111827',
                              marginBottom: '2px'
                            }}>
                              {slot.subjectName || 'No subject assigned'}
                            </div>
                            <div style={{
                              fontSize: '13px',
                              color: '#6B7280'
                            }}>
                              {slot.teacherName || 'No teacher assigned'}
                            </div>
                            {slot.syllabusContent && (
                              <div style={{
                                fontSize: '12px',
                                color: '#1E40AF',
                                marginTop: '4px',
                                padding: '2px 6px',
                                background: '#EFF6FF',
                                borderRadius: '4px',
                                display: 'inline-block'
                              }}>
                                📚 {slot.syllabusContent}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {/* Mark Taught Chip */}
                            <Popconfirm
                              title={slot.isTaught ? 'Unmark as Taught' : 'Mark as Taught'}
                              description={
                                slot.isTaught 
                                  ? `Are you sure you want to unmark Period ${slot.displayPeriodNumber} as taught?`
                                  : `Are you sure you want to mark Period ${slot.displayPeriodNumber} as taught?`
                              }
                              onConfirm={() => handleToggleTaught(slot)}
                              okText="Yes"
                              cancelText="No"
                              okButtonProps={{ 
                                type: slot.isTaught ? 'default' : 'primary',
                                danger: slot.isTaught
                              }}
                            >
                              <motion.div
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <Button
                                  type={slot.isTaught ? 'default' : 'primary'}
                                  size="small"
                                  style={{
                                    borderRadius: '20px',
                                    height: '28px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    background: slot.isTaught ? '#F3F4F6' : '#3B82F6',
                                    border: slot.isTaught ? '1px solid #D1D5DB' : 'none',
                                    color: slot.isTaught ? '#6B7280' : 'white'
                                  }}
                                  aria-pressed={slot.isTaught}
                                >
                                  {slot.isTaught ? '✓ Taught' : 'Mark Taught'}
                                </Button>
                              </motion.div>
                            </Popconfirm>

                            {/* Edit Button */}
                            <Tooltip title="Edit period details">
                              <motion.div
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <Button
                                  type="text"
                                  icon={<EditOutlined />}
                                  size="small"
                                  onClick={() => openEditModal(slot)}
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '6px',
                                    color: '#6B7280'
                                  }}
                                />
                              </motion.div>
                            </Tooltip>

                            {/* Delete Button */}
                            <Popconfirm
                              title="Delete Schedule Item"
                              description="Are you sure you want to delete this schedule item?"
                              onConfirm={() => handleDelete(slot)}
                              okText="Yes"
                              cancelText="No"
                              okButtonProps={{ danger: true }}
                            >
                              <Tooltip title="Delete period">
                                <motion.div
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                >
                                  <Button
                                    type="text"
                                    danger
                                    icon={<DeleteOutlined />}
                                    size="small"
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '6px'
                                    }}
                                  />
                                </motion.div>
                              </Tooltip>
                            </Popconfirm>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No schedule items for this date"
              style={{ margin: '40px 0' }}
            >
              <Space>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={() => openAddModal('period')}
                >
                  Add Period
                </Button>
                <Button 
                  icon={<PlusOutlined />}
                  onClick={() => openAddModal('break')}
                >
                  Add Break
                </Button>
              </Space>
            </Empty>
          )}

          {/* Footer Summary Bar */}
          {classId && !isHoliday && scheduleData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                background: '#F9FAFB',
                border: '1px solid rgba(0,0,0,0.08)',
                padding: '16px 24px',
                marginTop: '24px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px'
              }}
            >
              <div style={{ fontSize: '14px', color: '#6B7280', textAlign: 'center' }}>
                <span style={{ fontWeight: '600', color: '#111827' }}>
                  {scheduleData.filter(s => s.slot_type === 'period').length}
                </span> periods •{' '}
                <span style={{ fontWeight: '600', color: '#111827' }}>
                  {scheduleData.filter(s => s.slot_type === 'break').length}
                </span> breaks •{' '}
                <span style={{ fontWeight: '600', color: '#111827' }}>
                  {taughtCounts.taughtPeriods}
                </span> taught
              </div>
            </motion.div>
          )}
        </div>
      </App>

      {/* Edit Modal */}
      <Modal
        title={editingSlot ? 'Edit Timetable Slot' : 'Add Timetable Slot'}
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingSlot(null);
          form.resetFields();
        }}
        onOk={handleSave}
        confirmLoading={loading}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            slot_type: 'period',
            period_number: 1,
            start_time: '09:00:00',
            end_time: '09:40:00'
          }}
        >
          <Form.Item
            name="slot_type"
            label="Slot Type"
            rules={[{ required: true, message: 'Please select slot type' }]}
          >
            <Radio.Group>
              <Radio value="period">Period</Radio>
              <Radio value="break">Break</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.slot_type !== currentValues.slot_type}
          >
            {({ getFieldValue }) => {
              const slotType = getFieldValue('slot_type');
              
              if (slotType === 'period') {
                return (
                  <>
                    <Form.Item
                      name="period_number"
                      label="Period Number"
                      rules={[{ required: true, message: 'Please enter period number' }]}
                    >
                      <InputNumber min={1} max={12} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                      name="subject_id"
                      label="Subject"
                      rules={[{ required: true, message: 'Please select subject' }]}
                    >
                      <Select placeholder="Select subject">
                        {subjects.map(subject => (
                          <Select.Option key={subject.id} value={subject.id}>
                            {subject.subject_name}
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>

                    <Form.Item
                      name="teacher_id"
                      label="Teacher"
                      rules={[{ required: true, message: 'Please select teacher' }]}
                    >
                      <Select placeholder="Select teacher">
                        {admins.map(admin => (
                          <Select.Option key={admin.id} value={admin.id}>
                            {admin.full_name}
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>

                    <Form.Item
                      name="syllabus_chapter_id"
                      label="Syllabus Chapter"
                    >
                      <Select placeholder="Select chapter" allowClear>
                        {chaptersById && Object.values(chaptersById).map(chapter => (
                          <Select.Option key={chapter.id} value={chapter.id}>
                            {chapter.title}
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>

                    <Form.Item
                      name="syllabus_topic_id"
                      label="Syllabus Topic"
                    >
                      <Select placeholder="Select topic" allowClear>
                        {chaptersById && Object.values(chaptersById).map(chapter => 
                          chapter.topics?.map(topic => (
                            <Select.Option key={topic.id} value={topic.id}>
                              {chapter.title} - {topic.title}
                            </Select.Option>
                          ))
                        )}
                      </Select>
                    </Form.Item>

                    <Form.Item
                      name="plan_text"
                      label="Lesson Plan"
                    >
                      <Input.TextArea rows={3} placeholder="Enter lesson plan details" />
                    </Form.Item>
                  </>
                );
              } else {
                return (
                  <Form.Item
                    name="name"
                    label="Break Name"
                    rules={[{ required: true, message: 'Please enter break name' }]}
                  >
                    <Input placeholder="e.g., Lunch Break, Short Break" />
                  </Form.Item>
                );
              }
            }}
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="start_time"
                label="Start Time"
                rules={[{ required: true, message: 'Please enter start time' }]}
              >
                <Input type="time" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="end_time"
                label="End Time"
                rules={[{ required: true, message: 'Please enter end time' }]}
              >
                <Input type="time" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Quick Generate Modal */}
      <Modal
        title="Quick Generate Timetable"
        open={quickGenerateModalVisible}
        onCancel={() => {
          setQuickGenerateModalVisible(false);
          quickGenerateForm.resetFields();
        }}
        onOk={handleQuickGenerate}
        confirmLoading={loading}
        width={600}
      >
        <Form
          form={quickGenerateForm}
          layout="vertical"
          initialValues={{
            numPeriods: 6,
            periodDuration: 40,
            startTime: '09:00',
            breakConfigurations: []
          }}
        >
          <Form.Item
            name="numPeriods"
            label="Number of Periods"
            rules={[{ required: true, message: 'Please enter number of periods' }]}
          >
            <InputNumber min={1} max={12} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="periodDuration"
            label="Period Duration (minutes)"
            rules={[{ required: true, message: 'Please enter period duration' }]}
          >
            <InputNumber min={15} max={120} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="startTime"
            label="Start Time"
            rules={[{ required: true, message: 'Please enter start time' }]}
          >
            <Input type="time" />
          </Form.Item>

          <Form.Item
            name="breakConfigurations"
            label="Break Configuration"
          >
            <Form.List name="breakConfigurations">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <div key={key} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <Form.Item
                        {...restField}
                        name={[name, 'afterPeriod']}
                        rules={[{ required: true, message: 'After period' }]}
                        style={{ flex: 1 }}
                      >
                        <InputNumber placeholder="After period" min={1} max={12} />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'duration']}
                        rules={[{ required: true, message: 'Duration' }]}
                        style={{ flex: 1 }}
                      >
                        <InputNumber placeholder="Duration (min)" min={5} max={60} />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'name']}
                        style={{ flex: 2 }}
                      >
                        <Input placeholder="Break name" />
                      </Form.Item>
                      <Button type="text" danger onClick={() => remove(name)}>
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button type="dashed" onClick={() => add()} block>
                    Add Break
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
