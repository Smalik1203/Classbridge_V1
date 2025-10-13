// src/pages/analytics/AttendanceOverview.jsx
// Overview page with KPIs, donut chart, and 30-day trend

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card, Select, DatePicker, Button, Typography, Space, Row, Col, 
  Alert, Spin, Tag, Statistic
} from 'antd';
import { 
  TeamOutlined, CheckCircleOutlined, CloseCircleOutlined, 
  RiseOutlined, FallOutlined, CalendarOutlined, BarChartOutlined,
  UserOutlined, ArrowRightOutlined
} from '@ant-design/icons';
import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/AuthProvider';
import { WorkingDaysService } from '@/features/calendar/services/workingDaysService';
import { getUserRole, getSchoolCode } from '@/shared/utils/metadata';
import { useTheme } from '@/contexts/ThemeContext';
import AttendanceChart from '@/features/attendance/components/AttendanceChart';
import AnalyticsKPI from '@/features/analytics/components/AnalyticsKPI';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const AttendanceOverview = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { isDarkMode, theme } = useTheme();
  const userRole = getUserRole(user);
  const schoolCode = getSchoolCode(user);

  // URL state management
  const [dateRange, setDateRange] = useState(() => {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    return from && to ? [dayjs(from), dayjs(to)] : [dayjs().subtract(30, 'days'), dayjs()];
  });
  const [selectedClassId, setSelectedClassId] = useState(searchParams.get('class_id') || '');

  // Data state
  const [classes, setClasses] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [workingDaysData, setWorkingDaysData] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (dateRange[0]) params.set('from', dateRange[0].format('YYYY-MM-DD'));
    if (dateRange[1]) params.set('to', dateRange[1].format('YYYY-MM-DD'));
    if (selectedClassId) params.set('class_id', selectedClassId);
    setSearchParams(params);
  }, [dateRange, selectedClassId, setSearchParams]);

  // Load classes based on role
  useEffect(() => {
    const loadClasses = async () => {
      try {
        let query = supabase
          .from('class_instances')
          .select('id, grade, section')
          .eq('school_code', schoolCode)
          .order('grade', { ascending: true })
          .order('section', { ascending: true });

        if (userRole === 'admin') {
          // Admin can only see assigned classes
          query = query.eq('class_teacher_id', user.id);
        }

        const { data, error } = await query;
        if (error) throw error;
        // Transform data to include class_name for compatibility
        const transformedData = (data || []).map(cls => ({
          ...cls,
          class_name: `${cls.grade}-${cls.section}`
        }));
        setClasses(transformedData);
      } catch (error) {
      }
    };

    if (schoolCode) {
      loadClasses();
    }
  }, [userRole, schoolCode, user?.id]);

  // Load attendance data
  useEffect(() => {
    const loadAttendanceData = async () => {
      if (!selectedClassId || !dateRange[0] || !dateRange[1]) return;

      setDataLoading(true);
      try {
        const fromDate = dateRange[0].format('YYYY-MM-DD');
        const toDate = dateRange[1].format('YYYY-MM-DD');

        // Get attendance summary
        const { data: attendance, error: attendanceError } = await supabase
          .from('attendance')
          .select(`
            student_id,
            status,
            student!inner(
              id,
              full_name,
              class_instance_id,
              class_instances!inner(id, grade, section, school_code)
            )
          `)
          .eq('student.class_instances.school_code', schoolCode)
          .eq('student.class_instance_id', selectedClassId)
          .gte('date', fromDate)
          .lte('date', toDate);

        if (attendanceError) throw attendanceError;

        // Process attendance data
        const studentMap = new Map();
        attendance?.forEach(record => {
          const studentId = record.student_id;
          if (!studentMap.has(studentId)) {
            studentMap.set(studentId, {
              id: studentId,
              full_name: record.student.full_name,
              class_name: `${record.student.class_instances.grade}-${record.student.class_instances.section}`,
              present_days: 0,
              absent_days: 0,
              total_days: 0
            });
          }
          
          const student = studentMap.get(studentId);
          student.total_days++;
          if (record.status === 'present') student.present_days++;
          else if (record.status === 'absent') student.absent_days++;
        });

        const processedData = Array.from(studentMap.values()).map(student => ({
          ...student,
          attendance_rate: student.total_days > 0 ? (student.present_days / student.total_days) * 100 : 0
        }));

        setAttendanceData(processedData);

        // Calculate working days and holidays from calendar
        const workingDaysResult = await WorkingDaysService.calculateWorkingDaysAndHolidays(
          schoolCode, 
          fromDate, 
          toDate, 
          selectedClassId
        );
        setWorkingDaysData(workingDaysResult);

        // Load 30-day trend data
        const trendStart = dayjs().subtract(30, 'days');
        const { data: trend, error: trendError } = await supabase
          .from('attendance')
          .select('date, status, student!inner(class_instance_id, class_instances!inner(school_code))')
          .eq('student.class_instances.school_code', schoolCode)
          .eq('student.class_instance_id', selectedClassId)
          .gte('date', trendStart.format('YYYY-MM-DD'))
          .lte('date', dayjs().format('YYYY-MM-DD'));

        if (trendError) throw trendError;

        // Process trend data
        const dailyMap = new Map();
        trend?.forEach(record => {
          const date = record.date;
          if (!dailyMap.has(date)) {
            dailyMap.set(date, { date, present: 0, absent: 0 });
          }
          const dayData = dailyMap.get(date);
          if (record.status === 'present') dayData.present++;
          else if (record.status === 'absent') dayData.absent++;
        });

        const trendData = Array.from(dailyMap.values())
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .map(day => ({
            ...day,
            name: dayjs(day.date).format('DD/MM'), // Format date for x-axis
            total: day.present + day.absent,
            rate: day.total > 0 ? (day.present / day.total) * 100 : 0
          }));

        setTrendData(trendData);

      } catch (error) {
      } finally {
        setDataLoading(false);
      }
    };

    if (selectedClassId && dateRange[0] && dateRange[1]) {
      loadAttendanceData();
    }
  }, [selectedClassId, dateRange, schoolCode]);

  // Calculate analytics
  const analytics = useMemo(() => {
    if (!attendanceData.length || !workingDaysData) {
      return {
        totalStudents: 0,
        averageAttendanceRate: 0,
        workingDays: 0,
        holidays: 0
      };
    }

    const totalStudents = attendanceData.length;
    const averageAttendanceRate = attendanceData.reduce((sum, student) => sum + student.attendance_rate, 0) / totalStudents;
    
    // Use actual working days and holidays from calendar
    const workingDays = workingDaysData.workingDays;
    const holidays = workingDaysData.holidays;

    return {
      totalStudents,
      averageAttendanceRate,
      workingDays,
      holidays
    };
  }, [attendanceData, workingDaysData]);

  // Chart data
  const chartData = useMemo(() => {
    if (!attendanceData.length) return [];

    const workingDaysTypeData = [
      { name: 'working', value: analytics.workingDays, color: '#10b981' },
      { name: 'holidays', value: analytics.holidays, color: '#ef4444' }
    ];

    return { workingDaysTypeData };
  }, [attendanceData, analytics]);

  // Filter handlers
  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
  };

  const handleClassChange = (classId) => {
    setSelectedClassId(classId);
  };


  const handleRefresh = () => {
    // Trigger data reload
    if (selectedClassId && dateRange[0] && dateRange[1]) {
      // Data will reload automatically due to useEffect dependency
    }
  };

  // Navigation handlers
  const navigateToClasses = () => {
    navigate('/analytics/attendance/classes', { 
      state: { 
        from: dateRange[0]?.format('YYYY-MM-DD'),
        to: dateRange[1]?.format('YYYY-MM-DD')
      }
    });
  };

  const navigateToStudents = () => {
    navigate('/analytics/attendance/students', { 
      state: { 
        from: dateRange[0]?.format('YYYY-MM-DD'),
        to: dateRange[1]?.format('YYYY-MM-DD'),
        class_id: selectedClassId
      }
    });
  };

  return (
    <div style={{ 
      padding: '16px', 
      background: isDarkMode ? theme.token.colorBgLayout : '#fafafa', 
      minHeight: '100vh' 
    }}>
      {/* Header */}
        <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ 
              margin: 0, 
              fontSize: 24, 
              fontWeight: 600, 
              color: theme.token.colorTextHeading, 
              marginBottom: 4 
            }}>
              Attendance Analytics
            </h1>
            <Text type="secondary" style={{ 
              fontSize: 14,
              color: theme.token.colorTextSecondary
            }}>
              Track and analyze student attendance
            </Text>
          </div>
          <Space>
            <Button 
              icon={<BarChartOutlined />}
              onClick={navigateToClasses}
              style={{ borderRadius: 8 }}
            >
              Class Comparison
            </Button>
            <Button 
              icon={<UserOutlined />}
              onClick={navigateToStudents}
              style={{ borderRadius: 8 }}
            >
              Student Comparison
            </Button>
          </Space>
        </div>
      </div>

      {/* Filters - Improved Layout */}
      <Card 
        style={{ 
          marginBottom: 24, 
          borderRadius: 12,
          background: '#ffffff',
          border: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
        styles={{ body: { padding: '20px' } }}
      >
        <div style={{ marginBottom: 16 }}>
          <Title level={5} style={{ margin: 0, color: '#1f2937' }}>
            📊 Filter Analytics
          </Title>
          <Text type="secondary" style={{ fontSize: '14px' }}>
            Select date range and class to view attendance data
          </Text>
        </div>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>📅 Date Range</Text>
              <RangePicker
                value={dateRange}
                onChange={handleDateRangeChange}
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                placeholder={['Start Date', 'End Date']}
                size="large"
              />
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>🏫 Class</Text>
              <Select
                value={selectedClassId}
                onChange={handleClassChange}
                style={{ width: '100%' }}
                placeholder="Select Class"
                allowClear
                size="large"
              >
                {classes.map(cls => (
                  <Select.Option key={cls.id} value={cls.id}>
                    {cls.class_name}
                  </Select.Option>
                ))}
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={24} md={8}>
            <div style={{ textAlign: 'right' }}>
              <Button 
                icon={<CalendarOutlined />}
                onClick={handleRefresh}
                loading={dataLoading}
                size="large"
                style={{ 
                  borderRadius: 8,
                  minWidth: '120px',
                  background: '#3b82f6',
                  borderColor: '#3b82f6'
                }}
                type="primary"
              >
                🔄 Refresh
              </Button>
            </div>
          </Col>
        </Row>
      </Card>

      {!selectedClassId ? (
        <Card 
          style={{ 
            borderRadius: 12, 
            border: 'none', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            textAlign: 'center',
            padding: '60px 20px'
          }}
        >
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📊</div>
          <Title level={3} style={{ color: '#6b7280', marginBottom: '8px' }}>
            👆 Please select a class to see analytics
          </Title>
          <Text type="secondary" style={{ fontSize: '16px' }}>
            Choose a class from the dropdown above to view attendance analytics and trends.
          </Text>
        </Card>
      ) : (
        <>
          {/* Loading and Date Range Display */}
          {dataLoading && (
            <Card 
              style={{ 
                marginBottom: 16, 
                borderRadius: 8,
                background: '#f0f9ff',
                border: '1px solid #0ea5e9',
                boxShadow: 'none'
              }}
              bodyStyle={{ padding: '12px 20px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Spin size="small" />
                <Text style={{ color: '#0369a1', fontSize: '14px', fontWeight: '500' }}>
                  Loading attendance data for {dateRange[0]?.format('DD/MM/YYYY')} to {dateRange[1]?.format('DD/MM/YYYY')}...
                </Text>
              </div>
            </Card>
          )}

          {/* Current Date Range Display */}
          {!dataLoading && selectedClassId && dateRange[0] && dateRange[1] && (
            <Card 
              style={{ 
                marginBottom: 16, 
                borderRadius: 8,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                boxShadow: 'none'
              }}
              bodyStyle={{ padding: '12px 20px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarOutlined style={{ color: '#64748b', fontSize: '14px' }} />
                <Text style={{ color: '#475569', fontSize: '14px', fontWeight: '500' }}>
                  Viewing data for: {dateRange[0]?.format('DD/MM/YYYY')} to {dateRange[1]?.format('DD/MM/YYYY')}
                </Text>
                {workingDaysData && (
                  <Text style={{ color: '#64748b', fontSize: '12px' }}>
                    ({workingDaysData.workingDays} working days, {workingDaysData.holidays} holidays)
                  </Text>
                )}
              </div>
            </Card>
          )}

          {/* KPI Cards with Uniform Design */}
          <div className="analytics-kpi-grid" style={{ marginBottom: 24 }}>
            <AnalyticsKPI
              value={analytics.totalStudents}
              label="Total Students"
              icon="👥"
              color="#1f2937"
            />
            <AnalyticsKPI
              value={`${Math.round(analytics.averageAttendanceRate)}%`}
              label="Average Attendance"
              icon="📊"
              color={analytics.averageAttendanceRate >= 80 ? '#16a34a' : analytics.averageAttendanceRate >= 60 ? '#f59e0b' : '#dc2626'}
            />
            <AnalyticsKPI
              value={analytics.workingDays}
              label="Working Days"
              icon="✅"
              color="#10b981"
            />
            <AnalyticsKPI
              value={analytics.holidays}
              label="Holidays"
              icon="❌"
              color="#ef4444"
            />
          </div>

          {/* Charts - Balanced Layout */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={10}>
              <Card 
                style={{ 
                  borderRadius: 12, 
                  border: 'none', 
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  background: '#ffffff'
                }}
                styles={{ body: { padding: '20px' } }}
              >
                <div style={{ marginBottom: 16 }}>
                  <Title level={4} style={{ margin: 0, color: '#1f2937', fontSize: '18px' }}>
                    Attendance Distribution
                  </Title>
                  <div style={{ fontSize: '14px', color: '#6b7280', marginTop: 4 }}>
                    Working Days vs Holidays Distribution
                  </div>
                </div>
                <div style={{ height: '280px' }}>
                  <AttendanceChart
                    type="pie"
                    data={chartData.workingDaysTypeData}
                  />
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={14}>
              <Card 
                style={{ 
                  borderRadius: 12, 
                  border: 'none', 
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  background: '#ffffff'
                }}
                styles={{ body: { padding: '20px' } }}
              >
                <div style={{ marginBottom: 16 }}>
                  <Title level={4} style={{ margin: 0, color: '#1f2937', fontSize: '18px' }}>
                    30-Day Trend
                  </Title>
                  <div style={{ fontSize: '14px', color: '#6b7280', marginTop: 4 }}>
                    Daily attendance over time
                  </div>
                </div>
                <div style={{ height: '280px' }}>
                  <AttendanceChart
                    type="bar"
                    data={trendData}
                    config={{
                      radius: [4, 4, 0, 0]
                    }}
                  />
                </div>
              </Card>
            </Col>
          </Row>

          {/* Quick Actions - Integrated with Metrics */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12}>
              <Card 
                hoverable
                onClick={navigateToClasses}
                style={{ 
                  borderRadius: 12, 
                  border: '1px solid #e5e7eb',
                  background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
                styles={{ body: { padding: '20px', textAlign: 'center' } }}
              >
                <BarChartOutlined style={{ fontSize: 32, color: '#3b82f6', marginBottom: 12 }} />
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>
                  📊 Class Comparison
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>
                  Compare attendance across classes
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card 
                hoverable
                onClick={navigateToStudents}
                style={{ 
                  borderRadius: 12, 
                  border: '1px solid #e5e7eb',
                  background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
                styles={{ body: { padding: '20px', textAlign: 'center' } }}
              >
                <UserOutlined style={{ fontSize: 32, color: '#3b82f6', marginBottom: 12 }} />
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>
                  👤 Student Comparison
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>
                  Analyze individual student performance
                </div>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
};

export default AttendanceOverview;
