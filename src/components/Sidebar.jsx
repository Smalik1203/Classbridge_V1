import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../config/supabaseClient';
import { Layout, Menu, Avatar, Typography, Button, Dropdown, Space, Switch, Tooltip, Tag } from 'antd';
import {
  HomeOutlined,
  CalendarOutlined,
  TrophyOutlined,
  DollarOutlined,
  SettingOutlined,
  LogoutOutlined,
  BankOutlined,
  BarChartOutlined,
  BulbOutlined,
  BulbFilled,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BookOutlined,
  FileTextOutlined,
  QuestionCircleOutlined,
  UserOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  ExperimentOutlined,
  PlusOutlined,
  EditOutlined
} from '@ant-design/icons';

const { Sider } = Layout;
const { Text } = Typography;

const AppSidebar = ({ collapsed, onCollapse }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDarkMode, toggleTheme, theme: antdTheme } = useTheme();

  const userName = user?.user_metadata?.full_name || 'User';
  // Check for cb_admin_code in user_metadata to determine if user is cb_admin
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
        key: '/',
        icon: <HomeOutlined />,
        label: 'Home',
        roles: ['cb_admin', 'superadmin', 'admin']
      },
      {
        key: '/cb-admin-dashboard',
        icon: <BankOutlined />,
        label: 'CB Admin Dashboard',
        roles: ['cb_admin']
      },
      {
        key: '/add-schools',
        icon: <TeamOutlined />,
        label: 'Manage Schools',
        roles: ['cb_admin']
      },
      {
        key: '/add-super-admin',
        icon: <UserOutlined />,
        label: 'Super Admin',
        roles: ['cb_admin']
      },
      {
        key: '/school-setup',
        icon: <SettingOutlined />,
        label: 'School Setup',
        roles: ['superadmin']
      },
      {
        key: '/attendance',
        icon: <CalendarOutlined />,
        label: 'Attendance',
        roles: ['superadmin', 'admin']
      },
      {
        key: '/analytics',
        icon: <BarChartOutlined />,
        label: 'Analytics',
        roles: ['superadmin', 'admin', 'student']
      },
      {
        key: '/fees',
        icon: <DollarOutlined />,
        label: 'Fees',
        roles: ['superadmin', 'admin']
      },
      {
        key: '/add-subjects',
        icon: <ExperimentOutlined />,
        label: 'Subjects',
        roles: ['superadmin', 'admin']
      },
      {
        key: '/timetable',
        icon: <ClockCircleOutlined />,
        label: 'Timetable',
        roles: ['superadmin', 'admin']
      },
      {
        key: '/calendar',
        icon: <CalendarOutlined />,
        label: 'Calendar',
        roles: ['superadmin', 'admin']
      },
      {
        key: '/syllabus',
        icon: <BookOutlined />,
        label: 'Syllabus',
        roles: ['superadmin', 'admin']
      },
      {
        key: '/learning-resources',
        icon: <FileTextOutlined />,
        label: 'Learning Resources',
        roles: ['superadmin', 'admin']
      },
      {
        key: '/test-management',
        icon: <EditOutlined />,
        label: 'Test Management',
        roles: ['superadmin', 'admin']
      },
    ];

    const processItem = (item) => {
      const baseItem = {
        key: item.key,
        icon: item.icon,
        label: item.label
      };

      if (item.children) {
        // Handle submenu items
        const filteredChildren = item.children
          .filter(child => child.roles.includes(userRole))
          .map(child => ({
            key: child.key,
            icon: child.icon,
            label: child.label,
            onClick: () => navigate(child.key)
          }));
        
        if (filteredChildren.length > 0) {
          return {
            ...baseItem,
            children: filteredChildren
          };
        }
        return null;
      } else {
        // Handle regular menu items
        return {
          ...baseItem,
          onClick: () => navigate(item.key)
        };
      }
    };

    return allItems
      .filter(item => item.roles.includes(userRole))
      .map(processItem)
      .filter(Boolean);
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <SettingOutlined />,
      label: 'Profile'
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sign Out',
      onClick: handleLogout
    }
  ];

  return (
    <Sider
      width={280}
      collapsed={collapsed}
      collapsedWidth={48}
      style={{
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        background: antdTheme.token.colorBgContainer,
        borderRight: `1px solid ${antdTheme.token.colorBorder}`,
        boxShadow: antdTheme.token.boxShadowSecondary
      }}
    >
      {/* Logo Section */}
      <div style={{ 
        padding: collapsed ? '12px 8px' : antdTheme.token.paddingLG,
        borderBottom: `1px solid ${antdTheme.token.colorBorder}`,
        height: collapsed ? '60px' : '80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        background: antdTheme.token.colorBgContainer
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Avatar
              size={40}
              style={{
                background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                fontWeight: 700,
                fontSize: '15px',
                fontFamily: 'Geist Sans, sans-serif',
                textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                letterSpacing: '0.5px'
              }}
            >
              {userName.split(' ').map(n => n[0]).join('').toUpperCase()}
            </Avatar>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <Text strong style={{
                fontSize: '18px',
                color: antdTheme.token.colorPrimary,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                {userName}
              </Text>
              <Tag
                color="blue"
                style={{
                  textTransform: 'capitalize',
                  fontWeight: 500,
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  margin: '0px',
                  background: '#e0f2fe',
                  color: '#0369a1',
                  border: '1px solid #bae6fd'
                }}
              >
                {userRole === 'superadmin' ? 'Super Admin' : userRole === 'admin' ? 'Admin' : userRole}
              </Tag>
            </div>
          </div>
        )}
        {collapsed && (
          <Tooltip 
            title={
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: '4px', fontWeight: 600 }}>{userName}</div>
                <Tag
                  color="blue"
                  style={{
                    textTransform: 'capitalize',
                    fontWeight: 500,
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    margin: '0px',
                    background: '#e0f2fe',
                    color: '#0369a1',
                    border: '1px solid #bae6fd'
                  }}
                >
                  {userRole === 'superadmin' ? 'Super Admin' : userRole === 'admin' ? 'Admin' : userRole}
                </Tag>
              </div>
            } 
            placement="right"
          >
            <Avatar
              size={32}
              style={{
                background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                fontWeight: 700,
                fontSize: '12px',
                fontFamily: 'Geist Sans, sans-serif',
                textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                letterSpacing: '0.5px'
              }}
            >
              {userName.split(' ').map(n => n[0]).join('').toUpperCase()}
            </Avatar>
          </Tooltip>
        )}
        <Tooltip title={collapsed ? "Expand sidebar" : "Collapse sidebar"} placement="right">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => onCollapse(!collapsed)}
            style={{
              color: antdTheme.token.colorTextSecondary,
              border: 'none',
              background: 'transparent',
              padding: collapsed ? '4px' : '8px'
            }}
          />
        </Tooltip>
      </div>


      {/* Navigation Menu */}
      <div style={{ 
        flex: 1, 
        background: antdTheme.token.colorBgContainer,
        padding: '8px 0',
        overflow: 'auto',
        maxHeight: 'calc(100vh - 200px)' // Account for header, theme toggle, and logout sections
      }}>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={getMenuItems()}
          style={{ 
            border: 'none',
            background: antdTheme.token.colorBgContainer
          }}
          theme={isDarkMode ? 'dark' : 'light'}
        />
      </div>

      {/* Theme Toggle Section */}
      <div style={{
        padding: collapsed ? '8px' : antdTheme.token.padding,
        borderTop: `1px solid ${antdTheme.token.colorBorder}`,
        background: antdTheme.token.colorBgContainer,
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between'
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: antdTheme.token.marginXS }}>
            {isDarkMode ? (
              <BulbFilled style={{ color: '#fbbf24', fontSize: '14px' }} />
            ) : (
              <BulbOutlined style={{ color: antdTheme.token.colorTextSecondary, fontSize: '14px' }} />
            )}
            <Text style={{ 
              fontSize: antdTheme.token.fontSizeSM, 
              color: antdTheme.token.colorTextSecondary,
              fontWeight: 500
            }}>
              {isDarkMode ? 'Dark' : 'Light'} Mode
            </Text>
          </div>
        )}
        <Tooltip title={`Switch to ${isDarkMode ? 'Light' : 'Dark'} mode`} placement="right">
          <Switch
            checked={isDarkMode}
            onChange={toggleTheme}
            size="small"
          />
        </Tooltip>
      </div>

      {/* Bottom Section with Logout */}
      <div style={{
        padding: collapsed ? '8px' : antdTheme.token.padding,
        borderTop: `1px solid ${antdTheme.token.colorBorder}`,
        background: antdTheme.token.colorBgContainer
      }}>
        <Tooltip title="Sign Out" placement="right">
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            style={{ 
              width: '100%',
              height: collapsed ? '32px' : '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              color: antdTheme.token.colorError,
              fontWeight: 500,
              background: 'transparent',
              border: 'none'
            }}
          >
            {!collapsed && 'Sign Out'}
          </Button>
        </Tooltip>
      </div>
    </Sider>
  );
};

export default AppSidebar;