// src/pages/UnifiedTimetable.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { 
  Card, DatePicker, Select, Space, Typography, Tabs, message, Tag, Button, 
  Modal, Form, Input, InputNumber, Popconfirm, Tooltip, Row, Col, Empty,
  Dropdown, Radio, Alert, App, Spin
} from 'antd';
import { 
  LeftOutlined, RightOutlined, CalendarOutlined, ClockCircleOutlined, 
  BookOutlined, TeamOutlined, QuestionCircleOutlined, CheckCircleOutlined,
  PlayCircleOutlined, EditOutlined, DeleteOutlined, PlusOutlined,
  ThunderboltOutlined, CopyOutlined, MoreOutlined, CheckOutlined,
  ExclamationCircleOutlined, SettingOutlined, FileTextOutlined, 
  InfoCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { supabase } from '../config/supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { getSchoolCode, getUserRole } from '../utils/metadata';
import { useHolidayCheck } from '../components/calendar/HolidayChecker';
import { useErrorHandler } from '../hooks/useErrorHandler.jsx';
import { useSyllabusLoader } from '../components/timetable/SyllabusLoader';
import { getProgressForDate, markSlotTaught, unmarkSlotTaught } from '../services/syllabusProgressService';
import EmptyState from '../ui/EmptyState';

const { Text, Title } = Typography;
const { TextArea } = Input;

// Removed status tracking - no longer needed

// Duration colors will be defined inside the component to use theme colors

export default function UnifiedTimetable() {
  const [msg, ctx] = message.useMessage();
  const { showError, showSuccess } = useErrorHandler();
  const { isDarkMode, theme } = useTheme();
  
  // Theme-aware duration colors
  const DURATION_COLORS = {
    short: theme.token.colorSuccess,    // Green for short sessions
    medium: theme.token.colorPrimary,   // Blue for medium sessions  
    long: theme.token.colorWarning      // Orange for long sessions
  };

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
  const { chaptersById, syllabusContentMap, loading: syllabusLoading, refetch: refetchSyllabus } = useSyllabusLoader(classId, me?.school_code);

  // UI State
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [quickGenerateModalVisible, setQuickGenerateModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [quickGenerateForm] = Form.useForm();

  // Holiday checking
  const { isHoliday, holidayInfo, loading: holidayLoading } = useHolidayCheck(
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
        const { data: adminRow, error: adminErr } = await supabase
          .from('admin').select('id, role, school_code').eq('id', auth.user.id).maybeSingle();
        
        if (adminRow) {
          meRow = adminRow;
        } else {
          const { data: userRow, error: userErr } = await supabase
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
  const subjectName = (id) => subjects.find(s => s.id === id)?.subject_name || '—';
  const adminName = (id) => admins.find(a => a.id === id)?.full_name || '—';

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

  const getSyllabusChapters = (subjectId) => {
    if (!subjectId) return [];
    if (syllabusContentMap.size === 0) return [];

    const chapters = [];
    
    syllabusContentMap.forEach((content, key) => {
      if (content.type === 'chapter' && content.subjectId === subjectId) {
        chapters.push({
          label: `Chapter ${content.chapterNo}: ${content.title}`,
          value: content.chapterId
        });
      }
    });
    
    return chapters.sort((a, b) => a.label.localeCompare(b.label));
  };

  const getSyllabusTopics = (subjectId) => {
    if (!subjectId) return [];
    if (syllabusContentMap.size === 0) return [];

    const topics = [];
    
    syllabusContentMap.forEach((content, key) => {
      if (content.type === 'topic' && content.subjectId === subjectId) {
        topics.push({
          label: `Topic ${content.topicNo}: ${content.title}`,
          value: content.topicId
        });
      }
    });
    
    return topics.sort((a, b) => a.label.localeCompare(b.label));
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
    return daySlots.map(slot => ({
      ...slot,
      subjectName: subjectName(slot.subject_id),
      teacherName: adminName(slot.teacher_id),
      syllabusContent: getSyllabusContent(slot),
      isTaught: taughtBySlotId.has(slot.id)
    }));
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
      padding: 16, 
      background: isDarkMode ? theme.token.colorBgLayout : '#fafafa', 
      minHeight: '100vh' 
    }}>
      <App>
        {ctx}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CalendarOutlined style={{ color: '#1890ff' }} />
            <div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#262626' }}>
                Timetable Management
              </div>
              <div style={{ fontSize: '12px', color: '#8c8c8c', fontWeight: 'normal' }}>
                Create and manage class schedules with syllabus content
              </div>
            </div>
          </div>
        }
        extra={
          <Space wrap size="middle">
            <Select
              placeholder="Select Class"
              value={classId}
              onChange={setClassId}
              options={classOptions}
              style={{ width: 200 }}
              allowClear
            />
            <Space.Compact>
              <Button 
                icon={<LeftOutlined />}
                onClick={() => handleDateNavigation('prev')}
                title="Previous Day"
              />
              <DatePicker
                value={date}
                onChange={(selectedDate) => {
                  if (selectedDate) {
                    setDate(selectedDate);
                  }
                }}
                format="MMM DD, YYYY"
                style={{ minWidth: 160 }}
                allowClear={false}
                suffixIcon={<CalendarOutlined />}
              />
              <Button 
                icon={<RightOutlined />}
                onClick={() => handleDateNavigation('next')}
                title="Next Day"
              />
            </Space.Compact>
            <Button 
              onClick={() => handleDateNavigation('today')}
              type="default"
            >
              Today
            </Button>
          </Space>
        }
      >
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

        {/* Schedule Content */}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Daily progress summary */}
            <Alert
              type="info"
              showIcon
              message={`Taught ${taughtCounts.taughtPeriods} / ${taughtCounts.totalPeriods} periods`}
              style={{ marginBottom: 8 }}
            />
            {scheduleData.map((slot, index) => {
              const isBreak = slot.slot_type === 'break';
              const isActualPeriod = slot.slot_type === 'period';
              
              return (
                <Card
                  key={slot.id}
                  size="small"
                  style={{
                    border: '1px solid #e8e8e8',
                    borderRadius: '8px',
                    background: isBreak ? '#f8f9fa' : '#ffffff'
                  }}
                >
                  <Row align="middle" justify="space-between">
                    <Col flex="auto">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {/* Time */}
                        <div style={{ 
                          minWidth: '80px', 
                          fontSize: '12px', 
                          color: '#666',
                          fontWeight: '500'
                        }}>
                          {slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}
                        </div>

                        {/* Period Info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {isBreak ? (
                            <Tag color="default" style={{ margin: 0 }}>
                              {slot.name || 'Break'}
                            </Tag>
                          ) : (
                            <Tag color="blue" style={{ margin: 0 }}>
                              Period {slot.period_number}
                            </Tag>
                          )}
                        </div>

                        {/* Subject & Teacher */}
                        {isActualPeriod && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Text style={{ fontSize: '14px', fontWeight: '500', margin: 0 }}>
                              {slot.subjectName}
                            </Text>
                            <Text style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                              • {slot.teacherName}
                            </Text>
                          </div>
                        )}

                        {/* Syllabus Content */}
                        {isActualPeriod && slot.syllabusContent && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Text style={{ 
                              color: '#52c41a', 
                              fontSize: '11px', 
                              fontWeight: '500',
                              margin: 0
                            }}>
                              📚 {slot.syllabusContent}
                            </Text>
                          </div>
                        )}
                      </div>
                    </Col>

                    {/* Actions */}
                    <Col>
                      <Space>
                        {isActualPeriod && (
                          <Tooltip title={slot.isTaught ? 'Unmark taught' : 'Mark as taught'}>
                            <Button
                              type={slot.isTaught ? 'primary' : 'default'}
                              icon={<CheckOutlined />}
                              size="small"
                              onClick={() => handleToggleTaught(slot)}
                            >
                              {slot.isTaught ? 'Taught' : 'Mark Taught'}
                            </Button>
                          </Tooltip>
                        )}
                        <Tooltip title="Edit">
                          <Button
                            type="text"
                            icon={<EditOutlined />}
                            size="small"
                            onClick={() => openEditModal(slot)}
                          />
                        </Tooltip>
                        <Popconfirm
                          title="Delete this slot?"
                          description="This action cannot be undone."
                          onConfirm={() => handleDelete(slot)}
                          okText="Yes"
                          cancelText="No"
                        >
                          <Tooltip title="Delete">
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              size="small"
                            />
                          </Tooltip>
                        </Popconfirm>
                      </Space>
                    </Col>
                  </Row>
                </Card>
              );
            })}
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

        {/* Add Period Button - only show when there are existing items to avoid duplicate CTA in empty state */}
        {classId && !isHoliday && scheduleData.length > 0 && (
          <div style={{ 
            marginTop: 16, 
            padding: '16px 0', 
            borderTop: '1px solid #f0f0f0',
            textAlign: 'center'
          }}>
            <Space>
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => openAddModal('period')}
                size="large"
              >
                Add Period
              </Button>
              <Button 
                icon={<PlusOutlined />}
                onClick={() => openAddModal('break')}
                size="large"
              >
                Add Break
              </Button>
            </Space>
          </div>
        )}
      </Card>

      {/* Edit Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BookOutlined style={{ color: '#1890ff' }} />
            <div>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>
                {editingSlot ? 'Edit Schedule Item' : 'Add Schedule Item'}
              </div>
              <div style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>
                {editingSlot ? 'Update period details and syllabus content' : 'Create a new period with syllabus content'}
              </div>
            </div>
          </div>
        }
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        width={600}
        footer={[
          <Button key="cancel" onClick={() => setEditModalVisible(false)}>
            Cancel
          </Button>,
          <Button key="save" type="primary" loading={loading} onClick={handleSave}>
            {editingSlot ? 'Update' : 'Create'}
          </Button>
        ]}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            slot_type: 'period',
            start_time: '09:00:00',
            end_time: '09:40:00'
          }}
        >
          <Form.Item label="Type" name="slot_type" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio value="period">Period</Radio>
              <Radio value="break">Break</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue }) =>
              getFieldValue('slot_type') === 'period' ? (
                <div>
                  <Form.Item label="Period Number" name="period_number" rules={[{ required: true }]}>
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                  
                  <Form.Item label="Start Time" name="start_time" rules={[{ required: true }]}>
                    <Input type="time" />
                  </Form.Item>
                  
                  <Form.Item label="End Time" name="end_time" rules={[{ required: true }]}>
                    <Input type="time" />
                  </Form.Item>
                  
                  <Form.Item label="Subject" name="subject_id" rules={[{ required: true }]}>
                    <Select
                      showSearch
                      placeholder="Select subject"
                      options={subjects.map(s => ({ label: s.subject_name, value: s.id }))}
                      optionFilterProp="label"
                      onChange={(value) => {
                        form.setFieldsValue({
                          syllabus_chapter_id: null,
                          syllabus_topic_id: null
                        });
                      }}
                    />
                  </Form.Item>
                  
                  <Form.Item label="Teacher" name="teacher_id" rules={[{ required: true }]}>
                    <Select
                      showSearch
                      placeholder="Select teacher"
                      options={admins.map(a => ({ label: a.full_name, value: a.id }))}
                      optionFilterProp="label"
                    />
                  </Form.Item>

                  <Form.Item label="Syllabus Chapter" name="syllabus_chapter_id">
                    <Select
                      showSearch
                      placeholder="Select chapter (optional)"
                      allowClear
                      options={(() => {
                        const subjectId = form.getFieldValue('subject_id');
                        return getSyllabusChapters(subjectId);
                      })()}
                      optionFilterProp="label"
                    />
                  </Form.Item>

                  <Form.Item label="Syllabus Topic" name="syllabus_topic_id">
                    <Select
                      showSearch
                      placeholder="Select topic (optional)"
                      allowClear
                      options={(() => {
                        const subjectId = form.getFieldValue('subject_id');
                        return getSyllabusTopics(subjectId);
                      })()}
                      optionFilterProp="label"
                    />
                  </Form.Item>
                  
                  <Form.Item label="Lesson Notes" name="plan_text">
                    <TextArea
                      placeholder="Add notes about this period..."
                      rows={3}
                    />
                  </Form.Item>
                </div>
              ) : (
                <div>
                  <Form.Item label="Break Name" name="name" rules={[{ required: true }]}>
                    <Input placeholder="e.g., Lunch, Recess, Assembly" />
                  </Form.Item>
                  
                  <Form.Item label="Start Time" name="start_time" rules={[{ required: true }]}>
                    <Input type="time" />
                  </Form.Item>
                  
                  <Form.Item label="End Time" name="end_time" rules={[{ required: true }]}>
                    <Input type="time" />
                  </Form.Item>
                </div>
              )
            }
          </Form.Item>
        </Form>
      </Modal>

      </App>
    </div>
  );
}
