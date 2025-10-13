// src/components/calendar/IntegratedCalendar.jsx
import React, { useState, useEffect } from 'react';
import { Card, Modal, Button, Space, Typography, Tag, List, Empty, Spin, Alert, Tabs, Select, DatePicker, Row, Col, Statistic, Tooltip } from 'antd';
import { 
  CalendarOutlined, 
  ClockCircleOutlined, 
  BookOutlined, 
  UserOutlined, 
  TrophyOutlined,
  PlayCircleOutlined,
  EditOutlined,
  EyeOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode, getUserRole } from '@/shared/utils/metadata';
import { 
  getDayData, 
  getClassesForSchool, 
  getTimetableForDate,
  getTestsForDate,
  getCalendarEventsForDateRange
} from '@/features/calendar/services/calendarIntegrationService';
import { useTheme } from '@/contexts/ThemeContext';

const { Title, Text } = Typography;
// Removed TabPane - using items prop in Tabs component

const IntegratedCalendar = ({ 
  selectedDate, 
  onDateSelect, 
  onNavigateToTimetable,
  onNavigateToTest,
  showClassSelector = true,
  refreshKey = 0
}) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [dayData, setDayData] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDateData, setSelectedDateData] = useState(null);
  
  const schoolCode = getSchoolCode(user);
  const userRole = getUserRole(user);

  useEffect(() => {
    if (schoolCode) {
      loadClasses();
    }
  }, [schoolCode]);

  useEffect(() => {
    if (selectedDate && schoolCode) {
      loadDayData();
    }
  }, [selectedDate, selectedClass, schoolCode, refreshKey]);

  const loadClasses = async () => {
    try {
      const classesData = await getClassesForSchool(schoolCode);
      setClasses(classesData);
      
      // Auto-select first class if only one available
      if (classesData.length === 1) {
        setSelectedClass(classesData[0].id);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const loadDayData = async () => {
    if (!selectedDate || !schoolCode) return;
    
    setLoading(true);
    try {
      const data = await getDayData(selectedDate, schoolCode, selectedClass);
      setDayData(data);
    } catch (error) {
      console.error('Error loading day data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateClick = (date) => {
    setSelectedDateData(date);
    setModalVisible(true);
  };

  const getEventTypeColor = (type) => {
    const colors = {
      exam: theme.token.colorWarning,
      holiday: theme.token.colorInfo,
      assembly: theme.token.colorPrimary,
      ptm: theme.token.colorSuccess,
      'sports day': theme.token.colorPrimary,
      'cultural event': theme.token.colorPrimary,
      timetable: theme.token.colorInfo
    };
    return colors[type] || theme.token.colorTextSecondary;
  };

  const getEventTypeIcon = (type) => {
    const icons = {
      exam: <TrophyOutlined />,
      holiday: <CalendarOutlined />,
      assembly: <UserOutlined />,
      ptm: <UserOutlined />,
      timetable: <ClockCircleOutlined />,
      test: <BookOutlined />
    };
    return icons[type] || <InfoCircleOutlined />;
  };

  const renderTimetableItem = (slot) => (
    <List.Item
      key={slot.id}
      actions={[
        <Button 
          type="link" 
          size="small" 
          icon={<EyeOutlined />}
          onClick={() => onNavigateToTimetable && onNavigateToTimetable(selectedDate, slot.class_instance_id)}
        >
          View Details
        </Button>
      ]}
    >
      <List.Item.Meta
        avatar={
          <div style={{ 
            width: 40, 
            height: 40, 
            borderRadius: '50%', 
            backgroundColor: '#13c2c2', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'white'
          }}>
            <ClockCircleOutlined />
          </div>
        }
        title={
          <Space>
            <Text strong>Period {slot.period_number}</Text>
            <Tag color="blue">{slot.slot_type === 'break' ? 'Break' : 'Period'}</Tag>
          </Space>
        }
        description={
          <div>
            <div>
              <Text type="secondary">
                {slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}
              </Text>
            </div>
            {slot.slot_type === 'period' && (
              <div>
                <Text strong>{slot.subjects?.subject_name || 'Subject'}</Text>
                <Text type="secondary"> • {slot.admin?.full_name || 'Teacher'}</Text>
              </div>
            )}
            {slot.slot_type === 'break' && (
              <div>
                <Text>{slot.name || 'Break'}</Text>
              </div>
            )}
            {slot.plan_text && (
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {slot.plan_text}
                </Text>
              </div>
            )}
          </div>
        }
      />
    </List.Item>
  );

  const renderTestItem = (test) => (
    <List.Item
      key={test.id}
      actions={[
        <Button 
          type="link" 
          size="small" 
          icon={<PlayCircleOutlined />}
          onClick={() => onNavigateToTest && onNavigateToTest(test)}
        >
          {test.test_mode === 'online' ? 'Take Test' : 'View Details'}
        </Button>
      ]}
    >
      <List.Item.Meta
        avatar={
          <div style={{ 
            width: 40, 
            height: 40, 
            borderRadius: '50%', 
            backgroundColor: '#faad14', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'white'
          }}>
            <TrophyOutlined />
          </div>
        }
        title={
          <Space>
            <Text strong>{test.title}</Text>
            <Tag color="orange">{test.test_type}</Tag>
            <Tag color={test.test_mode === 'online' ? 'green' : 'blue'}>
              {test.test_mode === 'online' ? 'Online' : 'Offline'}
            </Tag>
          </Space>
        }
        description={
          <div>
            <div>
              <Text type="secondary">
                {test.subjects?.subject_name || 'Subject'} • 
                Grade {test.class_instances?.grade}{test.class_instances?.section}
              </Text>
            </div>
            {test.description && (
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {test.description}
                </Text>
              </div>
            )}
            {test.time_limit_seconds && (
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  <ClockCircleOutlined /> Duration: {Math.floor(test.time_limit_seconds / 60)} minutes
                </Text>
              </div>
            )}
          </div>
        }
      />
    </List.Item>
  );

  const renderEventItem = (event) => (
    <List.Item
      key={event.id}
      actions={[
        <Button 
          type="link" 
          size="small" 
          icon={<EditOutlined />}
          onClick={() => console.log('Edit event:', event)}
        >
          Edit
        </Button>
      ]}
    >
      <List.Item.Meta
        avatar={
          <div style={{ 
            width: 40, 
            height: 40, 
            borderRadius: '50%', 
            backgroundColor: getEventTypeColor(event.event_type), 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'white'
          }}>
            {getEventTypeIcon(event.event_type)}
          </div>
        }
        title={
          <Space>
            <Text strong>{event.title}</Text>
            <Tag color={getEventTypeColor(event.event_type)}>
              {event.event_type}
            </Tag>
          </Space>
        }
        description={
          <div>
            {event.description && (
              <div>
                <Text type="secondary">{event.description}</Text>
              </div>
            )}
            {event.start_time && (
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  <ClockCircleOutlined /> {event.start_time} - {event.end_time}
                </Text>
              </div>
            )}
          </div>
        }
      />
    </List.Item>
  );

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

  return (
    <div>
      {/* Class Selector */}
      {showClassSelector && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row align="middle" justify="space-between">
            <Col>
              <Space>
                <Text strong>Class:</Text>
                <Select
                  value={selectedClass}
                  onChange={setSelectedClass}
                  placeholder="Select class"
                  style={{ minWidth: 200 }}
                  options={classes.map(cls => ({
                    label: `Grade ${cls.grade}${cls.section ? `-${cls.section}` : ''}`,
                    value: cls.id
                  }))}
                />
              </Space>
            </Col>
            <Col>
              <Space>
                <DatePicker
                  value={selectedDate}
                  onChange={onDateSelect}
                  format="DD-MM-YYYY"
                  style={{ minWidth: 160 }}
                  placeholder="Select Date"
                  showToday
                  allowClear={false}
                />
                <Button 
                  onClick={() => onDateSelect && onDateSelect(dayjs())}
                  size="small"
                  type="primary"
                >
                  Today
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      {/* Day Data Display */}
      {loading ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">Loading day data...</Text>
            </div>
          </div>
        </Card>
      ) : dayData ? (
        <Card
          title={
            <Space>
              <CalendarOutlined />
              <span>{selectedDate.format('MMMM DD, YYYY')}</span>
              {dayData.hasData && <Tag color="green">Has Activities</Tag>}
            </Space>
          }
          extra={
            <Button 
              type="primary" 
              icon={<CalendarOutlined />}
              onClick={() => handleDateClick(selectedDate)}
            >
              View Full Details
            </Button>
          }
        >
          {!dayData.hasData ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No activities scheduled for this date"
            />
          ) : (
            <Tabs 
              defaultActiveKey="timetable"
              items={[
                {
                  key: 'timetable',
                  label: (
                    <Space>
                      <ClockCircleOutlined />
                      Timetable ({dayData.timetable.length})
                    </Space>
                  ),
                  children: dayData.timetable.length > 0 ? (
                    <List
                      dataSource={dayData.timetable}
                      renderItem={renderTimetableItem}
                    />
                  ) : (
                    <Empty description="No timetable for this date" />
                  )
                },
                {
                  key: 'tests',
                  label: (
                    <Space>
                      <TrophyOutlined />
                      Tests ({dayData.tests.length})
                    </Space>
                  ),
                  children: dayData.tests.length > 0 ? (
                    <List
                      dataSource={dayData.tests}
                      renderItem={renderTestItem}
                    />
                  ) : (
                    <Empty description="No tests scheduled for this date" />
                  )
                },
                {
                  key: 'events',
                  label: (
                    <Space>
                      <CalendarOutlined />
                      Events ({dayData.events.length})
                    </Space>
                  ),
                  children: dayData.events.length > 0 ? (
                    <List
                      dataSource={dayData.events}
                      renderItem={renderEventItem}
                    />
                  ) : (
                    <Empty description="No events scheduled for this date" />
                  )
                }
              ]}
            />
          )}
        </Card>
      ) : (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Select a date to view activities"
          />
        </Card>
      )}

      {/* Full Details Modal */}
      <Modal
        title={
          <Space>
            <CalendarOutlined />
            <span>Full Day Details - {selectedDateData?.format('MMMM DD, YYYY')}</span>
          </Space>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setModalVisible(false)}>
            Close
          </Button>
        ]}
      >
        {selectedDateData && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Statistic
                  title="Timetable Periods"
                  value={dayData?.timetable.length || 0}
                  prefix={<ClockCircleOutlined />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Tests"
                  value={dayData?.tests.length || 0}
                  prefix={<TrophyOutlined />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Events"
                  value={dayData?.events.length || 0}
                  prefix={<CalendarOutlined />}
                />
              </Col>
            </Row>
            
            <Tabs 
              defaultActiveKey="all"
              items={[
                {
                  key: 'all',
                  label: 'All Activities',
                  children: (
                    <List
                      dataSource={[
                        ...(dayData?.timetable || []).map(item => ({ ...item, type: 'timetable' })),
                        ...(dayData?.tests || []).map(item => ({ ...item, type: 'test' })),
                        ...(dayData?.events || []).map(item => ({ ...item, type: 'event' }))
                      ].sort((a, b) => {
                        if (a.start_time && b.start_time) {
                          return a.start_time.localeCompare(b.start_time);
                        }
                        return 0;
                      })}
                      renderItem={(item) => {
                        if (item.type === 'timetable') {
                          return renderTimetableItem(item);
                        } else if (item.type === 'test') {
                          return renderTestItem(item);
                        } else {
                          return renderEventItem(item);
                        }
                      }}
                    />
                  )
                }
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default IntegratedCalendar;
