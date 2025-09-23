import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Typography, Space, Button, Tooltip } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  DashboardOutlined,
  UserAddOutlined,
  TeamOutlined,
  BookOutlined,
  CalendarOutlined,
  FileTextOutlined,
  TrophyOutlined,
  DollarOutlined,
  BarChartOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BankOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import { supabase } from '../config/supabaseClient';
import { getUserRole, isRoleAllowed } from '../routeAccess';
import { useTheme } from '../contexts/ThemeContext';

const { Sider } = Layout;
const { Text } = Typography;

const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme: antdTheme, isDarkMode, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  const role = getUserRole(user);
  const userName = user?.user_metadata?.full_name || user?.email || 'User';
  const schoolName = user?.user_metadata?.school_name || '';

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getMenuItems = () => {
    const baseItems = [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: <Link to="/dashboard">Dashboard</Link>,
        roles: ['cb_admin', 'superadmin', 'admin', 'student']
      }
    ];

    const roleBasedItems = [
      // CB Admin only
      {
        key: 'cb-admin-section',
        type: 'group',
        label: 'Platform Management',
        roles: ['cb_admin'],
        children: [
          {
            key: '/add-schools',
            icon: <BankOutlined />,
            label: <Link to="/add-schools">Add Schools</Link>,
            roles: ['cb_admin']
          }
        ]
      },
      // Superadmin only
      {
        key: 'school-setup',
        type: 'group',
        label: 'School Setup',
        roles: ['superadmin'],
        children: [
          {
            key: '/setup-school',
            icon: <SettingOutlined />,
            label: <Link to="/setup-school">School Setup</Link>,
            roles: ['superadmin']
          },
          {
            key: '/add-admin',
            icon: <UserAddOutlined />,
            label: <Link to="/add-admin">Add Admin</Link>,
            roles: ['superadmin']
          },
          {
            key: '/add-specific-class',
            icon: <BookOutlined />,
            label: <Link to="/add-specific-class">Add Class</Link>,
            roles: ['superadmin']
          }
        ]
      },
      // Admin and Superadmin
      {
        key: 'student-management',
        type: 'group',
        label: 'Student Management',
        roles: ['superadmin', 'admin'],
        children: [
          {
            key: '/add-student',
            icon: <TeamOutlined />,
            label: <Link to="/add-student">Add Student</Link>,
            roles: ['superadmin', 'admin']
          }
        ]
      },
      // Academic Management
      {
        key: 'academic',
        type: 'group',
        label: 'Academic',
        roles: ['superadmin', 'admin', 'student'],
        children: [
          {
            key: '/add-subjects',
            icon: <BookOutlined />,
            label: <Link to="/add-subjects">Subjects</Link>,
            roles: ['superadmin', 'admin']
          },
          {
            key: '/syllabus',
            icon: <FileTextOutlined />,
            label: <Link to="/syllabus">Syllabus</Link>,
            roles: ['superadmin', 'admin', 'student']
          },
          {
            key: '/timetable',
            icon: <CalendarOutlined />,
            label: <Link to="/timetable">Timetable</Link>,
            roles: ['superadmin', 'admin', 'student']
          }
        ]
      },
      // Daily Operations
      {
        key: 'operations',
        type: 'group',
        label: 'Operations',
        roles: ['superadmin', 'admin', 'student'],
        children: [
          {
            key: '/attendance',
            icon: <CalendarOutlined />,
            label: <Link to="/attendance">Attendance</Link>,
            roles: ['superadmin', 'admin', 'student']
          },
          {
            key: '/tests',
            icon: <FileTextOutlined />,
            label: <Link to="/tests">Tests</Link>,
            roles: ['superadmin', 'admin', 'student']
          },
          {
            key: '/assessments',
            icon: <TrophyOutlined />,
            label: <Link to="/assessments">Assessments</Link>,
            roles: ['superadmin', 'admin', 'student']
          },
          {
            key: '/results',
            icon: <TrophyOutlined />,
            label: <Link to="/results">Results</Link>,
            roles: ['superadmin', 'admin', 'student']
          },
          {
            key: '/resources',
            icon: <FileTextOutlined />,
            label: <Link to="/resources">Resources</Link>,
            roles: ['superadmin', 'admin', 'student']
          }
        ]
      },
      // Financial Management
      {
        key: 'financial',
        type: 'group',
        label: 'Financial',
        roles: ['superadmin', 'admin', 'student'],
        children: [
          {
            key: '/fees',
            icon: <DollarOutlined />,
            label: <Link to="/fees">Fees</Link>,
            roles: ['superadmin', 'admin', 'student']
          }
        ]
      },
      // Analytics
      {
        key: 'analytics-section',
        type: 'group',
        label: 'Analytics',
        roles: ['superadmin', 'admin'],
        children: [
          {
            key: '/analytics',
            icon: <BarChartOutlined />,
            label: <Link to="/analytics">Analytics</Link>,
            roles: ['superadmin', 'admin']
          }
        ]
      }
    ];

    // Filter items based on user role
    const filterItems = (items) => {
      return items.filter(item => {
        if (item.roles && !item.roles.includes(role)) {
          return false;
        }
        if (item.children) {
          item.children = filterItems(item.children);
          return item.children.length > 0;
        }
        return true;
      });
    };

    return [...baseItems, ...filterItems(roleBasedItems)];
  };

  const menuItems = getMenuItems();

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      width={280}
      style={{
        background: antdTheme.token.colorBgContainer,
        borderRight: `1px solid ${antdTheme.token.colorBorderSecondary}`,
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 100
      }}
    >
      {/* Header */}
      <div style={{
        padding: collapsed ? '16px 8px' : '16px 24px',
        borderBottom: `1px solid ${antdTheme.token.colorBorderSecondary}`,
        background: antdTheme.token.colorBgContainer
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Avatar
              size={40}
              style={{
                backgroundColor: antdTheme.token.colorPrimary,
                color: 'white',
                fontWeight: 600,
                fontSize: '16px'
              }}
            >
              CB
            </Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text strong style={{ 
                fontSize: '18px', 
                color: antdTheme.token.colorText,
                fontWeight: 700,
                display: 'block',
                lineHeight: '24px'
              }}>
                ClassBridge
              </Text>
              <Text style={{ 
                fontSize: '12px', 
                color: antdTheme.token.colorTextSecondary,
                lineHeight: '16px'
              }}>
                Education Platform
              </Text>
            </div>
          </div>
        )}
        {collapsed && (
          <Tooltip title="ClassBridge" placement="right">
            <Text strong style={{ fontSize: '16px', color: antdTheme.token.colorPrimary, fontWeight: 700 }}>
              CB
            </Text>
          </Tooltip>
        )}
      </div>

      {/* User Info */}
      <div style={{
        padding: collapsed ? '12px 8px' : '16px 24px',
        borderBottom: `1px solid ${antdTheme.token.colorBorderSecondary}`,
        background: antdTheme.token.colorBgContainer
      }}>
        {!collapsed && (
          <div>
            <Text strong style={{ 
              fontSize: '14px', 
              color: antdTheme.token.colorText,
              display: 'block',
              marginBottom: '4px'
            }}>
              {userName}
            </Text>
            <Text style={{ 
              fontSize: '12px', 
              color: antdTheme.token.colorTextSecondary,
              display: 'block',
              marginBottom: schoolName ? '4px' : '0'
            }}>
              {role?.toUpperCase() || 'USER'}
            </Text>
            {schoolName && (
              <Text style={{ 
                fontSize: '11px', 
                color: antdTheme.token.colorTextTertiary,
                display: 'block'
              }}>
                {schoolName}
              </Text>
            )}
          </div>
        )}
        {collapsed && (
          <Tooltip title={`${userName} (${role?.toUpperCase()})`} placement="right">
            <Avatar
              size={32}
              style={{
                backgroundColor: antdTheme.token.colorPrimary,
                color: 'white',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              {userName.charAt(0).toUpperCase()}
            </Avatar>
          </Tooltip>
        )}
      </div>

      {/* Navigation Menu */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          style={{
            background: antdTheme.token.colorBgContainer,
            border: 'none',
            fontSize: '14px'
          }}
          items={menuItems}
        />
      </div>

      {/* Footer Actions */}
      <div style={{
        padding: collapsed ? '12px 8px' : '16px 24px',
        borderTop: `1px solid ${antdTheme.token.colorBorderSecondary}`,
        background: antdTheme.token.colorBgContainer
      }}>
        <Space direction={collapsed ? 'vertical' : 'horizontal'} style={{ width: '100%' }}>
          <Tooltip title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'} placement={collapsed ? 'right' : 'top'}>
            <Button
              type="text"
              onClick={toggleTheme}
              style={{
                color: antdTheme.token.colorTextSecondary,
                border: 'none',
                padding: collapsed ? '8px' : '8px 12px'
              }}
            >
              {isDarkMode ? '☀️' : '🌙'}
              {!collapsed && <span style={{ marginLeft: '8px' }}>Theme</span>}
            </Button>
          </Tooltip>
          
          <Tooltip title="Logout" placement={collapsed ? 'right' : 'top'}>
            <Button
              type="text"
              danger
              onClick={handleLogout}
              icon={<LogoutOutlined />}
              style={{
                color: antdTheme.token.colorError,
                border: 'none',
                padding: collapsed ? '8px' : '8px 12px'
              }}
            >
              {!collapsed && <span style={{ marginLeft: '8px' }}>Logout</span>}
            </Button>
          </Tooltip>
        </Space>
      </div>
    </Sider>
  );
};

export default Sidebar;