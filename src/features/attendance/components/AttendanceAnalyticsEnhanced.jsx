// src/components/AttendanceAnalyticsEnhanced.jsx
// Modern, clean attendance analytics component with enhanced UI/UX

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Select, DatePicker, Button, Typography, Space, Row, Col, 
  Alert, Spin, message, Tag
} from 'antd';
import { 
  TeamOutlined, CheckCircleOutlined, CloseCircleOutlined, 
  ClockCircleOutlined, DownloadOutlined, 
  RiseOutlined, FallOutlined, CalendarOutlined
} from '@ant-design/icons';
import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/AuthProvider';
import { WorkingDaysService } from '@/features/calendar/services/workingDaysService';
import { getUserRole, getSchoolCode } from '@/shared/utils/metadata';
import { 
  AttendanceKPICard, 
  AttendanceChart, 
  AttendanceTable, 
  EmptyState
} from '@/shared/ui/index';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const AttendanceAnalyticsEnhanced = () => {
  const { user } = useAuth();
  const [dataLoading, setDataLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  
  // Data state
  const [me, setMe] = useState(null);
  const [classInstances, setClassInstances] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, 'days'),
    dayjs()
  ]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [workingDaysData, setWorkingDaysData] = useState(null);

  // Fetch user data and classes
  useEffect(() => {
    const fetchUser = async () => {
      try {
        if (!user) return;
        
        const role = getUserRole(user) || "";
        const school_code = getSchoolCode(user) || null;
        setMe({ id: user.id, role, school_code });

        if (!school_code) {
          setAlert({ type: 'error', message: 'No school code found for user' });
          return;
        }

        // Load class instances
        await loadClassInstances(school_code);
      } catch (e) {
        setAlert({ type: 'error', message: e.message || 'Failed to load user data' });
      }
    };

    fetchUser();
  }, [user]);

  // Load class instances
  const loadClassInstances = async (schoolCode) => {
    try {
      const { data, error } = await supabase
        .from('class_instances')
        .select('id, grade, section, school_code')
        .eq('school_code', schoolCode)
        .order('grade', { ascending: true })
        .order('section', { ascending: true });

      if (error) throw error;
      setClassInstances(data || []);
    } catch {
      setAlert({ type: 'error', message: 'Failed to load classes' });
    }
  };

  // Load attendance data
  const loadAttendanceData = async () => {
    if (!selectedClassId || !me.school_code) return;
    
    setDataLoading(true);
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      // Load students for the selected class
      const { data: studentsData, error: studentsError } = await supabase
        .from('student')
        .select('id, full_name, student_code')
        .eq('class_instance_id', selectedClassId);

      if (studentsError) throw studentsError;

      // Load attendance records
      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance')
        .select('student_id, date, status')
        .eq('class_instance_id', selectedClassId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (attendanceError) throw attendanceError;

      // Calculate working days and holidays
      const workingDaysResult = await WorkingDaysService.calculateWorkingDaysAndHolidays(
        me.school_code, 
        startDate, 
        endDate, 
        selectedClassId
      );
      setWorkingDaysData(workingDaysResult);

      // Process attendance data
      const processedData = processAttendanceData(studentsData, attendanceRecords);
      setAttendanceData(processedData);

    } catch {
      setAlert({ type: 'error', message: 'Failed to load attendance data' });
    } finally {
      setDataLoading(false);
    }
  };

  // Process attendance data for analytics
  const processAttendanceData = (students, records) => {
    const studentAttendanceMap = {};
    
    // Initialize student data
    students.forEach(student => {
      studentAttendanceMap[student.id] = {
        ...student,
        present_days: 0,
        absent_days: 0,
        late_days: 0,
        total_days: 0,
        attendance_rate: 0
      };
    });

    // Count attendance by status
    records.forEach(record => {
      const studentId = record.student_id;
      if (studentAttendanceMap[studentId]) {
        studentAttendanceMap[studentId].total_days++;
        
        switch (record.status) {
          case 'present':
            studentAttendanceMap[studentId].present_days++;
            break;
          case 'absent':
            studentAttendanceMap[studentId].absent_days++;
            break;
          case 'late':
            studentAttendanceMap[studentId].late_days++;
            break;
        }
      }
    });

    // Calculate attendance rates and status
    return Object.values(studentAttendanceMap).map(student => {
      const attendanceRate = student.total_days > 0 
        ? (student.present_days / student.total_days) * 100 
        : 0;
      
      let status = 'good';
      if (attendanceRate >= 90) status = 'excellent';
      else if (attendanceRate >= 75) status = 'good';
      else if (attendanceRate >= 60) status = 'warning';
      else status = 'critical';

      return {
        ...student,
        attendance_rate: attendanceRate,
        status,
        class_name: `${classInstances.find(ci => ci.id === selectedClassId)?.grade || ''}-${classInstances.find(ci => ci.id === selectedClassId)?.section || ''}`
      };
    });
  };

  // Load data when class or date range changes
  useEffect(() => {
    if (selectedClassId && dateRange) {
      loadAttendanceData();
    }
  }, [selectedClassId, dateRange]);

  // Calculate analytics metrics
  const analytics = useMemo(() => {
    if (!attendanceData.length || !workingDaysData) {
      return {
        totalStudents: 0,
        averageAttendanceRate: 0,
        workingDays: 0,
        holidays: 0,
        presentCount: 0,
        absentCount: 0,
        excellentCount: 0,
        goodCount: 0,
        warningCount: 0,
        criticalCount: 0
      };
    }

    const totalStudents = attendanceData.length;
    const averageAttendanceRate = attendanceData.reduce((sum, student) => sum + student.attendance_rate, 0) / totalStudents;
    
    // Use actual working days and holidays from calendar
    const workingDays = workingDaysData.workingDays;
    const holidays = workingDaysData.holidays;
    
    // Calculate attendance metrics on working days only
    const presentCount = attendanceData.reduce((sum, student) => sum + student.present_days, 0);
    const absentCount = attendanceData.reduce((sum, student) => sum + student.absent_days, 0);
    
    const excellentCount = attendanceData.filter(s => s.status === 'excellent').length;
    const goodCount = attendanceData.filter(s => s.status === 'good').length;
    const warningCount = attendanceData.filter(s => s.status === 'warning').length;
    const criticalCount = attendanceData.filter(s => s.status === 'critical').length;

    return {
      totalStudents,
      averageAttendanceRate,
      workingDays,
      holidays,
      presentCount,
      absentCount,
      excellentCount,
      goodCount,
      warningCount,
      criticalCount
    };
  }, [attendanceData, workingDaysData]);

  // Chart data for visualizations
  const chartData = useMemo(() => {
    if (!attendanceData.length) return [];

    // Working days vs holidays distribution (from calendar)
    const workingDaysTypeData = [
      { name: 'working', value: analytics.workingDays, color: '#10b981' },
      { name: 'holidays', value: analytics.holidays, color: '#ef4444' }
    ];

    // Daily attendance breakdown for bar chart
    const dailyData = [
      { 
        name: 'Attendance Status',
        present: analytics.presentCount,
        absent: analytics.absentCount
      }
    ];

    return { workingDaysTypeData, dailyData };
  }, [attendanceData, analytics]);

  // Export data
  const handleExport = () => {
    if (!attendanceData.length) {
      message.warning('No data to export');
      return;
    }

    const csvContent = [
      ['Student Name', 'Class', 'Working Days', 'Holidays', 'Attendance Rate (%)', 'Status'],
      ...attendanceData.map(student => [
        student.full_name,
        student.class_name,
        student.present_days,
        student.absent_days,
        Math.round(student.attendance_rate),
        student.status
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-analytics-${dayjs().format('YYYY-MM-DD')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    message.success('Data exported successfully');
  };

  return (
    <div style={{ padding: '16px', background: '#fafafa', minHeight: '100vh' }}>
      {/* Header */}
      <Card 
        style={{ 
          marginBottom: 16, 
          borderRadius: 6,
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          boxShadow: 'none'
        }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: '18px' }}>
              <TeamOutlined style={{ color: '#10b981', fontSize: '16px' }} />
              Attendance Analytics
            </Title>
            <Text style={{ color: '#6b7280', fontSize: '12px' }}>
              Track and analyze student attendance
            </Text>
          </div>
          <Space>
            <Button 
              type="primary" 
              icon={<DownloadOutlined />} 
              onClick={handleExport}
              style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)' }}
            >
              Export Data
            </Button>
          </Space>
        </div>
      </Card>

      {/* Filter Bar */}
      <Card 
        style={{ 
          marginBottom: 24, 
          borderRadius: 8,
          background: '#fafafa',
          border: '1px solid #e5e7eb',
          boxShadow: 'none'
        }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={10} md={8}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 6 }}>
                Class
              </Text>
              <Select
                placeholder="Choose class..."
                value={selectedClassId}
                onChange={setSelectedClassId}
                style={{ width: '100%' }}
                size="middle"
              >
                {classInstances.map(ci => (
                  <Option key={ci.id} value={ci.id}>
                    {ci.grade}-{ci.section}
                  </Option>
                ))}
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={10} md={12}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 6 }}>
                Date Range
              </Text>
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                style={{ width: '100%' }}
                size="middle"
                format="DD/MM/YYYY"
                suffixIcon={<CalendarOutlined />}
                disabledDate={(current) => current && current > dayjs().endOf('day')}
                maxDate={dayjs()}
                placeholder={['Start date', 'End date']}
              />
            </div>
          </Col>
          <Col xs={24} sm={4} md={4} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
            <Button 
              onClick={loadAttendanceData}
              loading={dataLoading}
              disabled={!selectedClassId || !dateRange}
              size="middle"
              style={{ 
                marginTop: 18,
                minWidth: 100
              }}
            >
              Refresh
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Alert */}
      {alert && (
        <Alert
          message={alert.message}
          type={alert.type}
          closable
          onClose={() => setAlert(null)}
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Empty State */}
      {!selectedClassId && (
        <Card style={{ textAlign: 'center', padding: '60px 20px' }}>
          <EmptyState
            title="Select a Class to View Analytics"
            description="Choose a class from the dropdown above to see detailed attendance analytics and student performance information."
          />
        </Card>
      )}

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

      {/* Analytics Content */}
      {selectedClassId && (
        <>
          {/* KPI Cards - Professional Design */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={12} sm={6}>
              <Card 
                style={{ 
                  borderRadius: 12, 
                  border: 'none', 
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)'
                }}
                bodyStyle={{ padding: '20px', textAlign: 'center' }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  marginBottom: 12 
                }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: '#e0f2fe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <TeamOutlined style={{ color: '#0369a1', fontSize: 18 }} />
                  </div>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937', marginBottom: 4 }}>
                  {analytics.totalStudents}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                  Total Students
                </div>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card 
                style={{ 
                  borderRadius: 12, 
                  border: 'none', 
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  background: analytics.averageAttendanceRate >= 80 ? 
                    'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)' :
                    analytics.averageAttendanceRate >= 60 ?
                    'linear-gradient(135deg, #fffbeb 0%, #ffffff 100%)' :
                    'linear-gradient(135deg, #fef2f2 0%, #ffffff 100%)'
                }}
                bodyStyle={{ padding: '20px', textAlign: 'center' }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  marginBottom: 12 
                }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: analytics.averageAttendanceRate >= 80 ? '#dcfce7' :
                               analytics.averageAttendanceRate >= 60 ? '#fef3c7' : '#fee2e2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <RiseOutlined style={{ 
                      color: analytics.averageAttendanceRate >= 80 ? '#16a34a' :
                             analytics.averageAttendanceRate >= 60 ? '#d97706' : '#dc2626', 
                      fontSize: 18 
                    }} />
                  </div>
                </div>
                <div style={{ 
                  fontSize: '28px', 
                  fontWeight: 'bold', 
                  color: analytics.averageAttendanceRate >= 80 ? '#16a34a' :
                         analytics.averageAttendanceRate >= 60 ? '#d97706' : '#dc2626', 
                  marginBottom: 4 
                }}>
                  {Math.round(analytics.averageAttendanceRate)}%
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                  Average Attendance
                </div>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card 
                style={{ 
                  borderRadius: 12, 
                  border: 'none', 
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)'
                }}
                bodyStyle={{ padding: '20px', textAlign: 'center' }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  marginBottom: 12 
                }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 18 }} />
                  </div>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#16a34a', marginBottom: 4 }}>
                  {analytics.workingDays}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                  Total Working Days
                </div>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card 
                style={{ 
                  borderRadius: 12, 
                  border: 'none', 
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  background: 'linear-gradient(135deg, #fef2f2 0%, #ffffff 100%)'
                }}
                bodyStyle={{ padding: '20px', textAlign: 'center' }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  marginBottom: 12 
                }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: '#fee2e2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <CloseCircleOutlined style={{ color: '#dc2626', fontSize: 18 }} />
                  </div>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#dc2626', marginBottom: 4 }}>
                  {analytics.holidays}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                  Total Holidays
                </div>
              </Card>
            </Col>
          </Row>

          {/* Analytics Charts */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={12}>
              <Card 
                style={{ 
                  borderRadius: 12, 
                  border: 'none', 
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  background: '#ffffff'
                }}
                bodyStyle={{ padding: '20px' }}
              >
                <div style={{ marginBottom: 16 }}>
                  <Title level={4} style={{ margin: 0, color: '#1f2937', fontSize: '18px' }}>
                    Attendance Distribution
                  </Title>
                  <div style={{ fontSize: '14px', color: '#6b7280', marginTop: 4 }}>
                    Working Days vs Holidays Distribution
                  </div>
                </div>
                <div style={{ height: '300px' }}>
                  <AttendanceChart
                    type="pie"
                    data={chartData.workingDaysTypeData}
                  />
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card 
                style={{ 
                  borderRadius: 12, 
                  border: 'none', 
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  background: '#ffffff'
                }}
                bodyStyle={{ padding: '20px' }}
              >
                <div style={{ marginBottom: 16 }}>
                  <Title level={4} style={{ margin: 0, color: '#1f2937', fontSize: '18px' }}>
                    Performance Overview
                  </Title>
                  <div style={{ fontSize: '14px', color: '#6b7280', marginTop: 4 }}>
                    Key attendance metrics
                  </div>
                </div>
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div style={{ 
                    fontSize: '48px', 
                    fontWeight: 'bold', 
                    color: analytics.averageAttendanceRate >= 80 ? '#16a34a' :
                           analytics.averageAttendanceRate >= 60 ? '#d97706' : '#dc2626', 
                    marginBottom: '8px' 
                  }}>
                    {analytics.totalStudents > 0 ? Math.round(analytics.averageAttendanceRate) : 0}%
                  </div>
                  <div style={{ fontSize: '16px', color: '#6b7280', marginBottom: '4px' }}>
                    Average Attendance Rate
                  </div>
                  <div style={{ fontSize: '14px', color: '#9ca3af' }}>
                    Across {analytics.totalStudents} students
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          {/* Student Details Table */}
          <Card 
            style={{ 
              borderRadius: 12, 
              border: 'none', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              background: '#ffffff'
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Title level={4} style={{ margin: 0, color: '#1f2937', fontSize: '18px' }}>
                  Student Details
                </Title>
                <Button 
                  type="primary" 
                  icon={<DownloadOutlined />}
                  onClick={handleExport}
                  style={{ 
                    borderRadius: 8,
                    background: '#3b82f6',
                    border: 'none',
                    boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
                  }}
                >
                  Export Data
                </Button>
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                Individual attendance performance and status overview
              </div>
            </div>
            
            <AttendanceTable
              data={attendanceData}
              loading={dataLoading}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `${range[0]}-${range[1]} of ${total} students`
              }}
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default AttendanceAnalyticsEnhanced;
