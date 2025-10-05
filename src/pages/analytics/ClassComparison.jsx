// src/pages/analytics/ClassComparison.jsx
// Class comparison page with ranked bar chart and table

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  Card, Select, DatePicker, Button, Typography, Space, Row, Col, 
  Alert, Spin, Tag, Table, Statistic, Tooltip
} from 'antd';
import { 
  BarChartOutlined, ArrowLeftOutlined, CalendarOutlined,
  RiseOutlined, FallOutlined, TrophyOutlined, LineChartOutlined
} from '@ant-design/icons';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../AuthProvider';
import { getUserRole, getSchoolCode } from '../../utils/metadata';
import AttendanceChart from '../../ui/AttendanceChart';
import GeneralBarChart from '../../ui/GeneralBarChart';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const ClassComparison = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const userRole = getUserRole(user);
  const schoolCode = getSchoolCode(user);

  // URL state management
  const [dateRange, setDateRange] = useState(() => {
    const from = searchParams.get('from') || location.state?.from;
    const to = searchParams.get('to') || location.state?.to;
    return from && to ? [dayjs(from), dayjs(to)] : [dayjs().subtract(30, 'days'), dayjs()];
  });

  // Data state
  const [classData, setClassData] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (dateRange[0]) params.set('from', dateRange[0].format('YYYY-MM-DD'));
    if (dateRange[1]) params.set('to', dateRange[1].format('YYYY-MM-DD'));
    setSearchParams(params);
  }, [dateRange, setSearchParams]);


  // Load class comparison data
  useEffect(() => {
    const loadClassData = async () => {
      if (!dateRange[0] || !dateRange[1] || !schoolCode) return;

      setDataLoading(true);
      try {
        const fromDate = dateRange[0].format('YYYY-MM-DD');
        const toDate = dateRange[1].format('YYYY-MM-DD');

        // Get all classes first
        let classQuery = supabase
          .from('class_instances')
          .select('id, grade, section')
          .eq('school_code', schoolCode)
          .order('grade', { ascending: true })
          .order('section', { ascending: true });

        if (userRole === 'admin') {
          classQuery = classQuery.eq('class_teacher_id', user.id);
        }

        const { data: allClasses, error: classError } = await classQuery;
        if (classError) throw classError;

        if (!allClasses || allClasses.length === 0) {
          setClassData([]);
          return;
        }

        const classIds = allClasses.map(c => c.id);

        // Get attendance data for all classes
        const { data: attendance, error: attendanceError } = await supabase
          .from('attendance')
          .select(`
            student_id,
            status,
            student!inner(
              id,
              class_instance_id,
              class_instances!inner(id, grade, section, school_code)
            )
          `)
          .eq('student.class_instances.school_code', schoolCode)
          .in('student.class_instance_id', classIds)
          .gte('date', fromDate)
          .lte('date', toDate);

        if (attendanceError) throw attendanceError;

        // Process data by class
        const classMap = new Map();
        
        // Initialize classes
        allClasses.forEach(cls => {
          classMap.set(cls.id, {
            id: cls.id,
            class_name: `${cls.grade}-${cls.section}`,
            grade: cls.grade,
            section: cls.section,
            total_students: 0,
            present_days: 0,
            absent_days: 0,
            total_days: 0,
            attendance_rate: 0
          });
        });

        // Count attendance by class
        const studentClassMap = new Map();
        attendance?.forEach(record => {
          const studentId = record.student_id;
          const classId = record.student.class_instance_id;
          
          if (!studentClassMap.has(studentId)) {
            studentClassMap.set(studentId, classId);
            const classData = classMap.get(classId);
            if (classData) classData.total_students++;
          }

          const classData = classMap.get(classId);
          if (classData) {
            classData.total_days++;
            if (record.status === 'present') classData.present_days++;
            else if (record.status === 'absent') classData.absent_days++;
          }
        });

        // Calculate rates and sort
        const processedData = Array.from(classMap.values())
          .map(cls => ({
            ...cls,
            attendance_rate: cls.total_days > 0 ? (cls.present_days / cls.total_days) * 100 : 0,
            present_rate: cls.total_days > 0 ? (cls.present_days / cls.total_days) * 100 : 0,
            absent_rate: cls.total_days > 0 ? (cls.absent_days / cls.total_days) * 100 : 0
          }))
          .sort((a, b) => b.attendance_rate - a.attendance_rate);

        setClassData(processedData);

      } catch (error) {
      } finally {
        setDataLoading(false);
      }
    };

    if (dateRange[0] && dateRange[1] && schoolCode) {
      loadClassData();
    }
  }, [dateRange, schoolCode, userRole, user?.id]);

  // Chart data for bar chart
  const chartData = useMemo(() => {
    return classData.map((cls, index) => ({
      name: cls.class_name,
      value: Math.round(cls.attendance_rate), // Use attendance rate as the main value
      present: Math.round(cls.present_days),
      absent: Math.round(cls.absent_days),
      rank: index + 1,
      students: cls.total_students
    }));
  }, [classData]);

  // Table columns
  const columns = [
    {
      title: 'Rank',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (rank) => (
        <div style={{ textAlign: 'center' }}>
          {rank <= 3 ? (
            <TrophyOutlined style={{ 
              color: rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : '#cd7f32',
              fontSize: 20 
            }} />
          ) : (
            <span style={{ fontWeight: 'bold', color: '#6b7280' }}>#{rank}</span>
          )}
        </div>
      )
    },
    {
      title: 'Class',
      dataIndex: 'class_name',
      key: 'class_name',
      render: (name, record) => (
        <div>
          <div style={{ fontWeight: '600', color: '#1f2937' }}>{name}</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            Grade {record.grade} - Section {record.section}
          </div>
        </div>
      )
    },
    {
      title: 'Students',
      dataIndex: 'total_students',
      key: 'total_students',
      width: 100,
      render: (count) => (
        <Statistic value={count} valueStyle={{ fontSize: '16px', fontWeight: '600' }} />
      )
    },
    {
      title: 'Present %',
      dataIndex: 'present_rate',
      key: 'present_rate',
      width: 120,
      render: (rate) => (
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '16px', 
            fontWeight: 'bold', 
            color: rate >= 80 ? '#16a34a' : rate >= 60 ? '#d97706' : '#dc2626'
          }}>
            {Math.round(rate)}%
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {rate >= 80 ? 'Excellent' : rate >= 60 ? 'Good' : 'Needs Attention'}
          </div>
        </div>
      )
    },
    {
      title: 'Absent %',
      dataIndex: 'absent_rate',
      key: 'absent_rate',
      width: 120,
      render: (rate) => (
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '16px', 
            fontWeight: 'bold', 
            color: rate <= 20 ? '#16a34a' : rate <= 40 ? '#d97706' : '#dc2626'
          }}>
            {Math.round(rate)}%
          </div>
        </div>
      )
    },
    {
      title: 'Trend',
      key: 'trend',
      width: 100,
      render: (_, record) => {
        const rate = record.attendance_rate;
        return (
          <div style={{ textAlign: 'center' }}>
            {rate >= 80 ? (
              <Tooltip title="Excellent Performance">
                <RiseOutlined style={{ color: '#16a34a', fontSize: 18 }} />
              </Tooltip>
            ) : rate >= 60 ? (
              <Tooltip title="Good Performance">
                <LineChartOutlined style={{ color: '#d97706', fontSize: 18 }} />
              </Tooltip>
            ) : (
              <Tooltip title="Needs Attention">
                <FallOutlined style={{ color: '#dc2626', fontSize: 18 }} />
              </Tooltip>
            )}
          </div>
        );
      }
    }
  ];

  // Filter handlers
  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
  };


  const handleRefresh = () => {
    // Trigger data reload
    if (dateRange[0] && dateRange[1]) {
      // Data will reload automatically due to useEffect dependency
    }
  };

  const navigateBack = () => {
    navigate('/analytics/attendance/overview');
  };

  return (
    <div style={{ padding: '16px', background: '#fafafa', minHeight: '100vh' }}>
      {/* Header */}
      <Card 
        style={{ 
          marginBottom: 16, 
          borderRadius: 12,
          background: '#ffffff',
          border: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
        styles={{ body: { padding: '20px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <Button 
                icon={<ArrowLeftOutlined />}
                onClick={navigateBack}
                style={{ borderRadius: 8 }}
              >
                Back to Overview
              </Button>
            </div>
            <Title level={2} style={{ margin: 0, color: '#1f2937' }}>
              Class Comparison
            </Title>
            <Text type="secondary" style={{ fontSize: '16px' }}>
              Compare attendance performance across classes
            </Text>
          </div>
          <BarChartOutlined style={{ fontSize: 32, color: '#3b82f6' }} />
        </div>
      </Card>

      {/* Filters */}
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
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={8} md={6}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Date Range</Text>
              <RangePicker
                value={dateRange}
                onChange={handleDateRangeChange}
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                placeholder={['Start Date', 'End Date']}
              />
            </div>
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Button 
              icon={<CalendarOutlined />}
              onClick={handleRefresh}
              loading={dataLoading}
              style={{ width: '100%', borderRadius: 8 }}
            >
              Refresh
            </Button>
          </Col>
        </Row>
      </Card>

      {!dateRange[0] || !dateRange[1] ? (
        <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <Alert
            message="Select Date Range"
            description="Choose a date range to view class comparison analytics."
            type="info"
            showIcon
          />
        </Card>
      ) : (
        <>
          {/* Summary Stats */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={8}>
              <Card 
                style={{ 
                  borderRadius: 12, 
                  border: 'none', 
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)'
                }}
                styles={{ body: { padding: '20px', textAlign: 'center' } }}
              >
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', marginBottom: 4 }}>
                  {classData.length}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                  Classes Compared
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card 
                style={{ 
                  borderRadius: 12, 
                  border: 'none', 
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)'
                }}
                styles={{ body: { padding: '20px', textAlign: 'center' } }}
              >
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a', marginBottom: 4 }}>
                  {classData.length > 0 ? Math.round(classData.reduce((sum, c) => sum + c.attendance_rate, 0) / classData.length) : 0}%
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                  Average Attendance
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card 
                style={{ 
                  borderRadius: 12, 
                  border: 'none', 
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  background: 'linear-gradient(135deg, #fef3c7 0%, #ffffff 100%)'
                }}
                styles={{ body: { padding: '20px', textAlign: 'center' } }}
              >
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#d97706', marginBottom: 4 }}>
                  {classData.filter(c => c.attendance_rate >= 80).length}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                  High Performing Classes
                </div>
              </Card>
            </Col>
          </Row>

          {/* Bar Chart */}
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
              <Title level={4} style={{ margin: 0, color: '#1f2937', fontSize: '18px' }}>
                Class Performance Ranking
              </Title>
              <div style={{ fontSize: '14px', color: '#6b7280', marginTop: 4 }}>
                Attendance rates ranked from highest to lowest
              </div>
            </div>
            <div style={{ height: '400px' }}>
              <GeneralBarChart
                data={chartData}
                dataKey="value"
                nameKey="name"
                color="#3b82f6"
                config={{
                  radius: [4, 4, 0, 0]
                }}
              />
            </div>
          </Card>

          {/* Class Comparison Table */}
          <Card 
            style={{ 
              borderRadius: 12,
              background: '#ffffff',
              border: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
            styles={{ body: { padding: '20px' } }}
          >
            <div style={{ marginBottom: 16 }}>
              <Title level={4} style={{ margin: 0, color: '#1f2937', fontSize: '18px' }}>
                Detailed Class Comparison
              </Title>
              <div style={{ fontSize: '14px', color: '#6b7280', marginTop: 4 }}>
                Complete breakdown of class performance metrics
              </div>
            </div>
            
            <Table
              columns={columns}
              dataSource={classData}
              loading={dataLoading}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `${range[0]}-${range[1]} of ${total} classes`
              }}
              rowKey="id"
              style={{ borderRadius: 8 }}
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default ClassComparison;
