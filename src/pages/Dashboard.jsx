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
import { useAuth } from '../AuthProvider';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../config/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { getSchoolCode, getUserRole, getStudentCode, getSchoolName } from '../utils/metadata';

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
    if (!schoolCode) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const today = getTodayIST();

      if (role === 'student') {
        const { data: studentData } = await supabase
          .from('student')
          .select('id, class_instance_id, full_name')
          .eq('student_code', studentCode)
          .eq('school_code', schoolCode)
          .maybeSingle();

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
          supabase.from('fee_student_plans').select('student_id, fee_student_plan_items(amount_paise)').eq('school_code', schoolCode),
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

  const StatCard = ({ title, value, icon, color, suffix, loading }) => (
    <Card
      style={{
        borderRadius: 8,
        border: `1px solid ${theme.token.colorBorder}`,
        background: theme.token.colorBgContainer,
        height: '100%'
      }}
      bodyStyle={{ padding: 12 }}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 1 }} />
      ) : (
        <div>
          <Text style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 500, display: 'block', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{
              fontSize: 28,
              color: color,
              lineHeight: 1,
              flexShrink: 0
            }}>
              {icon}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#262626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
              {value}{suffix || ''}
            </div>
          </div>
        </div>
      )}
    </Card>
  );

  const ActionCard = ({ label, path, icon, color, description }) => (
    <Card
      hoverable
      onClick={() => navigate(path)}
      style={{
        borderRadius: 6,
        border: '1px solid #e8e8e8',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        height: '100%'
      }}
      bodyStyle={{ padding: 12 }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#e8e8e8';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 6,
          background: `${color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          color: color,
          flexShrink: 0
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <Text strong style={{ fontSize: 13, color: '#262626', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</Text>
          <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{description}</Text>
        </div>
        <RightOutlined style={{ fontSize: 10, color: '#bfbfbf', flexShrink: 0 }} />
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
      padding: 16, 
      background: isDarkMode ? theme.token.colorBgLayout : '#fafafa', 
      minHeight: '100vh' 
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 8
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 600,
                color: '#262626',
                marginBottom: 4,
                lineHeight: 1.2,
                wordBreak: 'break-word',
                overflowWrap: 'break-word'
              }}>
                Dashboard
              </h1>
              <Text style={{ fontSize: 13, color: '#8c8c8c', display: 'block', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                {getGreeting()}, {userName} • {schoolInfo.name && `${schoolInfo.name} • `}{getISTDate()} • {getIST()}
              </Text>
              {schoolInfo.academicYear && (
                <Tag color="blue" style={{ fontSize: 11, marginTop: 4 }}>
                  AY {schoolInfo.academicYear}
                </Tag>
              )}
            </div>
            <Space size={8} style={{ flexShrink: 0, flexWrap: 'wrap' }}>
              <Tag color="blue" style={{ fontSize: 12, padding: '2px 10px', whiteSpace: 'nowrap' }}>
                {getRoleDisplay(role)}
              </Tag>
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchDashboardData}
                loading={loading}
                size="small"
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
                  color="#f5222d"
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
                  color="#f5222d"
                  loading={false}
                />
              </Col>
            </>
          )}
        </Row>

        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={12}>
            <Card
              style={{
                borderRadius: 8,
                border: '1px solid #e8e8e8',
                height: '100%'
              }}
              bodyStyle={{ padding: 16 }}
            >
              <div style={{ marginBottom: 12 }}>
                <Text strong style={{ fontSize: 14, color: '#262626' }}>
                  {role === 'student' ? "Today's Status" : "Today's Overview"}
                </Text>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
                  {getTodayIST()}
                </div>
              </div>
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#595959' }}>
                    {role === 'student' ? 'Attendance' : 'Students Present'}
                  </Text>
                  <Statistic
                    value={role === 'student' ? (stats.todayAttendance > 0 ? '✓' : '—') : stats.todayAttendance}
                    valueStyle={{ fontSize: 16, color: stats.todayAttendance > 0 ? '#52c41a' : '#8c8c8c' }}
                  />
                </div>
                {role !== 'student' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, color: '#595959' }}>Attendance Rate</Text>
                      <Text style={{ fontSize: 12, fontWeight: 600, color: attendancePercentage >= 75 ? '#52c41a' : '#faad14' }}>
                        {attendancePercentage}%
                      </Text>
                    </div>
                    <Progress
                      percent={attendancePercentage}
                      strokeColor={attendancePercentage >= 75 ? '#52c41a' : '#faad14'}
                      showInfo={false}
                      size="small"
                    />
                  </div>
                )}
              </Space>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card
              style={{
                borderRadius: 8,
                border: '1px solid #e8e8e8',
                height: '100%'
              }}
              bodyStyle={{ padding: 16 }}
            >
              <div style={{ marginBottom: 12 }}>
                <Text strong style={{ fontSize: 14, color: '#262626' }}>
                  Quick Stats
                </Text>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
                  Live updates
                </div>
              </div>
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space size={8}>
                    <ClockCircleOutlined style={{ color: '#1890ff', fontSize: 16 }} />
                    <Text style={{ fontSize: 13, color: '#595959' }}>
                      {role === 'student' ? "Today's Classes" : 'Upcoming Tests'}
                    </Text>
                  </Space>
                  <Statistic
                    value={role === 'student' ? stats.todayClasses : stats.upcomingTests}
                    valueStyle={{ fontSize: 16, color: '#262626' }}
                  />
                </div>
                {role !== 'student' && stats.totalSubjects > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size={8}>
                      <BookOutlined style={{ color: '#faad14', fontSize: 16 }} />
                      <Text style={{ fontSize: 13, color: '#595959' }}>Subjects</Text>
                    </Space>
                    <Statistic
                      value={stats.totalSubjects}
                      valueStyle={{ fontSize: 16, color: '#262626' }}
                    />
                  </div>
                )}
                {realtimeData.lastAttendanceUpdate && (
                  <div style={{ fontSize: 10, color: '#52c41a', textAlign: 'right', marginTop: 4 }}>
                    ● Live - Updated just now
                  </div>
                )}
              </Space>
            </Card>
          </Col>
        </Row>

        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#262626', marginBottom: 2 }}>
              Quick Actions
            </h2>
            <Text style={{ color: '#8c8c8c', fontSize: 12 }}>
              Access your most-used features
            </Text>
          </div>
          <Row gutter={[12, 12]}>
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
