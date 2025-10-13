import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, DatePicker, Typography, Space, Tag, Empty, Spin, Row, Col, 
  Statistic, Progress, Alert, Button, Tooltip
} from 'antd';
import {
  CalendarOutlined, ClockCircleOutlined, BookOutlined, 
  UserOutlined, LeftOutlined, RightOutlined, CheckCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import weekday from 'dayjs/plugin/weekday';
import localeData from 'dayjs/plugin/localeData';
import updateLocale from 'dayjs/plugin/updateLocale';
import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/AuthProvider';
import { getStudentCode, getSchoolCode } from '@/shared/utils/metadata';
import { useTheme } from '@/contexts/ThemeContext';
import EmptyState from '@/shared/ui/EmptyState';

// Extend dayjs with plugins
dayjs.extend(weekday);
dayjs.extend(localeData);
dayjs.extend(updateLocale);

// Set week to start on Monday
dayjs.updateLocale('en', {
  weekStart: 1,
});

const { Title, Text } = Typography;

const StudentTimetable = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [student, setStudent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [timetableSlots, setTimetableSlots] = useState([]);
  const [subjects, setSubjects] = useState({});
  const [teachers, setTeachers] = useState({});
  const [alert, setAlert] = useState(null);

  // Fetch student data
  useEffect(() => {
    const fetchStudent = async () => {
      if (!user) return;

      try {
        const studentCode = getStudentCode(user);
        const schoolCode = getSchoolCode(user);

        if (!schoolCode) {
          throw new Error('School information not found. Please ensure your account is properly set up.');
        }

        // Try to find student by auth_user_id first (most reliable)
        let { data, error } = await supabase
          .from('student')
          .select('id, full_name, student_code, class_instance_id, school_code')
          .eq('auth_user_id', user.id)
          .eq('school_code', schoolCode)
          .maybeSingle();

        // If not found by auth_user_id, try by student_code or email
        if (!data && !error) {
          let query = supabase
            .from('student')
            .select('id, full_name, student_code, class_instance_id, school_code')
            .eq('school_code', schoolCode);

          if (studentCode) {
            query = query.eq('student_code', studentCode);
          } else if (user.email) {
            query = query.eq('email', user.email);
          }

          const result = await query.maybeSingle();
          data = result.data;
          error = result.error;
        }

        if (error) throw error;
        if (!data) {
          throw new Error('Student record not found. Please contact your administrator to link your account.');
        }

        setStudent(data);

        // Clear any previous alerts on success
        setAlert(null);
      } catch (err) {
        console.error('Failed to fetch student:', err);
        setAlert({ 
          type: 'error', 
          message: err.message || 'Failed to load student data. Please contact support.' 
        });
      }
    };

    fetchStudent();
  }, [user]);

  // Fetch timetable when student or date changes
  useEffect(() => {
    if (student && selectedDate) {
      fetchTimetable();
    }
  }, [student, selectedDate]);

  const fetchTimetable = async () => {
    if (!student?.class_instance_id) return;

    setLoading(true);
    try {
      const dateStr = selectedDate.format('YYYY-MM-DD');

      // Fetch timetable slots
      const { data: slots, error: slotsError } = await supabase
        .from('timetable_slots')
        .select('id, class_date, period_number, slot_type, name, start_time, end_time, subject_id, teacher_id, plan_text')
        .eq('class_instance_id', student.class_instance_id)
        .eq('class_date', dateStr)
        .order('start_time', { ascending: true });

      if (slotsError) throw slotsError;

      setTimetableSlots(slots || []);

      // Fetch subjects and teachers if we have slots
      if (slots && slots.length > 0) {
        const subjectIds = [...new Set(slots.filter(s => s.subject_id).map(s => s.subject_id))];
        const teacherIds = [...new Set(slots.filter(s => s.teacher_id).map(s => s.teacher_id))];

        // Fetch subjects
        if (subjectIds.length > 0) {
          const { data: subjectsData, error: subjectsError } = await supabase
            .from('subjects')
            .select('id, subject_name')
            .in('id', subjectIds);

          if (!subjectsError && subjectsData) {
            const subjectsMap = {};
            subjectsData.forEach(s => {
              subjectsMap[s.id] = s.subject_name;
            });
            setSubjects(subjectsMap);
          }
        }

        // Fetch teachers
        if (teacherIds.length > 0) {
          const { data: teachersData, error: teachersError } = await supabase
            .from('admin')
            .select('id, full_name')
            .in('id', teacherIds);

          if (!teachersError && teachersData) {
            const teachersMap = {};
            teachersData.forEach(t => {
              teachersMap[t.id] = t.full_name;
            });
            setTeachers(teachersMap);
          }
        }
      }
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to load timetable' });
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousDay = () => {
    setSelectedDate(selectedDate.subtract(1, 'day'));
  };

  const goToNextDay = () => {
    setSelectedDate(selectedDate.add(1, 'day'));
  };

  const goToToday = () => {
    setSelectedDate(dayjs());
  };

  // Calculate stats
  const stats = useMemo(() => {
    const periods = timetableSlots.filter(s => s.slot_type === 'period');
    const breaks = timetableSlots.filter(s => s.slot_type === 'break');
    
    return {
      totalSlots: timetableSlots.length,
      periods: periods.length,
      breaks: breaks.length,
      subjects: new Set(periods.filter(s => s.subject_id).map(s => s.subject_id)).size
    };
  }, [timetableSlots]);

  const renderSlotCard = (slot) => {
    const isBreak = slot.slot_type === 'break';
    const backgroundColor = isBreak ? theme.token.colorInfoBg : theme.token.colorBgContainer;
    const borderColor = isBreak ? theme.token.colorInfoBorder : theme.token.colorBorder;

    return (
      <Card
        key={slot.id}
        size="small"
        style={{
          marginBottom: 12,
          borderRadius: 8,
          border: `1px solid ${borderColor}`,
          backgroundColor: backgroundColor,
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}
        bodyStyle={{ padding: 16 }}
      >
        {isBreak ? (
          <Row align="middle" gutter={16}>
            <Col>
              <ClockCircleOutlined style={{ fontSize: 24, color: theme.token.colorInfo }} />
            </Col>
            <Col flex={1}>
              <div>
                <Text strong style={{ fontSize: 16 }}>{slot.name || 'Break'}</Text>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {dayjs(slot.start_time, 'HH:mm:ss').format('hh:mm A')} - {dayjs(slot.end_time, 'HH:mm:ss').format('hh:mm A')}
                  </Text>
                </div>
              </div>
            </Col>
          </Row>
        ) : (
          <div>
            <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
              <Col>
                <Space>
                  <Tag color="blue">Period {slot.period_number}</Tag>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {dayjs(slot.start_time, 'HH:mm:ss').format('hh:mm A')} - {dayjs(slot.end_time, 'HH:mm:ss').format('hh:mm A')}
                  </Text>
                </Space>
              </Col>
            </Row>
            
            <Row gutter={[16, 12]}>
              <Col span={24}>
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BookOutlined style={{ color: theme.token.colorPrimary }} />
                    <Text strong style={{ fontSize: 15 }}>
                      {subjects[slot.subject_id] || 'Unknown Subject'}
                    </Text>
                  </div>
                  
                  {slot.teacher_id && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <UserOutlined style={{ color: theme.token.colorTextSecondary }} />
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        {teachers[slot.teacher_id] || 'Unknown Teacher'}
                      </Text>
                    </div>
                  )}

                  {slot.plan_text && (
                    <div style={{ 
                      marginTop: 8, 
                      padding: 8, 
                      background: theme.token.colorBgLayout,
                      borderRadius: 4 
                    }}>
                      <Text style={{ fontSize: 13, color: theme.token.colorTextSecondary }}>
                        <InfoCircleOutlined style={{ marginRight: 4 }} />
                        {slot.plan_text}
                      </Text>
                    </div>
                  )}
                </Space>
              </Col>
            </Row>
          </div>
        )}
      </Card>
    );
  };

  if (!student && !loading) {
    return (
      <div style={{ padding: 24, background: '#fafafa', minHeight: '100vh' }}>
        <Card>
          <Alert
            type="error"
            message="Student data not found"
            description="Unable to load your student information. Please contact support."
            showIcon
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: '#fafafa', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0, color: '#1f2937' }}>
            My Timetable
          </Title>
          {student && (
            <Text type="secondary" style={{ fontSize: '14px' }}>
              View your daily class schedule
            </Text>
          )}
        </div>

        {alert && (
          <Alert
            type={alert.type}
            message={alert.message}
            showIcon
            closable
            onClose={() => setAlert(null)}
            style={{ marginBottom: 24 }}
          />
        )}

        {/* Date Navigation */}
        <Card style={{ marginBottom: 24, borderRadius: 8 }} bodyStyle={{ padding: '16px 20px' }}>
          <Row justify="space-between" align="middle" gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8}>
              <Space>
                <Button icon={<LeftOutlined />} onClick={goToPreviousDay} />
                <Button onClick={goToToday}>Today</Button>
                <Button icon={<RightOutlined />} onClick={goToNextDay} />
              </Space>
            </Col>
            <Col xs={24} sm={12} md={16} style={{ textAlign: 'right' }}>
              <DatePicker
                value={selectedDate}
                onChange={(date) => date && setSelectedDate(date)}
                style={{ width: '100%', maxWidth: 250 }}
                format="DD MMM YYYY (ddd)"
                disabledDate={(current) => !current}
                locale={{
                  lang: {
                    locale: 'en_US',
                    week: {
                      dow: 1, // Monday is the first day of the week
                    },
                  },
                }}
              />
            </Col>
          </Row>
        </Card>

        {/* Stats Cards */}
        {timetableSlots.length > 0 && (
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={12} sm={6}>
              <Card style={{ textAlign: 'center', borderRadius: 8 }}>
                <Statistic
                  title="Total Periods"
                  value={stats.periods}
                  prefix={<BookOutlined />}
                  valueStyle={{ color: theme.token.colorPrimary }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card style={{ textAlign: 'center', borderRadius: 8 }}>
                <Statistic
                  title="Subjects"
                  value={stats.subjects}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: theme.token.colorSuccess }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card style={{ textAlign: 'center', borderRadius: 8 }}>
                <Statistic
                  title="Breaks"
                  value={stats.breaks}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: theme.token.colorInfo }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card style={{ textAlign: 'center', borderRadius: 8 }}>
                <Statistic
                  title="Total Slots"
                  value={stats.totalSlots}
                  prefix={<CalendarOutlined />}
                  valueStyle={{ color: theme.token.colorTextBase }}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* Timetable Slots */}
        <Card
          title={
            <Space>
              <CalendarOutlined />
              <span>Schedule for {selectedDate.format('DD MMM YYYY (dddd)')}</span>
            </Space>
          }
          style={{ borderRadius: 8 }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
            </div>
          ) : timetableSlots.length === 0 ? (
            <EmptyState
              icon={<CalendarOutlined />}
              title="No classes scheduled"
              description="There are no classes scheduled for this day. Check back later or select a different date."
            />
          ) : (
            <div>
              {timetableSlots.map(renderSlotCard)}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default StudentTimetable;

