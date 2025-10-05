// src/pages/analytics/StudentComparison.jsx
// Student comparison page with histogram and search

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  Card, Select, DatePicker, Button, Typography, Space, Row, Col, 
  Alert, Spin, Tag, Table, Input, Statistic, Tooltip, Progress
} from 'antd';
import { 
  UserOutlined, ArrowLeftOutlined, CalendarOutlined, SearchOutlined,
  RiseOutlined, FallOutlined, TrophyOutlined, StarOutlined, WarningOutlined
} from '@ant-design/icons';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../AuthProvider';
import { getUserRole, getSchoolCode } from '../../utils/metadata';
import AttendanceChart from '../../ui/AttendanceChart';
import GeneralBarChart from '../../ui/GeneralBarChart';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Search } = Input;

const StudentComparison = () => {
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
  const [selectedClassId, setSelectedClassId] = useState(searchParams.get('class_id') || location.state?.class_id || '');
  const [searchText, setSearchText] = useState('');

  // Data state
  const [classes, setClasses] = useState([]);
  const [studentData, setStudentData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
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

  // Load student comparison data
  useEffect(() => {
    const loadStudentData = async () => {
      if (!selectedClassId || !dateRange[0] || !dateRange[1]) return;

      setDataLoading(true);
      try {
        const fromDate = dateRange[0].format('YYYY-MM-DD');
        const toDate = dateRange[1].format('YYYY-MM-DD');

        // Get attendance data for the selected class
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

        // Process attendance data by student
        const studentMap = new Map();
        attendance?.forEach(record => {
          const studentId = record.student_id;
          if (!studentMap.has(studentId)) {
            studentMap.set(studentId, {
              id: studentId,
              full_name: record.student.full_name,
              class_name: `${record.student.class_instances.grade}-${record.student.class_instances.section}`,
              grade: record.student.class_instances.grade,
              section: record.student.class_instances.section,
              present_days: 0,
              absent_days: 0,
              total_days: 0,
              attendance_rate: 0
            });
          }
          
          const student = studentMap.get(studentId);
          student.total_days++;
          if (record.status === 'present') student.present_days++;
          else if (record.status === 'absent') student.absent_days++;
        });

        // Calculate rates and sort
        const processedData = Array.from(studentMap.values())
          .map(student => ({
            ...student,
            attendance_rate: student.total_days > 0 ? (student.present_days / student.total_days) * 100 : 0
          }))
          .sort((a, b) => b.attendance_rate - a.attendance_rate);

        setStudentData(processedData);

      } catch (error) {
      } finally {
        setDataLoading(false);
      }
    };

    if (selectedClassId && dateRange[0] && dateRange[1]) {
      loadStudentData();
    }
  }, [selectedClassId, dateRange, schoolCode]);

  // Filter data based on search
  useEffect(() => {
    if (!searchText) {
      setFilteredData(studentData);
    } else {
      const filtered = studentData.filter(student =>
        student.full_name.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredData(filtered);
    }
  }, [studentData, searchText]);

  // Histogram data
  const histogramData = useMemo(() => {
    const buckets = [
      { range: '90-100%', min: 90, max: 100, count: 0, color: '#16a34a' },
      { range: '80-89%', min: 80, max: 89, count: 0, color: '#22c55e' },
      { range: '70-79%', min: 70, max: 79, count: 0, color: '#84cc16' },
      { range: '60-69%', min: 60, max: 69, count: 0, color: '#eab308' },
      { range: '50-59%', min: 50, max: 59, count: 0, color: '#f59e0b' },
      { range: '0-49%', min: 0, max: 49, count: 0, color: '#ef4444' }
    ];

    studentData.forEach(student => {
      const rate = Math.round(student.attendance_rate);
      const bucket = buckets.find(b => rate >= b.min && rate <= b.max);
      if (bucket) bucket.count++;
    });

    return buckets.map(bucket => ({
      name: bucket.range,
      value: bucket.count,
      color: bucket.color
    }));
  }, [studentData]);

  // Top and bottom performers
  const topPerformers = useMemo(() => studentData.slice(0, 5), [studentData]);
  const bottomPerformers = useMemo(() => studentData.slice(-5).reverse(), [studentData]);

  // Table columns
  const columns = [
    {
      title: 'Rank',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (rank, record) => (
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
      title: 'Student',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (name, record) => (
        <div>
          <div style={{ fontWeight: '600', color: '#1f2937' }}>{name}</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {record.class_name} - Grade {record.grade}
          </div>
        </div>
      )
    },
    {
      title: 'Working Days',
      dataIndex: 'present_days',
      key: 'present_days',
      width: 100,
      render: (count) => (
        <Statistic value={count} valueStyle={{ fontSize: '16px', fontWeight: '600', color: '#16a34a' }} />
      )
    },
    {
      title: 'Holidays',
      dataIndex: 'absent_days',
      key: 'absent_days',
      width: 100,
      render: (count) => (
        <Statistic value={count} valueStyle={{ fontSize: '16px', fontWeight: '600', color: '#dc2626' }} />
      )
    },
    {
      title: 'Attendance %',
      dataIndex: 'attendance_rate',
      key: 'attendance_rate',
      width: 150,
      render: (rate) => (
        <div>
          <Progress 
            percent={Math.round(rate)} 
            size="small"
            strokeColor={rate >= 80 ? '#16a34a' : rate >= 60 ? '#d97706' : '#dc2626'}
            showInfo={false}
          />
          <div style={{ 
            fontSize: '14px', 
            fontWeight: 'bold', 
            color: rate >= 80 ? '#16a34a' : rate >= 60 ? '#d97706' : '#dc2626',
            textAlign: 'center',
            marginTop: 4
          }}>
            {Math.round(rate)}%
          </div>
        </div>
      )
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, record) => {
        const rate = record.attendance_rate;
        if (rate >= 90) {
          return <Tag color="green" icon={<StarOutlined />}>Excellent</Tag>;
        } else if (rate >= 80) {
          return <Tag color="blue" icon={<RiseOutlined />}>Good</Tag>;
        } else if (rate >= 60) {
          return <Tag color="orange" icon={<WarningOutlined />}>Fair</Tag>;
        } else {
          return <Tag color="red" icon={<FallOutlined />}>Poor</Tag>;
        }
      }
    }
  ];

  // Filter handlers
  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
  };

  const handleClassChange = (classId) => {
    setSelectedClassId(classId);
  };


  const handleSearch = (value) => {
    setSearchText(value);
  };

  const handleRefresh = () => {
    // Trigger data reload
    if (selectedClassId && dateRange[0] && dateRange[1]) {
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
              Student Comparison
            </Title>
            <Text type="secondary" style={{ fontSize: '16px' }}>
              Analyze individual student attendance performance
            </Text>
          </div>
          <UserOutlined style={{ fontSize: 32, color: '#3b82f6' }} />
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
          <Col xs={24} sm={6} md={4}>
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
          <Col xs={24} sm={6} md={4}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Class</Text>
              <Select
                value={selectedClassId}
                onChange={handleClassChange}
                style={{ width: '100%' }}
                placeholder="Select Class"
                allowClear
              >
                {classes.map(cls => (
                  <Select.Option key={cls.id} value={cls.id}>
                    {cls.class_name}
                  </Select.Option>
                ))}
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={6} md={4}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Search Student</Text>
              <Search
                placeholder="Search by name"
                onSearch={handleSearch}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </Col>
          <Col xs={24} sm={6} md={4}>
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

      {!selectedClassId ? (
        <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <Alert
            message="Select a Class"
            description="Choose a class from the dropdown above to view student comparison analytics."
            type="info"
            showIcon
          />
        </Card>
      ) : (
        <>
          {/* Summary Stats */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={6}>
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
                  {studentData.length}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                  Total Students
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={6}>
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
                  {studentData.length > 0 ? Math.round(studentData.reduce((sum, s) => sum + s.attendance_rate, 0) / studentData.length) : 0}%
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                  Average Attendance
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={6}>
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
                  {studentData.filter(s => s.attendance_rate >= 80).length}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                  High Performers
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card 
                style={{ 
                  borderRadius: 12, 
                  border: 'none', 
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  background: 'linear-gradient(135deg, #fef2f2 0%, #ffffff 100%)'
                }}
                styles={{ body: { padding: '20px', textAlign: 'center' } }}
              >
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626', marginBottom: 4 }}>
                  {studentData.filter(s => s.attendance_rate < 60).length}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                  Need Attention
                </div>
              </Card>
            </Col>
          </Row>

          {/* Histogram and Performance Lists */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={12}>
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
                    Number of students by attendance range
                  </div>
                </div>
                <div style={{ height: '300px' }}>
                  <GeneralBarChart
                    data={histogramData}
                    dataKey="value"
                    nameKey="name"
                    color="#3b82f6"
                    config={{
                      radius: [4, 4, 0, 0]
                    }}
                  />
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Row gutter={[16, 16]}>
                <Col xs={24}>
                  <Card 
                    style={{ 
                      borderRadius: 12, 
                      border: 'none', 
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      background: '#ffffff'
                    }}
                    styles={{ body: { padding: '16px' } }}
                  >
                    <div style={{ marginBottom: 12 }}>
                      <Title level={5} style={{ margin: 0, color: '#1f2937', fontSize: '16px' }}>
                        Top Performers
                      </Title>
                    </div>
                    {topPerformers.map((student, index) => (
                      <div key={student.id} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        padding: '8px 0',
                        borderBottom: index < topPerformers.length - 1 ? '1px solid #f3f4f6' : 'none'
                      }}>
                        <div>
                          <div style={{ fontWeight: '600', color: '#1f2937' }}>{student.full_name}</div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>{student.class_name}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ 
                            fontSize: '16px', 
                            fontWeight: 'bold', 
                            color: '#16a34a' 
                          }}>
                            {Math.round(student.attendance_rate)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </Card>
                </Col>
                <Col xs={24}>
                  <Card 
                    style={{ 
                      borderRadius: 12, 
                      border: 'none', 
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      background: '#ffffff'
                    }}
                    styles={{ body: { padding: '16px' } }}
                  >
                    <div style={{ marginBottom: 12 }}>
                      <Title level={5} style={{ margin: 0, color: '#1f2937', fontSize: '16px' }}>
                        Need Attention
                      </Title>
                    </div>
                    {bottomPerformers.map((student, index) => (
                      <div key={student.id} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        padding: '8px 0',
                        borderBottom: index < bottomPerformers.length - 1 ? '1px solid #f3f4f6' : 'none'
                      }}>
                        <div>
                          <div style={{ fontWeight: '600', color: '#1f2937' }}>{student.full_name}</div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>{student.class_name}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ 
                            fontSize: '16px', 
                            fontWeight: 'bold', 
                            color: '#dc2626' 
                          }}>
                            {Math.round(student.attendance_rate)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </Card>
                </Col>
              </Row>
            </Col>
          </Row>

          {/* Student Comparison Table */}
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
                Student Performance Table
              </Title>
              <div style={{ fontSize: '14px', color: '#6b7280', marginTop: 4 }}>
                Complete breakdown of individual student performance
              </div>
            </div>
            
            <Table
              columns={columns}
              dataSource={filteredData.map((student, index) => ({ ...student, rank: index + 1 }))}
              loading={dataLoading}
              pagination={{
                pageSize: 15,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `${range[0]}-${range[1]} of ${total} students`
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

export default StudentComparison;
