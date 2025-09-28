import React, { useState, useEffect } from 'react';
import {
  Layout,
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Space,
  Button,
  Alert,
  Spin
} from 'antd';
import {
  UserOutlined,
  BookOutlined,
  CalendarOutlined,
  TrophyOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../config/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { getSchoolCode } from '../utils/metadata';
import { Page, EnhancedCard, designTokens } from '../ui';
import EmptyState from '../ui/EmptyState';

const { Content } = Layout;
const { Title, Text } = Typography;

const Dashboard = () => {
  const { user } = useAuth();
  const { antdTheme } = useTheme();
  const navigate = useNavigate();

  // Fallback theme values in case antdTheme is undefined
  const theme = antdTheme || {
    token: {
      marginLG: 24,
      colorText: '#000000',
      colorTextSecondary: '#666666',
      colorPrimary: '#1890ff',
      colorBorder: '#d9d9d9',
      boxShadowSecondary: '0 2px 8px rgba(0,0,0,0.1)',
      borderRadiusLG: 8,
      colorBgContainer: '#ffffff'
    }
  };
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalClasses: 0,
    totalExams: 0,
    totalAssignments: 0
  });
  const [error, setError] = useState(null);

  const userName = user?.user_metadata?.full_name || 'User';
  const role = user?.app_metadata?.role || user?.user_metadata?.role || 'user';

  // Fetch data based on user role
  useEffect(() => {
    fetchDashboardData();
  }, [role]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (role === 'superadmin') {
        // Super Admin can see their school data
        await fetchSchoolSpecificData();
      } else {
        // Other roles see basic stats
        await fetchBasicStats();
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchoolSpecificData = async () => {
    // Use centralized metadata utility
    const schoolCode = getSchoolCode(user);
    if (!schoolCode) return;

    try {
      // Get students and classes for this school
      const [studentsResult, classesResult] = await Promise.all([
        supabase.from('student').select('id', { count: 'exact', head: true }).eq('school_code', schoolCode),
        supabase.from('class_instances').select('id', { count: 'exact', head: true }).eq('school_code', schoolCode)
      ]);

      setStats(prev => ({
        ...prev,
        totalStudents: studentsResult.count || 0,
        totalClasses: classesResult.count || 0
      }));
    } catch (err) {
      console.error('Error fetching school specific data:', err);
      throw err;
    }
  };

  const fetchBasicStats = async () => {
    try {
      // Get basic stats for other roles
      const [studentsResult, classesResult] = await Promise.all([
        supabase.from('student').select('id', { count: 'exact', head: true }),
        supabase.from('class_instances').select('id', { count: 'exact', head: true })
      ]);

      setStats(prev => ({
        ...prev,
        totalStudents: studentsResult.count || 0,
        totalClasses: classesResult.count || 0
      }));
    } catch (err) {
      console.error('Error fetching basic stats:', err);
      throw err;
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

  const getWelcomeMessage = (role) => {
    const messages = {
      'cb_admin': 'Manage schools and administrators across the platform',
      'superadmin': 'Set up and manage your school system',
      'admin': 'Manage classes, students, and daily operations',
      'student': 'Track your progress and stay updated with your classes'
    };
    return messages[role] || 'Welcome to ClassBridge';
  };

  const getQuickActions = (role) => {
    const actions = {
      'cb_admin': [
        { label: 'Manage Schools', path: '/cb-admin-dashboard', icon: <UserOutlined /> },
        { label: 'Add School', path: '/add-schools', icon: <UserOutlined /> },
        { label: 'Add Super Admin', path: '/add-super-admin', icon: <UserOutlined /> }
      ],
      'superadmin': [
        { label: 'School Setup', path: '/school-setup', icon: <BookOutlined /> },
        { label: 'Manage Students', path: '/add-student', icon: <UserOutlined /> },
        { label: 'Manage Classes', path: '/add-specific-class', icon: <BookOutlined /> }
      ],
      'admin': [
        { label: 'Manage Students', path: '/add-student', icon: <UserOutlined /> },
        { label: 'Timetable', path: '/timetable', icon: <CalendarOutlined /> },
        { label: 'Fees', path: '/fees', icon: <TrophyOutlined /> }
      ],
      'student': [
        { label: 'Take Tests', path: '/take-tests', icon: <BookOutlined /> },
        { label: 'Learning Resources', path: '/learning-resources', icon: <BookOutlined /> },
        { label: 'Attendance', path: '/attendance', icon: <CalendarOutlined /> }
      ]
    };
    const userActions = actions[role] || [];
    console.log('Dashboard - User role:', role, 'Available actions:', userActions);
    return userActions;
  };

  const handleActionClick = (path) => {
    console.log('Dashboard - Action clicked, navigating to:', path);
    navigate(path);
  };

  return (
    <Page
      title="Dashboard"
      subtitle={`Welcome back, ${userName}! ${getWelcomeMessage(role)}`}
      extra={
        <Space>
          <Text type="secondary">Role: </Text>
          <Text strong style={{ color: theme.token.colorPrimary }}>
            {getRoleDisplay(role)}
          </Text>
        </Space>
      }
      loading={loading}
      error={!!error}
      errorMessage={error}
      onRetry={fetchDashboardData}
    >

      {/* Enhanced Statistics Cards */}
      <Row gutter={[designTokens.spacing.lg, designTokens.spacing.lg]} style={{ marginBottom: designTokens.spacing.xxl }}>
        <Col xs={24} sm={12} lg={6}>
          <EnhancedCard
            size="default"
            style={{ height: '100%', textAlign: 'center' }}
          >
            <div style={{ padding: `${designTokens.spacing.xl}px 0` }}>
              <div style={{ 
                fontSize: '48px', 
                color: designTokens.colors.status.success.primary, 
                marginBottom: designTokens.spacing.lg 
              }}>
                <UserOutlined />
              </div>
              <Statistic
                title="Students"
                value={stats.totalStudents}
                valueStyle={{ 
                  color: designTokens.colors.status.success.primary,
                  fontSize: '28px',
                  fontWeight: 600
                }}
                titleStyle={{ 
                  color: theme.token.colorTextSecondary, 
                  fontWeight: 500,
                  fontSize: '14px'
                }}
              />
            </div>
          </EnhancedCard>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <EnhancedCard
            size="default"
            style={{ height: '100%', textAlign: 'center' }}
          >
            <div style={{ padding: `${designTokens.spacing.xl}px 0` }}>
              <div style={{ 
                fontSize: '48px', 
                color: designTokens.colors.primary, 
                marginBottom: designTokens.spacing.lg 
              }}>
                <BookOutlined />
              </div>
              <Statistic
                title="Classes"
                value={stats.totalClasses}
                valueStyle={{ 
                  color: designTokens.colors.primary,
                  fontSize: '28px',
                  fontWeight: 600
                }}
                titleStyle={{ 
                  color: theme.token.colorTextSecondary, 
                  fontWeight: 500,
                  fontSize: '14px'
                }}
              />
            </div>
          </EnhancedCard>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <EnhancedCard
            size="default"
            style={{ height: '100%', textAlign: 'center' }}
          >
            <div style={{ padding: `${designTokens.spacing.xl}px 0` }}>
              <div style={{ 
                fontSize: '48px', 
                color: designTokens.colors.status.warning.primary, 
                marginBottom: designTokens.spacing.lg 
              }}>
                <CalendarOutlined />
              </div>
              <Statistic
                title="Exams"
                value={stats.totalExams}
                valueStyle={{ 
                  color: designTokens.colors.status.warning.primary,
                  fontSize: '28px',
                  fontWeight: 600
                }}
                titleStyle={{ 
                  color: theme.token.colorTextSecondary, 
                  fontWeight: 500,
                  fontSize: '14px'
                }}
              />
            </div>
          </EnhancedCard>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <EnhancedCard
            size="default"
            style={{ height: '100%', textAlign: 'center' }}
          >
            <div style={{ padding: `${designTokens.spacing.xl}px 0` }}>
              <div style={{ 
                fontSize: '48px', 
                color: designTokens.colors.accent, 
                marginBottom: designTokens.spacing.lg 
              }}>
                <TrophyOutlined />
              </div>
              <Statistic
                title="Assignments"
                value={stats.totalAssignments}
                valueStyle={{ 
                  color: designTokens.colors.accent,
                  fontSize: '28px',
                  fontWeight: 600
                }}
                titleStyle={{ 
                  color: theme.token.colorTextSecondary, 
                  fontWeight: 500,
                  fontSize: '14px'
                }}
              />
            </div>
          </EnhancedCard>
        </Col>
      </Row>

      {/* Empty State for New Users */}
      {!loading && stats.totalStudents === 0 && stats.totalClasses === 0 && (
        <EnhancedCard>
          <EmptyState
            type="analytics"
            onSecondaryAction={() => navigate('/students')}
          />
        </EnhancedCard>
      )}

      {/* Enhanced Quick Actions */}
      <EnhancedCard
        title="Quick Actions"
        subtitle="Access frequently used features and tools"
      >
        <Row gutter={[designTokens.spacing.lg, designTokens.spacing.lg]}>
          {getQuickActions(role).map((action, index) => (
            <Col key={index} xs={24} sm={12} md={8} lg={6}>
              <Button
                type="default"
                size="large"
                icon={action.icon}
                onClick={() => handleActionClick(action.path)}
                style={{ 
                  width: '100%',
                  height: '64px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: designTokens.spacing.xs,
                  borderRadius: designTokens.radius.md,
                  border: `1px solid ${theme.token.colorBorder}`,
                  background: theme.token.colorBgContainer,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = theme.token.colorPrimary;
                  e.target.style.color = theme.token.colorPrimary;
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = theme.token.colorBorder;
                  e.target.style.color = theme.token.colorText;
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 500 }}>{action.label}</span>
              </Button>
            </Col>
          ))}
          <Col xs={24} sm={12} md={8} lg={6}>
            <Button
              type="default"
              size="large"
              icon={<ReloadOutlined />}
              onClick={fetchDashboardData}
              loading={loading}
              style={{ 
                width: '100%',
                height: '64px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: designTokens.spacing.xs,
                borderRadius: designTokens.radius.md,
                border: `1px solid ${theme.token.colorBorder}`,
                background: theme.token.colorBgContainer,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.target.style.borderColor = theme.token.colorPrimary;
                e.target.style.color = theme.token.colorPrimary;
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = theme.token.colorBorder;
                e.target.style.color = theme.token.colorText;
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 500 }}>Refresh</span>
            </Button>
          </Col>
        </Row>
      </EnhancedCard>
    </Page>
  );
};

export default Dashboard;