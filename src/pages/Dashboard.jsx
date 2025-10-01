import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Space,
  Button,
  Spin,
  Tag,
  Progress
} from 'antd';
import {
  UserOutlined,
  BookOutlined,
  CalendarOutlined,
  TrophyOutlined,
  ReloadOutlined,
  TeamOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  RightOutlined,
  SettingOutlined,
  FileTextOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import { supabase } from '../config/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { getSchoolCode } from '../utils/metadata';
import EmptyState from '../ui/EmptyState';

const { Title, Text, Paragraph } = Typography;

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalClasses: 0,
    totalSubjects: 0,
    todayAttendance: 0
  });
  const [error, setError] = useState(null);

  const userName = user?.user_metadata?.full_name || 'User';
  const role = user?.app_metadata?.role || user?.user_metadata?.role || 'user';
  const schoolCode = getSchoolCode(user);

  useEffect(() => {
    fetchDashboardData();
  }, [role, schoolCode]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!schoolCode) {
        setLoading(false);
        return;
      }

      const today = new Date().toISOString().split('T')[0];

      const [studentsResult, classesResult, subjectsResult, attendanceResult] = await Promise.all([
        supabase.from('student').select('id', { count: 'exact', head: true }).eq('school_code', schoolCode),
        supabase.from('class_instances').select('id', { count: 'exact', head: true }).eq('school_code', schoolCode),
        supabase.from('subjects').select('id', { count: 'exact', head: true }).eq('school_code', schoolCode),
        supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('school_code', schoolCode).eq('date', today).eq('status', 'present')
      ]);

      setStats({
        totalStudents: studentsResult.count || 0,
        totalClasses: classesResult.count || 0,
        totalSubjects: subjectsResult.count || 0,
        todayAttendance: attendanceResult.count || 0
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

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
        { label: 'Schools', path: '/cb-admin-dashboard', icon: <TeamOutlined />, color: '#0ea5e9', description: 'Manage all schools' },
        { label: 'Add School', path: '/add-schools', icon: <SettingOutlined />, color: '#10b981', description: 'Register new school' },
        { label: 'Super Admins', path: '/add-super-admin', icon: <UserOutlined />, color: '#f59e0b', description: 'Manage super admins' }
      ],
      'superadmin': [
        { label: 'School Setup', path: '/school-setup', icon: <SettingOutlined />, color: '#0ea5e9', description: 'Configure school' },
        { label: 'Students', path: '/add-student', icon: <UserOutlined />, color: '#10b981', description: 'Manage students' },
        { label: 'Classes', path: '/add-specific-class', icon: <BookOutlined />, color: '#f59e0b', description: 'Manage classes' },
        { label: 'Attendance', path: '/attendance', icon: <CheckCircleOutlined />, color: '#06b6d4', description: 'Mark attendance' },
        { label: 'Fees', path: '/fees', icon: <DollarOutlined />, color: '#ef4444', description: 'Fee management' },
        { label: 'Analytics', path: '/analytics', icon: <BarChartOutlined />, color: '#8b5cf6', description: 'View insights' }
      ],
      'admin': [
        { label: 'Students', path: '/add-student', icon: <UserOutlined />, color: '#10b981', description: 'Manage students' },
        { label: 'Timetable', path: '/timetable', icon: <CalendarOutlined />, color: '#0ea5e9', description: 'Class schedules' },
        { label: 'Attendance', path: '/attendance', icon: <CheckCircleOutlined />, color: '#06b6d4', description: 'Mark attendance' },
        { label: 'Fees', path: '/fees', icon: <DollarOutlined />, color: '#f59e0b', description: 'Fee collection' },
        { label: 'Tests', path: '/tests', icon: <FileTextOutlined />, color: '#ef4444', description: 'Manage tests' },
        { label: 'Analytics', path: '/analytics', icon: <BarChartOutlined />, color: '#8b5cf6', description: 'View reports' }
      ],
      'student': [
        { label: 'Tests', path: '/take-tests', icon: <FileTextOutlined />, color: '#0ea5e9', description: 'Take assessments' },
        { label: 'Resources', path: '/learning-resources', icon: <BookOutlined />, color: '#10b981', description: 'Study materials' },
        { label: 'Timetable', path: '/timetable', icon: <CalendarOutlined />, color: '#f59e0b', description: 'My schedule' },
        { label: 'Attendance', path: '/attendance', icon: <CheckCircleOutlined />, color: '#06b6d4', description: 'My attendance' },
        { label: 'Fees', path: '/fees', icon: <DollarOutlined />, color: '#ef4444', description: 'Fee status' }
      ]
    };
    return allActions[role] || [];
  };

  const StatCard = ({ title, value, icon, color, trend, trendValue }) => (
    <Card
      style={{
        borderRadius: 8,
        border: '1px solid #e8e8e8',
        height: '100%'
      }}
      bodyStyle={{ padding: 12 }}
    >
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
            {value}
          </div>
        </div>
        {trend && (
          <div style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 11, color: trend === 'up' ? '#52c41a' : '#f5222d' }}>
              {trend === 'up' ? '↑' : '↓'} {trendValue}
            </Text>
          </div>
        )}
      </div>
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
        background: '#f8fafc'
      }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 16, background: '#fafafa', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header Section */}
        <div style={{ marginBottom: 32 }}>
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
                {getGreeting()}, {userName}
              </h1>
              <Text style={{ fontSize: 13, color: '#8c8c8c', display: 'block', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                {role === 'student' ? 'Ready to learn today?' : 'Overview of your school'}
              </Text>
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
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="Total Students"
              value={stats.totalStudents}
              icon={<UserOutlined />}
              color="#10b981"
              trend="up"
              trendValue="+12%"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="Total Classes"
              value={stats.totalClasses}
              icon={<BookOutlined />}
              color="#0ea5e9"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="Subjects"
              value={stats.totalSubjects}
              icon={<FileTextOutlined />}
              color="#f59e0b"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="Present Today"
              value={stats.todayAttendance}
              icon={<CheckCircleOutlined />}
              color="#06b6d4"
              trend="up"
              trendValue="+5%"
            />
          </Col>
        </Row>

        {!loading && stats.totalStudents === 0 && stats.totalClasses === 0 && role !== 'student' && (
          <Card style={{
            borderRadius: 8,
            marginBottom: 16,
            border: '1px solid #e8e8e8'
          }} bodyStyle={{ padding: 32 }}>
            <EmptyState
              title="Welcome to ClassBridge!"
              description="Let's get started by setting up your school. Add classes and students to begin using the platform."
              icon="🎓"
              actionText="Start Setup"
              onAction={() => navigate('/school-setup')}
            />
          </Card>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#262626', marginBottom: 2 }}>
              Quick Actions
            </h2>
            <Text style={{ color: '#64748b', fontSize: 14 }}>
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

        {stats.totalStudents > 0 && (
          <Card
            style={{
              borderRadius: 8,
              border: '1px solid #e8e8e8'
            }}
            bodyStyle={{ padding: 16 }}
          >
            <div style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#262626', marginBottom: 2 }}>
                System Status
              </h2>
              <Text style={{ color: '#8c8c8c', fontSize: 12 }}>
                Everything is running smoothly
              </Text>
            </div>
            <Row gutter={[12, 12]}>
              <Col xs={24} md={12}>
                <div style={{ padding: 12, background: '#fafafa', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text strong style={{ fontSize: 13, color: '#262626' }}>Class Enrollment</Text>
                    <Text style={{ color: '#1890ff', fontWeight: 600, fontSize: 13 }}>
                      {stats.totalStudents > 0 ? '85%' : '0%'}
                    </Text>
                  </div>
                  <Progress
                    percent={stats.totalStudents > 0 ? 85 : 0}
                    strokeColor="#1890ff"
                    showInfo={false}
                    size="small"
                  />
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div style={{ padding: 12, background: '#fafafa', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text strong style={{ fontSize: 13, color: '#262626' }}>Today's Attendance</Text>
                    <Text style={{ color: '#52c41a', fontWeight: 600, fontSize: 13 }}>
                      {stats.totalStudents > 0 ? Math.round((stats.todayAttendance / stats.totalStudents) * 100) : 0}%
                    </Text>
                  </div>
                  <Progress
                    percent={stats.totalStudents > 0 ? Math.round((stats.todayAttendance / stats.totalStudents) * 100) : 0}
                    strokeColor="#10b981"
                    showInfo={false}
                    size="small"
                  />
                </div>
              </Col>
            </Row>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
