import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Button, Typography, Space, Row, Col, Statistic, 
  Alert, Spin, Progress, message
} from 'antd';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, Area, AreaChart, PieChart, Pie, Cell
} from 'recharts';
import { 
  CalendarOutlined, TeamOutlined, CheckCircleOutlined, 
  CloseCircleOutlined, ClockCircleOutlined, RiseOutlined,
  BankOutlined, UserOutlined, ExclamationCircleOutlined,
  ArrowRightOutlined, DownloadOutlined, LineChartOutlined
} from '@ant-design/icons';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../AuthProvider';
import { getAttendanceChartColors } from '../../utils/attendanceColors';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const SuperAdminAnalytics = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [schoolCode, setSchoolCode] = useState('');
  const [attendanceData, setAttendanceData] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [schools, setSchools] = useState([]);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');

  // Get school code from user
  useEffect(() => {
    if (user) {
      setSchoolCode(user.user_metadata?.school_code || '');
    }
  }, [user]);

  // Fetch data when school code changes
  useEffect(() => {
    if (schoolCode) {
      fetchData();
    }
  }, [schoolCode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch attendance data
      const { data: attendanceResult, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('school_code', schoolCode)
        .gte('date', dayjs().subtract(30, 'day').format('YYYY-MM-DD'))
        .lte('date', dayjs().format('YYYY-MM-DD'))
        .order('date', { ascending: true });

      if (attendanceError) throw attendanceError;
      setAttendanceData(attendanceResult || []);

      // Fetch students
      const { data: studentsResult, error: studentsError } = await supabase
        .from('student')
        .select('*')
        .eq('school_code', schoolCode);

      if (studentsError) throw studentsError;
      setStudents(studentsResult || []);

      // Fetch classes
      const { data: classesResult, error: classesError } = await supabase
        .from('class_instances')
        .select('*')
        .eq('school_code', schoolCode);

      if (classesError) throw classesError;
      setClasses(classesResult || []);

      // Set empty arrays for non-existent tables
      setSections([]);
      setSchools([]);

    } catch (error) {
      console.error('Error fetching data:', error);
      setAlert({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const STATUS_COLORS = getAttendanceChartColors();

  // Calculate analytics data
  const analyticsData = useMemo(() => {
    if (!attendanceData.length) return {};

    const totalStudents = students.length;
    const totalClasses = classes.length;
    const totalSections = 0; // sections table doesn't exist

    // Calculate today's attendance
    const today = dayjs().format('YYYY-MM-DD');
    const todayData = attendanceData.filter(record => record.date === today);
    const todayPresent = todayData.filter(record => record.status === 'present').length;
    const todayAbsent = todayData.filter(record => record.status === 'absent').length;
    const todayLate = todayData.filter(record => record.status === 'late').length;
    const todayTotal = todayData.length;
    const todayAttendanceRate = todayTotal > 0 ? Math.round((todayPresent / todayTotal) * 100) : 0;

    // Calculate weekly trend with better data structure
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
      const dayData = attendanceData.filter(record => record.date === date);
      const present = dayData.filter(record => record.status === 'present').length;
      const absent = dayData.filter(record => record.status === 'absent').length;
      const late = dayData.filter(record => record.status === 'late').length;
      const total = dayData.length;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      weeklyData.push({
        date: dayjs().subtract(i, 'day').format('MMM DD'),
        fullDate: date,
        attendance: rate,
        present,
        absent,
        late,
        total
      });
    }

    // Calculate status distribution with better colors
    const statusDistribution = [
      { name: 'Present', value: todayPresent, color: '#10B981', fill: '#10B981' },
      { name: 'Late', value: todayLate, color: '#F59E0B', fill: '#F59E0B' },
      { name: 'Absent', value: todayAbsent, color: '#EF4444', fill: '#EF4444' }
    ];

    // Calculate class-wise performance with better structure
    const classPerformance = classes.map(cls => {
      const classData = todayData.filter(record => record.class_instance_id === cls.id);
      const present = classData.filter(record => record.status === 'present').length;
      const absent = classData.filter(record => record.status === 'absent').length;
      const late = classData.filter(record => record.status === 'late').length;
      const total = classData.length;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      return {
        name: `Grade ${cls.grade ?? ''}${cls.section ? '-' + cls.section : ''}`,
        attendance: rate,
        present,
        absent,
        late,
        total,
        students: total
      };
    });

    return {
      totalStudents,
      totalClasses,
      totalSections,
      todayAttendanceRate,
      todayPresent,
      todayAbsent,
      todayLate,
      todayTotal,
      weeklyData,
      statusDistribution,
      classPerformance
    };
  }, [attendanceData, students, classes, sections]);

  const handleExport = () => {
    message.info('Export functionality coming soon');
  };

  const navigateToPage = (page) => {
    navigate(`/analytics/${page}`);
  };

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
      <Card style={{ marginBottom: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <Title level={2} style={{ margin: 0, color: '#1f2937' }}>School Analytics Dashboard</Title>
            <Text type="secondary" style={{ fontSize: '16px' }}>
              Comprehensive overview of school attendance and performance metrics
            </Text>
          </div>
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

      <Spin spinning={loading}>
        {/* Key Metrics Cards with better styling */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
              <Statistic
                title={<span style={{ color: '#6b7280', fontSize: '14px' }}>Total Students</span>}
                value={analyticsData.totalStudents || 0}
                prefix={<TeamOutlined style={{ color: '#3b82f6' }} />}
                valueStyle={{ color: '#1f2937', fontSize: '28px', fontWeight: 'bold' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
              <Statistic
                title={<span style={{ color: '#6b7280', fontSize: '14px' }}>Total Classes</span>}
                value={analyticsData.totalClasses || 0}
                prefix={<BankOutlined style={{ color: '#10b981' }} />}
                valueStyle={{ color: '#1f2937', fontSize: '28px', fontWeight: 'bold' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
              <Statistic
                title={<span style={{ color: '#6b7280', fontSize: '14px' }}>Today's Attendance</span>}
                value={analyticsData.todayAttendanceRate || 0}
                suffix="%"
                prefix={<CheckCircleOutlined style={{ color: '#10b981' }} />}
                valueStyle={{ color: '#1f2937', fontSize: '28px', fontWeight: 'bold' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
              <Statistic
                title={<span style={{ color: '#6b7280', fontSize: '14px' }}>Absent Today</span>}
                value={analyticsData.todayAbsent || 0}
                prefix={<CloseCircleOutlined style={{ color: '#ef4444' }} />}
                valueStyle={{ color: '#1f2937', fontSize: '28px', fontWeight: 'bold' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Detailed Analytics Navigation with better UX */}
        <Card style={{ marginBottom: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
          <Title level={4} style={{ color: '#1f2937', marginBottom: '20px' }}>Detailed Analytics</Title>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card 
                hoverable 
                onClick={() => navigateToPage('daily-trends')}
                style={{ 
                  textAlign: 'center', 
                  cursor: 'pointer', 
                  borderRadius: '12px',
                  border: '2px solid #e5e7eb',
                  transition: 'all 0.3s ease'
                }}
                bodyStyle={{ padding: '24px' }}
              >
                <CalendarOutlined style={{ fontSize: '40px', color: '#3b82f6', marginBottom: '12px' }} />
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>Daily Trends</div>
                <Text type="secondary" style={{ fontSize: '14px' }}>View attendance patterns over time</Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card 
                hoverable 
                onClick={() => navigateToPage('student-performance')}
                style={{ 
                  textAlign: 'center', 
                  cursor: 'pointer', 
                  borderRadius: '12px',
                  border: '2px solid #e5e7eb',
                  transition: 'all 0.3s ease'
                }}
                bodyStyle={{ padding: '24px' }}
              >
                <UserOutlined style={{ fontSize: '40px', color: '#10b981', marginBottom: '12px' }} />
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>Student Performance</div>
                <Text type="secondary" style={{ fontSize: '14px' }}>Individual student analytics</Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card 
                hoverable 
                onClick={() => navigateToPage('class-comparison')}
                style={{ 
                  textAlign: 'center', 
                  cursor: 'pointer', 
                  borderRadius: '12px',
                  border: '2px solid #e5e7eb',
                  transition: 'all 0.3s ease'
                }}
                bodyStyle={{ padding: '24px' }}
              >
                <BankOutlined style={{ fontSize: '40px', color: '#8b5cf6', marginBottom: '12px' }} />
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>Class Comparison</div>
                <Text type="secondary" style={{ fontSize: '14px' }}>Compare class performance</Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card 
                hoverable 
                onClick={() => navigateToPage('status-distribution')}
                style={{ 
                  textAlign: 'center', 
                  cursor: 'pointer', 
                  borderRadius: '12px',
                  border: '2px solid #e5e7eb',
                  transition: 'all 0.3s ease'
                }}
                bodyStyle={{ padding: '24px' }}
              >
                <ExclamationCircleOutlined style={{ fontSize: '40px', color: '#f59e0b', marginBottom: '12px' }} />
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>Status Distribution</div>
                <Text type="secondary" style={{ fontSize: '14px' }}>Attendance status breakdown</Text>
              </Card>
            </Col>
          </Row>
        </Card>

        {/* Improved Charts Row */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} lg={12}>
            <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                <LineChartOutlined style={{ fontSize: '20px', color: '#3b82f6', marginRight: '8px' }} />
                <Title level={5} style={{ margin: 0, color: '#1f2937' }}>Weekly Attendance Trend</Title>
              </div>
              <div style={{ height: 300 }}>
                <ResponsiveContainer>
                  <AreaChart data={analyticsData.weeklyData || []}>
                    <defs>
                      <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis 
                      domain={[0, 100]}
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="attendance" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      fill="url(#attendanceGradient)"
                      dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                <CheckCircleOutlined style={{ fontSize: '20px', color: '#10b981', marginRight: '8px' }} />
                <Title level={5} style={{ margin: 0, color: '#1f2937' }}>Today's Status Distribution</Title>
              </div>
              <div style={{ height: 300 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={analyticsData.statusDistribution || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name} ${percentage}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {(analyticsData.statusDistribution || []).map((entry, index) => (
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
        </Row>

        {/* Improved Class Performance Cards */}
        <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <BankOutlined style={{ fontSize: '20px', color: '#8b5cf6', marginRight: '8px' }} />
            <Title level={5} style={{ margin: 0, color: '#1f2937' }}>Class Performance Today</Title>
          </div>
          <Row gutter={[16, 16]}>
            {(analyticsData.classPerformance || []).map((cls, index) => (
              <Col xs={24} sm={12} md={8} lg={6} key={index}>
                <Card 
                  size="small" 
                  style={{ 
                    borderRadius: '12px', 
                    border: '2px solid #e5e7eb',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <Statistic
                    title={<span style={{ color: '#6b7280', fontSize: '14px' }}>{cls.name}</span>}
                    value={cls.attendance}
                    suffix="%"
                    valueStyle={{ 
                      color: cls.attendance >= 90 ? '#10b981' : 
                             cls.attendance >= 75 ? '#f59e0b' : '#ef4444',
                      fontSize: '24px',
                      fontWeight: 'bold'
                    }}
                  />
                  <Progress 
                    percent={cls.attendance} 
                    size="small" 
                    strokeColor={
                      cls.attendance >= 90 ? '#10b981' : 
                      cls.attendance >= 75 ? '#f59e0b' : '#ef4444'
                    }
                    showInfo={false}
                    style={{ marginTop: '8px' }}
                  />
                  <Text type="secondary" style={{ fontSize: '12px' }}>{cls.students} students</Text>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      </Spin>
    </div>
  );
};

export default SuperAdminAnalytics;
