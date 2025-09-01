import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../config/supabaseClient';
import { Layout, Menu, Avatar, Typography, Button, Dropdown, Space, Switch } from 'antd';
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
  UserOutlined,
  BookOutlined,
  TeamOutlined
} from '@ant-design/icons';

const { Sider } = Layout;
const { Text } = Typography;

const AppSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDarkMode, toggleTheme, theme: antdTheme } = useTheme();

  const userName = user?.user_metadata?.full_name || 'User';
  const userRole = user?.app_metadata?.role || 'user';

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const getMenuItems = () => {
    const allItems = [
      {
        key: '/',
        icon: <HomeOutlined />,
        label: 'Home',
        roles: ['cb_admin', 'superadmin', 'admin', 'teacher', 'student']
      },
      {
        key: '/add-schools',
        icon: <BankOutlined />,
        label: 'Manage Schools',
        roles: ['cb_admin']
      },
      {
        key: '/add-super-admin',
        icon: <BankOutlined />,
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
        roles: ['superadmin', 'admin', 'teacher', 'student']
      },
      {
        key: '/analytics',
        icon: <BarChartOutlined />,
        label: 'Analytics',
        roles: ['superadmin', 'admin']
      },
      {
        key: '/results',
        icon: <TrophyOutlined />,
        label: 'Results',
        roles: ['superadmin', 'admin', 'teacher', 'student']
      },
      {
        key: '/fees',
        icon: <DollarOutlined />,
        label: 'Fees',
        roles: ['superadmin', 'admin', 'student']
      },
      {
        key: '/add-subjects',
        icon: <DollarOutlined />,
        label: 'Subjects',
        roles: ['superadmin', 'admin']
      },
      {
        key: '/timetable',
        icon: <DollarOutlined />,
        label: 'Timetable',
        roles: ['superadmin', 'admin', 'student']
      },
      {
        key: '/syllabus',
        icon: <DollarOutlined />,
        label: 'Syllabus',
        roles: ['superadmin', 'admin']
      }
    ];

    return allItems
      .filter(item => item.roles.includes(userRole))
      .map(item => ({
        key: item.key,
        icon: item.icon,
        label: item.label,
        onClick: () => navigate(item.key)
      }));
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
        padding: antdTheme.token.paddingLG,
        borderBottom: `1px solid ${antdTheme.token.colorBorder}`,
        height: '80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        background: antdTheme.token.colorBgContainer
      }}>
        <div>
          <Text strong style={{ fontSize: '20px', color: antdTheme.token.colorPrimary, fontWeight: 700 }}>
            ClassBridge
          </Text>
          <br />
          <Text style={{ fontSize: '12px', color: antdTheme.token.colorTextSecondary, fontWeight: 500 }}>
            Education Management
          </Text>
        </div>
      </div>

      {/* User Profile Section */}
      <div style={{ 
        padding: antdTheme.token.paddingLG,
        borderBottom: `1px solid ${antdTheme.token.colorBorder}`,
        background: antdTheme.token.colorBgContainer
      }}>
        <Dropdown menu={{ items: userMenuItems }} placement="topRight" trigger={['click']}>
          <div style={{ cursor: 'pointer' }}>
            <Space align="center">
              <Avatar 
                size={44} 
                style={{ 
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  fontWeight: 600,
                  fontSize: '16px'
                }}
              >
                {userName.split(' ').map(n => n[0]).join('').toUpperCase()}
              </Avatar>
              <div>
                <Text strong style={{ display: 'block', fontSize: '15px', color: antdTheme.token.colorText, fontWeight: 600 }}>
                  {userName}
                </Text>
              </div>
            </Space>
          </div>
        </Dropdown>
      </div>

      {/* Navigation Menu */}
      <div style={{ 
        flex: 1, 
        background: antdTheme.token.colorBgContainer,
        padding: '8px 0'
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
        padding: antdTheme.token.padding,
        borderTop: `1px solid ${antdTheme.token.colorBorder}`,
        background: antdTheme.token.colorBgContainer,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: antdTheme.token.marginXS }}>
          {isDarkMode ? (
            <BulbFilled style={{ color: '#fbbf24', fontSize: '16px' }} />
          ) : (
            <BulbOutlined style={{ color: antdTheme.token.colorTextSecondary, fontSize: '16px' }} />
          )}
          <Text style={{ 
            fontSize: antdTheme.token.fontSizeSM, 
            color: antdTheme.token.colorTextSecondary,
            fontWeight: 500
          }}>
            {isDarkMode ? 'Dark' : 'Light'} Mode
          </Text>
        </div>
        <Switch
          checked={isDarkMode}
          onChange={toggleTheme}
          size="small"
        />
      </div>

      {/* Bottom Section with Logout */}
      <div style={{
        padding: antdTheme.token.padding,
        borderTop: `1px solid ${antdTheme.token.colorBorder}`,
        background: antdTheme.token.colorBgContainer
      }}>
        <Button
          type="text"
          icon={<LogoutOutlined />}
          onClick={handleLogout}
          style={{ 
            width: '100%',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            color: antdTheme.token.colorError,
            fontWeight: 500,
            background: 'transparent',
            border: 'none'
          }}
        >
          Sign Out
        </Button>
      </div>
    </Sider>
  );
};

export default AppSidebar;