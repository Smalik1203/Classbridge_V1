// src/components/calendar/StudentCalendar.jsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Typography, Tag, List, Empty, Spin, Alert, Row, Col, Statistic, Tooltip, Badge } from 'antd';
import { 
  CalendarOutlined, 
  ClockCircleOutlined, 
  BookOutlined, 
  TrophyOutlined,
  PlayCircleOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '../../AuthProvider';
import { getSchoolCode, getUserRole } from '../../utils/metadata';
import { getStudentCalendarData } from '../../services/calendarIntegrationService';
import { useTheme } from '../../contexts/ThemeContext';

const { Title, Text } = Typography;

const StudentCalendar = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [calendarData, setCalendarData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  
  const schoolCode = getSchoolCode(user);
  const userRole = getUserRole(user);

  useEffect(() => {
    if (schoolCode && user?.id) {
      loadCalendarData();
    }
  }, [schoolCode, user?.id, currentDate]);

  const loadCalendarData = async () => {
    if (!schoolCode || !user?.id) return;
    
    setLoading(true);
    try {
      const startDate = currentDate.startOf('month').format('YYYY-MM-DD');
      const endDate = currentDate.endOf('month').format('YYYY-MM-DD');
      
      const data = await getStudentCalendarData(user.id, schoolCode, startDate, endDate);
      setCalendarData(data);
    } catch (error) {
      console.error('Error loading student calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

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

  const getEventsForDate = (date) => {
    if (!calendarData) return [];
    
    const dateStr = date.format('YYYY-MM-DD');
    const dayEvents = [];
    
    // Add timetable events
    calendarData.timetable.forEach(slot => {
      if (slot.class_date === dateStr) {
        dayEvents.push({
          type: 'timetable',
          title: `${slot.subjects?.subject_name || 'Subject'} - Period ${slot.period_number}`,
          time: `${slot.start_time?.slice(0, 5)} - ${slot.end_time?.slice(0, 5)}`,
          color: theme.token.colorInfo,
          icon: <ClockCircleOutlined />
        });
      }
    });
    
    // Add test events
    calendarData.tests.forEach(test => {
      if (test.test_date === dateStr) {
        dayEvents.push({
          type: 'test',
          title: `${test.title} (${test.test_type})`,
          time: test.time_limit_seconds ? `${Math.floor(test.time_limit_seconds / 60)} min` : 'Test',
          color: theme.token.colorWarning,
          icon: <TrophyOutlined />,
          test: test
        });
      }
    });
    
    // Add calendar events
    calendarData.events.forEach(event => {
      const eventStart = dayjs(event.start_date);
      const eventEnd = event.end_date ? dayjs(event.end_date) : eventStart;
      
      if (eventStart.isSameOrBefore(date, 'day') && eventEnd.isSameOrAfter(date, 'day')) {
        dayEvents.push({
          type: 'event',
          title: event.title,
          time: event.start_time ? `${event.start_time} - ${event.end_time}` : 'All Day',
          color: event.color || theme.token.colorPrimary,
          icon: <CalendarOutlined />
        });
      }
    });
    
    return dayEvents.sort((a, b) => {
      if (a.time && b.time) {
        return a.time.localeCompare(b.time);
      }
      return 0;
    });
  };

  const renderEventItem = (event, index) => (
    <div
      key={index}
      style={{
        padding: '4px 8px',
        margin: '2px 0',
        borderRadius: '4px',
        backgroundColor: event.color,
        color: 'white',
        fontSize: '10px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}
      onClick={() => {
        if (event.test) {
          // Navigate to test taking
          window.location.href = `/test-taking/${event.test.id}`;
        }
      }}
    >
      {event.icon}
      <span>{event.title}</span>
    </div>
  );

  const generateCalendarDays = () => {
    const startOfMonth = currentDate.startOf('month');
    const endOfMonth = currentDate.endOf('month');
    const startOfWeek = startOfMonth.startOf('week').add(1, 'day'); // Monday
    const endOfWeek = endOfMonth.endOf('week');
    
    const days = [];
    let currentDay = startOfWeek;
    
    while (currentDay.isSameOrBefore(endOfWeek)) {
      days.push(currentDay);
      currentDay = currentDay.add(1, 'day');
    }
    
    return days;
  };

  if (!schoolCode) {
    return (
      <Card>
        <Alert
          type="warning"
          message="School context not found"
          description="Please contact your administrator to set up your school context."
        />
      </Card>
    );
  }

  if (userRole !== 'student') {
    return (
      <Card>
        <Alert
          type="info"
          message="Student Calendar"
          description="This view is specifically designed for students. Please use the main calendar for other roles."
        />
      </Card>
    );
  }

  return (
    <div>
      {/* Calendar Header */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row align="middle" justify="space-between">
          <Col>
            <Space>
              <Button 
                icon={<LeftOutlined />}
                onClick={handlePreviousMonth}
                size="small"
              />
              <Button 
                icon={<RightOutlined />}
                onClick={handleNextMonth}
                size="small"
              />
              <Button 
                icon={<CalendarOutlined />}
                onClick={handleToday}
                size="small"
              >
                Today
              </Button>
            </Space>
          </Col>
          <Col>
            <Title level={4} style={{ margin: 0 }}>
              {currentDate.format('MMMM YYYY')}
            </Title>
          </Col>
          <Col>
            <Space>
              <DatePicker
                value={selectedDate}
                onChange={handleDateSelect}
                format="DD-MM-YYYY"
                style={{ minWidth: 160 }}
                placeholder="Select Date"
                showToday
                allowClear={false}
              />
              <Button 
                onClick={() => handleDateSelect(dayjs())}
                size="small"
                type="primary"
              >
                Today
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <div style={{
          border: '1px solid #d9d9d9',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: '#fff'
        }}>
          {/* Week Headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            backgroundColor: '#fafafa',
            borderBottom: '1px solid #d9d9d9'
          }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} style={{
                padding: '12px 8px',
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: '14px',
                color: '#666',
                borderRight: '1px solid #f0f0f0'
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
              const isWeekend = day.day() === 0; // Sunday

              return (
                <div
                  key={index}
                  style={{
                    minHeight: '100px',
                    borderRight: `1px solid ${theme.token.colorBorder}`,
                    borderBottom: `1px solid ${theme.token.colorBorder}`,
                    padding: '8px',
                    backgroundColor: isSelected ? theme.token.colorPrimaryBg : isToday ? theme.token.colorWarningBg : theme.token.colorBgContainer,
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.token.colorFillTertiary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isSelected ? theme.token.colorPrimaryBg : isToday ? theme.token.colorWarningBg : theme.token.colorBgContainer;
                  }}
                  onClick={() => handleDateSelect(day)}
                >
                  {/* Date Number */}
                  <div style={{
                    fontSize: '14px',
                    fontWeight: isToday ? 'bold' : 'normal',
                    color: isCurrentMonth ? (isToday ? '#1890ff' : (isWeekend ? '#8c8c8c' : '#000')) : '#ccc',
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span>{day.format('D')}</span>
                    {dayEvents.length > 0 && (
                      <Badge count={dayEvents.length} size="small" />
                    )}
                  </div>

                  {/* Events */}
                  <div style={{ maxHeight: '70px', overflow: 'hidden' }}>
                    {dayEvents.slice(0, 3).map((event, eventIndex) => 
                      renderEventItem(event, eventIndex)
                    )}
                    {dayEvents.length > 3 && (
                      <div style={{
                        fontSize: '9px',
                        color: '#666',
                        textAlign: 'center',
                        marginTop: '2px'
                      }}>
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Selected Date Details */}
      {selectedDate && (
        <Card 
          title={
            <Space>
              <CalendarOutlined />
              <span>{selectedDate.format('MMMM DD, YYYY')}</span>
              <Tag color="blue">Student View</Tag>
            </Space>
          }
          style={{ marginTop: 16 }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Spin />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">Loading activities...</Text>
              </div>
            </div>
          ) : getEventsForDate(selectedDate).length > 0 ? (
            <List
              dataSource={getEventsForDate(selectedDate)}
              renderItem={(event, index) => (
                <List.Item
                  key={index}
                  actions={[
                    event.test && (
                      <Button 
                        type="link" 
                        size="small" 
                        icon={<PlayCircleOutlined />}
                        onClick={() => window.location.href = `/test-taking/${event.test.id}`}
                      >
                        Take Test
                      </Button>
                    )
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    avatar={
                      <div style={{ 
                        width: 32, 
                        height: 32, 
                        borderRadius: '50%', 
                        backgroundColor: event.color, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: 'white'
                      }}>
                        {event.icon}
                      </div>
                    }
                    title={
                      <Space>
                        <Text strong>{event.title}</Text>
                        <Tag color={event.color}>{event.type}</Tag>
                      </Space>
                    }
                    description={
                      <div>
                        <Text type="secondary">{event.time}</Text>
                        {event.test && (
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              {event.test.subjects?.subject_name || 'Subject'} • 
                              {event.test.test_mode === 'online' ? 'Online Test' : 'Offline Test'}
                            </Text>
                          </div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No activities scheduled for this date"
            />
          )}
        </Card>
      )}
    </div>
  );
};

export default StudentCalendar;
