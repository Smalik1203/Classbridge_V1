import React, { useState, useEffect } from 'react';
import { Card, Tabs, Button, Space, message, Typography, Tag, Modal, Form, Input, Select, DatePicker, TimePicker, Switch, ColorPicker } from 'antd';
import { CalendarOutlined, PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/en-in';

// Set Indian locale
dayjs.locale('en-in');
import { supabase } from '@/config/supabaseClient';
import { getSchoolCode, getUserRole } from '@/shared/utils/metadata';
import { useAuth } from '@/AuthProvider';
import { useTheme } from '@/contexts/ThemeContext';
import CalendarMonthView from '../components/CalendarMonthView';
import CalendarEventForm from '../components/CalendarEventForm';
import CalendarEventList from '../components/CalendarEventList';
import IntegratedCalendar from '../components/IntegratedCalendar';
import { getDayData, getClassesForSchool } from '../services/calendarIntegrationService';

const { Title, Text } = Typography;
const { Option } = Select;
const { confirm } = Modal;

export default function Calendar() {
  const [msg, ctx] = message.useMessage();
  const { user, userMetadata, loading: authLoading } = useAuth();
  const { isDarkMode, theme } = useTheme();
  
  // State management
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(null);
  const [classes, setClasses] = useState([]);
  
  // Filter states
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [showIntegratedView, setShowIntegratedView] = useState(false);
  const [selectedDateForDetails, setSelectedDateForDetails] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // User context
  const [me, setMe] = useState(null);

  // Initialize user context and fetch data
  useEffect(() => {
    if (user && userMetadata) {
      initializeUser();
    }
  }, [user, userMetadata]);

  // Fetch events when date, academic year, or filters change
  useEffect(() => {
    if (me?.school_code) {
      fetchEvents();
    }
  }, [currentDate, selectedAcademicYear, selectedClass, selectedMonth, me]);

  // Listen for calendar refresh events
  useEffect(() => {
    const handleCalendarRefresh = () => {
      refreshCalendar();
    };

    window.addEventListener('calendarRefresh', handleCalendarRefresh);
    
    return () => {
      window.removeEventListener('calendarRefresh', handleCalendarRefresh);
    };
  }, []);

  const initializeUser = async () => {
    try {
      if (!user) throw new Error('Not signed in');
      
      const role = getUserRole(user);
      const school_code = getSchoolCode(user);
      
      if (!school_code) {
        throw new Error('No school context found for your account');
      }
      
      setMe({
        id: user.id,
        role,
        school_code,
      });
      
      await fetchAcademicYears(school_code);
      await fetchClasses(school_code);
    } catch (error) {
      msg.error('Failed to initialize calendar. Please contact your administrator.');
    }
  };

  const fetchAcademicYears = async (schoolCode) => {
    try {
      const { data, error } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_code', schoolCode)
        .order('year_start', { ascending: false });
      
      if (error) throw error;
      
      setAcademicYears(data || []);
      // Set the active academic year as default
      const activeYear = data?.find(year => year.is_active) || data?.[0];
      if (activeYear) {
        setSelectedAcademicYear(activeYear.id);
      }
    } catch (error) {
    }
  };

  const fetchClasses = async (schoolCode) => {
    try {
      const { data, error } = await supabase
        .from('class_instances')
        .select('id, grade, section')
        .eq('school_code', schoolCode)
        .order('grade', { ascending: true })
        .order('section', { ascending: true });
      
      if (error) throw error;
      
      setClasses(data || []);
    } catch (error) {
    }
  };

  const fetchEvents = async () => {
    if (!me?.school_code) return;
    
    setLoading(true);
    try {
      // Use selected month or fallback to current month
      const monthToUse = selectedMonth || currentDate;
      const startDate = monthToUse.startOf('month').format('YYYY-MM-DD');
      const endDate = monthToUse.endOf('month').format('YYYY-MM-DD');
      
      let query = supabase
        .from('school_calendar_events')
        .select('*')
        .eq('school_code', me.school_code)
        .eq('is_active', true)
        .gte('start_date', startDate)
        .lte('start_date', endDate);
      
      // Add class filter if selected
      if (selectedClass) {
        query = query.or(`class_instance_id.eq.${selectedClass},class_instance_id.is.null`);
      }
      
      const { data, error } = await query.order('start_date', { ascending: true });
      
      if (error) throw error;
      
      setEvents(data || []);
    } catch (error) {
      msg.error('Failed to fetch calendar events');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = (eventData) => {
    setSelectedEvent(null);
    setIsEventModalOpen(true);
  };

  const handleCreateHoliday = () => {
    setSelectedEvent(null);
    setIsHolidayModalOpen(true);
  };

  const handleEditEvent = (event) => {
    setSelectedEvent(event);
    if (event.event_type === 'holiday') {
      setIsHolidayModalOpen(true);
    } else {
      setIsEventModalOpen(true);
    }
  };

  const handleDeleteEvent = (event) => {
    confirm({
      title: 'Delete Event',
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to delete "${event.title}"?`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('school_calendar_events')
            .delete()
            .eq('id', event.id);
          
          if (error) throw error;
          
          msg.success('Event deleted successfully');
          fetchEvents();
        } catch (error) {
          msg.error('Failed to delete event');
        }
      },
    });
  };

  const handleEventSaved = () => {
    setIsEventModalOpen(false);
    setIsHolidayModalOpen(false);
    setSelectedEvent(null);
    fetchEvents();
    // Trigger calendar refresh
    setRefreshKey(prev => prev + 1);
  };

  const refreshCalendar = () => {
    setRefreshKey(prev => prev + 1);
    fetchEvents();
  };

  const handleQuickAddEvent = (date) => {
    setSelectedEvent({
      start_date: date.format('YYYY-MM-DD'),
      end_date: date.format('YYYY-MM-DD'),
      is_all_day: true
    });
    setIsEventModalOpen(true);
  };

  const handleQuickAddHoliday = (date) => {
    setSelectedEvent({
      start_date: date.format('YYYY-MM-DD'),
      end_date: date.format('YYYY-MM-DD'),
      is_all_day: true,
      event_type: 'holiday'
    });
    setIsHolidayModalOpen(true);
  };

  const handleDateChange = (date) => {
    setCurrentDate(date);
  };

  const handleNavigateToTimetable = (date, classInstanceId) => {
    // Navigate to timetable page with specific date and class
    const params = new URLSearchParams({
      date: date.format('YYYY-MM-DD'),
      class: classInstanceId
    });
    window.location.href = `/timetable?${params.toString()}`;
  };

  const handleNavigateToTest = (test) => {
    // Navigate to test taking page or test management
    if (test.test_mode === 'online') {
      window.location.href = `/test-taking/${test.id}`;
    } else {
      window.location.href = `/test-management`;
    }
  };

  const handleDateClick = (date) => {
    setSelectedDateForDetails(date);
    setShowIntegratedView(true);
  };

  const handleAcademicYearChange = (yearId) => {
    setSelectedAcademicYear(yearId);
  };

  const getEventTypeColor = (eventType) => {
    // Default colors for common event types
    const colors = {
      holiday: '#0369a1',
      assembly: '#1890ff',
      exam: '#faad14',
      ptm: '#52c41a',
      'sports day': '#722ed1',
      'cultural event': '#eb2f96'
    };
    return colors[eventType?.toLowerCase()] || '#8c8c8c';
  };

  const getEventTypeLabel = (eventType) => {
    return eventType || 'Event';
  };

  return (
    <div style={{ 
      padding: '24px',
      background: isDarkMode ? theme.token.colorBgLayout : '#fafafa',
      minHeight: '100vh'
    }}>
      {ctx}
      
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#8c8c8c' }}>
              <span>Home</span>
              <span>/</span>
              <span>Calendar</span>
            </div>
          </div>
        </div>
      </div>

      {/* Unified Calendar Interface */}
      <Card>
        {/* Unified Toolbar */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '16px 0',
          borderBottom: '1px solid #f0f0f0',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Left Side - Filters */}
          <Space wrap size="middle">
            {academicYears.length > 0 && (
              <div>
                <Text strong style={{ marginRight: '8px' }}>Academic Year:</Text>
                <Select
                  value={selectedAcademicYear}
                  onChange={handleAcademicYearChange}
                  style={{ minWidth: '180px' }}
                  size="middle"
                >
                  {academicYears.map(year => (
                    <Option key={year.id} value={year.id}>
                      {year.year_start} - {year.year_end}
                      {year.is_active && ' (Active)'}
                    </Option>
                  ))}
                </Select>
              </div>
            )}
            
            <div>
              <Text strong style={{ marginRight: '8px' }}>Class:</Text>
              <Select
                value={selectedClass}
                onChange={setSelectedClass}
                placeholder="All Classes"
                allowClear
                style={{ minWidth: '160px' }}
                size="middle"
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                }
              >
                {classes.map(cls => (
                  <Option key={cls.id} value={cls.id}>
                    {`Grade ${cls.grade}${cls.section ? `-${cls.section}` : ''}`}
                  </Option>
                ))}
              </Select>
            </div>
            
            <div>
              <Text strong style={{ marginRight: '8px' }}>Month:</Text>
              <Space>
                <Button 
                  onClick={() => setSelectedMonth(selectedMonth.subtract(1, 'month'))}
                  size="small"
                  icon={<LeftOutlined />}
                />
                <DatePicker
                  value={selectedMonth}
                  onChange={setSelectedMonth}
                  picker="month"
                  style={{ minWidth: '120px' }}
                  placeholder="Select Month"
                  format="MMM-YY"
                  size="middle"
                  locale={{
                    lang: {
                      locale: 'en-in',
                      monthFormat: 'MMM-YY',
                      yearFormat: 'YYYY',
                      dateFormat: 'DD-MM-YYYY',
                      dateTimeFormat: 'DD-MM-YYYY HH:mm:ss',
                      monthBeforeYear: true,
                    }
                  }}
                />
                <Button 
                  onClick={() => setSelectedMonth(selectedMonth.add(1, 'month'))}
                  size="small"
                  icon={<RightOutlined />}
                />
                <Button 
                  onClick={() => setSelectedMonth(dayjs())}
                  size="small"
                  type="primary"
                >
                  Today
                </Button>
              </Space>
            </div>
            
            <div>
              <Text strong style={{ marginRight: '8px' }}>Date:</Text>
              <DatePicker
                value={currentDate}
                onChange={handleDateChange}
                format="DD-MM-YYYY"
                style={{ minWidth: '140px' }}
                placeholder="Select Date"
                size="middle"
                showToday
                allowClear={false}
              />
            </div>
          </Space>

          {/* Right Side - Actions */}
          <Space>
            <Button 
              onClick={() => {
                setSelectedClass(null);
                setSelectedMonth(dayjs());
              }}
              size="middle"
            >
              Clear Filters
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreateEvent}
              size="middle"
            >
              Add Event
            </Button>
            <Button
              icon={<CalendarOutlined />}
              onClick={handleCreateHoliday}
              size="middle"
            >
              Add Holiday
            </Button>
          </Space>
        </div>

        {/* Calendar Header with Tabs */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '16px'
        }}>
          <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
            {selectedMonth.format('MMMM YYYY')}
          </Title>
        </div>
        <Tabs 
          defaultActiveKey="month"
          items={[
            {
              key: 'month',
              label: 'Month View',
              children: (
                <CalendarMonthView
                  currentDate={selectedMonth}
                  events={events}
                  loading={loading}
                  onDateChange={handleDateChange}
                  onEventClick={handleEditEvent}
                  onEventDelete={handleDeleteEvent}
                  onQuickAddEvent={handleQuickAddEvent}
                  onQuickAddHoliday={handleQuickAddHoliday}
                  onDateClick={handleDateClick}
                  getEventTypeColor={getEventTypeColor}
                  getEventTypeLabel={getEventTypeLabel}
                />
              )
            },
            {
              key: 'integrated',
              label: 'Integrated View',
              children: (
                <IntegratedCalendar
                  selectedDate={currentDate}
                  onDateSelect={handleDateChange}
                  onNavigateToTimetable={handleNavigateToTimetable}
                  onNavigateToTest={handleNavigateToTest}
                  showClassSelector={true}
                  refreshKey={refreshKey}
                />
              )
            },
            {
              key: 'list',
              label: 'Event List',
              children: (
                <CalendarEventList
                  events={events}
                  loading={loading}
                  onEventEdit={handleEditEvent}
                  onEventDelete={handleDeleteEvent}
                  getEventTypeColor={getEventTypeColor}
                  getEventTypeLabel={getEventTypeLabel}
                />
              )
            }
          ]}
        />
      </Card>

      {/* Event Modal */}
      <CalendarEventForm
        open={isEventModalOpen}
        event={selectedEvent}
        academicYearId={selectedAcademicYear}
        schoolCode={me?.school_code}
        classes={classes}
        user={user}
        onCancel={() => {
          setIsEventModalOpen(false);
          setSelectedEvent(null);
        }}
        onSuccess={handleEventSaved}
      />

      {/* Holiday Modal */}
      <CalendarEventForm
        open={isHolidayModalOpen}
        event={selectedEvent}
        academicYearId={selectedAcademicYear}
        schoolCode={me?.school_code}
        classes={classes}
        user={user}
        isHoliday={true}
        onCancel={() => {
          setIsHolidayModalOpen(false);
          setSelectedEvent(null);
        }}
        onSuccess={handleEventSaved}
      />
    </div>
  );
}
