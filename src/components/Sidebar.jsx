import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../config/supabaseClient';
import { Layout, Menu, Avatar, Typography, Button, Dropdown, Space, Switch, Tooltip } from 'antd';
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
  QuestionCircleOutlined
} from '@ant-design/icons';

const { Sider } = Layout;
const { Text } = Typography;

const AppSidebar = ({ collapsed, onCollapse }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDarkMode, toggleTheme, theme: antdTheme } = useTheme();

  const userName = user?.user_metadata?.full_name || 'User';
  const userRole = user?.app_metadata?.role || 'user';
  const schoolName = user?.user_metadata?.school_name || '';

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const getNavigationGroups = () => {
    const allGroups = [
      {
        title: 'Overview',
        items: [
          { key: '/', label: 'Dashboard', icon: '🏠', roles: ['cb_admin', 'superadmin', 'admin', 'student'] }
        ]
      },
      {
        title: 'Platform',
        items: [
          { key: '/add-schools', label: 'Schools', icon: '🏢', roles: ['cb_admin'] },
          { key: '/add-super-admin', label: 'Super Admins', icon: '👑', roles: ['cb_admin'] }
        ]
      },
      {
        title: 'School Setup',
        items: [
          { key: '/school-setup', label: 'Setup Guide', icon: '🚀', roles: ['superadmin'] },
          { key: '/add-admin', label: 'Admins', icon: '👨‍💼', roles: ['superadmin'] },
          { key: '/add-student', label: 'Students', icon: '👨‍🎓', roles: ['superadmin', 'admin'] },
          { key: '/add-specific-class', label: 'Classes', icon: '🏫', roles: ['superadmin'] },
          { key: '/add-subjects', label: 'Subjects', icon: '📚', roles: ['superadmin', 'admin'] }
        ]
      },
      {
        title: 'Academics',
        items: [
          { key: '/timetable', label: 'Timetable', icon: '📅', roles: ['superadmin', 'admin', 'student'] },
          { key: '/syllabus', label: 'Syllabus', icon: '📖', roles: ['superadmin', 'admin', 'student'] },
          { key: '/learning-resources', label: 'Resources', icon: '🎥', roles: ['superadmin', 'admin', 'student'] },
          { key: '/attendance', label: 'Attendance', icon: '✅', roles: ['superadmin', 'admin', 'student'] }
        ]
      },
      {
        title: 'Assessment',
        items: [
          { key: '/test-management', label: 'Manage Tests', icon: '📝', roles: ['superadmin', 'admin'] },
          { key: '/take-tests', label: 'Take Tests', icon: '✏️', roles: ['student'] },
          { key: '/results', label: 'Results', icon: '🏆', roles: ['superadmin', 'admin', 'student'] },
          { key: '/assessments', label: 'Assessments', icon: '📊', roles: ['superadmin', 'admin', 'student'] }
        ]
      },
      {
        title: 'Finance',
        items: [
          { key: '/fees', label: 'Fees', icon: '💰', roles: ['superadmin', 'admin', 'student'] }
        ]
      },
      {
        title: 'Analytics',
        items: [
          { key: '/analytics', label: 'Analytics', icon: '📈', roles: ['superadmin', 'admin'] }
        ]
      }
    ];

    return allGroups
      .map(group => ({
        ...group,
        items: group.items.filter(item => item.roles.includes(userRole))
      }))
      .filter(group => group.items.length > 0);
  };

  const navigationGroups = getNavigationGroups();

  return (
    <div className={`cb-sidebar ${collapsed ? 'cb-sidebar-collapsed' : ''}`}>
      {/* Header */}
      <div className="cb-sidebar-header">
        {!collapsed ? (
          <div className="cb-sidebar-brand">
            <span style={{ fontSize: 'var(--text-2xl)' }}>🎓</span>
            <div>
              <div style={{ 
                fontSize: 'var(--text-xl)', 
                fontWeight: 'var(--font-bold)',
                color: 'var(--color-text-brand)',
                lineHeight: 'var(--leading-tight)'
              }}>
                ClassBridge
              </div>
              {schoolName && (
                <div style={{ 
                  fontSize: 'var(--text-xs)', 
                  color: 'var(--color-text-tertiary)',
                  fontWeight: 'var(--font-medium)',
                  marginTop: 'var(--space-1)'
                }}>
                  {schoolName}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="cb-sidebar-brand">
            <span style={{ fontSize: 'var(--text-xl)' }}>🎓</span>
          </div>
        )}
        
        <button 
          className="cb-button cb-button-ghost cb-button-sm"
          onClick={() => onCollapse(!collapsed)}
          style={{ 
            padding: 'var(--space-2)',
            borderRadius: 'var(--radius-lg)'
          }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* User Profile */}
      {!collapsed && (
        <div style={{ 
          padding: 'var(--space-4) var(--space-6)',
          borderBottom: '1px solid var(--color-border-subtle)'
        }}>
          <div className="cb-flex cb-items-center cb-gap-3">
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-xl)',
              background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-white)',
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--font-semibold)',
              boxShadow: 'var(--shadow-md)'
            }}>
              {userName.split(' ').map(n => n[0]).join('').toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ 
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--font-semibold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-1)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {userName}
              </div>
              <div className={`cb-role-indicator cb-role-${userRole}`}>
                {userRole.replace('_', ' ')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="cb-sidebar-nav">
        {navigationGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="cb-nav-group">
            {!collapsed && (
              <div className="cb-nav-group-title">
                {group.title}
              </div>
            )}
            
            {group.items.map((item) => (
              <a
                key={item.key}
                href={item.key}
                className={`cb-nav-item ${location.pathname === item.key ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(item.key);
                }}
                title={collapsed ? item.label : undefined}
              >
                <span className="cb-nav-icon">
                  {item.icon}
                </span>
                {!collapsed && (
                  <span>{item.label}</span>
                )}
              </a>
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="cb-sidebar-footer">
        {/* Theme Toggle */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: collapsed ? 'center' : 'space-between',
          marginBottom: 'var(--space-3)',
          padding: 'var(--space-2)',
          background: 'var(--color-surface-hover)',
          borderRadius: 'var(--radius-lg)'
        }}>
          {!collapsed && (
            <span style={{ 
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-secondary)',
              fontWeight: 'var(--font-medium)'
            }}>
              {isDarkMode ? '🌙 Dark Mode' : '☀️ Light Mode'}
            </span>
          )}
          <button
            className="cb-button cb-button-ghost cb-button-sm"
            onClick={toggleTheme}
            title={collapsed ? (isDarkMode ? 'Switch to Light' : 'Switch to Dark') : undefined}
            style={{ 
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-md)'
            }}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Logout */}
        <button
          className="cb-button cb-button-ghost"
          onClick={handleLogout}
          style={{ 
            width: '100%',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: 'var(--color-error-500)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-lg)'
          }}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <span>🚪</span>
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );
};

export default AppSidebar;
          <div>
            <Text strong style={{ fontSize: '20px', color: antdTheme.token.colorPrimary, fontWeight: 700 }}>
              ClassBridge
            </Text>
            <br />
            <Text style={{ fontSize: '12px', color: antdTheme.token.colorTextSecondary, fontWeight: 500 }}>
              Education Management
            </Text>
          </div>
        )}
        {collapsed && (
          <Tooltip title="ClassBridge" placement="right">
            <Text strong style={{ fontSize: '16px', color: antdTheme.token.colorPrimary, fontWeight: 700 }}>
              CB
            </Text>
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

      {/* User Profile Section */}
      <div style={{ 
        padding: collapsed ? '12px 8px' : antdTheme.token.paddingLG,
        borderBottom: `1px solid ${antdTheme.token.colorBorder}`,
        background: antdTheme.token.colorBgContainer
      }}>
        {!collapsed ? (
          <Dropdown menu={{ items: userMenuItems }} placement="topRight" trigger={['click']}>
            <div style={{ cursor: 'pointer' }}>
              <Space align="center">
                <Avatar 
                  size={36} 
                  style={{ 
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    fontWeight: 600,
                    fontSize: '14px'
                  }}
                >
                  {userName.split(' ').map(n => n[0]).join('').toUpperCase()}
                </Avatar>
                <div>
                  <Text strong style={{ display: 'block', fontSize: '14px', color: antdTheme.token.colorText, fontWeight: 600 }}>
                    {userName}
                  </Text>
                </div>
              </Space>
            </div>
          </Dropdown>
        ) : (
          <Tooltip title={`${userName} (${userRole})`} placement="right">
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Avatar 
                size={32} 
                style={{ 
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  fontWeight: 600,
                  fontSize: '12px'
                }}
              >
                {userName.split(' ').map(n => n[0]).join('').toUpperCase()}
              </Avatar>
            </div>
          </Tooltip>
        )}
      </div>

      {/* Navigation Menu */}
      <div style={{ 
        flex: 1, 
        background: antdTheme.token.colorBgContainer,
        padding: '8px 0',
        overflow: 'auto',
        maxHeight: 'calc(100vh - 280px)' // Account for header, user profile, theme toggle, and logout sections
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