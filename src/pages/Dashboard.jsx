import React, { useState, useEffect } from 'react';
import { Layout, Row, Col, Card, Typography, Button, Space, Statistic } from 'antd';
import { 
  TeamOutlined, 
  BookOutlined, 
  TrophyOutlined, 
  CalendarOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  RiseOutlined,
  UserOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import { useTheme } from '../contexts/ThemeContext';

const { Content } = Layout;
const { Title, Text } = Typography;

const Dashboard = () => {
  const { user } = useAuth();
  const { theme: antdTheme } = useTheme();
  
  const [stats, setStats] = useState([
    {
      title: 'Students',
      value: 0,
      icon: <TeamOutlined />,
      color: 'primary',
      trend: 12,
      suffix: '',
      description: 'Active students'
    },
    {
      title: 'Classes',
      value: 0,
      icon: <BookOutlined />,
      color: 'success',
      trend: 8,
      suffix: '',
      description: 'Active classes'
    },
    {
      title: 'Attendance',
      value: 0,
      icon: <CalendarOutlined />,
      color: 'info',
      trend: 3,
      suffix: '%',
      description: 'This month'
    },
    {
      title: 'Resources',
      value: 0,
      icon: <FileTextOutlined />,
      color: 'warning',
      trend: 15,
      suffix: '',
      description: 'Learning materials'
    }
  ]);

  const userName = user?.user_metadata?.full_name || 'User';
  const role = user?.app_metadata?.role || 'user';
  const schoolName = user?.user_metadata?.school_name || '';

  const getRoleDisplay = (role) => {
    const roles = {
      'cb_admin': 'CB Admin',
      'superadmin': 'Super Admin',
      'admin': 'Admin',
      'student': 'Student',
    };
    return roles[role] || 'User';
  };

  const getWelcomeMessage = (role) => {
    const hour = new Date().getHours();
    let greeting = 'Good morning';
    if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
    if (hour >= 17) greeting = 'Good evening';

    const messages = {
      'cb_admin': 'Manage schools and administrators across the platform.',
      'superadmin': 'Ready to manage your school system?',
      'admin': 'Let\'s check on your classes today.',
      'student': 'Ready to continue your learning journey?',
    };
    return { greeting, message: messages[role] || 'Welcome to ClassBridge!' };
  };

  const welcomeMsg = getWelcomeMessage(role);

  const getQuickActions = () => {
    if (role === 'superadmin') {
      return [
        { label: 'Add Student', icon: '👤', path: '/add-student', color: 'primary' },
        { label: 'Create Class', icon: '🏫', path: '/add-specific-class', color: 'success' },
        { label: 'Upload Resource', icon: '📤', path: '/learning-resources', color: 'info' },
        { label: 'View Analytics', icon: '📊', path: '/analytics', color: 'warning' }
      ];
    } else if (role === 'admin') {
      return [
        { label: 'Mark Attendance', icon: '✓', path: '/attendance', color: 'primary' },
        { label: 'Create Test', icon: '📝', path: '/test-management', color: 'success' },
        { label: 'Upload Resource', icon: '📤', path: '/learning-resources', color: 'info' },
        { label: 'View Results', icon: '🏆', path: '/results', color: 'warning' }
      ];
    } else if (role === 'student') {
      return [
        { label: 'Take Test', icon: '📝', path: '/take-tests', color: 'primary' },
        { label: 'View Resources', icon: '📚', path: '/learning-resources', color: 'success' },
        { label: 'Check Attendance', icon: '📅', path: '/attendance', color: 'info' },
        { label: 'View Grades', icon: '🏆', path: '/results', color: 'warning' }
      ];
    }
    return [];
  };

  const quickActions = getQuickActions();

  return (
    <div className="cb-container cb-section">
      {/* Modern Welcome Header */}
      <div className="cb-dashboard-header">
        <div className="cb-flex cb-justify-between cb-items-start">
          <div>
            <div className="cb-dashboard-welcome">
              {welcomeMsg.greeting}, {userName}! 👋
            </div>
            <div className="cb-dashboard-subtitle">
              {welcomeMsg.message}
            </div>
            {schoolName && (
              <div className="cb-badge cb-badge-primary cb-badge-lg cb-mt-3">
                🏫 {schoolName}
              </div>
            )}
          </div>
          
          <div className="cb-dashboard-actions">
            <div className="cb-badge cb-badge-primary">
              {getRoleDisplay(role)}
            </div>
            <button className="cb-button cb-button-ghost">
              <span>🔔</span>
            </button>
            <button className="cb-button cb-button-ghost">
              <span>⚙️</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modern KPI Cards */}
      <div className="cb-kpi-grid">
        {stats.map((stat, index) => (
          <div key={index} className="cb-kpi-card">
            <div className="cb-stat-header">
              <div className="cb-stat-icon">
                {stat.icon}
              </div>
              <div className={`cb-stat-change ${stat.trend > 0 ? 'positive' : stat.trend < 0 ? 'negative' : 'neutral'}`}>
                {stat.trend > 0 && '↗️'}
                {stat.trend < 0 && '↘️'}
                {stat.trend === 0 && '➡️'}
                {stat.trend > 0 ? '+' : ''}{stat.trend}%
              </div>
            </div>
            <div className="cb-stat-value">{stat.value}{stat.suffix}</div>
            <div className="cb-stat-label">{stat.title}</div>
            <div className="cb-text-caption-sm cb-mt-1">{stat.description}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions and Recent Activity */}
      <div className="cb-grid cb-grid-2">
        {/* Quick Actions */}
        <div className="cb-card">
          <div className="cb-card-header">
            <h3 className="cb-heading-4">Quick Actions</h3>
            <p className="cb-text-caption">Common tasks for your role</p>
          </div>
          <div className="cb-card-body">
            <div className="cb-quick-actions">
              {quickActions.map((action, index) => (
                <a
                  key={index}
                  href={action.path}
                  className="cb-quick-action"
                  onClick={(e) => {
                    e.preventDefault();
                    // Navigation would be handled by router
                    window.location.href = action.path;
                  }}
                >
                  <span className="cb-quick-action-icon">{action.icon}</span>
                  <span className="cb-quick-action-label">{action.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="cb-card">
          <div className="cb-card-header">
            <h3 className="cb-heading-4">Recent Activity</h3>
            <p className="cb-text-caption">Latest updates and actions</p>
          </div>
          <div className="cb-card-body">
            <div className="cb-list">
              <div className="cb-list-item">
                <div className="cb-stat-icon" style={{ 
                  width: '40px', 
                  height: '40px',
                  fontSize: 'var(--text-lg)',
                  background: 'var(--color-success-100)',
                  color: 'var(--color-success-600)'
                }}>
                  📅
                </div>
                <div className="cb-list-item-content">
                  <div className="cb-list-item-title">Attendance Marked</div>
                  <div className="cb-list-item-subtitle">Grade 10-A completed • 2 hours ago</div>
                </div>
              </div>
              <div className="cb-list-item">
                <div className="cb-stat-icon" style={{ 
                  width: '40px', 
                  height: '40px',
                  fontSize: 'var(--text-lg)',
                  background: 'var(--color-primary-100)',
                  color: 'var(--color-primary-600)'
                }}>
                  🎥
                </div>
                <div className="cb-list-item-content">
                  <div className="cb-list-item-title">New Resource Added</div>
                  <div className="cb-list-item-subtitle">Physics Chapter 5 video uploaded • 4 hours ago</div>
                </div>
              </div>
              <div className="cb-list-item">
                <div className="cb-stat-icon" style={{ 
                  width: '40px', 
                  height: '40px',
                  fontSize: 'var(--text-lg)',
                  background: 'var(--color-warning-100)',
                  color: 'var(--color-warning-600)'
                }}>
                  📝
                </div>
                <div className="cb-list-item-content">
                  <div className="cb-list-item-title">Results Published</div>
                  <div className="cb-list-item-subtitle">Math Quiz results are now available • 1 day ago</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Role-specific sections */}
      {(role === 'superadmin' || role === 'admin') && (
        <div className="cb-mt-8">
          <h3 className="cb-heading-3 cb-mb-6">Today's Overview</h3>
          <div className="cb-grid cb-grid-3">
            <div className="cb-card">
              <div className="cb-card-body">
                <h4 className="cb-heading-5 cb-mb-4">Attendance Summary</h4>
                <div className="cb-progress cb-mb-3">
                  <div 
                    className="cb-progress-bar cb-progress-success" 
                    style={{ width: '92%' }}
                  ></div>
                </div>
                <div className="cb-flex cb-justify-between cb-items-center">
                  <span className="cb-text-caption">92% present today</span>
                  <span className="cb-badge cb-badge-success cb-badge-sm">
                    ↗️ +3%
                  </span>
                </div>
              </div>
            </div>
            
            <div className="cb-card">
              <div className="cb-card-body">
                <h4 className="cb-heading-5 cb-mb-4">Pending Tasks</h4>
                <div className="cb-flex cb-flex-col cb-gap-3">
                  <div className="cb-flex cb-justify-between cb-items-center">
                    <span className="cb-text-secondary">Tests to grade</span>
                    <span className="cb-badge cb-badge-warning cb-badge-sm">3</span>
                  </div>
                  <div className="cb-flex cb-justify-between cb-items-center">
                    <span className="cb-text-secondary">Attendance to mark</span>
                    <span className="cb-badge cb-badge-error cb-badge-sm">2</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="cb-card">
              <div className="cb-card-body">
                <h4 className="cb-heading-5 cb-mb-4">This Week</h4>
                <div className="cb-flex cb-flex-col cb-gap-3">
                  <div className="cb-flex cb-justify-between cb-items-center">
                    <span className="cb-text-secondary">Tests scheduled</span>
                    <span className="cb-text-body-sm" style={{ fontWeight: 'var(--font-semibold)' }}>5</span>
                  </div>
                  <div className="cb-flex cb-justify-between cb-items-center">
                    <span className="cb-text-secondary">Resources added</span>
                    <span className="cb-text-body-sm" style={{ fontWeight: 'var(--font-semibold)' }}>12</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {role === 'student' && (
        <div className="cb-mt-8">
          <h3 className="cb-heading-3 cb-mb-6">Your Progress</h3>
          <div className="cb-grid cb-grid-2">
            <div className="cb-card">
              <div className="cb-card-header">
                <h4 className="cb-heading-5">This Week's Schedule</h4>
              </div>
              <div className="cb-card-body">
                <div className="cb-list">
                  <div className="cb-list-item">
                    <div className="cb-badge cb-badge-math">Math</div>
                    <div className="cb-list-item-content">
                      <div className="cb-list-item-title">Mathematics</div>
                      <div className="cb-list-item-subtitle">Today, 10:00 AM</div>
                    </div>
                    <button className="cb-button cb-button-sm cb-button-primary">Join</button>
                  </div>
                  <div className="cb-list-item">
                    <div className="cb-badge cb-badge-science">Science</div>
                    <div className="cb-list-item-content">
                      <div className="cb-list-item-title">Science Lab</div>
                      <div className="cb-list-item-subtitle">Tomorrow, 2:00 PM</div>
                    </div>
                    <button className="cb-button cb-button-sm cb-button-secondary">View</button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="cb-card">
              <div className="cb-card-header">
                <h4 className="cb-heading-5">Upcoming Tests</h4>
              </div>
              <div className="cb-card-body">
                <div className="cb-list">
                  <div className="cb-list-item">
                    <div className="cb-stat-icon" style={{ 
                      width: '32px', 
                      height: '32px',
                      fontSize: 'var(--text-base)',
                      background: 'var(--color-warning-100)',
                      color: 'var(--color-warning-600)'
                    }}>
                      📝
                    </div>
                    <div className="cb-list-item-content">
                      <div className="cb-list-item-title">Physics Unit Test</div>
                      <div className="cb-list-item-subtitle">Due in 3 days</div>
                    </div>
                    <button className="cb-button cb-button-sm cb-button-primary">
                      Take Test
                    </button>
                  </div>
                  <div className="cb-list-item">
                    <div className="cb-stat-icon" style={{ 
                      width: '32px', 
                      height: '32px',
                      fontSize: 'var(--text-base)',
                      background: 'var(--color-primary-100)',
                      color: 'var(--color-primary-600)'
                    }}>
                      📋
                    </div>
                    <div className="cb-list-item-content">
                      <div className="cb-list-item-title">Math Assignment</div>
                      <div className="cb-list-item-subtitle">Due in 1 week</div>
                    </div>
                    <button className="cb-button cb-button-sm cb-button-secondary">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;