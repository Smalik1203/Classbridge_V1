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
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../AuthProvider';
import { getUserRole, getSchoolCode } from '../utils/metadata';
import { 
  AttendanceKPICard, 
  AttendanceChart, 
  AttendanceTable, 
  EmptyState
} from '../ui';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const AttendanceAnalyticsEnhanced = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
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
  const [students, setStudents] = useState([]);

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
        console.error('Error fetching user:', e);
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
    } catch (e) {
      console.error('Error loading class instances:', e);
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

      // Process attendance data
      const processedData = processAttendanceData(studentsData, attendanceRecords);
      setAttendanceData(processedData);
      setStudents(studentsData || []);

    } catch (e) {
      console.error('Error loading attendance data:', e);
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
    if (!attendanceData.length) {
      return {
        totalStudents: 0,
        averageAttendanceRate: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        excellentCount: 0,
        goodCount: 0,
        warningCount: 0,
        criticalCount: 0
      };
    }

    const totalStudents = attendanceData.length;
    const averageAttendanceRate = attendanceData.reduce((sum, student) => sum + student.attendance_rate, 0) / totalStudents;
    const presentCount = attendanceData.reduce((sum, student) => sum + student.present_days, 0);
    const absentCount = attendanceData.reduce((sum, student) => sum + student.absent_days, 0);
    const lateCount = attendanceData.reduce((sum, student) => sum + student.late_days, 0);
    
    const excellentCount = attendanceData.filter(s => s.status === 'excellent').length;
    const goodCount = attendanceData.filter(s => s.status === 'good').length;
    const warningCount = attendanceData.filter(s => s.status === 'warning').length;
    const criticalCount = attendanceData.filter(s => s.status === 'critical').length;

    return {
      totalStudents,
      averageAttendanceRate,
      presentCount,
      absentCount,
      lateCount,
      excellentCount,
      goodCount,
      warningCount,
      criticalCount
    };
  }, [attendanceData]);

  // Chart data for visualizations
  const chartData = useMemo(() => {
    if (!attendanceData.length) return [];

    // Attendance type distribution (Present/Absent/Late)
    const attendanceTypeData = [
      { name: 'Present', value: analytics.presentCount, color: '#10b981' },
      { name: 'Absent', value: analytics.absentCount, color: '#ef4444' },
      { name: 'Late', value: analytics.lateCount, color: '#f59e0b' }
    ];

    // Daily attendance breakdown
    const dailyData = [
      { name: 'Present', value: analytics.presentCount, color: '#10b981' },
      { name: 'Absent', value: analytics.absentCount, color: '#ef4444' },
      { name: 'Late', value: analytics.lateCount, color: '#f59e0b' }
    ];

    return { attendanceTypeData, dailyData };
  }, [attendanceData, analytics]);

  // Export data
  const handleExport = () => {
    if (!attendanceData.length) {
      message.warning('No data to export');
      return;
    }

    const csvContent = [
      ['Student Name', 'Class', 'Present Days', 'Absent Days', 'Late Days', 'Attendance Rate (%)', 'Status'],
      ...attendanceData.map(student => [
        student.full_name,
        student.class_name,
        student.present_days,
        student.absent_days,
        student.late_days,
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

      {/* Filters */}
      <Card style={{ marginBottom: 24, borderRadius: 12 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Select Class</Text>
              <Select
                placeholder="Choose a class"
                value={selectedClassId}
                onChange={setSelectedClassId}
                style={{ width: '100%' }}
                size="large"
              >
                {classInstances.map(ci => (
                  <Option key={ci.id} value={ci.id}>
                    {ci.grade}-{ci.section}
                  </Option>
                ))}
              </Select>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Date Range</Text>
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                style={{ width: '100%' }}
                size="large"
                suffixIcon={<CalendarOutlined />}
              />
            </Space>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Actions</Text>
              <Button 
                type="primary" 
                onClick={loadAttendanceData}
                loading={dataLoading}
                size="large"
                style={{ width: '100%' }}
              >
                Refresh Data
              </Button>
            </Space>
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

      {/* Analytics Content */}
      {selectedClassId && (
        <>
          {/* KPI Cards - Even layout */}
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} md={6}>
              <AttendanceKPICard
                title="Total Students"
                value={analytics.totalStudents}
                prefix={<TeamOutlined />}
                attendanceType="total"
                status="info"
                loading={dataLoading}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <AttendanceKPICard
                title="Average Attendance"
                value={Math.round(analytics.averageAttendanceRate)}
                suffix="%"
                prefix={<CheckCircleOutlined />}
                attendanceType="present"
                status={analytics.averageAttendanceRate >= 80 ? 'success' : 
                       analytics.averageAttendanceRate >= 60 ? 'warning' : 'error'}
                loading={dataLoading}
                trend={
                  analytics.averageAttendanceRate >= 80 ? 
                    <><RiseOutlined style={{ color: '#10b981' }} /> Excellent</> :
                    analytics.averageAttendanceRate >= 60 ?
                    <><RiseOutlined style={{ color: '#f59e0b' }} /> Good</> :
                    <><FallOutlined style={{ color: '#ef4444' }} /> Needs Attention</>
                }
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <AttendanceKPICard
                title="Present Days"
                value={analytics.presentCount}
                prefix={<CheckCircleOutlined />}
                attendanceType="present"
                status="success"
                loading={dataLoading}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <AttendanceKPICard
                title="Absent Days"
                value={analytics.absentCount}
                prefix={<CloseCircleOutlined />}
                attendanceType="absent"
                status="error"
                loading={dataLoading}
              />
            </Col>
          </Row>

          {/* Charts Row */}
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24} lg={12}>
              <AttendanceChart
                title="Attendance Distribution"
                type="pie"
                data={chartData.attendanceTypeData}
              />
            </Col>
            <Col xs={24} lg={12}>
              <AttendanceChart
                title="Attendance Breakdown"
                type="bar"
                data={chartData.dailyData}
              />
            </Col>
          </Row>

          {/* Student Table */}
          <Card style={{ borderRadius: 6, border: '1px solid #e5e7eb' }} bodyStyle={{ padding: '16px' }}>
            <div style={{ marginBottom: 12 }}>
              <Title level={5} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: '14px' }}>
                <TeamOutlined style={{ fontSize: '14px' }} />
                Student Details
              </Title>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Individual attendance performance
              </Text>
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
