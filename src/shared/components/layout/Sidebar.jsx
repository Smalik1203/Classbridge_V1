import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/AuthProvider';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/config/supabaseClient';
import { Menu, Avatar, Typography, Button, Tooltip, Tag } from 'antd';
import { Sparkles } from 'lucide-react';
import { radius } from '@/shared/ui/theme';
import {
  HomeOutlined,
  CalendarOutlined,
  TrophyOutlined,
  DollarOutlined,
  SettingOutlined,
  LogoutOutlined,
  BankOutlined,
  BarChartOutlined,
  BookOutlined,
  FileTextOutlined,
  UserOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  ExperimentOutlined,
  EditOutlined,
  BookOutlined as TaskBookOutlined,
  InboxOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  NotificationOutlined,
  MessageOutlined,
  CommentOutlined,
  UsergroupAddOutlined,
  AppstoreOutlined,
  DashboardOutlined,
  WarningOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

const AppSidebar = ({
  expanded,
  railWidth = 64,
  expandedWidth = 240,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme: antdTheme } = useTheme();

  const userName = user?.user_metadata?.full_name || 'User';
  const isCbAdmin = user?.user_metadata?.cb_admin_code || user?.app_metadata?.role === 'cb_admin';
  const userRole = user?.app_metadata?.role || (isCbAdmin ? 'cb_admin' : user?.user_metadata?.role) || 'user';

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
    }
  };

  const getMenuItems = () => {
    const allItems = [
      {
        key: '/cb-admin-dashboard',
        icon: <BankOutlined />,
        label: 'CB Admin Dashboard',
        roles: ['cb_admin'],
      },
      {
        key: '/add-schools',
        icon: <TeamOutlined />,
        label: 'Manage Schools',
        roles: ['cb_admin'],
      },
      {
        key: '/users',
        icon: <TeamOutlined />,
        label: 'Users',
        roles: ['cb_admin'],
      },

      {
        key: '/',
        icon: <HomeOutlined />,
        label: 'Dashboard',
        roles: ['cb_admin', 'superadmin', 'admin', 'student'],
      },
      {
        key: '/chatbot',
        icon: <Sparkles size={16} color="#3a8fcf" />,
        label: 'Ask Sage',
        roles: ['superadmin', 'admin', 'student'],
      },
      {
        key: '/ai-test-generator',
        icon: <ThunderboltOutlined />,
        label: 'AI Test Generator',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/academics/announcements',
        icon: <NotificationOutlined />,
        label: 'Announcements',
        roles: ['superadmin', 'admin', 'student'],
      },
      {
        key: '/calendar',
        icon: <CalendarOutlined />,
        label: 'Calendar',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/student/calendar',
        icon: <CalendarOutlined />,
        label: 'Calendar',
        roles: ['student'],
      },
      {
        key: '/timetable',
        icon: <ClockCircleOutlined />,
        label: 'Timetable',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/student/timetable',
        icon: <ClockCircleOutlined />,
        label: 'Timetable',
        roles: ['student'],
      },
      {
        key: '/academics/communication-hub',
        icon: <MessageOutlined />,
        label: 'Feedback',
        roles: ['superadmin', 'admin', 'student'],
      },

      {
        key: '/learning-resources',
        icon: <FileTextOutlined />,
        label: 'Resources',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/student/resources',
        icon: <FileTextOutlined />,
        label: 'Resources',
        roles: ['student'],
      },
      {
        key: '/syllabus',
        icon: <BookOutlined />,
        label: 'Syllabus',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/student/syllabus',
        icon: <BookOutlined />,
        label: 'Syllabus',
        roles: ['student'],
      },

      {
        key: '/attendance',
        icon: <CalendarOutlined />,
        label: 'Attendance',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/student/attendance',
        icon: <CalendarOutlined />,
        label: 'Attendance',
        roles: ['student'],
      },
      {
        key: '/test-management',
        icon: <EditOutlined />,
        label: 'Assessments',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/take-tests',
        icon: <EditOutlined />,
        label: 'Assessments',
        roles: ['student'],
      },
      {
        key: '/student/results',
        icon: <TrophyOutlined />,
        label: 'My Results',
        roles: ['student'],
      },
      {
        key: '/analytics',
        icon: <BarChartOutlined />,
        label: 'Analytics',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/student/analytics',
        icon: <BarChartOutlined />,
        label: 'My Analytics',
        roles: ['student'],
      },
      {
        key: '/task-management',
        icon: <TaskBookOutlined />,
        label: 'Tasks',
        roles: ['superadmin', 'admin', 'student'],
      },

      {
        key: '/fees',
        icon: <DollarOutlined />,
        label: 'Fees',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/fees',
        icon: <DollarOutlined />,
        label: 'My Fees',
        roles: ['student'],
      },
      {
        key: '/finance',
        icon: <DashboardOutlined />,
        label: 'Finance Hub',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/finance/transactions',
        icon: <FileTextOutlined />,
        label: 'Transactions',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/finance/accounts',
        icon: <BankOutlined />,
        label: 'Accounts & Categories',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/finance/reports',
        icon: <BarChartOutlined />,
        label: 'Reports',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/finance/inconsistencies',
        icon: <WarningOutlined />,
        label: 'Inconsistencies',
        roles: ['superadmin'],
      },

      {
        key: '/hr',
        icon: <DashboardOutlined />,
        label: 'HR Dashboard',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/hr/staff',
        icon: <TeamOutlined />,
        label: 'Staff',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/hr/payroll',
        icon: <DollarOutlined />,
        label: 'Payroll',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/hr/leaves',
        icon: <CalendarOutlined />,
        label: 'Leaves',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/hr/attendance',
        icon: <CalendarOutlined />,
        label: 'Staff Attendance',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/hr/salary-components',
        icon: <DollarOutlined />,
        label: 'Salary Components',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/hr/my',
        icon: <UserOutlined />,
        label: 'My HR',
        roles: ['superadmin', 'admin', 'student'],
      },

      {
        key: '/school-setup',
        icon: <SettingOutlined />,
        label: 'School Setup',
        roles: ['superadmin'],
      },
      {
        key: '/users',
        icon: <TeamOutlined />,
        label: 'Users',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/add-specific-class',
        icon: <AppstoreOutlined />,
        label: 'Classes',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/add-subjects',
        icon: <ExperimentOutlined />,
        label: 'Subjects',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/manage/inventory',
        icon: <InboxOutlined />,
        label: 'Inventory',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/manage/admissions',
        icon: <UsergroupAddOutlined />,
        label: 'Admissions',
        roles: ['superadmin', 'admin'],
      },
      {
        key: '/academics/report-comments',
        icon: <CommentOutlined />,
        label: 'Report Comments',
        roles: ['superadmin', 'admin'],
      },
    ];

    const visible = allItems.filter((item) => item.roles.includes(userRole));

    const SECTIONS = [
      { name: null,           startKey: '/cb-admin-dashboard' },
      { name: 'Main',         startKey: '/' },
      { name: 'Learning',     startKey: '/learning-resources' },
      { name: 'Academic',     startKey: '/attendance' },
      { name: 'Finance',      startKey: '/fees' },
      { name: 'HR',           startKey: '/hr' },
      { name: 'Admin',        startKey: '/school-setup' },
    ];

    const out = [];
    let currentSectionIdx = -1;
    let currentGroupChildren = null;

    const flushGroup = () => {
      if (currentGroupChildren && currentGroupChildren.length > 0) {
        const section = SECTIONS[currentSectionIdx];
        if (section.name) {
          out.push({
            type: 'group',
            key: `section-${section.name}`,
            label: section.name,
            children: currentGroupChildren,
          });
        } else {
          out.push(...currentGroupChildren);
        }
      }
      currentGroupChildren = [];
    };

    for (const item of visible) {
      const matchedIdx = SECTIONS.findIndex((s) => s.startKey === item.key);
      if (matchedIdx !== -1) {
        flushGroup();
        currentSectionIdx = matchedIdx;
      }
      if (currentSectionIdx === -1) continue;
      currentGroupChildren.push({
        key: item.key,
        icon: item.icon,
        label: item.label,
        onClick: () => navigate(item.key),
      });
    }
    flushGroup();

    return out.filter((g) => g.type !== 'group' || (g.children && g.children.length > 0));
  };

  const initials = (userName.trim()[0] || 'U').toUpperCase();
  const roleLabel = userRole === 'superadmin' ? 'Super Admin' : userRole === 'admin' ? 'Admin' : userRole;
  const roleTagStyle = {
    textTransform: 'capitalize',
    fontWeight: 500,
    borderRadius: 4,
    padding: '0 4px',
    fontSize: 10,
    lineHeight: '14px',
    margin: 0,
    alignSelf: 'flex-start',
    background: '#e0f2fe',
    color: '#0369a1',
    border: '1px solid #bae6fd',
  };
  const avatarBg = '#3a8fcf';
  const avatarFontStyle = {
    background: avatarBg,
    color: '#ffffff',
    fontWeight: 700,
    fontFamily: 'Geist Sans, sans-serif',
    letterSpacing: '0.5px',
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        left: 12,
        bottom: 12,
        width: expanded ? expandedWidth : railWidth,
        background: antdTheme.token.colorBgContainer,
        border: `1px solid ${antdTheme.token.colorBorder}`,
        borderRadius: radius.xl,
        overflowY: 'auto',
        overflowX: 'hidden',
        zIndex: 100,
        transition: 'width 0.18s ease',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header: avatar + name (expanded) or just avatar (collapsed). */}
      <div style={{
        padding: expanded ? '16px' : '12px 8px',
        borderBottom: `1px solid ${antdTheme.token.colorBorder}`,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        background: antdTheme.token.colorBgContainer,
      }}>
        {expanded ? (
          <>
            <Avatar size={40} style={{ ...avatarFontStyle, fontSize: 15, flexShrink: 0 }}>{initials}</Avatar>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
              <Text strong style={{
                fontSize: 14,
                fontWeight: 600,
                color: antdTheme.token.colorText,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {userName}
              </Text>
              <Tag color="blue" style={roleTagStyle}>{roleLabel}</Tag>
            </div>
          </>
        ) : (
          <Tooltip
            title={
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: 4, fontWeight: 600 }}>{userName}</div>
                <Tag color="blue" style={roleTagStyle}>{roleLabel}</Tag>
              </div>
            }
            placement="right"
          >
            <Avatar size={32} style={{ ...avatarFontStyle, fontSize: 12 }}>{initials}</Avatar>
          </Tooltip>
        )}
      </div>

      {/* Navigation menu — Menu's `inlineCollapsed` trims to icons-only in rail mode and
          shows tooltips on hover. */}
      <div className="sidebar-scroll" style={{
        flex: '1 1 auto',
        minHeight: 0,
        background: antdTheme.token.colorBgContainer,
        padding: '8px 0',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}>
        <Menu
          mode="inline"
          inlineCollapsed={!expanded}
          selectedKeys={[location.pathname]}
          items={getMenuItems()}
          style={{ border: 'none', background: antdTheme.token.colorBgContainer }}
          theme="light"
        />
      </div>

      {/* Sign out */}
      <div style={{
        padding: expanded ? antdTheme.token.padding : '8px',
        borderTop: `1px solid ${antdTheme.token.colorBorder}`,
        background: antdTheme.token.colorBgContainer,
        flexShrink: 0,
      }}>
        <Tooltip title="Sign Out" placement="right">
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            style={{
              width: '100%',
              height: expanded ? 36 : 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: expanded ? 'flex-start' : 'center',
              color: antdTheme.token.colorError,
              fontWeight: 500,
              background: 'transparent',
              border: 'none',
            }}
          >
            {expanded && 'Sign Out'}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
};

export default AppSidebar;
