import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Typography, Badge, Tag, List, Space, Alert, Spin,
  Row, Col, Statistic, Drawer, Button, Tooltip, Empty, Segmented
} from 'antd';
import {
  CalendarOutlined, ClockCircleOutlined, BellOutlined, BookOutlined,
  TrophyOutlined, LeftOutlined, RightOutlined, AppstoreOutlined,
  UnorderedListOutlined, FilterOutlined, PlayCircleOutlined, FireOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import weekday from 'dayjs/plugin/weekday';
import localeData from 'dayjs/plugin/localeData';
import updateLocale from 'dayjs/plugin/updateLocale';
import relativeTime from 'dayjs/plugin/relativeTime';
import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/AuthProvider';
import { getStudentCode, getSchoolCode } from '@/shared/utils/metadata';
import { useTheme } from '@/contexts/ThemeContext';

// Extend dayjs with plugins
dayjs.extend(isBetween);
dayjs.extend(isSameOrAfter);
dayjs.extend(weekday);
dayjs.extend(localeData);
dayjs.extend(updateLocale);
dayjs.extend(relativeTime);

// Set week to start on Monday
dayjs.updateLocale('en', {
  weekStart: 1,
});

const { Title, Text, Paragraph } = Typography;

// Event type configurations
const EVENT_TYPES = {
  test: {
    label: 'Exam',
    color: '#ff4d4f',
    bgColor: '#fff1f0',
    icon: <TrophyOutlined />,
    emoji: '📝'
  },
  timetable: {
    label: 'Class',
    color: '#1890ff',
    bgColor: '#e6f7ff',
    icon: <BookOutlined />,
    emoji: '📚'
  },
  event: {
    label: 'Activity',
    color: '#52c41a',
    bgColor: '#f6ffed',
    icon: <CalendarOutlined />,
    emoji: '🎯'
  },
  holiday: {
    label: 'Holiday',
    color: '#faad14',
    bgColor: '#fffbe6',
    icon: <CalendarOutlined />,
    emoji: '🌟'
  }
};

const StudentCalendar = () => {
  const { user } = useAuth();
  const { theme, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [student, setStudent] = useState(null);
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [alert, setAlert] = useState(null);
  const [viewMode, setViewMode] = useState('month'); // month, week, list
  const [filterType, setFilterType] = useState('all'); // all, test, timetable, event
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Fetch student data
  useEffect(() => {
    const fetchStudent = async () => {
      if (!user) return;

      setLoading(true);
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

        // Fetch events
        await fetchEvents(data);
      } catch (err) {
        console.error('Failed to fetch student:', err);
        setAlert({ 
          type: 'error', 
          message: err.message || 'Failed to load student data. Please contact support.' 
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStudent();
  }, [user]);

  const fetchEvents = async (studentData) => {
    try {
      // Fetch school-wide and class-specific events
      const { data, error } = await supabase
        .from('school_calendar_events')
        .select('id, title, description, event_type, start_date, end_date, is_all_day, start_time, end_time, color')
        .eq('school_code', studentData.school_code)
        .or(`class_instance_id.is.null,class_instance_id.eq.${studentData.class_instance_id}`)
        .eq('is_active', true)
        .order('start_date', { ascending: true });

      if (error) throw error;

      setEvents(data || []);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
  };

  // Helper function to map event to display format
  const mapEventToDisplay = (event) => {
    const eventType = EVENT_TYPES[event.event_type] || EVENT_TYPES.event;
    const eventDate = dayjs(event.start_date);
    const daysUntil = eventDate.diff(dayjs(), 'day');
    
    return {
      ...event,
      type: event.event_type,
      date: eventDate,
      time: event.is_all_day 
        ? 'All Day' 
        : event.start_time 
          ? `${dayjs(event.start_time, 'HH:mm:ss').format('hh:mm A')}${event.end_time ? ` - ${dayjs(event.end_time, 'HH:mm:ss').format('hh:mm A')}` : ''}`
          : 'Time TBD',
      title: event.title,
      subtitle: event.description,
      color: event.color || eventType.color,
      bgColor: eventType.bgColor,
      emoji: eventType.emoji,
      daysUntil
    };
  };

  // Calculate next event
  const nextEvent = useMemo(() => {
    if (!events.length) return null;
    
    const upcoming = events
      .filter(e => dayjs(e.start_date).isSameOrAfter(dayjs(), 'day'))
      .map(mapEventToDisplay)
      .filter(e => filterType === 'all' || e.type === filterType);
    
    return upcoming.length > 0 ? upcoming[0] : null;
  }, [events, filterType]);

  // Calculate upcoming events
  const upcomingEvents = useMemo(() => {
    return events
      .filter(e => dayjs(e.start_date).isSameOrAfter(dayjs(), 'day'))
      .slice(0, 10)
      .map(mapEventToDisplay)
      .filter(e => filterType === 'all' || e.type === filterType);
  }, [events, filterType]);

  // Get events for a specific date
  const getEventsForDate = (date) => {
    return events
      .filter(event => {
        const startDate = dayjs(event.start_date);
        const endDate = event.end_date ? dayjs(event.end_date) : startDate;
        return date.isBetween(startDate, endDate, 'day', '[]');
      })
      .map(mapEventToDisplay)
      .filter(e => filterType === 'all' || e.type === filterType);
  };

  // Calendar navigation
  const handlePreviousMonth = () => {
    setCurrentDate(currentDate.subtract(1, 'month'));
  };

  const handleNextMonth = () => {
    setCurrentDate(currentDate.add(1, 'month'));
  };

  const handleToday = () => {
    setCurrentDate(dayjs());
    setSelectedDate(dayjs());
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    const eventsForDate = getEventsForDate(date);
    setSelectedEvents(eventsForDate);
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const startOfMonth = currentDate.startOf('month');
    const endOfMonth = currentDate.endOf('month');
    const startDate = startOfMonth.startOf('week');
    const endDate = endOfMonth.endOf('week');

    const days = [];
    let day = startDate;

    while (day.isBefore(endDate) || day.isSame(endDate, 'day')) {
      days.push(day);
      day = day.add(1, 'day');
    }

    return days;
  };

  if (!student && !loading) {
    return (
      <div style={{ padding: 24 }}>
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

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Space direction="vertical" align="center">
          <Spin size="large" />
          <Text type="secondary">Loading calendar...</Text>
        </Space>
      </div>
    );
  }

  return (
    <div style={{ padding: '0' }}>
      {/* Header with Title and Actions */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 20 }}>
        <Col>
          <Title level={3} style={{ margin: 0, fontWeight: 600 }}>
            📅 School Calendar
          </Title>
          <Text type="secondary">Your personalized schedule and events</Text>
        </Col>
        <Col>
          <Space>
            <Segmented
              value={viewMode}
              onChange={setViewMode}
              options={[
                { label: 'Month', value: 'month', icon: <AppstoreOutlined /> },
                { label: 'List', value: 'list', icon: <UnorderedListOutlined /> }
              ]}
            />
          </Space>
        </Col>
      </Row>

      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          showIcon
          closable
          onClose={() => setAlert(null)}
          style={{ marginBottom: 20 }}
        />
      )}

      {/* Next Event Summary Bar */}
      {nextEvent && (
        <Card
          style={{
            marginBottom: 20,
            background: `linear-gradient(135deg, ${nextEvent.bgColor} 0%, ${nextEvent.color}15 100%)`,
            border: `1px solid ${nextEvent.color}40`,
            borderRadius: 12
          }}
        >
          <Row align="middle" gutter={16}>
            <Col>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: nextEvent.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24
              }}>
                {nextEvent.emoji}
              </div>
            </Col>
            <Col flex="auto">
              <Space direction="vertical" size={0}>
                <Text strong style={{ fontSize: 16, color: nextEvent.color }}>
                  Next Event: {nextEvent.title}
                </Text>
                <Text type="secondary">
                  {nextEvent.subtitle && `${nextEvent.subtitle} • `}
                  {nextEvent.date.format('MMM DD, YYYY')}
                  {nextEvent.daysUntil !== null && nextEvent.daysUntil >= 0 && (
                    <Tag
                      color={nextEvent.daysUntil <= 1 ? 'red' : 'orange'}
                      style={{ marginLeft: 8 }}
                    >
                      {nextEvent.daysUntil === 0 ? '⏰ Today' : nextEvent.daysUntil === 1 ? '⏰ Tomorrow' : `⏰ ${nextEvent.daysUntil} days left`}
                    </Tag>
                  )}
                </Text>
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      {/* Stats and Filter Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered={false}
            style={{
              background: isDarkMode ? theme.token.colorBgElevated : '#fff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 2px 4px rgba(0,0,0,0.04)',
              borderRadius: 8
            }}
          >
            <Statistic
              title="Total Events"
              value={events.length}
              prefix={<CalendarOutlined style={{ color: theme.token.colorPrimary }} />}
              valueStyle={{ color: theme.token.colorPrimary }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered={false}
            style={{
              background: isDarkMode ? theme.token.colorBgElevated : '#fff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 2px 4px rgba(0,0,0,0.04)',
              borderRadius: 8
            }}
          >
            <Statistic
              title="Upcoming Events"
              value={upcomingEvents.length}
              prefix={<BellOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={24} lg={12}>
          <Card
            bordered={false}
            style={{
              background: isDarkMode ? theme.token.colorBgElevated : '#fff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 2px 4px rgba(0,0,0,0.04)',
              borderRadius: 8,
              height: '100%'
            }}
          >
            <Space direction="vertical" size={0} style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 14 }}>
                <FilterOutlined /> Filter by Type
              </Text>
              <Segmented
                value={filterType}
                onChange={setFilterType}
                block
                options={[
                  { label: 'All', value: 'all' },
                  { label: '📝 Events', value: 'event' },
                  { label: '🌟 Holidays', value: 'holiday' }
                ]}
                style={{ marginTop: 8 }}
              />
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Calendar Controls */}
      <Card
        size="small"
        style={{
          marginBottom: 16,
          borderRadius: 8,
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}
      >
        <Row align="middle" justify="space-between">
          <Col>
            <Space>
              <Button
                icon={<LeftOutlined />}
                onClick={handlePreviousMonth}
                size="middle"
              />
              <Button
                icon={<RightOutlined />}
                onClick={handleNextMonth}
                size="middle"
              />
            </Space>
          </Col>
          <Col>
            <Title level={4} style={{ margin: 0, fontWeight: 600 }}>
              {currentDate.format('MMMM YYYY')}
            </Title>
          </Col>
          <Col>
            <Button
              icon={<CalendarOutlined />}
              onClick={handleToday}
              type="primary"
            >
              Today
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Main Content: Calendar + Upcoming Events */}
      <Row gutter={16}>
        {/* Calendar Grid */}
        <Col xs={24} lg={17}>
          {viewMode === 'month' ? (
            <Card
              bordered={false}
              style={{
                borderRadius: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                overflow: 'hidden'
              }}
            >
              <div style={{
                border: `1px solid ${isDarkMode ? theme.token.colorBorder : '#f0f0f0'}`,
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: isDarkMode ? theme.token.colorBgContainer : '#fff'
              }}>
                {/* Week Headers */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  backgroundColor: isDarkMode ? theme.token.colorBgElevated : '#fafafa',
                  borderBottom: `1px solid ${isDarkMode ? theme.token.colorBorder : '#e8e8e8'}`
                }}>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <div key={day} style={{
                      padding: '12px 8px',
                      textAlign: 'center',
                      fontWeight: 600,
                      fontSize: '13px',
                      color: theme.token.colorTextSecondary,
                      borderRight: `1px solid ${isDarkMode ? theme.token.colorBorder : '#f0f0f0'}`
                    }}>
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                  {generateCalendarDays().map((day, index) => {
                    const isCurrentMonth = day.isSame(currentDate, 'month');
                    const isToday = day.isSame(dayjs(), 'day');
                    const isSelected = day.isSame(selectedDate, 'day');
                    const dayEvents = getEventsForDate(day);
                    const isWeekend = day.day() === 0;

                    return (
                      <div
                        key={index}
                        style={{
                          minHeight: '100px',
                          borderRight: `1px solid ${theme.token.colorBorder}`,
                          borderBottom: `1px solid ${theme.token.colorBorder}`,
                          padding: '8px',
                          backgroundColor: isSelected
                            ? `${theme.token.colorPrimary}15`
                            : isToday
                              ? `${theme.token.colorWarning}10`
                              : theme.token.colorBgContainer,
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          border: isSelected ? `2px solid ${theme.token.colorPrimary}` : undefined
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = theme.token.colorFillTertiary;
                            e.currentTarget.style.transform = 'scale(1.02)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = isSelected
                            ? `${theme.token.colorPrimary}15`
                            : isToday
                              ? `${theme.token.colorWarning}10`
                              : theme.token.colorBgContainer;
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                        onClick={() => {
                          handleDateSelect(day);
                          if (dayEvents.length > 0) {
                            setSelectedEvent(dayEvents[0]);
                            setDrawerVisible(true);
                          }
                        }}
                      >
                        {/* Date Number */}
                        <div style={{
                          fontSize: '14px',
                          fontWeight: isToday ? 700 : isSelected ? 600 : 'normal',
                          color: isCurrentMonth
                            ? (isToday ? theme.token.colorPrimary : (isWeekend ? theme.token.colorTextSecondary : theme.token.colorText))
                            : theme.token.colorTextDisabled,
                          marginBottom: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <span>{day.format('D')}</span>
                          {dayEvents.length > 0 && (
                            <Badge
                              count={dayEvents.length}
                              size="small"
                              style={{
                                backgroundColor: theme.token.colorPrimary,
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                              }}
                            />
                          )}
                        </div>

                        {/* Events */}
                        <div style={{ maxHeight: '70px', overflow: 'hidden' }}>
                          {dayEvents.slice(0, 2).map((event, eventIndex) => (
                            <Tooltip
                              key={eventIndex}
                              title={`${event.emoji} ${event.title} - ${event.time}`}
                              placement="top"
                            >
                              <div
                                style={{
                                  padding: '3px 6px',
                                  margin: '3px 0',
                                  borderRadius: '4px',
                                  backgroundColor: event.color,
                                  color: 'white',
                                  fontSize: '11px',
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEvent(event);
                                  setDrawerVisible(true);
                                }}
                              >
                                <span style={{ fontSize: '12px' }}>{event.emoji}</span>
                                <span>{event.title}</span>
                              </div>
                            </Tooltip>
                          ))}
                          {dayEvents.length > 2 && (
                            <div style={{
                              fontSize: '10px',
                              color: theme.token.colorTextSecondary,
                              textAlign: 'center',
                              marginTop: '2px',
                              fontWeight: 500
                            }}>
                              +{dayEvents.length - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          ) : (
            // List View
            <Card
              title={
                <Space>
                  <UnorderedListOutlined />
                  <span>All Events</span>
                </Space>
              }
              bordered={false}
              style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            >
              <List
                dataSource={upcomingEvents}
                renderItem={(event) => (
                  <List.Item
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      marginBottom: '8px',
                      backgroundColor: event.bgColor,
                      border: `1px solid ${event.color}30`,
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setSelectedEvent(event);
                      setDrawerVisible(true);
                    }}
                  >
                    <List.Item.Meta
                      avatar={
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: '10px',
                          background: event.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '20px'
                        }}>
                          {event.emoji}
                        </div>
                      }
                      title={
                        <Space>
                          <Text strong>{event.title}</Text>
                          <Tag color={event.color}>{EVENT_TYPES[event.type]?.label}</Tag>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={0}>
                          <Text type="secondary">{event.date.format('MMM DD, YYYY')} • {event.time}</Text>
                          {event.subtitle && <Text type="secondary">{event.subtitle}</Text>}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Col>

        {/* Upcoming Events Sidebar */}
        <Col xs={24} lg={7}>
          <Card
            title={
              <Space>
                <BellOutlined />
                <span>Upcoming Events</span>
              </Space>
            }
            bordered={false}
            style={{
              borderRadius: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              position: 'sticky',
              top: 20
            }}
          >
            {upcomingEvents.length > 0 ? (
              <List
                dataSource={upcomingEvents.slice(0, 5)}
                renderItem={(event) => (
                  <List.Item
                    style={{
                      padding: '12px 0',
                      borderBottom: `1px solid ${theme.token.colorBorderSecondary}`,
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setSelectedEvent(event);
                      setDrawerVisible(true);
                    }}
                  >
                    <List.Item.Meta
                      avatar={
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: '8px',
                          background: event.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px'
                        }}>
                          {event.emoji}
                        </div>
                      }
                      title={
                        <Text strong ellipsis style={{ fontSize: '14px' }}>
                          {event.title}
                        </Text>
                      }
                      description={
                        <Space direction="vertical" size={0}>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {event.date.format('MMM DD')} • {event.time}
                          </Text>
                          {event.daysUntil !== null && event.daysUntil >= 0 && (
                            <Tag
                              color={event.daysUntil <= 1 ? 'red' : 'orange'}
                              style={{ marginTop: 4, fontSize: '10px' }}
                            >
                              {event.daysUntil === 0 ? 'Today' : event.daysUntil === 1 ? 'Tomorrow' : `In ${event.daysUntil} days`}
                            </Tag>
                          )}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No upcoming events"
                style={{ padding: '20px 0' }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Event Details Drawer */}
      <Drawer
        title={
          selectedEvent && (
            <Space>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: selectedEvent.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px'
              }}>
                {selectedEvent.emoji}
              </div>
              <span>{selectedEvent.title}</span>
            </Space>
          )
        }
        placement="right"
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setSelectedEvent(null);
        }}
        width={400}
      >
        {selectedEvent && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Text type="secondary">Event Type</Text>
              <div style={{ marginTop: 8 }}>
                <Tag color={selectedEvent.color} style={{ fontSize: '14px', padding: '4px 12px' }}>
                  {EVENT_TYPES[selectedEvent.type]?.label || selectedEvent.type}
                </Tag>
              </div>
            </div>

            <div>
              <Text type="secondary">Date & Time</Text>
              <div style={{ marginTop: 8 }}>
                <Space direction="vertical" size={4}>
                  <Text strong>
                    <CalendarOutlined /> {selectedEvent.date?.format('MMMM DD, YYYY')}
                  </Text>
                  <Text>
                    <ClockCircleOutlined /> {selectedEvent.time}
                  </Text>
                </Space>
              </div>
            </div>

            {selectedEvent.subtitle && (
              <div>
                <Text type="secondary">Details</Text>
                <Paragraph style={{ marginTop: 8 }}>
                  {selectedEvent.subtitle}
                </Paragraph>
              </div>
            )}

            {selectedEvent.daysUntil !== null && selectedEvent.daysUntil >= 0 && (
              <Card
                size="small"
                style={{
                  background: selectedEvent.daysUntil <= 1 ? '#fff1f0' : '#fffbe6',
                  border: `1px solid ${selectedEvent.daysUntil <= 1 ? '#ffccc7' : '#ffe58f'}`
                }}
              >
                <Space>
                  <FireOutlined style={{ color: selectedEvent.daysUntil <= 1 ? '#ff4d4f' : '#faad14', fontSize: 20 }} />
                  <div>
                    <Text strong>{selectedEvent.daysUntil === 0 ? 'Happening Today!' : selectedEvent.daysUntil === 1 ? 'Tomorrow!' : `${selectedEvent.daysUntil} Days Left`}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {selectedEvent.daysUntil <= 2 ? 'Don\'t forget to prepare!' : 'Mark your calendar'}
                    </Text>
                  </div>
                </Space>
              </Card>
            )}
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default StudentCalendar;

