import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Space,
  Button,
  Spin,
  Tag,
  Progress,
  Skeleton,
  Statistic
} from 'antd';
import {
  UserOutlined,
  BookOutlined,
  CalendarOutlined,
  ReloadOutlined,
  TeamOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  RightOutlined,
  FileTextOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  TrophyOutlined
} from '@ant-design/icons';
import { useAuth } from '@/AuthProvider';
import { useTheme } from '@/contexts/ThemeContext';
import { kpiTone } from '@/shared/components/kpiTone';
import { supabase } from '@/config/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { getSchoolCode, getUserRole, getStudentCode, getSchoolName } from '@/shared/utils/metadata';

const { Title, Text } = Typography;

const Dashboard = () => {
  const { user } = useAuth();
  const { isDarkMode, theme } = useTheme();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalClasses: 0,
    totalSubjects: 0,
    todayAttendance: 0,
    todayAttendanceTotal: 0,
    pendingFees: 0,
    upcomingTests: 0,
    todayClasses: 0
  });
  const [schoolInfo, setSchoolInfo] = useState({ name: '', academicYear: '' });
  const [realtimeData, setRealtimeData] = useState({
    lastAttendanceUpdate: null,
    lastFeeUpdate: null
  });

  const channelRef = useRef(null);
  const debounceTimerRef = useRef(null);

  const userName = user?.user_metadata?.full_name || 'User';
  const role = getUserRole(user) || 'user';
  const schoolCode = getSchoolCode(user);
  const studentCode = getStudentCode(user);
  const schoolName = getSchoolName(user) || '';

  const getIST = () => {
    return new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getISTDate = () => {
    return new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getTodayIST = () => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  };

  const fetchDashboardData = useCallback(async () => {
    // Wait for user data to be available
    if (!user || !schoolCode) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const today = getTodayIST();

      if (role === 'student') {
        // Try to find student by auth_user_id first (most reliable)
        let { data: studentData } = await supabase
          .from('student')
          .select('id, class_instance_id, full_name')
          .eq('auth_user_id', user.id)
          .eq('school_code', schoolCode)
          .maybeSingle();

        // Fallback to student_code or email if not found by auth_user_id
        if (!studentData && studentCode) {
          const result = await supabase
            .from('student')
            .select('id, class_instance_id, full_name')
            .eq('student_code', studentCode)
            .eq('school_code', schoolCode)
            .maybeSingle();
          studentData = result.data;
        }

        if (!studentData && user.email) {
          const result = await supabase
            .from('student')
            .select('id, class_instance_id, full_name')
            .eq('email', user.email)
            .eq('school_code', schoolCode)
            .maybeSingle();
          studentData = result.data;
        }

        if (!studentData) {
          setLoading(false);
          return;
        }

        const [attendanceResult, testsCount, timetableCount, feesSummary] = await Promise.all([
          supabase.from('attendance').select('status', { count: 'exact' }).eq('student_id', studentData.id).eq('date', today).maybeSingle(),
          supabase.from('tests').select('id', { count: 'exact', head: true }).eq('class_instance_id', studentData.class_instance_id).gte('test_date', today),
          supabase.from('timetable_slots').select('id', { count: 'exact', head: true }).eq('class_instance_id', studentData.class_instance_id).eq('date', today),
          supabase.rpc('fees_student_summary', { p_school_code: schoolCode, p_student_id: studentData.id })
        ]);

        const totalFees = feesSummary?.data?.[0]?.total_planned ?? 0;
        const paidFees = feesSummary?.data?.[0]?.total_paid ?? 0;

        const { count: totalAttendance } = await supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('student_id', studentData.id);
        const { count: presentCount } = await supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('student_id', studentData.id).eq('status', 'present');

        setStats({
          totalStudents: 1,
          totalClasses: 1,
          todayAttendance: attendanceResult.data?.status === 'present' ? 1 : 0,
          todayAttendanceTotal: totalAttendance || 0,
          attendancePercentage: totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0,
          pendingFees: (totalFees - paidFees) / 100,
          upcomingTests: testsCount.count || 0,
          todayClasses: timetableCount.count || 0
        });
      } else if (role === 'admin') {
        const { data: adminClasses } = await supabase
          .from('class_instances')
          .select('id')
          .eq('class_teacher_id', user.id)
          .eq('school_code', schoolCode);

        const classIds = adminClasses?.map(c => c.id) || [];

        if (classIds.length === 0) {
          setStats({
            totalStudents: 0,
            totalClasses: 0,
            totalSubjects: 0,
            todayAttendance: 0,
            todayAttendanceTotal: 0,
            pendingFees: 0,
            upcomingTests: 0,
            todayClasses: 0
          });
          setLoading(false);
          return;
        }

        const [studentsResult, attendanceResult, attendanceTotalResult, feeResult, testResult] = await Promise.all([
          supabase.from('student').select('id', { count: 'exact', head: true }).in('class_instance_id', classIds).eq('school_code', schoolCode),
          supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('school_code', schoolCode).eq('date', today).eq('status', 'present'),
          supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('school_code', schoolCode).eq('date', today),
          supabase.from('fee_invoices').select('student_id, total_amount, paid_amount').eq('school_code', schoolCode),
          supabase.from('tests').select('id', { count: 'exact', head: true }).in('class_instance_id', classIds).gte('test_date', today)
        ]);

        setStats({
          totalStudents: studentsResult.count || 0,
          totalClasses: classIds.length,
          totalSubjects: 0,
          todayAttendance: attendanceResult.count || 0,
          todayAttendanceTotal: attendanceTotalResult.count || 0,
          pendingFees: 0,
          upcomingTests: testResult.count || 0,
          todayClasses: classIds.length
        });
      } else if (role === 'superadmin') {
        const [studentsResult, classesResult, subjectsResult, attendanceResult, attendanceTotalResult, schoolFees, testResult] = await Promise.all([
          supabase.from('student').select('id', { count: 'exact', head: true }).eq('school_code', schoolCode),
          supabase.from('class_instances').select('id', { count: 'exact', head: true }).eq('school_code', schoolCode),
          supabase.from('subjects').select('id', { count: 'exact', head: true }).eq('school_code', schoolCode),
          supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('school_code', schoolCode).eq('date', today).eq('status', 'present'),
          supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('school_code', schoolCode).eq('date', today),
          supabase.rpc('fees_school_summary', { p_school_code: schoolCode }),
          supabase.from('tests').select('id', { count: 'exact', head: true }).eq('school_code', schoolCode).gte('test_date', today)
        ]);
        const totalFees = 0; // not displayed here; keep prior behavior only for pending fees calculation below
        const paidFees = schoolFees?.data?.[0]?.total_paid ?? 0;

        setStats({
          totalStudents: studentsResult.count || 0,
          totalClasses: classesResult.count || 0,
          totalSubjects: subjectsResult.count || 0,
          todayAttendance: attendanceResult.count || 0,
          todayAttendanceTotal: attendanceTotalResult.count || 0,
          pendingFees: (totalFees - paidFees) / 100,
          upcomingTests: testResult.count || 0,
          todayClasses: classesResult.count || 0
        });
      }

      const { data: schoolData } = await supabase
        .from('schools')
        .select('school_name')
        .eq('school_code', schoolCode)
        .maybeSingle();

      if (schoolData) {
        setSchoolInfo({
          name: schoolData.school_name || schoolName,
          academicYear: new Date().getFullYear() // Academic year is in separate table
        });
      }

    } catch (err) {
    } finally {
      setLoading(false);
    }
  }, [role, schoolCode, studentCode, user, schoolName]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!schoolCode) return;

    const channel = supabase.channel(`dashboard:${schoolCode}`);

    const handleChange = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        fetchDashboardData();
        setRealtimeData(prev => ({
          ...prev,
          lastAttendanceUpdate: new Date().toISOString()
        }));
      }, 1000);
    };

    const handleFeeChange = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        fetchDashboardData();
        setRealtimeData(prev => ({
          ...prev,
          lastFeeUpdate: new Date().toISOString()
        }));
      }, 1000);
    };

    channel
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'attendance',
        filter: `school_code=eq.${schoolCode}`
      }, handleChange)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'fee_payments',
        filter: `school_code=eq.${schoolCode}`
      }, handleFeeChange)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'student',
        filter: `school_code=eq.${schoolCode}`
      }, handleChange)
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [schoolCode, fetchDashboardData]);

  const getRoleDisplay = (role) => {
    const roles = {
      'cb_admin': 'CB Admin',
      'superadmin': 'Super Admin',
      'admin': 'Admin',
      'student': 'Student'
    };
    return roles[role] || 'User';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getQuickActions = (role) => {
    const allActions = {
      'cb_admin': [
        { label: 'Schools', path: '/cb-admin-dashboard', icon: <TeamOutlined />, color: '#1890ff', description: 'Manage schools' },
        { label: 'Add School', path: '/add-schools', icon: <UserOutlined />, color: '#52c41a', description: 'Register school' },
        { label: 'Super Admins', path: '/add-super-admin', icon: <UserOutlined />, color: '#faad14', description: 'Manage admins' }
      ],
      'superadmin': [
        { label: 'Students', path: '/add-student', icon: <UserOutlined />, color: '#52c41a', description: 'Manage students' },
        { label: 'Classes', path: '/add-specific-class', icon: <BookOutlined />, color: '#faad14', description: 'Manage classes' },
        { label: 'Attendance', path: '/attendance', icon: <CheckCircleOutlined />, color: '#1890ff', description: 'Mark attendance' },
        { label: 'Fees', path: '/fees', icon: <DollarOutlined />, color: '#f5222d', description: 'Fee management' },
        { label: 'Tests', path: '/tests', icon: <FileTextOutlined />, color: '#722ed1', description: 'Manage tests' },
        { label: 'Analytics', path: '/analytics', icon: <BarChartOutlined />, color: '#13c2c2', description: 'View insights' }
      ],
      'admin': [
        { label: 'Students', path: '/add-student', icon: <UserOutlined />, color: '#52c41a', description: 'Manage students' },
        { label: 'Timetable', path: '/timetable', icon: <CalendarOutlined />, color: '#1890ff', description: 'Class schedules' },
        { label: 'Attendance', path: '/attendance', icon: <CheckCircleOutlined />, color: '#1890ff', description: 'Mark attendance' },
        { label: 'Fees', path: '/fees', icon: <DollarOutlined />, color: '#faad14', description: 'Fee collection' },
        { label: 'Tests', path: '/tests', icon: <FileTextOutlined />, color: '#f5222d', description: 'Manage tests' },
        { label: 'Analytics', path: '/analytics', icon: <BarChartOutlined />, color: '#722ed1', description: 'View reports' }
      ],
      'student': [
        { label: 'Tests', path: '/take-tests', icon: <FileTextOutlined />, color: '#1890ff', description: 'Take assessments' },
        { label: 'Resources', path: '/learning-resources', icon: <BookOutlined />, color: '#52c41a', description: 'Study materials' },
        { label: 'Timetable', path: '/timetable', icon: <CalendarOutlined />, color: '#faad14', description: 'My schedule' },
        { label: 'Attendance', path: '/attendance', icon: <CheckCircleOutlined />, color: '#1890ff', description: 'My attendance' },
        { label: 'Fees', path: '/fees', icon: <DollarOutlined />, color: '#f5222d', description: 'Fee status' }
      ]
    };
    return allActions[role] || [];
  };

  const StatCard = ({ title, value, icon, color, suffix, loading }) => {
    const numericValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d.-]/g, ''));
    const hasData = !Number.isNaN(numericValue) && numericValue !== 0;
    const iconColor = hasData ? color : '#94a3b8';
    return (
      <Card
        style={{
          borderRadius: 16,
          border: 'none',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.03)',
          height: '100%',
        }}
        bodyStyle={{ padding: 20 }}
      >
        {loading ? (
          <Skeleton active paragraph={{ rows: 1 }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text style={{
                fontSize: 13,
                color: '#64748b',
                fontWeight: 500,
                display: 'block',
                marginBottom: 10,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {title}
              </Text>
              <div style={{
                fontSize: 30,
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {value}{suffix || ''}
              </div>
            </div>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: `${iconColor}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              color: iconColor,
              flexShrink: 0,
            }}>
              {icon}
            </div>
          </div>
        )}
      </Card>
    );
  };

  const ActionCard = ({ label, path, icon, color, description }) => (
    <Card
      onClick={() => navigate(path)}
      style={{
        borderRadius: 16,
        border: 'none',
        background: '#ffffff',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.03)',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        height: '100%',
      }}
      bodyStyle={{ padding: 16 }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.03)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: `${color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          color: color,
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <Text strong style={{
            fontSize: 14,
            color: '#0f172a',
            display: 'block',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: 2,
          }}>{label}</Text>
          <Text style={{
            fontSize: 12,
            color: '#64748b',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>{description}</Text>
        </div>
        <RightOutlined style={{ fontSize: 11, color: '#cbd5e1', flexShrink: 0 }} />
      </div>
    </Card>
  );

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '70vh',
        background: isDarkMode ? theme.token.colorBgLayout : '#fafafa'
      }}>
        <Spin size="large" />
      </div>
    );
  }

  const attendancePercentage = stats.todayAttendanceTotal > 0
    ? Math.round((stats.todayAttendance / stats.todayAttendanceTotal) * 100)
    : 0;

  return (
    <div style={{
      background: isDarkMode ? theme.token.colorBgLayout : 'transparent',
      minHeight: '100vh',
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: 16,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{
                margin: 0,
                fontSize: 32,
                fontWeight: 700,
                color: '#0f172a',
                marginBottom: 6,
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
              }}>
                Dashboard
              </h1>
              <Text style={{
                fontSize: 14,
                color: '#64748b',
                display: 'block',
                fontWeight: 500,
              }}>
                {getGreeting()}, {userName}
              </Text>
              <Text style={{
                fontSize: 13,
                color: '#94a3b8',
                display: 'block',
                marginTop: 2,
              }}>
                {getISTDate()}
              </Text>
            </div>
            <Space size={10} style={{ flexShrink: 0, flexWrap: 'wrap' }}>
              {schoolInfo.academicYear && (
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#2563eb',
                  background: 'rgba(59, 130, 246, 0.10)',
                  padding: '6px 12px',
                  borderRadius: 999,
                  letterSpacing: '0.01em',
                }}>
                  AY {schoolInfo.academicYear}
                </span>
              )}
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchDashboardData}
                loading={loading}
                style={{
                  borderRadius: 10,
                  height: 36,
                  border: 'none',
                  background: '#ffffff',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
                  fontWeight: 500,
                }}
              >
                <span style={{ whiteSpace: 'nowrap' }}>Refresh</span>
              </Button>
            </Space>
          </div>
        </div>

        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {role === 'student' ? (
            <>
              <Col xs={24} sm={12} lg={6}>
                <StatCard
                  title="My Attendance"
                  value={stats.attendancePercentage || 0}
                  suffix="%"
                  icon={<CheckCircleOutlined />}
                  color="#52c41a"
                  loading={false}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard
                  title="Pending Fees"
                  value={`₹${stats.pendingFees.toFixed(0)}`}
                  icon={<DollarOutlined />}
                  color="#f59e0b"
                  loading={false}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard
                  title="Upcoming Tests"
                  value={stats.upcomingTests}
                  icon={<TrophyOutlined />}
                  color="#722ed1"
                  loading={false}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard
                  title="Today's Classes"
                  value={stats.todayClasses}
                  icon={<CalendarOutlined />}
                  color="#1890ff"
                  loading={false}
                />
              </Col>
            </>
          ) : role === 'admin' ? (
            <>
              <Col xs={24} sm={12} lg={6}>
                <StatCard
                  title="My Students"
                  value={stats.totalStudents}
                  icon={<UserOutlined />}
                  color="#52c41a"
                  loading={false}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard
                  title="My Classes"
                  value={stats.totalClasses}
                  icon={<BookOutlined />}
                  color="#1890ff"
                  loading={false}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard
                  title="Today's Attendance"
                  value={attendancePercentage}
                  suffix="%"
                  icon={<CheckCircleOutlined />}
                  color="#1890ff"
                  loading={false}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard
                  title="Upcoming Tests"
                  value={stats.upcomingTests}
                  icon={<TrophyOutlined />}
                  color="#722ed1"
                  loading={false}
                />
              </Col>
            </>
          ) : (
            <>
              <Col xs={24} sm={12} lg={6}>
                <StatCard
                  title="Total Students"
                  value={stats.totalStudents}
                  icon={<UserOutlined />}
                  color="#52c41a"
                  loading={false}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard
                  title="Total Classes"
                  value={stats.totalClasses}
                  icon={<BookOutlined />}
                  color="#1890ff"
                  loading={false}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard
                  title="Today's Attendance"
                  value={attendancePercentage}
                  suffix="%"
                  icon={<CheckCircleOutlined />}
                  color="#1890ff"
                  loading={false}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard
                  title="Pending Fees"
                  value={`₹${stats.pendingFees.toFixed(0)}`}
                  icon={<DollarOutlined />}
                  color="#f59e0b"
                  loading={false}
                />
              </Col>
            </>
          )}
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} md={12}>
            <Card
              style={{
                borderRadius: 16,
                border: 'none',
                background: '#ffffff',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.03)',
                height: '100%',
              }}
              bodyStyle={{ padding: 20 }}
            >
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: 16, color: '#0f172a', fontWeight: 600, letterSpacing: '-0.01em' }}>
                  {role === 'student' ? "Today's Status" : "Today's Overview"}
                </Text>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  {new Date().toLocaleDateString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    weekday: 'long', day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </div>
              </div>
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                    {role === 'student' ? 'Attendance' : 'Students Present'}
                  </Text>
                  <Text style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: stats.todayAttendance > 0 ? '#10b981' : '#94a3b8',
                    letterSpacing: '-0.01em',
                  }}>
                    {role === 'student' ? (stats.todayAttendance > 0 ? '✓' : '—') : stats.todayAttendance}
                  </Text>
                </div>
                {role !== 'student' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Attendance Rate</Text>
                      <Text style={{
                        fontSize: 13, fontWeight: 700,
                        color: attendancePercentage >= 75 ? '#10b981' : attendancePercentage >= 50 ? '#f59e0b' : '#ef4444',
                      }}>
                        {attendancePercentage}%
                      </Text>
                    </div>
                    <Progress
                      percent={attendancePercentage}
                      strokeColor={attendancePercentage >= 75 ? '#10b981' : attendancePercentage >= 50 ? '#f59e0b' : '#ef4444'}
                      trailColor="#f1f5f9"
                      strokeWidth={8}
                      showInfo={false}
                    />
                  </div>
                )}
              </Space>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card
              style={{
                borderRadius: 16,
                border: 'none',
                background: '#ffffff',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.03)',
                height: '100%',
              }}
              bodyStyle={{ padding: 20 }}
            >
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: 16, color: '#0f172a', fontWeight: 600, letterSpacing: '-0.01em' }}>
                  Quick Stats
                </Text>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  Live updates
                </div>
              </div>
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space size={10} align="center">
                    <div style={{
                      width: 32, height: 32, borderRadius: 10,
                      background: 'rgba(59, 130, 246, 0.10)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#2563eb', fontSize: 15,
                    }}>
                      <ClockCircleOutlined />
                    </div>
                    <Text style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                      {role === 'student' ? "Today's Classes" : 'Upcoming Tests'}
                    </Text>
                  </Space>
                  <Text style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    {role === 'student' ? stats.todayClasses : stats.upcomingTests}
                  </Text>
                </div>
                {role !== 'student' && stats.totalSubjects > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size={10} align="center">
                      <div style={{
                        width: 32, height: 32, borderRadius: 10,
                        background: 'rgba(245, 158, 11, 0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#d97706', fontSize: 15,
                      }}>
                        <BookOutlined />
                      </div>
                      <Text style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Subjects</Text>
                    </Space>
                    <Text style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
                      {stats.totalSubjects}
                    </Text>
                  </div>
                )}
                {realtimeData.lastAttendanceUpdate && (
                  <div style={{ fontSize: 11, color: '#10b981', textAlign: 'right', marginTop: 4, fontWeight: 500 }}>
                    ● Live · Updated just now
                  </div>
                )}
              </Space>
            </Card>
          </Col>
        </Row>

        <div style={{ marginBottom: 8 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: '#0f172a',
              marginBottom: 4,
              letterSpacing: '-0.01em',
            }}>
              Quick Actions
            </h2>
            <Text style={{ color: '#64748b', fontSize: 13 }}>
              Access your most-used features
            </Text>
          </div>
          <Row gutter={[16, 16]}>
            {getQuickActions(role).map((action, index) => (
              <Col key={index} xs={24} sm={12} md={8} lg={8} xl={6}>
                <ActionCard {...action} />
              </Col>
            ))}
          </Row>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
