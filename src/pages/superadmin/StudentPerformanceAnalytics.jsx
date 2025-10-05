import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Button, Typography, Space, Row, Col, Statistic, 
  Alert, Spin, Progress, message, DatePicker, Select, Table
} from 'antd';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { 
  CalendarOutlined, TeamOutlined, CheckCircleOutlined, 
  CloseCircleOutlined, ClockCircleOutlined, RiseOutlined,
  BankOutlined, UserOutlined, ExclamationCircleOutlined,
  ArrowLeftOutlined, DownloadOutlined, TrophyOutlined
} from '@ant-design/icons';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../AuthProvider';
import { getSchoolCode } from '../../utils/metadata';
import { getAttendanceChartColors } from '../../utils/attendanceColors';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const StudentPerformanceAnalytics = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [schoolCode, setSchoolCode] = useState('');
  const [attendanceData, setAttendanceData] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'day'), dayjs()]);

  // Get school code from user
  useEffect(() => {
    if (user) {
      // Use comprehensive metadata extraction
      setSchoolCode(getSchoolCode(user) || '');
    }
  }, [user]);

  // Fetch data when school code changes
  useEffect(() => {
    if (schoolCode) {
      fetchData();
    }
  }, [schoolCode, selectedClass, dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [startDate, endDate] = dateRange;
      
      // Fetch students
      let studentQuery = supabase
        .from('student')
        .select('*')
        .eq('school_code', schoolCode);

      if (selectedClass) {
        studentQuery = studentQuery.eq('class_instance_id', selectedClass);
      }

      const { data: studentsResult, error: studentsError } = await studentQuery;
      if (studentsError) throw studentsError;
      setStudents(studentsResult || []);

      // Fetch attendance data
      let attendanceQuery = supabase
        .from('attendance')
        .select('*')
        .eq('school_code', schoolCode)
        .gte('date', startDate.format('YYYY-MM-DD'))
        .lte('date', endDate.format('YYYY-MM-DD'))
        .order('date', { ascending: true });

      if (selectedClass) {
        attendanceQuery = attendanceQuery.eq('class_instance_id', selectedClass);
      }

      const { data: attendanceResult, error: attendanceError } = await attendanceQuery;
      if (attendanceError) throw attendanceError;
      setAttendanceData(attendanceResult || []);

      // Fetch classes
      const { data: classesResult, error: classesError } = await supabase
        .from('class_instances')
        .select('*')
        .eq('school_code', schoolCode);

      if (classesError) throw classesError;
      setClasses(classesResult || []);

    } catch (error) {
      setAlert({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const STATUS_COLORS = getAttendanceChartColors();

  // Calculate analytics data
  const analyticsData = useMemo(() => {
    if (!attendanceData.length || !students.length) return {};

    // Student performance data with better structure
    const studentPerformance = students.map(student => {
      const studentRecords = attendanceData.filter(r => r.student_id === student.id);
      const total = studentRecords.length;
      const present = studentRecords.filter(r => r.status === 'present').length;
      const absent = studentRecords.filter(r => r.status === 'absent').length;
      const late = studentRecords.filter(r => r.status === 'late').length;
      const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

      // Calculate streak
      let currentStreak = 0;
      for (let i = studentRecords.length - 1; i >= 0; i--) {
        if (studentRecords[i].status === 'present' || studentRecords[i].status === 'late') {
          currentStreak++;
        } else {
          break;
        }
      }

      return {
        id: student.id,
        name: student.full_name,
        code: student.student_code,
        class: student.class_instance_id,
        total,
        present,
        absent,
        late,
        rate,
        currentStreak,
        status: rate >= 90 ? 'excellent' : rate >= 75 ? 'good' : rate >= 60 ? 'fair' : 'poor'
      };
    });

    // Sort by attendance rate (descending)
    studentPerformance.sort((a, b) => b.rate - a.rate);

    // Performance distribution with better colors
    const performanceDistribution = [
      { name: 'Excellent (90%+)', value: studentPerformance.filter(s => s.rate >= 90).length, color: '#10b981', fill: '#10b981' },
      { name: 'Good (75-89%)', value: studentPerformance.filter(s => s.rate >= 75 && s.rate < 90).length, color: '#3b82f6', fill: '#3b82f6' },
      { name: 'Fair (60-74%)', value: studentPerformance.filter(s => s.rate >= 60 && s.rate < 75).length, color: '#f59e0b', fill: '#f59e0b' },
      { name: 'Poor (&lt;60%)', value: studentPerformance.filter(s => s.rate < 60).length, color: '#ef4444', fill: '#ef4444' }
    ].filter(item => item.value > 0);

    // Top performers
    const topPerformers = studentPerformance.slice(0, 10);

    // Students needing attention
    const needsAttention = studentPerformance.filter(s => s.rate < 75).slice(0, 10);

    // Overall statistics
    const totalStudents = studentPerformance.length;
    const avgAttendanceRate = totalStudents > 0 ? 
      Math.round(studentPerformance.reduce((sum, s) => sum + s.rate, 0) / totalStudents) : 0;
    const excellentCount = studentPerformance.filter(s => s.rate >= 90).length;
    const poorCount = studentPerformance.filter(s => s.rate < 60).length;

    return {
      studentPerformance,
      performanceDistribution,
      topPerformers,
      needsAttention,
      totalStudents,
      avgAttendanceRate,
      excellentCount,
      poorCount
    };
  }, [attendanceData, students]);

  const handleExport = () => {
    message.info('Export functionality coming soon');
  };

  const classOptions = classes.map(cls => ({
    label: `Grade ${cls.grade ?? ''}${cls.section ? '-' + cls.section : ''}`,
    value: cls.id
  }));

  // Table columns for student performance
  const columns = [
    {
      title: 'Student',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500, color: '#1f2937' }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>{record.code}</div>
        </div>
      ),
    },
    {
      title: 'Attendance Rate',
      dataIndex: 'rate',
      key: 'rate',
      render: (rate) => (
        <div>
          <div style={{ fontWeight: 500, color: '#1f2937' }}>{rate}%</div>
          <Progress 
            percent={rate} 
            size="small" 
            strokeColor={
              rate >= 90 ? '#10b981' : 
              rate >= 75 ? '#3b82f6' : 
              rate >= 60 ? '#f59e0b' : '#ef4444'
            }
            showInfo={false}
            style={{ marginTop: '4px' }}
          />
        </div>
      ),
      sorter: (a, b) => a.rate - b.rate,
    },
    {
      title: 'Present',
      dataIndex: 'present',
      key: 'present',
      render: (value) => <Text style={{ color: '#10b981', fontWeight: '500' }}>{value}</Text>,
    },
    {
      title: 'Absent',
      dataIndex: 'absent',
      key: 'absent',
      render: (value) => <Text style={{ color: '#ef4444', fontWeight: '500' }}>{value}</Text>,
    },
    {
      title: 'Late',
      dataIndex: 'late',
      key: 'late',
      render: (value) => <Text style={{ color: '#f59e0b', fontWeight: '500' }}>{value}</Text>,
    },
    {
      title: 'Current Streak',
      dataIndex: 'currentStreak',
      key: 'currentStreak',
      render: (value) => (
        <div style={{ textAlign: 'center' }}>
          <TrophyOutlined style={{ color: '#f59e0b', marginRight: 4 }} />
          <span style={{ fontWeight: '500', color: '#1f2937' }}>{value} days</span>
        </div>
      ),
    },
  ];

  // Custom tooltip for better UX
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #ccc',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold', color: '#333' }}>{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ 
              margin: '4px 0', 
              color: entry.color,
              fontSize: '14px'
            }}>
              {entry.name}: {entry.value}%
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh' }}>
      <Card style={{ marginBottom: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <Space>
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate('/analytics')}
              style={{ borderRadius: '8px' }}
            >
              Back to Analytics
            </Button>
            <div>
              <Title level={2} style={{ margin: 0, color: '#1f2937' }}>Student Performance Analytics</Title>
              <Text type="secondary" style={{ fontSize: '16px' }}>
                Detailed analysis of individual student attendance performance
              </Text>
            </div>
          </Space>
          <Space>
            <Button 
              type="primary"
              icon={<DownloadOutlined />} 
              onClick={handleExport}
              style={{ borderRadius: '8px' }}
            >
              Export Data
            </Button>
          </Space>
        </div>
      </Card>

      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          showIcon
          closable
          onClose={() => setAlert(null)}
          style={{ marginBottom: '24px', borderRadius: '8px' }}
        />
      )}

      {/* Filter Bar */}
      <Card 
        style={{ 
          marginBottom: '24px', 
          borderRadius: '8px',
          background: '#fafafa',
          border: '1px solid #e5e7eb',
          boxShadow: 'none'
        }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={12}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 6 }}>
                Date Range
              </Text>
              <RangePicker 
                value={dateRange}
                onChange={setDateRange}
                style={{ width: '100%' }}
                size="middle"
                disabledDate={(current) => current && current > dayjs().endOf('day')}
                maxDate={dayjs()}
                placeholder={['Start date', 'End date']}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 6 }}>
                Class
              </Text>
              <Select
                placeholder="All classes..."
                value={selectedClass || undefined}
                onChange={setSelectedClass}
                allowClear
                style={{ width: '100%' }}
                size="middle"
                options={classOptions}
              />
            </div>
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading}>
        {/* Key Metrics with better styling */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
              <Statistic
                title={<span style={{ color: '#6b7280', fontSize: '14px' }}>Total Students</span>}
                value={analyticsData.totalStudents || 0}
                prefix={<TeamOutlined style={{ color: '#3b82f6' }} />}
                valueStyle={{ color: '#1f2937', fontSize: '28px', fontWeight: 'bold' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
              <Statistic
                title={<span style={{ color: '#6b7280', fontSize: '14px' }}>Average Attendance</span>}
                value={analyticsData.avgAttendanceRate || 0}
                suffix="%"
                prefix={<CheckCircleOutlined style={{ color: '#10b981' }} />}
                valueStyle={{ color: '#1f2937', fontSize: '28px', fontWeight: 'bold' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
              <Statistic
                title={<span style={{ color: '#6b7280', fontSize: '14px' }}>Excellent Performers</span>}
                value={analyticsData.excellentCount || 0}
                prefix={<TrophyOutlined style={{ color: '#10b981' }} />}
                valueStyle={{ color: '#1f2937', fontSize: '28px', fontWeight: 'bold' }}
              />
              <Text type="secondary" style={{ fontSize: '12px' }}>90%+ attendance</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
              <Statistic
                title={<span style={{ color: '#6b7280', fontSize: '14px' }}>Need Attention</span>}
                value={analyticsData.poorCount || 0}
                prefix={<ExclamationCircleOutlined style={{ color: '#ef4444' }} />}
                valueStyle={{ color: '#1f2937', fontSize: '28px', fontWeight: 'bold' }}
              />
              <Text type="secondary" style={{ fontSize: '12px' }}>&lt;60% attendance</Text>
            </Card>
          </Col>
        </Row>

        {/* Performance Distribution Chart with better styling */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} lg={12}>
            <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                <UserOutlined style={{ fontSize: '20px', color: '#06b6d4', marginRight: '8px' }} />
                <Title level={4} style={{ margin: 0, color: '#1f2937' }}>Performance Distribution</Title>
              </div>
              <div style={{ height: 300 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={analyticsData.performanceDistribution || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {(analyticsData.performanceDistribution || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #ccc',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                <TrophyOutlined style={{ fontSize: '20px', color: '#10b981', marginRight: '8px' }} />
                <Title level={4} style={{ margin: 0, color: '#1f2937' }}>Top Performers</Title>
              </div>
              <div style={{ height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={analyticsData.topPerformers || []} layout="horizontal">
                    <defs>
                      <linearGradient id="topPerformersGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.4}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <Tooltip 
                      formatter={(value) => [`${value}%`, 'Attendance Rate']}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #ccc',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    />
                    <Bar dataKey="rate" fill="url(#topPerformersGradient)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Student Performance Table with better styling */}
        <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <UserOutlined style={{ fontSize: '20px', color: '#3b82f6', marginRight: '8px' }} />
            <Title level={4} style={{ margin: 0, color: '#1f2937' }}>Student Performance Details</Title>
          </div>
          <Table
            columns={columns}
            dataSource={analyticsData.studentPerformance || []}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} students`,
            }}
            scroll={{ x: 800 }}
            style={{ borderRadius: '8px' }}
          />
        </Card>
      </Spin>
    </div>
  );
};

export default StudentPerformanceAnalytics;
