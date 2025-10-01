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
        borderRadius: 16,
        border: 'none',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        height: '100%',
        overflow: 'hidden'
      }}
      bodyStyle={{ padding: 0 }}
    >
      <div style={{
        background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
        padding: '24px',
        position: 'relative'
      }}>
        <div style={{
          position: 'absolute',
          top: 16,
          right: 16,
          fontSize: 48,
          color: `${color}30`,
          lineHeight: 1
        }}>
          {icon}
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Text style={{ fontSize: 14, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 8 }}>
            {title}
          </Text>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
            {value}
          </div>
          {trend && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 12, color: trend === 'up' ? '#10b981' : '#ef4444' }}>
                {trend === 'up' ? '↑' : '↓'} {trendValue}
              </Text>
              <Text style={{ fontSize: 12, color: '#94a3b8' }}>vs last week</Text>
            </div>
          )}
        </div>
      </div>
    </Card>
  );

  const ActionCard = ({ label, path, icon, color, description }) => (
    <Card
      hoverable
      onClick={() => navigate(path)}
      style={{
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        height: '100%'
      }}
      bodyStyle={{ padding: '20px' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.boxShadow = `0 4px 12px ${color}20`;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#e2e8f0';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: `${color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          color: color,
          flexShrink: 0
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text strong style={{ fontSize: 15, color: '#1e293b' }}>{label}</Text>
            <RightOutlined style={{ fontSize: 12, color: '#94a3b8' }} />
          </div>
          <Text style={{ fontSize: 13, color: '#64748b', display: 'block' }}>{description}</Text>
        </div>
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
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header Section */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 8
          }}>
            <div>
              <h1 style={{
                margin: 0,
                fontSize: 32,
                fontWeight: 700,
                color: '#1e293b',
                marginBottom: 8,
                lineHeight: 1.2
              }}>
                {getGreeting()}, {userName}!
              </h1>
              <Text style={{ fontSize: 16, color: '#64748b' }}>
                Here's what's happening with your school today
              </Text>
            </div>
            <Space>
              <Tag color="blue" style={{
                padding: '6px 16px',
                fontSize: 14,
                borderRadius: 8,
                border: 'none',
                background: '#e0f2fe',
                color: '#0369a1',
                fontWeight: 500
              }}>
                {getRoleDisplay(role)}
              </Tag>
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchDashboardData}
                loading={loading}
                style={{ borderRadius: 8 }}
              >
                Refresh
              </Button>
            </Space>
          </div>
        </div>

        {/* Stats Grid */}
        <Row gutter={[20, 20]} style={{ marginBottom: 32 }}>
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

        {/* Empty State for New Users */}
        {!loading && stats.totalStudents === 0 && stats.totalClasses === 0 && role !== 'student' && (
          <Card style={{
            borderRadius: 16,
            marginBottom: 32,
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }} bodyStyle={{ padding: 48 }}>
            <EmptyState
              title="Welcome to ClassBridge!"
              description="Let's get started by setting up your school. Add classes and students to begin using the platform."
              icon="🎓"
              actionText="Start Setup"
              onAction={() => navigate('/school-setup')}
            />
          </Card>
        )}

        {/* Quick Actions */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
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

        {/* Recent Activity Section (Placeholder) */}
        {stats.totalStudents > 0 && (
          <Card
            style={{
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
            bodyStyle={{ padding: 24 }}
          >
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
                System Status
              </h2>
              <Text style={{ color: '#64748b', fontSize: 14 }}>
                Everything is running smoothly
              </Text>
            </div>
            <Row gutter={[20, 20]}>
              <Col xs={24} md={12}>
                <div style={{ padding: 16, background: '#f8fafc', borderRadius: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text strong style={{ color: '#1e293b' }}>Class Enrollment</Text>
                    <Text style={{ color: '#0ea5e9', fontWeight: 600 }}>
                      {stats.totalStudents > 0 ? '85%' : '0%'}
                    </Text>
                  </div>
                  <Progress
                    percent={stats.totalStudents > 0 ? 85 : 0}
                    strokeColor="#0ea5e9"
                    showInfo={false}
                    size="small"
                  />
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div style={{ padding: 16, background: '#f8fafc', borderRadius: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text strong style={{ color: '#1e293b' }}>Today's Attendance</Text>
                    <Text style={{ color: '#10b981', fontWeight: 600 }}>
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
