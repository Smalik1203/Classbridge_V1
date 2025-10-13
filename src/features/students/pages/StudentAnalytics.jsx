import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, DatePicker, Button, Typography, Space, Row, Col, Statistic, 
  Alert, Spin, Skeleton, message, Progress, Tag, Divider, Empty
} from 'antd';
import {
  BarChartOutlined, TrophyOutlined, BookOutlined, 
  CalendarOutlined, DownloadOutlined, ReloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, FireOutlined,
  RiseOutlined, FallOutlined, LineChartOutlined,
  FileTextOutlined, VideoCameraOutlined, StarFilled,
  ArrowUpOutlined, ArrowDownOutlined, MinusOutlined
} from '@ant-design/icons';
import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/AuthProvider';
import { getStudentCode, getSchoolCode } from '@/shared/utils/metadata';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, RadialBarChart, RadialBar
} from 'recharts';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const COLORS = {
  // Attendance theme - Blue/Green
  attendance: {
    primary: '#0ea5e9',
    secondary: '#06b6d4',
    light: '#e0f2fe',
    dark: '#0c4a6e',
    present: '#10b981',
    absent: '#ef4444',
    late: '#f59e0b'
  },
  // Test theme - Orange/Yellow
  test: {
    primary: '#f97316',
    secondary: '#fb923c',
    light: '#fff7ed',
    dark: '#9a3412'
  },
  // Resources theme - Purple
  resources: {
    primary: '#8b5cf6',
    secondary: '#a78bfa',
    light: '#f5f3ff',
    dark: '#5b21b6'
  },
  // Overall/Insights - Gradient purple
  overall: {
    from: '#667eea',
    to: '#764ba2'
  },
  // Status colors
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444'
};

const StudentAnalytics = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  // Student data state
  const [student, setStudent] = useState(null);
  
  // Analytics data
  const [attendanceData, setAttendanceData] = useState([]);
  const [testData, setTestData] = useState([]);
  const [learningData, setLearningData] = useState([]);
  
  // Date range with default last 30 days
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, 'days'),
    dayjs()
  ]);

  // Fetch student data
  useEffect(() => {
    const fetchStudent = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        const studentCode = getStudentCode(user);
        const schoolCode = getSchoolCode(user);
        
        if (!schoolCode) {
          throw new Error('School information not found in your profile. Please contact support.');
        }

        // Try to find student by auth_user_id first (most reliable)
        let { data, error } = await supabase
          .from('student')
          .select('id, full_name, student_code, class_instance_id, school_code')
          .eq('auth_user_id', user.id)
          .eq('school_code', schoolCode)
          .maybeSingle();

        // If not found by auth_user_id, try by student_code or email
        if (!data && !error) {
          let query = supabase
            .from('student')
            .select('id, full_name, student_code, class_instance_id, school_code')
            .eq('school_code', schoolCode);

          if (studentCode) {
            query = query.eq('student_code', studentCode);
          } else if (user.email) {
            query = query.eq('email', user.email);
          }

          const result = await query.maybeSingle();
          data = result.data;
          error = result.error;
        }

        if (error) {
          throw error;
        }
        
        if (!data) {
          throw new Error('No student record found. Please contact your administrator.');
        }
        
        setStudent(data);
        setAlert(null);
      } catch (err) {
        setAlert({ 
          type: 'error', 
          message: err.message || 'Could not fetch student data. Please try again.' 
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStudent();
  }, [user]);

  // Fetch analytics data whenever student or dateRange changes
  useEffect(() => {
    if (student && dateRange && dateRange[0] && dateRange[1]) {
      fetchAllAnalytics();
    }
  }, [student, dateRange]);

  const fetchAllAnalytics = async () => {
    if (!student) return;
    
    setDataLoading(true);
    try {
      await Promise.all([
        fetchAttendanceData(),
        fetchTestData(),
        fetchLearningData()
      ]);
    } catch (err) {
      setAlert({ 
        type: 'error', 
        message: 'Failed to load analytics data. Please try again.' 
      });
    } finally {
      setDataLoading(false);
    }
  };

  // Fetch student's attendance data
  const fetchAttendanceData = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('id, date, status')
        .eq('student_id', student.id)
        .gte('date', dateRange[0].format('YYYY-MM-DD'))
        .lte('date', dateRange[1].format('YYYY-MM-DD'))
        .order('date', { ascending: true });

      if (error) throw error;
      setAttendanceData(data || []);
    } catch (err) {
      throw err;
    }
  };

  // Fetch student's test data
  const fetchTestData = async () => {
    try {
      // Get online test attempts
      const { data: onlineTests, error: onlineError } = await supabase
        .from('test_attempts')
        .select(`
          id,
          earned_points,
          total_points,
          completed_at,
          tests!inner(title, test_date, test_mode)
        `)
        .eq('student_id', student.id)
        .eq('status', 'completed')
        .gte('completed_at', dateRange[0].toISOString())
        .lte('completed_at', dateRange[1].toISOString());

      if (onlineError) throw onlineError;

      // Get offline test marks
      const { data: offlineTests, error: offlineError } = await supabase
        .from('test_marks')
        .select(`
          id,
          marks_obtained,
          max_marks,
          created_at,
          tests!inner(title, test_date, test_mode)
        `)
        .eq('student_id', student.id)
        .gte('created_at', dateRange[0].toISOString())
        .lte('created_at', dateRange[1].toISOString());

      if (offlineError) throw offlineError;

      // Combine and normalize test data
      const allTests = [
        ...(onlineTests || []).map(t => ({
          title: t.tests?.title || 'Online Test',
          score: t.total_points > 0 ? (t.earned_points / t.total_points) * 100 : 0,
          earnedPoints: t.earned_points,
          totalPoints: t.total_points,
          date: t.completed_at,
          type: 'online'
        })),
        ...(offlineTests || []).map(t => ({
          title: t.tests?.title || 'Offline Test',
          score: t.max_marks > 0 ? (t.marks_obtained / t.max_marks) * 100 : 0,
          earnedPoints: t.marks_obtained,
          totalPoints: t.max_marks,
          date: t.created_at,
          type: 'offline'
        }))
      ];

      setTestData(allTests);
    } catch (err) {
      throw err;
    }
  };

  // Fetch student's learning resources accessed
  const fetchLearningData = async () => {
    try {
      // For now, get all available resources in student's class
      const { data, error } = await supabase
        .from('learning_resources')
        .select('id, title, resource_type, created_at')
        .eq('class_instance_id', student.class_instance_id)
        .gte('created_at', dateRange[0].toISOString())
        .lte('created_at', dateRange[1].toISOString());

      if (error) throw error;
      setLearningData(data || []);
    } catch (err) {
      throw err;
    }
  };

  // Calculate analytics with trends
  const analytics = useMemo(() => {
    // Attendance analytics
    const totalDays = attendanceData.length;
    const presentDays = attendanceData.filter(a => a.status === 'present').length;
    const absentDays = attendanceData.filter(a => a.status === 'absent').length;
    const lateDays = attendanceData.filter(a => a.status === 'late').length;
    const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

    // Calculate attendance trend (last 7 days vs previous 7 days)
    const last7Days = attendanceData.slice(-7);
    const prev7Days = attendanceData.slice(-14, -7);
    const last7Rate = last7Days.length > 0 
      ? (last7Days.filter(a => a.status === 'present').length / last7Days.length) * 100 
      : 0;
    const prev7Rate = prev7Days.length > 0 
      ? (prev7Days.filter(a => a.status === 'present').length / prev7Days.length) * 100 
      : 0;
    const attendanceTrend = last7Rate - prev7Rate;

    // Test analytics
    const totalTests = testData.length;
    const averageScore = totalTests > 0 
      ? testData.reduce((sum, test) => sum + test.score, 0) / totalTests 
      : 0;
    const passedTests = testData.filter(t => t.score >= 40).length;
    const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    // Calculate test trend (last 3 tests vs previous 3 tests)
    const last3Tests = testData.slice(-3);
    const prev3Tests = testData.slice(-6, -3);
    const last3Avg = last3Tests.length > 0 
      ? last3Tests.reduce((sum, t) => sum + t.score, 0) / last3Tests.length 
      : 0;
    const prev3Avg = prev3Tests.length > 0 
      ? prev3Tests.reduce((sum, t) => sum + t.score, 0) / prev3Tests.length 
      : 0;
    const testTrend = last3Avg - prev3Avg;

    // Learning analytics
    const totalResources = learningData.length;
    const videoCount = learningData.filter(r => r.resource_type === 'video').length;
    const pdfCount = learningData.filter(r => r.resource_type === 'pdf').length;

    // Count new resources in last 7 days
    const sevenDaysAgo = dayjs().subtract(7, 'days');
    const newResourcesCount = learningData.filter(r => 
      dayjs(r.created_at).isAfter(sevenDaysAgo)
    ).length;

    // Overall performance (weighted average)
    const overallScore = (attendanceRate * 0.4 + averageScore * 0.4 + (totalResources > 0 ? 70 : 0) * 0.2);

    return {
      attendance: {
        total: totalDays,
        present: presentDays,
        absent: absentDays,
        late: lateDays,
        rate: attendanceRate,
        trend: attendanceTrend
      },
      tests: {
        total: totalTests,
        average: averageScore,
        passed: passedTests,
        passRate: passRate,
        trend: testTrend
      },
      learning: {
        total: totalResources,
        videos: videoCount,
        pdfs: pdfCount,
        newThisWeek: newResourcesCount
      },
      overall: overallScore
    };
  }, [attendanceData, testData, learningData]);

  // Attendance chart data
  const attendanceChartData = [
    { name: 'Present', value: analytics.attendance.present, color: COLORS.attendance.present },
    { name: 'Absent', value: analytics.attendance.absent, color: COLORS.attendance.absent },
    { name: 'Late', value: analytics.attendance.late, color: COLORS.attendance.late },
  ].filter(item => item.value > 0);

  // Radial chart data for overall score
  const radialData = [
    {
      name: 'Overall',
      value: analytics.overall,
      fill: `url(#overallGradient)`
    }
  ];

  // Helper to render trend indicator
  const TrendIndicator = ({ value, suffix = '%' }) => {
    if (!value || Math.abs(value) < 0.1) {
      return (
        <Tag color="default" style={{ borderRadius: 6, fontSize: 12 }}>
          <MinusOutlined style={{ fontSize: 10 }} /> No change
        </Tag>
      );
    }
    
    const isPositive = value > 0;
    return (
      <Tag 
        color={isPositive ? 'success' : 'error'} 
        style={{ borderRadius: 6, fontSize: 12, fontWeight: 500 }}
      >
        {isPositive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
        {' '}{Math.abs(value).toFixed(1)}{suffix}
      </Tag>
    );
  };

  const handleRefresh = () => {
    if (student) {
      fetchAllAnalytics();
    }
  };

  const handleExport = () => {
    message.info('Export feature coming soon!');
  };

  if (loading) {
    return (
      <div style={{ padding: 24, background: '#fafafa', minHeight: '100vh' }}>
        <Card style={{ maxWidth: 1400, margin: '0 auto' }}>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '16px 20px', 
      background: '#fafafa', 
      minHeight: '100vh' 
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header - Compact */}
        <div style={{ marginBottom: 20 }}>
          <Space align="center" size={12}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(102, 126, 234, 0.25)'
            }}>
              <BarChartOutlined style={{ fontSize: 20, color: 'white' }} />
            </div>
            <div>
              <Title level={3} style={{ 
                margin: 0, 
                fontSize: '1.125rem',
                fontWeight: 600, 
                color: '#0f172a',
                marginBottom: 2
              }}>
                My Performance Dashboard
          </Title>
              <Text style={{ fontSize: '0.875rem', color: '#64748b' }}>
                {student ? `Welcome back, ${student.full_name.split(' ')[0]}! 👋` : 'Loading...'}
          </Text>
            </div>
          </Space>
        </div>

        {alert && (
          <Alert
            type={alert.type}
            message={alert.message}
            showIcon
            closable
            onClose={() => setAlert(null)}
            style={{ marginBottom: 24, borderRadius: 8 }}
          />
        )}

        {/* Filter Bar - Compact */}
        <Card 
          style={{ 
            marginBottom: 16, 
            borderRadius: 10,
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)'
          }}
          bodyStyle={{ padding: '12px 16px' }}
        >
          <Row gutter={[12, 12]} align="middle">
            <Col xs={24} sm={14} md={16}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Text style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                  <CalendarOutlined style={{ marginRight: 4, fontSize: '0.875rem' }} />
                  Date Range
                </Text>
                <RangePicker
                  value={dateRange}
                  onChange={(dates) => dates && setDateRange(dates)}
                  style={{ width: '100%' }}
                  size="middle"
                  disabledDate={(current) => current && current > dayjs().endOf('day')}
                  maxDate={dayjs()}
                  placeholder={['Start date', 'End date']}
                  format="DD MMM YYYY"
                />
              </Space>
            </Col>
            <Col xs={24} sm={10} md={8} style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button 
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={dataLoading}
                size="middle"
                style={{ 
                  borderRadius: 6,
                  fontSize: '0.875rem'
                }}
              >
                Refresh
              </Button>
              <Button 
                type="primary"
                icon={<DownloadOutlined />} 
                onClick={handleExport}
                disabled={!student}
                size="middle"
                style={{ 
                  borderRadius: 6,
                  fontSize: '0.875rem',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none'
                }}
              >
                Export
              </Button>
            </Col>
          </Row>
        </Card>

        {dataLoading && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" tip="Loading your performance data..." />
          </div>
        )}

        {!dataLoading && student && (
          <>
            {/* TIER 1: Overall Score - Compact Horizontal Layout */}
            <Card
              style={{
                marginBottom: 16,
                borderRadius: 12,
                background: `linear-gradient(135deg, ${COLORS.overall.from} 0%, ${COLORS.overall.to} 100%)`,
                border: 'none',
                boxShadow: '0 2px 8px rgba(102, 126, 234, 0.2)',
                overflow: 'hidden'
              }}
              bodyStyle={{ padding: '20px 24px' }}
            >
              <Row gutter={24} align="middle">
                {/* Left side - Compact Radial Chart */}
                <Col xs={24} sm={8} md={7} style={{ textAlign: 'center' }}>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <ResponsiveContainer width={window.innerWidth < 768 ? 180 : 200} height={window.innerWidth < 768 ? 180 : 200}>
                      <RadialBarChart 
                        innerRadius="70%" 
                        outerRadius="100%" 
                        data={radialData}
                        startAngle={90}
                        endAngle={-270}
                      >
                        <defs>
                          <linearGradient id="overallGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="white" stopOpacity={1} />
                            <stop offset="100%" stopColor="white" stopOpacity={0.7} />
                          </linearGradient>
                        </defs>
                        <RadialBar
                          minAngle={15}
                          background={{ fill: 'rgba(255,255,255,0.15)' }}
                          clockWise={true}
                          dataKey="value"
                          cornerRadius={8}
                        />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    {/* Center text - Compact */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center'
                    }}>
                      <Title level={1} style={{ 
                        color: 'white', 
                        margin: 0, 
                        fontSize: '2.5rem',
                        fontWeight: 700,
                        lineHeight: 1
                      }}>
                        {analytics.overall.toFixed(0)}
                      </Title>
                      <Text style={{ 
                        fontSize: '0.75rem',
                        color: 'white', 
                        opacity: 0.85,
                        fontWeight: 500
                      }}>
                        Overall
                      </Text>
                    </div>
                  </div>
          </Col>

                {/* Right side - Inline Metrics (Horizontal) */}
                <Col xs={24} sm={16} md={17}>
                  <div style={{ marginBottom: 12 }}>
                    <Text style={{ 
                      fontSize: '1rem', 
                      color: 'white', 
                      fontWeight: 600,
                      display: 'block',
                      marginBottom: 4
                    }}>
                      Overall Performance
                    </Text>
                    <Text style={{ fontSize: '0.875rem', color: 'white', opacity: 0.85 }}>
                      {analytics.overall >= 85 ? '🌟 Outstanding!' : 
                       analytics.overall >= 75 ? '🎉 Excellent work!' :
                       analytics.overall >= 60 ? '👍 Good progress!' : 
                       '💪 Keep improving!'}
                    </Text>
                  </div>

                  {/* Inline horizontal metrics */}
                  <Row gutter={[12, 12]}>
                    {/* Attendance */}
          <Col xs={24} md={8}>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: 8,
                        padding: '10px 12px',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                      }}>
                        <Space align="center" size={8}>
                          <CalendarOutlined style={{ fontSize: 16, color: 'white', opacity: 0.9 }} />
                          <div>
                            <Text style={{ color: 'white', fontSize: '0.75rem', opacity: 0.85, display: 'block', lineHeight: 1.2 }}>
                              Attendance
                            </Text>
                            <Text strong style={{ color: 'white', fontSize: '1.125rem', fontWeight: 700 }}>
                              {analytics.attendance.rate.toFixed(1)}%
                            </Text>
                          </div>
                        </Space>
                        {analytics.attendance.trend !== 0 && (
                          <div style={{ marginTop: 4 }}>
                            <TrendIndicator value={analytics.attendance.trend} />
                          </div>
                        )}
                      </div>
          </Col>

                    {/* Test Average */}
          <Col xs={24} md={8}>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: 8,
                        padding: '10px 12px',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                      }}>
                        <Space align="center" size={8}>
                          <TrophyOutlined style={{ fontSize: 16, color: 'white', opacity: 0.9 }} />
                          <div>
                            <Text style={{ color: 'white', fontSize: '0.75rem', opacity: 0.85, display: 'block', lineHeight: 1.2 }}>
                              Test Avg
                            </Text>
                            <Text strong style={{ color: 'white', fontSize: '1.125rem', fontWeight: 700 }}>
                              {analytics.tests.average.toFixed(1)}%
                            </Text>
                          </div>
                        </Space>
                        {analytics.tests.trend !== 0 && (
                          <div style={{ marginTop: 4 }}>
                            <TrendIndicator value={analytics.tests.trend} />
                          </div>
                        )}
                      </div>
          </Col>

                    {/* Resources */}
          <Col xs={24} md={8}>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: 8,
                        padding: '10px 12px',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                      }}>
                        <Space align="center" size={8}>
                          <BookOutlined style={{ fontSize: 16, color: 'white', opacity: 0.9 }} />
                          <div>
                            <Text style={{ color: 'white', fontSize: '0.75rem', opacity: 0.85, display: 'block', lineHeight: 1.2 }}>
                              Resources
                            </Text>
                            <Text strong style={{ color: 'white', fontSize: '1.125rem', fontWeight: 700 }}>
                              {analytics.learning.total}
                            </Text>
                          </div>
                        </Space>
                        {analytics.learning.newThisWeek > 0 && (
                          <Tag color="success" size="small" style={{ marginTop: 4, fontSize: '0.7rem', padding: '0 4px', height: 18 }}>
                            +{analytics.learning.newThisWeek}
                          </Tag>
                        )}
                      </div>
                    </Col>
                  </Row>
                </Col>
              </Row>
            </Card>

            {/* Section Header - Compact */}
            <div style={{ marginBottom: 12, marginTop: 8 }}>
              <Text strong style={{ fontSize: '0.875rem', color: '#475569' }}>
                📊 Performance Breakdown
              </Text>
            </div>

            {/* TIER 2: Compact Detail Cards */}
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              {/* Attendance Card - Compact */}
              <Col xs={24} sm={12} lg={8}>
                <Card
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${COLORS.attendance.light}`,
                    background: '#ffffff',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                    height: '100%'
                  }}
                  bodyStyle={{ padding: 14 }}
                >
                  {/* Card Header - Compact */}
                  <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: `linear-gradient(135deg, ${COLORS.attendance.primary} 0%, ${COLORS.attendance.secondary} 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 8px',
                      boxShadow: `0 2px 8px ${COLORS.attendance.primary}30`
                    }}>
                      <CalendarOutlined style={{ fontSize: 20, color: 'white' }} />
                    </div>
                    <Text strong style={{ fontSize: '0.875rem', fontWeight: 600, color: COLORS.attendance.dark }}>
                      Attendance
                    </Text>
                  </div>

                  <Divider style={{ margin: '10px 0', borderColor: COLORS.attendance.light }} />
                  
                  {/* Stats - Compact */}
                  <Row gutter={8} style={{ marginBottom: 10 }}>
                    <Col span={12}>
                      <div style={{
                        background: '#ecfdf5',
                        borderRadius: 8,
                        padding: '8px',
                        textAlign: 'center',
                        border: '1px solid #d1fae5'
                      }}>
                        <CheckCircleOutlined style={{ fontSize: 14, color: COLORS.attendance.present, marginBottom: 2 }} />
                        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: COLORS.attendance.present, lineHeight: 1 }}>
                          {analytics.attendance.present}
                        </div>
                        <Text style={{ fontSize: '0.7rem', color: '#065f46', fontWeight: 500 }}>Present</Text>
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{
                        background: '#fef2f2',
                        borderRadius: 8,
                        padding: '8px',
                        textAlign: 'center',
                        border: '1px solid #fecaca'
                      }}>
                        <CloseCircleOutlined style={{ fontSize: 14, color: COLORS.attendance.absent, marginBottom: 2 }} />
                        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: COLORS.attendance.absent, lineHeight: 1 }}>
                          {analytics.attendance.absent}
                        </div>
                        <Text style={{ fontSize: '0.7rem', color: '#991b1b', fontWeight: 500 }}>Absent</Text>
                      </div>
          </Col>
        </Row>
                  
                  {/* Attendance Rate - Compact */}
                  <div style={{ 
                    background: COLORS.attendance.light,
                    borderRadius: 8,
                    padding: '10px',
                    marginBottom: 10
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text strong style={{ color: COLORS.attendance.dark, fontSize: '0.75rem' }}>Rate</Text>
                      <Space size={6}>
                        {analytics.attendance.trend !== 0 && (
                          <TrendIndicator value={analytics.attendance.trend} />
                        )}
                        <Text strong style={{ 
                          fontSize: '0.9rem',
                          color: analytics.attendance.rate >= 75 ? COLORS.success : COLORS.warning 
                        }}>
                          {analytics.attendance.rate.toFixed(1)}%
                        </Text>
                      </Space>
                    </div>
                    <Progress 
                      percent={Math.round(analytics.attendance.rate)} 
                      strokeColor={analytics.attendance.rate >= 75 ? COLORS.success : COLORS.warning}
                      showInfo={false}
                      strokeWidth={6}
                    />
                  </div>

                  {/* Pie Chart - Smaller */}
                  {attendanceChartData.length > 0 && (
                    <div style={{ height: 120 }}>
                      <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                            data={attendanceChartData}
                                  cx="50%"
                                  cy="50%"
                            innerRadius={35}
                            outerRadius={55}
                            paddingAngle={2}
                                  dataKey="value"
                                >
                            {attendanceChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                          <Tooltip />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                  )}
                        </Card>
                      </Col>

              {/* Tests Card - Compact */}
              <Col xs={24} sm={12} lg={8}>
                <Card
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${COLORS.test.light}`,
                    background: '#ffffff',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                    height: '100%'
                  }}
                  bodyStyle={{ padding: 14 }}
                >
                  {/* Card Header - Compact */}
                  <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: `linear-gradient(135deg, ${COLORS.test.primary} 0%, ${COLORS.test.secondary} 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 8px',
                      boxShadow: `0 2px 8px ${COLORS.test.primary}30`
                    }}>
                      <TrophyOutlined style={{ fontSize: 20, color: 'white' }} />
                          </div>
                    <Text strong style={{ fontSize: '0.875rem', fontWeight: 600, color: COLORS.test.dark }}>
                      Test Performance
                    </Text>
                  </div>

                  <Divider style={{ margin: '10px 0', borderColor: COLORS.test.light }} />
                  
                  {/* Stats - Compact */}
                  <Row gutter={8} style={{ marginBottom: 10 }}>
                    <Col span={12}>
                      <div style={{
                        background: '#fff7ed',
                        borderRadius: 8,
                        padding: '8px',
                        textAlign: 'center',
                        border: '1px solid #fed7aa'
                      }}>
                        <LineChartOutlined style={{ fontSize: 14, color: COLORS.test.primary, marginBottom: 2 }} />
                        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: COLORS.test.primary, lineHeight: 1 }}>
                          {analytics.tests.total}
                        </div>
                        <Text style={{ fontSize: '0.7rem', color: COLORS.test.dark, fontWeight: 500 }}>Taken</Text>
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{
                        background: '#ecfdf5',
                        borderRadius: 8,
                        padding: '8px',
                        textAlign: 'center',
                        border: '1px solid #bbf7d0'
                      }}>
                        <CheckCircleOutlined style={{ fontSize: 14, color: COLORS.success, marginBottom: 2 }} />
                        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: COLORS.success, lineHeight: 1 }}>
                          {analytics.tests.passed}
                        </div>
                        <Text style={{ fontSize: '0.7rem', color: '#065f46', fontWeight: 500 }}>Passed</Text>
                      </div>
                      </Col>
                    </Row>

                  {/* Average Score - Compact */}
                  <div style={{ 
                    background: COLORS.test.light,
                    borderRadius: 8,
                    padding: '10px',
                    marginBottom: 8
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text strong style={{ color: COLORS.test.dark, fontSize: '0.75rem' }}>Average</Text>
                      <Space size={6}>
                        {analytics.tests.trend !== 0 && (
                          <TrendIndicator value={analytics.tests.trend} />
                        )}
                        <Text strong style={{ 
                          fontSize: '0.9rem',
                          color: analytics.tests.average >= 75 ? COLORS.success : 
                                 analytics.tests.average >= 40 ? COLORS.warning : COLORS.danger 
                        }}>
                          {analytics.tests.average.toFixed(1)}%
                        </Text>
                  </Space>
                    </div>
                    <Progress 
                      percent={Math.round(analytics.tests.average)} 
                      strokeColor={
                        analytics.tests.average >= 75 ? COLORS.success : 
                        analytics.tests.average >= 40 ? COLORS.warning : COLORS.danger
                      }
                      showInfo={false}
                      strokeWidth={6}
                    />
                  </div>

                  {/* Pass Rate - Compact */}
                  <div style={{ 
                    background: '#ecfdf5',
                                borderRadius: 8,
                    padding: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text strong style={{ color: '#065f46', fontSize: '0.75rem' }}>Pass Rate</Text>
                      <Text strong style={{ fontSize: '0.9rem', color: COLORS.success }}>
                        {analytics.tests.passRate.toFixed(1)}%
                      </Text>
                    </div>
                    <Progress 
                      percent={Math.round(analytics.tests.passRate)} 
                      strokeColor={COLORS.success}
                      showInfo={false}
                      strokeWidth={6}
                    />
                      </div>

                  {analytics.tests.total === 0 && (
                    <Alert
                      message="No tests taken yet"
                      description="Complete your first test to see performance metrics"
                      type="info"
                      showIcon
                      style={{ marginTop: 16, borderRadius: 8 }}
                    />
                  )}
                    </Card>
              </Col>

              {/* Learning Card - Compact */}
              <Col xs={24} sm={12} lg={8}>
                <Card
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${COLORS.resources.light}`,
                    background: '#ffffff',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                    height: '100%'
                  }}
                  bodyStyle={{ padding: 14 }}
                >
                  {/* Card Header - Compact */}
                  <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: `linear-gradient(135deg, ${COLORS.resources.primary} 0%, ${COLORS.resources.secondary} 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 8px',
                      boxShadow: `0 2px 8px ${COLORS.resources.primary}30`
                    }}>
                      <BookOutlined style={{ fontSize: 20, color: 'white' }} />
                      </div>
                    <Text strong style={{ fontSize: '0.875rem', fontWeight: 600, color: COLORS.resources.dark }}>
                      Learning Resources
                    </Text>
                  </div>

                  <Divider style={{ margin: '10px 0', borderColor: COLORS.resources.light }} />
                  
                  {/* Resource Stats - Compact */}
                  <Row gutter={8} style={{ marginBottom: 10 }}>
                    <Col span={12}>
                      <div style={{
                        background: '#fef2f2',
                                borderRadius: 8,
                        padding: '8px',
                        textAlign: 'center',
                        border: '1px solid #fecaca'
                      }}>
                        <VideoCameraOutlined style={{ fontSize: 14, color: '#dc2626', marginBottom: 2 }} />
                        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#dc2626', lineHeight: 1 }}>
                          {analytics.learning.videos}
                      </div>
                        <Text style={{ fontSize: '0.7rem', color: '#991b1b', fontWeight: 500 }}>Videos</Text>
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{
                        background: COLORS.resources.light,
                        borderRadius: 8,
                        padding: '8px',
                        textAlign: 'center',
                        border: `1px solid ${COLORS.resources.secondary}50`
                      }}>
                        <FileTextOutlined style={{ fontSize: 14, color: COLORS.resources.primary, marginBottom: 2 }} />
                        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: COLORS.resources.primary, lineHeight: 1 }}>
                          {analytics.learning.pdfs}
                        </div>
                        <Text style={{ fontSize: '0.7rem', color: COLORS.resources.dark, fontWeight: 500 }}>PDFs</Text>
                      </div>
                    </Col>
                  </Row>
                  
                  {/* Total Resources - Compact */}
                  <div style={{ 
                    background: COLORS.resources.light,
                    borderRadius: 8,
                    padding: '12px',
                    textAlign: 'center',
                    border: `1px solid ${COLORS.resources.secondary}30`
                  }}>
                    <Text style={{ fontSize: '0.7rem', color: COLORS.resources.dark, display: 'block', marginBottom: 6, fontWeight: 500 }}>
                      Total Available
                    </Text>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: COLORS.resources.primary, lineHeight: 1 }}>
                      {analytics.learning.total}
                              </div>
                    {analytics.learning.newThisWeek > 0 && (
                      <Tag color="success" size="small" style={{ marginTop: 6, fontSize: '0.7rem', padding: '0 6px', height: 18 }}>
                        +{analytics.learning.newThisWeek} this week
                      </Tag>
                    )}
                  </div>

                  {analytics.learning.total === 0 && (
                    <Alert
                      message="No resources available"
                      description="Your teacher will add learning materials soon"
                      type="info"
                      showIcon
                      style={{ marginTop: 16, borderRadius: 8 }}
                    />
                  )}
                    </Card>
              </Col>
            </Row>

            {/* Performance Tips - Minimal Inline Alert */}
            {(analytics.attendance.rate < 75 || analytics.tests.average < 75 || analytics.overall >= 80) && (
              <div style={{ marginTop: 8 }}>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  {analytics.attendance.rate < 75 && (
                    <Alert
                      type="warning"
                      message={`Improve attendance to ${analytics.attendance.rate.toFixed(1)}% → 75%+`}
                      showIcon
                      style={{ fontSize: '0.875rem', borderRadius: 8 }}
                    />
                  )}
                  {analytics.tests.average < 75 && analytics.tests.total > 0 && (
                    <Alert
                      type="info"
                      message={`Boost test avg to ${analytics.tests.average.toFixed(1)}% → 75%+`}
                      showIcon
                      style={{ fontSize: '0.875rem', borderRadius: 8 }}
                    />
                  )}
                  {analytics.overall >= 80 && (
                    <Alert
                      type="success"
                      message={`🎉 Excellent! ${analytics.overall.toFixed(1)}% overall score`}
                      showIcon
                      style={{ fontSize: '0.875rem', borderRadius: 8 }}
                    />
                  )}
                </Space>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default StudentAnalytics;
